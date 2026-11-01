import fs from "fs";
import { execSync } from "child_process";

const TG_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TG_CHAT = (process.env.TELEGRAM_CHAT_ID || "").replace(/[^0-9-]/g, "");
const COMPOSIO_KEY = (process.env.COMPOSIO_API_KEY || "").trim();
const GEMINI_KEY = (process.env.GEMINI_API_KEY || "").trim();

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

// 1. حساب رقم الحلقة اليومية تلقائياً حسب التاريخ (كل يوم ينتقل للحلقة التالية بالترتيب دون تكرار)
function getTodayEpisodeIndex() {
  const startDay = Date.UTC(2026, 10, 1); // 1 نوفمبر 2026 = الحلقة 1
  const now = Date.now();
  const diffDays = Math.max(0, Math.floor((now - startDay) / 86400000));
  return diffDays;
}

// 2. الاتصال المباشر بسيرفر Composio الرسمي لجلب حساب @hu.gym
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

// 3. المنهج العلمي المتسلسل للمبتدئين (منهج Menno Henselmans وأبحاث PubMed الموثقة)
const BEGINNER_SERIES = [
  {
    episode: 1,
    topic: "الحلقة 1: خرافة الراحة 60 ثانية.. ليش الراحة 3 دقائق تبني ضعف العضلات؟",
    researcher: "Schoenfeld et al. (2016) - Journal of Strength & Conditioning Research",
    pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/26605807/",
    wrong_title: "راحة 1 دقيقة ❌",
    wrong_desc: "عضلة متعبة + نزول بالأوزان",
    right_title: "راحة 3 دقائق ✅",
    right_desc: "ضعف البناء العضلي + استشفاء ATP الكامل",
    slides: [
      { slide_number: 1, badge: "سلسلة المبتدئين | الحلقة 1", text_ar: "ليش ترتاح دقيقة وحدة بس؟!", text_en: "(1-Min vs. 3-Min Rest Science)", pose: "holding a stopwatch and pointing confidently at camera" },
      { slide_number: 2, badge: "المقارنة العلمية", text_ar: "الراحة 3 دقائق = ضعف البناء العضلي!", text_en: "(Schoenfeld et al., 2016)", show_comparison: true, pose: "standing confidently in front of scientific comparison board" },
      { slide_number: 3, badge: "البروتوكول العملي بالجم", text_ar: "التمارين المركبة: 3 دقائق راحة\nتمارين العزل: دقيقتين راحة", text_en: "(Full ATP Recovery = More Volume)", pose: "curling heavy dumbbells on gym bench with intense focus" },
      { slide_number: 4, badge: "زبدة الموضوع", text_ar: "زبدة الموضوع: شنو تستفاد؟\nأوزان أعلى + عضل أسرع بدون إرهاق!", text_en: "(Save & Follow @hu.gym)", pose: "smiling warmly and giving a confident thumbs up" }
    ],
    caption: `سلسلة تأسيس المبتدئين بالجم (الحلقة 1) 🏋️‍♂️🔬
هواي مبتدئين بالجم يتوقعون إذا ما يطلع من التمرين يلهث وعركان، يعني ما تمرن صح.. فيرتاح 30 لو 60 ثانية بس بين الجولات! ⏱️❌

علمياً (Evidence-Based Training)، العضلة ما تكبر من اللهاث والعرك، العضلة تكبر من التوتر الميكانيكي (Mechanical Tension) وحجم التمرين الكلي (Total Volume).

🔬 تفاصيل الدراسة العلمية الموثقة:
في دراسة الدكتور براد شونفيلد (Schoenfeld et al., 2016) المنشورة بمجلة Journal of Strength and Conditioning Research:
قسّموا المتدربين لمجموعتين لمدة 8 أسابيع بنفس التمارين بالضبط:
• المجموعة الأولى: ارتاحت دقيقة واحدة فقط (60 ثانية) بين الجولات.
• المجموعة الثانية: ارتاحت 3 دقائق كاملة بين الجولات.

📊 النتيجة بالأرقام:
المجموعة اللي ارتاحت 3 دقائق زادت سماكة عضلاتها (Muscle Hypertrophy) وقوتها بالسكوات والبنش بريس بأكثر من الضعف مقارنة بمجموعة الدقيقة الواحدة! السبب الفسيولوجي أن الراحة الكافية تخلي مخازن الطاقة بالعضلة (ATP-CP) ترجع تقبط، فتكدر تلعب الجولة الجاية بنفس القوة والعدات بدون ما ينهار أداؤك.

✅ شلون تطبقها بتمرينك من باجر؟
1. بالتمارين المركبة الثقيلة (سكوات، بنش بريس، ديدليفت، سحب ظهر): ارتاح من 2.5 إلى 3 دقائق كاملة.
2. بتمارين العزل الصغيرة (بايسبس، ترايسبس، رفرفة كتف): ارتاح من دقيقة ونصف إلى دقيقتين.

💡 زبدة الموضوع (شنو راح تستفاد من هذا الحجي؟):
إذا تطبق هاي النصيحة من تمرين باجر، راح تشيل أوزان أعلى بجودة وتكنيك أضبط، تحمي جهازك العصبي ومفاصلك من الإصابات، وتبني عضل صافي أسرع بالضعف بدل التعب الضايع!

🔗 رابط الدراسة الأصلية على PubMed للمراجعة:
https://pubmed.ncbi.nlm.nih.gov/26605807/

💬 اكتبلي بالتعليقات: شكد جنت ترتاح بين الجولات عادةً؟ ولا تنسى تحفظ البوست عندك وتتابع @hu.gym للحلقات الجاية 💪

#DubaiFitness #UAEGym #لياقة_دبي #DubaiPersonalTrainer #تمارين_الامارات`
  },
  {
    episode: 2,
    topic: "الحلقة 2: كمية البروتين الحقيقية للمبتدئ.. ليش 1.6 غرام كافية وخرافة الـ 3 غرام تضيع فلوسك؟",
    researcher: "Morton et al. (2018) & Menno Henselmans - British Journal of Sports Medicine",
    pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/28698222/",
    wrong_title: "3 غرام بروتين/كغم ❌",
    wrong_desc: "تبذير فلوس + عسر هضم بدون بناء إضافي",
    right_title: "1.6 غرام بروتين/كغم ✅",
    right_desc: "أقصى بناء عضلي (MPS) مثبت علمياً",
    slides: [
      { slide_number: 1, badge: "سلسلة المبتدئين | الحلقة 2", text_ar: "شكد تحتاج بروتين صدك حتى تبني عضل؟!", text_en: "(Real Protein Science vs. Gym Myths)", pose: "pointing confidently at camera in modern gym" },
      { slide_number: 2, badge: "أكبر مراجعة علمية (49 دراسة)", text_ar: "1.6 غرام لكل كغم = أقصى بناء عضلي ممكن!", text_en: "(Morton et al., 2018 - BJSM)", show_comparison: true, pose: "standing confidently in front of comparison board" },
      { slide_number: 3, badge: "شلون تحسبها لجسمك؟", text_ar: "وزنك × 1.6 فقط!\nوزعها على 3 إلى 4 وجبات باليوم", text_en: "(75kg Weight = 120g Protein Daily)", pose: "holding dumbbells with focused athletic posture" },
      { slide_number: 4, badge: "زبدة الموضوع", text_ar: "زبدة الموضوع: شنو تستفاد؟\nتوفر فلوسك + تريح معدتك + تبني أقصى عضل!", text_en: "(Save & Follow @hu.gym)", pose: "smiling warmly and giving a thumbs up" }
    ],
    caption: `سلسلة تأسيس المبتدئين بالجم (الحلقة 2) 🥩🔬
أول ما تدخل للجم، تسمع أرقام خيالية عن البروتين: "لازم تاخذ 250 غرام بروتين باليوم وتشتري 3 أنواع مكملات وإلا ما تطلعلك عضلة!".. هل هذا الكلام علمي؟ ❌

خلينا نشوف العلم والأبحاث شنو تكول بمدرسة Menno Henselmans.

🔬 تفاصيل الدراسة العلمية الموثقة:
في أكبر مراجعة منهجية (Meta-Analysis) قادها الدكتور مورتون (Morton et al., 2018) ونُشرت في المجلة الطبية البريطانية المرموقة British Journal of Sports Medicine:
جمع الباحثون 49 دراسة علمية شملت 1,863 متدرباً يمارسون تمارين المقاومة، لمعرفة النقطة التي يصل فيها تخليق البروتين العضلي (Muscle Protein Synthesis) إلى قمته القصوى.

📊 النتيجة بالأرقام:
أثبتت الدراسة بشكل قاطع أن الفائدة العضلية تتوقف تماماً عند حدود 1.6 غرام بروتين لكل كيلوغرام من وزن الجسم يومياً! أي كمية فوق هذا الرقم لم تحقق أي زيادة إضافية في حجم العضلات أو القوة، بل يحولها الجسم إلى طاقة عادية.

✅ شلون تطبقها بحياتك اليومية؟
• اضرب وزن جسمك في 1.6 (مثلاً لو وزنك 75 كغم × 1.6 = 120 غرام بروتين باليوم فقط!).
• قسّم هاي الكمية على 3 إلى 4 وجبات باليوم (كل وجبة بيها 30-35 غرام بروتين من البيض، صدر الدجاج، التونة، اللحم، أو الألبان).

💡 زبدة الموضوع (شنو راح تستفاد من هذا الحجي؟):
راح توفر ميزانيتك وفلوسك اللي جنت تصرفها على أكل ومكملات فائضة عن حاجة جسمك، تتخلص من الانتفاخ وعسر الهضم، وتضمن أن عضلاتك دتاخذ 100% من احتياجها العلمي للبناء!

🔗 رابط الدراسة الأصلية على PubMed للمراجعة:
https://pubmed.ncbi.nlm.nih.gov/28698222/

💬 اكتبلي وزنك بالتعليقات وراح أحسبلك احتياجك اليومي بالضبط! ولا تنسى تحفظ البوست وتتابع @hu.gym 💪

#DubaiFitness #UAEGym #لياقة_دبي #DubaiPersonalTrainer #تمارين_الامارات`
  },
  {
    episode: 3,
    topic: "الحلقة 3: المدى الحركي الكامل (Full ROM) مقابل الوزن الثقيل بنصف نزول!",
    researcher: "Pallarés et al. (2021) - European Journal of Applied Physiology",
    pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/33977835/",
    wrong_title: "وزن ثقيل + نصف نزول ❌",
    wrong_desc: "إصابة مفاصل + تفعيل عضلي ناقص",
    right_title: "وزن معتدل + مدى كامل ✅",
    right_desc: "نمو عضلي أعلى بـ 30% + أمان للمفاصل",
    slides: [
      { slide_number: 1, badge: "سلسلة المبتدئين | الحلقة 3", text_ar: "تشيل ثقيل بنص نزلة لو وزن أخف بمدى كامل؟!", text_en: "(Full ROM vs. Ego Lifting Science)", pose: "pointing confidently at camera in bright modern gym" },
      { slide_number: 2, badge: "المقارنة العلمية", text_ar: "المدى الكامل = نمو عضلي أعلى بـ 30%!", text_en: "(Pallarés et al., 2021)", show_comparison: true, pose: "standing confidently in front of scientific comparison board" },
      { slide_number: 3, badge: "التطبيق العملي بالجم", text_ar: "قلل الوزن 20% + انزل مدى كامل\nواثبت ثانية بأسفل الحركة", text_en: "(Stretch-Mediated Hypertrophy)", pose: "performing deep dumbbell exercise with perfect form" },
      { slide_number: 4, badge: "زبدة الموضوع", text_ar: "زبدة الموضوع: شنو تستفاد؟\nتحمي مفاصلك + تبني عضل أكبر بوزن أأمن!", text_en: "(Save & Follow @hu.gym)", pose: "smiling warmly and giving a thumbs up" }
    ],
    caption: `سلسلة تأسيس المبتدئين بالجم (الحلقة 3) 🏋️‍♂️📐
أكبر فخ يوكع بيه المبتدئ بالجم هو "غرور الأوزان" (Ego Lifting).. يشوف غيره شايل وزن ثقيل، فيحط أوزان فوك طاقته وينزل ربع أو نص نزلة بالتمرين! ❌

علمياً، هل العضلة تهتم بجم كيلو حاط بالبار، لو بالمدى الحركي اللي دتشتغل بيه؟

🔬 تفاصيل الدراسة العلمية الموثقة:
في دراسة الدكتور بالاريس (Pallarés et al., 2021) المنشورة في المجلة الأوروبية لفسيولوجيا التمرين (European Journal of Applied Physiology):
راقب الباحثون مجموعتين لمدة 10 أسابيع:
• المجموعة الأولى: تمرنت بمدى حركي كامل (Full ROM) مع إطالة العضلة بالكامل تحت الوزن.
• المجموعة الثانية: تمرنت بأوزان أثقل لكن بنصف مدى حركي (Partial ROM).

📊 النتيجة بالأرقام:
المجموعة التي التزمت بالمدى الحركي الكامل حققت زيادة في الحجم العضلي والقوة تفوق المجموعة الثانية بأكثر من 30% رغم أن أوزانها كانت أخف! السبب العلمي هو ظاهرة (Stretch-Mediated Hypertrophy)؛ أي أن العضلة عندما تتمدد بالكامل وهي تحت المقاومة، تعطي أقوى إشارة فسيولوجية للنمو وبناء الألياف.

✅ شلون تطبقها بتمرينك من باجر؟
1. خفف الوزن اللي تشيله بنسبة 15-20% وعوف المقارنة ويا غيرك.
2. انزل بالتمرين لآخر مدى حركي مريح لمفاصلك (خصوصاً بالصدر، السكوات، والبايسبس).
3. تحكم بالنزول (Eccentric Phase) لمدة ثانيتين واثبت جزء من الثانية بالأسفل قبل الدفع.

💡 زبدة الموضوع (شنو راح تستفاد من هذا الحجي؟):
راح تحمي أكتافك وركبتك وظهرك من الإصابات المزمنة، وتفعّل 100% من ألياف العضلة المستهدفة بوزن معقول وتبني شكل عضلي متكامل بوقت أقصر!

🔗 رابط الدراسة الأصلية على PubMed للمراجعة:
https://pubmed.ncbi.nlm.nih.gov/33977835/

💬 اكتبلي بالتعليقات: يا تمرين تحس الناس أكثر شي يغشون بيه بالمدى الحركي؟ ولا تنسى تحفظ البوست وتتابع @hu.gym 💪

#DubaiFitness #UAEGym #لياقة_دبي #DubaiPersonalTrainer #تمارين_الامارات`
  },
  {
    episode: 4,
    topic: "الحلقة 4: جدول شامل (Full Body) لو كل يوم عضلة (Bro Split) للمبتدئين؟",
    researcher: "Schoenfeld et al. (2016) - Sports Medicine Meta-Analysis",
    pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/27102172/",
    wrong_title: "عضلة بالأسبوع (Bro Split) ❌",
    wrong_desc: "تحفيز واحد فقط + 6 أيام العضلة نايمة",
    right_title: "مرتين بالأسبوع (Full Body/UL) ✅",
    right_desc: "نمو عضلي أعلى بـ 38% + مضاعفة تخليق البروتين",
    slides: [
      { slide_number: 1, badge: "سلسلة المبتدئين | الحلقة 4", text_ar: "تتمرن كل يوم عضلة لو جدول شامل؟!", text_en: "(Training Frequency Science for Beginners)", pose: "pointing confidently at camera in bright modern gym" },
      { slide_number: 2, badge: "المقارنة العلمية", text_ar: "تمرين العضلة مرتين بالأسبوع = نمو أعلى بـ 38%!", text_en: "(Schoenfeld et al., 2016 - Sports Medicine)", show_comparison: true, pose: "standing confidently in front of scientific comparison board" },
      { slide_number: 3, badge: "أفضل جدول للمبتدئ", text_ar: "3 أيام: جدول شامل (Full Body)\n4 أيام: علوي / سفلي (Upper / Lower)", text_en: "(2x Weekly Frequency Maximizes Growth)", pose: "holding dumbbells with focused athletic posture" },
      { slide_number: 4, badge: "زبدة الموضوع", text_ar: "زبدة الموضوع: شنو تستفاد؟\nتضاعف سرعة بناء عضلاتك بـ 3 إلى 4 أيام فقط!", text_en: "(Save & Follow @hu.gym)", pose: "smiling warmly and giving a thumbs up" }
    ],
    caption: `سلسلة تأسيس المبتدئين بالجم (الحلقة 4) 📅🔬
أول سؤال يسأله كل مبتدئ يدخل للجم: "كابتن، ألعب كل يوم عضلة (سبت صدر، أحد ظهر، اثنين أكتاف..) لو ألعب جدول شامل؟" 🤔

خلينا نحسم هذا الجدل بالأدلة العلمية من مدرسة Menno Henselmans وأبحاث الفسيولوجيا الرياضية.

🔬 تفاصيل الدراسة العلمية الموثقة:
في التحليل التلوي الشهير للدكتور براد شونفيلد (Schoenfeld et al., 2016) المنشور في مجلة Sports Medicine:
قارن الباحثون بين المتدربين الذين يمرنون العضلة مرة واحدة في الأسبوع (Bro Split) وبين الذين يقسمون نفس عدد الجولات لتمرين العضلة مرتين إلى 3 مرات في الأسبوع.

📊 النتيجة بالأرقام:
تمرين العضلة مرتين في الأسبوع حقق نمواً عضلياً أعلى بنسبة 38% مقارنة بتمرينها مرة واحدة! السبب العلمي هو أن عملية تخليق البروتين العضلي (MPS) بعد التمرين تستمر لمدة 36 إلى 48 ساعة فقط ثم تعود للخط الطبيعي؛ فإذا مرنت الصدر يوم الاثنين فقط، راح تبقى العضلة 5 أيام كاملة بدون أي إشارة بناء جديدة!

✅ شلون تختار جدولك من باجر؟
• إذا تكدر تروح للجم 3 أيام بالأسبوع: العب جدول شامل (Full Body) بحيث تمرن جسمك كله بتمارين أساسية كل جلسة.
• إذا تكدر تروح 4 أيام بالأسبوع: العب جدول علوي/سفلي (Upper / Lower)؛ يومين للجزء العلوي ويومين للسفلي.

💡 زبدة الموضوع (شنو راح تستفاد من هذا الحجي؟):
بمعدل 3 إلى 4 أيام بالأسبوع بس، راح تحفز كل عضلات جسمك أكثر من 100 مرة بالسنة بدل 50 مرة، وتتجنب ألم العضلات المبرح، وتبني جسم رياضي أسرع بهواي!

🔗 رابط الدراسة الأصلية على PubMed للمراجعة:
https://pubmed.ncbi.nlm.nih.gov/27102172/

💬 اكتبلي بالتعليقات: كم يوم بالأسبوع تكدر تلتزم بالجم حالياً؟ ولا تنسى تحفظ البوست وتتابع @hu.gym 💪

#DubaiFitness #UAEGym #لياقة_دبي #DubaiPersonalTrainer #تمارين_الامارات`
  }
];

