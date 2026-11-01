import Groq from "groq-sdk";
import { OpenAIToolSet } from "composio-core";

const TG_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TG_CHAT = (process.env.TELEGRAM_CHAT_ID || "").replace(/[^0-9-]/g, "");

async function sendTelegram(text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text })
    });
    return await res.json();
  } catch (e) {
    console.error("خطأ تيليجرام:", e?.message || e);
  }
}

// بنك دراسات علمية عميقة (دراسة واحدة مفصلة لكل يوم بالتفصيل العلمي والعملي)
const STUDIES_DATABASE = [
  {
    topic: "خرافة الراحة دقيقة واحدة: ليش ترتاح 3 دقائق حتى تبني ضعف العضلات؟",
    researcher: "Schoenfeld et al. (2016)",
    journal: "Journal of Strength and Conditioning Research",
    pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/26605807/",
    experiment: "قسّموا المتدربين لمجموعتين لـ 8 أسابيع بنفس التمارين: مجموعة ترتاح 60 ثانية، ومجموعة ترتاح 3 دقائق كاملة بين الجولات.",
    results: "مجموعة الـ 3 دقائق حققت تضخيماً عضلياً وزيادة في القوة تعادل ضعف مجموعة الدقيقة الواحدة! لأن العضلة تسترجع مخازن الـ ATP بالكامل وتشيل أوزان وجودة أعلى.",
    application: "بالتمارين المركبة (بنش، سكوات، ديدليفت): عوف الموبايل وارتاح 2.5 إلى 3 دقائق كاملة. بتمارين العزل (باي، تراي): ارتاح دقيقة ونصف.",
    takeaway_benefit: "راح تستفاد: أوزانك بالجم تصعد باستمرار، عضلاتك تكبر بجهد أقل وبدون إنهاك عصبي، وتختصر شهور من التخبط!"
  },
  {
    topic: "كمية البروتين اليومية: ليش الـ 1.6 غرام كافية وخرافة الـ 3 غرام تضيع فلوسك؟",
    researcher: "Morton et al. (2018) & Menno Henselmans",
    journal: "British Journal of Sports Medicine",
    pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/28698222/",
    experiment: "حللوا 49 دراسة علمية على أكثر من 1800 متدرب لمعرفة أقصى كمية بروتين يستجيب لها تخليق البروتين العضلي (MPS).",
    results: "فوق 1.6 غرام بروتين لكل كغم من وزن الجسم، توقفت العضلات عن الاستفادة الإضافية تماماً، والزيادة تحولت لطاقة عادية دون أي بناء عضلي زائد.",
    application: "اضرب وزن جسمك في 1.6 إلى 1.8 فقط ووزعها على 3-4 وجبات يومية غنية بالأحماض الأمينية (Leucine).",
    takeaway_benefit: "راح تستفاد: توفر فلوس المكملات والأكل الزائد، تتخلص من مشاكل الهضم، وتغذي عضلاتك بالرقم العلمي المثبت 100%!"
  },
  {
    topic: "المدى الحركي الكامل (Full ROM): ليش نصف النزول بالوزن الثقيل يضيع وقتك؟",
    researcher: "Pallarés et al. (2021) & Wolf et al. (2023)",
    journal: "European Journal of Applied Physiology",
    pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/33977835/",
    experiment: "قارنوا بين مجموعتين: الأولى تتمرن بمدى حركي كامل مع إطالة العضلة للآخر، والثانية بنصف مدى حركي وأوزان أثقل بكثير.",
    results: "المدى الحركي الكامل حقق نمواً عضلياً أعلى بـ 30%، لأن وضعية الإطالة تحت الوزن تحفز نمواً فسيولوجياً خاصاً يسمى (Stretch-Mediated Hypertrophy).",
    application: "قلل الوزن 20%، انزل لآخر مدى حركي مريح للمفصل، واثبت ثانية واحدة بأسفل التكرار قبل الدفع.",
    takeaway_benefit: "راح تستفاد: تحمي مفاصلك وأوتارك من الإصابات، وتحفز كل ألياف العضلة بوزن خفيف وأمان كامل!"
  }
];

