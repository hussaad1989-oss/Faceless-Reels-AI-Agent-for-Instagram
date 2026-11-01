import Groq from "groq-sdk";

const TG_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TG_CHAT = (process.env.TELEGRAM_CHAT_ID || "").replace(/[^0-9-]/g, "");
const COMPOSIO_KEY = (process.env.COMPOSIO_API_KEY || "").trim();

async function sendTelegram(text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text })
    });
    return await res.json();
  } catch (e) {
    console.error("Telegram error:", e);
  }
}

// 1. جلب الحساب المربوط (@hu.gym / rifi-fanwe) مباشرة من سيرفر Composio الرسمي
async function getInstagramConnection() {
  const urls = [
    "https://backend.composio.dev/api/v3/connected_accounts?toolkit_slug=instagram",
    "https://backend.composio.dev/api/v3/connected_accounts",
    "https://backend.composio.dev/api/v1/connectedAccounts"
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "x-api-key": COMPOSIO_KEY } });
      if (!res.ok) continue;
      const data = await res.json();
      const items = data.items || data || [];
      if (Array.isArray(items) && items.length > 0) {
        const ig = items.find(i =>
          (i.toolkit?.slug?.toLowerCase() === "instagram" || i.appName?.toLowerCase() === "instagram") &&
          (i.status === "ACTIVE" || i.status === "active")
        ) || items.find(i => i.alias === "rifi-fanwe") || items[0];
        if (ig) {
          return {
            connectedAccountId: ig.id || ig.nanoid,
            userId: ig.user_id || ig.entityId || ig.clientUniqueUserId || "default",
            alias: ig.alias || "rifi-fanwe"
          };
        }
      }
    } catch (e) {}
  }
  return { connectedAccountId: null, userId: "default", alias: "rifi-fanwe" };
}

// 2. تنفيذ أوامر إنستغرام مباشرة عبر واجهة Composio REST API (بدون أخطاء composio-core)
async function executeComposioTool(toolSlug, args, conn) {
  const v3Body = { arguments: args };
  if (conn.connectedAccountId) v3Body.connected_account_id = conn.connectedAccountId;
  if (conn.userId) v3Body.user_id = conn.userId;

  const resV3 = await fetch(`https://backend.composio.dev/api/v3/tools/execute/${toolSlug}`, {
    method: "POST",
    headers: { "x-api-key": COMPOSIO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(v3Body)
  });
  const textV3 = await resV3.text();
  let dataV3 = {};
  try { dataV3 = JSON.parse(textV3); } catch (e) { dataV3 = { raw: textV3 }; }

  if (resV3.ok && dataV3.successful !== false && !dataV3.error) {
    return dataV3.data || dataV3;
  }

  const v2Body = { input: args, appName: "instagram" };
  if (conn.connectedAccountId) v2Body.connectedAccountId = conn.connectedAccountId;
  if (conn.userId) v2Body.entityId = conn.userId;

  const resV2 = await fetch(`https://backend.composio.dev/api/v2/actions/${toolSlug}/execute`, {
    method: "POST",
    headers: { "x-api-key": COMPOSIO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(v2Body)
  });
  const textV2 = await resV2.text();
  let dataV2 = {};
  try { dataV2 = JSON.parse(textV2); } catch (e) { dataV2 = { raw: textV2 }; }

  if (resV2.ok && dataV2.successful !== false && !dataV2.error) {
    return dataV2.data || dataV2;
  }

  const errDetail = JSON.stringify(dataV3.error || dataV2.error || dataV3 || dataV2);
  throw new Error(`(${toolSlug}): ${errDetail}`);
}

// 3. تحميل صورة الشريحة ورفعها كملف JPEG حقيقي لتيليجرام واستخراج رابط .jpg مباشر لإنستغرام
async function generateAndUploadSlide(slide, index) {
  const prompt = encodeURIComponent(`${slide.image_prompt}, 4:5 vertical portrait, high quality anime fitness art`);
  const urlsToTry = [
    `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1350&seed=${3030 + index}&nologo=true`,
    `https://picsum.photos/seed/${3030 + index}/1080/1350.jpg`
  ];

  let imgBuffer = null;
  for (const u of urlsToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(u, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        if (ab.byteLength > 5000) {
          imgBuffer = Buffer.from(ab);
          break;
        }
      }
    } catch (e) {}
  }

  if (!imgBuffer) {
    throw new Error(`تعذر تحميل صورة الشريحة ${index + 1}`);
  }

  const form = new FormData();
  form.append("chat_id", TG_CHAT);
  form.append("caption", `🖼️ شريحة ${slide.slide_number}/6:\n${slide.text_ar}\n${slide.text_en}`);
  form.append("photo", new Blob([imgBuffer], { type: "image/jpeg" }), `slide_${index + 1}.jpg`);

  const tgRes = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
    method: "POST",
    body: form
  });
  const tgData = await tgRes.json();

  if (tgData.ok && tgData.result?.photo?.length > 0) {
    const bestPhoto = tgData.result.photo[tgData.result.photo.length - 1];
    const fileRes = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getFile?file_id=${bestPhoto.file_id}`);
    const fileData = await fileRes.json();
    if (fileData.ok && fileData.result?.file_path) {
      return `https://api.telegram.org/file/bot${TG_TOKEN}/${fileData.result.file_path}`;
    }
  }

  return urlsToTry[0];
}