// 4. توليد الحلقات التالية تلقائياً عبر مفتاح Gemini API
async function getOrGenerateEpisode(epIndex) {
  if (epIndex < BEGINNER_SERIES.length) {
    return BEGINNER_SERIES[epIndex];
  }
  const epNum = epIndex + 1;
  if (!GEMINI_KEY) return BEGINNER_SERIES[epIndex % BEGINNER_SERIES.length];

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationConfig: { responseMimeType: "application/json" },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `أنت الكابتن والباحث العراقي حسين، مدرب معتمد من Menno Henselmans وصاحب حساب @hu.gym.
ولّد الحلقة رقم ${epNum} من "سلسلة تأسيس المبتدئين بالجم" حول موضوع علمي جديد ومفصل للمبتدئين (مثل: الفشل العضلي RIR، عدد الجولات الأسبوعية، الكارديو قبل أم بعد الحديد، النوم والاستشفاء، الترتيب الصحيح للتمارين) مع دراسة علمية حقيقية موثقة من PubMed.
أخرج النتيجة بصيغة JSON مطابقة تماماً لهذا الهيكل:
{
  "episode": ${epNum},
  "topic": "عنوان الحلقة",
  "researcher": "اسم الباحث والسنة والمجلة",
  "pubmed_url": "https://pubmed.ncbi.nlm.nih.gov/...",
  "wrong_title": "التصرف الخاطئ ❌",
  "wrong_desc": "نتيجته السلبية باختصار",
  "right_title": "التصرف العلمي ✅",
  "right_desc": "نتيجته الإيجابية بالأرقام",
  "slides": [
    { "slide_number": 1, "badge": "سلسلة المبتدئين | الحلقة ${epNum}", "text_ar": "عنوان الغلاف الجاذب", "text_en": "(English Subtitle)", "pose": "pointing confidently at camera" },
    { "slide_number": 2, "badge": "المقارنة العلمية", "text_ar": "الخلاصة الرقمية للدراسة!", "text_en": "(Author et al.)", "show_comparison": true, "pose": "standing in front of comparison board" },
    { "slide_number": 3, "badge": "التطبيق العملي بالجم", "text_ar": "خطوتين عمليتين للتطبيق باجر", "text_en": "(Actionable Protocol)", "pose": "lifting dumbbells with strict form" },
    { "slide_number": 4, "badge": "زبدة الموضوع", "text_ar": "زبدة الموضوع: شنو تستفاد؟\\nخلاصة الفائدة المباشرة للمبتدئ!", "text_en": "(Save & Follow @hu.gym)", "pose": "smiling and giving thumbs up" }
  ],
  "caption": "كابشن مفصل باللهجة العراقية الفصيحة والعلمية مع تفاصيل التجربة، والأرقام، وشلون تطبقها، وفقرة (💡 زبدة الموضوع: شنو راح تستفاد من هذا الحجي؟)، ورابط PubMed، والهاشتاغات الخمسة: #DubaiFitness #UAEGym #لياقة_دبي #DubaiPersonalTrainer #تمارين_الامارات"
}`
                }
              ]
            }
          ]
        })
      }
    );
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Fallback to curriculum:", e.message);
  }
  return BEGINNER_SERIES[epIndex % BEGINNER_SERIES.length];
}

