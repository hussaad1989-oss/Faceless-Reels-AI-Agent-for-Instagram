import Groq from "groq-sdk";
import { OpenAIToolSet } from "composio-core";

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
const INSTAGRAM_USERNAME = process.env.INSTAGRAM_USERNAME || "hu.gym";

async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) {
    console.error("Telegram env vars missing:", { TG_TOKEN: !!TG_TOKEN, TG_CHAT: !!TG_CHAT });
    return null;
  }

  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text })
  });

  const data = await res.json();
  if (!data.ok) console.error("❌ Telegram send failed:", data);
  return data;
}

async function runDailyAgent() {
  console.log("🔍 1. Checking Telegram connection...");
  await sendTelegram("✅ 1/4: Telegram bot is working.\n⏳ Checking Groq, Composio, and Instagram...");

  console.log("🔍 2. Checking Composio + Instagram...");
  const composio = new OpenAIToolSet({ apiKey: process.env.COMPOSIO_API_KEY });
  const entity = await composio.getEntity("default");

  let igUserId = null;
  let igUsername = "غير معروف";

  try {
    const userInfo = await entity.execute({
      ActionName: "INSTAGRAM_GET_USER_INFO",
      Arguments: {
        username: INSTAGRAM_USERNAME
      }
    });

    console.log("📋 Instagram user info from Composio:", JSON.stringify(userInfo));

    igUserId = userInfo?.data?.id || userInfo?.data?.ig_user_id || userInfo?.id;
    igUsername = userInfo?.data?.username || userInfo?.data?.name || INSTAGRAM_USERNAME || "متصل";

    if (!igUserId) {
      throw new Error("No Instagram user ID returned from Composio");
    }

    await sendTelegram(`✅ 2/4: Composio + Instagram connected successfully!\n👤 Account: @${igUsername}\n🆔 ID: ${igUserId}`);
  } catch (err) {
    console.error("❌ Instagram/Composio error:", err);
    await sendTelegram(`⚠️ Composio/Instagram connection failed:\n${err.message}`);
    throw err;
  }

  console.log("🔍 3. Generating scientific fitness content with Groq...");
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `أنت المدرب والباحث حسين من العراق، مدرب لياقة وبناء أجسام معتمد من Menno Henselmans وصاحب حساب @hu.gym.
اكتب بوست كاروسيل من 4 شرائح لمبتدئي الجيم يجمع بين العلم المبني على الدلائل، واللهجة العراقية الفصيحة، واللغة الإنجليزية للمشاهدات العربية/الإنجليزية.
أخرج النتيجة بصيغة JSON حصراً بهذا الشكل:
{
  "topic": "عنوان الموضوع",
  "caption": "الكابشن الكامل مع 5 هاشتاغات للإمارات (#DubaiFitness #UAEGym #لياقة_دبي #DubaiPersonalTrainer #تمارين_الامارات)",
  "slides": [
    {
      "slide_number": 1,
      "text_ar": "النص العربي للشريحة",
      "text_en": "(English Subtitle)",
      "image_prompt": "beautiful fitness illustration ..."
    }
  ]
}`
      },
      {
        role: "user",
        content: "اختر موضوعاً علمياً مهماً للمبتدئين من منهج Menno Henselmans (تكملة لبوست أول يوم بالجم) وولّد الكاروسيل."
      }
    ]
  });

  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned empty content");
  }

  const postData = JSON.parse(content);
  const slidesSummary = postData.slides.map(s => `• شريحة ${s.slide_number}: ${s.text_ar} ${s.text_en}`).join("\n");

  await sendTelegram(`✅ 3/4: The post was generated successfully via Groq!\n\n📌 Topic: ${postData.topic}\n\n🖼️ Slides:\n${slidesSummary}\n\n📝 Caption:\n${postData.caption}`);

  const imageUrls = postData.slides.map((slide, idx) => {
    const prompt = encodeURIComponent(`${slide.image_prompt}, slide ${idx + 1}`);
    return `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1350&seed=${100 + idx}&nologo=true`;
  });

  for (const [index, url] of imageUrls.entries()) {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        photo: url,
        caption: `شريحة ${index + 1}: ${postData.slides[index].text_ar}\n${postData.slides[index].text_en}`
      })
    });
  }

  console.log("📤 4. Uploading and publishing carousel on Instagram...");
  const childIds = [];

  for (const url of imageUrls) {
    const itemRes = await entity.execute({
      ActionName: "INSTAGRAM_CREATE_MEDIA_CONTAINER",
      Arguments: {
        ig_user_id: igUserId,
        image_url: url,
        is_carousel_item: true
      }
    });

    const cid = itemRes?.data?.id || itemRes?.id;
    if (cid) childIds.push(cid);
  }

  const carouselRes = await entity.execute({
    ActionName: "INSTAGRAM_CREATE_CAROUSEL_CONTAINER",
    Arguments: {
      ig_user_id: igUserId,
      children: childIds,
      caption: postData.caption
    }
  });

  const creationId = carouselRes?.data?.id || carouselRes?.id;

  if (!creationId) {
    throw new Error("Instagram carousel creation failed: no creation ID returned");
  }

  await new Promise(r => setTimeout(r, 5000));

  const publishRes = await entity.execute({
    ActionName: "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
    Arguments: {
      ig_user_id: igUserId,
      creation_id: creationId
    }
  });

  await sendTelegram(`🎉 4/4: Your Instagram carousel was published successfully!\n\nResult: ${JSON.stringify(publishRes)}`);
}

runDailyAgent().catch(async (err) => {
  console.error("❌ Script failed:", err);
  await sendTelegram(`❌ Bot stopped with error:\n${err.message}`);
  process.exit(1);
});
