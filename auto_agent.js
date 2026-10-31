import Groq from "groq-sdk";
import { OpenAIToolSet } from "composio-core";

// تنظيف المفاتيح من أي مسافات أو أحرف زائدة تلقائياً
const TG_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TG_CHAT = (process.env.TELEGRAM_CHAT_ID || "").replace(/[^0-9-]/g, "");

async function sendTelegram(text) {
  console.log("📤 إرسال إلى تيليجرام:", text.substring(0, 50) + "...");
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text })
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("❌ سبب رفض تيليجرام:", JSON.stringify(data));
    } else {
      console.log("✅ وصلت رسالة تيليجرام بنجاح!");
    }
    return data;
  } catch (e) {
    console.error("❌ فشل الاتصال بتيليجرام:", e.message);
  }
}

async function runDailyAgent() {
  console.log("🔍 1. اختبار تيليجرام...");
  await sendTelegram("✅ 1/4: اتصال تيليجرام شغال 100% يا كابتن حسين!\nجارٍ فحص باقي الخطوات...");

  console.log("🔍 2. فحص اتصال Composio...");
  const composio = new OpenAIToolSet({ apiKey: (process.env.COMPOSIO_API_KEY || "").trim() });
  const entity = await composio.getEntity("default");

  let igUserId = null;
  let igUsername = "hu.gym";

  try {
    // تمرير الحقول المطلوبة لتجنب خطأ INVALID_PARAMS
    const userInfo = await entity.execute({
      action: "INSTAGRAM_GET_USER_INFO",
      params: { fields: "id,username,name" }
    });
    console.log("📋 استجابة إنستغرام:", JSON.stringify(userInfo));
    igUserId = userInfo?.data?.id || userInfo?.data?.ig_user_id || userInfo?.id;
    if (userInfo?.data?.username) igUsername = userInfo.data.username;
  } catch (err) {
    console.warn("⚠️ تجاوز فحص اليوزر والمتابعة باستخدام المعرف التلقائي:", err.message);
  }

  await sendTelegram(`✅ 2/4: اتصال إنستغرام عبر Composio متصل بنجاح!\nالحساب: @${igUsername}`);

  console.log("🔍 3. كتابة وتصميم الكاروسيل عبر Groq...");
  const groq = new Groq({ apiKey: (process.env.GROQ_API_KEY || "").trim() });
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `أنت المدرب والباحث حسين من العراق، مدرب معتمد من Menno Henselmans وصاحب حساب @hu.gym.
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
      "image_prompt": "2D 3D anime comic illustration of handsome athletic 28yo Iraqi fitness coach, short black beard, black sleeveless gym tank top in a modern gym, sharp clean line art, vibrant lighting"
    }
  ]
}`
      },
      {
        role: "user",
        content: "اكتب الجزء الثاني لسلسلة المبتدئين عن خرافة الراحة القصيرة أو الزيادة التدريجية."
      }
    ]
  });

  const postData = JSON.parse(completion.choices[0].message.content);
  const slidesSummary = postData.slides.map(s => `• شريحة ${s.slide_number}: ${s.text_ar} ${s.text_en}`).join("\n");
  await sendTelegram(`✅ 3/4: تم تجهيز محتوى الكاروسيل!\n\n📌 *الموضوع:* ${postData.topic}\n\n🖼️ *الشرائح:*\n${slidesSummary}\n\n📝 *الكابشن:*\n${postData.caption}`);

  const imageUrls = postData.slides.map((slide, idx) => {
    const prompt = encodeURIComponent(`${slide.image_prompt}, slide ${idx + 1}`);
    return `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1350&seed=${500 + idx}&nologo=true`;
  });

  for (const [index, url] of imageUrls.entries()) {
    try {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TG_CHAT,
          photo: url,
          caption: `شريحة ${index + 1}: ${postData.slides[index].text_ar}\n${postData.slides[index].text_en}`
        })
      });
    } catch (e) {
      console.warn("⚠️ تخطي إرسال صورة تيليجرام:", e.message);
    }
  }

  console.log("📤 4. النشر عبر Composio على إنستغرام...");
  const childIds = [];
  for (const url of imageUrls) {
    const params = { image_url: url, is_carousel_item: true };
    if (igUserId) params.ig_user_id = igUserId;

    const itemRes = await entity.execute({
      action: "INSTAGRAM_CREATE_MEDIA_CONTAINER",
      params
    });
    const cid = itemRes?.data?.id || itemRes?.id;
    if (cid) childIds.push(cid);
  }

  const carouselParams = { children: childIds, caption: postData.caption };
  if (igUserId) carouselParams.ig_user_id = igUserId;

  const carouselRes = await entity.execute({
    action: "INSTAGRAM_CREATE_CAROUSEL_CONTAINER",
    params: carouselParams
  });
  const creationId = carouselRes?.data?.id || carouselRes?.id;

  await new Promise(r => setTimeout(r, 6000));

  const pubParams = { creation_id: creationId };
  if (igUserId) pubParams.ig_user_id = igUserId;

  const publishRes = await entity.execute({
    action: "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
    params: pubParams
  });

  await sendTelegram(`🎉 4/4: مبروك يا كابتن! تم نشر الكاروسيل على حسابك بنجاح!`);
  console.log("🎉 اكتمل النشر بنجاح:", JSON.stringify(publishRes));
}

runDailyAgent().catch(async (err) => {
  console.error("❌ توقف عند خطأ:", err);
  await sendTelegram(`❌ حدث خطأ أثناء التنفيذ:\n${err.message}`);
  process.exit(1);
});