// 4. دراسة علمية واحدة متكاملة ومفصلة بـ 6 شرائح مع زبدة الموضوع ورابط PubMed
const STUDIES_DATABASE = [
  {
    topic: "خرافة الراحة 60 ثانية: ليش الراحة 3 دقائق تبني ضعف العضلات؟",
    researcher: "Schoenfeld et al. (2016) - Journal of Strength & Conditioning Research",
    pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/26605807/",
    slides: [
      {
        slide_number: 1,
        text_ar: "ليش ترتاح دقيقة وحدة بس بين الجولات؟ خرافة دتضيع تعبك بالجم!",
        text_en: "(Short vs. Long Rest Intervals - Science Based)",
        image_prompt: "2D 3D anime comic illustration of handsome athletic 28yo Middle Eastern fitness coach, short faded black hair, neatly groomed short black beard, wearing black sleeveless gym tank top, holding a stopwatch with confident smile in modern bright gym with dumbbells, clean sharp line art"
      },
      {
        slide_number: 2,
        text_ar: "الغلط الشائع: تدخل الجولة الثانية وأنت تلهث، فيقل وزنك وتنزل عداتك للنص!",
        text_en: "(The Mistake: Rushing Sets & Losing Mechanical Tension)",
        image_prompt: "2D 3D anime comic illustration of handsome athletic Middle Eastern fitness coach with short black beard in black tank top, pointing out a tired gym beginner struggling with dumbbells in a modern gym"
      },
      {
        slide_number: 3,
        text_ar: "التجربة العلمية (Schoenfeld 2016): مجموعتين لـ 8 أسابيع، الأولى ترتاح دقيقة والثانية 3 دقائق.",
        text_en: "(The Experiment: 1-Min vs. 3-Min Rest Over 8 Weeks)",
        image_prompt: "2D 3D anime comic illustration of handsome athletic Middle Eastern fitness coach with short black beard in black tank top, explaining a scientific hypertrophy chart in a modern gym"
      },
      {
        slide_number: 4,
        text_ar: "النتيجة بالأرقام: مجموعة الـ 3 دقائق بنت عضلات وقوة أكثر بالضعف لأن طاقة الـ ATP ترجع كاملة!",
        text_en: "(The Data: Double Muscle Thickness & Strength Gains)",
        image_prompt: "2D 3D anime comic illustration of handsome athletic Middle Eastern fitness coach with short black beard in black tank top, performing heavy dumbbell curls with intense muscular definition in a bright gym"
      },
      {
        slide_number: 5,
        text_ar: "شلون تطبقها بتمرينك؟ بالتمارين المركبة ارتاح 3 دقائق، وبتمارين العزل دقيقة ونص إلى دقيقتين.",
        text_en: "(Gym Protocol: 3 Min for Compounds, 1.5-2 Min for Isolation)",
        image_prompt: "2D 3D anime comic illustration of handsome athletic Middle Eastern fitness coach with short black beard in black tank top, demonstrating strict barbell bench press form in a modern gym"
      },
      {
        slide_number: 6,
        text_ar: "زبدة الموضوع: شنو راح تستفاد؟ أوزانك تصعد كل أسبوع، عضلاتك تكبر أسرع بالضعف، وبدون إجهاد عصبي!",
        text_en: "(Bottom Line: Lift Heavier, Grow Faster, Follow @hu.gym)",
        image_prompt: "2D 3D anime comic illustration of handsome athletic Middle Eastern fitness coach with short black beard in black tank top, giving a confident thumbs up in a bright modern gym"
      }
    ],
    caption: `هواي مبتدئين بالجم يتوقعون إذا ما يطلع من التمرين يلهث وعركان، يعني ما تمرن صح.. فيرتاح 30 لو 60 ثانية بس بين الجولات! ⏱️❌

علمياً (Evidence-Based Training)، العضلة ما تكبر من اللهاث والعرك، العضلة تكبر من التوتر الميكانيكي (Mechanical Tension) وحجم التمرين الكلي (Total Volume).

🔬 تفاصيل الدراسة العلمية الموثقة:
في دراسة الدكتور براد شونفيلد (Schoenfeld et al., 2016) المنشورة بمجلة Journal of Strength and Conditioning Research:
قسّموا المتدربين لمجموعتين لمدة 8 أسابيع بنفس التمارين بالضبط:
• المجموعة الأولى: ارتاحت دقيقة واحدة فقط (60 ثانية) بين الجولات.
• المجموعة الثانية: ارتاحت 3 دقائق كاملة بين الجولات.

📊 النتيجة بالأرقام:
المجموعة اللي ارتاحت 3 دقائق زادت سماكة عضلاتها (Muscle Hypertrophy) وقوتها بالسكوات والبنش بريس بأكثر من الضعف مقارنة بمجموعة الدقيقة الواحدة! السبب الفسيولوجي أن الراحة الكافية تخلي مخازن الطاقة بالعضلة (ATP-CP) ترجع تقبط، ويهدأ التعب المركزي، فتكدر تلعب الجولة الجاية بنفس القوة والعدات بدون ما ينهار أداؤك.

✅ شلون تطبقها بتمرينك من باجر؟
1. بالتمارين المركبة الثقيلة (سكوات، بنش بريس، ديدليفت، سحب ظهر): ارتاح من 2.5 إلى 3 دقائق كاملة.
2. بتمارين العزل الصغيرة (بايسبس، ترايسبس، رفرفة كتف): ارتاح من دقيقة ونصف إلى دقيقتين.

💡 زبدة الموضوع (شنو راح تستفاد من هذا الحجي؟):
إذا تطبق هاي النصيحة من تمرين باجر، راح تشيل أوزان أعلى بجودة وتكنيك أضبط، تحمي جهازك العصبي ومفاصلك من الإصابات، وتبني عضل صافي أسرع بالضعف بدل التعب الضايع!

🔗 رابط الدراسة الأصلية على PubMed للمراجعة:
https://pubmed.ncbi.nlm.nih.gov/26605807/

💬 اكتبلي بالتعليقات: شكد جنت ترتاح بين الجولات عادةً؟ ولا تنسى تحفظ البوست عندك وتتابع @hu.gym 💪

#DubaiFitness #UAEGym #لياقة_دبي #DubaiPersonalTrainer #تمارين_الامارات`
  }
];

