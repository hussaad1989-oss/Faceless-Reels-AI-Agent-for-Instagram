import Groq from "groq-sdk";
import { OpenAIToolSet } from "composio-core";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const composio = new OpenAIToolSet({ apiKey: process.env.COMPOSIO_API_KEY });

async function runDailyAgent() {
  console.log("🚀 كابتن حسين: جارٍ كتابة وتخطيط الكاروسيل العلمي...");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `أنت المدرب والباحث حسين من العراق، مدرب لياقة وبناء أجسام معتمد من Menno Henselmans وصاحب حساب @hu.gym.
اكتب بوست كاروسيل من 4 شرائح لمبتدئي الجيم يجمع بين العلم المبني على الدلائل (Science-based fitness)، واللهجة العراقية الفصيحة السلسة، والمصطلحات الرياضية بالإنجليزية بين قوسين.
التزم بهوية الألوان (عنوان عربي باللون الأصفر الكريمي #F5E5C9 مع إطار أسود، وترجمة إنجليزية باللون الأبيض) وشخصية الكوتش الثابتة.
أخرج النتيجة بصيغة JSON حصراً بهذا الشكل:
{
  "topic": "عنوان الموضوع",
  "caption": "الكابشن الكامل مع 5 هاشتاغات مستهدفة للإمارات (#DubaiFitness #UAEGym #لياقة_دبي #DubaiPersonalTrainer #تمارين_الامارات)",
  "slides": [
    {
      "slide_number": 1,
      "text_ar": "النص العربي للشريحة",
      "text_en": "(English Subtitle)",
      "image_prompt": "A high quality 2D/3D anime comic illustration of a handsome 28yo Middle Eastern athletic fitness coach, short faded black hair, neatly groomed short black beard, muscular lean build, wearing a black sleeveless gym tank top in a bright modern gym with dumbbells, dynamic anime fitness art style, clean sharp line art, vibrant lighting, 4:5 vertical ratio"
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
  console.log("✅ تم تجهيز الموضوع:", postData.topic);

  const imageUrls = postData.slides.map((slide, idx) => {
    const prompt = encodeURIComponent(`${slide.image_prompt}, bold yellow Arabic title style, slide ${idx + 1}`);
    return `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1350&seed=${42 + idx}&nologo=true`;
  });

  const slidesSummary = postData.slides
    .map(s => `*شريحة ${s.slide_number}:* ${s.text_ar}\n${s.text_en}`)
    .join("\n\n");

  const tgText = `🏋️‍♂️ *كابتن حسين، البوت جهز كاروسيل اليوم لحساب @hu.gym!*\n\n📌 *الموضوع:* ${postData.topic}\n\n🖼️ *محتوى الشرائح:*\n${slidesSummary}\n\n📝 *الكابشن والهاشتاغات:*\n${postData.caption}`;

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: tgText,
      parse_mode: "Markdown"
    })
  });

  for (const [index, url] of imageUrls.entries()) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        photo: url,
        caption: `شريحة ${index + 1}: ${postData.slides[index].text_ar}\n${postData.slides[index].text_en}`
      })
    });
  }

  console.log("📤 جارٍ النشر على إنستغرام عبر Composio...");
  const entity = await composio.getEntity("default");

  const itemIds = [];
  for (const url of imageUrls) {
    const container = await entity.execute({
      action: "INSTAGRAM_CREATE_CAROUSEL_CONTAINER",
      params: { image_url: url, is_carousel_item: true }
    });
    if (container?.data?.id) itemIds.push(container.data.id);
  }

  if (itemIds.length > 0) {
    await entity.execute({
      action: "INSTAGRAM_CREATE_MEDIA_CONTAINER",
      params: {
        media_type: "CAROUSEL",
        children: itemIds,
        caption: postData.caption
      }
    });
  }

  console.log("🎉 تمت العملية بنجاح!");
}

runDailyAgent().catch(console.error);