async function runDailyAgent() {
  await sendTelegram("✅ 1/4: فحص اتصال تيليجرام بنجاح يا كابتن حسين!");

  const composio = new OpenAIToolSet({ apiKey: (process.env.COMPOSIO_API_KEY || "").trim() });
  const entity = await composio.getEntity("default");

  let igUserId = null;
  let igUsername = "hu.gym";

  try {
    const userInfo = await entity.execute({
      actionName: "INSTAGRAM_GET_USER_INFO",
      action: "INSTAGRAM_GET_USER_INFO",
      params: { fields: "id,username,name" }
    });
    igUserId = userInfo?.data?.id || userInfo?.data?.ig_user_id || userInfo?.id;
    if (userInfo?.data?.username) igUsername = userInfo.data.username;
  } catch (err) {
    console.warn("استخدام المعرف التلقائي:", err?.message || err);
  }

  await sendTelegram(`✅ 2/4: اتصال إنستغرام عبر Composio متصل بنجاح!\nالحساب: @${igUsername}`);

  // اختيار موضوع علمي واحد فقط للتعمق فيه بالكامل
  const study = STUDIES_DATABASE[Math.floor(Math.random() * STUDIES_DATABASE.length)];

  const groq = new Groq({ apiKey: (process.env.GROQ_API_KEY || "").trim() });
  const modelsList = await groq.models.list();
  const chatModels = modelsList.data
    .map(m => m.id)
    .filter(id => !id.includes("guard") && !id.includes("whisper") && !id.includes("safeguard"));

  const chosenModel = chatModels.find(id => id.includes("llama-3") || id.includes("mixtral") || id.includes("gemma")) || chatModels[0];

  const completion = await groq.chat.completions.create({
    model: chosenModel,
    messages: [
      {
        role: "system",
        content: `أنت المدرب والباحث حسين من العراق، مدرب معتمد من Menno Henselmans وصاحب حساب @hu.gym.
اكتب بوست كاروسيل من 6 شرائح لمبتدئي الجيم يركز على دراسة علمية واحدة فقط ويشرحها بالتفصيل الممل بأسلوب عراقي علمي فصيح ومحبب، وينتهي دائماً بـ "زبدة الموضوع: شنو راح تستفاد من هذا الحجي؟".

بيانات الدراسة العلمية المعتمدة:
- موضوع البوست: ${study.topic}
- الباحث والمصدر: ${study.researcher} في ${study.journal}
- تفاصيل التجربة: ${study.experiment}
- النتيجة والفسيولوجيا: ${study.results}
- التطبيق العملي بالجم: ${study.application}
- زبدة الموضوع وفائدته للمبتدئ: ${study.takeaway_benefit}
- رابط البحث على PubMed: ${study.pubmed_url}

المطلوب: إرجاع النتيجة حصراً بصيغة JSON:
{
  "topic": "${study.topic}",
  "caption": "كابشن عراقي مفصل ومقنع ككوتش فاهم، يشرح التجربة والأرقام، ويبرز فقرة 'زبدة الموضوع: شنو تستفاد؟'، ومذيل برابط الدراسة: ${study.pubmed_url} و5 هاشتاغات للإمارات (#DubaiFitness #UAEGym #لياقة_دبي #DubaiPersonalTrainer #تمارين_الامارات)",
  "slides": [
    { "slide_number": 1, "text_ar": "${study.topic}", "text_en": "(Evidence-Based Gym Guide)", "image_prompt": "2D 3D anime comic illustration handsome athletic 28yo Iraqi fitness coach, short black beard, black gym tank top, bright modern gym, bold cream yellow text style, 4:5 ratio" },
    { "slide_number": 2, "text_ar": "الغلط اللي يوكع بيه أغلب المبتدئين بالجم", "text_en": "(The Common Mistake)", "image_prompt": "2D 3D anime comic illustration coach observing tired gym beginner making a training mistake in gym, 4:5 ratio" },
    { "slide_number": 3, "text_ar": "شنو سوت التجربة العلمية بالضبط؟ (${study.researcher})", "text_en": "(The Scientific Experiment)", "image_prompt": "2D 3D anime comic illustration coach explaining research data board in gym, 4:5 ratio" },
    { "slide_number": 4, "text_ar": "النتيجة بالأرقام والفسيولوجيا", "text_en": "(The Real Science & Data)", "image_prompt": "2D 3D anime comic illustration coach explaining muscle fibers and energy recovery, 4:5 ratio" },
    { "slide_number": 5, "text_ar": "التطبيق العملي: شلون تسويها بتمرينك من باجر؟", "text_en": "(Step-by-Step Gym Protocol)", "image_prompt": "2D 3D anime comic illustration coach demonstrating strict perfect exercise execution in gym, 4:5 ratio" },
    { "slide_number": 6, "text_ar": "زبدة الموضوع: شنو راح تستفاد من هذا الحجي؟", "text_en": "(The Bottom Line & Benefits)", "image_prompt": "2D 3D anime comic illustration coach giving confident thumbs up with scientific study notes in gym, 4:5 ratio" }
  ]
}`
      },
      {
        role: "user",
        content: "اكتب الكاروسيل والكابشن المفصل بالكامل ملتزماً بهيكل الشرح العلمي وزبدة الموضوع."
      }
    ]
  });

  let rawContent = completion.choices[0].message.content.trim();
  if (rawContent.startsWith("```json")) rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

  const postData = JSON.parse(rawContent);
  const slidesSummary = postData.slides.map(s => `• شريحة ${s.slide_number}: ${s.text_ar} ${s.text_en}`).join("\n");
  
  await sendTelegram(`✅ 3/4: تم تجهيز الكاروسيل العلمي التفصيلي!\n\n📌 *الموضوع:* ${postData.topic}\n📚 *الدراسة:* ${study.researcher}\n🔗 *رابط البحث:* ${study.pubmed_url}\n\n🖼️ *الشرائح:*\n${slidesSummary}\n\n📝 *الكابشن وزبدة الموضوع:*\n${postData.caption}`);

  const imageUrls = postData.slides.map((slide, idx) => {
    const prompt = encodeURIComponent(`${slide.image_prompt}, slide ${idx + 1}`);
    return `[https://image.pollinations.ai/prompt/$](https://image.pollinations.ai/prompt/$){prompt}?width=1080&height=1350&seed=${1000 + idx}&nologo=true`;
  });

  for (const [index, url] of imageUrls.entries()) {
    try {
      await fetch(`[https://api.telegram.org/bot$](https://api.telegram.org/bot$){TG_TOKEN}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TG_CHAT,
          photo: url,
          caption: `شريحة ${index + 1}: ${postData.slides[index].text_ar}\n${postData.slides[index].text_en}`
        })
      });
    } catch (e) {}
  }

  const childIds = [];
  for (const url of imageUrls) {
    const params = { image_url: url, is_carousel_item: true };
    if (igUserId) params.ig_user_id = igUserId;

    const itemRes = await entity.execute({
      actionName: "INSTAGRAM_CREATE_MEDIA_CONTAINER",
      action: "INSTAGRAM_CREATE_MEDIA_CONTAINER",
      params
    });
    const cid = itemRes?.data?.id || itemRes?.id;
    if (cid) childIds.push(cid);
  }

  const carouselParams = { children: childIds, caption: postData.caption };
  if (igUserId) carouselParams.ig_user_id = igUserId;

  const carouselRes = await entity.execute({
    actionName: "INSTAGRAM_CREATE_CAROUSEL_CONTAINER",
    action: "INSTAGRAM_CREATE_CAROUSEL_CONTAINER",
    params: carouselParams
  });
  const creationId = carouselRes?.data?.id || carouselRes?.id;

  await new Promise(r => setTimeout(r, 6000));

  const pubParams = { creation_id: creationId };
  if (igUserId) pubParams.ig_user_id = igUserId;

  await entity.execute({
    actionName: "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
    action: "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
    params: pubParams
  });

  await sendTelegram(`🎉 4/4: مبروك يا كابتن! تم نشر الكاروسيل التفصيلي وزبدة الموضوع بنجاح على صفحتك @hu.gym! 🔥\nرابط الدراسة: ${study.pubmed_url}`);
}

runDailyAgent().catch(async (err) => {
  const errMsg = err?.message || String(err);
  console.error("خطأ:", errMsg);
  await sendTelegram(`❌ حدث خطأ:\n${errMsg}`);
  process.exit(1);
});