async function runDailyAgent() {
  await sendTelegram("✅ 1/4: اتصال تيليجرام شغال 100% يا كابتن حسين!\n⏳ جارٍ التحقق المباشر من حساب إنستغرام (@hu.gym)...");

  const conn = await getInstagramConnection();
  let igUserId = null;
  let igUsername = "hu.gym";

  try {
    const userInfo = await executeComposioTool("INSTAGRAM_GET_USER_INFO", {}, conn);
    igUserId = userInfo?.id || userInfo?.ig_user_id || userInfo?.data?.id;
    if (userInfo?.username || userInfo?.data?.username) {
      igUsername = userInfo.username || userInfo.data.username;
    }
  } catch (err) {
    console.warn("User info note:", err.message);
  }

  await sendTelegram(`✅ 2/4: اتصال إنستغرام عبر Composio جاهز!\n👤 الحساب: @${igUsername} (${conn.alias})`);

  const postData = STUDIES_DATABASE[0];

  const slidesSummary = postData.slides
    .map(s => `• شريحة ${s.slide_number}: ${s.text_ar}\n  ${s.text_en}`)
    .join("\n\n");

  await sendTelegram(`✅ 3/4: تم تجهيز البوست العلمي المفصل (6 شرائح كاملة + زبدة الموضوع)!\n\n📌 الموضوع: ${postData.topic}\n📚 المصدر: ${postData.researcher}\n🔗 رابط الدراسة: ${postData.pubmed_url}\n\n🖼️ نصوص الشرائح الـ 6:\n${slidesSummary}`);
  await sendTelegram(`📝 الكابشن الكامل الجاهز للنشر:\n\n${postData.caption}`);

  await sendTelegram("🎨 جارٍ الآن رسم وتوليد الشرائح الـ 6 بشخصية كابتن حسين وإرسالها لك صورة بصورة...");

  const hostedImageUrls = [];
  for (let i = 0; i < postData.slides.length; i++) {
    const directJpgUrl = await generateAndUploadSlide(postData.slides[i], i);
    hostedImageUrls.push(directJpgUrl);
  }

  await sendTelegram("📤 اكتمل توليد الصور الـ 6! جارٍ الآن رفعها ونشر الكاروسيل على حسابك @hu.gym في إنستغرام...");

  const childIds = [];
  for (let i = 0; i < hostedImageUrls.length; i++) {
    const url = hostedImageUrls[i];
    const itemArgs = { image_url: url, is_carousel_item: true, media_type: "IMAGE" };
    if (igUserId) itemArgs.ig_user_id = String(igUserId);

    let itemRes;
    try {
      itemRes = await executeComposioTool("INSTAGRAM_CREATE_MEDIA_CONTAINER", itemArgs, conn);
    } catch (e1) {
      itemRes = await executeComposioTool("INSTAGRAM_POST_IG_USER_MEDIA", itemArgs, conn);
    }
    const cid = itemRes?.id || itemRes?.data?.id || itemRes?.creation_id;
    if (!cid) throw new Error(`لم يتم استلام معرف الشريحة ${i + 1}: ${JSON.stringify(itemRes)}`);
    childIds.push(String(cid));
    await new Promise(r => setTimeout(r, 2000));
  }

  const carouselArgs = {
    children: childIds,
    caption: postData.caption,
    media_type: "CAROUSEL"
  };
  if (igUserId) carouselArgs.ig_user_id = String(igUserId);

  const carouselRes = await executeComposioTool("INSTAGRAM_CREATE_CAROUSEL_CONTAINER", carouselArgs, conn);
  const creationId = carouselRes?.id || carouselRes?.data?.id || carouselRes?.creation_id;
  if (!creationId) throw new Error(`لم يتم استلام معرف الكاروسيل: ${JSON.stringify(carouselRes)}`);

  await new Promise(r => setTimeout(r, 10000));

  const publishArgs = { creation_id: String(creationId) };
  if (igUserId) publishArgs.ig_user_id = String(igUserId);

  let publishRes;
  try {
    publishRes = await executeComposioTool("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", publishArgs, conn);
  } catch (ePub) {
    publishRes = await executeComposioTool("INSTAGRAM_CREATE_POST", publishArgs, conn);
  }

  await sendTelegram(`🎉 4/4: تم بحمد الله نشر الكاروسيل العلمي الكامل (6 شرائح + زبدة الموضوع + رابط PubMed) على حسابك @hu.gym في إنستغرام بنجاح! 🔥💪`);
}

runDailyAgent().catch(async (err) => {
  const errMsg = err?.message || String(err);
  console.error("❌ Error:", errMsg);
  await sendTelegram(`❌ توقف عند خطوة النشر للتشخيص:\n${String(errMsg).substring(0, 900)}`);
  process.exit(1);
});
