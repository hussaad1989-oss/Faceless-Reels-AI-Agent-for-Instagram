import Groq from "groq-sdk";
import { OpenAIToolSet } from "composio-core";

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text })
  });
  const data = await res.json();
  if (!data.ok) console.error("❌ خطأ تيليجرام:", data);
  return data;
}

async function runDailyAgent() {
  console.log("🔍 1. فحص اتصال تيليجرام...");
  await sendTelegram("✅ 1/4: اتصال بوت تيليجرام شغال بنجاح يا كابتن حسين!\n⏳ جارٍ فحص اتصال Groq و Composio وحساب إنستغرام...");

  console.log("🔍 2. فحص اتصال Composio وإنستغرام...");
  const composio = new OpenAIToolSet({ apiKey: process.env.COMPOSIO_API_KEY });
  const entity = await composio.getEntity("default");

  let igUserId = null;
  let igUsername = "غير معروف";
  try {
    const userInfo = await entity.execute({
      action: "INSTAGRAM_GET_USER_INFO",
      params: {}
    });
    console.log("📋 بيانات حساب إنستغرام من Composio:", JSON.stringify(userInfo));
    igUserId = userInfo?.data?.id || userInfo?.data?.ig_user_id || userInfo?.id;
    igUsername = userInfo?.data?.username || userInfo?.data?.name || "متصل";
    await sendTelegram(`✅ 2/4: اتصال Composio وإنستغرام ناجح!\n👤 الحساب المربوط: @${igUsername}\n🆔 معرف الحساب: ${igUserId}`);
  } catch (err) {
    await sendTelegram(`⚠️ تنبيه في اتصال Composio/Instagram:\n${err.message}`);
    throw err;
  }

  console.log("🔍 3. توليد المحتوى العلمي عبر Groq...");
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `أنت المدرب والباحث حسين من العراق، مدرب لياقة وبناء أجسام معتمد من Menno Henselmans وصاحب حساب @hu.gym.
اكتب بوست كاروسيل من 4 شرائح لمبتدئي الجيم يجمع بين العلم المبني على الدلائل، واللهجة العراقية الفصيحة، والمصطلحات الإنجليزية بين قوسين.
أخرج النتيجة بصيغة JSON حصراً بهذا الشكل:
{
  "topic": "عنوان الموضوع",
  "caption": "الكابشن الكامل مع 5 هاشتاغات للإمارات (#DubaiFitness #UAEGym #لياقة_دبي #DubaiPersonalTrainer #تمارين_الامارات)",
  "slides": [
    {
      "slide_number": 1,
      "text_ar": "النص العربي للشريحة",
      "text_en": "(English Subtitle)",
      "image_prompt": "2D 3D anime comic illustration of a handsome 28yo Middle Eastern athletic fitness coach, short faded black hair, neatly groomed short black beard, muscular lean build, wearing a black sleeveless gym tank top in a bright modern gym with dumbbells, clean line art, vibrant lighting"
    }
  ]
}`
      },
      {
        role: "user",
        content: "اختر موضوعاً علمياً مهماً للمبتدئين من منهج Menno Henselmans (تكملة لبوست أول يوم بالجم) وولّد الكاروسيل الكامل."
      }
    ]
  });

  const postData = JSON.parse(completion.choices[0].message.content);
  const slidesSummary = postData.slides.map(s => `• شريحة ${s.slide_number}: ${s.text_ar} ${s.text_en}`).join("\n");
  await sendTelegram(`✅ 3/4: تم كتابة البوست عبر Groq بنجاح!\n\n📌 الموضوع: ${postData.topic}\n\n🖼️ الشرائح:\n${slidesSummary}\n\n📝 الكابشن:\n${postData.caption}`);

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

  console.log("📤 4. رفع ونشر الكاروسيل على إنستغرام...");
  const childIds = [];
  for (const url of imageUrls) {
    const itemRes = await entity.execute({
      action: "INSTAGRAM_CREATE_MEDIA_CONTAINER",
      params: { ig_user_id: igUserId, image_url: url, is_carousel_item: true }
    });
    const cid = itemRes?.data?.id || itemRes?.id;
    if (cid) childIds.push(cid);
  }

  const carouselRes = await entity.execute({
    action: "INSTAGRAM_CREATE_CAROUSEL_CONTAINER",
    params: { ig_user_id: igUserId, children: childIds, caption: postData.caption }
  });
  const creationId = carouselRes?.data?.id || carouselRes?.id;

  await new Promise(r => setTimeout(r, 5000));

  const publishRes = await entity.execute({
    action: "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
    params: { ig_user_id: igUserId, creation_id: creationId }
  });

  await sendTelegram(`🎉 4/4: مبروك يا كابتن! تم نشر الكاروسيل رسمياً على حسابك في إنستغرام!\nنتيجة النشر: ${JSON.stringify(publishRes?.data || publishRes)}`);
}

runDailyAgent().catch(async (err) => {
  console.error("❌ Error:", err);
  await sendTelegram(`❌ توقف البوت عند خطأ:\n${err.message}`);
  process.exit(1);
});