// 5. توليد رسم الشخصية عبر Gemini Image API (أو Flux) ثم تصميم الشريحة الكاملة بالخط الأصفر الكريمي (#F5E5C9) عبر Google Chrome
async function getCoachIllustrationBase64(slide, index) {
  const prompt = `High quality 2D 3D anime comic illustration of a handsome 28-year-old Middle Eastern athletic fitness coach with short faded black hair, neatly groomed short black beard, muscular physique, wearing a black sleeveless gym tank top in a bright modern gym with dumbbells and GYM LIFE poster on wall, ${slide.pose || "confident posture"}, clean sharp anime line art, vibrant lighting, no text, 4:5 vertical portrait`;

  if (GEMINI_KEY) {
    const geminiModels = ["gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"];
    for (const modelName of geminiModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
            })
          }
        );
        if (res.ok) {
          const data = await res.json();
          const parts = data?.candidates?.[0]?.content?.parts || [];
          const imgPart = parts.find(p => p.inlineData?.data);
          if (imgPart?.inlineData?.data) {
            return `data:${imgPart.inlineData.mimeType || "image/png"};base64,${imgPart.inlineData.data}`;
          }
        }
      } catch (e) {}
    }
  }

  try {
    const fluxUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1350&seed=${500 + index}&nologo=true&model=flux`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(fluxUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0" },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 8000) {
        return `data:image/jpeg;base64,${Buffer.from(ab).toString("base64")}`;
      }
    }
  } catch (e) {}

  return null;
}

async function renderDesignedSlide(episodeData, slide, index) {
  const bgDataUri = await getCoachIllustrationBase64(slide, index);

  const comparisonHtml = slide.show_comparison
    ? `<div class="comp-grid">
         <div class="comp-box wrong">
           <div class="comp-title">${episodeData.wrong_title}</div>
           <div class="comp-desc">${episodeData.wrong_desc}</div>
         </div>
         <div class="comp-box right">
           <div class="comp-title">${episodeData.right_title}</div>
           <div class="comp-desc">${episodeData.right_desc}</div>
         </div>
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1350px;
    font-family: 'Cairo', sans-serif;
    background: #141824;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .bg-img {
    position: absolute;
    inset: 0;
    width: 1080px;
    height: 1350px;
    object-fit: cover;
    z-index: 1;
  }
  .bg-fallback {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 35%, #2a3550 0%, #111520 70%, #090b10 100%);
    z-index: 1;
  }
  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(10,14,22,0.55) 0%, rgba(10,14,22,0.15) 40%, rgba(10,14,22,0.88) 78%, rgba(8,10,16,0.97) 100%);
    z-index: 2;
  }
  .top-bar {
    position: relative;
    z-index: 3;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 42px 48px;
  }
  .badge {
    background: rgba(20, 24, 36, 0.88);
    border: 2px solid #F5E5C9;
    color: #F5E5C9;
    padding: 10px 28px;
    border-radius: 50px;
    font-size: 28px;
    font-weight: 900;
    box-shadow: 0 6px 20px rgba(0,0,0,0.6);
  }
  .brand {
    background: rgba(0, 210, 106, 0.2);
    border: 2px solid #00D26A;
    color: #FFFFFF;
    padding: 10px 26px;
    border-radius: 50px;
    font-size: 28px;
    font-weight: 900;
    direction: ltr;
  }
  .bottom-area {
    position: relative;
    z-index: 3;
    padding: 0 50px 65px 50px;
    text-align: center;
  }
  .comp-grid {
    display: flex;
    gap: 24px;
    margin-bottom: 36px;
  }
  .comp-box {
    flex: 1;
    padding: 26px 22px;
    border-radius: 24px;
    backdrop-filter: blur(12px);
    text-align: center;
  }
  .comp-box.wrong {
    background: rgba(65, 15, 20, 0.85);
    border: 3px solid #FF4B4B;
    box-shadow: 0 0 25px rgba(255, 75, 75, 0.35);
  }
  .comp-box.right {
    background: rgba(12, 55, 32, 0.85);
    border: 3px solid #00D26A;
    box-shadow: 0 0 25px rgba(0, 210, 106, 0.35);
  }
  .comp-title {
    font-size: 36px;
    font-weight: 900;
    color: #FFFFFF;
    margin-bottom: 10px;
    text-shadow: 0 3px 8px #000;
  }
  .comp-desc {
    font-size: 27px;
    font-weight: 800;
    color: #F5E5C9;
  }
  .title-ar {
    font-size: 62px;
    font-weight: 900;
    line-height: 1.32;
    color: #F5E5C9;
    white-space: pre-line;
    -webkit-text-stroke: 11px #000000;
    paint-order: stroke fill;
    filter: drop-shadow(0 8px 14px rgba(0,0,0,0.95));
    margin-bottom: 18px;
  }
  .title-en {
    font-size: 36px;
    font-weight: 900;
    color: #FFFFFF;
    direction: ltr;
    -webkit-text-stroke: 7px #000000;
    paint-order: stroke fill;
    filter: drop-shadow(0 5px 10px rgba(0,0,0,0.9));
  }
</style>
</head>
<body>
  ${bgDataUri ? `<img class="bg-img" src="${bgDataUri}" />` : `<div class="bg-fallback"></div>`}
  <div class="overlay"></div>
  <div class="top-bar">
    <div class="badge">${slide.badge || `سلسلة المبتدئين | شريحة ${slide.slide_number}`}</div>
    <div class="brand">@hu.gym</div>
  </div>
  <div class="bottom-area">
    ${comparisonHtml}
    <div class="title-ar">${slide.text_ar}</div>
    <div class="title-en">${slide.text_en}</div>
  </div>
</body>
</html>`;

  const htmlPath = `/tmp/slide_${index + 1}.html`;
  const pngPath = `/tmp/slide_${index + 1}.png`;
  fs.writeFileSync(htmlPath, html, "utf8");

  execSync(
    `google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=1080,1350 --screenshot="${pngPath}" "file://${htmlPath}"`,
    { stdio: "ignore" }
  );

  const imgBuffer = fs.readFileSync(pngPath);

  const form = new FormData();
  form.append("chat_id", TG_CHAT);
  form.append("caption", `🖼️ شريحة ${slide.slide_number}/${episodeData.slides.length}:\n${slide.text_ar}\n${slide.text_en}`);
  form.append("photo", new Blob([imgBuffer], { type: "image/png" }), `slide_${index + 1}.png`);

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
  throw new Error(`فشل استخراج رابط الصورة للشريحة ${index + 1}`);
}

async function runDailyAgent() {
  const epIndex = getTodayEpisodeIndex();
  const postData = await getOrGenerateEpisode(epIndex);

  await sendTelegram(`✅ 1/4: بدء النشر التلقائي اليومي لحساب @hu.gym!\n📌 ${postData.topic}\n📚 الدراسة: ${postData.researcher}\n🔗 ${postData.pubmed_url}`);

  const conn = await getInstagramConnection();
  let igUserId = null;
  let igUsername = "hu.gym";

  try {
    const userInfo = await executeComposioTool("INSTAGRAM_GET_USER_INFO", {}, conn);
    igUserId = userInfo?.id || userInfo?.ig_user_id || userInfo?.data?.id;
    if (userInfo?.username || userInfo?.data?.username) {
      igUsername = userInfo.username || userInfo.data.username;
    }
  } catch (err) {}

  await sendTelegram(`✅ 2/4: جارٍ الآن تصميم الشرائح بالخط الأصفر الكريمي (#F5E5C9) وشخصية الكابتن حسين عبر Gemini وإرسالها لك...`);

  const hostedImageUrls = [];
  for (let i = 0; i < postData.slides.length; i++) {
    const jpgUrl = await renderDesignedSlide(postData, postData.slides[i], i);
    hostedImageUrls.push(jpgUrl);
  }

  await sendTelegram(`📝 الكابشن العلمي الكامل مع الزبدة ورابط الدراسة:\n\n${postData.caption}`);
  await sendTelegram(`⏳ 3/4: جارٍ رفع الشرائح المصممة ونشر الكاروسيل على حسابك @${igUsername}...`);

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
    if (!cid) throw new Error(`لم يتم استلام معرف الشريحة ${i + 1}`);
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
  if (!creationId) throw new Error("لم يتم استلام معرف الكاروسيل");

  await new Promise(r => setTimeout(r, 10000));

  const publishArgs = { creation_id: String(creationId) };
  if (igUserId) publishArgs.ig_user_id = String(igUserId);

  let publishRes;
  try {
    publishRes = await executeComposioTool("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", publishArgs, conn);
  } catch (ePub) {
    publishRes = await executeComposioTool("INSTAGRAM_CREATE_POST", publishArgs, conn);
  }

  await sendTelegram(`🎉 4/4: تم بحمد الله نشر (${postData.topic}) على حسابك @hu.gym بنجاح! 🔥💪\n📅 غداً في نفس الموعد سيتم نشر الحلقة ${epIndex + 2} تلقائياً!`);
}

runDailyAgent().catch(async (err) => {
  const errMsg = err?.message || String(err);
  console.error("❌ Error:", errMsg);
  await sendTelegram(`❌ تنبيه:\n${String(errMsg).substring(0, 900)}`);
  process.exit(1);
});
