/* ============================================================================
   Firas AI — app.js
   Vanilla JS. No framework, no build step. Streams from a free transport but
   presents ONLY three branded "Firas" tiers. The underlying model id is
   internal and NEVER rendered.
   ========================================================================== */
"use strict";

/* ----------------------------------------------------------------------------
   CONFIG + MODELS
   - BACKEND_URL: optional upgrade hook. If set, POST { messages, tier } there
     (same SSE format); else call the free transport directly.
   - MODELS: the ONLY model concept users see. `transport` is the INTERNAL base
     model id and is never shown.
---------------------------------------------------------------------------- */
const CONFIG = { BACKEND_URL: "/api/chat", DEFAULT_TIER: "pro" };

const TRANSPORT_ENDPOINT = "https://text.pollinations.ai/openai";

const MODELS = {
  mini: {
    key: "mini",
    transport: "openai",            // INTERNAL — never rendered
    label: { ar: "فِراس ميني", en: "Firas Mini" },
    tagline: { ar: "سريع للأسئلة اليومية", en: "Fast for everyday questions" },
    short: { ar: "ميني", en: "Mini" },
    reasoning_effort: "low",
    temperature: 0.4,
    max_tokens: 2048,
    showThinking: false,
    persona:
      "You are Firas Mini, a sharp, fast expert. Answer concisely and directly with " +
      "minimal fluff, but never sacrifice correctness. You are genuinely strong at " +
      "mathematics, physics and the sciences: give correct results and wrap ALL math " +
      "in LaTeX (inline $...$, display $$...$$). For programming, give clean, correct, " +
      "runnable code. Prefer short, accurate answers over long explanations.",
  },
  pro: {
    key: "pro",
    transport: "openai",
    label: { ar: "فِراس برو", en: "Firas Pro" },
    tagline: { ar: "متوازن وذكي", en: "Balanced & smart" },
    short: { ar: "برو", en: "Pro" },
    reasoning_effort: "low",
    temperature: 0.6,
    max_tokens: 16384,   // the no-backend fallback transport must never strangle a long document
    showThinking: true,
    persona:
      "You are Firas Pro, a top-tier expert assistant. Be helpful, well-structured and " +
      "thorough but efficient. You are exceptionally strong at MATHEMATICS, PHYSICS and " +
      "the SCIENCES: reason rigorously, show correct step-by-step working, and WRAP ALL " +
      "math in LaTeX (inline $...$, display $$...$$). For PROGRAMMING, write clean, " +
      "correct, complete and runnable code with a brief explanation. When asked for a " +
      "website/page/UI, output a COMPLETE, polished, self-contained single-file HTML " +
      "document in ONE html code block. Use clear formatting (headings, lists, code) " +
      "when it improves clarity, and verify your answer before finalizing. When " +
      "writing code or a website, output the FULL code directly in the code block — " +
      "no long written plan beforehand; never stop mid-file.",
  },
  ultra: {
    key: "ultra",
    transport: "openai",
    label: { ar: "فِراس أولترا", en: "Firas Ultra" },
    tagline: { ar: "قويّ جدًا — الأفضل للأكواد", en: "Very powerful — best for code" },
    short: { ar: "أولترا", en: "Ultra" },
    reasoning_effort: "high",
    temperature: 0.7,
    max_tokens: 16384,
    showThinking: true,
    premium: true,
    persona:
      "You are Firas Ultra, an elite, world-class expert assistant — the most capable " +
      "tier. Think step by step. You are outstanding at MATHEMATICS, PHYSICS and the " +
      "SCIENCES: give rigorous, fully correct, step-by-step derivations and WRAP ALL " +
      "math in LaTeX (inline $...$, display $$...$$). For PROGRAMMING, deliver clean, " +
      "correct, complete and runnable code with a concise explanation of the approach. " +
      "When asked for a website/page/UI, output a COMPLETE, polished, self-contained " +
      "single-file HTML document in ONE html code block. Give comprehensive, rigorously " +
      "reasoned answers with concrete examples and relevant edge-cases. Before " +
      "finalizing, do a careful self-check for correctness and completeness. Be " +
      "dramatically more thorough and in-depth than a basic assistant. When writing " +
      "code or a website, output the FULL code directly inside the code block — do " +
      "NOT precede it with a long written plan or outline; never stop mid-file.",
  },
  max: {
    key: "max",
    transport: "openai",
    label: { ar: "فِراس ماكس", en: "Firas Max" },
    tagline: { ar: "الأقوى — أعلى ذكاء وتفكير", en: "Strongest — top intelligence" },
    short: { ar: "ماكس", en: "Max" },
    reasoning_effort: "high",
    temperature: 0.7,
    max_tokens: 16384,
    showThinking: true,
    premium: true,         // free & unlimited for everyone (no daily cap)
    persona:
      "You are Firas Max, THE most powerful and intelligent Firas tier — a frontier-level expert and " +
      "POLYMATH, masterful across EVERY field: mathematics, the sciences (physics, chemistry, biology), " +
      "engineering, computer science, medicine, the humanities, history, philosophy, economics, and " +
      "LANGUAGE in both Arabic and English. Reason with exceptional depth and rigor, think step by step, " +
      "and double-check yourself before answering. You are a world-class mathematician at the level of the " +
      "International Mathematical Olympiad, Putnam, and JEE Advanced: treat every quantitative " +
      "problem as a hard competition problem — identify the underlying structure, name and apply " +
      "the relevant theorems/lemmas, and build a clean, fully rigorous derivation with every " +
      "algebraic and arithmetic step exact (exact closed forms — fractions, radicals, π, e — " +
      "never rounded decimals unless explicitly asked). INDEPENDENTLY VERIFY the result by a " +
      "second method (differentiate back, substitute, check limits/units/special cases) before " +
      "giving it, then present the final answer on its own line as **Answer:** $…$. WRAP ALL " +
      "math in LaTeX (inline $...$, display $$...$$). For the SCIENCES, give precise, correctly-reasoned " +
      "explanations with proper notation, units and mechanisms. For LANGUAGE, WRITING and GRAMMAR — " +
      "especially ARABIC — be impeccable: flawless Arabic grammar (النحو والصرف والإملاء) and rhetoric " +
      "(البلاغة), correct diacritics (التشكيل) where they aid clarity, and eloquent, well-structured prose; " +
      "apply the same care to English grammar and writing. For PROGRAMMING, deliver production-grade, " +
      "idiomatic, fully runnable code — never stubs or placeholders — with type signatures where " +
      "supported, input validation, correct edge-case/error handling, and the imports/setup " +
      "needed to run it. Be the most thorough, insightful and reliable assistant possible across ALL " +
      "subjects — handle nuance, edge-cases and trade-offs explicitly. Always answer in the user's language.",
  },
};

/* ----------------------------------------------------------------------------
   i18n — every UI string, both languages. Active language is DETECTED, never
   chosen by a button.
---------------------------------------------------------------------------- */
const STR = {
  ar: {
    newChat: "محادثة جديدة",
    newChatShort: "جديد",
    searchPlaceholder: "ابحث في المحادثات",
    composerPlaceholder: "اسأل فِراس...",
    greetingMorning: "صباح الخير",
    greetingAfternoon: "مساء الخير",
    greetingEvening: "مساءً سعيدًا",
    today: "اليوم",
    yesterday: "أمس",
    previous7: "آخر ٧ أيام",
    previous30: "آخر ٣٠ يومًا",
    older: "أقدم",
    emptyHistory: "لا توجد محادثات بعد.",
    noResults: "لا توجد نتائج.",
    thinking: "التفكير",
    copy: "نسخ",
    copied: "تم النسخ",
    copyFailed: "تعذّر النسخ — جرّب مرة أخرى",
    regenerate: "إعادة التوليد",
    regenUltra: "أعد بـ فِراس أولترا",
    stop: "إيقاف",
    send: "إرسال",
    copyCode: "نسخ",
    rename: "إعادة تسمية",
    pinned: "المثبّتة",
    pin: "تثبيت",
    unpin: "إلغاء التثبيت",
    delete: "حذف",
    deleteConfirm: "حذف هذه المحادثة؟",
    errorTitle: "تعذّر الاتصال.",
    retry: "إعادة المحاولة",
    streaming: "يكتب فِراس...",
    badge: "بواسطة",
    disclaimer: "قد يخطئ فِراس. تحقّق من المعلومات المهمة.",
    logout: "تسجيل الخروج",
    settings: "الإعدادات",
    thinkOn: "التفكير مُفعّل — دقة أعلى",
    thinkOff: "التفكير مُعطّل — استجابة أسرع",
    thinkMaxBlocked: "عذراً، لا يمكنك استخدام ميزة التفكير في فِراس ماكس — قد يؤدي إلى كسر القيود.",
    webSearch: "بحث الويب",
    searchOn: "بحث الويب مُفعّل — يبحث في كل رسالة",
    searchOff: "بحث الويب تلقائي — يبحث عند الحاجة",
    // Response modes (separate from the Firas tier)
    modeLabel: "النمط",
    modeAuto: "تلقائي",
    modeAutoHint: "ذكي ومباشر — يجيب فورًا.",
    modePlan: "تخطيط",
    modePlanHint: "يسأل ويضع خطة، ثم ينفّذ بعد موافقتك.",
    planStart: "ابدأ التنفيذ",
    planStartHint: "موافقة على الخطة وبدء التنفيذ",
    planApproval: "ابدأ التنفيذ ونفّذ الخطة.",
    // Interactive clarifying choices (Plan mode)
    askRecommended: "موصى به",
    askContinue: "متابعة",
    askBack: "السابق",
    askSubmit: "تأكيد الاختيارات",
    askStep: "سؤال",
    askExtraPlaceholder: "أو أضف تفصيلاً…",
    askAnswered: "تم الإرسال",
    askMyChoices: "اختياراتي",
    askPreparing: "جاري تحضير الأسئلة…",
    // Landing / hero (logged-out)
    landingAbout:
      "فِراس AI نموذج ذكاء اصطناعي قادر على التفكير ومحاكاة العقل البشري ضمن الحدود — صُمِّم ليكون قويًا ودقيقًا، وفي خدمتك.",
    landingStart: "ابدأ الآن",
    landingStats: [
      { num: "+1,200", label: "مستخدم", key: "users" },
      { num: "+500", label: "نشط الآن", live: true, key: "active" },
      { num: "100%", label: "مجاني" },
    ],
    landingFeaturesTitle: "لماذا فِراس AI؟",
    landingFeaturesSub: "منصّة ذكاء اصطناعي متكاملة، تتحدّث العربية والإنجليزية بطلاقة — كل ما تحتاجه في مكان واحد.",
    landingFeatures: [
      { icon: "spark", title: "أربعة نماذج ذكية", desc: "«ميني» للسرعة، و«برو» للمهام اليومية، و«أولترا» للأسئلة الصعبة والبرمجة، و«ماكس» الأقوى للأسئلة الصعبة والتحليل العميق في كل المجالات." },
      { icon: "code", title: "كتابة الكود مباشرةً", desc: "يكتب صفحات HTML/CSS/JS كاملة داخل نافذة محرّر حيّة، مع معاينة فورية وزر تحميل." },
      { icon: "search", title: "بحث الويب المباشر", desc: "يجلب معلومات حديثة من الإنترنت ويجيبك مع ذكر المصادر القابلة للنقر." },
      { icon: "bulb", title: "وضع التفكير", desc: "تحليل أعمق ودقّة أعلى عند تفعيله — مثالي للأسئلة المعقّدة والمسائل المنطقية." },
      { icon: "image", title: "توليد الصور (تجريبي)", desc: "حوّل وصفك إلى صورة فنية — اكتب «اصنع لي صورة…» وشاهدها تُولَّد أمامك." },
      { icon: "devices", title: "يعمل في كل مكان", desc: "تصميم متجاوب أنيق على الهاتف واللوحي والحاسوب — مجانًا وبلا تسجيل معقّد." },
    ],
    landingImageBadge: "تجريبي",
    landingImageTitle: "ميزة توليد الصور",
    landingImageBody: "أُطلقت حديثًا وما زالت قيد التطوير، لذا قد تتحسّن النتائج تدريجيًا. الحدّ الحالي: ٥ صور في اليوم لكل مستخدم. جرّبها بكتابة «اصنع لي صورة…» داخل المحادثة.",
    // Masked file streaming
    fileCreating: "جاري إنشاء الملف…",
    fileViewContent: "عرض المحتوى",
    fileHideContent: "إخفاء المحتوى",
    // Export / download
    download: "تصدير",
    downloadPdf: "ملف PDF",
    downloadWord: "مستند Word",
    downloadExcel: "جدول Excel",
    downloadPpt: "عرض PowerPoint",
    preparing: "جارٍ التحضير…",
    formatUnavailable: "هذا التنسيق غير متاح حاليًا.",
    exportEmpty: "لا يوجد محتوى للتصدير.",
    // File card (Claude-style downloadable file)
    fileReady: "الملف جاهز",
    fileDownload: "تنزيل",
    fileNamePdf: "firas-document.pdf",
    fileNameDocx: "firas-document.docx",
    fileNameXlsx: "firas-data.xlsx",
    fileNamePptx: "firas-presentation.pptx",
    fileNameCsv: "firas-data.csv",
    fileLabelPdf: "مستند PDF",
    fileLabelDocx: "مستند Word",
    fileLabelXlsx: "جدول Excel",
    fileLabelPptx: "عرض PowerPoint",
    fileLabelCsv: "ملف CSV",
    // Live HTML preview
    preview: "معاينة",
    previewTitle: "معاينة HTML",
    previewRefresh: "تحديث",
    previewOpen: "فتح في تبويب جديد",
    previewDownload: "تنزيل HTML",
    previewClose: "إغلاق",
    // Auth
    authSignupTitle: "أنشئ حسابك",
    authLoginTitle: "مرحبًا بعودتك",
    authSignupSubtitle: "ابدأ المحادثة مع فِراس.",
    authLoginSubtitle: "سجّل الدخول لمتابعة محادثاتك.",
    authName: "الاسم",
    authEmail: "البريد الإلكتروني",
    authPassword: "كلمة المرور",
    authSignupBtn: "إنشاء حساب",
    authLoginBtn: "تسجيل الدخول",
    authToLogin: "لديك حساب بالفعل؟",
    authToSignup: "ليس لديك حساب؟",
    authToLoginBtn: "تسجيل الدخول",
    authToSignupBtn: "إنشاء حساب",
    authGenericError: "تعذّر إتمام العملية. حاول مرة أخرى.",
    authNetworkError: "تعذّر الاتصال بالخادم. تحقّق من اتصالك.",
    authForgot: "نسيت كلمة المرور؟",
    authForgotNeedEmail: "اكتب بريدك الإلكتروني أولاً.",
    authForgotSent: "إذا كان البريد مسجّلاً، أرسلنا له رابط إعادة التعيين. تحقّق من بريدك (وصندوق الـ Spam).",
    authResetTitle: "تعيين كلمة مرور جديدة",
    authResetSubtitle: "اختر كلمة مرور جديدة لحسابك.",
    authResetBtn: "تعيين كلمة المرور",
    authNewPassword: "كلمة المرور الجديدة",
    authResetDone: "تم تغيير كلمة المرور — سجّل الدخول الآن.",
    authResetInvalid: "الرابط غير صالح أو منتهي. اطلب رابطاً جديداً.",
    authVerifyTitle: "📧 تفقّد بريدك الإلكتروني",
    authVerifySubtitle: "أرسلنا رابط التأكيد إلى",
    authVerifyWaiting: "افتح الرابط من بريدك واضغط الزر — وسيكتمل الدخول هنا تلقائياً (حتى لو فتحته من جهاز آخر). تحقّق من صندوق الوارد والـ Spam.",
    authVerifyBad: "رابط التأكيد غير صالح أو منتهي. أعد التسجيل من جديد.",
    authVerifyBtn: "تأكيد",
    authCode: "رمز التحقق (٦ أرقام)",
    authCodeInvalid: "أدخل رمزاً مكوّناً من ٦ أرقام.",
    authCodeWrong: "الرمز غير صحيح أو منتهي.",
    authResend: "إعادة إرسال الرابط",
    authBack: "‹ الرجوع لتسجيل الدخول",
    authResendOk: "📧 أرسلنا رابطاً جديداً إلى بريدك",
    authResendWait: "انتظر قليلاً قبل إعادة الإرسال",
    authCodeResent: "أرسلنا رابطاً جديداً إلى بريدك.",
    authGoogle: "المتابعة عبر Google",
    authOr: "أو",
    authGoogleError: "تعذّر تسجيل الدخول عبر Google. حاول مرة أخرى.",
    authGoogleCancelled: "تم إلغاء تسجيل الدخول.",
    authGoogleUnavailable: "تسجيل الدخول عبر Google غير متاح حاليًا.",
    chatsSaveError: "تعذّر حفظ المحادثة. ستُعاد المحاولة.",
    chatsLoadError: "تعذّر تحميل المحادثات.",
  },
  en: {
    newChat: "New chat",
    newChatShort: "New",
    searchPlaceholder: "Search conversations",
    composerPlaceholder: "Ask Firas…",
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    today: "Today",
    yesterday: "Yesterday",
    previous7: "Previous 7 days",
    previous30: "Previous 30 days",
    older: "Older",
    emptyHistory: "No conversations yet.",
    noResults: "No results.",
    thinking: "Thinking",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Copy failed — try again",
    regenerate: "Regenerate",
    regenUltra: "Regenerate with Firas Ultra",
    stop: "Stop",
    send: "Send",
    copyCode: "Copy",
    rename: "Rename",
    pinned: "Pinned",
    pin: "Pin",
    unpin: "Unpin",
    delete: "Delete",
    deleteConfirm: "Delete this conversation?",
    errorTitle: "Couldn't connect.",
    retry: "Retry",
    streaming: "Firas is typing…",
    badge: "by",
    disclaimer: "Firas can make mistakes. Check important info.",
    logout: "Log out",
    settings: "Settings",
    thinkOn: "Thinking on — higher accuracy",
    thinkOff: "Thinking off — faster replies",
    thinkMaxBlocked: "Sorry, Thinking can't be used in Firas Max — it may break the safety limits.",
    webSearch: "Web search",
    searchOn: "Web search on — searches every message",
    searchOff: "Web search auto — searches when needed",
    // Response modes (separate from the Firas tier)
    modeLabel: "Mode",
    modeAuto: "Auto",
    modeAutoHint: "Smart & direct — answers right away.",
    modePlan: "Plan",
    modePlanHint: "Asks & plans first, then executes once you approve.",
    planStart: "Start",
    planStartHint: "Approve the plan and start executing",
    planApproval: "Go ahead and execute the plan.",
    // Interactive clarifying choices (Plan mode)
    askRecommended: "Recommended",
    askContinue: "Continue",
    askBack: "Back",
    askSubmit: "Confirm",
    askStep: "Question",
    askExtraPlaceholder: "Or add a detail…",
    askAnswered: "Sent",
    askMyChoices: "My choices",
    askPreparing: "Preparing questions…",
    // Landing / hero (logged-out)
    landingAbout:
      "Firas AI is an AI model that can think and emulate the human mind within deliberate limits — engineered to be powerful, precise, and at your service.",
    landingStart: "Get Started",
    landingStats: [
      { num: "+1,200", label: "Users", key: "users" },
      { num: "+500", label: "Active now", live: true, key: "active" },
      { num: "100%", label: "Free" },
    ],
    landingFeaturesTitle: "Why Firas AI?",
    landingFeaturesSub: "A complete AI platform — fluent in Arabic and English, with everything you need in one place.",
    landingFeatures: [
      { icon: "spark", title: "Four smart models", desc: "“Mini” for speed, “Pro” for everyday tasks, “Ultra” for hard questions & coding, and “Max” — the strongest for hard questions & deep analysis across every field." },
      { icon: "code", title: "Writes code live", desc: "Builds complete HTML/CSS/JS pages inside a live editor window, with instant preview and a download button." },
      { icon: "search", title: "Live web search", desc: "Pulls fresh information from the internet and answers with clickable sources." },
      { icon: "bulb", title: "Thinking mode", desc: "Deeper analysis and higher accuracy when enabled — ideal for complex, logical problems." },
      { icon: "image", title: "Image generation (beta)", desc: "Turn your description into artwork — type “create an image of…” and watch it generate." },
      { icon: "devices", title: "Works everywhere", desc: "A polished, responsive design on phone, tablet and desktop — free, with no complicated sign-up." },
    ],
    landingImageBadge: "Beta",
    landingImageTitle: "Image generation",
    landingImageBody: "Recently launched and still under active development, so results will keep improving. Current limit: 5 images per day per user. Try it by typing “create an image of…” in the chat.",
    // Masked file streaming
    fileCreating: "Creating your file…",
    fileViewContent: "View content",
    fileHideContent: "Hide content",
    // Export / download
    download: "Download",
    downloadPdf: "PDF document",
    downloadWord: "Word document",
    downloadExcel: "Excel spreadsheet",
    downloadPpt: "PowerPoint slides",
    preparing: "Preparing…",
    formatUnavailable: "That format is unavailable right now.",
    exportEmpty: "Nothing to export.",
    // File card (Claude-style downloadable file)
    fileReady: "File ready",
    fileDownload: "Download",
    fileNamePdf: "firas-document.pdf",
    fileNameDocx: "firas-document.docx",
    fileNameXlsx: "firas-data.xlsx",
    fileNamePptx: "firas-presentation.pptx",
    fileNameCsv: "firas-data.csv",
    fileLabelPdf: "PDF document",
    fileLabelDocx: "Word document",
    fileLabelXlsx: "Excel spreadsheet",
    fileLabelPptx: "PowerPoint slides",
    fileLabelCsv: "CSV file",
    // Live HTML preview
    preview: "Preview",
    previewTitle: "HTML preview",
    previewRefresh: "Refresh",
    previewOpen: "Open in new tab",
    previewDownload: "Download HTML",
    previewClose: "Close",
    // Auth
    authSignupTitle: "Create your account",
    authLoginTitle: "Welcome back",
    authSignupSubtitle: "Start your conversation with Firas.",
    authLoginSubtitle: "Log in to continue your conversations.",
    authName: "Name",
    authEmail: "Email",
    authPassword: "Password",
    authSignupBtn: "Create account",
    authLoginBtn: "Log in",
    authToLogin: "Already have an account?",
    authToSignup: "Don't have an account?",
    authToLoginBtn: "Log in",
    authToSignupBtn: "Sign up",
    authGenericError: "Something went wrong. Please try again.",
    authNetworkError: "Couldn't reach the server. Check your connection.",
    authForgot: "Forgot password?",
    authForgotNeedEmail: "Enter your email first.",
    authForgotSent: "If that email is registered, we sent a reset link. Check your inbox (and Spam).",
    authResetTitle: "Set a new password",
    authResetSubtitle: "Choose a new password for your account.",
    authResetBtn: "Set password",
    authNewPassword: "New password",
    authResetDone: "Password changed — sign in now.",
    authResetInvalid: "The link is invalid or expired. Request a new one.",
    authVerifyTitle: "📧 Check your email",
    authVerifySubtitle: "We sent a verification link to",
    authVerifyWaiting: "Open the link from your email and tap the button — this device will finish automatically (even if you open it on another device). Check your inbox and Spam.",
    authVerifyBad: "The verification link is invalid or expired. Please sign up again.",
    authVerifyBtn: "Verify",
    authCode: "Verification code (6 digits)",
    authCodeInvalid: "Enter a 6-digit code.",
    authCodeWrong: "Wrong or expired code.",
    authResend: "Resend link",
    authBack: "‹ Back to sign in",
    authResendOk: "📧 We sent a new link to your email",
    authResendWait: "Please wait before resending",
    authCodeResent: "We sent a new link to your email.",
    authGoogle: "Continue with Google",
    authOr: "or",
    authGoogleError: "Couldn't sign in with Google. Please try again.",
    authGoogleCancelled: "Sign-in cancelled.",
    authGoogleUnavailable: "Google sign-in is unavailable right now.",
    chatsSaveError: "Couldn't save the chat. Retrying.",
    chatsLoadError: "Couldn't load conversations.",
  },
};

/* SVG icon set (inline, no external deps) */
const ICONS = {
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2h6c0-.8.4-1.5 1-2A7 7 0 0 0 12 2Z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2Z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h7l-1 7 9-12h-7l1-7-9 12Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  regen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg>',
  continue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 4 10 8-10 8V4ZM19 4v16"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-1.6 11.2a1 1 0 0 1-1 .8H5.6a1 1 0 0 1-1-.8L3 7Z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  caret: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6Z"/><path d="M12 15v5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  preview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  filePdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  fileDoc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/></svg>',
  fileXls: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13l6 5M15 13l-6 5"/></svg>',
  filePpt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h6a2 2 0 0 1 0 4H8zM8 13v6"/></svg>',
};
const TIER_ICON = { mini: ICONS.zap, pro: ICONS.bolt, ultra: ICONS.star, max: ICONS.crown };

/* Response-mode icons (distinct from tier icons). Auto = lightning bolt
   (direct), Plan = checklist/clipboard (steps). */
ICONS.modeAuto = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>';
ICONS.modePlan = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2"/><path d="M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1H9z"/><path d="m8 12 2 2 4-4"/></svg>';
ICONS.play = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 4 14 8-14 8z"/></svg>';
ICONS.caretDown = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

const MODES = {
  auto: { key: "auto", icon: ICONS.modeAuto, label: (l) => STR[l].modeAuto, hint: (l) => STR[l].modeAutoHint },
  plan: { key: "plan", icon: ICONS.modePlan, label: (l) => STR[l].modePlan, hint: (l) => STR[l].modePlanHint },
};

/* The distinct Firas brand glyph — a geometric "F" + node/signal mark.
   NOT a sunburst/asterisk. Rendered white on the teal rounded-square tile. */
const FIRAS_MARK =
  '<svg class="fmark" viewBox="0 0 64 64" fill="none" aria-hidden="true">' +
  '<g stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M25 47V21a4 4 0 0 1 4-4h13"/>' +
  '<path d="M25 33h12"/></g>' +
  '<circle cx="44" cy="45" r="5.5" fill="currentColor"/></svg>';

/** Inject the Firas mark SVG into every brand tile (.nib / assistant avatar). */
function injectBrandMarks(root) {
  (root || document).querySelectorAll(".nib, .msg-ai__avatar").forEach((el) => {
    if (el.querySelector(".fmark")) return;
    el.insertAdjacentHTML("afterbegin", FIRAS_MARK);
  });
}

/* ----------------------------------------------------------------------------
   State
---------------------------------------------------------------------------- */
const LS_TIER = "firas_ai_tier";
const LS_THEME = "firas_ai_theme";
const LS_LANG = "firas_ai_lang";
const LS_THINK = "firas_ai_think";
const LS_MODE = "firas_ai_mode";
const LS_SIDEBAR = "firas_ai_sidebar_collapsed";
const LS_WEBSEARCH = "firas_ai_websearch";
const LS_PRODUCT = "firas_ai_product";

const state = {
  chats: [],          // sidebar list: [{ id, title, updatedAt, messages? }] — messages loaded on open
  activeId: null,
  product: "ai",      // "ai" (chat) | "agent" (Firas Agent — its OWN chats & environment)
  tier: CONFIG.DEFAULT_TIER,
  mode: "auto",       // response mode: "auto" | "plan" (separate from tier)
  theme: "dark",      // DARK is the default theme (overridable via the toggle)
  lang: "ar",
  think: true,        // device pref: send reasoning request to backend
  webSearch: false,   // device pref: force web search on every message (all tiers)
  search: "",
  sidebarCollapsed: false, // desktop: sidebar hidden (taskbar restore affordance)
  streaming: false,        // true while the ACTIVE chat is streaming (drives Stop UI)
  streamingChatId: null,   // id of the chat whose stream is in flight (any chat)
  user: null,         // { name, email } once authenticated
  chatsLoaded: false, // whether the sidebar list has been fetched
};

/* In-flight streams, keyed by chat id. Each entry: { controller, timeoutId, aiMsg }.
   Decouples streaming from chat navigation — a stream keeps running and saves to
   ITS chat even if the user opens/switches chats; only Stop aborts it. */
const activeStreams = new Map();

/* Auto-resume: when a reply is cut off because the browser BACKGROUNDED the tab or a brief
   connectivity drop hit (very common on phones — iOS freezes background tabs and kills the
   connection), we do NOT show a "retry" button. We drop the partial turn and re-run it
   automatically the moment the app is foreground + online again — so the user can fire a task,
   leave to another app, and come back to it finishing on its own. In-memory: covers the common
   "switch apps & come back" case (the tab stays alive). */
const resumeQueue = new Set();   // chat objects whose last turn was interrupted
function canResumeNow() { return !document.hidden && navigator.onLine !== false; }
function flushResumeQueue() {
  if (!canResumeNow()) return;
  const active = activeChat();
  for (const chat of Array.from(resumeQueue)) {
    if (!chat) { resumeQueue.delete(chat); continue; }
    if (chat !== active) continue;                           // only resume the chat in view (runAssistant renders it)
    resumeQueue.delete(chat);
    if (activeStreams.has(chat.id)) continue;                // already running
    const rp = chat._resume; delete chat._resume;
    const last = chat.messages && chat.messages[chat.messages.length - 1];
    if (rp && last && last.role === "user") runAssistant(chat, rp.tier || state.tier, rp.lang || state.lang);
  }
}

/* DOM refs */
const $ = (s) => document.querySelector(s);
const els = {};

/* ----------------------------------------------------------------------------
   Utilities
---------------------------------------------------------------------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const t = () => STR[state.lang];

/** Detect language by Arabic script presence. */
function detectLang(text) {
  if (!text) return state.lang || "ar";
  return /[؀-ۿ]/.test(text) ? "ar" : "en";
}

/* ----------------------------------------------------------------------------
   File-request detection — make Firas behave like Claude for FILES.
   Returns "pdf" | "docx" | "xlsx" | "pptx" | null. Fires only when the user is
   actually REQUESTING a file (a request verb, or the format word is the ask).
   Arabic + English. Checks pptx/xlsx/docx BEFORE the generic pdf fallback.
---------------------------------------------------------------------------- */
const FILE_REQUEST_VERBS =
  /\b(make|create|generate|build|produce|export|give\s*me|turn\s*(?:it|this)?\s*into|convert|save|download|send\s*me|write(?:\s*me)?|draft|compose|author|prepare|put\s*(?:it|this)?\s*(?:in|into))\b|اصنع|إصنع|أنشئ|انشئ|سوّ?ي|اعمل|إعمل|اعملي|حوّ?ل|صدّ?ر|أعطني|اعطني|نزّ?ل|ابعت|إبعت|جهّ?ز|اكتب(?:\s*لي)?|خرّ?ج/i;

/* ----------------------------------------------------------------------------
   CODE requests — "make me a single-file HTML site", "اكتب لي كود", "vanilla JS
   script"… These must produce RAW CODE (streamed live into a code window +
   downloadable), NOT a Word/PDF/PowerPoint document. Detected separately and
   given precedence over the generic "file → pdf" fallback below.
---------------------------------------------------------------------------- */
// Build verbs (kept unambiguous: NO برمج/طور — they collide with the noun
// "البرمجة"/"التطور". Note: Arabic has no \b word boundary, so never wrap an
// Arabic token in \b — it would never match.)
const CODE_BUILD_VERBS =
  /(اصنع|إصنع|اعمل|إعمل|سو[يّ]?ي?|سويي|ابن[يي]|أبني|اكتب|أكتب|انشئ|أنشئ|صم[مّ]|generate|create|make|build|write|develop|design|implement|code\s+me|build\s+me)/i;
// Hard signals = unambiguous programming intent.
const CODE_HARD =
  /\bhtml\b|\bcss\b|\bjavascript\b|vanilla\s*js|كود|\bcode\b|سكربت|سكريبت|\bscript\b|<!doctype|\bc\+\+|\bcpp\b|\bjava\b|\bc#|csharp|\brust\b|\bgolang\b|\bkotlin\b|\bswift\b|\bphp\b|\btypescript\b|\bpython\b|بايثون|برنامج|برمجة|سي\s*بلس\s*بلس|جافا/i;
// Soft signals = web words that only count alongside a build verb.
const CODE_SOFT =
  /موقع|\bwebsite\b|web\s*site|web\s*page|webpage|صفحة\s*ويب|landing\s*page|single[-\s]?file/i;
// Spec phrases so explicit they imply code on their own (no verb needed).
const CODE_SPEC =
  /single[-\s]?file\s*(html|website|web\s*site|site|page|web\s*page)|<!doctype\s*html|(ملف|صفحة|موقع|كود)\s*html|html\s*(file|website|site|page)|سنكل\s*فايل|single\s*html/i;
// If the user explicitly names a DOCUMENT format, it's a document, not code.
const CODE_DOC_OVERRIDE =
  /powerpoint|pptx|بوربوينت|باوربوينت|عرض\s*تقديمي|شرائح|سلايد|\bpdf\b|بي\s*دي\s*اف|excel|xlsx|اكسل|[إاأ]ي?كس[يى]?ل|\bword\b|docx|وورد|(?:ملف|مستند|بصيغة|صيغة)\s*ورد|\bcsv\b/i;
// Generic PROGRAMMING nouns: with a build verb these mean CODE even without a named
// language/web word ("write a function", "build me a calculator app", "make a game").
const CODE_GENERIC =
  /\bprogram\b|\bapp(?:lication)?\b|\bfunction\b|\bclass\b|\balgorithm\b|\bsnippet\b|\bgame\b|\bCLI\b|\bAPI\b|\bendpoint\b|\bregex\b|\bquery\b|\b(?:bash|shell)\b|تطبيق|دالة|خوارزمية|لعبة/i;
// Document-deliverable nouns: a request for one of these (with a verb, no code/format
// signal) defaults to a PDF — see detectFileRequest. Shared so detectCodeRequest can
// bail on document-flavored phrasing.
const DOC_NOUN =
  /\b(report|summary|essay|book|ebook|guide|manual|paper|article|letter|cv|resume|story|outline|notes?|memo|thesis|brochure|worksheet)\b|تقرير|ملخّ?ص|مقال|كتاب|دليل|بحث|رسالة|سيرة\s*ذاتية|قصة|مذكرة|أطروحة|كرّاس|ورقة\s*عمل/i;

/** Decide which language a code request targets (defaults to a single HTML file,
    the dominant case). */
function codeSpecFromText(text) {
  const s = String(text).toLowerCase();
  const webby = /\bhtml\b|website|web\s*site|web\s*page|موقع|صفحة|<!doctype/.test(s);
  if (/\bpython\b|بايثون/.test(s) && !webby) return { lang: "python", ext: "py", label: "Python", filename: "script.py" };
  if (/\bc\+\+|\bcpp\b|سي\s*بلس\s*بلس|سي\+\+/.test(s) && !webby) return { lang: "cpp", ext: "cpp", label: "C++", filename: "main.cpp" };
  if ((/\bjava\b/.test(s) || /جافا/.test(s)) && !/javascript|جافا\s*سكر|جافاسكربت/.test(s) && !webby) return { lang: "java", ext: "java", label: "Java", filename: "Main.java" };
  if (/\bc#|c\s*sharp|csharp|سي\s*شارب/.test(s) && !webby) return { lang: "csharp", ext: "cs", label: "C#", filename: "Program.cs" };
  if (/\brust\b|راست/.test(s) && !webby) return { lang: "rust", ext: "rs", label: "Rust", filename: "main.rs" };
  if (/\bgolang\b|لغة\s*go/.test(s) && !webby) return { lang: "go", ext: "go", label: "Go", filename: "main.go" };
  if (/\bkotlin\b|كوتلن/.test(s) && !webby) return { lang: "kotlin", ext: "kt", label: "Kotlin", filename: "Main.kt" };
  if (/\bswift\b|سويفت/.test(s) && !webby) return { lang: "swift", ext: "swift", label: "Swift", filename: "main.swift" };
  if (/\bphp\b/.test(s) && !webby) return { lang: "php", ext: "php", label: "PHP", filename: "index.php" };
  if (/\btypescript\b/.test(s) && !webby) return { lang: "typescript", ext: "ts", label: "TypeScript", filename: "main.ts" };
  if (/\bcss\b|stylesheet/.test(s) && !webby) return { lang: "css", ext: "css", label: "CSS", filename: "styles.css" };
  if ((/\bjavascript\b|vanilla\s*js|\bnode(?:\.js)?\b|جافا\s*سكر|جافاسكربت/.test(s) || /\bjs\b/.test(s)) && !webby)
    return { lang: "javascript", ext: "js", label: "JavaScript", filename: "script.js" };
  return { lang: "html", ext: "html", label: "HTML", filename: "index.html" };
}

/** Return a code spec ({lang,ext,label,filename}) when the user wants source code,
    else null. Questions ("ما هو html؟") never match — they lack a build verb. */
// A request to DRAW/sketch a STATIC figure or graph (ارسم / رسم دالة / draw…) is a TikZ
// figure shown in chat — NOT a code/website build — unless explicit web-app words appear.
const DRAW_REQUEST = /\b(draw|sketch)\b|ارسم|إرسم|ارسملي|ارسم\s*لي|رسم\s*بياني|رسم\s*دالة|رسم\s*شكل|رسم\s*مثلث|رسم\s*دائرة|رسمة|رسمه|مخطّط|مخطط/i;
const DRAW_AS_APP = /website|web\s*app|web\s*page|\bpage\b|\bsite\b|interactive|canvas|\bhtml\b|\bcss\b|javascript|\bjs\b|\bgame\b|موقع|صفحة|تطبيق|تفاعل|لعبة/i;
function detectCodeRequest(text) {
  if (!text) return null;
  const s = String(text);
  if (CODE_DOC_OVERRIDE.test(s)) return null; // explicit doc format → not code
  // A drawing/figure/graph request → a TikZ figure in chat, NOT code — bail before code routing.
  if (DRAW_REQUEST.test(s) && !DRAW_AS_APP.test(s) && !CODE_SPEC.test(s)) return null;
  if (CODE_SPEC.test(s)) return codeSpecFromText(s);
  const hasVerb = CODE_BUILD_VERBS.test(s);
  if (!hasVerb) return null;
  // Document-flavored request (report/book/essay…) → a DOCUMENT, UNLESS it explicitly
  // names a code artifact/language. "report ABOUT programming" (برمجة as a TOPIC) is a
  // PDF, not code — so the bail ignores topic-words (برمجة/برنامج) and only defers to
  // code on an explicit language/كود/<!doctype/CODE_SPEC or a generic programming noun.
  // A bare LANGUAGE NAME (python/html…) can be a TOPIC ("report about python"), so it does
  // NOT count as a code artifact here — only an explicit "code/كود/script/<!doctype", a
  // single-file spec, or a generic programming noun (function/app/game) overrides a document.
  const codeArtifact = CODE_SPEC.test(s) || CODE_GENERIC.test(s) ||
    /\bcode\b|كود|\bscript\b|سكر[يى]?بت|سكريبت|<!doctype/i.test(s);
  if (DOC_NOUN.test(s) && !codeArtifact) return null;
  // A build verb + a hard/soft/generic programming signal → real code request.
  if (CODE_HARD.test(s) || CODE_SOFT.test(s) || CODE_GENERIC.test(s)) return codeSpecFromText(s);
  return null;
}

// Code-edit / continue / iterate intents. Once the previous assistant turn was a
// code deliverable, ANY of these keep the follow-up inside the SAME code box —
// these are imperative verbs ("edit", "add", "make it…"), not the code NOUN, so a
// fresh request still needs detectCodeRequest above.
const CODE_FOLLOWUP =
  /عدّل|عدل|تعديل|عدّله|عدله|غيّر|غير|بدّل|بدل|أضف|اضف|اضيف|ضيف|احذف|أصلح|اصلح|صحّح|صحح|كمّل|كمل|كمّله|كمله|أكمل|اكمل|استمر|واصل|زِد|زد|حسّن|حسن|طوّر|طور|اجعل|اجعله|خلّي|خلي|أعد|اعد\s*كتابة|نفس\s*الكود|edit|modif|chang|updat|\badd\b|remov|delet|\bfix\b|continu|improv|refactor|append|extend|rewrit|make\s+it|same\s+code|keep\s+going/i;

/** When the most recent assistant turn was a code deliverable, treat a follow-up
    edit/continue/iterate request as code too — so it streams into the SAME code box
    instead of leaking into the chat as plain text, then being re-boxed. Reuses the
    previous file's language/extension. Returns a spec or null. */
function codeFollowupSpec(convo) {
  if (!Array.isArray(convo) || state.mode === "plan") return null;
  const last = [...convo].reverse().find((m) => m.role === "user");
  if (!last) return null;
  // Was the most recent assistant turn a CODE deliverable?
  let prevCode = null;
  for (let i = convo.length - 1; i >= 0; i--) {
    if (convo[i].role === "assistant") { prevCode = parseCodeMeta(convo[i].content); break; }
  }
  if (!prevCode) return null; // last AI turn wasn't code → route normally
  const s = String(last.content || "");
  if (CODE_DOC_OVERRIDE.test(s) || detectFileRequest(s)) return null; // explicit document
  // A pure explanation/question about the code ("how does this work?") stays a
  // normal chat answer — don't regenerate the file.
  const explains = /(اشرح|وضّح|فسّر|ما\s*معنى|شنو\s*يعني|شرح|\bexplain\b|what\s+does|how\s+does\s+it|why\s+is)/i.test(s);
  if (explains && !CODE_BUILD_VERBS.test(s)) return null;
  if (detectCodeRequest(s) || CODE_FOLLOWUP.test(s)) {
    return { lang: prevCode.lang, ext: prevCode.ext, label: prevCode.label, filename: prevCode.filename };
  }
  return null;
}

/** Detect a requested file format from user text, or null. */
function detectFileRequest(text) {
  if (!text) return null;
  const s = String(text).toLowerCase();

  // EXPLICIT NEGATION — the user said NOT to make a file/pdf ("no pdf", "without a file",
  // "بدون pdf", "لا تسوي ملف", "مو بي دي اف"). Honor it: no file deliverable at all.
  if (/\b(?:no|without|don'?t\s+(?:make|create|want|need|give)|not\s+(?:a|an|as))\s+(?:a\s+|an\s+|any\s+)?(?:pdf|file|document|word|excel|powerpoint|ppt|csv|slides?|deck)\b/i.test(s) ||
      /(?:بدون|بلا|من\s*دون|مو|مش|ليس|بغير|لا)\s*(?:ملف|مستند|وثيقة|pdf|بي\s*دي\s*اف|بدف|وورد|ورد|اكسل|إكسل|بوربوينت|عرض\s*تقديمي)/i.test(s) ||
      /(?:لا\s*(?:تسوي|تعمل|تصنع|تنشئ|تحول|تحوّل)|ما\s*(?:اريد|أريد|ابي|أبي|بدي|بغيت))\s*[^.؟?!\n]{0,22}?(?:ملف|pdf|بي\s*دي\s*اف|بدف|مستند|وثيقة|بوربوينت|اكسل|وورد)/i.test(s)) {
    return null;
  }

  // STRONG = unambiguous format words (can request a file on their own).
  // WEAK   = everyday words (word/sheet/slides/ppt/presentation) that only count
  //          as a file request alongside a request verb or a generic "file" word.
  const formats = [
    { fmt: "pptx",
      strong: /powerpoint|pptx|بوربوينت|باوربوينت|عرض\s*تقديمي|عرض\s*بوربوينت|شرائح|سلايد/i,
      weak:   /\bppt\b|presentation|slides?/i },
    { fmt: "csv",
      strong: /\bcsv\b|سي\s*في\s*اس|سي\s*في\s*أس|ملف\s*csv|csv\s*ملف/i,
      weak:   null },
    { fmt: "xlsx",
      strong: /excel|xlsx|spreadsheet|[إاأ]ي?كس[يى]?ل|اكسل|جدول\s*بيانات/i,
      weak:   /\bsheet\b/i },
    { fmt: "docx",
      // "ورد" alone also means roses / "was mentioned" (ما ورد) — only treat it as
      // Word when a document cue precedes it; "وورد"/word/docx stay unambiguous.
      strong: /docx|مستند\s*word|مستند\s*وورد|وورد|(?:ملف|مستند|بصيغة|صيغة|بصبغة)\s*ورد/i,
      weak:   /\bword\b/i },
    { fmt: "pdf",
      strong: /\bpdf\b|بي\s*دي\s*اف|بدف|ملف\s*pdf/i,
      weak:   null },
  ];
  const genericFileRe = /\bfile\b|\bdocument\b|ملف|مستند|وثيقة/i;
  const hasVerb = FILE_REQUEST_VERBS.test(s);

  // Is this a QUESTION about a format ("ما هو ملف pdf؟") rather than a request to
  // make one? (Arabic-aware: \b does not work around Arabic letters — no \b there.)
  const isQuestion =
    /[?؟]/.test(s) ||
    /^\s*(ما|ماذا|كيف|لماذا|ليش|وش|شنو|شو|هل|متى|اين|أين|كم|أي)(\s|$)/.test(s) ||
    /(معنى|تعريف|الفرق\s*بين|اشرح|وضّح|فسّر)/.test(s) ||
    /\b(what|how|why|who|when|where|which|whose|meaning|explain|describe|difference\s+between)\b/i.test(s);

  // 0) An EXPLICIT pdf output request ("pdf book/file", "as pdf", "في صيغة pdf") wins
  //    over any incidental sheet/table/word/slide mention elsewhere in the prompt.
  if ((hasVerb || !isQuestion) &&
      /\bpdf\s+(?:book|file|document|workbook|format|report)\b|\b(?:as|in|to|into)\s+(?:an?\s+)?pdf\b|بصيغة\s*pdf|كملف\s*pdf|ملف\s*pdf|بي\s*دي\s*اف/i.test(s)) {
    return "pdf";
  }
  // 1) Unambiguous format word = a file request, unless it's a pure question
  //    with no request verb.
  for (const f of formats) {
    if (f.strong.test(s) && (hasVerb || !isQuestion)) return f.fmt;
  }
  // 1b) No explicit document format, but the user wants SOURCE CODE → not a
  //     document. Let the dedicated code path handle it (returns null here).
  if (detectCodeRequest(text)) return null;
  // 2) A common (weak) word counts only with a request verb or a generic file word.
  for (const f of formats) {
    if (f.weak && f.weak.test(s) && (hasVerb || genericFileRe.test(s))) return f.fmt;
  }
  // 3) A request verb + a generic "file/document" word OR a document-deliverable noun
  //    (report/book/summary/بحث/تقرير…) defaults to PDF — so most document requests
  //    become a PDF unless another format was explicitly named above.
  if (hasVerb && (genericFileRe.test(s) || DOC_NOUN.test(s))) return "pdf";
  return null;
}

/** UI/runtime metadata for a requested file format. */
function fileFormatMeta(fmt) {
  switch (fmt) {
    case "pptx": return { ext: "pptx", icon: ICONS.filePpt, nameKey: "fileNamePptx", labelKey: "fileLabelPptx", run: (turn, msg) => exportPpt(turn, msg.lang, msg) };
    case "xlsx": return { ext: "xlsx", icon: ICONS.fileXls, nameKey: "fileNameXlsx", labelKey: "fileLabelXlsx", run: (turn, msg) => exportExcel(turn, msg.lang, msg) };
    case "csv":  return { ext: "csv",  icon: ICONS.fileXls, nameKey: "fileNameCsv",  labelKey: "fileLabelCsv",  run: (turn, msg) => exportCsv(turn, msg.lang, msg) };
    case "docx": return { ext: "docx", icon: ICONS.fileDoc, nameKey: "fileNameDocx", labelKey: "fileLabelDocx", run: (turn, msg) => exportWord(turn, msg.lang, msg) };
    case "pdf":  return { ext: "pdf",  icon: ICONS.filePdf, nameKey: "fileNamePdf",  labelKey: "fileLabelPdf",  run: (turn, msg) => exportPdf(turn, msg.lang, msg) };
    default: return null;
  }
}

/** The file format requested for the user message that precedes assistant `index`. */
function requestedFormatForAssistant(chat, index) {
  if (!chat || !Array.isArray(chat.messages)) return null;
  for (let i = index - 1; i >= 0; i--) {
    const m = chat.messages[i];
    if (m.role === "user") return detectFileRequest(m.content);
  }
  return null;
}

/** Deliverable format for a message that CARRIES a ```firas-file meta block — the Firas Agent
    delivers its documents this way. The block itself proves this IS a downloadable file, so it
    always gets the file card + masked body (same as a normal Firas AI file reply) even when the
    immediately preceding user message doesn't look like a file request (e.g. it's the answers
    to the agent's clarifying questions, or a task phrasing detectFileRequest doesn't match).
    Format = the nearest explicit format any earlier user message asked for, else pdf. */
function fileMetaFormat(msg, chat) {
  if (!msg || !msg.content || !/```firas-file/i.test(msg.content)) return null;
  const c = chat || activeChat();
  if (c && Array.isArray(c.messages)) {
    const idx = c.messages.indexOf(msg);
    for (let i = idx - 1; i >= 0; i--) {
      const m = c.messages[i];
      if (m.role !== "user") continue;
      const fmt = detectFileRequest(m.content);
      if (fmt) return fmt; // honour the user's explicit format choice
    }
  }
  return "pdf";
}

/** Should this assistant message be MASKED as a streaming/finished FILE (loader +
    card + collapsed disclosure instead of raw content)? True when the user
    requested a file format for this turn AND this turn actually delivers it —
    i.e. not a plan-mode clarifying/plan turn (those come before approval). */
function isFileStreamReply(msg, chat) {
  if (!msg || msg.offline) return null;
  // STRUCTURED blocks (firas-ask / firas-agent / firas-deck / firas-project / firas-code / firas-image)
  // are NEVER file-maskable — they have their own renderers. Without this, an agent's clarifying
  // questions after a "…pdf" request were masked as a downloadable file of raw JSON.
  if (/^\s*```firas-(?!file)/.test(msg.content || "")) return null;
  const c = chat || activeChat();
  if (!c || !Array.isArray(c.messages)) return null;
  const index = c.messages.indexOf(msg);
  if (index < 0) return null;
  // A ```firas-file meta block IS the delivered file (how the Agent ships its documents) —
  // always mask + card it, exactly like a normal Firas AI file reply.
  const metaFmt = fileMetaFormat(msg, c);
  if (metaFmt) return metaFmt;
  const fmt = requestedFormatForAssistant(c, index);
  if (!fmt) return null;
  // In plan mode, mask only the EXECUTION reply (after the user approved); the
  // earlier clarifying/plan turns stay readable.
  if (msg.mode === "plan" && !precededByApproval(c, index)) return null;
  return fmt;
}

/** Escape HTML — used by the offline-safe markdown fallback. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/** Convert Latin digits to Eastern-Arabic for Arabic UI dates/counts. */
function toArabicDigits(str) {
  if (state.lang !== "ar") return String(str);
  const map = "٠١٢٣٤٥٦٧٨٩";
  return String(str).replace(/[0-9]/g, (d) => map[+d]);
}

/** Load DEVICE prefs only (tier, theme, lang, thinking). Chats are server-side. */
function loadState() {
  state.tier = localStorage.getItem(LS_TIER) || CONFIG.DEFAULT_TIER;
  if (!MODELS[state.tier]) state.tier = CONFIG.DEFAULT_TIER;
  state.mode = localStorage.getItem(LS_MODE) || "auto";
  if (!MODES[state.mode]) state.mode = "auto";
  state.theme = localStorage.getItem(LS_THEME) || "dark"; // DARK by default
  state.sidebarCollapsed = localStorage.getItem(LS_SIDEBAR) === "true";
  const savedThink = localStorage.getItem(LS_THINK);
  state.think = savedThink === null ? true : savedThink === "true";
  state.webSearch = localStorage.getItem(LS_WEBSEARCH) === "true";
  state.product = localStorage.getItem(LS_PRODUCT) === "agent" ? "agent" : "ai";
  const savedLang = localStorage.getItem(LS_LANG);
  if (savedLang) state.lang = savedLang;
  else state.lang = (navigator.language || "ar").startsWith("en") ? "en" : "ar";
}

/* ----------------------------------------------------------------------------
   API layer — all account/chat data lives on the server (session cookie).
   Every call is resilient: throws on failure so callers can degrade gracefully.
---------------------------------------------------------------------------- */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    ...opts,
  });
  return res;
}
async function apiJson(path, opts = {}) {
  const res = await api(path, opts);
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    if (res.status === 401) handleSessionExpired(); // session died mid-use → re-auth
    const err = new Error((data && (data.message || data.error)) || ("HTTP " + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** A 401 AFTER the app has booted means the session expired/was invalidated
    (cookie lapsed, secret rotated on redeploy, logout in another tab). Tear the
    UI back to the auth screen instead of leaving a logged-in-looking shell whose
    every save/load silently fails. Fires once until the next successful login. */
let sessionExpiredHandled = false;
function handleSessionExpired() {
  if (sessionExpiredHandled || !state.user) return; // ignore boot/anon 401s
  sessionExpiredHandled = true;
  try { for (const id of [...activeStreams.keys()]) { const s = activeStreams.get(id); s && s.controller && s.controller.abort("logout"); } } catch (_) {}
  state.user = null; state.chats = []; state.activeId = null;
  if (els.thread) els.thread.innerHTML = "";
  showToast(state.lang === "ar" ? "انتهت جلستك. الرجاء تسجيل الدخول من جديد." : "Your session expired. Please sign in again.");
  showAuthScreen();
}

/* ----------------------------------------------------------------------------
   Lightweight toast (never-freeze inline feedback)
---------------------------------------------------------------------------- */
let toastTimer = null;
function showToast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 3200);
}

/* ----------------------------------------------------------------------------
   Server-sided chat persistence
---------------------------------------------------------------------------- */
/** Fetch sidebar list [{id,title,updatedAt}]. */
async function fetchChats() {
  try {
    const list = await apiJson("/api/chats");
    state.chats = (Array.isArray(list) ? list : []).map((c) => ({
      id: c.id,
      serverId: c.id,
      title: c.title || t().newChat,
      pinned: !!c.pinned,
      agent: !!c.agent,   // KEEP the product flag — otherwise agent chats land in the normal list after reload
      updatedAt: c.updatedAt ? new Date(c.updatedAt).getTime() : Date.now(),
      messages: null, // lazy-loaded on open
    }));
    state.chatsLoaded = true;
  } catch (err) {
    state.chats = [];
    state.chatsLoaded = true;
    showToast(t().chatsLoadError);
  }
  renderHistory();
}

/** Persist the active chat (title + messages). Optimistic; toast on failure. */
async function persistChat(chat) {
  if (!chat) return;
  // If a create POST is already in flight for this new chat, wait for it first —
  // otherwise a concurrent finalize would fire a SECOND POST and duplicate the
  // conversation in history (the create is the only place serverId gets set).
  if (!chat.serverId && chat._creating) { try { await chat._creating; } catch (_) {} }
  const payload = { title: chat.title, messages: serializeMessages(chat.messages), pinned: !!chat.pinned, agent: !!chat.agent, codeProj: !!chat.codeProj };
  try {
    if (chat.serverId) {
      await apiJson("/api/chats/" + encodeURIComponent(chat.serverId), {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      const create = apiJson("/api/chats", { method: "POST", body: JSON.stringify(payload) });
      chat._creating = create; // guard: concurrent callers await this instead of re-POSTing
      const created = await create;
      if (created && created.id) chat.serverId = created.id;
      chat._creating = null;
    }
  } catch (err) {
    chat._creating = null;
    showToast(t().chatsSaveError);
  }
}

/** Strip transient/UI-only fields before sending to the server. */
function serializeMessages(messages) {
  return (messages || []).map((m) => {
    const out = {
      role: m.role,
      content: m.content,
      tier: m.tier,
      lang: m.lang,
      reasoning: m.reasoning || "",
    };
    if (m.mode) out.mode = m.mode;
    if (m.askAnswered) out.askAnswered = true; // plan-mode choice panel already submitted
    // Keep history lean: persist only small thumbnails, NEVER the full image data.
    if (Array.isArray(m.imageThumbs) && m.imageThumbs.length) {
      out.imageThumbs = m.imageThumbs;
    }
    // Persist attached-file chips (names only) — NOT the extracted fileText (lean history).
    if (Array.isArray(m.files) && m.files.length) {
      out.files = m.files;
    }
    return out;
  });
}

/* ----------------------------------------------------------------------------
   Markdown rendering (marked + DOMPurify + highlight.js when available;
   safe escape-then-format fallback otherwise). ALWAYS sanitized.
---------------------------------------------------------------------------- */
/** Protect LaTeX math spans from the markdown parser. marked would otherwise
    turn \[ \] \( \) into [ ] ( ) and eat _ ^ * inside formulas, so KaTeX never
    gets valid input. We stash each span behind a Private-Use-Area placeholder
    (which markdown leaves untouched) and restore it after sanitizing. */
/** Repair the #1 cause of math rendering as raw red text: UNBALANCED grouping braces
    (e.g. a stray "}" in "\frac{a}{b}}"). Counts { } that are real grouping (ignores the
    escaped literals \{ \}); drops any unmatched closing brace and appends any missing closer.
    Valid LaTeX is already balanced, so this is a no-op for it — it only rescues broken input. */
function balanceTexBraces(tex) {
  let depth = 0, out = "";
  for (let i = 0; i < tex.length; i++) {
    const c = tex[i];
    if (c === "{" && tex[i - 1] !== "\\") { depth++; out += c; }
    else if (c === "}" && tex[i - 1] !== "\\") {
      if (depth === 0) continue;                 // unmatched closing brace → drop it
      depth--; out += c;
    } else out += c;
  }
  if (depth > 0) out += "}".repeat(depth);        // unmatched opening braces → close them
  return out;
}
/** Balance braces INSIDE a math token, keeping its $…$ / $$…$$ / \(…\) / \[…\] delimiters intact
    (so a missing closer is added inside the math, not after the closing delimiter). */
function balanceMathToken(m) {
  const pairs = [["$$", "$$"], ["\\[", "\\]"], ["\\(", "\\)"], ["$", "$"]];
  for (const [l, r] of pairs) {
    if (m.length >= l.length + r.length && m.startsWith(l) && m.endsWith(r)) {
      return l + balanceTexBraces(m.slice(l.length, m.length - r.length)) + r;
    }
  }
  return balanceTexBraces(m);
}
function protectMath(text, store) {
  const stash = (m) => { const i = store.length; store.push(balanceMathToken(m)); return "" + i + ""; };
  let s = String(text);
  s = s.replace(/\$\$[\s\S]+?\$\$/g, stash);     // display $$ ... $$
  s = s.replace(/\\\[[\s\S]+?\\\]/g, stash);     // display \[ ... \]
  s = s.replace(/\\\([\s\S]+?\\\)/g, stash);     // inline  \( ... \)
  // Bare \ce{...} / \pu{...} (chemistry) written OUTSIDE math delimiters → wrap in \(…\) so KaTeX+mhchem
  // renders it AND the later unicode-substitution pass never corrupts \cdot/\times inside it.
  s = s.replace(/\\(?:ce|pu)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, (m) => stash("\\(" + m + "\\)"));
  s = s.replace(/\$(?!\s)[^$]*?[^\s$]\$(?!\d)/g, stash); // inline $ ... $ (allow a newline inside → multiline math not dropped)
  return s;
}

/* Plan-mode: hide the raw `firas-ask` JSON while it streams. We replace the whole
   fenced block — BOTH the complete form (```firas-ask … ```) AND the still-open
   streaming form (```firas-ask … to end-of-text) — with a single placeholder
   token (a distinct PUA pair, separate from protectMath's /) so it
   survives marked + DOMPurify untouched. After sanitizing we swap the token for a
   STATIC, fully-escaped loader element. The user never sees the JSON; on finalize
   decorateFirasAsk replaces the loader with the interactive cards. */
const FIRAS_ASK_TOKEN = String.fromCharCode(0xE010, 0xE011); // unique sentinel, survives marked+DOMPurify
function buildAskLoadingHtml() {
  // Static markup only — no user/model content is interpolated (XSS-safe).
  const label = escapeHtml((t() && t().askPreparing) || "Preparing questions…");
  return (
    '<div class="firas-ask-loading" role="status" aria-live="polite">' +
    '<span class="firas-ask-loading__dots" aria-hidden="true">' +
    '<span></span><span></span><span></span></span>' +
    '<span class="firas-ask-loading__text">' + label + "</span>" +
    "</div>"
  );
}
/** Replace a firas-ask fenced block (closed OR still-streaming/open) with a single
    placeholder token. Returns the masked text. Only the FIRST block is masked. */
function maskFirasAsk(text) {
  let s = String(text);
  if (s.indexOf("firas-ask") === -1) return s;
  // Closed form first: ```firas-ask … ``` (tolerant of leading spaces/CRLF).
  const closed = /```[ \t]*firas-ask[ \t]*\r?\n[\s\S]*?```/i;
  if (closed.test(s)) return s.replace(closed, FIRAS_ASK_TOKEN);
  // Open/streaming form: opening fence with no closing fence yet → to end-of-text.
  const open = /```[ \t]*firas-ask[ \t]*[\s\S]*$/i;
  if (open.test(s)) return s.replace(open, FIRAS_ASK_TOKEN);
  return s;
}

/* File-mode masking — when the user requested a downloadable file (pdf/docx/
   xlsx/pptx), we do NOT dump the document's raw markdown/code into the chat.
   While it streams we show a calm "Creating your file…" loader (same family as
   the firas-ask loader); on finalize the prominent file CARD carries the result,
   with an optional collapsed "view content" disclosure. XSS-safe (static markup). */
function buildFileLoadingHtml(stageLabel) {
  const label = escapeHtml(stageLabel || (t() && t().fileCreating) || "Creating your file…");
  return (
    '<div class="firas-ask-loading firas-file-loading" role="status" aria-live="polite">' +
    '<span class="firas-ask-loading__dots" aria-hidden="true">' +
    '<span></span><span></span><span></span></span>' +
    '<span class="firas-ask-loading__text">' + label + "</span>" +
    "</div>"
  );
}

/** A collapsed "view content" disclosure wrapping the rendered document markdown,
    so the chat shows the file card prominently — not a wall of raw text/code. */
function buildFileDisclosure(content) {
  const details = document.createElement("details");
  details.className = "file-disclosure";
  const summary = document.createElement("summary");
  summary.className = "file-disclosure__summary";
  summary.textContent = (t() && t().fileViewContent) || "View content";
  details.appendChild(summary);
  const md = document.createElement("div");
  md.className = "md file-disclosure__body";
  md.innerHTML = renderMarkdown(content || "", { revealAsk: true });
  decorateMarkdown(md);
  typesetMath(md);
  details.appendChild(md);
  return details;
}

/* ============================================================================
   IMAGE GENERATION — "اصنع لي صورة…" → generate via the keyless /api/image proxy,
   shown in a framed card with a generating effect + a download button.
   ========================================================================== */
function detectImageRequest(text) {
  const s = String(text || "");
  if (!s.trim()) return false;
  // AI image GENERATION is a Firas AI (normal chat) feature ONLY — the Agent never generates
  // images; it fetches REAL web photos for its builds instead.
  if (state.product === "agent" || (activeChat() && activeChat().agent)) return false;
  // A MATH function graph / equation / geometric figure ("ارسم y = …", رسم بياني, دالة, مثلث،
  // sin(x)…) is a chat plot/tikz — NOT an AI image. Never route those to the image generator.
  if (/y\s*=|f\s*\(\s*x\s*\)|رسم\s*بياني|الكراف|الغراف|\bgraph\b|\bplot\b|دال[ةه]|منحن[يى]|\bfunction\b|معادلة|\b(?:sin|cos|tan|cot|sec|csc|exp|log|ln|lg|sqrt|cbrt|arctan|arcsin|arccos|sinh|cosh|tanh)\s*\(|مثلث|\bمربع\b|مستطيل|\bدائرة\b|قطع\s*مكافئ|\bparabola\b|متجه|\bvector\b|إحداثي|احداثي/i.test(s)) return false;
  if (/[?؟]\s*$/.test(s) && !/(اصنع|ارسم|ولّد|ولد|generate|draw|create|make)/i.test(s)) return false;
  const ar = /(اصنع|اعمل|سوّ?ي?(?:لي)?|ارسم|إرسم|ولّ?د|صم[مّ]|اعطني|اعطيني|عطني|اريد|بدي)\s*[^؟?]{0,24}?(صورة|صوره|رسمة|رسمه|لوحة|بوستر|تصميم|خلفية|لوغو|شعار|بورتريه)/i;
  const arDraw = /(^|\s)(ارسم|إرسم)(\s|$)/i;
  // Allow adjectives/words between the verb and the graphic noun, e.g.
  // "create a premium AI brand logo" — the noun need not follow the article.
  const en = /\b(generate|create|make|draw|paint|design|render)\b[^.?!\n]{0,48}?\b(image|picture|photo|drawing|illustration|artwork|logo|logotype|poster|wallpaper|background|portrait|banner|icon|avatar|emblem|mockup|sticker|thumbnail)\b/i;
  return ar.test(s) || arDraw.test(s) || en.test(s);
}

/** Detect a request for Arabic grammatical analysis (إعراب). "أعرب/اعرب/إعراب" mean
    grammatical parsing — distinct from "عرّب" (Arabize) and "العرب" (the Arabs). */
function detectIrabRequest(text) {
  if (!text) return false;
  const s = String(text);
  return /إعراب|اعراب|أعرب|اعرب|أعربها|اعربها|ما\s*(?:هو\s*)?إعراب|حلّل(?:ها)?\s*نحوي|تحليل\s*نحو|نحويًا|نحويا|اعرابي|إعرابي/.test(s);
}

/** Expert-grammarian system prompt: rigorous, fully-vowelled, word-by-word إعراب,
    with extra care for the Quran. Injected for ANY model on an إعراب request. */
function irabSystemPrompt() {
  return [
    "أنت عالِمُ نحوٍ وإعرابٍ خبيرٌ، متقِنٌ لقواعد اللغة العربية إتقانًا تامًّا. عند طلب الإعراب أو التحليل النحوي:",
    "- قسّم النص إلى كلماته كلمةً كلمةً (والأحرفِ إن لزم الأمر)، وأعرِبْ كلَّ كلمة إعرابًا مفصّلًا مضبوطًا.",
    "- لكلِّ كلمة بيّن: نوعَها (اسم/فعل/حرف)، وموقعَها الإعرابي (مبتدأ، خبر، فاعل، نائب فاعل، مفعول به، مضاف إليه، حال، تمييز، اسم/خبر للناسخ، مجرور بحرف الجر، بدل، نعت، معطوف، توكيد...)، وحالتَها (مرفوع/منصوب/مجرور/مجزوم، أو مبني)، وعلامةَ الإعراب (الضمة/الفتحة/الكسرة/السكون، أو العلامات الفرعية: الواو والألف والياء والنون وثبوت النون أو حذفها، ومنع الصرف)، وسببَ ذلك.",
    "- أعرِبِ الجُملَ وأشباهَ الجُمل وبيّن محلَّها من الإعراب (في محل رفع/نصب/جر، أو لا محلَّ لها) مع التعليل.",
    "- انتبه جيدًا للأسماء المبنيّة (أسماء الاستفهام والشرط والموصول والإشارة والضمائر): اذكر أنها مبنيّة على حركتها، ثم بيّن محلَّها من الإعراب بدقّة بحسب موقعها. ومن ذلك أنّ اسم الاستفهام (أو غيره من المبنيّات) إذا وقع مضافًا إليه — يسبقه مضافٌ — كان «مبنيًّا على السكون في محل جرّ بالإضافة»، كما في «ندى مَنْ» و«كتابُ مَنْ هذا؟».",
    "- إن كان النص آيةً من القرآن الكريم فالتزم أقصى الدقّة، واتّبع ما قرّره أئمّةُ النحو في كتب إعراب القرآن، وأشِرْ إلى القراءات إن أثّرت في الإعراب، وإلى تعدّد الأوجه الإعرابية إن وُجِد.",
    "- إن وُجدت في السياق نتائجُ بحثٍ أو مراجعُ لإعراب هذه الجملة فاستند إليها بعد التحقّق من صحّتها ونظّمها بوضوح؛ وإن لم تتوفّر (أو لم يُجدِ البحث) فأعرِبِ الجملة بنفسك وَفق المنهج أعلاه.",
    "- مهم: اعرض الإعراب فقط — لا تذكر أي مصادر أو روابط أو أرقام استشهاد [1][2] ولا قسم \"المصادر\"، ولا تُشِر إلى أنك بحثت في الويب.",
    "- كن صحيحًا مضبوطًا تمامًا ولا تُقدّم إعرابًا خاطئًا؛ وإن لم تتيقّن من وجهٍ فبيّن ذلك بوضوح بدلًا من التخمين.",
    "- رتّب الإجابة بوضوح: اكتب الكلمة ثم إعرابَها سطرًا سطرًا، واضبط الكلماتِ بالشكل (التشكيل)، بعربيةٍ فصحى سليمة.",
  ].join("\n");
}

/** BINDING i'rab overrides — specific sentences the user has verified, so the models
    give the exact, correct parse for them no matter the model. Add more entries here. */
const IRAB_OVERRIDES = [
  {
    test: (s) => /ندى/.test(s) && /اجتذ|اجتد/.test(s) && /م[َِ]?ن/.test(s),
    note: "تنبيهٌ مُلزِمٌ ودقيقٌ — في جملة «ندى مَنْ اجتذى» أعرِبْ كلمة «مَنْ» هكذا بالضبط ولا تخالفه أبدًا: " +
      "«مَنْ»: اسمُ استفهامٍ مبنيٌّ على السكون في محلِّ جرٍّ بالإضافة (لأنه مضافٌ إليه، والمضافُ الذي سبقه هو «ندى»). " +
      "و«ندى»: مضافٌ. و«اجتذى»: فعلٌ ماضٍ. قدّم الإعراب الكامل ملتزمًا بهذا الحكم لكلمة «مَنْ» حرفيًّا، وبلا أيّ مصادر.",
  },
];
/** Return the binding note for a matched sentence, or "". */
function irabOverride(text) {
  const s = String(text || "");
  for (const o of IRAB_OVERRIDES) { try { if (o.test(s)) return o.note; } catch (_) {} }
  return "";
}

function parseImageMeta(content) {
  const m = String(content || "").match(/```firas-image\s*([\s\S]*?)```/i);
  if (!m) return null;
  try { const o = JSON.parse(m[1].trim()); if (o && o.prompt) return o; } catch (_) {}
  return null;
}
function stripImageMetaBlock(s) {
  return String(s == null ? "" : s).replace(/```firas-image\s*[\s\S]*?```/i, "").trim();
}
function imageUrl(meta) {
  const w = meta.w || 1024, h = meta.h || 1024;
  return "/api/image?prompt=" + encodeURIComponent(meta.prompt) + "&w=" + w + "&h=" + h +
    (meta.seed ? "&seed=" + meta.seed : "") +
    (meta.cid ? "&cid=" + encodeURIComponent(meta.cid) : ""); // cid → the daily cap charges once, on success
}
function resolveImageName(meta) {
  const n = String(meta.prompt || "image").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 50) || "firas-image";
  return n + ".png";
}
function buildImageLoadingHtml(lang) {
  const txt = escapeHtml(lang === "ar" ? "يتم توليد الصورة…" : "Generating image…");
  return '<div class="image-card is-loading"><div class="image-card__frame"><div class="image-card__loader">' +
    '<span class="image-card__spin" aria-hidden="true"></span><span class="image-card__loadtext">' + txt + "</span></div></div></div>";
}
/** Build the image result card: framed image (with a generating effect while it
    loads) + a caption + a download button. Re-derives the URL from `meta` so it
    survives reloads. */
function buildImageCard(meta, lang) {
  lang = lang || state.lang;
  const url = imageUrl(meta);
  const ar = lang === "ar";
  const card = document.createElement("div");
  card.className = "image-card is-loading";
  card.innerHTML =
    '<div class="image-card__frame">' +
      '<div class="image-card__loader"><span class="image-card__spin" aria-hidden="true"></span>' +
        '<span class="image-card__loadtext">' + escapeHtml(ar ? "يتم توليد الصورة…" : "Generating image…") + "</span></div>" +
      '<img class="image-card__img" alt="' + escapeHtml(String(meta.prompt).slice(0, 120)) + '" />' +
    "</div>" +
    '<div class="image-card__bar">' +
      '<span class="image-card__cap" dir="auto">' + escapeHtml(String(meta.prompt).slice(0, 80)) + "</span>" +
      '<button type="button" class="image-card__dl" hidden>' + ICONS.download + "<span>" + escapeHtml(ar ? "تحميل" : "Download") + "</span></button>" +
    "</div>";
  const img = card.querySelector(".image-card__img");
  const dl = card.querySelector(".image-card__dl");
  img.addEventListener("load", () => { card.classList.remove("is-loading"); card.classList.add("is-done"); dl.hidden = false; });
  img.addEventListener("error", () => {
    card.classList.remove("is-loading"); card.classList.add("is-error");
    const lt = card.querySelector(".image-card__loadtext"); if (lt) lt.textContent = ar ? "تعذّر توليد الصورة" : "Image generation failed";
  });
  img.src = url;
  dl.addEventListener("click", async (e) => {
    e.stopPropagation();
    try { const r = await fetch(url); const b = await r.blob(); downloadBlob(b, resolveImageName(meta)); }
    catch (_) { window.open(url, "_blank", "noopener"); }
  });
  return card;
}

/** Consume one daily image-creation slot on the server. Returns the quota object
    ({ok, limit, used, remaining}) — `ok:false` (HTTP 429) means the cap is hit.
    Returns null on auth/network/server errors so the caller fails OPEN (the
    downstream engine call still requires login). */
async function fetchImageQuota() {
  try {
    const r = await fetch("/api/image/quota", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    if (r.status === 429) {
      const j = await r.json().catch(() => ({}));
      return Object.assign({ ok: false, reason: "limit", limit: 5, remaining: 0 }, j);
    }
    if (r.status === 401) return { ok: false, reason: "auth" }; // not signed in → block clearly
    if (!r.ok) return null; // other 5xx → don't block here
    return await r.json().catch(() => null);
  } catch (_) { return null; } // network error → don't block
}
// Eastern-Arabic digits (lang-independent — used inside Arabic-branch strings).
function arDigits(n) { return String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]); }
function imageLimitText(lang, q) {
  if (q && q.reason === "auth") {
    return lang === "ar"
      ? "🔒 يجب تسجيل الدخول لإنشاء الصور."
      : "🔒 Please sign in to generate images.";
  }
  const limit = (q && q.limit) || 5;
  return lang === "ar"
    ? `🌙 لقد وصلت إلى الحدّ اليومي لإنشاء الصور (${arDigits(limit)} صور في اليوم). يمكنك إنشاء المزيد غداً.`
    : `🌙 You've reached your daily image limit (${limit} images per day). You can create more tomorrow.`;
}
function imageRemainingText(lang, q) {
  const remaining = q.remaining, limit = q.limit || 5;
  return lang === "ar"
    ? `تم إنشاء الصورة • تبقّى لك ${arDigits(remaining)} من ${arDigits(limit)} اليوم`
    : `Image created • ${remaining} of ${limit} left today`;
}

/** Read-only pre-check of the Max-tier daily cap. Mirrors fetchImageQuota:
    {ok,limit,used,remaining}; ok:false (429) = cap hit; null = fail-open. */
async function fetchMaxQuota() {
  try {
    const r = await fetch("/api/max/quota", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    if (r.status === 429) {
      const j = await r.json().catch(() => ({}));
      return Object.assign({ ok: false, reason: "limit", limit: 10, remaining: 0 }, j);
    }
    if (r.status === 401) return { ok: false, reason: "auth" };
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch (_) { return null; }
}
function maxLimitText(lang, q) {
  if (q && q.reason === "auth") {
    return lang === "ar" ? "🔒 يجب تسجيل الدخول لاستخدام فِراس ماكس." : "🔒 Please sign in to use Firas Max.";
  }
  const limit = (q && q.limit) || 10;
  return lang === "ar"
    ? `👑 لقد وصلت إلى حدّك اليومي من فِراس ماكس (${arDigits(limit)} رسائل في اليوم). استخدم أولترا أو برو الآن، وسيتجدّد ماكس غداً.`
    : `👑 You've reached your daily Firas Max limit (${limit} messages per day). Use Ultra or Pro for now — Max resets tomorrow.`;
}
function maxRemainingText(lang, q) {
  const remaining = q.remaining, limit = q.limit || 10;
  return lang === "ar"
    ? `فِراس ماكس • تبقّى لك ${arDigits(remaining)} من ${arDigits(limit)} اليوم`
    : `Firas Max • ${remaining} of ${limit} left today`;
}

/* ===========================================================================
   CODE DELIVERABLES — raw source streamed live into a code window, then a
   finished card with copy / download / live-preview. Persisted in the message
   content as a ```firas-code {meta}\n<code>\n``` block (survives reload).
   =========================================================================== */
function stripCodeFences(s) {
  let t = String(s == null ? "" : s);
  t = t.replace(/^﻿?\s*```[a-zA-Z0-9_+#-]*[ \t]*\r?\n?/, ""); // leading ```lang
  t = t.replace(/\r?\n?```[ \t]*$/, ""); // trailing ```
  return t;
}
function codeMime(ext) {
  return ({ html: "text/html", css: "text/css", js: "text/javascript",
    py: "text/x-python", json: "application/json", txt: "text/plain",
    cpp: "text/x-c++src", c: "text/x-csrc", java: "text/x-java-source", cs: "text/plain",
    rs: "text/rust", go: "text/x-go", php: "application/x-httpd-php", ts: "text/typescript",
    kt: "text/x-kotlin", swift: "text/x-swift" })[ext] || "text/plain";
}
function codeLineCountText(code, lang) {
  const n = String(code || "").split("\n").length;
  return (lang || state.lang) === "ar" ? arDigits(n) + " سطر" : n + " lines";
}
/** Parse a persisted ```firas-code {json}\n<code>\n``` block. Greedy body match
    anchored to the trailing fence, so code containing backticks still parses. */
function parseCodeMeta(content) {
  const m = String(content || "").match(/^```firas-code[ \t]+(\{[\s\S]*?\})[ \t]*\r?\n([\s\S]*)\r?\n```[ \t]*$/);
  if (!m) return null;
  try { const meta = JSON.parse(m[1]); if (!meta) return null; meta.code = m[2]; return meta; }
  catch (_) { return null; }
}
function stripCodeMetaBlock(s) {
  return String(s == null ? "" : s)
    .replace(/^```firas-code[ \t]+\{[\s\S]*?\}[ \t]*\r?\n[\s\S]*\r?\n```[ \t]*$/, "").trim();
}
/** System prompt forcing raw, complete, single-file source (no fences/prose). */
function codeSystemPrompt(spec) {
  const label = spec.label || "code";
  return [
    "You are an elite senior software engineer. Produce a COMPLETE, production-quality " + label + " deliverable as ONE single self-contained file.",
    "",
    "STRICT OUTPUT RULES:",
    "- Output ONLY the raw " + label + " source code for that one file — nothing else.",
    "- Do NOT wrap the code in Markdown code fences (no triple backticks), and do NOT add any explanation, preamble, or closing remarks.",
    "- Never use placeholders like \"continue here\", \"...\", \"rest of the code\", \"TODO\", or any truncation. Write the ENTIRE file to completion, however long it needs to be.",
    spec.lang === "html"
      ? "- For HTML: put ALL HTML, CSS and JavaScript INSIDE this one file (inline <style> and <script>). Do NOT reference external files or CDN libraries unless the user explicitly asks. No frameworks (Bootstrap/Tailwind/React) unless requested."
      : "- Keep everything in this single file; avoid external dependencies unless the user explicitly asks.",
    spec.lang === "html"
      ? "- BUILD IN ORDER and BUDGET your output so you REACH THE END: <head> + a FOCUSED <style> (only the CSS the sections actually need — do NOT over-expand or pad the CSS), then the COMPLETE <body> with EVERY section, then <script>, then </html>. The document MUST end with </html>. NEVER spend your whole budget on CSS and stop before the <body>."
      : "- Structure the file so it is COMPLETE and ends properly with every block/function closed.",
    "- Write clean, well-organized, professional code with helpful comments and consistent formatting.",
    "- Follow EVERY requirement in the user's request precisely. Prefer more complete over shorter.",
    "- Begin your response immediately with the first character of the code (e.g. <!DOCTYPE html>).",
  ].join("\n");
}
/** Build the code window. While streaming: a "writing…" indicator and no
    buttons. When finished (meta.code set, !streaming): copy/download/preview. */
function buildCodeCard(meta, lang, opts) {
  opts = opts || {};
  const ar = (lang || state.lang) === "ar";
  const streaming = !!opts.streaming;
  const ext = meta.ext || "txt";
  const label = meta.label || ext.toUpperCase();
  const filename = meta.filename || ("code." + ext);
  const card = document.createElement("div");
  card.className = "code-card" + (streaming ? " is-streaming" : "");
  card.dir = "ltr"; // source code is always LTR
  card.dataset.lang = meta.lang || "";
  card.innerHTML =
    '<div class="code-card__head">' +
      '<span class="code-card__dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="code-card__name"></span>' +
      '<span class="code-card__lang"></span>' +
      '<span class="code-card__count"></span>' +
      '<span class="code-card__spacer"></span>' +
      '<div class="code-card__actions"></div>' +
    "</div>" +
    '<div class="code-card__body"><pre><code class="code-card__code"></code></pre></div>' +
    '<div class="code-card__foot" hidden></div>' +
    '<div class="code-card__preview" hidden></div>';
  card.querySelector(".code-card__name").textContent = filename;
  card.querySelector(".code-card__lang").textContent = label;
  const actions = card.querySelector(".code-card__actions");
  if (streaming) {
    const w = document.createElement("span");
    w.className = "code-card__writing";
    w.textContent = ar ? "يكتب الكود…" : "Writing code…";
    actions.appendChild(w);
  } else {
    const code = meta.code != null ? meta.code : "";
    card.querySelector(".code-card__code").textContent = code;
    card.querySelector(".code-card__count").textContent = codeLineCountText(code, lang);
    wireCodeActions(card, meta, lang);
  }
  return card;
}
function wireCodeActions(card, meta, lang) {
  const ar = (lang || state.lang) === "ar";
  const actions = card.querySelector(".code-card__actions");
  const code = meta.code != null ? meta.code : (card.querySelector(".code-card__code").textContent || "");
  const filename = meta.filename || ("code." + (meta.ext || "txt"));
  const isHtml = meta.lang === "html" || /\.html?$/i.test(filename);
  const mkBtn = (icon, text, cls) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "code-card__btn " + cls;
    b.innerHTML = icon + "<span>" + escapeHtml(text) + "</span>";
    return b;
  };
  if (isHtml) {
    const p = mkBtn(ICONS.preview, ar ? "معاينة" : "Preview", "js-preview");
    p.addEventListener("click", () => toggleCodePreview(card, code, ar));
    actions.appendChild(p);
  }
  const c = mkBtn(ICONS.copy, ar ? "نسخ" : "Copy", "js-copy");
  c.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(code); showToast(ar ? "تم نسخ الكود" : "Code copied"); }
    catch (_) { showToast(ar ? "تعذّر النسخ" : "Copy failed"); }
  });
  actions.appendChild(c);
  const d = mkBtn(ICONS.download, ar ? "تحميل" : "Download", "js-dl");
  d.addEventListener("click", () => downloadBlob(new Blob([code], { type: codeMime(meta.ext) }), filename));
  actions.appendChild(d);
  // Continue — resume a file that stopped before finishing (token cap / stream cut /
  // model stop). Appends the missing tail seamlessly to the SAME box. Click again
  // for very long files — there is no length ceiling.
  const k = mkBtn(ICONS.continue, ar ? "كمّل" : "Continue", "js-continue");
  k.addEventListener("click", () => continueCode(card));
  actions.appendChild(k);
  // Also surface Continue as a prominent bar UNDER the code — that's where the eye
  // lands when the code cuts off, and the header buttons may be scrolled away.
  const foot = card.querySelector(".code-card__foot");
  if (foot) {
    foot.hidden = false;
    foot.innerHTML = "";
    const hint = document.createElement("span");
    hint.className = "code-card__foot-hint";
    hint.textContent = ar ? "الكود غير مكتمل؟" : "Code cut off?";
    const kf = mkBtn(ICONS.continue, ar ? "كمّل الكود" : "Continue code", "js-continue code-card__contbtn");
    kf.addEventListener("click", () => continueCode(card));
    foot.appendChild(hint);
    foot.appendChild(kf);
  }
}
/** Toggle a sandboxed live preview of HTML code (scripts run, but isolated from
    our origin — no allow-same-origin, so it can't read our cookies/storage). */
function toggleCodePreview(card, code, ar) {
  const wrap = card.querySelector(".code-card__preview");
  const btnLabel = card.querySelector(".js-preview span");
  if (!wrap) return;
  if (!wrap.hidden) {
    wrap.hidden = true; wrap.innerHTML = "";
    if (btnLabel) btnLabel.textContent = ar ? "معاينة" : "Preview";
    return;
  }
  wrap.innerHTML = "";
  const bar = document.createElement("div");
  bar.className = "code-card__preview-bar";
  const open = document.createElement("button");
  open.type = "button"; open.className = "code-card__btn";
  open.innerHTML = ICONS.external + "<span>" + escapeHtml(ar ? "فتح في تبويب" : "Open in tab") + "</span>";
  open.addEventListener("click", () => {
    try {
      const url = URL.createObjectURL(new Blob([code], { type: "text/html" }));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (_) {}
  });
  bar.appendChild(open);
  const frame = document.createElement("iframe");
  frame.className = "code-card__frame";
  frame.setAttribute("sandbox", "allow-scripts allow-modals allow-popups allow-forms allow-pointer-lock");
  frame.setAttribute("title", "preview");
  frame.srcdoc = code;
  wrap.appendChild(bar);
  wrap.appendChild(frame);
  wrap.hidden = false;
  if (btnLabel) btnLabel.textContent = ar ? "إخفاء" : "Hide";
}
/** Live-render streaming code into the message body (reusing one card so scroll
    position and DOM are preserved frame-to-frame). */
function renderLiveCodeInto(mdEl, raw, spec, lang) {
  let card = mdEl.querySelector(".code-card");
  if (!card) { mdEl.innerHTML = ""; card = buildCodeCard(spec, lang, { streaming: true }); mdEl.appendChild(card); }
  const codeEl = card.querySelector(".code-card__code");
  const body = card.querySelector(".code-card__body");
  const text = stripCodeFences(raw);
  if (codeEl) codeEl.textContent = text;
  const cnt = card.querySelector(".code-card__count");
  if (cnt) cnt.textContent = codeLineCountText(text, lang);
  if (body) body.scrollTop = body.scrollHeight; // follow the newest line
}

/* Normalize an UNFENCED \begin{tikzpicture}…\end{tikzpicture} (some models emit the
   drawing without a ```tikz fence) into a proper ```tikz code block, so it still renders
   as a figure instead of leaking raw LaTeX. Tikz already inside a ``` fence is left alone. */
function normalizeTikz(text) {
  if (!text || String(text).indexOf("tikzpicture") === -1) return text;
  const fences = [];
  let t = String(text).replace(/```[\s\S]*?```/g, (m) => { fences.push(m); return " F" + (fences.length - 1) + " "; });
  t = t.replace(/\\begin\s*\{tikzpicture\}[\s\S]*?\\end\s*\{tikzpicture\}/g, (m) => "\n\n```tikz\n" + m + "\n```\n\n");
  t = t.replace(/ F(\d+) /g, (_, i) => fences[+i]);
  return t;
}

function renderMarkdown(text, opts) {
  text = stripFileMetaBlock(text); // never render the AI's file-metadata block
  text = stripImageMetaBlock(text); // nor the image-generation block
  text = stripCodeMetaBlock(text); // nor the code-deliverable block
  text = normalizeTikz(text); // unfenced \begin{tikzpicture} → ```tikz so it renders as a figure
  if (typeof fixMathBlanks === "function") text = fixMathBlanks(text); // \color{red}{\text{___}} → valid \underline blank (KaTeX-safe)
  if (typeof sanitizeBareLatex === "function") text = sanitizeBareLatex(text); // bare \underline / \cdotp outside math → wrapped/unicode (no raw backslashes)
  const hasMarked = typeof window.marked !== "undefined";
  const hasPurify = typeof window.DOMPurify !== "undefined";

  // Hide any firas-ask block (open or closed) behind a sentinel token BEFORE
  // markdown/math run, so the raw JSON never reaches the DOM. Restored as a
  // static loader after sanitizing. (No-op when no firas-ask block is present.)
  // `opts.revealAsk` skips masking — used to reveal raw content if the block
  // never parsed (so a malformed block can't leave a permanent loader).
  const maskedSrc = opts && opts.revealAsk ? String(text) : maskFirasAsk(text);
  const hasAskLoader = maskedSrc !== String(text);

  // Shield math from markdown first, render after.
  const mathStore = [];
  const src = protectMath(maskedSrc, mathStore);

  let html;
  if (hasMarked) {
    try {
      window.marked.setOptions({ breaks: true, gfm: true });
      html = window.marked.parse(src);
    } catch (_) {
      html = basicFormat(src);
    }
  } else {
    html = basicFormat(src);
  }

  if (hasPurify) {
    html = window.DOMPurify.sanitize(html, {
      ADD_ATTR: ["target"],
      FORBID_TAGS: ["style", "iframe", "form", "input", "script"],
    });
  } else {
    // No sanitizer present: basicFormat already escaped everything; if marked
    // ran without purify, fall back to escaped basic format to stay XSS-safe.
    if (hasMarked) html = basicFormat(src);
  }

  // Restore the original LaTeX (HTML-escaped so the browser keeps it as plain
  // text — KaTeX reads textContent and typesets it after the message finalizes).
  if (mathStore.length) {
    html = html.replace(/(\d+)/g, (_, i) => {
      const raw = mathStore[+i] || "";
      return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    });
  }

  // Swap the firas-ask sentinel for the STATIC loader element (built from escaped
  // text only). Done post-sanitize because the markup is fully trusted/static.
  if (hasAskLoader) {
    html = html.split(FIRAS_ASK_TOKEN).join(buildAskLoadingHtml());
  }
  return html;
}

/** Minimal, fully-escaped markdown fallback (no CDN required, XSS-safe). */
function basicFormat(text) {
  const blocks = [];
  // Fenced code blocks first
  let src = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = blocks.length;
    blocks.push(
      `<pre><code class="language-${escapeHtml(lang || "")}">${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`
    );
    return `B${i}`;
  });
  src = escapeHtml(src);
  // inline code
  src = src.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // bold / italic
  src = src.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  src = src.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  // links
  src = src.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // headings
  src = src.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  src = src.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  src = src.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  // lists
  src = src.replace(/(?:^|\n)((?:[-*] .*(?:\n|$))+)/g, (m, list) => {
    const items = list.trim().split(/\n/).map((l) => `<li>${l.replace(/^[-*]\s+/, "")}</li>`).join("");
    return `\n<ul>${items}</ul>`;
  });
  // paragraphs
  src = src
    .split(/\n{2,}/)
    .map((p) => (/^\s*<(h\d|ul|ol|pre|blockquote)/.test(p.trim()) ? p : `<p>${p.replace(/\n/g, "<br>")}</p>`))
    .join("\n");
  // restore code blocks
  src = src.replace(/B(\d+)/g, (_, i) => blocks[+i]);
  return src;
}

/** Post-process a rendered .md node: wrap code blocks with header + copy, highlight. */
function decorateMarkdown(container) {
  container.querySelectorAll("pre > code").forEach((code) => {
    const pre = code.parentElement;
    if (pre.closest(".code-block")) return;
    if (plotifyCodeBlock(code)) return;   // ```plot → instant SVG function graph (no engine)
    if (tikzifyCodeBlock(code)) return;   // ```tikz → rendered figure (not a code box)

    const langMatch = (code.className || "").match(/language-(\w+)/);
    const lang = langMatch ? langMatch[1] : "code";

    const wrap = document.createElement("div");
    wrap.className = "code-block";
    const head = document.createElement("div");
    head.className = "code-block__head";
    head.innerHTML = `<span class="code-block__lang">${escapeHtml(lang)}</span>`;
    const copyBtn = document.createElement("button");
    copyBtn.className = "code-block__copy";
    copyBtn.type = "button";
    copyBtn.innerHTML = `${ICONS.copy}<span>${t().copyCode}</span>`;
    copyBtn.addEventListener("click", async () => {
      const ok = await copyText(code.textContent);
      copyBtn.innerHTML = `${ok ? ICONS.check : ICONS.copy}<span>${ok ? t().copied : t().copyCode}</span>`;
      if (!ok) showToast(t().copyFailed);
      setTimeout(() => { copyBtn.innerHTML = `${ICONS.copy}<span>${t().copyCode}</span>`; }, 1400);
    });
    // Live HTML preview — only for HTML code blocks (robust detection).
    if (looksLikeHtml(lang, code.textContent)) {
      const previewBtn = document.createElement("button");
      previewBtn.className = "code-block__copy code-preview-btn";
      previewBtn.type = "button";
      previewBtn.innerHTML = `${ICONS.preview}<span>${t().preview}</span>`;
      const codeText = code.textContent; // snapshot the source
      previewBtn.addEventListener("click", () => openHtmlPreview(codeText));
      head.appendChild(previewBtn);
    }

    head.appendChild(copyBtn);

    pre.replaceWith(wrap);
    wrap.appendChild(head);
    wrap.appendChild(pre);

    if (typeof window.hljs !== "undefined") {
      try { window.hljs.highlightElement(code); } catch (_) {}
    }
  });
  // external links open safely
  container.querySelectorAll("a[href^='http']").forEach((a) => {
    a.target = "_blank"; a.rel = "noopener noreferrer";
  });
  scheduleTikz();   // render any ```tikz figures just inserted
}

/** Typeset LaTeX math in a rendered node via KaTeX auto-render. Never throws.
    Runs on already-sanitized DOM. Supports $..$, \(..\), $$..$$, \[..\].
    KaTeX loads via <script defer> — on a slow phone it may not be ready when a message first
    renders. So if it's not loaded yet we QUEUE the node and re-typeset the moment it arrives,
    guaranteeing math renders on EVERY device (not just fast desktops). */
const _mathQueue = [];
let _mathWatching = false;
function _drainMathQueue() {
  const q = _mathQueue.splice(0);
  q.forEach((n) => { if (n && n.isConnected) typesetMath(n); });
}
function typesetMath(node) {
  if (!node) return;
  if (typeof window.renderMathInElement !== "function") {
    _mathQueue.push(node);
    if (!_mathWatching) {
      _mathWatching = true;
      let tries = 0;
      const tick = () => {
        if (typeof window.renderMathInElement === "function") { _mathWatching = false; _drainMathQueue(); }
        else if (++tries < 120) { setTimeout(tick, 150); }   // poll up to ~18s
        else { _mathWatching = false; _mathQueue.length = 0; }
      };
      setTimeout(tick, 120);
    }
    return;
  }
  try {
    window.renderMathInElement(node, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
      strict: false,                 // be lenient (don't error on unicode/spacing edge-cases)
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
    });
  } catch (_) { /* KaTeX unavailable or parse issue — leave text as-is */ }
}

/* ──────────────────────────────────────────────────────────────────────────
   SKETCH FROM LaTeX — render ```tikz blocks into real figures via TikZJax.
   TikZJax compiles TikZ → SVG fully in the browser (WASM). It scans for
   <script type="text/tikz"> when it executes, so we (re)load it whenever new
   pending figures appear. Degrades gracefully: if the engine can't load or a
   picture fails, the original TikZ source falls back to a normal code box.
   The rendered SVG lives in the DOM, so it carries into PDF export for free. */
const TIKZJAX_JS = "https://tikzjax.com/v1/tikzjax.js";
const TIKZJAX_CSS = "https://tikzjax.com/v1/fonts.css";
let tikzLoadFailed = false;
let tikzTimer = null;

/* ══ Instant mini-TikZ → SVG ═══════════════════════════════════════════════════════════════
   Interprets the common EXPLICIT-COORDINATE \draw/\fill/\node/\coordinate/\foreach subset the
   model uses for physics/geometry figures and renders it straight to SVG — instant & reliable
   (like ```plot), no heavy TeX engine. Returns an SVG string, or null on anything it can't
   interpret (relative `right=of` positioning, node anchors like (n.east), arcs, plots…) so the
   caller falls back to TikZJax. */
let tikzSeq = 0;
const TIKZ_COLOR = { black: "#111827", white: "#ffffff", red: "#dc2626", green: "#16a34a",
  blue: "#2563eb", cyan: "#0891b2", magenta: "#c026d3", yellow: "#ca8a04", orange: "#ea7317",
  purple: "#7c3aed", violet: "#7c3aed", brown: "#92400e", pink: "#db2777", teal: "#0d9488",
  lime: "#65a30d", olive: "#6b7d1a", gray: "#6b7280", grey: "#6b7280", lightgray: "#d1d5db",
  darkgray: "#374151", none: "none" };
function tikzHx(h) { h = String(h).replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function tikzMix(a, b, t) { const A = tikzHx(a), B = tikzHx(b); return "#" + [0, 1, 2].map((i) => Math.round(A[i] * t + B[i] * (1 - t)).toString(16).padStart(2, "0")).join(""); }
function tikzColor(spec) {
  spec = String(spec).trim(); if (!spec) return null;
  const p = spec.split("!");
  let base = TIKZ_COLOR[p[0].toLowerCase()]; if (base === undefined) { if (/^[0-9a-fA-F]{6}$/.test(p[0])) base = "#" + p[0]; else return null; }
  if (p.length >= 2 && /^\d+$/.test(p[1])) { const t = Math.max(0, Math.min(100, parseInt(p[1], 10))) / 100; const other = p[2] ? (TIKZ_COLOR[p[2].toLowerCase()] || "#ffffff") : "#ffffff"; return tikzMix(base === "none" ? "#ffffff" : base, other, t); }
  return base;
}
const TIKZ_SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "n": "ⁿ", "i": "ⁱ" };
const TIKZ_SUB = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "a": "ₐ", "e": "ₑ", "x": "ₓ" };
const TIKZ_GREEK = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "µ", nu: "ν", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω", infty: "∞", cdot: "·", times: "×", pm: "±", to: "→", rightarrow: "→", leftarrow: "←", approx: "≈", neq: "≠", leq: "≤", geq: "≥", degree: "°", circ: "∘", prime: "′", ldots: "…" };
function tikzUni(str, map) { return String(str).split("").map((c) => map[c] || c).join(""); }
function tikzLabelText(lbl) {
  let t = String(lbl);
  t = t.replace(/\\displaystyle|\\limits|\\!|\\,|\\;|\\:|\\ /g, " ");
  t = t.replace(/\\(?:mathbf|mathrm|text|textbf|textit|mathit|boldsymbol|vec|hat|bar|overrightarrow)\s*\{([^{}]*)\}/g, "$1");
  t = t.replace(/\$/g, "");
  t = t.replace(/\^\{([^{}]*)\}/g, (m, a) => tikzUni(a, TIKZ_SUP)).replace(/\^(\S)/g, (m, a) => tikzUni(a, TIKZ_SUP));
  t = t.replace(/_\{([^{}]*)\}/g, (m, a) => tikzUni(a, TIKZ_SUB)).replace(/_(\S)/g, (m, a) => tikzUni(a, TIKZ_SUB));
  t = t.replace(/\\([a-zA-Z]+)/g, (m, n) => (TIKZ_GREEK[n] !== undefined ? TIKZ_GREEK[n] : n));
  return t.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}
function tikzBalanced(s, i) { if (s[i] !== "{") return null; let d = 0, j = i; for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}") { d--; if (d === 0) return { inner: s.slice(i + 1, j), end: j + 1 }; } } return null; }
function tikzExpandList(str) {
  const raw = str.split(",").map((s) => s.trim()).filter((s) => s !== "");
  const di = raw.indexOf("...");
  if (di <= 0 || di >= raw.length - 1) return raw;
  const before = raw.slice(0, di), b = parseFloat(raw[di + 1]), a = parseFloat(before[before.length - 1]);
  const step = before.length >= 2 ? (a - parseFloat(before[before.length - 2])) : (a <= b ? 1 : -1);
  const list = before.slice();
  if (step) for (let v = a + step; step > 0 ? v <= b + 1e-9 : v >= b - 1e-9; v += step) list.push(String(+v.toFixed(6)));
  return list;
}
function tikzExpandForeach(body, depth) {
  depth = depth || 0; if (depth > 8) return body;
  const idx = body.search(/\\foreach\b/); if (idx < 0) return body;
  const head = /\\foreach\s*\\(\w+)\s*(?:\[[^\]]*\])?\s*in\s*\{([^{}]*)\}\s*/.exec(body.slice(idx));
  if (!head) return body;
  let bstart = idx + head.index + head[0].length, loopBody, after;
  if (body[bstart] === "{") { const bal = tikzBalanced(body, bstart); if (!bal) return body; loopBody = bal.inner; after = bal.end; }
  else { const semi = body.indexOf(";", bstart); if (semi < 0) return body; loopBody = body.slice(bstart, semi + 1); after = semi + 1; }
  const items = tikzExpandList(head[2]);
  const expanded = items.map((v) => loopBody.replace(new RegExp("\\\\" + head[1] + "(?![a-zA-Z])", "g"), v)).join("\n");
  return tikzExpandForeach(body.slice(0, idx) + expanded + body.slice(after), depth + 1);
}
function tikzSplitStatements(body) {
  const out = []; let cur = "", d = 0;
  for (let i = 0; i < body.length; i++) { const c = body[i]; if (c === "{" || c === "[" || c === "(") d++; else if (c === "}" || c === "]" || c === ")") d = Math.max(0, d - 1); if (c === ";" && d === 0) { out.push(cur); cur = ""; } else cur += c; }
  if (cur.trim()) out.push(cur); return out;
}
function tikzCoord(inner, coords) {
  inner = String(inner).trim(); if (coords[inner]) return coords[inner].slice();
  const p = inner.split(",");
  if (p.length >= 2) {
    const ev = (t) => { t = String(t).trim(); if (/^-?[\d.]+$/.test(t)) return parseFloat(t); const fn = (typeof compilePlotExpr === "function") ? compilePlotExpr(t) : null; return fn ? fn(0) : parseFloat(t); };
    const x = ev(p[0]), y = ev(p[1]);
    if (isFinite(x) && isFinite(y)) return [x, y];
  }
  return null;
}
function tikzLen(s) { const m = String(s).match(/(-?[\d.]+)\s*(pt|cm|mm|em|ex)?/); if (!m) return null; let v = parseFloat(m[1]); const u = m[2] || "cm"; if (u === "pt") v /= 28.45; else if (u === "mm") v /= 10; else if (u === "em" || u === "ex") v *= 0.35; return v; }
function tikzOptsStyle(opts, cmd) {
  const o = String(opts || ""); const st = { stroke: "#111827", width: 1.2, fill: "none", dash: "", mS: false, mE: false };
  if (cmd === "fill") { st.fill = "#111827"; st.stroke = "none"; }
  if (/<->|<\s*->/.test(o)) { st.mS = true; st.mE = true; } else { if (/->/.test(o)) st.mE = true; if (/<-/.test(o)) st.mS = true; }
  if (/ultra thick/.test(o)) st.width = 2.6; else if (/very thick/.test(o)) st.width = 2; else if (/\bthick\b/.test(o)) st.width = 1.7; else if (/very thin/.test(o)) st.width = 0.5; else if (/\bthin\b/.test(o)) st.width = 0.7;
  const lw = o.match(/line width\s*=\s*([\d.]+)\s*pt/); if (lw) st.width = parseFloat(lw[1]) * 1.1;
  if (/dashed/.test(o)) st.dash = "6,4"; else if (/dotted/.test(o)) st.dash = "1.5,3";
  const fm = o.match(/fill\s*=\s*([a-zA-Z]+(?:!\d+(?:!\w+)?)?|[0-9a-fA-F]{6})/); if (fm) { const c = tikzColor(fm[1]); if (c) st.fill = c; }
  const dm = o.match(/draw\s*=\s*([a-zA-Z]+(?:!\d+)?|[0-9a-fA-F]{6})/); if (dm) { const c = tikzColor(dm[1]); if (c) st.stroke = c; }
  o.split(",").map((w) => w.trim()).forEach((w) => { if (w && !/=/.test(w) && TIKZ_COLOR[w.toLowerCase()] !== undefined) st.stroke = tikzColor(w); });
  return st;
}
function tikzParseCoordinate(st, coords) { const m = st.match(/\\coordinate\s*(?:\[[^\]]*\])?\s*\(([^)]+)\)\s*at\s*\(([^)]+)\)/); if (!m) return false; const p = tikzCoord(m[2], coords); if (!p) return false; coords[m[1].trim()] = p; return true; }
function tikzParsePath(st, coords, els, addPt) {
  const cmd = (st.match(/^\\(\w+)/) || [])[1]; let s = st.replace(/^\\\w+/, ""); let opts = "";
  const om = s.match(/^\s*\[([^\]]*)\]/); if (om) { opts = om[1]; s = s.slice(om[0].length); }
  const style = tikzOptsStyle(opts, cmd);
  let i = 0, cur = null, prev = null, start = null, rel = false;
  const skip = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const paren = () => { let d = 0, j = i; for (; j < s.length; j++) { if (s[j] === "(") d++; else if (s[j] === ")") { d--; if (d === 0) { j++; break; } } } const inner = s.slice(i + 1, j - 1); i = j; return inner; };
  const brace = () => { let d = 0, j = i; for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}") { d--; if (d === 0) { j++; break; } } } const inner = s.slice(i + 1, j - 1); i = j; return inner; };
  const bracket = () => { const j = s.indexOf("]", i); const inner = s.slice(i + 1, j); i = j + 1; return inner; };
  const segs = [];
  while (i < s.length) {
    skip(); if (i >= s.length || s[i] === ";") break;
    if (s[i] === "+") { rel = true; i++; if (s[i] === "+") i++; skip(); continue; }
    if (s[i] === "(") { let p = tikzCoord(paren(), coords); if (!p) return false; if (rel && cur) { p = [cur[0] + p[0], cur[1] + p[1]]; } rel = false; prev = cur; cur = p; if (!start) start = p; addPt(p[0], p[1]); segs.push({ t: segs.length ? "L" : "M", p }); continue; }
    if (s.startsWith("--", i)) { i += 2; continue; }
    if (s.startsWith("..", i)) {
      i += 2; skip(); let c1 = null, c2 = null;
      if (s.startsWith("controls", i)) { i += 8; skip(); if (s[i] === "(") c1 = tikzCoord(paren(), coords); skip(); if (s.startsWith("and", i)) { i += 3; skip(); if (s[i] === "(") c2 = tikzCoord(paren(), coords); } }
      skip(); if (s.startsWith("..", i)) { i += 2; skip(); }
      if (s[i] !== "(") return false; const p = tikzCoord(paren(), coords); if (!p || !cur) return false;
      const cc1 = c1 || cur, cc2 = c2 || c1 || p; addPt(p[0], p[1]); addPt(cc1[0], cc1[1]); addPt(cc2[0], cc2[1]);
      segs.push({ t: "C", p, c1: cc1, c2: cc2 }); prev = cur; cur = p; continue;
    }
    if (s.startsWith("cycle", i)) { i += 5; if (start) segs.push({ t: "L", p: start }); continue; }
    if (s.startsWith("circle", i)) { i += 6; skip(); let r = null; if (s[i] === "(") r = tikzLen(paren()); else if (s[i] === "[") { const b = bracket(); const rm = b.match(/radius\s*=\s*([\d.a-z]+)/); if (rm) r = tikzLen(rm[1]); } if (r == null || !cur) return false; els.push({ kind: "circle", c: cur, r, style }); addPt(cur[0] - r, cur[1] - r); addPt(cur[0] + r, cur[1] + r); continue; }
    if (s.startsWith("ellipse", i)) { i += 7; skip(); if (s[i] !== "(") return false; const inner = paren(); const em = inner.match(/([\d.]+\s*[a-z]*)\s*and\s*([\d.]+\s*[a-z]*)/i); if (!em || !cur) return false; const rx = tikzLen(em[1]), ry = tikzLen(em[2]); els.push({ kind: "ellipse", c: cur, rx, ry, style }); addPt(cur[0] - rx, cur[1] - ry); addPt(cur[0] + rx, cur[1] + ry); continue; }
    if (s.startsWith("rectangle", i)) { i += 9; skip(); if (s[i] !== "(") return false; const p2 = tikzCoord(paren(), coords); if (!p2 || !cur) return false; els.push({ kind: "rect", a: cur, b: p2, style }); addPt(p2[0], p2[1]); prev = cur; cur = p2; continue; }
    if (/^to\s*\[/.test(s.slice(i))) { const t0 = /^to\s*\[/.exec(s.slice(i))[0]; i += t0.length - 1; const topts = bracket(); skip(); const bp = (s[i] === "(") ? tikzCoord(paren(), coords) : null; if (!bp || !cur) return false; const tm = topts.match(/^\s*([A-Za-z][A-Za-z ]*?)\s*(?:=|,|\]|$)/); const type = (tm ? tm[1] : "short").trim().toLowerCase(); const lm = topts.match(/=\s*(\$[^$]*\$|[^,\]]+)/); els.push({ kind: "component", a: cur, b: bp, type, label: lm ? lm[1].trim() : "", style }); addPt(bp[0], bp[1]); prev = cur; cur = bp; continue; }
    if (s.startsWith("node", i)) { i += 4; skip(); let nopts = ""; if (s[i] === "[") nopts = bracket(); skip(); if (s[i] === "(") { paren(); skip(); } if (s[i] === "{") { const txt = brace(); els.push({ kind: "node", at: cur, opts: nopts, text: txt, seg: { a: prev, b: cur } }); } continue; }
    return false;
  }
  if (segs.length >= 2) els.unshift({ kind: "path", segs, style });
  return true;
}
function tikzParseNode(st, coords, els, addPt) {
  const m = st.match(/^\\node\s*(?:\[([^\]]*)\])?\s*(?:\(([^)]*)\)\s*)?(?:at\s*\(([^)]+)\))?\s*\{([\s\S]*)\}\s*$/);
  if (!m) return false;
  const opts = m[1] || "", at = m[3] ? tikzCoord(m[3], coords) : (m[2] && coords[m[2].trim()] ? coords[m[2].trim()] : null);
  if (!at) return false;
  addPt(at[0], at[1]);
  els.push({ kind: "node", at, opts, text: m[4], seg: null });
  return true;
}
/* Draw a circuitikz component (\draw (a) to[R=$R$] (b)) — the wire, the component symbol rotated to
   the a→b direction, and an upright label above it. Handles R / C / L / battery / diode / switch. */
function tikzEmitComponent(e, sx, sy) {
  const ax = sx(e.a[0]), ay = sy(e.a[1]), bx = sx(e.b[0]), by = sy(e.b[1]);
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy); if (len < 1) return "";
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const S = e.style || {}, col = S.stroke || "#111827", w = S.width || 1.4;
  const L = (x1, y1, x2, y2) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const t = e.type; let inner = "";
  if (/^(r|resistor|european resistor|generic|vr|variable resistor)$/.test(t)) { const a = len * 0.32, b = len * 0.68, h = 6; inner = L(0, 0, a, 0) + `<rect x="${a.toFixed(1)}" y="${-h}" width="${(b - a).toFixed(1)}" height="${2 * h}" fill="none" stroke="${col}" stroke-width="${w}"/>` + L(b, 0, len, 0); }
  else if (/^(c|capacitor|ec|capacitor1)$/.test(t)) { const a = len / 2 - 3.5, b = len / 2 + 3.5, h = 8; inner = L(0, 0, a, 0) + L(a, -h, a, h) + L(b, -h, b, h) + L(b, 0, len, 0); }
  else if (/^(l|inductor|cute inductor|american inductor)$/.test(t)) { const a = len * 0.28, b = len * 0.72, seg = (b - a) / 4, r = seg / 2; let d = `M${a.toFixed(1)} 0`; for (let k = 0; k < 4; k++) d += ` A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(a + (k + 1) * seg).toFixed(1)} 0`; inner = L(0, 0, a, 0) + `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"/>` + L(b, 0, len, 0); }
  else if (/^(battery|batt|v|voltage|vsource|battery1|american voltage source)$/.test(t)) { const a = len / 2 - 4; inner = L(0, 0, a, 0) + L(a, -9, a, 9) + L(a + 6, -5, a + 6, 5) + L(a + 6, 0, len, 0); }
  else if (/^(d|diode|empty diode|full diode)$/.test(t)) { const a = len * 0.36, b = len * 0.64, h = 7; inner = L(0, 0, a, 0) + `<path d="M${a.toFixed(1)} ${-h}L${b.toFixed(1)} 0L${a.toFixed(1)} ${h}z" fill="none" stroke="${col}" stroke-width="${w}"/>` + L(b, -h, b, h) + L(b, 0, len, 0); }
  else if (/^(switch|spst|cspst|nos|nc)$/.test(t)) { const a = len * 0.35, b = len * 0.65; inner = L(0, 0, a, 0) + `<circle cx="${a.toFixed(1)}" cy="0" r="1.8" fill="${col}"/>` + L(a, 0, b, -7) + `<circle cx="${b.toFixed(1)}" cy="0" r="1.8" fill="${col}"/>` + L(b, 0, len, 0); }
  else { inner = L(0, 0, len, 0); }
  let lbl = "";
  if (e.label) { const mx = (ax + bx) / 2, my = (ay + by) / 2; let px = -dy / len, py = dx / len; if (py > 0) { px = -px; py = -py; } lbl = `<text x="${(mx + px * 14).toFixed(1)}" y="${(my + py * 14 + 3).toFixed(1)}" text-anchor="middle" class="tikz-lbl">${escapeHtml(tikzLabelText(e.label))}</text>`; }
  return `<g transform="translate(${ax.toFixed(1)} ${ay.toFixed(1)}) rotate(${ang.toFixed(1)})">${inner}</g>` + lbl;
}
function tikzEmit(e, sx, sy, PX, id) {
  if (e.kind === "component") return tikzEmitComponent(e, sx, sy);
  const S = e.style || {};
  const attr = (s) => `stroke="${s.stroke}" stroke-width="${s.width}" fill="${s.fill}"` + (s.dash ? ` stroke-dasharray="${s.dash}"` : "") + (s.mE ? ` marker-end="url(#${id}e)"` : "") + (s.mS ? ` marker-start="url(#${id}s)"` : "");
  if (e.kind === "path") { const d = e.segs.map((g) => g.t === "C" ? `C${sx(g.c1[0]).toFixed(1)} ${sy(g.c1[1]).toFixed(1)} ${sx(g.c2[0]).toFixed(1)} ${sy(g.c2[1]).toFixed(1)} ${sx(g.p[0]).toFixed(1)} ${sy(g.p[1]).toFixed(1)}` : g.t + sx(g.p[0]).toFixed(1) + " " + sy(g.p[1]).toFixed(1)).join(" "); return `<path d="${d}" ${attr(S)} stroke-linecap="round" stroke-linejoin="round"/>`; }
  if (e.kind === "circle") return `<circle cx="${sx(e.c[0]).toFixed(1)}" cy="${sy(e.c[1]).toFixed(1)}" r="${(e.r * PX).toFixed(1)}" ${attr(S)}/>`;
  if (e.kind === "ellipse") return `<ellipse cx="${sx(e.c[0]).toFixed(1)}" cy="${sy(e.c[1]).toFixed(1)}" rx="${(e.rx * PX).toFixed(1)}" ry="${(e.ry * PX).toFixed(1)}" ${attr(S)}/>`;
  if (e.kind === "rect") { const x = Math.min(sx(e.a[0]), sx(e.b[0])), y = Math.min(sy(e.a[1]), sy(e.b[1])), w = Math.abs(sx(e.b[0]) - sx(e.a[0])), h = Math.abs(sy(e.b[1]) - sy(e.a[1])); return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" ${attr(S)}/>`; }
  if (e.kind === "node") {
    const o = e.opts || "";
    if (/\bground\b/.test(o)) { const gx = sx(e.at[0]), gy = sy(e.at[1]); const GL = (a1, b1, a2, b2) => `<line x1="${a1.toFixed(1)}" y1="${b1.toFixed(1)}" x2="${a2.toFixed(1)}" y2="${b2.toFixed(1)}" stroke="#111827" stroke-width="1.5"/>`; return GL(gx, gy, gx, gy + 3) + GL(gx - 8, gy + 3, gx + 8, gy + 3) + GL(gx - 5, gy + 6, gx + 5, gy + 6) + GL(gx - 2.5, gy + 9, gx + 2.5, gy + 9); }
    let at = e.at;
    if (/midway|pos\s*=|near/.test(o) && e.seg && e.seg.a && e.seg.b) at = [(e.seg.a[0] + e.seg.b[0]) / 2, (e.seg.a[1] + e.seg.b[1]) / 2];
    let x = sx(at[0]), y = sy(at[1]) + 4, anc = "middle";
    if (/above/.test(o)) y -= 13; if (/below/.test(o)) y += 12;
    if (/right/.test(o)) { x += 8; anc = "start"; } if (/left/.test(o)) { x -= 8; anc = "end"; }
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anc}" class="tikz-lbl">${escapeHtml(tikzLabelText(e.text))}</text>`;
  }
  return "";
}
function renderTikzToSvg(raw) {
  try {
    const M = String(raw).match(/\\begin\{tikzpicture\}\s*(\[[^\]]*\])?([\s\S]*?)\\end\{tikzpicture\}/);
    let gOpts = "", body;
    if (M) { gOpts = M[1] || ""; body = M[2]; } else { body = String(raw); }
    body = body.replace(/(^|[^\\])%[^\n]*/g, "$1");
    const scale = parseFloat((gOpts.match(/scale\s*=\s*([\d.]+)/) || [])[1]) || 1;
    body = tikzExpandForeach(body);
    // Bail on features we don't interpret → TikZJax fallback.
    if (/\\begin\{/.test(body)) return null;
    if (/=\s*[\d.]+\s*(?:cm|pt|mm)?\s+of\s+/.test(body)) return null;      // right=1cm of X
    if (/\)\s*\.\s*(?:east|west|north|south|center|anchor)/i.test(body)) return null; // node anchors
    if (/\barc\b|\bplot\b|\bgrid\b|\\path|\\clip|\\shade|pic\s*\{/.test(body)) return null;
    const coords = Object.create(null), els = [], pts = [];
    const addPt = (x, y) => { if (isFinite(x) && isFinite(y)) pts.push([x, y]); };
    for (let st of tikzSplitStatements(body)) {
      st = st.trim(); if (!st) continue;
      if (/^\\coordinate\b/.test(st)) { if (!tikzParseCoordinate(st, coords)) return null; continue; }
      if (/^\\(draw|fill|filldraw)\b/.test(st)) { if (!tikzParsePath(st, coords, els, addPt)) return null; continue; }
      if (/^\\node\b/.test(st)) { if (!tikzParseNode(st, coords, els, addPt)) return null; continue; }
      if (/^\\(useasboundingbox|def|tikzset|pgfmath)/.test(st)) continue;
      if (/^\\/.test(st)) return null;
    }
    if (!els.length || !pts.length) return null;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    pts.forEach((p) => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
    if (!(maxX > minX)) maxX = minX + 1; if (!(maxY > minY)) maxY = minY + 1;
    const PX = 42 * scale, pad = 22;
    const W = (maxX - minX) * PX + pad * 2, H = (maxY - minY) * PX + pad * 2;
    if (W > 6000 || H > 6000 || W < 8 || H < 8) return null;
    const sx = (x) => pad + (x - minX) * PX, sy = (y) => pad + (maxY - y) * PX;
    const id = "tk" + (tikzSeq++);
    let g = ""; els.forEach((e) => { g += tikzEmit(e, sx, sy, PX, id); });
    const mk = (mid, rev) => `<marker id="${mid}" viewBox="0 0 10 10" refX="${rev ? 1 : 9}" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="${rev ? "M10 0L0 5L10 10z" : "M0 0L10 5L0 10z"}" fill="context-stroke"/></marker>`;
    return `<svg viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" class="tikz-svg" role="img">` +
      `<defs><marker id="${id}e" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker>` +
      `<marker id="${id}s" viewBox="0 0 10 10" refX="1.5" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M10 0L0 5L10 10z"/></marker></defs>` + g + `</svg>`;
  } catch (_) { return null; }
}

function looksLikeTikz(lang, src) {
  if (/^tikz(picture)?$/i.test(lang)) return true;
  if (/^(tex|latex)$/i.test(lang) && /\\begin\s*\{tikzpicture\}/.test(src || "")) return true;
  return false;
}

/* Convert a <pre><code> TikZ block into a pending <figure>. Returns true if handled. */
function tikzifyCodeBlock(code) {
  if (!code || code.hasAttribute("data-tikz-skip")) return false;
  const pre = code.parentElement;
  const lang = ((code.className || "").match(/language-([\w-]+)/) || [])[1] || "";
  const src = code.textContent || "";
  if (!pre || !looksLikeTikz(lang, src)) return false;
  const body = /\\begin\s*\{tikzpicture\}/.test(src)
    ? src
    : "\\begin{tikzpicture}\n" + src + "\n\\end{tikzpicture}";
  // Try OUR instant mini-TikZ renderer first — zero delay, no engine. Only falls back to the heavy
  // TikZJax engine when it meets something our renderer can't interpret.
  const fastSvg = renderTikzToSvg(body);
  if (fastSvg) {
    // An EMPTY PLACEHOLDER (one bare shape, no labels — the model "drew" just a frame) is worse
    // than no figure: drop the block entirely instead of showing an empty box in the document.
    const drawn = fastSvg.slice(fastSvg.indexOf("</defs>"));   // skip arrow-marker defs
    const shapeCount = (drawn.match(/<(rect|circle|ellipse|path|line)\b/g) || []).length;
    const textCount = (drawn.match(/<text\b/g) || []).length;
    if (shapeCount <= 1 && textCount === 0) { pre.remove(); return true; }
    const figFast = document.createElement("figure");
    figFast.className = "tikz-figure";
    figFast.innerHTML = fastSvg;
    pre.replaceWith(figFast);
    return true;
  }
  const fig = document.createElement("figure");
  fig.className = "tikz-figure";
  fig.setAttribute("data-tikz-pending", "1");
  fig.setAttribute("data-tikz-src", src);
  const spin = document.createElement("div");
  spin.className = "tikz-figure__spin";
  spin.textContent = "◌";
  const script = document.createElement("script");
  script.type = "text/tikz";
  script.textContent = body;
  fig.appendChild(spin);
  fig.appendChild(script);
  pre.replaceWith(fig);
  if (tikzLoadFailed) tikzFallback(fig);
  else watchTikzFigure(fig);
  return true;
}

/* Engine failed / timed out → show the source as a plain code box (nothing lost). */
function tikzFallback(fig) {
  if (!fig || !fig.parentNode) return;
  const src = fig.getAttribute("data-tikz-src") || "";
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = "language-tikz";
  code.setAttribute("data-tikz-skip", "1");   // don't re-tikzify on a later decorate pass
  code.textContent = src;
  pre.appendChild(code);
  fig.replaceWith(pre);
}

/* Resolve a figure when its SVG appears; fall back on timeout. */
function watchTikzFigure(fig) {
  let done = false;
  const finish = (ok) => {
    if (done) return; done = true;
    try { obs.disconnect(); } catch (_) {}
    clearTimeout(to);
    if (ok) {
      fig.removeAttribute("data-tikz-pending");
      const s = fig.querySelector(".tikz-figure__spin"); if (s) s.remove();
    } else {
      tikzFallback(fig);
    }
  };
  const obs = new MutationObserver(() => { if (fig.querySelector("svg")) finish(true); });
  obs.observe(fig, { childList: true, subtree: true });
  const to = setTimeout(() => finish(!!fig.querySelector("svg")), 60000);  // first load pulls a few-MB TeX core
  if (fig.querySelector("svg")) finish(true);
}

/* Render any pending <script type="text/tikz">. TikZJax gates its own processing
   on window.onload — which fires only ONCE, at initial page load — so for figures
   added dynamically later we load the engine ONCE, capture that processing function,
   and invoke it ourselves for every new batch. The captured fn re-scans the DOM and
   reuses the already-loaded WASM, so repeat calls are cheap. Debounced. */
let tikzProcess = null;   // captured TikZJax processing fn
let tikzLoading = false;
function scheduleTikz() {
  if (tikzLoadFailed) return;
  if (!document.querySelector('.tikz-figure[data-tikz-pending] script[type="text/tikz"]')) return;
  if (tikzTimer) clearTimeout(tikzTimer);
  tikzTimer = setTimeout(runTikz, 120);
}
function runTikz() {
  if (tikzProcess) { try { tikzProcess(); } catch (_) {} return; }
  if (tikzLoading) return;
  tikzLoading = true;
  if (!document.getElementById("tikzjax-css")) {
    const l = document.createElement("link");
    l.id = "tikzjax-css"; l.rel = "stylesheet"; l.href = TIKZJAX_CSS;
    document.head.appendChild(l);
  }
  const s = document.createElement("script");
  s.id = "tikzjax-js"; s.src = TIKZJAX_JS; s.async = true;
  s.onload = () => {
    tikzLoading = false;
    // TikZJax assigns its processor to window.onload on execution; capture & run it.
    if (typeof window.onload === "function") {
      tikzProcess = window.onload;
      try { tikzProcess(); } catch (_) {}
    } else {
      tikzLoadFailed = true;
      document.querySelectorAll(".tikz-figure[data-tikz-pending]").forEach(tikzFallback);
    }
  };
  s.onerror = () => {
    tikzLoading = false;
    tikzLoadFailed = true;
    document.querySelectorAll(".tikz-figure[data-tikz-pending]").forEach(tikzFallback);
  };
  document.body.appendChild(s);
}

/* Wait until no TikZ figure is still pending (called before exporting a file/PDF). */
function tikzReady(timeoutMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      if (!document.querySelector(".tikz-figure[data-tikz-pending]")) return resolve();
      if (Date.now() - t0 > (timeoutMs || 8000)) return resolve();
      setTimeout(tick, 150);
    };
    tick();
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   INSTANT FUNCTION GRAPHS — render a ```plot block to an SVG SYNCHRONOUSLY (no engine,
   no network, no delay; it draws the moment the message appears). Block body = one or
   more `y = <expr>` lines + an optional `domain: a..b`. Built so "graph this function"
   never waits on the heavy TeX engine. */
function compilePlotExpr(src) {
  const F = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos,
    atan: Math.atan, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, tg: Math.tan,
    cot: (v) => 1 / Math.tan(v), cotan: (v) => 1 / Math.tan(v), ctg: (v) => 1 / Math.tan(v),
    sec: (v) => 1 / Math.cos(v), csc: (v) => 1 / Math.sin(v), cosec: (v) => 1 / Math.sin(v),
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh,
    atanh: Math.atanh, exp: Math.exp, ln: Math.log, log: (v) => Math.log(v) / Math.LN10,
    lg: (v) => Math.log(v) / Math.LN10, log2: (v) => Math.log(v) / Math.LN2, log10: (v) => Math.log(v) / Math.LN10,
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sign: Math.sign, floor: Math.floor,
    ceil: Math.ceil, round: Math.round };
  const C = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };
  const VAR = (arguments[1] || "x").toLowerCase();   // free variable: x (default), theta (polar), t (parametric)
  let s = String(src).replace(/\s+/g, "").toLowerCase();
  if (!s) return null;
  // Only normalize the power operator; implicit multiplication (2x, x(x+1), 2sin(x), )( …) is handled
  // in the parser below — a regex that inserts `*` around the variable would corrupt function names
  // that CONTAIN the variable letter (exp→ex*p, and for t: tan/sqrt/atan…), breaking those graphs.
  s = s.replace(/\*\*/g, "^");
  let i = 0;
  function expr() { let a = term(); while (s[i] === "+" || s[i] === "-") { const o = s[i++], b = term(), A = a, B = b; a = o === "+" ? (x) => A(x) + B(x) : (x) => A(x) - B(x); } return a; }
  function term() {
    let a = unary();
    while (i < s.length) {
      if (s[i] === "*" || s[i] === "/") { const o = s[i++], b = unary(), A = a, B = b; a = o === "*" ? (x) => A(x) * B(x) : (x) => A(x) / B(x); }
      else if (/[0-9.a-z(]/.test(s[i])) { const b = unary(), A = a, B = b; a = (x) => A(x) * B(x); }   // implicit multiplication
      else break;
    }
    return a;
  }
  function unary() { if (s[i] === "-") { i++; const A = unary(); return (x) => -A(x); } if (s[i] === "+") { i++; return unary(); } return power(); }
  function power() { const a = atom(); if (s[i] === "^") { i++; const b = unary(), A = a, B = b; return (x) => Math.pow(A(x), B(x)); } return a; }
  function atom() {
    if (s[i] === "(") { i++; const e = expr(); if (s[i] !== ")") throw 0; i++; return e; }
    let m = /^[0-9]*\.?[0-9]+/.exec(s.slice(i));
    if (m) { i += m[0].length; const v = parseFloat(m[0]); return () => v; }
    m = /^[a-z_][a-z0-9_]*/.exec(s.slice(i));
    if (m) {
      const n = m[0]; i += n.length;
      if (n === VAR) return (x) => x;
      if (Object.prototype.hasOwnProperty.call(C, n)) { const v = C[n]; return () => v; }
      if (Object.prototype.hasOwnProperty.call(F, n)) { if (s[i] !== "(") throw 0; i++; const a = expr(); if (s[i] !== ")") throw 0; i++; const f = F[n], A = a; return (x) => f(A(x)); }
      throw 0;
    }
    throw 0;
  }
  try { const fn = expr(); if (i !== s.length) return null; const v = fn(0.5); if (typeof v !== "number") return null; return fn; }
  catch (_) { return null; }
}

/* Compile a TWO-variable expression z = f(x,y) → (x,y)=>value. Powers the 3D surface plot. */
function compilePlot2(src) {
  const F = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    exp: Math.exp, ln: Math.log, log: (v) => Math.log(v) / Math.LN10, log2: (v) => Math.log(v) / Math.LN2,
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sign: Math.sign, floor: Math.floor, ceil: Math.ceil, round: Math.round };
  const C = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };
  let s = String(src).replace(/\s+/g, "").toLowerCase();
  if (!s) return null;
  s = s.replace(/\*\*/g, "^");   // implicit multiplication handled in the parser (regex would corrupt exp/max…)
  let i = 0;
  function expr() { let a = term(); while (s[i] === "+" || s[i] === "-") { const o = s[i++], b = term(), A = a, B = b; a = o === "+" ? (x, y) => A(x, y) + B(x, y) : (x, y) => A(x, y) - B(x, y); } return a; }
  function term() {
    let a = unary();
    while (i < s.length) {
      if (s[i] === "*" || s[i] === "/") { const o = s[i++], b = unary(), A = a, B = b; a = o === "*" ? (x, y) => A(x, y) * B(x, y) : (x, y) => A(x, y) / B(x, y); }
      else if (/[0-9.a-z(]/.test(s[i])) { const b = unary(), A = a, B = b; a = (x, y) => A(x, y) * B(x, y); }   // implicit multiplication
      else break;
    }
    return a;
  }
  function unary() { if (s[i] === "-") { i++; const A = unary(); return (x, y) => -A(x, y); } if (s[i] === "+") { i++; return unary(); } return power(); }
  function power() { const a = atom(); if (s[i] === "^") { i++; const b = unary(), A = a, B = b; return (x, y) => Math.pow(A(x, y), B(x, y)); } return a; }
  function atom() {
    if (s[i] === "(") { i++; const e = expr(); if (s[i] !== ")") throw 0; i++; return e; }
    let m = /^[0-9]*\.?[0-9]+/.exec(s.slice(i));
    if (m) { i += m[0].length; const v = parseFloat(m[0]); return () => v; }
    m = /^[a-z_][a-z0-9_]*/.exec(s.slice(i));
    if (m) { const n = m[0]; i += n.length;
      if (n === "x") return (x) => x;
      if (n === "y") return (x, y) => y;
      if (Object.prototype.hasOwnProperty.call(C, n)) { const v = C[n]; return () => v; }
      if (Object.prototype.hasOwnProperty.call(F, n)) { if (s[i] !== "(") throw 0; i++; const a = expr(); if (s[i] !== ")") throw 0; i++; const f = F[n], A = a; return (x, y) => f(A(x, y)); }
      throw 0;
    }
    throw 0;
  }
  try { const fn = expr(); if (i !== s.length) return null; const v = fn(0.4, 0.6); if (typeof v !== "number") return null; return fn; }
  catch (_) { return null; }
}

/* Render a 3D SURFACE z=f(x,y) as an isometric wireframe SVG — height-shaded quads, painter's
   depth sort, clean look. Self-contained (no engine) so it renders in chat AND PDF. */
function plot3dSurfaceSvg(fn, xr, yr, label, view) {
  view = view || {};
  const az = view.az != null ? view.az : -0.85, el = view.el != null ? view.el : 0.52, zoom = view.zoom || 1;
  const [x0, x1] = xr, [y0, y1] = yr, N = 34;
  const P = []; let zmin = Infinity, zmax = -Infinity;
  for (let i = 0; i <= N; i++) { P[i] = []; for (let j = 0; j <= N; j++) { const x = x0 + (x1 - x0) * i / N, y = y0 + (y1 - y0) * j / N; let z; try { z = fn(x, y); } catch (_) { z = NaN; } if (!isFinite(z)) z = NaN; P[i][j] = { x, y, z }; if (isFinite(z)) { if (z < zmin) zmin = z; if (z > zmax) zmax = z; } } }
  if (!isFinite(zmin)) { zmin = -1; zmax = 1; }
  const zc = (zmax - zmin) || 1, span = Math.max(x1 - x0, y1 - y0) || 1;
  const zEx = span / zc * 0.5;                                    // exaggerate z into world (xy) units
  const W = 480, H = 360, cx = W / 2, cy = H * 0.54;
  const scale = Math.min(W, H) * 0.34 / span * zoom;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (zmin + zmax) / 2;
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  const world = (x, y, z) => [x - mx, y - my, ((isFinite(z) ? z : mz) - mz) * zEx];
  // Rotate about z (azimuth) then about screen-x (elevation). Returns [screenX, screenY, depth].
  const proj = (w) => { const x1r = w[0] * ca - w[1] * sa, y1r = w[0] * sa + w[1] * ca, z1 = w[2]; const y2 = y1r * ce - z1 * se, z2 = y1r * se + z1 * ce; return [cx + x1r * scale, cy - z2 * scale, y2]; };
  const rot = (v) => { const x1r = v[0] * ca - v[1] * sa, y1r = v[0] * sa + v[1] * ca, z1 = v[2]; return [x1r, y1r * ce - z1 * se, y1r * se + z1 * ce]; };
  const L = [-0.32, -0.5, 0.8], LL = Math.hypot(L[0], L[1], L[2]); L[0] /= LL; L[1] /= LL; L[2] /= LL;
  const col = (z, shade) => { const t = isFinite(z) ? Math.max(0, Math.min(1, (z - zmin) / zc)) : 0.5; let r = 48 + t * 210, g = 46 + t * 150, b = 130 - t * 80; r *= shade; g *= shade; b *= shade; return "rgb(" + Math.round(Math.min(255, r)) + "," + Math.round(Math.min(255, g)) + "," + Math.round(Math.min(255, b)) + ")"; };
  const quads = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const a00 = P[i][j], a10 = P[i + 1][j], a11 = P[i + 1][j + 1], a01 = P[i][j + 1];
    if (![a00, a10, a11, a01].every((p) => isFinite(p.z))) continue;
    const w00 = world(a00.x, a00.y, a00.z), w10 = world(a10.x, a10.y, a10.z), w11 = world(a11.x, a11.y, a11.z), w01 = world(a01.x, a01.y, a01.z);
    const ux = w11[0] - w00[0], uy = w11[1] - w00[1], uz = w11[2] - w00[2], vx = w01[0] - w10[0], vy = w01[1] - w10[1], vz = w01[2] - w10[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1;
    const rn = rot([nx / nl, ny / nl, nz / nl]); let dot = Math.abs(rn[0] * L[0] + rn[1] * L[1] + rn[2] * L[2]);
    const shade = 0.52 + 0.48 * dot, zAvg = (a00.z + a10.z + a11.z + a01.z) / 4;
    const p00 = proj(w00), p10 = proj(w10), p11 = proj(w11), p01 = proj(w01);
    const depth = (p00[2] + p10[2] + p11[2] + p01[2]) / 4;
    quads.push({ depth, d: "M" + [p00, p10, p11, p01].map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + "Z", fill: col(zAvg, shade) });
  }
  quads.sort((p, q) => q.depth - p.depth);                        // painter's: farthest first
  const faces = quads.map((q) => '<path d="' + q.d + '" fill="' + q.fill + '" stroke="#ffffff" stroke-width="0.3" stroke-opacity="0.35"/>').join("");
  return '<svg viewBox="0 0 ' + W + " " + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="3D surface" style="width:100%;height:auto;display:block">' +
    '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="var(--plot-bg,#faf9f5)" rx="8"/>' + faces + "</svg>";
}

/* Make a 3D surface figure drag-rotatable + wheel/pinch-zoomable. Re-renders on each frame. */
function make3dInteractive(fig, fn, xr, yr, label) {
  const st = { az: -0.85, el: 0.52, zoom: 1 }, home = Object.assign({}, st);
  let raf = 0;
  const draw = () => { raf = 0; const tmp = document.createElement("div"); tmp.innerHTML = plot3dSurfaceSvg(fn, xr, yr, label, st); const ns = tmp.firstElementChild, old = fig.querySelector("svg"); if (ns && old) fig.replaceChild(ns, old); };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
  fig.style.touchAction = "none";
  const pts = new Map(); let drag = null, pinch = null;
  fig.addEventListener("pointerdown", (e) => {
    if (e.target.closest && e.target.closest(".plot-reset")) return;
    try { fig.setPointerCapture(e.pointerId); } catch (_) {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { drag = { x: e.clientX, y: e.clientY }; pinch = null; }
    else if (pts.size === 2) { const a = [...pts.values()]; pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; drag = null; }
    fig.classList.add("plot-grabbing");
  });
  fig.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const a = [...pts.values()];
    if (a.length === 2 && pinch) { const nd = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (nd > 0 && pinch.d > 0) st.zoom = Math.max(0.4, Math.min(5, st.zoom * nd / pinch.d)); pinch.d = nd; schedule(); }
    else if (a.length === 1 && drag) { st.az += (e.clientX - drag.x) * 0.01; st.el = Math.max(-1.45, Math.min(1.45, st.el + (e.clientY - drag.y) * 0.01)); drag.x = e.clientX; drag.y = e.clientY; schedule(); }
  });
  const endP = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (pts.size === 0) { drag = null; fig.classList.remove("plot-grabbing"); } };
  fig.addEventListener("pointerup", endP); fig.addEventListener("pointercancel", endP);
  fig.addEventListener("wheel", (e) => { e.preventDefault(); let dy = e.deltaY; if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 100; dy = Math.max(-100, Math.min(100, dy)); st.zoom = Math.max(0.4, Math.min(5, st.zoom * Math.exp(-dy * 0.0012))); schedule(); }, { passive: false });
  fig.addEventListener("dblclick", (e) => { e.preventDefault(); Object.assign(st, home); schedule(); });
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "plot-reset"; btn.textContent = "⟲";
  btn.title = (typeof state !== "undefined" && state.lang === "ar") ? "إعادة الضبط" : "Reset view";
  btn.addEventListener("click", (e) => { e.stopPropagation(); Object.assign(st, home); schedule(); });
  fig.appendChild(btn);
}

/* Convert a plot-syntax expression into pretty LaTeX (for the KaTeX legend). Mirrors the
   grammar of compilePlotExpr but emits LaTeX instead of a function. Returns null on failure. */
function plotExprToLatex(src) {
  const FN = { sqrt: 1, cbrt: 1, exp: 1, abs: 1, floor: 1, ceil: 1,
    sin: "\\sin", cos: "\\cos", tan: "\\tan", sec: "\\sec", csc: "\\csc", cot: "\\cot", tg: "\\tan", ctg: "\\cot", cosec: "\\csc",
    asin: "\\arcsin", acos: "\\arccos", atan: "\\arctan", arcsin: "\\arcsin", arccos: "\\arccos", arctan: "\\arctan",
    sinh: "\\sinh", cosh: "\\cosh", tanh: "\\tanh", asinh: "\\operatorname{arsinh}", acosh: "\\operatorname{arcosh}", atanh: "\\operatorname{artanh}",
    ln: "\\ln", log: "\\log", lg: "\\log", log2: "\\log_{2}", log10: "\\log_{10}", sign: "\\operatorname{sgn}", round: "\\operatorname{round}" };
  const CN = { pi: "\\pi", e: "e", tau: "\\tau" };
  let s = String(src).replace(/\s+/g, "").toLowerCase();
  if (!s) return null;
  s = s.replace(/\*\*/g, "^").replace(/(\d)([x(])/g, "$1*$2").replace(/\)([x(\d.])/g, ")*$1").replace(/x([x(])/g, "x*$1");
  let i = 0;
  const isNum = (t) => /^[0-9.]+$/.test(t);
  function expr() { let a = term(); while (s[i] === "+" || s[i] === "-") { const o = s[i++], b = term(); a = a + " " + o + " " + b; } return a; }
  function term() { let a = unary(); while (s[i] === "*" || s[i] === "/") { const o = s[i++], b = unary(); a = o === "/" ? "\\frac{" + a + "}{" + b + "}" : (isNum(a) && isNum(b) ? a + " \\cdot " + b : a + " " + b); } return a; }
  function unary() { if (s[i] === "-") { i++; return "-" + unary(); } if (s[i] === "+") { i++; return unary(); } return power(); }
  function power() { const a = atom(); if (s[i] === "^") { i++; const b = unary(); return a + "^{" + b + "}"; } return a; }
  function atom() {
    if (s[i] === "(") { i++; const e = expr(); if (s[i] !== ")") throw 0; i++; return "\\left(" + e + "\\right)"; }
    let m = /^[0-9]*\.?[0-9]+/.exec(s.slice(i));
    if (m) { i += m[0].length; return m[0]; }
    m = /^[a-z_][a-z0-9_]*/.exec(s.slice(i));
    if (m) {
      const n = m[0]; i += n.length;
      if (n === "x") return "x";
      if (Object.prototype.hasOwnProperty.call(CN, n)) return CN[n];
      if (Object.prototype.hasOwnProperty.call(FN, n)) {
        if (s[i] !== "(") throw 0; i++; const a = expr(); if (s[i] !== ")") throw 0; i++;
        if (n === "sqrt") return "\\sqrt{" + a + "}";
        if (n === "cbrt") return "\\sqrt[3]{" + a + "}";
        if (n === "exp") return "e^{" + a + "}";
        if (n === "abs") return "\\left|" + a + "\\right|";
        if (n === "floor") return "\\left\\lfloor " + a + "\\right\\rfloor";
        if (n === "ceil") return "\\left\\lceil " + a + "\\right\\rceil";
        return FN[n] + "\\left(" + a + "\\right)";
      }
      throw 0;
    }
    throw 0;
  }
  try { const out = expr(); if (i !== s.length) return null; return out; } catch (_) { return null; }
}

/* Wrap the math parts of a free-text title ("y = exp(-x^2/8)·sin(5x) …") in \(…\) so KaTeX
   renders them as pretty math; Arabic/prose stays as-is. Best-effort — unparseable runs untouched. */
function mathifyTitle(title) {
  if (!title) return title || "";
  const s = String(title).replace(/[·×]/g, "*");
  return s.replace(
    /(±\s*)?\b([A-Za-z](?:\s*\(\s*x\s*\))?)\s*=\s*(±?\s*[-+*/^().0-9A-Za-z\s]+?)(?=$|[,،؛;]|\s*[؀-ۿ]|\s(?:for|with|on|from|to|where|and)\b)/g,
    function (m, pm, lhs, rhs) {
      const neg = /^\s*±/.test(rhs) ? "\\pm " : (/^\s*-/.test(rhs) ? "-" : "");
      const tex = plotExprToLatex(rhs.replace(/^[\s±+\-]+/, ""));
      if (!tex) return m;
      return "\\(" + (pm ? "\\pm " : "") + lhs.replace(/\s+/g, "") + " = " + neg + tex + "\\)";
    }
  );
}

let plotSeq = 0;
const PLOT_W = 480, PLOT_H = 300, PLOT_L = 46, PLOT_R = 16, PLOT_T = 16, PLOT_B = 28;
const PLOT_PW = PLOT_W - PLOT_L - PLOT_R, PLOT_PH = PLOT_H - PLOT_T - PLOT_B;
const PLOT_AR = PLOT_PW / PLOT_PH;   // plot-area aspect; equal-aspect views match it so circles render round
// Fallback colors baked in: if the --plot-cN custom property fails to cascade (e.g. in a print
// context), stroke:var(--plot-c1) would fall back to "none" → an INVISIBLE curve ("no graph").
const PLOT_PAL = ["var(--plot-c1,#237a68)", "var(--plot-c2,#3b82f6)", "var(--plot-c3,#ef4444)", "var(--plot-c4,#d97706)", "var(--plot-c5,#7c3aed)"];

/* Evaluate a simple angle/number literal that may use pi (e.g. "2*pi", "pi/2", "-1.5"). */
function plotParseNum(t) {
  const f = compilePlotExpr(String(t).replace(/π/g, "pi"), "_none_");
  if (!f) return NaN;
  try { const v = f(0); return isFinite(v) ? v : NaN; } catch (_) { return NaN; }
}
/* Parse GEOMETRY commands (one per line) → [{t,...}] primitives, or [] if none.
   Supported: point, label, segment, line, ray, vector, circle, ellipse, arc, angle,
   triangle, rectangle/square, polygon. Coords are (x,y); options: r=, color=, dashed, fill, "label". */
function parseShapeSpec(lines) {
  const shapes = [];
  const coords = (ln) => [...ln.matchAll(/\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)/g)].map((m) => [parseFloat(m[1]), parseFloat(m[2])]);
  const lbl = (ln) => { const q = /["'“”„]([^"'“”„]+)["'“”„]/.exec(ln); if (q) return q[1]; const w = /(?:label|name)\s*[:=]\s*([^\s,]+)/i.exec(ln); return w ? w[1] : null; };
  const colr = (ln) => { const c = /(?:color|colour|stroke)\s*[:=]\s*(#[0-9a-fA-F]{3,8}|[a-z]+)/i.exec(ln); return c ? c[1] : null; };
  const num = (ln, key) => { const m = new RegExp(key + "\\s*[:=]\\s*(-?\\d*\\.?\\d+)", "i").exec(ln); return m ? parseFloat(m[1]) : null; };
  lines.forEach((ln) => {
    const p = coords(ln), lb = lbl(ln), col = colr(ln), dash = /\bdash(ed)?\b/i.test(ln), fill = /\bfill(ed)?\b/i.test(ln);
    let m;
    if (/^point\b/i.test(ln) && p.length >= 1) shapes.push({ t: "point", p: p[0], lb, col });
    else if (/^(text|label)\b/i.test(ln) && p.length >= 1 && lb) shapes.push({ t: "text", p: p[0], lb, col });
    else if (/^vector\b/i.test(ln) && p.length >= 2) shapes.push({ t: "vector", a: p[0], b: p[1], lb, col });
    else if (/^(segment|seg|line|ray)\b/i.test(ln) && p.length >= 2) shapes.push({ t: /^(line|ray)\b/i.test(ln) ? "line" : "segment", a: p[0], b: p[1], lb, col, dash, extend: /^line\b/i.test(ln), ray: /^ray\b/i.test(ln) });
    else if (/^circle\b/i.test(ln) && p.length >= 1) { let r = num(ln, "r"); if (r == null && p.length >= 2) r = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]); if (r == null) { const bn = /circle\s*\([^)]*\)\s*(-?\d*\.?\d+)/i.exec(ln); if (bn) r = parseFloat(bn[1]); } if (r != null && isFinite(r) && r > 0) shapes.push({ t: "circle", c: p[0], r, lb, col, dash, fill }); }
    else if (/^ellipse\b/i.test(ln) && p.length >= 1) { let rx = num(ln, "rx"); if (rx == null) rx = num(ln, "a"); let ry = num(ln, "ry"); if (ry == null) ry = num(ln, "b"); if (rx && ry) shapes.push({ t: "ellipse", c: p[0], rx, ry, lb, col, dash, fill }); }
    else if (/^arc\b/i.test(ln) && p.length >= 1) { const r = num(ln, "r"), am = /(-?\d*\.?\d+)\s*(?:\.\.|,|to)\s*(-?\d*\.?\d+)\s*(?:deg|°)?/i.exec(ln.replace(/r\s*[:=]\s*-?\d*\.?\d+/i, "")); if (r && am) shapes.push({ t: "arc", c: p[0], r, a1: parseFloat(am[1]), a2: parseFloat(am[2]), col, dash }); }
    else if (/^angle\b/i.test(ln) && p.length >= 3) shapes.push({ t: "angle", a: p[0], v: p[1], b: p[2], lb, col });
    else if (/^triangle\b/i.test(ln) && p.length >= 3) shapes.push({ t: "poly", pts: p.slice(0, 3), lb, col, dash, fill: true, closed: true });
    else if (/^(rectangle|rect|square)\b/i.test(ln) && p.length >= 2) { const [a, b] = p; shapes.push({ t: "poly", pts: [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]], lb, col, dash, fill: true, closed: true }); }
    else if (/^(polygon|poly|quad|quadrilateral)\b/i.test(ln) && p.length >= 3) shapes.push({ t: "poly", pts: p, lb, col, dash, fill, closed: true });
  });
  return shapes;
}
/* Bounding point cloud for a shape (for auto-fitting the view). */
function shapePoints(s) {
  if (s.t === "point" || s.t === "text") return [s.p];
  if (s.t === "vector" || s.t === "segment" || s.t === "line") return [s.a, s.b];
  if (s.t === "angle") return [s.a, s.v, s.b];
  if (s.t === "poly") return s.pts;
  if (s.t === "circle" || s.t === "arc") return [[s.c[0] - s.r, s.c[1]], [s.c[0] + s.r, s.c[1]], [s.c[0], s.c[1] - s.r], [s.c[0], s.c[1] + s.r]];
  if (s.t === "ellipse") return [[s.c[0] - s.rx, s.c[1]], [s.c[0] + s.rx, s.c[1]], [s.c[0], s.c[1] - s.ry], [s.c[0], s.c[1] + s.ry]];
  return [];
}

/* Parse a plot spec → { fns:[{fn|points, expr, color}], dom, mode }. Supports modes:
   cartesian (y=f(x)), polar (r=f(theta)), parametric (x=f(t)&y=g(t)), surface (z=f(x,y)), geometry (shapes). */
function parsePlotSpec(spec) {
  const lines = String(spec).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^(#|\/\/)/.test(l));
  // GEOMETRY (shapes) — detected when any line starts with a shape command.
  if (lines.some((l) => /^(point|text|label|vector|segment|seg|line|ray|circle|ellipse|arc|angle|triangle|rectangle|rect|square|polygon|poly|quad|quadrilateral)\b/i.test(l))) {
    const shapes = parseShapeSpec(lines);
    if (shapes.length) {
      const pc = []; shapes.forEach((s) => shapePoints(s).forEach((pt) => pc.push(pt)));
      return { mode: "geometry", shapes, fns: [], bounds: plotPointsBounds(pc.length ? pc : [[-1, -1], [1, 1]], true) };
    }
  }
  let dom = null, ydom = null, pdom = null, polarSrc = null, px = null, py = null, surfSrc = null;
  const cart = [];
  lines.forEach((ln) => {
    // 3D surface z = f(x,y)
    let sm = /^z\s*(?:\(\s*x\s*,\s*y\s*\))?\s*=\s*(.+)$/i.exec(ln);
    if (sm && /[xy]/i.test(sm[1])) { surfSrc = sm[1].trim(); return; }
    // y-domain (for 3D)
    let ym2 = /^y\s*[:=]\s*(-?[0-9.]+)\s*(?:\.\.|,|to|:)\s*(-?[0-9.]+)\s*$/i.exec(ln);
    if (ym2 && surfSrc) { const a = parseFloat(ym2[1]), b = parseFloat(ym2[2]); if (isFinite(a) && isFinite(b) && a < b) ydom = [a, b]; return; }
    // cartesian x-domain
    let m = /^(?:domain|x)\s*[:=]\s*(-?[0-9.]+)\s*(?:\.\.|,|to|:)\s*(-?[0-9.]+)/i.exec(ln) || /^(-?[0-9.]+)\s*(?:\.\.|to)\s*(-?[0-9.]+)$/i.exec(ln);
    if (m && !/theta|θ|\bt\b/i.test(ln)) { const a = parseFloat(m[1]), b = parseFloat(m[2]); if (isFinite(a) && isFinite(b) && a < b) dom = [a, b]; return; }
    // parameter domain (theta / t)
    let pm = /^(?:theta|θ|t)\s*[:=]\s*([^\s]+)\s*(?:\.\.|,|to|:)\s*([^\s]+)$/i.exec(ln);
    if (pm) { const a = plotParseNum(pm[1]), b = plotParseNum(pm[2]); if (isFinite(a) && isFinite(b) && a < b) pdom = [a, b]; return; }
    // polar r = f(theta)
    let rm = /^(?:polar\s*:?\s*)?r\s*(?:\(\s*(?:theta|θ|t)\s*\))?\s*=\s*(.+)$/i.exec(ln);
    if (rm && /theta|θ|\bt\b/i.test(rm[1])) { polarSrc = rm[1].replace(/θ/g, "theta").trim(); return; }
    // parametric x(t)= / y(t)=
    let xm = /^x\s*(?:\(\s*t\s*\))?\s*=\s*(.+)$/i.exec(ln);
    let ym = /^y\s*(?:\(\s*t\s*\))?\s*=\s*(.+)$/i.exec(ln);
    if (xm && /\bt\b/i.test(xm[1])) { px = xm[1].trim(); return; }
    if (ym && /\bt\b/i.test(ym[1]) && px) { py = ym[1].trim(); return; }
    // cartesian y=f(x)
    const e = ln.replace(/^[a-z]\s*\(\s*x\s*\)\s*=/i, "").replace(/^y\s*=/i, "").trim();
    const fn = compilePlotExpr(e, "x");
    if (fn) cart.push({ fn: fn, expr: e, color: PLOT_PAL[cart.length % PLOT_PAL.length] });
  });
  // 3D SURFACE z = f(x,y)
  if (surfSrc) {
    const sf = compilePlot2(surfSrc);
    if (sf) return { fns: [{ surf: sf, expr: "z = " + surfSrc, color: PLOT_PAL[0] }], mode: "surface", xr: dom || [-3, 3], yr: ydom || dom || [-3, 3] };
  }
  // POLAR
  if (polarSrc) {
    const rf = compilePlotExpr(polarSrc, "theta");
    if (rf) {
      const [t0, t1] = pdom || [0, 2 * Math.PI]; const N = 720, pts = [];
      for (let k = 0; k <= N; k++) { const th = t0 + (t1 - t0) * k / N; let r; try { r = rf(th); } catch (_) { r = NaN; } if (isFinite(r)) pts.push([r * Math.cos(th), r * Math.sin(th)]); }
      if (pts.length > 2) return { fns: [{ points: pts, expr: "r = " + polarSrc, color: PLOT_PAL[0] }], mode: "polar", bounds: plotPointsBounds(pts, true) };
    }
  }
  // PARAMETRIC
  if (px && py) {
    const fx = compilePlotExpr(px, "t"), fy = compilePlotExpr(py, "t");
    if (fx && fy) {
      const [t0, t1] = pdom || [0, 2 * Math.PI]; const N = 720, pts = [];
      for (let k = 0; k <= N; k++) { const t = t0 + (t1 - t0) * k / N; let X, Y; try { X = fx(t); Y = fy(t); } catch (_) { X = NaN; } if (isFinite(X) && isFinite(Y)) pts.push([X, Y]); }
      if (pts.length > 2) return { fns: [{ points: pts, expr: "x = " + px + ",\\ y = " + py, color: PLOT_PAL[0] }], mode: "parametric", bounds: plotPointsBounds(pts, false) };
    }
  }
  if (!cart.length) return null;
  return { fns: cart, dom: dom || [-6, 6], mode: "cartesian" };
}
/* Bounds for a point cloud (polar/parametric). equalAspect keeps the plot square (nice for polar). */
function plotPointsBounds(pts, equalAspect) {
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  pts.forEach(([x, y]) => { if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y; });
  if (!isFinite(xmin)) return { xmin: -1, xmax: 1, ymin: -1, ymax: 1 };
  const padX = (xmax - xmin) * 0.1 || 1, padY = (ymax - ymin) * 0.1 || 1;
  xmin -= padX; xmax += padX; ymin -= padY; ymax += padY;
  if (equalAspect) {
    // Match the plot-area aspect (width = AR × height) so 1 unit x = 1 unit y in PIXELS → true circles.
    const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
    const halfY = Math.max((ymax - ymin) / 2, (xmax - xmin) / 2 / PLOT_AR), halfX = halfY * PLOT_AR;
    xmin = cx - halfX; xmax = cx + halfX; ymin = cy - halfY; ymax = cy + halfY;
  }
  return { xmin, xmax, ymin, ymax };
}

/* Auto y-range for fns over [x0,x1] — percentile-clipped so asymptotes don't dominate. */
function plotAutoY(fns, x0, x1) {
  const N = 500, all = [];
  for (let k = 0; k <= N; k++) { const x = x0 + (x1 - x0) * k / N; for (let j = 0; j < fns.length; j++) { let y; try { y = fns[j].fn(x); } catch (_) { y = NaN; } if (typeof y === "number" && isFinite(y)) all.push(y); } }
  if (!all.length) return { ymin: -1, ymax: 1 };
  all.sort((a, b) => a - b);
  let ymin = all[Math.floor(all.length * 0.02)], ymax = all[Math.min(all.length - 1, Math.ceil(all.length * 0.98))];
  if (!(ymin < ymax)) { ymin = all[0]; ymax = all[all.length - 1]; }
  if (!(ymin < ymax)) { ymin -= 1; ymax += 1; }
  const pad = (ymax - ymin) * 0.1 || 1; ymin -= pad; ymax += pad;
  if (ymin > 0 && ymin < pad * 4) ymin = 0;
  if (ymax < 0 && ymax > -pad * 4) ymax = 0;
  return { ymin: ymin, ymax: ymax };
}

/* Render the SVG for fns at an explicit view {xmin,xmax,ymin,ymax}. Pure — re-run on pan/zoom. */
function plotSvgString(fns, view, opts) {
  opts = opts || {};
  const xmin = view.xmin, xmax = view.xmax, ymin = view.ymin, ymax = view.ymax;
  const W = PLOT_W, H = PLOT_H, L = PLOT_L, T = PLOT_T, pw = PLOT_PW, ph = PLOT_PH;
  const sx = (x) => L + (x - xmin) / (xmax - xmin) * pw;
  const sy = (y) => T + (ymax - y) / (ymax - ymin) * ph;
  const nice = (range, n) => { const raw = range / n, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), u = raw / mag; return (u < 1.5 ? 1 : u < 3 ? 2 : u < 7 ? 5 : 10) * mag; };
  const fmt = (v) => { const r = Math.round(v * 1000) / 1000; return String(Math.abs(r) < 1e-9 ? 0 : r); };
  const xStep = nice(xmax - xmin, 8), yStep = nice(ymax - ymin, 6);
  const id = "pl" + (plotSeq++);
  let grid = "", ax = "", curves = "";
  if (opts.polar) {
    // POLAR GRID — concentric rings + angular rays centered on the origin (circular background).
    const cx = sx(0), cy = sy(0);
    const rMax = Math.max(Math.abs(xmin), Math.abs(xmax), Math.abs(ymin), Math.abs(ymax));
    const rStep = nice(rMax, 5), pxX = pw / (xmax - xmin), pxY = ph / (ymax - ymin);
    for (let r = rStep; r <= rMax * 1.02; r += rStep) {
      grid += `<ellipse class="plot-grid" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(r * pxX).toFixed(1)}" ry="${(r * pxY).toFixed(1)}" fill="none"/>`;
      grid += `<text class="plot-tick" x="${(cx + r * pxX + 3).toFixed(1)}" y="${(cy - 3).toFixed(1)}">${fmt(r)}</text>`;
    }
    for (let deg = 0; deg < 360; deg += 30) {
      const a = deg * Math.PI / 180, ex = cx + Math.cos(a) * rMax * pxX, ey = cy - Math.sin(a) * rMax * pxY;
      grid += `<line class="plot-grid" x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"/>`;
    }
    // bold x/y axes through the origin
    ax += `<line class="plot-axis" x1="${L}" y1="${cy.toFixed(1)}" x2="${(L + pw).toFixed(1)}" y2="${cy.toFixed(1)}" marker-end="url(#${id}a)"/>`;
    ax += `<line class="plot-axis" x1="${cx.toFixed(1)}" y1="${(T + ph).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${T}" marker-end="url(#${id}a)"/>`;
  } else {
  for (let x = Math.ceil(xmin / xStep) * xStep; x <= xmax + 1e-9; x += xStep) {
    const X = sx(x); grid += `<line class="plot-grid" x1="${X.toFixed(1)}" y1="${T}" x2="${X.toFixed(1)}" y2="${(T + ph).toFixed(1)}"/>`;
    if (Math.abs(x) > 1e-9) grid += `<text class="plot-tick" x="${X.toFixed(1)}" y="${(T + ph + 14).toFixed(1)}" text-anchor="middle">${fmt(x)}</text>`;
  }
  for (let y = Math.ceil(ymin / yStep) * yStep; y <= ymax + 1e-9; y += yStep) {
    const Y = sy(y); grid += `<line class="plot-grid" x1="${L}" y1="${Y.toFixed(1)}" x2="${(L + pw).toFixed(1)}" y2="${Y.toFixed(1)}"/>`;
    if (Math.abs(y) > 1e-9) grid += `<text class="plot-tick" x="${(L - 5).toFixed(1)}" y="${(Y + 3).toFixed(1)}" text-anchor="end">${fmt(y)}</text>`;
  }
  if (0 >= ymin && 0 <= ymax) { const Y = sy(0); ax += `<line class="plot-axis" x1="${L}" y1="${Y.toFixed(1)}" x2="${(L + pw).toFixed(1)}" y2="${Y.toFixed(1)}" marker-end="url(#${id}a)"/><text class="plot-axislabel" x="${(L + pw - 3).toFixed(1)}" y="${(Y - 6).toFixed(1)}" text-anchor="end">x</text>`; }
  if (0 >= xmin && 0 <= xmax) { const X = sx(0); ax += `<line class="plot-axis" x1="${X.toFixed(1)}" y1="${(T + ph).toFixed(1)}" x2="${X.toFixed(1)}" y2="${T}" marker-end="url(#${id}a)"/><text class="plot-axislabel" x="${(X + 7).toFixed(1)}" y="${(T + 9).toFixed(1)}">y</text>`; }
  }
  const N = 500, span = ymax - ymin;
  fns.forEach((f) => {
    let d = "", up = true;
    if (f.points) {
      // POLAR / PARAMETRIC — draw the pre-traced point path (clipped to the view).
      f.points.forEach(([x, y]) => {
        if (!isFinite(x) || !isFinite(y) || x < xmin - span || x > xmax + span || y < ymin - span || y > ymax + span) { up = true; return; }
        const X = sx(Math.max(xmin, Math.min(xmax, x))), Y = sy(Math.max(ymin, Math.min(ymax, y)));
        d += (up ? "M" : "L") + X.toFixed(1) + " " + Y.toFixed(1) + " "; up = false;
      });
    } else {
      for (let k = 0; k <= N; k++) { const x = xmin + (xmax - xmin) * k / N; let y; try { y = f.fn(x); } catch (_) { y = NaN; } if (typeof y !== "number" || !isFinite(y) || y < ymin - span || y > ymax + span) { up = true; continue; } const X = sx(x), Y = sy(Math.max(ymin, Math.min(ymax, y))); d += (up ? "M" : "L") + X.toFixed(1) + " " + Y.toFixed(1) + " "; up = false; }
    }
    if (d) curves += `<path class="plot-curve" style="stroke:${f.color}" d="${d}"/>`;
  });
  // GEOMETRY shapes (opts.shapes) — drawn on the same axes so circles/triangles/vectors render natively.
  let shapesSvg = "";
  if (opts.shapes && opts.shapes.length) {
    const pxX = pw / (xmax - xmin), pxY = ph / (ymax - ymin);
    const SX = (p) => sx(p[0]), SY = (p) => sy(p[1]);
    const fillOf = (col) => { const h = col.replace("#", ""); if (h.length === 6) { const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return `rgba(${r},${g},${b},0.13)`; } return "rgba(59,130,246,0.13)"; };
    const dashA = (s) => s.dash ? ' stroke-dasharray="5 4"' : "";
    const txt = (x, y, str, col, anc) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${col}" font-size="14" font-weight="600"${anc ? ` text-anchor="${anc}"` : ""} style="font-family:'Segoe UI','Tajawal',sans-serif" paint-order="stroke" stroke="#ffffff" stroke-width="2.6" stroke-linejoin="round">${escapeHtml(str)}</text>`;
    const arrowHead = (x1, y1, x2, y2, col) => { const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, sz = 9, w = 4.2; const bx = x2 - ux * sz, by = y2 - uy * sz; return `<polygon points="${x2.toFixed(1)} ${y2.toFixed(1)} ${(bx - uy * w).toFixed(1)} ${(by + ux * w).toFixed(1)} ${(bx + uy * w).toFixed(1)} ${(by - ux * w).toFixed(1)}" fill="${col}"/>`; };
    const DEF = "#237a68";
    opts.shapes.forEach((s) => {
      const c = s.col || null;
      if (s.t === "point") {
        const X = SX(s.p), Y = SY(s.p), col = c || "#ef4444";
        shapesSvg += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="3.7" fill="${col}" stroke="#ffffff" stroke-width="1.3"/>`;
        if (s.lb) shapesSvg += txt(X + 7, Y - 7, s.lb, c || "#b91c1c");
      } else if (s.t === "text") {
        shapesSvg += txt(SX(s.p), SY(s.p), s.lb, c || "#1f2937", "middle");
      } else if (s.t === "segment" || s.t === "line" || s.t === "vector") {
        let a = s.a, b = s.b;
        if (s.extend) { const cl = clipSegToView([a[0], a[1]], [b[0], b[1]], xmin, xmax, ymin, ymax); if (cl) { a = cl[0]; b = cl[1]; } }
        const col = c || (s.t === "vector" ? "#7c3aed" : "#334155");
        const x1 = SX(a), y1 = SY(a), x2 = SX(b), y2 = SY(b);
        shapesSvg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="2.1" stroke-linecap="round"${dashA(s)}/>`;
        if (s.t === "vector") shapesSvg += arrowHead(x1, y1, x2, y2, col);
        if (s.lb) shapesSvg += txt((x1 + x2) / 2 + 6, (y1 + y2) / 2 - 6, s.lb, col);
      } else if (s.t === "circle") {
        const col = c || DEF, X = SX(s.c), Y = SY(s.c);
        shapesSvg += `<ellipse cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" rx="${(s.r * pxX).toFixed(1)}" ry="${(s.r * pxY).toFixed(1)}" fill="${s.fill ? fillOf(col) : "none"}" stroke="${col}" stroke-width="2"${dashA(s)}/>`;
        shapesSvg += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="2.4" fill="${col}"/>`;
        if (s.lb) shapesSvg += txt(X, (Y - s.r * pxY - 6), s.lb, col, "middle");
      } else if (s.t === "ellipse") {
        const col = c || DEF, X = SX(s.c), Y = SY(s.c);
        shapesSvg += `<ellipse cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" rx="${(s.rx * pxX).toFixed(1)}" ry="${(s.ry * pxY).toFixed(1)}" fill="${s.fill ? fillOf(col) : "none"}" stroke="${col}" stroke-width="2"${dashA(s)}/>`;
        if (s.lb) shapesSvg += txt(X, (Y - s.ry * pxY - 6), s.lb, col, "middle");
      } else if (s.t === "poly") {
        const col = c || DEF, pts = s.pts.map((p) => SX(p).toFixed(1) + "," + SY(p).toFixed(1)).join(" ");
        shapesSvg += `<polygon points="${pts}" fill="${s.fill ? fillOf(col) : "none"}" stroke="${col}" stroke-width="2" stroke-linejoin="round"${dashA(s)}/>`;
        if (s.lb) { const cx = s.pts.reduce((a, p) => a + p[0], 0) / s.pts.length, cy = s.pts.reduce((a, p) => a + p[1], 0) / s.pts.length; shapesSvg += txt(SX([cx, cy]), SY([cx, cy]), s.lb, col, "middle"); }
      } else if (s.t === "arc") {
        const col = c || DEF, a1 = s.a1 * Math.PI / 180, a2 = s.a2 * Math.PI / 180, K = 48; let d = "";
        for (let k = 0; k <= K; k++) { const t = a1 + (a2 - a1) * k / K, px = s.c[0] + s.r * Math.cos(t), py = s.c[1] + s.r * Math.sin(t); d += (k ? "L" : "M") + SX([px, py]).toFixed(1) + " " + SY([px, py]).toFixed(1) + " "; }
        shapesSvg += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2"${dashA(s)}/>`;
      } else if (s.t === "angle") {
        const col = c || "#d97706", vX = SX(s.v), vY = SY(s.v);
        const aX = SX(s.a) - vX, aY = SY(s.a) - vY, bX = SX(s.b) - vX, bY = SY(s.b) - vY;
        let ang1 = Math.atan2(aY, aX), ang2 = Math.atan2(bY, bX); let dA = ang2 - ang1; while (dA > Math.PI) dA -= 2 * Math.PI; while (dA < -Math.PI) dA += 2 * Math.PI;
        const rr = 22, K = 24; let d = "";
        for (let k = 0; k <= K; k++) { const t = ang1 + dA * k / K; d += (k ? "L" : "M") + (vX + rr * Math.cos(t)).toFixed(1) + " " + (vY + rr * Math.sin(t)).toFixed(1) + " "; }
        shapesSvg += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2"/>`;
        if (s.lb) { const mt = ang1 + dA / 2; shapesSvg += txt(vX + (rr + 13) * Math.cos(mt), vY + (rr + 13) * Math.sin(mt) + 4, s.lb, col, "middle"); }
      }
    });
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="function graph">` +
    `<defs><clipPath id="${id}c"><rect x="${L}" y="${T}" width="${pw}" height="${ph}"/></clipPath>` +
    `<marker id="${id}a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path class="plot-arrow" d="M0 0L10 5L0 10z"/></marker></defs>` +
    `<rect class="plot-bg" x="${L}" y="${T}" width="${pw}" height="${ph}" rx="6"/>` +
    grid + ax + `<g clip-path="url(#${id}c)">${curves}${shapesSvg}</g>` + `</svg>`;
}

/* Clip a segment a→b to the rectangle [xmin,xmax]×[ymin,ymax] (Liang–Barsky). Returns [a',b'] or null. */
function clipSegToView(a, b, xmin, xmax, ymin, ymax) {
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  const clip = (p, q) => { if (Math.abs(p) < 1e-12) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
  if (clip(-dx, a[0] - xmin) && clip(dx, xmax - a[0]) && clip(-dy, a[1] - ymin) && clip(dy, ymax - a[1])) {
    return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
  }
  return null;
}

/* The home view for a parsed spec: point-cloud bounds for polar/parametric, auto-y for cartesian. */
function plotHomeView(p) {
  if (p.bounds) return p.bounds;                       // polar / parametric
  const ay = plotAutoY(p.fns, p.dom[0], p.dom[1]);
  return { xmin: p.dom[0], xmax: p.dom[1], ymin: ay.ymin, ymax: ay.ymax };
}
/* Back-compat: render straight from a spec at the auto view. */
function renderPlotSvg(spec) {
  const p = parsePlotSpec(spec); if (!p) return null;
  if (p.mode === "surface") return plot3dSurfaceSvg(p.fns[0].surf, p.xr, p.yr, p.fns[0].expr);
  return plotSvgString(p.fns, plotHomeView(p), { polar: p.mode === "polar" || p.mode === "parametric", shapes: p.shapes });
}

/* Make a rendered plot pan/zoomable: mouse drag + wheel; touch one-finger pan + two-finger pinch;
   double-click or the ⟲ button resets to the home view. Re-renders each frame so axes stay crisp. */
function makePlotInteractive(fig, fns, home, opts) {
  opts = opts || {};
  const mk = () => ({ xmin: home.xmin, xmax: home.xmax, ymin: home.ymin, ymax: home.ymax });
  let view = mk(), target = mk(), raf = 0, anim = 0;
  const drawNow = () => { const old = fig.querySelector("svg"); if (!old) return; const tmp = document.createElement("div"); tmp.innerHTML = plotSvgString(fns, view, opts); const ns = tmp.firstElementChild; if (ns) fig.replaceChild(ns, old); };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawNow(); }); };
  // Ease `view` toward `target` over a few frames → smooth zoom (pan sets both directly = no lag).
  const step = () => {
    anim = 0; const k = 0.32; let moving = false;
    for (const p of ["xmin", "xmax", "ymin", "ymax"]) {
      const d = target[p] - view[p], eps = Math.max(1e-4, Math.abs(target[p]) * 2e-4);
      if (Math.abs(d) > eps) { view[p] += d * k; moving = true; } else view[p] = target[p];
    }
    drawNow();
    if (moving) anim = requestAnimationFrame(step);
  };
  const ease = () => { if (!anim) anim = requestAnimationFrame(step); };
  const stopAnim = () => { if (anim) { cancelAnimationFrame(anim); anim = 0; } target = { xmin: view.xmin, xmax: view.xmax, ymin: view.ymin, ymax: view.ymax }; };
  const dataAt = (cx, cy) => { const svg = fig.querySelector("svg"), r = svg.getBoundingClientRect(); const vx = (cx - r.left) / r.width * PLOT_W, vy = (cy - r.top) / r.height * PLOT_H; return { x: view.xmin + (vx - PLOT_L) / PLOT_PW * (view.xmax - view.xmin), y: view.ymax - (vy - PLOT_T) / PLOT_PH * (view.ymax - view.ymin) }; };
  const zoomAt = (cx, cy, factor) => {
    const d = dataAt(cx, cy);
    const x0 = d.x - (d.x - target.xmin) * factor, x1 = d.x + (target.xmax - d.x) * factor;
    const y0 = d.y - (d.y - target.ymin) * factor, y1 = d.y + (target.ymax - d.y) * factor;
    if (x1 - x0 < 1e-7 || x1 - x0 > 1e9 || y1 - y0 < 1e-7 || y1 - y0 > 1e9) return;
    target.xmin = x0; target.xmax = x1; target.ymin = y0; target.ymax = y1; ease();
  };
  fig.addEventListener("wheel", (e) => {
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 100;   // lines/pages → ~pixels
    dy = Math.max(-100, Math.min(100, dy));                                    // clamp one notch
    zoomAt(e.clientX, e.clientY, Math.exp(dy * 0.0011));                       // proportional + eased (smooth)
  }, { passive: false });
  const pts = new Map(); let pan = null, pinch = null;
  fig.addEventListener("pointerdown", (e) => {
    if (e.target.closest && e.target.closest(".plot-reset")) return;
    try { fig.setPointerCapture(e.pointerId); } catch (_) {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopAnim();
    if (pts.size === 1) { pan = { x: e.clientX, y: e.clientY, v: Object.assign({}, view) }; pinch = null; }
    else if (pts.size === 2) { const a = [...pts.values()]; pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; pan = null; }
    fig.classList.add("plot-grabbing");
  });
  fig.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const a = [...pts.values()];
    if (a.length === 2 && pinch) {
      const nd = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), cx = (a[0].x + a[1].x) / 2, cy = (a[0].y + a[1].y) / 2;
      if (nd > 0 && pinch.d > 0) zoomAt(cx, cy, pinch.d / nd);
      pinch.d = nd;
    } else if (a.length === 1 && pan) {
      const svg = fig.querySelector("svg"), r = svg.getBoundingClientRect();
      const dx = (e.clientX - pan.x) / r.width * PLOT_W / PLOT_PW * (pan.v.xmax - pan.v.xmin);
      const dy = (e.clientY - pan.y) / r.height * PLOT_H / PLOT_PH * (pan.v.ymax - pan.v.ymin);
      view = { xmin: pan.v.xmin - dx, xmax: pan.v.xmax - dx, ymin: pan.v.ymin + dy, ymax: pan.v.ymax + dy };
      target = { xmin: view.xmin, xmax: view.xmax, ymin: view.ymin, ymax: view.ymax };
      schedule();
    }
  });
  const endP = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (pts.size === 0) { pan = null; fig.classList.remove("plot-grabbing"); } };
  fig.addEventListener("pointerup", endP); fig.addEventListener("pointercancel", endP);
  fig.addEventListener("dblclick", (e) => { e.preventDefault(); target = mk(); ease(); });
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "plot-reset"; btn.textContent = "⟲";
  btn.title = (typeof state !== "undefined" && state.lang === "ar") ? "إعادة الضبط" : "Reset view";
  btn.addEventListener("click", (e) => { e.stopPropagation(); target = mk(); ease(); });
  fig.appendChild(btn);
}

/* Convert a <pre><code class="language-plot"> block into an instant SVG graph. Returns true if handled. */
function plotifyCodeBlock(code) {
  if (!code) return false;
  const lang = ((code.className || "").match(/language-([\w-]+)/) || [])[1] || "";
  if (!/^(plot|graph|funcplot)$/i.test(lang)) return false;
  const pre = code.parentElement; if (!pre) return false;
  const p = parsePlotSpec(code.textContent || "");
  if (!p) return false; // couldn't parse a function → leave as a normal code box
  const fig = document.createElement("figure");
  fig.className = "tikz-figure plot-figure plot-interactive" + (p.mode === "surface" ? " plot-figure--3d" : "");
  const home = p.mode === "surface" ? null : plotHomeView(p);
  const isPolar = p.mode === "polar" || p.mode === "parametric";
  fig.innerHTML = p.mode === "surface" ? plot3dSurfaceSvg(p.fns[0].surf, p.xr, p.yr, p.fns[0].expr) : plotSvgString(p.fns, home, { polar: isPolar, shapes: p.shapes });
  // Beautiful math legend (HTML + KaTeX overlay) — built once, stays fixed during pan/zoom.
  // Geometry has no function legend.
  if (p.mode !== "geometry" && p.fns.length) {
    const leg = document.createElement("div");
    leg.className = "plot-legend";
    p.fns.forEach((f) => {
      const row = document.createElement("div"); row.className = "plot-legend__row";
      const sw = document.createElement("span"); sw.className = "plot-legend__sw"; sw.style.background = f.color;
      const lb = document.createElement("span"); lb.className = "plot-legend__lb";
      // polar/parametric/surface carry a full label; cartesian gets "y = …".
      const tex = (f.points || f.surf) ? null : plotExprToLatex(f.expr);
      lb.textContent = tex ? ("\\(y = " + tex + "\\)") : ((f.points || f.surf) ? ("\\(" + f.expr + "\\)") : ("y = " + f.expr));
      row.appendChild(sw); row.appendChild(lb); leg.appendChild(row);
    });
    fig.appendChild(leg);
    typesetMath(leg);
  }
  pre.replaceWith(fig);
  try {
    if (p.mode === "surface") make3dInteractive(fig, p.fns[0].surf, p.xr, p.yr, p.fns[0].expr);   // drag-rotate + zoom
    else makePlotInteractive(fig, p.fns, home, { polar: isPolar, shapes: p.shapes });
  } catch (_) {}
  return true;
}

/** Copy text to the clipboard. Returns a promise that resolves true on success.
    Tries the async Clipboard API first (HTTPS / localhost), then falls back to a
    legacy execCommand path that also works over plain HTTP and on iOS Safari. */
async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) { /* permission / focus / iframe issue → legacy path */ }
  }
  return fallbackCopy(text);
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  // Keep it in the viewport (off-screen offsets break iOS) but invisible.
  ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;margin:0;opacity:0;";
  document.body.appendChild(ta);
  const sel = document.getSelection();
  const saved = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  let ok = false;
  try {
    if (/ipad|iphone|ipod/i.test(navigator.userAgent)) {
      const range = document.createRange();
      range.selectNodeContents(ta);
      sel.removeAllRanges(); sel.addRange(range);
      ta.setSelectionRange(0, text.length);
    } else {
      ta.focus(); ta.select();
    }
    ok = document.execCommand("copy");
  } catch (_) { ok = false; }
  ta.remove();
  if (saved && sel) { sel.removeAllRanges(); sel.addRange(saved); } // restore user's selection
  return ok;
}

/* ----------------------------------------------------------------------------
   Chat data helpers
---------------------------------------------------------------------------- */
function activeChat() { return state.chats.find((c) => c.id === state.activeId) || null; }

function newChat() {
  // Do NOT stop a stream still running in the previous chat — it keeps running
  // and saves to its own chat. Just navigate to a fresh welcome screen.
  state.activeId = null;          // welcome screen; chat is created on first send
  renderAll();
  syncStreamingUi();              // active view isn't streaming → Send button
  els.input.focus();
}

function ensureActiveChat(firstUserText) {
  let chat = activeChat();
  if (!chat) {
    chat = {
      id: uid(),          // local handle for activeId/DOM until server id arrives
      serverId: null,     // set after first POST /api/chats
      title: titleFrom(firstUserText),
      agent: state.product === "agent",   // Firas Agent tasks live in their own list
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    state.chats.unshift(chat);
    state.activeId = chat.id;
  }
  return chat;
}

function titleFrom(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 42 ? clean.slice(0, 42) + "…" : clean || t().newChat;
}

/** Ask the AI for a SHORT, fitting conversation title (2-5 words) and apply it while
    the answer streams — fire-and-forget, NEVER clobbers a manual rename. */
async function autoTitleChat(chat, userText) {
  const txt = String(userText || "").trim();
  if (!chat || !txt) return;
  const before = chat.title; // detect a manual rename mid-flight
  try {
    const out = await callAgentText([
      { role: "system", content: "Generate a SHORT, specific title (2–5 words, ≤40 chars) for a chat starting with the user's message. Use the SAME language as the message. Return ONLY the title — no surrounding quotes, no trailing punctuation, no 'Title:' prefix." },
      { role: "user", content: txt.slice(0, 500) },
    ], "pro");
    let title = String(out || "").trim().replace(/^["'`«»]+|["'`«».]+$/g, "").replace(/^\s*title\s*[:：-]\s*/i, "").replace(/\s+/g, " ").slice(0, 60);
    if (!title || chat.title !== before) return; // empty, or the user renamed meanwhile
    chat.title = title;
    renderHistory();
    renameChatOnServer(chat, title);
  } catch (_) { /* keep the truncated fallback title */ }
}

function deleteChat(id) {
  const chat = state.chats.find((c) => c.id === id);
  // Abort an in-flight stream for the chat being deleted.
  const s = activeStreams.get(id);
  if (s && s.controller) { try { s.controller.abort(); } catch (_) {} }
  activeStreams.delete(id);
  // Optimistic removal
  state.chats = state.chats.filter((c) => c.id !== id);
  if (state.activeId === id) state.activeId = null;
  renderAll();
  if (chat && chat.serverId) {
    apiJson("/api/chats/" + encodeURIComponent(chat.serverId), { method: "DELETE" })
      .catch(() => showToast(t().chatsSaveError));
  }
}

/** Open a chat from the sidebar, lazily fetching its messages from the server.
    Does NOT stop any stream running in the previously-open chat — that stream
    keeps running headless and saves to its own chat. */
async function openChat(chat) {
  state.activeId = chat.id;
  closeDrawer();

  // serverId == chat.id for fetched chats (set in mapping below); ensure present.
  const sid = chat.serverId || chat.id;
  if (chat.messages == null && sid) {
    renderHistory();
    showThreadLoading();
    try {
      const full = await apiJson("/api/chats/" + encodeURIComponent(sid));
      chat.serverId = full.id || sid;
      chat.title = full.title || chat.title;
      chat.messages = Array.isArray(full.messages) ? full.messages : [];
    } catch (err) {
      chat.messages = chat.messages || [];
      showToast(t().chatsLoadError);
    }
    // If user navigated away while loading, don't clobber the view.
    if (state.activeId !== chat.id) return;
  }
  syncShellLangFromChat();
  renderAll();
  syncStreamingUi();   // reflect whether THIS chat is mid-stream (Send vs Stop)
  flushResumeQueue();  // if this chat's last reply was interrupted, resume it now that it's in view
}

function showThreadLoading() {
  els.welcome.classList.add("hidden");
  els.thread.classList.remove("hidden");
  els.thread.innerHTML = '<div class="thread-loading" aria-live="polite"><span class="thread-loading__dot"></span><span class="thread-loading__dot"></span><span class="thread-loading__dot"></span></div>';
}

/* ----------------------------------------------------------------------------
   Language / shell direction — follows latest USER message
---------------------------------------------------------------------------- */
function applyShellLang(lang) {
  state.lang = lang;
  localStorage.setItem(LS_LANG, lang);
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === "ar" ? "rtl" : "ltr";
  // Apply translated labels
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t()[key]) el.textContent = t()[key];
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const key = el.getAttribute("data-i18n-ph");
    if (t()[key]) el.setAttribute("placeholder", t()[key]);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (t()[key]) el.setAttribute("title", t()[key]);
  });
  els.searchInput.setAttribute("placeholder", t().searchPlaceholder);
  if (typeof updateProductUi === "function") updateProductUi(); // product wordmarks + agent placeholder
  if (els.modeSwitch) buildModeSwitch(); // re-localize Auto/Plan labels + hints
  applyThink();                       // re-localize the thinking tooltip
  if (authEls.screen && !authEls.screen.hidden) renderAuthCopy();
  renderLandingCopy();                // re-localize landing hero copy
}

/** Recompute shell language from the active conversation's latest user msg. */
function syncShellLangFromChat() {
  const chat = activeChat();
  let lang = state.lang;
  if (chat && Array.isArray(chat.messages)) {
    const lastUser = [...chat.messages].reverse().find((m) => m.role === "user");
    if (lastUser) lang = lastUser.lang || detectLang(lastUser.content);
  }
  if (lang !== state.lang) applyShellLang(lang);
}

/* ----------------------------------------------------------------------------
   Theme
---------------------------------------------------------------------------- */
function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem(LS_THEME, theme);
  document.documentElement.setAttribute("data-theme", theme);
  if (els.themeToggle) els.themeToggle.setAttribute("aria-checked", theme === "dark" ? "true" : "false"); // control now lives in Settings
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#262624" : "#FAF9F5");
}

/* ----------------------------------------------------------------------------
   Collapsible sidebar (desktop "taskbar") — hide/restore the conversation list.
   On mobile the drawer behavior is unchanged (this class only affects >768px).
---------------------------------------------------------------------------- */
function applySidebarCollapsed() {
  const collapsed = !!state.sidebarCollapsed;
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  const tg = $("#sidebarToggle");
  if (tg) tg.setAttribute("aria-expanded", collapsed ? "false" : "true");
}
function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = !!collapsed;
  localStorage.setItem(LS_SIDEBAR, String(state.sidebarCollapsed));
  applySidebarCollapsed();
}

/* ----------------------------------------------------------------------------
   Landing / hero (logged-out) — shown FIRST before the auth screen.
---------------------------------------------------------------------------- */
// Feature icons for the landing — reuse the app set, plus a few landing-only ones.
const LANDING_ICONS = {
  spark: ICONS.spark,
  code: ICONS.code,
  bulb: ICONS.bulb,
  file: ICONS.fileDoc,
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
  devices: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="14" height="11" rx="2"/><path d="M2 19h14"/><rect x="17" y="9" width="5" height="11" rx="1.5"/></svg>',
};

// Auto-growing social-proof counts: from a fixed baseline, users grow +100 per
// day and active users +200 every 1.5 days. Computed from the real clock, so the
// numbers rise on their own each day with no manual edits.
function landingUserCounts() {
  const BASE_MS = Date.UTC(2026, 5, 26, 0, 0, 0); // baseline 2026-06-26
  const BASE_USERS = 1200, BASE_ACTIVE = 500;
  const days = Math.max(0, (Date.now() - BASE_MS) / 86400000);
  return {
    // CONTINUOUS (not floored) so the total only ever rises and is the SAME for
    // every visitor at any instant — a pure function of the real clock since
    // launch, never a per-session/per-device value. Users grow faster than active.
    users: Math.round(BASE_USERS + (days / 1.5) * 200),
    active: Math.round(BASE_ACTIVE + days * 100),
  };
}

// Split "+1,200" / "100%" into { prefix, value, suffix } so we can count up to it.
function parseStatNum(str) {
  const m = String(str).match(/^(\D*)([\d,]+)(\D*)$/);
  if (!m) return { prefix: "", value: 0, suffix: "", ok: false };
  return { prefix: m[1], value: parseInt(m[2].replace(/,/g, ""), 10) || 0, suffix: m[3], ok: true };
}
// Count an element from 0 up to `value`, formatting with thousands separators.
function animateCount(el, value, prefix, suffix) {
  const fmt = (n) => prefix + Math.round(n).toLocaleString("en-US") + suffix;
  if (value <= 0) { el.textContent = fmt(value); return; }
  const duration = 600; // fast ascent — runs even under reduced-motion (explicitly wanted)
  let startTs = null;
  const step = (ts) => {
    if (startTs === null) startTs = ts;
    const p = Math.min(1, (ts - startTs) / duration);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    el.textContent = fmt(value * eased);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = fmt(value);
  };
  requestAnimationFrame(step);
}
// Keep the displayed counts in sync with the global, time-based value while the
// page stays open (so a long-open tab stays current). NOT random and NOT
// per-session — it re-reads landingUserCounts(), so every visitor converges to
// the same number. It only ever rises; a tiny pulse flags each real change.
let landingTickTimers = [];
function clearLandingTicks() { landingTickTimers.forEach(clearTimeout); landingTickTimers = []; }
function refreshLandingCounts(wrap, stats, parsed) {
  const c = landingUserCounts();
  stats.forEach((s, i) => {
    if (s.key !== "users" && s.key !== "active") return;
    const el = wrap.querySelector('.landing__stat-val[data-i="' + i + '"]');
    if (!el) return;
    const v = s.key === "users" ? c.users : c.active;
    if (v !== parsed[i].value && v > parsed[i].value) {
      parsed[i].value = v;
      el.textContent = parsed[i].prefix + v.toLocaleString("en-US") + parsed[i].suffix;
      el.classList.remove("is-bumped"); void el.offsetWidth; el.classList.add("is-bumped");
    }
  });
}

function renderLandingStats(tr) {
  const wrap = $("#landingStats");
  if (!wrap || !Array.isArray(tr.landingStats)) return;
  clearLandingTicks();
  const counts = landingUserCounts();
  const stats = tr.landingStats.map((s) => {
    if (s.key === "users") return Object.assign({}, s, { num: "+" + counts.users.toLocaleString("en-US") });
    if (s.key === "active") return Object.assign({}, s, { num: "+" + counts.active.toLocaleString("en-US") });
    return s;
  });
  const parsed = stats.map((s) => parseStatNum(s.num));
  wrap.innerHTML = stats.map((s, i) =>
    '<div class="landing__stat">' +
      '<span class="landing__stat-num">' +
        (s.live ? '<span class="landing__stat-dot" aria-hidden="true"></span>' : "") +
        '<span class="landing__stat-val" data-i="' + i + '">' +
          escapeHtml(parsed[i].ok ? parsed[i].prefix + "0" + parsed[i].suffix : s.num) +
        "</span>" +
      "</span>" +
      '<span class="landing__stat-label">' + escapeHtml(s.label) + "</span>" +
    "</div>"
  ).join('<span class="landing__stat-div" aria-hidden="true"></span>');
  // Count up only when the stats actually scroll INTO VIEW — the row sits below
  // the hero, so animating on load would finish before the user ever sees it.
  // Then start a slow live tick on the user/active counters so they keep rising.
  const run = () => {
    // Count up from 0 to the CURRENT global value (fast). On every reload this
    // catches up to wherever the total has reached — it never resets to baseline.
    wrap.querySelectorAll(".landing__stat-val").forEach((el) => {
      const p = parsed[+el.dataset.i];
      if (p && p.ok) animateCount(el, p.value, p.prefix, p.suffix);
    });
    // Then keep it current (same value for everyone) while the page stays open.
    const loop = () => {
      refreshLandingCounts(wrap, stats, parsed);
      const t = setTimeout(loop, 3000);
      landingTickTimers.push(t);
    };
    const t0 = setTimeout(loop, 1000);
    landingTickTimers.push(t0);
  };
  if (wrap._countObs) { wrap._countObs.disconnect(); wrap._countObs = null; }
  let started = false;
  const start = () => { if (started) return; started = true; if (wrap._countObs) { wrap._countObs.disconnect(); wrap._countObs = null; } run(); };
  if (typeof IntersectionObserver === "function") {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) start();
    }, { threshold: 0.15 }); // low threshold so short/landscape viewports still trigger
    wrap._countObs = io;
    io.observe(wrap);
    // Fallback: if the row never reaches the threshold (never scrolled, clipped),
    // fill the final values after a short delay so they're never stuck at 0.
    const fb = setTimeout(start, 2500);
    landingTickTimers.push(fb);
  } else {
    run();
  }
}

function renderLandingDetails(tr) {
  const wrap = $("#landingDetails");
  if (!wrap) return;
  const feats = (tr.landingFeatures || []).map((f) =>
    '<div class="landing__feature">' +
      '<span class="landing__feature-ico" aria-hidden="true">' + (LANDING_ICONS[f.icon] || ICONS.spark) + "</span>" +
      '<div class="landing__feature-tx">' +
        '<h3 class="landing__feature-title">' + escapeHtml(f.title) + "</h3>" +
        '<p class="landing__feature-desc">' + escapeHtml(f.desc) + "</p>" +
      "</div>" +
    "</div>"
  ).join("");
  wrap.innerHTML =
    '<header class="landing__details-head">' +
      '<h2 class="landing__details-title">' + escapeHtml(tr.landingFeaturesTitle || "") + "</h2>" +
      '<p class="landing__details-sub">' + escapeHtml(tr.landingFeaturesSub || "") + "</p>" +
    "</header>" +
    '<div class="landing__features">' + feats + "</div>" +
    '<div class="landing__imgnote">' +
      '<span class="landing__imgnote-ico" aria-hidden="true">' + LANDING_ICONS.image + "</span>" +
      '<div class="landing__imgnote-tx">' +
        '<h3 class="landing__imgnote-title">' + escapeHtml(tr.landingImageTitle || "") +
          '<span class="landing__imgnote-badge">' + escapeHtml(tr.landingImageBadge || "") + "</span>" +
        "</h3>" +
        '<p class="landing__imgnote-body">' + escapeHtml(tr.landingImageBody || "") + "</p>" +
      "</div>" +
    "</div>";
}

function renderLandingCopy() {
  const screen = $("#landingScreen");
  if (screen && screen.hidden) return; // don't rebuild/observe while logged in (hidden)
  const tr = t();
  const about = $("#landingAbout");
  const start = $("#landingStart");
  if (about) about.textContent = tr.landingAbout;
  if (start) start.textContent = tr.landingStart;
  renderLandingStats(tr);
  renderLandingDetails(tr);
}
function showLanding() {
  const landing = $("#landingScreen");
  if (authEls.screen) authEls.screen.hidden = true;
  if (els.appShell) els.appShell.hidden = true;
  if (landing) {
    landing.hidden = false;   // unhide BEFORE rendering (renderLandingCopy skips a hidden screen)
    renderLandingCopy();
    injectBrandMarks(landing);
  }
}
function hideLanding() {
  const landing = $("#landingScreen");
  if (landing) landing.hidden = true;
  clearLandingTicks(); // stop the live counters once the landing is dismissed
}

/* ----------------------------------------------------------------------------
   Thinking toggle (device pref) — on = accuracy, off = speed
---------------------------------------------------------------------------- */
function applyThink() {
  if (els.thinkToggle) {
    // On Max, thinking is disabled — always render the toggle OFF (clicking it shows the
    // "can't use thinking in Max" message), so the UI matches the actual behavior.
    const effectiveOn = state.think && state.tier !== "max";
    els.thinkToggle.classList.toggle("is-on", effectiveOn);
    els.thinkToggle.setAttribute("aria-checked", effectiveOn ? "true" : "false");
    els.thinkToggle.title = state.tier === "max" ? t().thinkMaxBlocked : (state.think ? t().thinkOn : t().thinkOff);
  }
  updateToolsBadge();
}
function setThink(on) {
  // Thinking is disabled on Firas Max (it can be steered to break the safety limits).
  // Keep the toggle present, but refuse to turn it ON and explain why.
  if (on && state.tier === "max") { showToast(t().thinkMaxBlocked); return; }
  state.think = !!on;
  localStorage.setItem(LS_THINK, String(state.think));
  applyThink();
}
function applyWebSearch() {
  if (els.searchToggle) {
    els.searchToggle.classList.toggle("is-on", state.webSearch);
    els.searchToggle.setAttribute("aria-checked", state.webSearch ? "true" : "false");
    els.searchToggle.title = state.webSearch ? (t().searchOn || "Web search: on") : (t().searchOff || "Web search: off");
  }
  updateToolsBadge();
}
function setWebSearch(on) {
  state.webSearch = !!on;
  localStorage.setItem(LS_WEBSEARCH, String(state.webSearch));
  applyWebSearch();
}
/* Tools "+" menu (holds Web search + Thinking) */
function updateToolsBadge() {
  if (els.toolsMenu) els.toolsMenu.classList.toggle("has-active", !!(state.think || state.webSearch));
}
function openToolsMenu() {
  if (!els.toolsMenuPanel || !els.toolsMenu) return;
  els.toolsMenuPanel.hidden = false;
  els.toolsMenu.classList.add("is-open");
  if (els.toolsMenuBtn) els.toolsMenuBtn.setAttribute("aria-expanded", "true");
  setTimeout(() => {
    document.addEventListener("click", _onToolsDocClick, true);
    document.addEventListener("keydown", _onToolsKeydown, true);
  }, 0);
}
function closeToolsMenu() {
  if (!els.toolsMenuPanel || !els.toolsMenu) return;
  els.toolsMenuPanel.hidden = true;
  els.toolsMenu.classList.remove("is-open");
  if (els.toolsMenuBtn) els.toolsMenuBtn.setAttribute("aria-expanded", "false");
  document.removeEventListener("click", _onToolsDocClick, true);
  document.removeEventListener("keydown", _onToolsKeydown, true);
}
function _onToolsDocClick(e) {
  if (els.toolsMenu && !els.toolsMenu.contains(e.target)) closeToolsMenu();
}
function _onToolsKeydown(e) {
  if (e.key === "Escape") { e.preventDefault(); closeToolsMenu(); if (els.toolsMenuBtn) els.toolsMenuBtn.focus(); }
}

/* ----------------------------------------------------------------------------
   Tier switcher
---------------------------------------------------------------------------- */
function buildTierSwitch() {
  els.tierSwitch.innerHTML = "";
  Object.values(MODELS).forEach((m) => {
    const btn = document.createElement("button");
    btn.className = "tier-switch__btn" + (m.key === state.tier ? " is-active" : "");
    btn.dataset.tier = m.key;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", m.key === state.tier ? "true" : "false");
    btn.title = m.tagline[state.lang];
    btn.innerHTML =
      `<span class="tier-ico">${TIER_ICON[m.key]}</span>` +
      `<span class="tier-name" data-short="${m.short[state.lang]}">${m.short[state.lang]}</span>`;
    btn.addEventListener("click", () => setTier(m.key));
    els.tierSwitch.appendChild(btn);
  });
}
function setTier(key) {
  if (!MODELS[key]) return;
  const changed = state.tier !== key;
  state.tier = key;
  localStorage.setItem(LS_TIER, key);
  els.tierSwitch.querySelectorAll(".tier-switch__btn").forEach((b) => {
    const on = b.dataset.tier === key;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
    if (on && changed) {
      // Replay the professional "switch" pop/glow on the newly-selected tier.
      b.classList.remove("just-activated");
      void b.offsetWidth; // force reflow so the animation restarts every switch
      b.classList.add("just-activated");
      setTimeout(() => b.classList.remove("just-activated"), 700);
    }
  });
  applyThinkAvailability();
  applyThink(); // refresh the toggle's on/off state for the new tier (off on Max)
}
/** Hide the Thinking toggle on tiers that don't support it (Mini), so the UI matches
    behavior. It stays visible on Pro/Ultra (works) and Max (shown, but setThink refuses
    it with a message). */
function applyThinkAvailability() {
  if (!els.thinkToggle) return;
  const m = MODELS[state.tier];
  els.thinkToggle.style.display = (m && m.showThinking) ? "" : "none";
}

/* ----------------------------------------------------------------------------
   Response-mode selector (Auto / Plan) — COMPACT DROPDOWN in the composer.
   A trigger button shows the current mode + a caret; clicking opens a small menu
   listing both modes (with hint text). Distinct from the tier switcher: the tier
   picks the brain, the mode picks HOW Firas works. Default = Auto. Persisted.
   Keyboard-accessible, localized, RTL-aware.
---------------------------------------------------------------------------- */
let _modeMenuOpen = false;

function buildModeSwitch() {
  if (!els.modeSwitch) return;
  const wrap = els.modeSwitch;
  wrap.innerHTML = "";
  wrap.classList.add("mode-select");

  const cur = MODES[state.mode] || MODES.auto;
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "mode-select__trigger";
  trigger.id = "modeSelectTrigger";
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.title = cur.hint(state.lang);
  trigger.innerHTML =
    `<span class="mode-ico" aria-hidden="true">${cur.icon}</span>` +
    `<span class="mode-name">${escapeHtml(cur.label(state.lang))}</span>` +
    `<span class="mode-select__caret" aria-hidden="true">${ICONS.caretDown}</span>`;
  trigger.addEventListener("click", (e) => { e.stopPropagation(); toggleModeMenu(); });
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openModeMenu(); }
  });
  wrap.appendChild(trigger);
}

function buildModeMenu() {
  const menu = document.createElement("div");
  menu.className = "mode-select__menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", t().modeLabel);
  Object.values(MODES).forEach((m) => {
    const on = m.key === state.mode;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "mode-select__item" + (on ? " is-active" : "");
    item.setAttribute("role", "menuitemradio");
    item.setAttribute("aria-checked", on ? "true" : "false");
    item.dataset.mode = m.key;
    item.tabIndex = -1;
    item.innerHTML =
      `<span class="mode-ico" aria-hidden="true">${m.icon}</span>` +
      `<span class="mode-select__item-text">` +
        `<span class="mode-select__item-label">${escapeHtml(m.label(state.lang))}</span>` +
        `<span class="mode-select__item-hint">${escapeHtml(m.hint(state.lang))}</span>` +
      `</span>` +
      `<span class="mode-select__check" aria-hidden="true">${on ? ICONS.check : ""}</span>`;
    item.addEventListener("click", () => { setMode(m.key); closeModeMenu(); });
    menu.appendChild(item);
  });
  return menu;
}

function _onModeDocClick(e) {
  if (!els.modeSwitch.contains(e.target)) closeModeMenu();
}
function _onModeKeydown(e) {
  const menu = els.modeSwitch.querySelector(".mode-select__menu");
  if (!menu) return;
  const items = Array.from(menu.querySelectorAll('[role="menuitemradio"]'));
  const i = items.indexOf(document.activeElement);
  if (e.key === "Escape") { e.preventDefault(); const tg = $("#modeSelectTrigger"); closeModeMenu(); tg && tg.focus(); }
  else if (e.key === "ArrowDown") { e.preventDefault(); items[(Math.max(0, i) + 1) % items.length].focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  else if (e.key === "Tab") { closeModeMenu(); }
  else if (e.key === "Enter" || e.key === " ") {
    if (i > -1) { e.preventDefault(); items[i].click(); }
  }
}
function openModeMenu() {
  if (_modeMenuOpen || !els.modeSwitch) return;
  const trigger = $("#modeSelectTrigger");
  if (!trigger) return;
  const menu = buildModeMenu();
  els.modeSwitch.appendChild(menu);
  els.modeSwitch.classList.add("is-open");
  trigger.setAttribute("aria-expanded", "true");
  _modeMenuOpen = true;
  setTimeout(() => {
    document.addEventListener("click", _onModeDocClick, true);
    document.addEventListener("keydown", _onModeKeydown, true);
  }, 0);
  const active = menu.querySelector(".is-active") || menu.querySelector('[role="menuitemradio"]');
  if (active) active.focus();
}
function closeModeMenu() {
  if (!_modeMenuOpen || !els.modeSwitch) return;
  const menu = els.modeSwitch.querySelector(".mode-select__menu");
  if (menu) menu.remove();
  els.modeSwitch.classList.remove("is-open");
  const trigger = $("#modeSelectTrigger");
  if (trigger) trigger.setAttribute("aria-expanded", "false");
  document.removeEventListener("click", _onModeDocClick, true);
  document.removeEventListener("keydown", _onModeKeydown, true);
  _modeMenuOpen = false;
}
function toggleModeMenu() {
  if (_modeMenuOpen) closeModeMenu(); else openModeMenu();
}
function setMode(key) {
  if (!MODES[key]) return;
  state.mode = key;
  localStorage.setItem(LS_MODE, key);
  buildModeSwitch(); // refresh trigger label/icon
}

/* ----------------------------------------------------------------------------
   Rendering — sidebar history
---------------------------------------------------------------------------- */
function groupKey(ts) {
  const now = new Date(); const d = new Date(ts);
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.floor((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days <= 7) return "previous7";
  if (days <= 30) return "previous30";
  return "older";
}
const GROUP_ORDER = ["today", "yesterday", "previous7", "previous30", "older"];

function renderHistory() {
  const list = els.historyList;
  list.innerHTML = "";
  const q = state.search.trim().toLowerCase();
  // Each PRODUCT owns its chats: AI conversations, Agent missions and Code projects never mix.
  let chats = state.chats.filter((c) =>
    state.product === "code" ? !!c.codeProj
    : state.product === "agent" ? (!!c.agent && !c.codeProj)
    : (!c.agent && !c.codeProj)
  ).sort((a, b) => b.updatedAt - a.updatedAt);
  if (q) chats = chats.filter((c) => (c.title || "").toLowerCase().includes(q));

  if (!chats.length) {
    const empty = document.createElement("div");
    empty.className = "history__empty";
    empty.textContent = q ? t().noResults : t().emptyHistory;
    list.appendChild(empty);
    return;
  }

  // Pinned chats float to the top under their own label; the rest group by date.
  const pinned = chats.filter((c) => c.pinned);
  const rest = chats.filter((c) => !c.pinned);
  if (pinned.length) {
    const label = document.createElement("div");
    label.className = "history__group-label history__group-label--pinned";
    label.innerHTML = `<span class="pin-dot">${ICONS.pin}</span>${t().pinned}`;
    list.appendChild(label);
    pinned.forEach((c) => list.appendChild(chatItemEl(c)));
  }

  const groups = {};
  rest.forEach((c) => { (groups[groupKey(c.updatedAt)] ||= []).push(c); });

  GROUP_ORDER.forEach((g) => {
    if (!groups[g]) return;
    const label = document.createElement("div");
    label.className = "history__group-label";
    label.textContent = t()[g];
    list.appendChild(label);
    groups[g].forEach((c) => list.appendChild(chatItemEl(c)));
  });
}

function chatItemEl(chat) {
  const item = document.createElement("div");
  item.className = "chat-item" + (chat.id === state.activeId ? " is-active" : "") + (chat.pinned ? " is-pinned" : "");
  item.setAttribute("role", "button");
  item.tabIndex = 0;

  const title = document.createElement("div");
  title.className = "chat-item__title";
  title.textContent = chat.title;
  title.dir = detectLang(chat.title) === "ar" ? "rtl" : "ltr";

  const actions = document.createElement("div");
  actions.className = "chat-item__actions";

  const pinBtn = document.createElement("button");
  pinBtn.className = "chat-item__pin" + (chat.pinned ? " is-on" : "");
  pinBtn.setAttribute("aria-label", chat.pinned ? t().unpin : t().pin);
  pinBtn.title = chat.pinned ? t().unpin : t().pin;
  pinBtn.innerHTML = ICONS.pin;
  pinBtn.addEventListener("click", (e) => { e.stopPropagation(); togglePin(chat); });

  const renameBtn = document.createElement("button");
  renameBtn.setAttribute("aria-label", t().rename);
  renameBtn.title = t().rename;
  renameBtn.innerHTML = ICONS.edit;
  renameBtn.addEventListener("click", (e) => { e.stopPropagation(); startRename(chat, item, title); });

  const delBtn = document.createElement("button");
  delBtn.setAttribute("aria-label", t().delete);
  delBtn.title = t().delete;
  delBtn.innerHTML = ICONS.trash;
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (confirm(t().deleteConfirm)) deleteChat(chat.id);
  });

  actions.append(pinBtn, renameBtn, delBtn);
  item.append(title, actions);

  const open = () => { openChat(chat); };
  item.addEventListener("click", open);
  item.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  return item;
}

/** Toggle a conversation's pinned state (optimistic; persisted to the server). */
function togglePin(chat) {
  if (!chat) return;
  chat.pinned = !chat.pinned;
  renderHistory();
  const sid = chat.serverId;
  if (sid) {
    apiJson("/api/chats/" + encodeURIComponent(sid), { method: "PUT", body: JSON.stringify({ pinned: chat.pinned }) })
      .catch(() => showToast(t().chatsSaveError));
  }
  // No serverId yet (brand-new chat): the pin rides along on the next persistChat.
}

function startRename(chat, item, titleEl) {
  const input = document.createElement("input");
  input.value = chat.title;
  input.dir = detectLang(chat.title) === "ar" ? "rtl" : "ltr";
  titleEl.innerHTML = "";
  titleEl.appendChild(input);
  input.focus(); input.select();
  const commit = () => {
    const v = input.value.trim();
    if (v && v !== chat.title) {
      chat.title = v;
      renameChatOnServer(chat, v);
    }
    renderHistory();
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") renderHistory();
  });
  input.addEventListener("click", (e) => e.stopPropagation());
}

/** PUT a rename to the server. Sends messages too when they're loaded. */
function renameChatOnServer(chat, title) {
  const sid = chat.serverId || chat.id;
  if (!chat.serverId) {
    // Chat not yet created on the server (no messages sent). Skip; it will be
    // created with this title on the first message.
    return;
  }
  const payload = { title };
  if (Array.isArray(chat.messages)) payload.messages = serializeMessages(chat.messages);
  apiJson("/api/chats/" + encodeURIComponent(sid), {
    method: "PUT",
    body: JSON.stringify(payload),
  }).catch(() => showToast(t().chatsSaveError));
}

/* ----------------------------------------------------------------------------
   Rendering — welcome / thread
---------------------------------------------------------------------------- */
function renderAll() {
  renderHistory();
  if (state.product === "code") { renderCodeWorkspace(); return; }   // Firas Code = the IDE view
  const chat = activeChat();
  if (!chat || !chat.messages || !chat.messages.length) {
    renderWelcome();
  } else {
    renderThread(chat, true); // opening a chat → scroll to the latest
  }
}

/** Time-of-day greeting, with the signed-in user's first name if available. */
function greetingText() {
  const h = new Date().getHours();
  const base = h < 12 ? t().greetingMorning : h < 18 ? t().greetingAfternoon : t().greetingEvening;
  const first = state.user && state.user.name ? String(state.user.name).trim().split(/\s+/)[0] : "";
  if (!first) return base;
  return state.lang === "ar" ? `${base} يا ${first}` : `${base}, ${first}`;
}

function renderWelcome() {
  els.thread.innerHTML = "";
  els.thread.classList.add("hidden");
  const w = els.welcome;
  w.classList.remove("hidden");
  if (state.product === "agent") {
    // Firas Agent home: its own identity + task starters — a different environment.
    w.innerHTML = `
      <div class="welcome agent-welcome">
        <span class="nib welcome__mark" data-size="lg" aria-hidden="true"><span class="glyph">F</span></span>
        <h1 class="welcome__title">Firas <span class="agent-welcome__grad">Agent</span></h1>
      </div>`;
    injectBrandMarks(w);
    return;
  }
  // Minimal welcome: wordmark + time-of-day greeting. Nothing instructional.
  w.innerHTML = `
    <div class="welcome">
      <span class="nib is-aurora welcome__mark" data-size="lg" aria-hidden="true"><span class="glyph">F</span></span>
      <h1 class="welcome__title">${escapeHtml(greetingText())}</h1>
    </div>`;
  injectBrandMarks(w);
}

function renderThread(chat, forceScroll = false) {
  els.welcome.classList.add("hidden");
  els.thread.classList.remove("hidden");
  els.thread.innerHTML = "";
  chat.messages.forEach((msg, i) => {
    els.thread.appendChild(msg.role === "user" ? userTurnEl(msg) : aiTurnEl(msg, i));
  });
  // Only snap to the bottom when intentionally requested (opening a chat / new
  // message) or when the user is already following along — never yank the view
  // out from under someone who scrolled up to read during a background finalize.
  if (forceScroll || autoScroll) requestAnimationFrame(scrollToBottom);
}

/** Build a usable data-URL from a RAW base64 image (no prefix), sniffing the mime
    from the magic bytes; passes a data-URL through unchanged. */
function rawB64ToDataUrl(b64) {
  if (typeof b64 !== "string" || !b64) return null;
  if (b64.startsWith("data:")) return b64;
  let mime = "image/jpeg";
  if (b64.startsWith("iVBOR")) mime = "image/png";
  else if (b64.startsWith("R0lGOD")) mime = "image/gif";
  else if (b64.startsWith("UklGR")) mime = "image/webp";
  else if (b64.startsWith("/9j/")) mime = "image/jpeg";
  return "data:" + mime + ";base64," + b64;
}

/** Full-screen image viewer for an attached image. Close via the ✕, the backdrop,
    or Esc. One instance at a time. */
function openImageLightbox(src) {
  if (!src) return;
  const prev = document.getElementById("imgLightbox");
  if (prev) prev.remove();
  const ov = document.createElement("div");
  ov.id = "imgLightbox";
  ov.className = "img-lightbox";
  const img = document.createElement("img");
  img.className = "img-lightbox__img";
  img.src = src; img.alt = "";
  const btn = document.createElement("button");
  btn.className = "img-lightbox__close";
  btn.type = "button";
  btn.setAttribute("aria-label", state.lang === "ar" ? "إغلاق" : "Close");
  btn.innerHTML = "&times;";
  ov.appendChild(img); ov.appendChild(btn);
  const close = () => { ov.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target === btn) close(); });
  btn.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(ov);
}

/* A small right-click / long-press context menu with a Copy action — works on every
   device (desktop contextmenu + touch long-press). Used on the user's own messages. */
function closeMsgMenu() {
  const m = document.getElementById("firasMsgMenu"); if (m) m.remove();
  document.removeEventListener("pointerdown", msgMenuDocDown, true);
  document.removeEventListener("keydown", msgMenuKey);
  window.removeEventListener("resize", closeMsgMenu);
  const sc = document.getElementById("chatScroll"); if (sc) sc.removeEventListener("scroll", closeMsgMenu);
}
function msgMenuDocDown(e) { const m = document.getElementById("firasMsgMenu"); if (m && !m.contains(e.target)) closeMsgMenu(); }
function msgMenuKey(e) { if (e.key === "Escape") closeMsgMenu(); }
function openMsgMenu(x, y, text) {
  closeMsgMenu();
  const ar = state.lang === "ar";
  const menu = document.createElement("div");
  menu.id = "firasMsgMenu"; menu.className = "msg-menu";
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "msg-menu__item";
  btn.innerHTML = ICONS.copy + "<span>" + ((t() && t().copy) || (ar ? "نسخ" : "Copy")) + "</span>";
  btn.addEventListener("click", async () => {
    const ok = await copyText(String(text || ""));
    showToast(ok ? ((t() && t().copied) || (ar ? "تم النسخ" : "Copied")) : ((t() && t().copyFailed) || (ar ? "فشل النسخ" : "Copy failed")));
    closeMsgMenu();
  });
  menu.appendChild(btn);
  menu.style.visibility = "hidden";
  document.body.appendChild(menu);
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - mw - 8)) + "px";
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - mh - 8)) + "px";
  menu.style.visibility = "";
  setTimeout(() => {
    document.addEventListener("pointerdown", msgMenuDocDown, true);
    document.addEventListener("keydown", msgMenuKey);
    window.addEventListener("resize", closeMsgMenu);
    const sc = document.getElementById("chatScroll"); if (sc) sc.addEventListener("scroll", closeMsgMenu);
  }, 0);
}
/* Wire right-click + touch long-press on an element to open the copy menu. */
function attachCopyMenu(el, getText) {
  el.addEventListener("contextmenu", (e) => { e.preventDefault(); openMsgMenu(e.clientX, e.clientY, getText()); });
  let lpTimer = null, lpAt = null;
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    lpAt = { x: e.clientX, y: e.clientY };
    lpTimer = setTimeout(() => { lpTimer = null; openMsgMenu(lpAt.x, lpAt.y, getText()); }, 480);
  });
  const cancel = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
  el.addEventListener("pointermove", (e) => { if (lpAt && Math.hypot(e.clientX - lpAt.x, e.clientY - lpAt.y) > 10) cancel(); });
  el.addEventListener("pointerup", cancel);
  el.addEventListener("pointercancel", cancel);
}

function userTurnEl(msg) {
  const turn = document.createElement("div");
  turn.className = "turn msg-user";
  const bubble = document.createElement("div");
  bubble.className = "msg-user__bubble";
  const lang = msg.lang || detectLang(msg.content);
  bubble.dir = lang === "ar" ? "rtl" : "ltr";
  bubble.style.textAlign = "start";

  // Attached image thumbnails (persisted as small data-URL thumbs)
  const thumbs = Array.isArray(msg.imageThumbs) ? msg.imageThumbs : [];
  if (thumbs.length) {
    const gallery = document.createElement("div");
    gallery.className = "msg-user__images";
    gallery.dir = "ltr";
    thumbs.forEach((src, i) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      img.style.cursor = "zoom-in";
      img.title = state.lang === "ar" ? "اضغط للتكبير" : "Click to enlarge";
      // Open the full-res image (kept in-session) when available; else the thumb.
      const fullRaw = Array.isArray(msg.images) ? msg.images[i] : null;
      const big = fullRaw ? (rawB64ToDataUrl(fullRaw) || src) : src;
      img.addEventListener("click", () => openImageLightbox(big));
      gallery.appendChild(img);
    });
    bubble.appendChild(gallery);
  }

  // Attached document chips (PDF / code / text)
  const fileChips = Array.isArray(msg.files) ? msg.files : [];
  if (fileChips.length) {
    const wrap = document.createElement("div");
    wrap.className = "msg-user__files";
    wrap.dir = "ltr";
    fileChips.forEach((f) => {
      const chip = document.createElement("span");
      chip.className = "msg-file-chip";
      const ic = document.createElement("span");
      ic.className = "msg-file-chip__ic";
      ic.textContent = f.kind === "pdf" ? "PDF" : "TXT";
      const nm = document.createElement("span");
      nm.className = "msg-file-chip__nm";
      nm.textContent = f.name || "file";
      chip.appendChild(ic); chip.appendChild(nm);
      wrap.appendChild(chip);
    });
    bubble.appendChild(wrap);
  }

  if (msg.content) {
    const txt = document.createElement("div");
    txt.style.whiteSpace = "pre-wrap";
    txt.textContent = msg.content;
    bubble.appendChild(txt);
    typesetMath(txt);   // render the user's own $…$ / \(…\) / $$…$$ / \[…\] as beautiful math (like AI replies)
  }
  turn.appendChild(bubble);
  if (msg.content) attachCopyMenu(bubble, () => msg.content || "");  // right-click / long-press → Copy
  return turn;
}

function aiTurnEl(msg, index) {
  const tier = MODELS[msg.tier] || MODELS.pro;
  const lang = msg.lang || detectLang(msg.content) || state.lang;

  const turn = document.createElement("div");
  turn.className = "turn msg-ai";
  turn.dataset.index = index;

  // Head: speaker avatar + name + per-message tier badge
  const head = document.createElement("div");
  head.className = "msg-ai__head";
  const inAgentChat = !!(activeChat() && activeChat().agent);
  head.innerHTML = inAgentChat
    ? `<span class="msg-ai__avatar msg-ai__avatar--agent" aria-hidden="true"><span class="glyph">F</span></span>` +
      `<span class="msg-ai__name">Firas Agent</span>` +
      `<span class="msg-ai__badge msg-ai__badge--agent"><span class="dot"></span>AGENT</span>`
    : `<span class="msg-ai__avatar" aria-hidden="true"><span class="glyph">F</span></span>` +
      `<span class="msg-ai__name">Firas</span>` +
      `<span class="msg-ai__badge" data-tier="${tier.key}"><span class="dot"></span>${(tier.short[lang] || tier.short.en).toUpperCase()}</span>`;
  turn.appendChild(head);

  // Thinking disclosure (Pro/Ultra only, when reasoning exists and was enabled)
  if (tier.showThinking && msg.think !== false && msg.reasoning && msg.reasoning.trim()) {
    turn.appendChild(thinkingEl(msg.reasoning, false));
  }

  // Body
  const body = document.createElement("div");
  body.className = "msg-ai__body";
  body.dir = lang === "ar" ? "rtl" : "ltr";
  const md = document.createElement("div");
  md.className = "md";
  const imgMeta = parseImageMeta(msg.content);
  const agentMeta = !imgMeta ? parseAgentMeta(msg.content) : null;
  const deckMeta = !imgMeta && !agentMeta ? parseDeckMeta(msg.content) : null;
  const projMeta = !imgMeta && !agentMeta && !deckMeta ? parseProjectMeta(msg.content) : null;
  const codeMeta = !imgMeta && !agentMeta && !deckMeta && !projMeta ? parseCodeMeta(msg.content) : null;
  const fileFmt = !imgMeta && !agentMeta && !deckMeta && !projMeta && !codeMeta && msg.content && msg.content.trim() ? isFileStreamReply(msg, activeChat()) : null;
  if (agentMeta) {
    md.appendChild(buildAgentCard(agentMeta, lang)); // Firas Agent run (live plan card, survives reload)
  } else if (deckMeta) {
    md.appendChild(buildDeckCard(deckMeta, lang, msg)); // editable slide deck (live build + edit + present)
  } else if (projMeta) {
    md.appendChild(buildProjectCard(projMeta, lang)); // multi-file folder (viewer + ZIP download)
  } else if (imgMeta) {
    md.appendChild(buildImageCard(imgMeta, lang)); // generated image (re-loads on reload)
  } else if (codeMeta) {
    md.appendChild(buildCodeCard(codeMeta, lang)); // code deliverable (copy/download/preview)
  } else if (fileFmt) {
    // File reply: collapsed "view content" disclosure; the file card carries it.
    md.appendChild(buildFileDisclosure(msg.content || ""));
  } else {
    md.innerHTML = renderMarkdown(msg.content || "");
    decorateMarkdown(md);
    decorateFirasAsk(md, msg); // Plan-mode interactive choice lists (re-parsed on reload)
    typesetMath(md);
  }
  body.appendChild(md);
  turn.appendChild(body);

  // File card — when this reply answered a file request (re-derived on render so
  // it survives a reload) and is a real reply (not the offline fallback). Never under an
  // agent/deck card or a clarifying-questions turn — those carry their own UI (a stray file
  // card would export the block JSON as a "document").
  if (msg.content && msg.content.trim() && !msg.offline && !imgMeta && !codeMeta && !deckMeta && !agentMeta && !/^\s*```firas-(?!file)/.test(msg.content)) {
    // A firas-file meta block always earns the card (the Agent's doc deliverables carry one),
    // even when the preceding user message isn't an obvious file request (clarify answers…).
    const fmt = fileMetaFormat(msg, activeChat()) || requestedFormatForAssistant(activeChat(), index);
    if (fmt) {
      const card = fileCardEl(msg, fmt);
      if (card) turn.appendChild(card);
    }
  }

  // Plan-mode "Start" quick-action — one-tap approval to execute the plan.
  if (shouldShowPlanStart(msg)) turn.appendChild(planStartEl(msg));

  // Actions
  turn.appendChild(aiActionsEl(msg, index));
  injectBrandMarks(turn);
  return turn;
}

function thinkingEl(text, open) {
  const wrap = document.createElement("div");
  wrap.className = "thinking" + (open ? " is-open" : "");
  const head = document.createElement("button");
  head.className = "thinking__head";
  head.type = "button";
  head.setAttribute("aria-expanded", open ? "true" : "false");
  head.innerHTML =
    `<span>${t().thinking}</span>` +
    `<span class="thinking__chevron">${ICONS.caret}</span>`;
  const body = document.createElement("div");
  body.className = "thinking__body";
  const inner = document.createElement("div");
  inner.className = "thinking__inner";
  inner.textContent = text;
  body.appendChild(inner);
  head.addEventListener("click", () => {
    const on = wrap.classList.toggle("is-open");
    head.setAttribute("aria-expanded", on ? "true" : "false");
  });
  wrap.append(head, body);
  return wrap;
}

function aiActionsEl(msg, index) {
  const actions = document.createElement("div");
  actions.className = "msg-actions";

  const copyBtn = mkAction(ICONS.copy, t().copy);
  copyBtn.addEventListener("click", async () => {
    const ok = await copyText(msg.content);
    if (ok) {
      copyBtn.querySelector("span").textContent = t().copied;
      const svg = copyBtn.querySelector("svg");
      if (svg) svg.outerHTML = `<span class="ok">${ICONS.check}</span>`;
    } else {
      showToast(t().copyFailed);
    }
    setTimeout(() => { copyBtn.innerHTML = `${ICONS.copy}<span>${t().copy}</span>`; }, 1400);
  });

  const regenBtn = mkAction(ICONS.regen, t().regenerate);
  regenBtn.addEventListener("click", () => regenerate(index, msg.tier));

  actions.append(copyBtn, regenBtn);

  // Per-message export dropdown intentionally removed — file downloads now use
  // the prominent file card shown only when the user actually requested a file.
  // (exportControlEl + the export functions are kept; the card reuses them.)
  return actions;
}

/** The prominent one-tap "Start" pill shown under a plan-mode reply (a plan or
    clarifying questions). One click sends an approval message through the normal
    send path so Firas executes. Plan mode only; never for the offline fallback. */
function planStartEl(msg) {
  const lang = msg.lang || detectLang(msg.content) || state.lang;
  const wrap = document.createElement("div");
  wrap.className = "plan-start";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "plan-start__btn";
  btn.title = STR[lang].planStartHint;
  btn.innerHTML = `<span class="plan-start__ico" aria-hidden="true">${ICONS.play}</span><span>${STR[lang].planStart}</span>`;
  btn.addEventListener("click", () => {
    if (state.streaming) return;
    btn.disabled = true;
    wrap.remove();
    approvePlan(lang);
  });
  wrap.appendChild(btn);
  return wrap;
}

/* ----------------------------------------------------------------------------
   PLAN-MODE interactive CHOICE LISTS (the `firas-ask` block)
   The model emits one ```firas-ask``` fenced block whose body is JSON. On a
   FINALIZED assistant message we detect that block, parse it safely, and replace
   it with an interactive panel of selectable cards (radios / checkboxes) with a
   "Recommended" badge (pre-selected). The user picks and hits Continue; we build
   a concise summary message and send it through the normal sendMessage path so
   Firas proceeds to the plan. Malformed/partial JSON falls back to the raw text.
---------------------------------------------------------------------------- */

/** Validate a parsed firas-ask payload into a safe, normalized shape, or null. */
function normalizeAskSpec(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.questions)) return null;
  const questions = [];
  for (const q of raw.questions.slice(0, 4)) {
    if (!q || typeof q !== "object") continue;
    const text = typeof q.question === "string" ? q.question.trim() : "";
    const opts = Array.isArray(q.options) ? q.options : [];
    const options = [];
    for (const o of opts.slice(0, 5)) {
      if (!o || typeof o !== "object") continue;
      const label = typeof o.label === "string" ? o.label.trim() : "";
      if (!label) continue;
      options.push({
        label,
        desc: typeof o.desc === "string" ? o.desc.trim() : "",
        recommended: !!o.recommended,
      });
    }
    if (!text || options.length < 2) continue;
    questions.push({
      id: typeof q.id === "string" && q.id.trim() ? q.id.trim() : "q" + questions.length,
      question: text,
      multi: !!q.multi,
      options,
    });
  }
  if (!questions.length) return null;
  return { intro: typeof raw.intro === "string" ? raw.intro.trim() : "", questions };
}

/** Extract + parse the FIRST firas-ask block from raw markdown. Returns
    { spec, raw } or null. Tolerant of a missing closing fence (won't run
    mid-stream anyway). */
function parseFirasAsk(content) {
  if (!content || content.indexOf("firas-ask") === -1) return null;
  const m = content.match(/```[ \t]*firas-ask[ \t]*\r?\n([\s\S]*?)```/i);
  if (!m) return null;
  let body = m[1].trim();
  if (!body) return null;
  try {
    const spec = normalizeAskSpec(JSON.parse(body));
    return spec ? { spec, raw: m[0] } : null;
  } catch (_) {
    return null; // malformed/partial JSON -> graceful fallback to raw text
  }
}

/** Replace the rendered firas-ask code block inside `mdEl` with an interactive
    choice panel. Safe to call repeatedly (no-op if already replaced or already
    answered). XSS-safe: every label/desc/intro is set via textContent. */
function decorateFirasAsk(mdEl, msg) {
  if (!mdEl || msg.offline) return;

  // The streaming loader placeholder (renderMarkdown masks every firas-ask block
  // as this). On finalize we either swap it for the cards (parse OK) or reveal
  // the readable text (parse failed) so it NEVER stays stuck.
  const loader = mdEl.querySelector(".firas-ask-loading");

  const parsed = parseFirasAsk(msg.content || "");
  if (!parsed) {
    // Malformed / partial / no valid block on finalize: don't leave a dangling
    // loader. Reveal the message content as normal readable markdown instead.
    if (loader) {
      const tmp = document.createElement("div");
      tmp.innerHTML = renderMarkdown(msg.content || "", { revealAsk: true });
      decorateMarkdown(tmp);
      mdEl.replaceChildren(...tmp.childNodes);
      typesetMath(mdEl);
    }
    return;
  }

  // Find the node to replace: the loader placeholder first, then (legacy/robust)
  // the rendered <pre><code class="language-firas-ask"> or a JSON-looking <pre>.
  let target = loader;
  if (!target) {
    const codeEl = mdEl.querySelector('code.language-firas-ask, code[class*="firas-ask"]');
    if (codeEl) {
      target = codeEl.closest(".code-block") || codeEl.closest("pre") || codeEl;
    } else {
      const pre = Array.from(mdEl.querySelectorAll("pre")).find((p) =>
        /"questions"\s*:/.test(p.textContent || "")
      );
      if (pre) target = pre.closest(".code-block") || pre;
    }
  }
  if (!target || !target.parentNode) return;

  const answered = msg.askAnswered === true;
  const panel = buildAskPanel(parsed.spec, msg, answered);
  target.replaceWith(panel);
}

/** Build the interactive choice panel DOM for a normalized firas-ask spec. */
function buildAskPanel(spec, msg, answered) {
  const lang = msg.lang || detectLang(msg.content) || state.lang;
  const S = STR[lang] || t();
  const dir = lang === "ar" ? "rtl" : "ltr";

  const panel = document.createElement("div");
  panel.className = "firas-ask" + (answered ? " is-answered" : "");
  panel.dir = dir;
  panel.setAttribute("role", "group");

  if (spec.intro) {
    const intro = document.createElement("p");
    intro.className = "firas-ask__intro";
    intro.textContent = spec.intro;
    panel.appendChild(intro);
  }

  const name = "ask-" + (msg.askUid || (msg.askUid = uid()));
  const groups = [];
  const steps = [];
  const total = spec.questions.length;
  const num = (n) => (lang === "ar" ? String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]) : String(n));

  spec.questions.forEach((q, qi) => {
    const fs = document.createElement("fieldset");
    fs.className = "ask-q";
    if (qi !== 0) fs.hidden = true; // one question at a time (wizard)
    const legend = document.createElement("legend");
    legend.className = "ask-q__title";
    if (total > 1) {
      const stepEl = document.createElement("span");
      stepEl.className = "ask-q__step";
      stepEl.textContent = S.askStep + " " + num(qi + 1) + " / " + num(total);
      legend.appendChild(stepEl);
    }
    const qEl = document.createElement("span");
    qEl.className = "ask-q__q";
    qEl.textContent = q.question;
    legend.appendChild(qEl);
    fs.appendChild(legend);

    const inputs = [];
    const list = document.createElement("div");
    list.className = "ask-q__opts";
    list.setAttribute("role", q.multi ? "group" : "radiogroup");

    q.options.forEach((opt, oi) => {
      const id = name + "-" + qi + "-" + oi;
      const card = document.createElement("label");
      card.className = "choice-card";
      card.setAttribute("for", id);

      const input = document.createElement("input");
      input.type = q.multi ? "checkbox" : "radio";
      input.className = "choice-card__input";
      input.id = id;
      input.name = q.multi ? id : name + "-" + qi; // shared name for radios
      input.value = String(oi);
      if (opt.recommended) input.checked = true; // pre-select recommendation(s)
      if (answered) input.disabled = true;

      const mark = document.createElement("span");
      mark.className = "choice-card__mark";
      mark.setAttribute("aria-hidden", "true");

      const main = document.createElement("span");
      main.className = "choice-card__main";
      const labelRow = document.createElement("span");
      labelRow.className = "choice-card__label-row";
      const labelEl = document.createElement("span");
      labelEl.className = "choice-card__label";
      labelEl.textContent = opt.label;
      labelRow.appendChild(labelEl);
      if (opt.recommended) {
        const badge = document.createElement("span");
        badge.className = "choice-card__badge";
        badge.textContent = S.askRecommended;
        labelRow.appendChild(badge);
      }
      main.appendChild(labelRow);
      if (opt.desc) {
        const descEl = document.createElement("span");
        descEl.className = "choice-card__desc";
        descEl.textContent = opt.desc;
        main.appendChild(descEl);
      }

      card.append(input, mark, main);
      list.appendChild(card);
      inputs.push({ input, opt });
    });

    fs.appendChild(list);
    panel.appendChild(fs);
    steps.push(fs);
    groups.push({ q, inputs });
  });

  // Footer: a free-text detail (last step only) + Back / Next|Confirm nav, so the
  // user steps through ONE question at a time (like a wizard) instead of a stack.
  const foot = document.createElement("div");
  foot.className = "firas-ask__foot";

  const extra = document.createElement("input");
  extra.type = "text";
  extra.className = "firas-ask__extra";
  extra.placeholder = S.askExtraPlaceholder;
  extra.dir = dir;
  if (answered) extra.disabled = true;

  const nav = document.createElement("div");
  nav.className = "firas-ask__nav";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "firas-ask__back";
  backBtn.innerHTML = `<span aria-hidden="true">${ICONS.caret}</span><span>${escapeHtml(S.askBack)}</span>`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "firas-ask__continue";

  let step = answered ? total - 1 : 0;
  const isLast = () => step >= total - 1;

  const renderNav = () => {
    if (answered) {
      backBtn.hidden = true;
      nextBtn.disabled = true;
      nextBtn.innerHTML = `<span>${escapeHtml(S.askAnswered)}</span><span class="firas-ask__ok" aria-hidden="true">${ICONS.check}</span>`;
      extra.hidden = true;
      return;
    }
    backBtn.hidden = step === 0;
    extra.hidden = !isLast();
    if (isLast()) {
      nextBtn.innerHTML = `<span>${escapeHtml(S.askSubmit)}</span><span class="firas-ask__ok" aria-hidden="true">${ICONS.check}</span>`;
    } else {
      nextBtn.innerHTML = `<span>${escapeHtml(S.askContinue)}</span><span aria-hidden="true">${ICONS.caret}</span>`;
    }
  };

  const showStep = (i) => {
    step = Math.max(0, Math.min(total - 1, i));
    steps.forEach((s, idx) => (s.hidden = idx !== step));
    renderNav();
    const f = steps[step] && steps[step].querySelector(".choice-card__input");
    if (f) { try { f.focus(); } catch (_) {} }
  };

  backBtn.addEventListener("click", () => {
    if (answered || state.streaming) return;
    showStep(step - 1);
  });

  nextBtn.addEventListener("click", () => {
    if (answered || state.streaming || msg.askAnswered) return;
    if (!isLast()) { showStep(step + 1); return; }
    const summary = buildAskSummary(groups, extra.value, lang);
    if (!summary) return;
    msg.askAnswered = true;
    panel.classList.add("is-answered");
    nextBtn.disabled = true;
    backBtn.disabled = true;
    extra.disabled = true;
    panel.querySelectorAll(".choice-card__input").forEach((i) => (i.disabled = true));
    nextBtn.innerHTML = `<span>${escapeHtml(S.askAnswered)}</span><span class="firas-ask__ok" aria-hidden="true">${ICONS.check}</span>`;
    sendAskAnswer(summary, lang);
  });

  nav.append(backBtn, nextBtn);
  foot.append(extra, nav);
  panel.appendChild(foot);
  renderNav();
  return panel;
}

/** Build a concise localized summary message of the user's picks. */
function buildAskSummary(groups, extraText, lang) {
  const S = STR[lang] || t();
  const sep = lang === "ar" ? "؛ " : "; ";
  const parts = [];
  for (const g of groups) {
    const chosen = g.inputs.filter((x) => x.input.checked).map((x) => x.opt.label);
    if (!chosen.length) continue;
    const label = g.q.question.replace(/[?؟]\s*$/, "").trim();
    parts.push(label + (lang === "ar" ? ": " : ": ") + chosen.join(lang === "ar" ? "، " : ", "));
  }
  const extra = (extraText || "").trim();
  if (!parts.length && !extra) return "";
  let out = "";
  if (parts.length) out = S.askMyChoices + (lang === "ar" ? " — " : " — ") + parts.join(sep);
  if (extra) out = out ? out + "\n" + extra : extra;
  return out;
}

/** Submit the picks through the normal send path so Firas proceeds to the plan. */
function sendAskAnswer(summary, lang) {
  if (state.streaming) return;
  els.input.value = summary;
  autoGrow(); updateSendState();
  sendMessage();
}

/** Send the localized plan-approval message through the normal send path. */
function approvePlan(lang) {
  if (state.streaming) return;
  els.input.value = STR[lang] ? STR[lang].planApproval : t().planApproval;
  autoGrow(); updateSendState();
  sendMessage();
}

/** True when assistant `content` already contains the deliverable: a file card
    will render (file request), or a large/HTML code block. Used to suppress the
    Start pill on an execution/delivery reply. */
function replyContainsDeliverable(msg, chat, index) {
  const content = (msg && msg.content) || "";
  // A requested-file reply → a prominent file card already carries the result.
  if (chat && index > -1 && requestedFormatForAssistant(chat, index)) return true;
  // Any fenced code block that is HTML, or a substantial code block (the build).
  const fences = content.match(/```[\s\S]*?```/g) || [];
  for (const f of fences) {
    const body = f.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
    const langLine = (f.match(/^```([^\n]*)/) || [])[1] || "";
    if (looksLikeHtml(langLine.trim(), body)) return true;
    if (body.length > 400) return true; // a large code deliverable
  }
  return false;
}

/** True when the message immediately BEFORE the assistant at `index` is the user's
    plan-approval message (so this reply is the execution/delivery, not a plan). */
function precededByApproval(chat, index) {
  if (!chat || !Array.isArray(chat.messages) || index < 1) return false;
  const prev = chat.messages[index - 1];
  if (!prev || prev.role !== "user") return false;
  const text = String(prev.content || "").trim();
  if (!text) return false;
  const approvals = [STR.ar.planApproval, STR.en.planApproval];
  if (approvals.some((a) => text === a)) return true;
  // Loose heuristic for hand-typed approvals.
  return /^(ابدأ|نفّذ|نفذ|go ahead|execute|start( executing)?|proceed)\b/i.test(text);
}

/** Whether a finalized assistant message should show the Start pill. Shown ONLY
    on a plan/clarifying reply awaiting approval — NOT on the clarifying-question
    turn (firas-ask cards drive that), NOT on the execution/delivery reply (the
    reply already carries the deliverable, or the user just approved). */
function shouldShowPlanStart(msg) {
  if (!msg || msg.mode !== "plan" || msg.offline) return false;
  if (!msg.content || !msg.content.trim()) return false;
  if (parseFirasAsk(msg.content)) return false; // clarifying-question turn
  const chat = activeChat();
  const index = chat && Array.isArray(chat.messages) ? chat.messages.indexOf(msg) : -1;
  if (precededByApproval(chat, index)) return false; // this is the delivery reply
  // NOTE: we intentionally do NOT suppress on replyContainsDeliverable here. Before
  // approval, a fenced block in a plan turn is a MISTAKE, not a real deliverable —
  // still show Start so the user can approve and get a proper execution.
  return true;
}

function mkAction(icon, label) {
  const b = document.createElement("button");
  b.className = "msg-action";
  b.type = "button";
  b.innerHTML = `${icon}<span>${escapeHtml(label)}</span>`;
  return b;
}

/** A prominent, Claude-style downloadable FILE CARD for a file-request reply.
    Clicking it runs the matching existing exporter on this message's turn.
    `fmt` is re-derived on render (survives reload). XSS-safe + keyboard-accessible. */
function fileCardEl(msg, fmt) {
  const meta = fileFormatMeta(fmt);
  if (!meta) return null;
  // Show the AI-chosen, human-meaningful filename (falls back to a generic name).
  const fileMetaParsed = parseFileMeta(msg && msg.content);
  const name = resolveFileName(fileMetaParsed.meta, meta.ext);
  const label = t()[meta.labelKey];

  const card = document.createElement("div");
  card.className = "file-card";
  card.setAttribute("role", "group");
  card.setAttribute("aria-label", t().fileReady + " — " + name);

  card.innerHTML =
    `<span class="file-card__icon" data-fmt="${escapeHtml(meta.ext)}" aria-hidden="true">${meta.icon}</span>` +
    `<span class="file-card__info">` +
      `<span class="file-card__name" dir="ltr">${escapeHtml(name)}</span>` +
      `<span class="file-card__label">${escapeHtml(label)}</span>` +
    `</span>` +
    ((meta.ext === "pptx" && typeof openDeckPresenter === "function")
      ? `<button type="button" class="file-card__present">▶<span>${escapeHtml(state.lang === "ar" ? "اعرض" : "Present")}</span></button>`
      : "") +
    `<button type="button" class="file-card__dl">${ICONS.download}<span>${escapeHtml(t().fileDownload)}</span></button>`;

  const run = () => {
    const turn = card.closest(".msg-ai");
    meta.run(turn, msg);
  };
  const prBtn = card.querySelector(".file-card__present");
  if (prBtn) prBtn.addEventListener("click", (e) => { e.stopPropagation(); openDeckPresenter(msg); });
  const dlBtn = card.querySelector(".file-card__dl");
  dlBtn.addEventListener("click", (e) => { e.stopPropagation(); run(); });
  // The whole card is clickable too (button stays the primary affordance).
  card.addEventListener("click", run);
  card.tabIndex = 0;
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(); }
  });
  return card;
}

/* ============================================================================
   FILE EXPORT + LIVE HTML PREVIEW
   All CDN libraries are lazy-loaded on first use (initial page load stays fast)
   and every path degrades gracefully — a failed lib shows a toast, never freezes.
   Exports derive from the stored markdown (msg.content) and/or the rendered .md
   DOM node, both already sanitized by renderMarkdown/DOMPurify.
   ========================================================================== */

/** Short id for export filenames: firas-<shortid>.<ext> */
function exportFileId() {
  return "firas-" + Math.random().toString(36).slice(2, 8);
}

/** Trigger a client-side download of a Blob (never-freeze, auto-cleanup). */
function downloadBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (_) {
    showToast(t().formatUnavailable);
  }
}

/* ---- Lazy script loader with timeout + graceful failure ------------------ */
const _scriptCache = Object.create(null);
function loadScriptOnce(src) {
  if (_scriptCache[src]) return _scriptCache[src];
  _scriptCache[src] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    let settled = false;
    const to = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("timeout"));
    }, 15000);
    s.onload = () => { if (!settled) { settled = true; clearTimeout(to); resolve(); } };
    s.onerror = () => {
      if (settled) return;
      settled = true; clearTimeout(to);
      delete _scriptCache[src]; // allow a later retry
      reject(new Error("load"));
    };
    document.head.appendChild(s);
  });
  return _scriptCache[src];
}
/** Load several scripts sequentially (dependency order). */
async function loadScripts(list) {
  for (const src of list) await loadScriptOnce(src);
}

/* CDN endpoints — only fetched on first use of each format. */
const EXPORT_LIBS = {
  pdf: ["https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js", "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"],
  docx: ["https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.js"],
  xlsx: ["https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"],
  pptx: ["https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"],
};

/* ---- Helpers to derive export source from a message ---------------------- */

/** The rendered .md node for an assistant turn (already sanitized + typeset).
    When the content was masked as a file (collapsed disclosure), return the
    disclosure BODY so exports use the document content, not the "View content"
    summary chrome. */
function mdNodeForTurn(turn) {
  if (!turn) return null;
  const body = turn.querySelector(".msg-ai__body .file-disclosure__body");
  if (body) return body;
  return turn.querySelector(".msg-ai__body .md");
}

/* ============================================================================
   SMART FILE GENERATION — themes, metadata, naming, themed document builder.
   The AI emits a small ```firas-file {json}``` block (filename, title, subtitle,
   theme) before the document body. We parse it for the cover page, theming, and
   an intelligent filename, and render the body into a polished, professional file.
   ========================================================================== */

/* Professional document themes. Hex stored without '#'. ink/coverInk are fixed
   (dark text on light pages; light text on the deep cover). Each theme only
   swaps the color story — typography stays consistent and premium. */
const FILE_THEMES = {
  teal:     { accent: "237A68", deep: "15453B", coverAccent: "57AE9C", soft: "F1F6F4", zebra: "F4F8F6" },
  navy:     { accent: "1E3A5F", deep: "12263F", coverAccent: "6098D6", soft: "EEF2F8", zebra: "F1F5FA" },
  burgundy: { accent: "7B2D3A", deep: "511E27", coverAccent: "C77E89", soft: "F7EFF0", zebra: "FAF4F5" },
  emerald:  { accent: "1F6B4D", deep: "123F2E", coverAccent: "58A07E", soft: "EDF5F0", zebra: "F2F8F4" },
  royal:    { accent: "4A3B8C", deep: "2E2459", coverAccent: "9588CC", soft: "F0EEF8", zebra: "F5F3FB" },
  amber:    { accent: "9A6A1E", deep: "684713", coverAccent: "D2A24F", soft: "F8F2E8", zebra: "FBF6EE" },
  slate:    { accent: "3F4A5A", deep: "272E3A", coverAccent: "7E8B9E", soft: "EFF1F4", zebra: "F4F5F8" },
  minimal:  { accent: "2A2A28", deep: "111110", coverAccent: "9A9A95", soft: "F4F4F2", zebra: "F7F7F5" },
  // Dark themes — dark PAGES (not just a dark cover). bg/ink/border drive the page.
  dark:     { accent: "C9A24B", deep: "0E0E0C", coverAccent: "E6CB82", soft: "26251F", zebra: "201F1B", bg: "1A1916", ink: "ECE7DA", border: "3A372E" },
  midnight: { accent: "8FB4E0", deep: "0B1422", coverAccent: "BBD3F1", soft: "1B2433", zebra: "151D29", bg: "121A25", ink: "E5EBF3", border: "2B3748" },
};
/* Mix a 6-digit hex with white (t>0) or black (t<0). t in [0..1]. */
function hexMix(hex, t, toWhite) {
  const h = String(hex).replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex;
  const to = toWhite ? 255 : 0;
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16);
    return Math.round(v + (to - v) * t).toString(16).padStart(2, "0");
  });
  return c.join("").toUpperCase();
}
function themeFor(meta) {
  const key = meta && String(meta.theme || "").toLowerCase().trim();
  const base = FILE_THEMES[key] || FILE_THEMES.teal;
  // DESIGN-ON-REQUEST: when the model set a custom accent (from the user's requested colors/style),
  // derive a full matching theme from that single hex — cover, headings, tables, tints.
  const acc = meta && String(meta.accent || "").replace("#", "").trim();
  if (/^[0-9a-fA-F]{6}$/.test(acc)) {
    return {
      ...base,
      accent: acc.toUpperCase(),
      deep: hexMix(acc, 0.55, false),
      coverAccent: hexMix(acc, 0.45, true),
      soft: hexMix(acc, 0.93, true),
      zebra: hexMix(acc, 0.955, true),
    };
  }
  return base;
}

/** Strip the ```firas-file {json}``` metadata block from content (so it never
    renders in chat, the disclosure, or the exported document body). */
function stripFileMetaBlock(s) {
  return String(s == null ? "" : s).replace(/```firas-file\s*[\s\S]*?```/i, "").replace(/^\s*\n/, "");
}

/** Parse the AI's file metadata block → { meta, body } (body has the block removed). */
function parseFileMeta(content) {
  const src = String(content == null ? "" : content);
  const m = src.match(/```firas-file\s*([\s\S]*?)```/i);
  let meta = {};
  if (m) {
    try { const o = JSON.parse(m[1].trim()); if (o && typeof o === "object") meta = o; } catch (_) {}
  }
  return { meta, body: stripFileMetaBlock(src) };
}

/** A friendly localized date for the cover page. */
function todayStr(lang) {
  try {
    return new Date().toLocaleDateString(lang === "ar" ? "ar" : "en-GB",
      { year: "numeric", month: "long", day: "numeric" });
  } catch (_) { return ""; }
}

/** Resolve an intelligent, safe download filename from the AI metadata.
    Honors the AI's chosen name (Arabic allowed), strips illegal chars, caps
    length, and falls back to the title or a short id. Returns "name.ext". */
function resolveFileName(meta, ext) {
  let name = (meta && (meta.filename || meta.title)) || "";
  name = String(name).trim()
    .replace(/\.(pdf|docx|xlsx|pptx|csv|txt)$/i, "")      // drop any accidental extension
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "")            // illegal filesystem chars
    .replace(/[\s_]+/g, " ")                              // collapse whitespace/underscores
    .trim()
    .slice(0, 80)
    .replace(/[ .]+$/, "");                               // no trailing space/dot (Windows)
  if (!name) return exportFileId() + "." + ext;
  return name + "." + ext;
}

/** Graceful fallback: if the AI didn't emit a metadata title, derive one from the
    document's first heading (so we still get a cover + meaningful filename). Mutates
    and returns `meta`. Accepts a rendered node (querySelector) or raw markdown text. */
function ensureFileTitle(meta, mdNodeOrText) {
  if (!meta || meta.title) return meta || {};
  let title = "";
  if (mdNodeOrText && typeof mdNodeOrText.querySelector === "function") {
    const h = mdNodeOrText.querySelector("h1, h2, h3");
    if (h) title = h.textContent.trim();
  } else if (typeof mdNodeOrText === "string") {
    const m = mdNodeOrText.match(/^\s*#{1,3}\s+(.+)$/m);
    if (m) title = m[1].replace(/[*_`#]/g, "").trim();
  }
  if (title) meta.title = title.slice(0, 120);
  return meta;
}

/** Build a clean, self-contained, THEMED A4 HTML document from a rendered .md
    node + the AI metadata. Adds a premium cover page (title/subtitle/date/brand)
    and a fully themed body (accent headings, themed tables, callouts), RTL-aware
    and print-color-accurate, with page-break control. Used for PDF + Word. */
/** The themed document CSS. `scope` = "" → global (full HTML doc for Word);
    "#firasExportRoot" → scoped to the attached element (PDF), so it never bleeds
    into the app. Dark themes (th.bg/th.ink/th.border) produce dark PAGES. */
// Professional document fonts loaded from Google Fonts and AWAITED before an export
// captures the DOM (otherwise the PDF falls back to plain system fonts). EN = Lora
// (serif body) + Inter (sans headings); AR = Tajawal (body) + Cairo (headings).
let _exportFontsLink = false;
async function ensureExportFonts(isAr) {
  try {
    if (!_exportFontsLink) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Tajawal:wght@400;500;700;800&display=swap";
      document.head.appendChild(l);
      _exportFontsLink = true;
    }
    if (document.fonts && document.fonts.load) {
      // Load against REAL Arabic text (not "1em") so the browser actually fetches the glyphs a
      // title/body needs — some engines lazy-load per codepoint and report "loaded" for an empty
      // sample. Bigger timeout because PHONES on mobile data are slower than desktops; if the
      // webfont still isn't ready the OS-native Arabic font (in the stack) shapes correctly anyway.
      const sample = isAr ? "الفيزياء" : "Reading";
      const want = isAr
        ? ["400 1em Tajawal", "500 1em Tajawal", "700 1em Tajawal", "800 1em Tajawal", "600 1em Cairo", "700 1em Cairo", "800 1em Cairo"]
        : ["400 1em Lora", "500 1em Lora", "700 1em Lora", "italic 400 1em Lora", "500 1em Inter", "600 1em Inter", "700 1em Inter"];
      await Promise.race([
        Promise.all(want.map((f) => document.fonts.load(f, sample).catch(() => {}))).then(() => document.fonts.ready),
        new Promise((r) => setTimeout(r, 6000)),
      ]);
    }
  } catch (_) { /* offline / blocked → system fonts */ }
}

/* ── ③ NAMED DOCUMENT TEMPLATES — full layout identities, not just colors. ── */
function templateCss(tpl, th, isAr, scope) {
  const dp = scope ? scope + " " : "";
  const sans = isAr ? '"Cairo","Tajawal","Noto Sans Arabic","Geeza Pro","Segoe UI","Tahoma",sans-serif' : '"Inter","Helvetica Neue",Arial,sans-serif';
  const serif = isAr ? '"Tajawal","Noto Naskh Arabic","Geeza Pro","Segoe UI","Tahoma",sans-serif' : '"Lora",Georgia,serif';
  const ink = th.ink || "1A1A18";
  if (tpl === "academic") return (
    // Numbered headings (1. / 1.1) + formal light cover + abstract-style first blockquote.
    dp + ".doc{counter-reset:ach1}" +
    dp + ".doc h1{counter-increment:ach1;counter-reset:ach2}" +
    dp + ".doc h1::before{content:counter(ach1) '. ';color:#" + th.accent + "}" +
    dp + ".doc h2{counter-increment:ach2}" +
    dp + ".doc h2::before{content:counter(ach1) '.' counter(ach2) ' ';color:#" + th.accent + "}" +
    dp + ".cover{background:#FBFAF7!important;color:#" + ink + "!important}" +
    dp + ".cover::before," + dp + ".cover::after{display:none}" +
    dp + ".cover__pad{align-items:center;text-align:center}" +
    dp + ".cover__mid{margin-top:34mm}" +
    dp + ".cover__kicker{color:#" + th.accent + "!important;letter-spacing:.22em}" +
    dp + ".cover__title{color:#" + ink + "!important;font-size:30pt}" +
    dp + ".cover__sub{color:rgba(0,0,0,.6)!important;margin-inline:auto}" +
    dp + ".cover__rule{margin-inline:auto;background:#" + th.accent + "!important}" +
    dp + "blockquote{background:#F6F5F1;border-inline-start-color:#" + th.accent + ";font-style:italic}"
  );
  if (tpl === "ministry") return (
    // Official exam paper: centered double-ruled title, hard-bordered tables, bold marks, end mark.
    dp + ".doc>h1:first-of-type{text-align:center;border-top:3px double #" + ink + ";border-bottom:3px double #" + ink + ";padding:.35em 0;font-family:" + serif + "}" +
    dp + "table," + dp + "th," + dp + "td{border:1.6px solid #" + ink + "!important}" +
    dp + "th{background:#EFEDE6!important;color:#" + ink + "!important}" +
    dp + "ol.li-explicit>li>.li-n{color:#" + ink + ";font-size:1.05em}" +
    dp + "strong{color:#" + ink + "}" +
    dp + ".doc::after{content:'— " + (isAr ? "انتهت الأسئلة" : "End of questions") + " —';font-family:" + sans + ";font-size:11pt;color:#" + ink + ";opacity:1}" +
    dp + ".cover{background:linear-gradient(160deg,#" + th.deep + ",#" + th.deep + ")!important}"
  );
  if (tpl === "corporate") return (
    // Executive report: sans headings with accent bars, blockquotes become KPI/callout cards.
    dp + "h1," + dp + "h2," + dp + "h3{font-family:" + sans + "}" +
    dp + "h2{border-inline-start-width:6px;text-transform:none;letter-spacing:0}" +
    dp + "blockquote{background:#" + th.accent + ";color:#fff;border:none;border-radius:10px;padding:1em 1.2em;font-family:" + sans + ";font-weight:600;box-shadow:0 3px 12px rgba(0,0,0,.14)}" +
    dp + "blockquote strong{color:#fff}" +
    dp + ".doc>p:first-of-type{font-size:13pt;font-family:" + sans + ";border-inline-start:4px solid #" + th.accent + ";padding-inline-start:.7em}"
  );
  if (tpl === "magazine") return (
    // Editorial magazine: drop cap, pull-quotes, kicker line over h2.
    dp + ".doc>p:first-of-type::first-letter{font-size:3.1em;line-height:1;font-weight:700;color:#" + th.accent + ";float:" + (isAr ? "right" : "left") + ";padding-inline-end:.12em;font-family:" + serif + "}" +
    dp + "blockquote{background:none;border:none;border-block:2px solid #" + th.accent + ";border-radius:0;text-align:center;font-size:14.5pt;font-style:italic;font-family:" + serif + ";padding:.9em .4em;margin:1.2em 8mm}" +
    dp + "h2{border-inline-start:none;padding-inline-start:0;padding-top:.35em;border-top:3px solid #" + th.accent + ";display:table}"
  );
  return "";
}
/* Infer the best-fit document TEMPLATE from a request (used when the agent delivers a doc, so an
   exam looks ministerial, a thesis academic, a business report corporate, an article editorial). */
function docTemplateFor(task) {
  const t = String(task || "");
  if (/امتحان|اختبار|كويز|ورقة\s*(امتحان|أسئلة)|نموذج\s*امتحان|\bexam\b|\bquiz\b|\btest\s*paper\b/i.test(t)) return "ministry";
  if (/بحث|أطروحة|اطروحة|رسالة\s*(ماجستير|دكتوراه)|أكاديم|اكاديم|thesis|dissertation|research\s*paper|academic/i.test(t)) return "academic";
  if (/تقرير\s*(عمل|شركة|أعمال|إداري)|خطة\s*عمل|دراسة\s*جدوى|business\s*(report|plan)|corporate|executive\s*(summary|report)|\bkpi\b/i.test(t)) return "corporate";
  if (/مقال|article|magazine|مجلة|editorial|blog\s*post|نشرة/i.test(t)) return "magazine";
  return "";
}
/* ① Split a very large document body into VOLUMES on chapter boundaries (## / #), each ≤ maxLen, so a
   mega-book that exceeds the per-message storage cap is delivered as several numbered volume files. */
function splitIntoVolumes(body, maxLen) {
  const parts = String(body || "").split(/(?=^#{1,2}\s)/m);   // keep each heading with its content
  const vols = []; let cur = "";
  for (const p of parts) {
    if (cur && (cur.length + p.length) > maxLen) { vols.push(cur); cur = ""; }
    if (p.length > maxLen) {                                   // a single chapter bigger than a volume → hard-split
      if (cur) { vols.push(cur); cur = ""; }
      for (let i = 0; i < p.length; i += maxLen) vols.push(p.slice(i, i + maxLen));
      continue;
    }
    cur += p;
  }
  if (cur.trim()) vols.push(cur);
  return vols.length ? vols : [String(body || "")];
}
function exportCss(th, isAr, scope, tpl) {
  // Arabic stacks end in OS-native Arabic shapers (Geeza Pro=iOS, Noto=Android, Segoe/Tahoma=Windows)
  // then bare `sans-serif` — the OS default ALWAYS shapes Arabic. Bare "Arial" is dropped: on some
  // phones its Arabic substitution confuses html2canvas → separated/overlapping letters.
  const fontStack = isAr ? '"Tajawal","Noto Naskh Arabic","Geeza Pro","Segoe UI","Tahoma",sans-serif' : '"Lora",Georgia,"Times New Roman","Cambria",serif';
  const sansStack = isAr ? '"Cairo","Tajawal","Noto Sans Arabic","Geeza Pro","Segoe UI","Tahoma",sans-serif' : '"Inter","Helvetica Neue","Segoe UI",Arial,sans-serif';
  const bg = th.bg || "FFFFFF", ink = th.ink || "1A1A18", line = th.border || "D8D6CB";
  const root = scope || "body";
  const dp = scope ? scope + " " : "";
  const rdp = scope ? scope + "[dir=rtl] " : "[dir=rtl] ";
  const rgba = (hex, a) => { const h = String(hex).replace("#", ""); return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")"; };
  return (
    (scope ? scope + "{width:794px;overflow:hidden}" : "@page{size:A4;margin:18mm 16mm}") +
    dp + "*{box-sizing:border-box}" +
    root + "{font-family:" + fontStack + ";color:#" + ink + ";background:#" + bg + ";line-height:1.72;font-size:12.8pt;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-scheme:only light}" +
    // ── COVER: premium layered art — soft accent glows over a deep gradient, a fine ring
    // ornament, elegant serif title. No brand, no date — clean and editorial.
    dp + ".cover{position:relative;height:251mm;color:#FFF;page-break-after:always;break-after:page;overflow:hidden;" +
      "background:radial-gradient(150mm 150mm at 88% -12%," + rgba(th.coverAccent, 0.30) + ",transparent 62%)," +
      "radial-gradient(120mm 120mm at -10% 112%," + rgba(th.coverAccent, 0.22) + ",transparent 60%)," +
      "radial-gradient(70mm 70mm at 14% 22%," + rgba(th.coverAccent, 0.10) + ",transparent 70%)," +
      "linear-gradient(158deg,#" + th.deep + " 0%,#" + hexMix(th.deep, 0.35, false) + " 100%)}" +
    dp + ".cover::before{content:'';position:absolute;top:16mm;inset-inline-end:16mm;width:44mm;height:44mm;border:1.2px solid " + rgba(th.coverAccent, 0.55) + ";border-radius:50%}" +
    dp + ".cover::after{content:'';position:absolute;top:23mm;inset-inline-end:35mm;width:20mm;height:20mm;background:" + rgba(th.coverAccent, 0.16) + ";border-radius:50%}" +
    dp + ".cover__pad{position:absolute;inset:0;padding:26mm 22mm;display:flex;flex-direction:column}" +
    dp + ".cover__brand{font-family:" + sansStack + ";font-size:13pt;font-weight:700;letter-spacing:.06em;color:#" + th.coverAccent + ";text-transform:uppercase}" +
    dp + ".cover__mid{margin-top:auto;margin-bottom:auto}" +
    dp + ".cover__kicker{font-family:" + sansStack + ";font-size:10.5pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:" + rgba(th.coverAccent, 0.95) + ";margin:0 0 6mm}" +
    dp + ".cover__title{font-family:" + fontStack + ";font-size:38pt;line-height:1.18;font-weight:700;margin:0;color:#FFF;text-wrap:balance}" +
    dp + ".cover__sub{font-family:" + sansStack + ";font-size:14pt;line-height:1.55;margin:.7em 0 0;color:rgba(255,255,255,.82);font-weight:400;max-width:120mm}" +
    dp + ".cover__rule{width:52mm;height:3px;background:linear-gradient(90deg,#" + th.coverAccent + "," + rgba(th.coverAccent, 0.25) + ");margin-top:11mm;border-radius:2px}" +
    rdp + ".cover__rule{background:linear-gradient(270deg,#" + th.coverAccent + "," + rgba(th.coverAccent, 0.25) + ")}" +
    dp + ".cover__foot{display:flex;align-items:center;gap:4mm;font-family:" + sansStack + ";font-size:10pt;color:rgba(255,255,255,.55)}" +
    dp + ".cover__foot::before{content:'';flex:0 0 14mm;height:1px;background:rgba(255,255,255,.35)}" +
    dp + ".cover__date{font-family:" + sansStack + ";font-size:11pt;color:rgba(255,255,255,.72)}" +
    dp + ".doc{padding-top:2mm}" +
    // Editorial lead: the opening paragraph reads slightly larger, like a professional report.
    dp + ".doc>p:first-of-type{font-size:13.8pt;line-height:1.78;color:#" + ink + "}" +
    dp + "h1," + dp + "h2," + dp + "h3," + dp + "h4{font-family:" + sansStack + ";color:#" + ink + ";line-height:1.3;font-weight:700;" + (isAr ? "letter-spacing:normal;word-spacing:.04em;" : "letter-spacing:-.01em;") + "page-break-after:avoid;break-after:avoid}" +
    dp + "h1{font-size:23.5pt;margin:.2em 0 .5em;padding-bottom:.24em;border-bottom:2.5px solid #" + th.accent + "}" +
    dp + "h2{font-size:17.5pt;margin:1.35em 0 .5em;color:#" + ink + ";padding-inline-start:.55em;border-inline-start:4.5px solid #" + th.accent + "}" +
    dp + "h3{font-size:14.5pt;margin:1em 0 .4em;color:#" + th.accent + "}" +
    dp + "h4{font-size:13pt;margin:.9em 0 .35em}" +
    dp + "p{margin:0 0 .75em;orphans:2;widows:2}" +
    dp + "ul," + dp + "ol{margin:0 0 .8em;padding-inline-start:1.5em}" + dp + "li{margin:.3em 0;page-break-inside:avoid}" +
    dp + "li::marker{color:#" + th.accent + "}" +
    // Ordered lists whose markers we replaced with explicit inline number spans (buildExportRoot):
    // html2canvas clips/corrupts CSS ::marker digits (the leftmost digit of "60" prints as "30"),
    // so we render the number as ordinary text in a fixed left gutter that NEVER overflows — even
    // for 4-digit numbers in a 1000-problem book.
    dp + "ol.li-explicit{list-style:none;padding-inline-start:0}" +
    dp + "ol.li-explicit>li{margin:.34em 0;page-break-inside:avoid;display:flex;align-items:flex-start;gap:.1em}" +
    dp + "ol.li-explicit>li>.li-n{flex:0 0 auto;min-width:3.1em;text-align:end;padding-inline-end:.55em;color:#" + th.accent + ";font-weight:700;font-variant-numeric:tabular-nums}" +
    dp + "ol.li-explicit>li>.li-body{flex:1 1 auto;min-width:0}" +
    dp + "a{color:#" + th.accent + ";text-decoration:underline}" + dp + "strong{font-weight:700}" + dp + "em{font-style:italic}" +
    dp + "blockquote{margin:.6em 0 1em;padding:.7em 1.1em;border-inline-start:4px solid #" + th.accent + ";background:#" + th.soft + ";color:#" + ink + ";border-radius:0 6px 6px 0;page-break-inside:avoid}" +
    rdp + "blockquote{border-radius:6px 0 0 6px}" +
    dp + "blockquote p:last-child{margin-bottom:0}" +
    dp + "hr{border:none;border-top:1px solid #" + line + ";margin:1.4em 0}" +
    dp + "code{font-family:Consolas,Menlo,monospace;font-size:9.5pt;background:#" + th.soft + ";padding:1px 5px;border-radius:3px;direction:ltr;unicode-bidi:embed}" +
    dp + "pre{background:#1f2422;color:#eef1ef;border-radius:8px;padding:13px 15px;overflow:auto;direction:ltr;text-align:left;page-break-inside:avoid;font-size:10.5pt;line-height:1.55}" +
    dp + "pre code{background:none;padding:0;font-size:inherit;color:inherit}" +
    dp + "table{border-collapse:collapse;width:100%;margin:.6em 0 1.1em;font-size:11pt;page-break-inside:avoid}" +
    dp + "th," + dp + "td{border:1px solid #" + line + ";padding:8px 11px;text-align:start;vertical-align:top}" +
    dp + "th{background:#" + th.accent + ";color:#fff;font-weight:700}" +
    dp + "tr:nth-child(even) td{background:#" + th.zebra + "}" +
    // Never cut a table ROW, equation, list item or figure across a page boundary (native print).
    dp + "tr,td,th{break-inside:avoid;page-break-inside:avoid}" +
    dp + "li,.katex-display,blockquote,pre,figure{break-inside:avoid}" +
    dp + "img{max-width:100%;page-break-inside:avoid;break-inside:avoid;border-radius:6px}" +
    // Real web images placed by the author: centered, framed, magazine-like.
    dp + "p>img:only-child," + dp + "p>img:first-child{display:block;margin:1.1em auto .5em;max-width:88%;max-height:80mm;object-fit:cover;border-radius:10px;box-shadow:0 3px 14px " + rgba(th.deep, 0.22) + ";border:1px solid #" + line + "}" +
    dp + "p>img+em," + dp + "img+em{display:block;text-align:center;font-family:" + sansStack + ";font-size:9.5pt;color:#55534c;margin-top:.2em}" +
    // Editorial end ornament after the last section.
    dp + ".doc::after{content:'❖';display:block;text-align:center;color:#" + th.accent + ";font-size:13pt;margin:2.2em 0 .5em;opacity:.85}" +
    dp + ".tikz-figure{margin:1.1em 0;text-align:center;page-break-inside:avoid;break-inside:avoid}" +
    dp + ".tikz-figure svg{max-width:100%;height:auto}" +
    dp + ".plot-figure{max-width:480px;margin-inline:auto}" +
    dp + ".plot-figure{--plot-c1:#" + th.accent + ";--plot-c2:#2563eb;--plot-c3:#dc2626;--plot-c4:#059669;--plot-c5:#7c3aed}" +
    dp + ".plot-legend{background:#fff;border:1px solid #e5e7eb}" +
    dp + ".plot-legend__lb{color:#374151}" +
    dp + ".plot-figure .plot-bg{fill:#fff;stroke:#d1d5db}" +
    dp + ".plot-figure .plot-grid{stroke:#e8e8e3;opacity:1}" +
    dp + ".plot-figure .plot-axis{stroke:#374151}" +
    dp + ".plot-figure .plot-arrow{fill:#374151}" +
    dp + ".plot-figure .plot-tick{fill:#4b5563;font-size:9px}" +
    dp + ".plot-figure .plot-axislabel{fill:#374151;font-size:10.5px;font-style:italic}" +
    dp + ".plot-figure .plot-curve{fill:none}" +
    dp + ".plot-figure .plot-legend-bg{fill:#fff;opacity:.9;stroke:#e5e7eb}" +
    dp + ".plot-figure svg{width:auto;max-width:100%;height:auto;display:block;margin-inline:auto}" +   // definite size for print (override screen width:100%)
    dp + ".plot-legend{direction:ltr}" +                                                                 // keep legend math LTR inside an RTL doc
    dp + ".plot-legend__lb .katex{direction:ltr}" +
    dp + ".katex{font-size:1.05em}" +
    dp + ".katex-display{margin:1.15em 0;max-width:100%;overflow:visible;page-break-inside:avoid;direction:ltr;text-align:center}" +
    dp + ".katex{max-width:100%;direction:ltr}" +
    dp + ".katex-display>.katex{display:inline-block;text-align:initial}" +
    // KaTeX hides its raw-LaTeX MathML via clip; html2canvas IGNORES clip and would paint the raw
    // "\sin(6\theta)" source next to the rendered math. Force it hidden so PDFs show ONLY pretty math.
    dp + ".katex-mathml{display:none!important}" +
    templateCss(String(tpl || "").toLowerCase().trim(), th, isAr, scope) +
    // ═══ INK ARMOR (last — beats everything, incl. template CSS) ═══════════════════════════════
    // Dark-mode extensions (Dark Reader) and Chrome's Auto Dark rewrite the page's computed colors
    // to LIGHT text; the capture then paints light text on the forced-white page → a washed-out,
    // unreadable PDF (real user report). Force full-black ink + full opacity, and opt the export
    // out of auto-dark. Cover (white-on-deep) and table headers (white-on-accent) are re-asserted.
    dp + ".doc," + dp + ".doc *{opacity:1!important;filter:none!important;mix-blend-mode:normal!important;-webkit-text-fill-color:currentColor!important;color-scheme:only light}" +
    dp + ".doc p," + dp + ".doc li," + dp + ".doc td," + dp + ".doc strong," + dp + ".doc em," + dp + ".doc div," + dp + ".doc span," + dp + ".doc figcaption{color:#000!important}" +
    dp + ".doc h1," + dp + ".doc h2," + dp + ".doc h4{color:#" + ink + "!important}" +
    dp + ".doc h3{color:#" + th.accent + "!important}" +
    dp + ".doc .li-n{color:#" + th.accent + "!important}" +
    dp + ".doc .katex," + dp + ".doc .katex *{color:inherit!important}" +
    dp + ".doc th{background:#" + th.accent + "!important;color:#fff!important}" +
    dp + ".doc th *{color:#fff!important}" +
    dp + ".doc pre{background:#1f2422!important}" + dp + ".doc pre," + dp + ".doc pre *{color:#eef1ef!important}" +
    dp + ".doc code{color:#1a1a18!important}" + dp + ".doc pre code{color:#eef1ef!important}" +
    dp + ".doc p>img+em," + dp + ".doc img+em{color:#55534c!important}" +
    // corporate template renders blockquotes as white-on-accent KPI cards — keep them white
    (String(tpl || "").toLowerCase().trim() === "corporate" ?
      dp + ".doc blockquote," + dp + ".doc blockquote *{color:#fff!important}" : "") +
    // academic template has a LIGHT cover with dark title — don't force white there
    (String(tpl || "").toLowerCase().trim() === "academic" ? "" :
      dp + ".cover__title{color:#FFF!important}" + dp + ".cover__sub{color:rgba(255,255,255,.82)!important}") +
    dp + ".doc .plot-tick{fill:#4b5563!important}" + dp + ".doc .plot-axislabel{fill:#374151!important}"
  );
}

/** Build the cover + body HTML (no <style>). Returns { cover, body, hasCover }. */
function exportBody(mdNode, lang, meta) {
  const clone = mdNode.cloneNode(true);
  clone.querySelectorAll(".code-block__head, .code-block__copy, .code-preview-btn, .file-disclosure__summary, .tikz-figure__spin, .plot-reset, script[type='text/tikz']").forEach((n) => n.remove());
  // PDF must use ONLY our in-house renderers. A TikZJax-engine figure has an SVG whose glyphs are
  // <use xlink:href> into the EXTERNAL tikzjax stylesheet → unresolved off-screen → broken/blank in
  // the PDF. Drop any engine or still-pending tikz figure; our self-contained plot / mini-tikz SVGs
  // (class tikz-svg / plot-figure, no <use> refs) are kept untouched.
  clone.querySelectorAll(".tikz-figure").forEach((fig) => {
    if (fig.classList.contains("plot-figure")) return;                 // in-house plot — always safe
    const svg = fig.querySelector("svg");
    const safe = svg && (svg.classList.contains("tikz-svg") || fig.querySelector(".plot-figure")) && !/<use\b/i.test(svg.innerHTML);
    const isEngine = fig.hasAttribute("data-tikz-pending") || !svg || (!safe && /<use\b/i.test(svg.innerHTML)) || /tikzjax/i.test(svg.outerHTML || "");
    if (isEngine) fig.remove();
  });
  // Each plot/tikz SVG has internal clip-path/marker/gradient ids; the LIVE chat SVG keeps the
  // SAME ids and stays (hidden) in the DOM during print, so url(#id) would resolve to the hidden
  // def and clip the whole graph away → blank. Re-id every cloned SVG's ids to make them unique.
  clone.querySelectorAll("svg").forEach((svg, i) => {
    // Give print a DEFINITE intrinsic size: an inline SVG sized only by viewBox + CSS height:auto
    // renders on screen but can COLLAPSE to zero height when actually printed → blank graph.
    const vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).filter((x) => x !== "");
    if (vb.length === 4 && !svg.getAttribute("width")) { svg.setAttribute("width", vb[2]); svg.setAttribute("height", vb[3]); }
    let html = svg.innerHTML;
    if (html.indexOf('id="') === -1) return;
    const pfx = "ex" + i + "_", ids = [];
    html = html.replace(/\bid="([^"]+)"/g, (m, id) => { ids.push(id); return 'id="' + pfx + id + '"'; });
    ids.forEach((id) => {
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp("url\\(#" + esc + "\\)", "g"), "url(#" + pfx + id + ")");
      html = html.replace(new RegExp('((?:xlink:)?href=")#' + esc + '"', "g"), "$1#" + pfx + id + '"');
    });
    svg.innerHTML = html;
  });
  const body = clone.innerHTML;
  const title = escapeHtml(meta.title || (activeChat() && activeChat().title) || "");
  const subtitle = escapeHtml(meta.subtitle || "");
  const dateStr = escapeHtml(meta.date || todayStr(lang));
  const cover = title ? (
    "<section class='cover'><div class='cover__pad'>" +
      "<div class='cover__mid'>" +
        "<h1 class='cover__title'>" + title + "</h1>" +
        (subtitle ? "<p class='cover__sub'>" + subtitle + "</p>" : "") +
        "<div class='cover__rule'></div>" +
      "</div>" +
    "</div></section>"
  ) : "";
  return { cover, body, hasCover: !!title };
}

/** Full self-contained themed HTML document (used by Word / html-docx-js). */
function buildExportHtml(mdNode, lang, meta) {
  meta = meta || {};
  const th = themeFor(meta);
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const { cover, body } = exportBody(mdNode, lang, meta);
  return (
    '<!doctype html><html dir="' + dir + '" lang="' + (isAr ? "ar" : "en") + '">' +
    '<head><meta charset="utf-8"><style>' + exportCss(th, isAr, "", meta.template) + "</style></head><body>" +
    cover + "<div class='doc'>" + body + "</div></body></html>"
  );
}

/** Build a scoped, themed element ATTACHED to the main document for PDF capture.
    Rendering in-document (not an iframe) means the correct width is used, the
    app's KaTeX stylesheet applies so math renders, and there's no gray/blank
    snapshot. The #firasExportRoot scope keeps the styles from touching the app. */
function buildExportRoot(mdNode, lang, meta) {
  meta = meta || {};
  const th = themeFor(meta);
  const isAr = lang === "ar";
  const { cover, body } = exportBody(mdNode, lang, meta);
  const root = document.createElement("div");
  root.id = "firasExportRoot";
  root.setAttribute("dir", isAr ? "rtl" : "ltr");
  // position:absolute (NOT fixed) + a real on-page offset so html2pdf's bundled
  // html2canvas can scroll to and capture it; far off-screen keeps it invisible.
  root.style.cssText = "position:absolute;left:-10000px;top:0;width:794px;background:#" + (th.bg || "FFFFFF") + ";z-index:-1";
  root.innerHTML = "<style>" + exportCss(th, isAr, "#firasExportRoot", meta.template) + "</style>" + cover + "<div class='doc'>" + body + "</div>";
  numberListsExplicitly(root.querySelector(".doc"));
  return root;
}

/** Replace every ordered-list CSS marker with an explicit inline number span, numbered
    CONTINUOUSLY across the whole document (counter resets at each top-level H1, so the
    Answer Key re-starts at 1 alongside the problems). Two bugs this kills at once:
      1. LEFT-EDGE CLIP — html2canvas mis-renders ::marker digits ("60"→"30", "66"→"36");
         a real text span in a fixed gutter always renders correctly.
      2. NUMBER RESET — if marked.js split the problems into several <ol>s (a stray blank
         line between batches), each restarted at 1; a single running counter fixes that. */
function numberListsExplicitly(docEl) {
  if (!docEl) return;
  let n = 0;
  // querySelectorAll yields matches in document order, so H1 resets and <li> numbering interleave correctly.
  docEl.querySelectorAll("h1, ol > li").forEach((el) => {
    if (el.tagName === "H1") { n = 0; return; }
    const ol = el.parentElement;
    if (!ol || ol.tagName !== "OL") return;
    ol.classList.add("li-explicit");
    n += 1;
    const num = document.createElement("span");
    num.className = "li-n";
    num.textContent = n + ".";
    const bodyWrap = document.createElement("span");
    bodyWrap.className = "li-body";
    while (el.firstChild) bodyWrap.appendChild(el.firstChild);
    el.appendChild(num);
    el.appendChild(bodyWrap);
  });
}

/** Extract tables from a rendered .md node as arrays-of-rows (for Excel). */
function extractTables(mdNode) {
  const tables = [];
  mdNode.querySelectorAll("table").forEach((tbl) => {
    const rows = [];
    tbl.querySelectorAll("tr").forEach((tr) => {
      const cells = [];
      tr.querySelectorAll("th,td").forEach((c) => cells.push(c.textContent.trim()));
      if (cells.length) rows.push(cells);
    });
    if (rows.length) tables.push(rows);
  });
  return tables;
}

/** Extract tables WITH a sheet title derived from the nearest preceding heading
    (so each markdown table becomes a well-named sheet). */
function extractTablesNamed(mdNode) {
  const out = [];
  mdNode.querySelectorAll("table").forEach((tbl) => {
    const rows = [];
    tbl.querySelectorAll("tr").forEach((tr) => {
      const cells = [];
      tr.querySelectorAll("th,td").forEach((c) => cells.push(c.textContent.trim()));
      if (cells.length) rows.push(cells);
    });
    if (!rows.length) return;
    // Walk back to find a heading to title the sheet.
    let title = "";
    let el = tbl.previousElementSibling;
    let hops = 0;
    while (el && hops < 6 && !title) {
      if (/^H[1-4]$/.test(el.tagName)) title = el.textContent.trim();
      el = el.previousElementSibling; hops++;
    }
    out.push({ rows, title });
  });
  return out;
}

/* ---- Format exporters (each lazy-loads its lib, falls back gracefully) ---- */

/** Render a full HTML document into a hidden, isolated iframe so its <style>,
    fonts and RTL/Arabic shaping all apply correctly before we snapshot it.
    (Rendering a DETACHED node — the old approach — left the CSS unapplied, which
    is why exported PDFs looked unstyled and disorganized.) */
function renderExportFrame(html) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;background:#fff;visibility:hidden";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    // Let layout + web fonts settle before the canvas snapshot.
    setTimeout(() => resolve(iframe), 160);
  });
}
function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16) || 0, g: parseInt(h.slice(2, 4), 16) || 0, b: parseInt(h.slice(4, 6), 16) || 0 };
}

async function exportPdf(turn, lang, msg) {
  const { meta } = parseFileMeta(msg && msg.content);
  const mdNode = mdNodeForTurn(turn);
  if (!mdNode || !mdNode.textContent.trim()) { showToast(t().exportEmpty); return; }
  // Direction follows the CONTENT, not the UI language — an ENGLISH exam must render LTR even when the
  // user's language is Arabic. CRITICAL: count PROSE only — math (KaTeX) and code are full of Latin
  // (e^x, dx, sin, ln…) and a math-heavy ARABIC doc was mis-detected as English → wrong (Latin) font
  // stack → broken Arabic shaping. Strip math/code before counting.
  const _pn = mdNode.cloneNode(true);
  _pn.querySelectorAll(".katex, .katex-display, code, pre, .plot-figure, .tikz-figure, .plot-legend").forEach((n) => n.remove());
  const _dt = _pn.textContent || "";
  const _arN = (_dt.match(/[؀-ۿ]/g) || []).length, _laN = (_dt.match(/[A-Za-z]/g) || []).length;
  // Arabic wins if it's the majority of prose OR clearly substantial (a mostly-Arabic doc with some
  // English terms still renders RTL with the Arabic font).
  const isAr = _arN > 0 && (_arN >= _laN || _arN >= 12);
  ensureFileTitle(meta, mdNode);
  const th = themeFor(meta);
  // Save-as filename = the request/title (Chrome uses document.title as the default PDF name).
  const prevDocTitle = document.title;
  const fileTitle = String(meta.filename || meta.title || (activeChat() && activeChat().title) || "Firas AI")
    .replace(/\$+/g, "").replace(/\\[a-zA-Z]+/g, "").replace(/[{}\\^_]/g, "")
    .replace(/[\\/:*?"<>|\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) || "Firas AI";
  document.title = fileTitle;
  if (mdNode.querySelector(".tikz-figure[data-tikz-pending]")) showToast(isAr ? "يُحضّر الرسوم قبل الحفظ…" : "Rendering figures…");
  await tikzReady(4000);                       // in-house figures settle fast; engine (TikZJax) figures are stripped from the PDF
  const { cover, body } = exportBody(mdNode, lang, meta);

  // DIRECT DOWNLOAD (not print). Build an OFF-SCREEN, themed, A4-width root and render it to a REAL PDF
  // file via html2pdf (html2canvas + jsPDF), then download it: on a COMPUTER it saves straight to the
  // Downloads folder (no print dialog the user couldn't save from); on a PHONE it triggers the browser's
  // native "download this file?" prompt → the file lands in Downloads. Per-page margins + page-break-avoid
  // keep content off the edges and stop figures/rows being cut across pages. No URL / date / header /
  // footer — it's a generated file, not a print.
  const oldRoot = document.getElementById("firasExportRoot"); if (oldRoot) oldRoot.remove();
  const root = document.createElement("div");
  root.id = "firasExportRoot";
  root.setAttribute("dir", isAr ? "rtl" : "ltr");
  root.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1";
  root.innerHTML = "<style>" + exportCss(th, isAr, "#firasExportRoot", meta.template) +
    "#firasExportRoot{width:794px!important;overflow:visible!important;margin:0;padding:0}#firasExportRoot .cover{height:1150px}</style>" +
    cover + "<div class='doc'>" + body + "</div>";
  numberListsExplicitly(root.querySelector(".doc"));
  const titleEl = root.querySelector(".cover__title");
  if (titleEl) {
    let tt = titleEl.textContent;
    // If the title ALREADY has math delimiters ($…$, \(…\)), render them directly — mathifyTitle is
    // for plain-text math only and double-processing produced garbled/duplicated titles.
    if (!/\$|\\\(|\\\[/.test(tt)) tt = mathifyTitle(tt);
    titleEl.textContent = tt;
    typesetMath(titleEl);
  }
  document.body.appendChild(root);

  showToast(t().preparing);
  await ensureExportFonts(isAr);                  // professional fonts ready first
  await tikzReady(4000);                         // in-house plot/mini-tikz settle (engine figures are stripped)
  await new Promise((r) => setTimeout(r, isAr ? 320 : 160));   // Arabic needs a touch more to paint shaped glyphs before capture

  let done = false;
  const cleanup = () => { if (done) return; done = true; try { root.remove(); } catch (_) {} try { document.title = prevDocTitle; } catch (_) {} };
  try {
    await loadScripts(EXPORT_LIBS.pdf);           // html2canvas@1.4.1 + jsPDF@2.5.1 (the html2pdf bundle produced blank PDFs)
    const H2C = window.html2canvas, JSPDF = window.jspdf && window.jspdf.jsPDF;
    if (typeof H2C !== "function" || typeof JSPDF !== "function") throw new Error("pdf libs unavailable");
    // ═══ MEGA-BOOK CHUNKED ENGINE ═══════════════════════════════════════════════════════════
    // Browsers cap a canvas at ~16,384px tall — one big capture dies at ~14 A4 pages. So the
    // document is rendered in CHUNKS (each safely under the cap), paginated with CARRY-OVER so
    // pages flow seamlessly across chunk boundaries, with real page numbers stamped. This lifts
    // the ceiling from ~14 pages to effectively unlimited (hundreds+).
    const pdf = new JSPDF("p", "mm", "a4");
    const pageW = 210, pageH = 297, margin = 12, contentWmm = pageW - 2 * margin, pageContentMm = pageH - 2 * margin;
    const docEl = root.querySelector(".doc");
    const coverEl = root.querySelector(".cover");
    // — Split any single block taller than a chunk (a 1000-item list / giant table) into parts —
    const CHUNK_CSS_MAX = 5000;   // css px per chunk → at scale 3 a chunk canvas is ≤15k px (< the ~16k cap)
    const splitTall = () => {
      [...docEl.children].forEach((el) => {
        if (el.offsetHeight <= CHUNK_CSS_MAX) return;
        const tag = el.tagName;
        if (tag === "OL" || tag === "UL") {
          // Chain-split: every time the running height fills a part, open a NEW sibling list and
          // keep moving the following items into it (works for 1000-item workbooks).
          const items = [...el.children];
          let target = el, h = 0;
          items.forEach((li) => {
            const lh = li.offsetHeight || 24;
            if (h + lh > CHUNK_CSS_MAX * 0.75 && h > 0) {
              const nt = el.cloneNode(false);
              target.parentNode.insertBefore(nt, target.nextSibling);
              target = nt; h = 0;
            }
            if (target !== el) target.appendChild(li);
            h += lh;
          });
        } else if (tag === "TABLE") {
          const tbody = el.tBodies && el.tBodies[0];
          if (!tbody) return;
          const rows = [...tbody.rows];
          let target = null, h = 0;
          rows.forEach((tr) => {
            const rh = tr.offsetHeight || 28;
            if (h + rh > CHUNK_CSS_MAX * 0.75 && h > 0) {
              const nt = el.cloneNode(false);
              if (el.tHead) nt.appendChild(el.tHead.cloneNode(true));
              nt.appendChild(document.createElement("tbody"));
              (target || el).parentNode.insertBefore(nt, (target || el).nextSibling);
              target = nt; h = 0;
            }
            if (target) target.tBodies[target.tBodies.length - 1].appendChild(tr);
            h += rh;
          });
        }
      });
    };
    splitTall();
    // — Group top-level blocks into chunks —
    const blocks = [...docEl.children];
    const totalCssH = docEl.scrollHeight + (coverEl ? 1160 : 0);
    // Adaptive quality: short docs get crisp scale-2; big books trade a little sharpness for a
    // sane file size (raster PDFs grow linearly with page count).
    // HIGH-DPI: short/medium docs render at 3× (crisp text + graphs); huge books at 2× to keep the
    // file size sane. jpeg quality raised across the board.
    const baseScale = totalCssH > 120000 ? 2 : totalCssH > 40000 ? 2.5 : 3;
    const jpegQ = totalCssH > 120000 ? 0.82 : totalCssH > 40000 ? 0.9 : 0.97;
    const chunks = [];                              // each: { nodes:[...], scale }
    if (coverEl) chunks.push({ nodes: [coverEl], scale: baseScale, isCover: true });
    let cur = [], curH = 0;
    for (const b of blocks) {
      const h = Math.max(1, b.offsetHeight);
      if (curH + h > CHUNK_CSS_MAX && cur.length) { chunks.push({ nodes: cur, scale: baseScale }); cur = []; curH = 0; }
      cur.push(b); curH += h;
    }
    if (cur.length) chunks.push({ nodes: cur, scale: baseScale });
    const styleTxt = (root.querySelector("style") || {}).textContent || "";
    // — Render each chunk and paginate with carry-over —
    let usedMm = 0, pageNo = 1, anyPage = false;
    const stampNo = () => {
      if (coverEl && pageNo === 1) return;          // no number on the cover
      pdf.setFontSize(9); pdf.setTextColor(120);
      pdf.text(String(pageNo), pageW / 2, pageH - 5.5, { align: "center" });
      pdf.setTextColor(0);
    };
    const closePage = () => { stampNo(); pdf.addPage(); pageNo++; usedMm = 0; };
    for (let ci = 0; ci < chunks.length; ci++) {
      const ch = chunks[ci];
      if (chunks.length > 4) showToast((isAr ? "يُصدّر الكتاب… " : "Exporting… ") + Math.round((ci / chunks.length) * 100) + "%");
      const cr = document.createElement("div");
      cr.id = "firasExportChunk";
      cr.setAttribute("dir", root.getAttribute("dir") || "rtl");
      cr.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;color-scheme:only light";
      const st = document.createElement("style"); st.textContent = styleTxt.replace(/#firasExportRoot/g, "#firasExportChunk"); cr.appendChild(st);
      if (ch.isCover) { cr.appendChild(ch.nodes[0]); }
      else { const dd = document.createElement("div"); dd.className = "doc"; ch.nodes.forEach((n) => dd.appendChild(n)); cr.appendChild(dd); }
      document.body.appendChild(cr);
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 20)));
      const cssH = cr.scrollHeight;
      const chScale = Math.min(ch.scale, 15600 / Math.max(cssH, 1));   // never exceed the ~16k canvas cap (headroom)
      const canvas = await H2C(cr, { scale: chScale, useCORS: true, backgroundColor: "#ffffff", logging: false, windowWidth: 820 });
      if (!canvas || !canvas.width || !canvas.height) { cr.remove(); continue; }
      const pxPerMm = canvas.width / contentWmm;
      const rr = cr.getBoundingClientRect(), sc = canvas.height / Math.max(rr.height, 1);
      const pageFullPx = pageContentMm * pxPerMm;
      const yTop = (el) => (el.getBoundingClientRect().top - rr.top) * sc;
      const yBot = (el) => (el.getBoundingClientRect().bottom - rr.top) * sc;
      const breaks = [];
      cr.querySelectorAll("p,li,h1,h2,h3,h4,figure,tr,blockquote,pre,.katex-display,.tikz-figure,.plot-figure,table,hr,ul,ol").forEach((el) => {
        const y = yBot(el);
        if (y > 1 && y < canvas.height) breaks.push(y);
      });
      breaks.push(canvas.height); breaks.sort((a, b) => a - b);
      // ATOMIC ZONES that must NEVER be split across a page boundary: equations, figures, images,
      // code, quotes, list items, tables. Plus "keep a heading with the block that follows it".
      // Only blocks that CAN fit on one page are protected; anything taller is allowed to break.
      const zones = [];
      cr.querySelectorAll(".katex-display,figure,.plot-figure,.tikz-figure,img,pre,blockquote,li,table").forEach((el) => {
        const t = yTop(el), b = yBot(el);
        if (b - t > 4 && b - t <= pageFullPx * 0.98) zones.push([t, b]);
      });
      cr.querySelectorAll("h1,h2,h3,h4").forEach((el) => {
        const nx = el.nextElementSibling, t = yTop(el);
        let b = yBot(el);
        if (nx) b = Math.min(yBot(nx), yTop(nx) + Math.min(yBot(nx) - yTop(nx), 70 * sc));  // heading + start of next block
        if (b - t > 4 && b - t <= pageFullPx * 0.98) zones.push([t, b]);
      });
      // Move a candidate cut OUT of any atomic zone (up to the zone's top → the block flows to the next page).
      const avoidSplit = (cut, from) => {
        for (let it = 0; it < 8; it++) {
          let moved = false;
          for (const z of zones) { if (cut > z[0] + 1 && cut < z[1] - 1 && z[0] > from + 24) { cut = z[0]; moved = true; } }
          if (!moved) break;
        }
        return cut;
      };
      let srcY = 0;
      while (srcY < canvas.height - 2) {
        let availMm = pageContentMm - usedMm;
        if (availMm < 16) { closePage(); availMm = pageContentMm; }   // don't start content in a sliver
        const capacityPx = availMm * pxPerMm;
        const limit = srcY + capacityPx;
        // If an atomic block starts at the top of the remaining space but overflows it, and the page is
        // already partly filled, move the WHOLE block to a fresh page (this is what stops equations/
        // figures from being cut with half on one page and half on the next).
        if (usedMm > 0.5) {
          let ov = null;
          for (const z of zones) { if (z[0] <= srcY + 24 && z[1] > limit + 1) { ov = z; break; } }
          if (ov) { closePage(); continue; }
        }
        let cut = 0;
        for (const bp of breaks) { if (bp > srcY + 24 && bp <= limit + 0.5) cut = bp; }
        if (!cut) cut = Math.min(limit, canvas.height);
        cut = avoidSplit(Math.min(cut, canvas.height), srcY);
        if (cut <= srcY + 24) {                                        // protecting a block left nothing to place here
          if (usedMm > 0.5) { closePage(); continue; }                //   → give it a fresh full page
          cut = Math.min(limit, canvas.height);                       //   → block taller than a whole page: must cut
        }
        cut = Math.min(cut, canvas.height);
        const sliceH = Math.max(1, Math.round(cut - srcY));
        const slice = document.createElement("canvas"); slice.width = canvas.width; slice.height = sliceH;
        slice.getContext("2d").drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        pdf.addImage(slice.toDataURL("image/jpeg", jpegQ), "JPEG", margin, margin + usedMm, contentWmm, sliceH / pxPerMm);
        anyPage = true;
        slice.width = 0;                                              // free the slice bitmap
        srcY = cut;
        if (srcY < canvas.height - 2) { closePage(); }                // more content in THIS chunk → page was filled
        else { usedMm += sliceH / pxPerMm; }                          // chunk done → keep page open (carry-over)
      }
      if (ch.isCover) { closePage(); }                                // the cover always owns its page
      canvas.width = 0;                                               // free the chunk bitmap
      cr.remove();
    }
    if (!anyPage) throw new Error("blank capture");
    stampNo();                                                        // number the final page
    pdf.save(fileTitle + ".pdf");
    cleanup();
    showToast(isAr ? "تم تنزيل الملف ✓" : "File downloaded ✓");
  } catch (_) {
    cleanup();
    showToast(t().formatUnavailable || (isAr ? "تعذّر إنشاء الملف" : "Couldn't create the file"));
  }
}

async function exportWord(turn, lang, msg) {
  const { meta } = parseFileMeta(msg && msg.content);
  const mdNode = mdNodeForTurn(turn);
  if (!mdNode || !mdNode.textContent.trim()) { showToast(t().exportEmpty); return; }
  showToast(t().preparing);
  try {
    await loadScripts(EXPORT_LIBS.docx);
    if (typeof window.htmlDocx === "undefined" || !window.htmlDocx.asBlob) throw new Error("nolib");
    ensureFileTitle(meta, mdNode);
    const html = buildExportHtml(mdNode, lang, meta);
    const blob = window.htmlDocx.asBlob(html, {
      orientation: "portrait",
      margins: { top: 720, right: 720, bottom: 720, left: 720 },
    });
    downloadBlob(blob, resolveFileName(meta, "docx"));
  } catch (_) {
    showToast(t().formatUnavailable);
  }
}

/** Coerce a numeric-looking cell to a real number (so Excel treats it as data,
    not text). Keeps %, currency, dates and labels as strings. */
function coerceCell(v) {
  // Convert Eastern-Arabic digits (٠-٩) to ASCII first, so Arabic-written numbers
  // still coerce to real numbers (else Excel keeps them as text → no sums/charts).
  const s = String(v == null ? "" : v).trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  // After the digit conversion, any remaining letter / currency / % / date marker
  // (incl. non-digit Arabic chars in U+0600–06FF) means it's genuine text.
  if (!s || /[%$€£a-z؀-ۿ/:]/i.test(s)) return v;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) || /^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s.replace(/,/g, ""));
    if (!isNaN(n)) return n;
  }
  return v;
}

async function exportExcel(turn, lang, msg) {
  const { meta } = parseFileMeta(msg && msg.content);
  const mdNode = mdNodeForTurn(turn);
  if (!mdNode || !mdNode.textContent.trim()) { showToast(t().exportEmpty); return; }
  showToast(t().preparing);
  try {
    await loadScripts(EXPORT_LIBS.xlsx);
    // Fallback to plain SheetJS (smaller/more reliable; no cell styling) if the
    // styled bundle didn't load — so Excel still works on flaky networks.
    if (typeof window.XLSX === "undefined") {
      try { await loadScripts(["https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"]); } catch (_) {}
    }
    if (typeof window.XLSX === "undefined") throw new Error("nolib");
    ensureFileTitle(meta, mdNode);
    const XLSX = window.XLSX;
    const th = themeFor(meta);
    const headFill = "FF" + th.accent.toUpperCase();
    const zebraFill = "FF" + th.zebra.toUpperCase();
    const borderColor = "FFD8D6CB";
    const isAr = lang === "ar";
    const thinB = { style: "thin", color: { rgb: borderColor } };
    const border = { top: thinB, bottom: thinB, left: thinB, right: thinB };

    // Apply themed styling to every cell: accent header, zebra rows, borders.
    const styleSheet = (ws) => {
      if (!ws["!ref"]) return;
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (!cell) continue;
          const header = R === 0;
          cell.s = {
            font: { name: "Calibri", sz: header ? 12 : 11, bold: header, color: { rgb: header ? "FFFFFFFF" : "FF1A1A18" } },
            fill: { patternType: "solid", fgColor: { rgb: header ? headFill : (R % 2 ? "FFFFFFFF" : zebraFill) } },
            alignment: { vertical: "center", horizontal: isAr ? "right" : "left", wrapText: true, readingOrder: isAr ? 2 : 1 },
            border: border,
          };
        }
      }
    };

    const wb = XLSX.utils.book_new();
    const tables = extractTablesNamed(mdNode);
    const used = {};
    const uniqName = (base) => {
      let name = (base || "Sheet").replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 28) || "Sheet";
      let n = name, i = 2;
      while (used[n.toLowerCase()]) n = (name.slice(0, 25) + " " + i++).trim();
      used[n.toLowerCase()] = true;
      return n;
    };
    if (tables.length) {
      tables.forEach((tb, i) => {
        // Coerce numeric data cells (skip the header row) so totals/charts work.
        const rows = tb.rows.map((r, ri) => ri === 0 ? r : r.map(coerceCell));
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const widths = [];
        rows.forEach((r) => r.forEach((c, ci) => {
          widths[ci] = Math.max(widths[ci] || 10, Math.min(64, String(c == null ? "" : c).length + 3));
        }));
        ws["!cols"] = widths.map((w) => ({ wch: w }));
        ws["!freeze"] = { xSplit: 0, ySplit: 1 };
        ws["!rows"] = [{ hpt: 22 }];
        styleSheet(ws);
        XLSX.utils.book_append_sheet(wb, ws, uniqName(tb.title || ("Sheet " + (i + 1))));
      });
    } else {
      const lines = mdNode.textContent.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      const ws = XLSX.utils.aoa_to_sheet([[meta.title || "Content"]].concat(lines.map((l) => [l])));
      ws["!cols"] = [{ wch: 90 }];
      ws["!freeze"] = { xSplit: 0, ySplit: 1 };
      styleSheet(ws);
      XLSX.utils.book_append_sheet(wb, ws, "Content");
    }
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), resolveFileName(meta, "xlsx"));
  } catch (_) {
    showToast(t().formatUnavailable);
  }
}

/** Export the message's tables as a CSV file. Pure JS — no external library, so
    it always works. UTF-8 BOM so Excel opens Arabic correctly; RFC-4180 escaping. */
function exportCsv(turn, lang, msg) {
  const { meta } = parseFileMeta(msg && msg.content);
  const mdNode = mdNodeForTurn(turn);
  if (!mdNode || !mdNode.textContent.trim()) { showToast(t().exportEmpty); return; }
  showToast(t().preparing);
  try {
    ensureFileTitle(meta, mdNode);
    const esc = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const tables = extractTablesNamed(mdNode);
    let csv = "";
    if (tables.length) {
      tables.forEach((tb, i) => {
        if (i > 0) csv += "\r\n";                                   // blank line between tables
        if (tables.length > 1 && tb.title) csv += esc(tb.title) + "\r\n";
        csv += tb.rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
      });
    } else {
      // No tables — one value per line so the request still yields a usable file.
      const lines = mdNode.textContent.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      csv = lines.map(esc).join("\r\n");
    }
    const blob = new Blob([new Uint8Array([0xEF,0xBB,0xBF]), csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, resolveFileName(meta, "csv"));
  } catch (_) {
    showToast(t().formatUnavailable);
  }
}

/** Split the message markdown into slides by headings / blank-line groups. */
function slidesFromMarkdown(md, fallbackTitle) {
  const lines = (md || "").replace(/```[\s\S]*?```/g, "").split(/\n/); // strip fenced code (was a no-op)
  const slides = [];
  let cur = null;
  const push = () => { if (cur && (cur.title || cur.bullets.length || cur.image)) slides.push(cur); };
  lines.forEach((raw) => {
    const line = raw.replace(/\r$/, "");
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      push();
      // A level-1 heading with an em-dash / colon reads as a SECTION divider cue; kept as a hint.
      cur = { title: h[2].replace(/[*_`#]/g, "").trim(), bullets: [], notes: "", image: "", lvl: h[1].length };
      return;
    }
    // Speaker notes — a "Notes:/ملاحظات:" line (optionally blockquoted) → the slide's presenter notes,
    // NOT a visible bullet. Everything after the colon is spoken script.
    const nm = line.match(/^\s*>?\s*(?:notes?|speaker\s*notes?|ملاحظات(?:\s*المتحدث)?|الملقي|شرح)\s*[:：]\s*(.*)$/i);
    if (nm) { if (!cur) cur = { title: fallbackTitle, bullets: [], notes: "", image: "", lvl: 2 }; cur.notes += (cur.notes ? " " : "") + nm[1].trim(); return; }
    // A chart — 'Chart: {"type":"bar","title":"…","labels":[…],"data":[…]}' → an ANIMATED chart in the
    // presenter and a REAL native chart in the exported PowerPoint.
    const chm = line.match(/^\s*>?\s*(?:chart|graph|رسم\s*بياني|مخطط)\s*[:：]\s*(\{.*\})\s*$/i);
    if (chm) {
      if (!cur) cur = { title: fallbackTitle, bullets: [], notes: "", image: "", lvl: 2 };
      if (!cur.chart) { const ch = normalizeDeckChart(chm[1]); if (ch) cur.chart = ch; }
      return;
    }
    // An image on its own line → the slide's visual (first one wins). Keep alt text for a caption.
    const im = line.match(/^\s*>?\s*!\[([^\]]*)\]\(([^)\s]+)[^)]*\)\s*$/);
    if (im) { if (!cur) cur = { title: fallbackTitle, bullets: [], notes: "", image: "", lvl: 2 }; if (!cur.image) { cur.image = im[2]; cur.imageAlt = im[1].trim(); } return; }
    const txt = line.replace(/^[-*+]\s+/, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/[*_`#>]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
    if (!txt) return;
    if (!cur) cur = { title: fallbackTitle, bullets: [], notes: "", image: "", lvl: 2 };
    cur.bullets.push(txt);
  });
  push();
  // A lone heading (no bullets, no image, no chart) is a SECTION DIVIDER; everything else caps bullets.
  return slides.map((s) => ({
    title: s.title,
    bullets: s.bullets.slice(0, 10),
    notes: (s.notes || "").slice(0, 900),
    image: s.image || "",
    imageAlt: s.imageAlt || "",
    chart: s.chart || null,
    section: !s.bullets.length && !s.image && !s.chart && !!s.title,
  }));
}

/* Validate + normalize a chart spec (from the model or an edit). Accepts {type,title,labels,data}
   or {type,title,labels,series:[{name,data}]}. Returns null when unusable. */
function normalizeDeckChart(raw) {
  try {
    const o = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!o || !Array.isArray(o.labels) || !o.labels.length) return null;
    const type = /^(line|pie|doughnut|donut)$/i.test(String(o.type || "")) ? String(o.type).toLowerCase().replace("donut", "doughnut").replace("pie", "doughnut") : "bar";
    const labels = o.labels.slice(0, 12).map((l) => String(l).slice(0, 28));
    let series = Array.isArray(o.series) && o.series.length
      ? o.series.slice(0, 4).map((se) => ({ name: String(se.name || "").slice(0, 40), data: (Array.isArray(se.data) ? se.data : []).slice(0, 12).map((v) => { const n = Number(v); return isFinite(n) ? n : 0; }) }))
      : [{ name: String(o.name || "").slice(0, 40), data: (Array.isArray(o.data) ? o.data : []).slice(0, 12).map((v) => { const n = Number(v); return isFinite(n) ? n : 0; }) }];
    series = series.filter((se) => se.data.length);
    if (!series.length) return null;
    series.forEach((se) => { while (se.data.length < labels.length) se.data.push(0); se.data = se.data.slice(0, labels.length); });
    if (type === "doughnut") series = series.slice(0, 1);       // a pie has ONE series
    return { type, title: String(o.title || "").slice(0, 70), labels, series };
  } catch (_) { return null; }
}

/* ── ANIMATED PROFESSIONAL CHART (inline SVG) — bars grow, lines draw themselves, doughnut fills;
   used on presenter slides. `uid` scopes the <style> so animations never leak to other slides. ── */
function deckChartSvg(chart, th, animated) {
  const ch = normalizeDeckChart(chart); if (!ch) return "";
  const uid = "dpc" + Math.random().toString(36).slice(2, 8);
  const A = "#" + th.accent, D = "#" + th.deep;
  const PAL = [A, "#E0A458", D, "#8FA98F", "#C97B84", "#6B8CAE"];
  const W = 460, H = 320, padL = 46, padR = 14, padT = ch.title ? 42 : 18, padB = 44;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const allVals = ch.series.flatMap((se) => se.data);
  const maxV = Math.max(1, ...allVals.map((v) => Math.abs(v)));
  const nice = maxV <= 5 ? Math.ceil(maxV) : Math.ceil(maxV / 4) * 4;
  let body = "", css = "";
  const grid = [0.25, 0.5, 0.75, 1].map((f) => {
    const y = padT + innerH - innerH * f;
    return '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#00000014" stroke-width="1"/>' +
      '<text x="' + (padL - 7) + '" y="' + (y + 4) + '" font-size="10" fill="#00000066" text-anchor="end">' + Math.round(nice * f) + "</text>";
  }).join("");
  const title = ch.title ? '<text x="' + (W / 2) + '" y="24" font-size="15" font-weight="700" fill="' + D + '" text-anchor="middle">' + esc(ch.title) + "</text>" : "";
  if (ch.type === "bar") {
    const groups = ch.labels.length, sN = ch.series.length;
    const gw = innerW / groups, bw = Math.min(34, (gw * 0.72) / sN);
    ch.labels.forEach((lb, i) => {
      body += '<text x="' + (padL + gw * i + gw / 2) + '" y="' + (H - padB + 16) + '" font-size="10.5" fill="#000000AA" text-anchor="middle">' + esc(lb) + "</text>";
      ch.series.forEach((se, s2) => {
        const v = se.data[i] || 0, bh = Math.max(2, innerH * Math.abs(v) / nice);
        const x = padL + gw * i + gw / 2 - (bw * sN) / 2 + bw * s2;
        const y = padT + innerH - bh;
        const k = i * sN + s2;
        body += '<rect class="b' + k + '" x="' + x + '" y="' + y + '" width="' + (bw - 3) + '" height="' + bh + '" rx="3.5" fill="' + PAL[s2 % PAL.length] + '"/>' +
          '<text class="v' + k + '" x="' + (x + (bw - 3) / 2) + '" y="' + (y - 5) + '" font-size="10" font-weight="600" fill="' + D + '" text-anchor="middle">' + v + "</text>";
        if (animated) css += "#" + uid + " .b" + k + "{transform-origin:" + (x + (bw - 3) / 2) + "px " + (padT + innerH) + "px;animation:" + uid + "g .7s " + (0.15 + k * 0.08) + "s cubic-bezier(.2,.7,.3,1) both}" +
          "#" + uid + " .v" + k + "{animation:" + uid + "f .4s " + (0.55 + k * 0.08) + "s both}";
      });
    });
    if (animated) css += "@keyframes " + uid + "g{from{transform:scaleY(0)}to{transform:scaleY(1)}}@keyframes " + uid + "f{from{opacity:0}to{opacity:1}}";
  } else if (ch.type === "line") {
    const step = innerW / Math.max(1, ch.labels.length - 1);
    ch.labels.forEach((lb, i) => { body += '<text x="' + (padL + step * i) + '" y="' + (H - padB + 16) + '" font-size="10.5" fill="#000000AA" text-anchor="middle">' + esc(lb) + "</text>"; });
    ch.series.forEach((se, s2) => {
      const pts = se.data.map((v, i) => [padL + step * i, padT + innerH - innerH * Math.max(0, v) / nice]);
      const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
      const col = PAL[s2 % PAL.length];
      body += '<path class="l' + s2 + '" d="' + d + '" fill="none" stroke="' + col + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="100"/>';
      pts.forEach((p, i) => { body += '<circle class="d' + s2 + '_' + i + '" cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="#fff" stroke="' + col + '" stroke-width="2.5"/>'; if (animated) css += "#" + uid + " .d" + s2 + "_" + i + "{animation:" + uid + "f .3s " + (0.25 + i * 0.12) + "s both}"; });
      if (animated) css += "#" + uid + " .l" + s2 + "{stroke-dasharray:100;stroke-dashoffset:100;animation:" + uid + "w 1.1s " + (0.15 + s2 * 0.2) + "s cubic-bezier(.4,0,.2,1) forwards}";
    });
    if (animated) css += "@keyframes " + uid + "w{to{stroke-dashoffset:0}}@keyframes " + uid + "f{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}";
  } else { // doughnut
    const se = ch.series[0];
    const total = se.data.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const cx = W / 2 - 70, cy = padT + innerH / 2 + 4, r = Math.min(innerH, 210) / 2.35, C = 2 * Math.PI * r;
    let acc = 0;
    se.data.forEach((v, i) => {
      const frac = Math.max(0, v) / total, seg = frac * C;
      body += '<circle class="s' + i + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + PAL[i % PAL.length] + '" stroke-width="30" stroke-dasharray="' + seg.toFixed(1) + " " + (C - seg).toFixed(1) + '" stroke-dashoffset="' + (-acc * C).toFixed(1) + '" transform="rotate(-90 ' + cx + " " + cy + ')"/>';
      if (animated) css += "#" + uid + " .s" + i + "{animation:" + uid + "f .5s " + (0.15 + i * 0.14) + "s both}";
      acc += frac;
    });
    body += '<text x="' + cx + '" y="' + (cy + 5) + '" font-size="17" font-weight="700" fill="' + D + '" text-anchor="middle">' + total + "</text>";
    ch.labels.forEach((lb, i) => {
      const y = padT + 18 + i * 21, lx = W - 148;
      const pct = Math.round((Math.max(0, se.data[i]) / total) * 100);
      body += '<rect x="' + lx + '" y="' + (y - 9) + '" width="11" height="11" rx="3" fill="' + PAL[i % PAL.length] + '"/>' +
        '<text x="' + (lx + 17) + '" y="' + (y + 1) + '" font-size="11" fill="#000000BB">' + esc(lb) + " — " + pct + "%</text>";
    });
    if (animated) css += "@keyframes " + uid + "f{from{opacity:0}to{opacity:1}}";
  }
  return '<svg id="' + uid + '" viewBox="0 0 ' + W + " " + H + '" xmlns="http://www.w3.org/2000/svg" role="img" style="width:100%;height:auto;display:block;direction:ltr">' +
    (css ? "<style>" + css + "</style>" : "") + title + grid + body + "</svg>";
}

/* ── DECK block (```firas-deck {json}```): the editable multi-slide deliverable. ── */
function parseDeckMeta(content) {
  const s = String(content || "");
  if (!/^\s*```firas-deck[ \t]*\r?\n/.test(s)) return null;
  const body = s.replace(/^\s*```firas-deck[ \t]*\r?\n/, "").replace(/\r?\n```[ \t]*$/, "");
  try { const o = JSON.parse(body); if (o && Array.isArray(o.slides)) return o; } catch (_) {}
  const start = body.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try { const o = JSON.parse(body.slice(start, i + 1)); return (o && Array.isArray(o.slides)) ? o : null; } catch (_) { return null; }
    }
  }
  return null;
}
function serializeDeck(deck) {
  const slim = {
    v: 1,
    title: String(deck.title || "").slice(0, 140),
    subtitle: String(deck.subtitle || "").slice(0, 140),
    theme: deck.theme || "navy",
    lang: deck.lang || "ar",
    phase: deck.phase === "building" ? "building" : "done",
    slides: (deck.slides || []).slice(0, 48).map((s) => ({
      t: s.t === "section" || s.section ? "section" : "slide",
      title: String(s.title || "").slice(0, 160),
      bullets: (s.bullets || []).slice(0, 10).map((b) => String(b).slice(0, 300)),
      image: String(s.image || "").slice(0, 600),
      imageAlt: String(s.imageAlt || "").slice(0, 90),
      notes: String(s.notes || "").slice(0, 900),
      chart: s.chart ? normalizeDeckChart(s.chart) : null,
    })),
  };
  // HARD BUDGET (like serializeAgentRun): the server caps content at ~200K — a truncated block
  // loses its fence and won't re-parse on reload, silently losing the whole deliverable.
  let out = JSON.stringify(slim), capB = 300, capN = 900;
  while (out.length > 165000 && capB > 40) {
    capB = Math.floor(capB * 0.7); capN = Math.floor(capN * 0.7);
    slim.slides.forEach((s) => { s.bullets = s.bullets.map((b) => b.slice(0, capB)); s.notes = s.notes.slice(0, capN); });
    out = JSON.stringify(slim);
  }
  if (out.length > 165000) { slim.slides = slim.slides.slice(0, Math.max(8, Math.floor(slim.slides.length * 0.7))); out = JSON.stringify(slim); }
  return "```firas-deck\n" + out + "\n```";
}

/* ── DECK CARD — the combined home of all slides. While the agent BUILDS, slides stream into it
   one-by-one (editing locked). Once DONE it unlocks: edit any slide's text, delete bullets/image/
   chart/slide, or have the AI REGENERATE a slide from scratch — plus Present & PowerPoint. ── */
async function regenerateDeckSlide(deck, i, instruction, signal) {
  const s = deck.slides[i];
  const ctxList = deck.slides.map((x, k) => (k + 1) + ". " + (x.t === "section" ? "[قسم] " : "") + x.title).join("\n");
  const sys = "You are an ELITE keynote designer REGENERATING ONE SLIDE of an existing deck. Output ONLY that one slide in EXACTLY this Markdown format: '### Slide Title' + 3-5 SHORT punchy bullets (≤10 words each)" +
    (s.image ? ", keep this exact image line: ![" + (s.imageAlt || "") + "](" + s.image + ")" : "") +
    ". If the slide presents numbers/statistics you MAY include one line Chart: {\"type\":\"bar|line|doughnut\",\"title\":\"…\",\"labels\":[…],\"data\":[…]} with REAL plausible values. Add one 'Notes: <1-2 spoken sentences>' line. Write in the deck's language. No preamble, no extra slides.";
  const usr = "DECK: " + deck.title + "\nALL SLIDES:\n" + ctxList + "\n\nREGENERATE SLIDE " + (i + 1) + " (current title: " + s.title + ")." +
    (instruction ? "\nUSER DIRECTION (follow precisely): " + instruction : "\nMake it clearly better: sharper insight, stronger specifics.");
  const out = await callAgentText([{ role: "system", content: sys }, { role: "user", content: usr }], "max", signal);
  const parsedS = slidesFromMarkdown(String(out || ""), s.title).filter((x) => !x.section);
  if (!parsedS.length) throw new Error("bad slide");
  const ns = parsedS[0];
  return { t: "slide", title: ns.title || s.title, bullets: ns.bullets, image: ns.image || s.image || "", imageAlt: ns.imageAlt || s.imageAlt || "", notes: ns.notes || "", chart: ns.chart || null };
}
function buildDeckCard(deck, lang, msg) {
  const ar = (deck.lang || lang) === "ar";
  // "building" is only real while this chat actually has a live stream — a deck persisted mid-build
  // and reloaded later must UNLOCK (otherwise it would stay locked forever).
  const chBuild = activeChat();
  const building = deck.phase === "building" && !!(chBuild && activeStreams.has(chBuild.id));
  const L = ar
    ? { deck: "عرض تقديمي", slides: "شريحة", building: "يبني الشرائح…", done: "جاهز — يمكنك التعديل الآن", locked: "🔒 التعديل يتاح بعد اكتمال كل الشرائح", present: "اعرض", ppt: "PowerPoint", section: "قسم", edit: "تعديل", save: "💾 حفظ", regen: "🔄 إعادة توليد", del: "🗑 حذف الشريحة", delB: "حذف", addB: "+ نقطة", title: "العنوان", notes: "ملاحظات المتحدث", img: "صورة", chart: "رسم بياني", regenHint: "توجيه للتوليد (اختياري): مثلا «ركز على الأرقام»", working: "يعيد التوليد…", removed: "حُذفت", saved: "حُفظ ✓" }
    : { deck: "Presentation", slides: "slides", building: "Building slides…", done: "Ready — you can edit now", locked: "🔒 Editing unlocks when all slides are done", present: "Present", ppt: "PowerPoint", section: "Section", edit: "Edit", save: "💾 Save", regen: "🔄 Regenerate", del: "🗑 Delete slide", delB: "Delete", addB: "+ bullet", title: "Title", notes: "Speaker notes", img: "Image", chart: "Chart", regenHint: "Direction (optional): e.g. \"focus on numbers\"", working: "Regenerating…", removed: "Removed", saved: "Saved ✓" };
  const th = themeFor({ theme: deck.theme });
  const card = document.createElement("div");
  card.className = "deck-card" + (building ? " is-building" : "");
  card.setAttribute("dir", ar ? "rtl" : "ltr");
  const persist = () => {
    if (!msg) return;
    msg.content = serializeDeck(deck);
    const chat = activeChat();
    if (chat) { chat.updatedAt = Date.now(); persistChat(chat); }
  };
  const rerender = () => { const fresh = buildDeckCard(deck, lang, msg); card.replaceWith(fresh); };
  const head =
    '<div class="deck-card__head">' +
      '<span class="deck-card__ic" style="background:linear-gradient(140deg,#' + th.deep + ',#' + th.accent + ')">🎬</span>' +
      '<span class="deck-card__meta"><strong>' + escapeHtml(deck.title || L.deck) + "</strong>" +
      '<span class="deck-card__sub">' + deck.slides.filter((s) => s.t !== "section").length + " " + L.slides + " · " + (building ? '<span class="deck-card__live">' + L.building + "</span>" : L.done) + "</span></span>" +
      (!building
        ? '<span class="deck-card__acts"><button type="button" class="deck-card__btn deck-card__btn--go" data-deck="present">▶ ' + L.present + '</button>' +
          '<button type="button" class="deck-card__btn" data-deck="ppt">⬇ ' + L.ppt + "</button></span>"
        : "") +
    "</div>";
  const rows = deck.slides.map((s, i) => {
    const badges = (s.chart ? " 📊" : "") + (s.image ? " 🖼" : "") + (s.notes ? " 🗒" : "");
    if (s.t === "section") {
      return '<div class="deck-card__row deck-card__row--sec"><span class="deck-card__n">' + (i + 1) + '</span><span class="deck-card__sec">' + L.section + "</span> " + escapeHtml(s.title) + "</div>";
    }
    if (building) return '<div class="deck-card__row"><span class="deck-card__n">' + (i + 1) + "</span>" + escapeHtml(s.title) + badges + "</div>";
    return (
      '<details class="deck-card__slide" data-i="' + i + '">' +
        '<summary><span class="deck-card__n">' + (i + 1) + "</span><span class='deck-card__st'>" + escapeHtml(s.title) + badges + '</span><span class="deck-card__editTag">✏️ ' + L.edit + "</span></summary>" +
        '<div class="deck-card__panel">' +
          '<label class="deck-card__lbl">' + L.title + '</label><input class="deck-card__inp dk-title" value="' + escapeHtml(s.title) + '">' +
          '<label class="deck-card__lbl">' + (ar ? "النقاط" : "Bullets") + '</label>' +
          '<div class="dk-bullets">' + (s.bullets || []).map((b, k) => '<div class="dk-brow"><input class="deck-card__inp dk-bullet" value="' + escapeHtml(b) + '"><button type="button" class="dk-x" data-delb="' + k + '" title="' + L.delB + '">✕</button></div>').join("") + "</div>" +
          '<button type="button" class="deck-card__mini" data-addb="1">' + L.addB + "</button>" +
          (s.image ? '<div class="dk-asset">🖼 ' + L.img + ' <span class="dk-asset__u">' + escapeHtml(s.image.slice(0, 60)) + '…</span><button type="button" class="dk-x" data-delimg="1">✕</button></div>' : "") +
          (s.chart ? '<div class="dk-asset">📊 ' + L.chart + " — " + escapeHtml((s.chart.title || s.chart.type)) + '<button type="button" class="dk-x" data-delch="1">✕</button></div>' : "") +
          '<label class="deck-card__lbl">' + L.notes + '</label><textarea class="deck-card__inp dk-notes" rows="2">' + escapeHtml(s.notes || "") + "</textarea>" +
          '<input class="deck-card__inp dk-instr" placeholder="' + L.regenHint + '">' +
          '<div class="deck-card__panelacts">' +
            '<button type="button" class="deck-card__btn deck-card__btn--go" data-save="1">' + L.save + "</button>" +
            '<button type="button" class="deck-card__btn" data-regen="1">' + L.regen + "</button>" +
            '<button type="button" class="deck-card__btn deck-card__btn--danger" data-delslide="1">' + L.del + "</button>" +
          "</div>" +
        "</div>" +
      "</details>");
  }).join("");
  card.innerHTML = head + '<div class="deck-card__list">' + rows + "</div>" + (building ? '<div class="deck-card__lock">' + L.locked + "</div>" : "");
  // ── interactions ──
  card.addEventListener("click", async (e) => {
    const actBtn = e.target.closest("[data-deck]");
    if (actBtn) {
      if (actBtn.getAttribute("data-deck") === "present") openDeckPresenter(msg);
      else exportPpt(card.closest(".msg-ai"), deck.lang || lang, msg);
      return;
    }
    const det = e.target.closest(".deck-card__slide");
    if (!det) return;
    const i = parseInt(det.getAttribute("data-i"), 10);
    const s = deck.slides[i]; if (!s) return;
    const readPanel = () => {
      s.title = det.querySelector(".dk-title").value.trim() || s.title;
      s.bullets = [...det.querySelectorAll(".dk-bullet")].map((x) => x.value.trim()).filter(Boolean).slice(0, 10);
      s.notes = det.querySelector(".dk-notes").value.trim();
    };
    if (e.target.closest("[data-delb]")) {
      // Delete by DOM position on the RAW input list (filtering empties first would shift indices
      // and delete the wrong bullet when an earlier input was blanked).
      const k = parseInt(e.target.closest("[data-delb]").getAttribute("data-delb"), 10);
      const raw = [...det.querySelectorAll(".dk-bullet")].map((x) => x.value);
      raw.splice(k, 1);
      s.title = det.querySelector(".dk-title").value.trim() || s.title;
      s.notes = det.querySelector(".dk-notes").value.trim();
      s.bullets = raw.map((v) => v.trim()).filter(Boolean).slice(0, 10);
      persist(); rerender();
    }
    else if (e.target.closest("[data-addb]")) { readPanel(); s.bullets.push(ar ? "نقطة جديدة" : "New point"); persist(); rerender(); }
    else if (e.target.closest("[data-delimg]")) { readPanel(); s.image = ""; s.imageAlt = ""; persist(); rerender(); showToast(L.removed); }
    else if (e.target.closest("[data-delch]")) { readPanel(); s.chart = null; persist(); rerender(); showToast(L.removed); }
    else if (e.target.closest("[data-delslide]")) { deck.slides.splice(i, 1); persist(); rerender(); showToast(L.removed); }
    else if (e.target.closest("[data-save]")) { readPanel(); persist(); rerender(); showToast(L.saved); }
    else if (e.target.closest("[data-regen]")) {
      const btn = e.target.closest("[data-regen]");
      const instr = det.querySelector(".dk-instr").value.trim();
      // Track the slide OBJECT (not the index): a delete during the multi-second regen shifts
      // indices and would overwrite the WRONG slide. Lock the panel while in flight.
      const target = deck.slides[i];
      det.querySelectorAll("button,input,textarea").forEach((x) => { x.disabled = true; });
      btn.textContent = L.working;
      try {
        const ns = await regenerateDeckSlide(deck, i, instr, null);
        const cur = deck.slides.indexOf(target);
        if (cur === -1) { showToast(L.removed); return; }          // slide deleted meanwhile
        deck.slides[cur] = ns; persist();
        if (card.isConnected) rerender();
        else { const ch2 = activeChat(); if (ch2) renderThread(ch2); }   // card replaced meanwhile
        showToast(L.saved);
      } catch (_) {
        det.querySelectorAll("button,input,textarea").forEach((x) => { x.disabled = false; });
        btn.textContent = L.regen; showToast(ar ? "تعذّرت إعادة التوليد" : "Couldn't regenerate");
      }
    }
  });
  // keep the open panel open across live re-renders while typing? — edits are in-DOM until saved.
  return card;
}

/** Fetch an image → data URL for embedding in a PPTX (pptxgenjs needs data/base64 to embed,
    and a remote path can taint or 404). Routes remote URLs through our same-origin proxy.
    Best-effort: returns "" on any failure so the deck still builds without the picture. */
async function imageToDataUrl(url, timeoutMs) {
  try {
    if (!url) return "";
    if (/^data:image\//i.test(url)) return url;
    let u = url;
    if (/^https?:\/\//i.test(url) && url.indexOf("/api/imgproxy") === -1) u = "/api/imgproxy?u=" + encodeURIComponent(url);
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs || 9000);
    const res = await fetch(u, { credentials: "same-origin", signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) return "";
    const blob = await res.blob();
    if (!/^image\//.test(blob.type) || blob.size < 64 || blob.size > 6 * 1024 * 1024) return "";
    return await new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result || "")); fr.onerror = () => resolve(""); fr.readAsDataURL(blob); });
  } catch (_) { return ""; }
}

/* ── ⑥ IN-BROWSER DECK PRESENTER — present the deck right in the site: themed slides, keyboard/
   swipe navigation (RTL-aware), fullscreen, progress bar, speaker-notes panel, and ANIMATIONS
   (3 switchable slide transitions + staggered content entrances). No PowerPoint needed. ── */
let _deckPresState = null;
function closeDeckPresenter() {
  if (!_deckPresState) return;
  try { document.removeEventListener("keydown", _deckPresState.onKey, true); } catch (_) {}
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {}
  try { _deckPresState.root.remove(); } catch (_) {}
  try { document.body.style.overflow = _deckPresState.prevOverflow || ""; } catch (_) {}
  _deckPresState = null;
}
function openDeckPresenter(msg) {
  closeDeckPresenter();
  const deckMeta = parseDeckMeta(msg && msg.content);   // editable deck card OR classic file message
  const parsed = deckMeta ? { meta: { title: deckMeta.title, subtitle: deckMeta.subtitle, theme: deckMeta.theme }, body: "" } : parseFileMeta(msg && msg.content);
  const meta = parsed.meta || {};
  const body = parsed.body || "";
  const lang = (deckMeta && deckMeta.lang) || (msg && msg.lang) || state.lang;
  const rtl = lang === "ar";
  const th = themeFor(meta);
  const A = "#" + th.accent, D = "#" + th.deep, CA = "#" + th.coverAccent;
  const L = rtl
    ? { present: "عرض", notes: "الملاحظات", noNotes: "لا توجد ملاحظات لهذه الشريحة", full: "ملء الشاشة", close: "إغلاق", anim: { slide: "انزلاق", fade: "تلاشي", zoom: "تكبير" }, thanks: "شكرًا لكم", start: "اضغط ← أو المس للتقدم" }
    : { present: "Present", notes: "Notes", noNotes: "No notes for this slide", full: "Fullscreen", close: "Close", anim: { slide: "Slide", fade: "Fade", zoom: "Zoom" }, thanks: "Thank you", start: "Press → or tap to advance" };
  // Build the deck: cover → content/section slides → closing.
  let slides = deckMeta
    ? deckMeta.slides.map((s) => ({ title: s.title, bullets: s.bullets || [], notes: s.notes || "", image: s.image || "", imageAlt: s.imageAlt || "", chart: s.chart || null, section: s.t === "section" }))
    : slidesFromMarkdown(body, meta.title || "");
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (slides.length && !slides[0].bullets.length && !slides[0].image && !slides[0].chart && norm(slides[0].title) === norm(meta.title)) slides = slides.slice(1);
  const deck = [{ type: "cover" }].concat(slides.map((s) => Object.assign({ type: s.section ? "section" : "slide" }, s))).concat([{ type: "end" }]);
  const N = deck.length;
  let idx = 0, anim = "slide", secNo = 0;
  const secOf = []; deck.forEach((s, k) => { if (s.type === "section") secNo++; secOf[k] = secNo; });

  const root = document.createElement("div");
  root.className = "deck-pres";
  root.setAttribute("dir", rtl ? "rtl" : "ltr");
  root.innerHTML =
    '<div class="deck-pres__bar">' +
      '<span class="deck-pres__name">' + escapeHtml(String(meta.title || "Firas AI").slice(0, 60)) + "</span>" +
      '<span class="deck-pres__ctrls">' +
        '<select class="deck-pres__anim" title="Animation">' +
          '<option value="slide">' + L.anim.slide + "</option>" +
          '<option value="fade">' + L.anim.fade + "</option>" +
          '<option value="zoom">' + L.anim.zoom + "</option>" +
        "</select>" +
        '<button type="button" class="deck-pres__btn" data-act="notes">🗒 ' + L.notes + "</button>" +
        '<button type="button" class="deck-pres__btn" data-act="full">⛶ ' + L.full + "</button>" +
        '<span class="deck-pres__count">1 / ' + N + "</span>" +
        '<button type="button" class="deck-pres__btn deck-pres__btn--x" data-act="close" aria-label="' + L.close + '">✕</button>' +
      "</span>" +
    "</div>" +
    '<div class="deck-pres__stage"><div class="deck-pres__slide"></div></div>' +
    '<button type="button" class="deck-pres__nav deck-pres__nav--prev" aria-label="prev">' + (rtl ? "❯" : "❮") + "</button>" +
    '<button type="button" class="deck-pres__nav deck-pres__nav--next" aria-label="next">' + (rtl ? "❮" : "❯") + "</button>" +
    '<div class="deck-pres__notes" hidden></div>' +
    '<div class="deck-pres__progress"><span></span></div>';
  document.body.appendChild(root);
  const stage = root.querySelector(".deck-pres__slide");
  const counter = root.querySelector(".deck-pres__count");
  const notesEl = root.querySelector(".deck-pres__notes");
  const progEl = root.querySelector(".deck-pres__progress span");

  const slideHtml = (s) => {
    if (s.type === "cover") return (
      '<div class="dp-cover" style="background:linear-gradient(155deg,' + D + ' 0%,' + D + ' 55%,' + A + '33 160%)">' +
        '<div class="dp-cover__ring" style="border-color:' + CA + '44"></div>' +
        '<div class="dp-cover__kicker" style="color:' + CA + '">FIRAS AI</div>' +
        '<h1 class="dp-cover__title">' + escapeHtml(String(meta.title || "").slice(0, 120)) + "</h1>" +
        (meta.subtitle ? '<div class="dp-cover__sub" style="color:' + CA + '">' + escapeHtml(String(meta.subtitle).slice(0, 140)) + "</div>" : "") +
        '<div class="dp-cover__rule" style="background:' + CA + '"></div>' +
        '<div class="dp-cover__hint">' + L.start + "</div>" +
      "</div>");
    if (s.type === "section") return (
      '<div class="dp-section" style="background:linear-gradient(155deg,' + D + ',' + D + ')">' +
        '<div class="dp-section__no" style="color:' + CA + '">' + String(secOf[idx]).padStart(2, "0") + "</div>" +
        '<h2 class="dp-section__title">' + escapeHtml(s.title || "") + "</h2>" +
        '<div class="dp-cover__rule" style="background:' + CA + '"></div>' +
      "</div>");
    if (s.type === "end") return (
      '<div class="dp-section" style="background:linear-gradient(155deg,' + D + ',' + D + ')">' +
        '<h2 class="dp-section__title" style="font-size:clamp(30px,6vw,64px)">' + L.thanks + "</h2>" +
        '<div class="dp-cover__rule" style="background:' + CA + '"></div>' +
        '<div class="dp-cover__kicker" style="color:' + CA + ';margin-top:14px">FIRAS AI</div>' +
      "</div>");
    const fig = s.chart
      ? '<figure class="dp-slide__fig dp-slide__fig--chart">' + deckChartSvg(s.chart, th, true) + "</figure>"
      : s.image ? '<figure class="dp-slide__fig"><img src="' + escapeHtml(s.image) + '" alt="' + escapeHtml(s.imageAlt || "") + '" onerror="this.closest(\'figure\').style.display=\'none\'">' + (s.imageAlt ? "<figcaption>" + escapeHtml(s.imageAlt) + "</figcaption>" : "") + "</figure>" : "";
    return (
      '<div class="dp-slide' + (fig ? " dp-slide--img" : "") + '">' +
        '<div class="dp-slide__bar" style="background:' + A + '"></div>' +
        '<div class="dp-slide__txt">' +
          '<h2 class="dp-slide__title" style="color:' + D + '">' + escapeHtml(s.title || "") + '</h2>' +
          '<div class="dp-slide__rule" style="background:' + A + '"></div>' +
          "<ul>" + (s.bullets || []).map((b, k) => '<li style="--i:' + k + '">' + escapeHtml(b) + "</li>").join("") + "</ul>" +
        "</div>" + fig +
      "</div>");
  };
  const render = () => {
    const s = deck[idx];
    stage.className = "deck-pres__slide dp-anim-" + anim;
    stage.innerHTML = slideHtml(s);
    // restart the entrance animation (class re-add forces a reflow)
    void stage.offsetWidth;
    stage.classList.add("is-in");
    counter.textContent = (idx + 1) + " / " + N;
    progEl.style.width = ((idx) / (N - 1) * 100) + "%";
    notesEl.textContent = s.notes ? s.notes : L.noNotes;
    try { if (typeof typesetMath === "function") typesetMath(stage); } catch (_) {}
  };
  const go = (d) => { const n = Math.min(N - 1, Math.max(0, idx + d)); if (n !== idx) { idx = n; render(); } };
  const onKey = (e) => {
    if (!_deckPresState) return;
    const fwd = rtl ? "ArrowLeft" : "ArrowRight", back = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === fwd || e.key === " " || e.key === "Enter" || e.key === "PageDown") { e.preventDefault(); go(1); }
    else if (e.key === back || e.key === "PageUp") { e.preventDefault(); go(-1); }
    else if (e.key === "Home") { e.preventDefault(); idx = 0; render(); }
    else if (e.key === "End") { e.preventDefault(); idx = N - 1; render(); }
    else if (e.key === "Escape") { e.preventDefault(); closeDeckPresenter(); }
    else if (e.key === "f" || e.key === "F") { e.preventDefault(); try { document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen(); } catch (_) {} }
    else if (e.key === "n" || e.key === "N") { e.preventDefault(); notesEl.hidden = !notesEl.hidden; }
  };
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (btn) {
      const act = btn.getAttribute("data-act");
      if (act === "close") closeDeckPresenter();
      else if (act === "full") { try { document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen(); } catch (_) {} }
      else if (act === "notes") notesEl.hidden = !notesEl.hidden;
      return;
    }
    if (e.target.closest(".deck-pres__nav--next")) { go(1); return; }
    if (e.target.closest(".deck-pres__nav--prev")) { go(-1); return; }
    if (e.target.closest(".deck-pres__stage")) go(1);          // tap/click the stage → advance
  });
  root.querySelector(".deck-pres__anim").addEventListener("change", (e) => { anim = e.target.value; render(); });
  let tx = null;
  root.addEventListener("touchstart", (e) => { tx = e.touches && e.touches[0] ? e.touches[0].clientX : null; }, { passive: true });
  root.addEventListener("touchend", (e) => {
    if (tx == null) return;
    const dx = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : tx) - tx;
    if (Math.abs(dx) > 42) go((dx < 0) !== rtl ? 1 : -1);
    tx = null;
  }, { passive: true });
  document.addEventListener("keydown", onKey, true);
  _deckPresState = { root, onKey, prevOverflow: document.body.style.overflow };
  document.body.style.overflow = "hidden";
  render();
}

async function exportPpt(turn, lang, msg) {
  const deckMeta = parseDeckMeta(msg && msg.content);   // editable deck card → slides come straight from it
  const parsed = deckMeta ? { meta: { title: deckMeta.title, subtitle: deckMeta.subtitle, theme: deckMeta.theme, filename: deckMeta.title }, body: "" } : parseFileMeta(msg && msg.content);
  const meta = parsed.meta;
  if (deckMeta) lang = deckMeta.lang || lang;
  const md = deckMeta ? "deck" : ((parsed.body && parsed.body.trim()) || (mdNodeForTurn(turn) ? mdNodeForTurn(turn).textContent : ""));
  if (!md.trim()) { showToast(t().exportEmpty); return; }
  ensureFileTitle(meta, md);
  showToast(t().preparing);
  try {
    await loadScripts(EXPORT_LIBS.pptx);
    const Ctor = window.PptxGenJS || (window.pptxgen);
    if (!Ctor) throw new Error("nolib");
    const th = themeFor(meta);
    const accent = th.accent.toUpperCase(), deep = th.deep.toUpperCase(), cAcc = th.coverAccent.toUpperCase();
    const pptx = new Ctor();
    try { pptx.defineLayout({ name: "FIRAS16x9", width: 10, height: 5.625 }); pptx.layout = "FIRAS16x9"; } catch (_) {}
    const rtl = lang === "ar";
    const al = rtl ? "right" : "left";
    const titleFace = rtl ? "Arial" : "Georgia";
    const titleText = String(meta.title || (activeChat() && activeChat().title) || "Firas AI").slice(0, 100);
    const subText = String(meta.subtitle || "").slice(0, 120);
    const W = 10, H = 5.625;

    // ---- Title slide: deep themed background, white title, accent subtitle ----
    const title = pptx.addSlide();
    title.background = { color: deep };
    title.addShape(pptx.ShapeType.rect, { x: 0, y: H - 0.5, w: W, h: 0.12, fill: { color: cAcc } });
    title.addText("FIRAS AI", { x: 0.75, y: 0.55, w: W - 1.5, h: 0.4, fontSize: 13, bold: true, color: cAcc, align: al, rtlMode: rtl, charSpacing: 2 });
    title.addText(titleText, { x: 0.75, y: 1.95, w: W - 1.5, h: 1.5, fontSize: 38, bold: true, color: "FFFFFF", align: al, rtlMode: rtl, fontFace: titleFace });
    if (subText) title.addText(subText, { x: 0.75, y: 3.5, w: W - 1.5, h: 0.6, fontSize: 17, color: cAcc, align: al, rtlMode: rtl });

    // ---- Content slides ----
    let slides = deckMeta
      ? deckMeta.slides.map((s) => ({ title: s.title, bullets: s.bullets || [], notes: s.notes || "", image: s.image || "", imageAlt: s.imageAlt || "", chart: s.chart || null, section: s.t === "section" }))
      : slidesFromMarkdown(md, titleText);
    // Drop a leading "# Deck Title" slide (no bullets, title == the cover) so the
    // deck doesn't open with a near-empty duplicate of the cover.
    const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (slides.length && !slides[0].bullets.length && !slides[0].image && !slides[0].chart && norm(slides[0].title) === norm(titleText)) {
      slides = slides.slice(1);
    }
    const list = slides.length ? slides : [{ title: titleText, bullets: md.split(/\n+/).slice(0, 10), notes: "", image: "", section: false }];
    // Pre-fetch every slide image ONCE (parallel) → data URLs, so embedding is instant & CORS-safe.
    const imgMap = {};
    await Promise.all(list.filter((s) => s.image).map(async (s) => { const d = await imageToDataUrl(s.image, 9000); if (d) imgMap[s.image] = d; }));
    const total = list.length;
    let secNo = 0;
    list.forEach((s, idx) => {
      const dataImg = s.image && imgMap[s.image];
      if (s.section) {
        // ── SECTION DIVIDER — full deep background, big centered title, kicker number ──
        secNo++;
        const sl = pptx.addSlide();
        sl.background = { color: deep };
        sl.addShape(pptx.ShapeType.rect, { x: (W - 1.4) / 2, y: 2.05, w: 1.4, h: 0.06, fill: { color: cAcc } });
        sl.addText(String(secNo).padStart(2, "0"), { x: 0, y: 1.25, w: W, h: 0.5, fontSize: 15, bold: true, color: cAcc, align: "center", charSpacing: 3 });
        sl.addText(s.title.slice(0, 90), { x: 0.8, y: 2.35, w: W - 1.6, h: 1.4, fontSize: 32, bold: true, color: "FFFFFF", align: "center", rtlMode: rtl, fontFace: titleFace });
        if (s.notes) sl.addNotes(s.notes);
        return;
      }
      const sl = pptx.addSlide();
      sl.background = { color: "FFFFFF" };
      sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.14, fill: { color: accent } }); // top accent bar
      const hasChart = !!s.chart;
      const hasImg = !hasChart && !!dataImg;
      // Two-column when there's a visual: text on the reading side, chart/picture on the other.
      const textW = (hasImg || hasChart) ? 5.15 : (W - 1.2);
      const textX = rtl ? (hasImg ? W - 0.6 - textW : 0.6) : 0.6;
      if (s.title) {
        sl.addText(s.title.slice(0, 110), { x: textX, y: 0.5, w: textW, h: 0.85, fontSize: 25, bold: true, color: deep, align: al, rtlMode: rtl, fontFace: titleFace });
        sl.addShape(pptx.ShapeType.rect, { x: rtl ? textX + textW - 1.6 : textX, y: 1.28, w: 1.6, h: 0.05, fill: { color: accent } });
      }
      if (s.bullets.length) {
        sl.addText(s.bullets.map((b) => ({ text: b, options: { bullet: { code: "2022", indent: 16 }, breakLine: true, paraSpaceAfter: 6 } })), {
          x: textX, y: 1.55, w: textW, h: H - 2.15, fontSize: s.bullets.length > 6 ? 14 : 16, color: "1A1A18", lineSpacingMultiple: 1.16,
          align: al, rtlMode: rtl, valign: "top",
        });
      }
      if (hasChart) {
        // NATIVE PowerPoint chart — remains a real, editable chart object inside PowerPoint.
        try {
          const ch = normalizeDeckChart(s.chart);
          const cw = 4.15, chh = 3.6, cx2 = rtl ? 0.45 : W - 0.45 - cw, cy2 = 1.45;
          const data = ch.series.map((se) => ({ name: se.name || ch.title || "Series", labels: ch.labels, values: se.data }));
          const type = ch.type === "line" ? pptx.ChartType.line : ch.type === "doughnut" ? pptx.ChartType.doughnut : pptx.ChartType.bar;
          const PALX = [accent, "E0A458", deep, "8FA98F", "C97B84", "6B8CAE"];
          sl.addChart(type, data, {
            x: cx2, y: cy2, w: cw, h: chh,
            chartColors: ch.type === "doughnut" ? PALX.slice(0, ch.labels.length) : PALX.slice(0, ch.series.length),
            showTitle: !!ch.title, title: ch.title || "", titleFontSize: 13, titleColor: deep,
            showLegend: ch.type === "doughnut" || ch.series.length > 1, legendPos: "b", legendFontSize: 9,
            catAxisLabelFontSize: 9, valAxisLabelFontSize: 9, dataLabelFontSize: 9,
            showValue: ch.type !== "line", barDir: "col", barGapWidthPct: 40, lineSize: 2.5, lineDataSymbolSize: 5, holeSize: 55,
          });
        } catch (_) { /* chart is an enhancement — the slide still delivers */ }
      } else if (hasImg) {
        const iw = 3.7, ih = 3.55, ix = rtl ? 0.55 : W - 0.55 - iw, iy = 1.5;
        sl.addShape(pptx.ShapeType.roundRect, { x: ix - 0.08, y: iy - 0.08, w: iw + 0.16, h: ih + 0.16, fill: { color: deep }, rectRadius: 0.09 }); // frame/shadow
        try { sl.addImage({ data: dataImg, x: ix, y: iy, w: iw, h: ih, sizing: { type: "cover", w: iw, h: ih }, rounding: true }); } catch (_) {}
        if (s.imageAlt) sl.addText(s.imageAlt.slice(0, 70), { x: ix, y: iy + ih + 0.06, w: iw, h: 0.3, fontSize: 9, italic: true, color: "A8A69E", align: "center", rtlMode: rtl });
      }
      // Footer: brand + n / total.
      sl.addText("Firas AI", { x: 0.55, y: H - 0.42, w: 3, h: 0.3, fontSize: 9, color: "A8A69E", align: al, rtlMode: rtl });
      sl.addText((idx + 1) + " / " + total, { x: W - 1.35, y: H - 0.42, w: 0.8, h: 0.3, fontSize: 9, color: "A8A69E", align: "right" });
      if (s.notes) sl.addNotes(s.notes);
    });
    // ---- Closing slide ----
    const end = pptx.addSlide();
    end.background = { color: deep };
    end.addShape(pptx.ShapeType.rect, { x: (W - 1.4) / 2, y: 2.55, w: 1.4, h: 0.06, fill: { color: cAcc } });
    end.addText(rtl ? "شكرًا لكم" : "Thank you", { x: 0.8, y: 1.75, w: W - 1.6, h: 1, fontSize: 40, bold: true, color: "FFFFFF", align: "center", rtlMode: rtl, fontFace: titleFace });
    end.addText("Firas AI", { x: 0, y: 2.95, w: W, h: 0.4, fontSize: 13, color: cAcc, align: "center", charSpacing: 3 });
    const blob = await pptx.write({ outputType: "blob" });
    downloadBlob(blob, resolveFileName(meta, "pptx"));
  } catch (_) {
    showToast(t().formatUnavailable);
  }
}

/* ---- Export menu (keyboard-accessible, localized, Claude/teal) ----------- */

let _openExportMenu = null;
function closeExportMenu() {
  if (_openExportMenu) {
    _openExportMenu.menu.remove();
    _openExportMenu.btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", _onDocClickForMenu, true);
    document.removeEventListener("keydown", _onKeydownForMenu, true);
    _openExportMenu = null;
  }
}
function _onDocClickForMenu(e) {
  if (_openExportMenu && !_openExportMenu.menu.contains(e.target) && e.target !== _openExportMenu.btn && !_openExportMenu.btn.contains(e.target)) {
    closeExportMenu();
  }
}
function _onKeydownForMenu(e) {
  if (!_openExportMenu) return;
  const items = Array.from(_openExportMenu.menu.querySelectorAll('[role="menuitem"]'));
  const i = items.indexOf(document.activeElement);
  if (e.key === "Escape") { e.preventDefault(); const b = _openExportMenu.btn; closeExportMenu(); b.focus(); }
  else if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  else if (e.key === "Tab") { closeExportMenu(); }
}

/** The Download control: a button that opens a small menu of 4 formats. */
function exportControlEl(msg, index) {
  const wrap = document.createElement("div");
  wrap.className = "export-menu";

  const btn = mkAction(ICONS.download, t().download);
  btn.classList.add("export-menu__trigger");
  btn.setAttribute("aria-haspopup", "menu");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML += `<span class="export-menu__caret">${ICONS.chevron}</span>`;
  wrap.appendChild(btn);

  const items = [
    { icon: ICONS.filePdf, label: t().downloadPdf, run: (turn) => exportPdf(turn, msg.lang) },
    { icon: ICONS.fileDoc, label: t().downloadWord, run: (turn) => exportWord(turn, msg.lang) },
    { icon: ICONS.fileXls, label: t().downloadExcel, run: (turn) => exportExcel(turn, msg.lang) },
    { icon: ICONS.filePpt, label: t().downloadPpt, run: (turn) => exportPpt(turn, msg.lang, msg) },
  ];

  const openMenu = () => {
    if (_openExportMenu && _openExportMenu.btn === btn) { closeExportMenu(); return; }
    closeExportMenu();
    const menu = document.createElement("div");
    menu.className = "export-menu__list";
    menu.setAttribute("role", "menu");
    items.forEach((it) => {
      const mi = document.createElement("button");
      mi.type = "button";
      mi.className = "export-menu__item";
      mi.setAttribute("role", "menuitem");
      mi.tabIndex = -1;
      mi.innerHTML = `${it.icon}<span>${escapeHtml(it.label)}</span>`;
      mi.addEventListener("click", () => {
        const turn = wrap.closest(".msg-ai");
        closeExportMenu();
        it.run(turn);
      });
      menu.appendChild(mi);
    });
    wrap.appendChild(menu);
    btn.setAttribute("aria-expanded", "true");
    _openExportMenu = { btn, menu };
    setTimeout(() => {
      document.addEventListener("click", _onDocClickForMenu, true);
      document.addEventListener("keydown", _onKeydownForMenu, true);
    }, 0);
    const first = menu.querySelector('[role="menuitem"]');
    if (first) first.focus();
  };

  btn.addEventListener("click", (e) => { e.stopPropagation(); openMenu(); });
  return wrap;
}

/* ============================================================================
   LIVE HTML PREVIEW
   ========================================================================== */

/** Heuristic: does this code block contain previewable HTML? */
function looksLikeHtml(lang, code) {
  if (/^(html|xhtml|htm)$/i.test(lang || "")) return true;
  const c = (code || "").trim();
  if (/<!doctype\s+html/i.test(c)) return true;
  if (/<html[\s>]/i.test(c)) return true;
  // A body fragment with structural tags (best-effort).
  if (/<(body|head|div|section|main|article|h[1-6]|table|ul|ol|form|canvas|svg)[\s>]/i.test(c) &&
      /<\/(div|section|main|article|body|html|p|table|ul|ol)>/i.test(c)) return true;
  return false;
}

/** Wrap a bare HTML fragment into a full document so the iframe renders it. */
function ensureHtmlDocument(code) {
  const c = (code || "").trim();
  if (/<html[\s>]/i.test(c) || /<!doctype/i.test(c)) return c;
  return "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head><body>" + c + "</body></html>";
}

let _previewState = null;
function openHtmlPreview(rawCode) {
  closeHtmlPreview();
  const html = ensureHtmlDocument(rawCode);

  const overlay = document.createElement("div");
  overlay.className = "preview-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", t().previewTitle);

  const panel = document.createElement("div");
  panel.className = "preview-panel";

  const header = document.createElement("div");
  header.className = "preview-panel__head";
  header.innerHTML =
    `<span class="preview-panel__title">${ICONS.preview}<span>${escapeHtml(t().previewTitle)}</span></span>`;

  const tools = document.createElement("div");
  tools.className = "preview-panel__tools";

  const mkTool = (icon, label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "preview-tool";
    b.title = label;
    b.setAttribute("aria-label", label);
    b.innerHTML = icon;
    b.addEventListener("click", fn);
    return b;
  };

  // Sandboxed iframe — NO allow-same-origin, so previewed code cannot reach the
  // app's origin, cookies, or storage. srcdoc content runs isolated.
  const iframe = document.createElement("iframe");
  iframe.className = "preview-frame";
  iframe.setAttribute("sandbox", "allow-scripts allow-forms allow-popups");
  iframe.setAttribute("title", t().previewTitle);
  iframe.srcdoc = html;

  const refreshBtn = mkTool(ICONS.refresh, t().previewRefresh, () => { iframe.srcdoc = html; });
  const openBtn = mkTool(ICONS.external, t().previewOpen, () => {
    try {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (_) { showToast(t().formatUnavailable); }
  });
  const dlBtn = mkTool(ICONS.download, t().previewDownload, () => {
    downloadBlob(new Blob([html], { type: "text/html" }), exportFileId() + ".html");
  });
  const closeBtn = mkTool(ICONS.close, t().previewClose, closeHtmlPreview);
  closeBtn.classList.add("preview-tool--close");

  tools.append(refreshBtn, openBtn, dlBtn, closeBtn);
  header.appendChild(tools);
  panel.append(header, iframe);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeHtmlPreview(); });
  document.addEventListener("keydown", _onPreviewKeydown, true);
  _previewState = { overlay, lastFocus: document.activeElement };
  requestAnimationFrame(() => { overlay.classList.add("is-open"); closeBtn.focus(); });
}
function _onPreviewKeydown(e) {
  if (e.key === "Escape" && _previewState) { e.preventDefault(); closeHtmlPreview(); }
}
function closeHtmlPreview() {
  if (!_previewState) return;
  document.removeEventListener("keydown", _onPreviewKeydown, true);
  const st = _previewState;
  _previewState = null;
  st.overlay.classList.remove("is-open");
  setTimeout(() => st.overlay.remove(), 180);
  if (st.lastFocus && st.lastFocus.focus) { try { st.lastFocus.focus(); } catch (_) {} }
}

/* ----------------------------------------------------------------------------
   Auto-scroll management (pause when user scrolls up)
---------------------------------------------------------------------------- */
let autoScroll = true;
function scrollToBottom() {
  // Instant, not smooth: per-frame smooth-scroll assignments during streaming restart the
  // animation forever (view chases the bottom, wastes main thread). A rAF settle pass corrects
  // once content-visibility sizes resolve on long threads.
  const el = els.chatScroll;
  el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}
function onScroll() {
  const el = els.chatScroll;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  autoScroll = nearBottom;
  els.scrollBottomBtn.classList.toggle("is-visible", !nearBottom);
}

/* ----------------------------------------------------------------------------
   Image attachments — client-side downscale, tray, never-freeze reads
   pendingImages: [{ id, full: {b64,mime}, thumb: dataURL }]
---------------------------------------------------------------------------- */
const MAX_IMAGES = 10;
const MAX_EDGE = 1568;       // longest edge sent to the vision model
const THUMB_EDGE = 256;      // tiny thumb persisted to history
let pendingImages = [];
let readingImages = 0;       // >0 while ANY attachment (image/doc) is being processed (disables send)
// Remember each chat's last attached image so a follow-up ("now make them harder", "translate
// it", "extract more") can reuse it WITHOUT re-sending. In-memory only (not persisted).
const lastImagesByChat = new Map();
// Does this follow-up text refer to a previously-attached image/its content?
function refersToPriorImage(s) {
  const t = String(s || "");
  if (isImageTransformRequest(t)) return true;
  return /الصور|صورة|الملف|المرفق|المرفقة|منها|فيها|الأسئلة|نفس(ها)?|بنفس|image|file|attachment|extract|estract|the questions|them|it/i.test(t);
}

/* ---- Document attachments (PDF / code / text) — read to text, sent as context ---- */
let pendingFiles = [];       // [{ id, name, kind:'pdf'|'code', text, loading }]
const MAX_FILES = 5;
const MAX_FILE_CHARS = 120000;        // per-file extracted-text cap
const MAX_TOTAL_FILE_CHARS = 300000;  // total across all attached files
const CODE_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|xml|yml|yaml|html?|css|scss|less|js|jsx|mjs|cjs|ts|tsx|py|java|c|h|cpp|cc|hpp|cs|go|rs|rb|php|swift|kt|kts|sql|sh|bash|zsh|ini|toml|env|cfg|conf|log|tex|srt|vtt|rtf|svg)$/i;
function isPdfFile(file) { return file.type === "application/pdf" || /\.pdf$/i.test(file.name || ""); }
function isTextFile(file) {
  return (file.type && (file.type.startsWith("text/") || /(json|xml|javascript|typescript|csv|yaml|x-sh|x-python)/i.test(file.type))) || CODE_EXT.test(file.name || "");
}
/** Lazy-load pdf.js (CDN) once, for in-browser PDF text extraction. */
let _pdfjsPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } catch (_) {} resolve(window.pdfjsLib); };
    s.onerror = () => { _pdfjsPromise = null; reject(new Error("pdfjs")); };
    document.head.appendChild(s);
  });
  return _pdfjsPromise;
}
async function extractPdfText(file) {
  const pdfjs = await loadPdfJs();
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  let text = "";
  const pages = Math.min(pdf.numPages, 60);
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map((it) => it.str).join(" ") + "\n\n";
    if (text.length > MAX_FILE_CHARS) break;
  }
  return text.trim();
}
/** Higher-capacity PDF extraction for the admin reference library (whole books). */
async function extractPdfTextForKb(file, onProgress) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = "";
  // NO page cap — any-size books are supported (the uploader splits the text into parts).
  // A high RAM safety net only; per-page cleanup + periodic yields keep the tab responsive.
  const pages = pdf.numPages;
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map((it) => it.str).join(" ") + "\n\n";
    try { page.cleanup(); } catch (_) {}
    if (onProgress && (i % 5 === 0 || i === pages)) onProgress(i, pages);
    if (i % 25 === 0) await new Promise((r) => setTimeout(r, 0));   // let the UI breathe
    if (text.length > 40_000_000) break;   // extreme RAM safety net only
  }
  return text.trim();
}

/* Split a big book's text into ≤~700K-char parts on paragraph (then sentence) boundaries.
   Each part is uploaded as its OWN KB entry — this is what makes ANY-size PDFs work: every
   part stays under the backend's per-entry chunk cap AND under the edge request-body limit.
   Search needs no changes: both backends score per-chunk across all entries, so parts merge. */
function splitKbText(text, maxLen) {
  maxLen = maxLen || 700_000;
  const s = String(text);
  if (s.length <= maxLen) return [s];
  const parts = [];
  let start = 0;
  while (start < s.length) {
    let end = Math.min(start + maxLen, s.length);
    if (end < s.length) {
      const para = s.lastIndexOf("\n\n", end);
      if (para > start + maxLen * 0.5) end = para;
      else { const sent = Math.max(s.lastIndexOf(". ", end), s.lastIndexOf("۔", end), s.lastIndexOf("؟", end), s.lastIndexOf("? ", end), s.lastIndexOf("! ", end), s.lastIndexOf("\n", end)); if (sent > start + maxLen * 0.5) end = sent + 1; }
    }
    parts.push(s.slice(start, end).trim());
    start = end;
  }
  return parts.filter((p) => p);
}

/** Load a File into an HTMLImageElement (off the main render path). */
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
    img.src = url;
  });
}

/** Draw an image downscaled to maxEdge onto a canvas → JPEG dataURL. */
function downscale(img, maxEdge, quality) {
  let { naturalWidth: w, naturalHeight: h } = img;
  if (Math.max(w, h) > maxEdge) {
    const s = maxEdge / Math.max(w, h);
    w = Math.round(w * s); h = Math.round(h * s);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Strip the "data:...;base64," prefix → raw base64 the backend forwards. */
function rawBase64(dataUrl) {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

/** Dispatch attached files: images → vision tray; PDF/code/text → document tray. */
async function handleFiles(fileList) {
  const all = Array.from(fileList || []);
  const images = all.filter((f) => f.type.startsWith("image/"));
  const docs = all.filter((f) => !f.type.startsWith("image/") && (isPdfFile(f) || isTextFile(f)));
  const bad = all.filter((f) => !f.type.startsWith("image/") && !isPdfFile(f) && !isTextFile(f));
  if (bad.length) showToast(state.lang === "ar" ? "نوع ملف غير مدعوم" : "Unsupported file type");
  if (images.length) await handleImageFiles(images);
  if (docs.length) await handleDocFiles(docs);
}

/** Read PDF/code/text files to plain text and stage them as message context. */
async function handleDocFiles(files) {
  for (const file of files) {
    if (pendingFiles.length >= MAX_FILES) {
      showToast(state.lang === "ar" ? `الحد الأقصى ${MAX_FILES} ملفات` : `Max ${MAX_FILES} files`);
      break;
    }
    const used = pendingFiles.reduce((n, f) => n + (f.text ? f.text.length : 0), 0);
    if (used >= MAX_TOTAL_FILE_CHARS) { showToast(state.lang === "ar" ? "حجم الملفات كبير جداً" : "Files too large"); break; }
    const id = uid();
    const kind = isPdfFile(file) ? "pdf" : "code";
    pendingFiles.push({ id, name: (file.name || (kind === "pdf" ? "document.pdf" : "file.txt")).slice(0, 80), kind, text: "", loading: true });
    renderAttachTray(); readingImages++; updateSendState();
    try {
      let text = isPdfFile(file) ? await extractPdfText(file) : await file.text();
      text = String(text || "").slice(0, Math.min(MAX_FILE_CHARS, Math.max(0, MAX_TOTAL_FILE_CHARS - used)));
      const item = pendingFiles.find((p) => p.id === id);
      if (!text.trim()) {
        pendingFiles = pendingFiles.filter((p) => p.id !== id);
        showToast(state.lang === "ar" ? "ما كدرت أقرأ نص من الملف" : "No readable text in file");
      } else if (item) { item.text = text; item.loading = false; }
    } catch (_) {
      pendingFiles = pendingFiles.filter((p) => p.id !== id);
      showToast(state.lang === "ar" ? "تعذّر قراءة الملف" : "Couldn't read file");
    } finally { readingImages--; renderAttachTray(); updateSendState(); }
  }
}

function removePendingFile(id) {
  pendingFiles = pendingFiles.filter((p) => p.id !== id);
  renderAttachTray(); updateSendState();
}

async function handleImageFiles(files) {
  for (const file of files) {
    if (pendingImages.length >= MAX_IMAGES) {
      showToast(state.lang === "ar" ? `الحد الأقصى ${MAX_IMAGES} صور` : `Max ${MAX_IMAGES} images`);
      break;
    }
    const id = uid();
    pendingImages.push({ id, full: null, thumb: "", loading: true });
    renderAttachTray();
    readingImages++;
    updateSendState();
    try {
      const img = await fileToImage(file);
      const fullUrl = downscale(img, MAX_EDGE, 0.85);
      const thumbUrl = downscale(img, THUMB_EDGE, 0.7);
      const item = pendingImages.find((p) => p.id === id);
      if (item) {
        item.full = { b64: rawBase64(fullUrl), mime: "image/jpeg" };
        item.thumb = thumbUrl;
        item.loading = false;
      }
    } catch (_) {
      pendingImages = pendingImages.filter((p) => p.id !== id);
      showToast(state.lang === "ar" ? "تعذّر قراءة الصورة" : "Couldn't read image");
    } finally {
      readingImages--;
      renderAttachTray();
      updateSendState();
    }
  }
}

function removePendingImage(id) {
  pendingImages = pendingImages.filter((p) => p.id !== id);
  renderAttachTray();
  updateSendState();
}

function clearPendingImages() {
  pendingImages = [];
  pendingFiles = [];
  renderAttachTray();
}

function renderAttachTray() {
  const tray = els.attachTray;
  if (!tray) return;
  tray.innerHTML = "";
  pendingImages.forEach((p) => {
    const cell = document.createElement("div");
    cell.className = "attach-thumb" + (p.loading ? " is-loading" : "");
    if (!p.loading && p.thumb) {
      const img = document.createElement("img");
      img.src = p.thumb; img.alt = "";
      cell.appendChild(img);
    }
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "attach-thumb__remove";
    rm.setAttribute("aria-label", t().delete);
    rm.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    rm.addEventListener("click", () => removePendingImage(p.id));
    cell.appendChild(rm);
    tray.appendChild(cell);
  });
  pendingFiles.forEach((p) => {
    const cell = document.createElement("div");
    cell.className = "attach-file" + (p.loading ? " is-loading" : "");
    const icon = document.createElement("span");
    icon.className = "attach-file__icon";
    icon.textContent = p.kind === "pdf" ? "PDF" : "TXT";
    const name = document.createElement("span");
    name.className = "attach-file__name";
    name.textContent = p.loading ? (state.lang === "ar" ? "...قراءة" : "reading…") : p.name;
    cell.appendChild(icon); cell.appendChild(name);
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "attach-thumb__remove";
    rm.setAttribute("aria-label", t().delete);
    rm.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    rm.addEventListener("click", () => removePendingFile(p.id));
    cell.appendChild(rm);
    tray.appendChild(cell);
  });
}

/* ----------------------------------------------------------------------------
   Composer behaviour
---------------------------------------------------------------------------- */
function autoGrow() {
  const ta = els.input;
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 152) + "px";
}
function syncComposerDir() {
  const lang = detectLang(els.input.value);
  els.input.dir = lang === "ar" ? "rtl" : "ltr";
  els.input.style.textAlign = "start";
}
function updateSendState() {
  if (state.streaming) return;
  const hasText = els.input.value.trim().length > 0;
  const hasReadyImage = pendingImages.some((p) => !p.loading && p.full);
  const hasReadyFile = pendingFiles.some((p) => !p.loading && p.text);
  // Disable while attachments are still being processed (never freeze, but no half-sends).
  els.sendBtn.disabled = readingImages > 0 || (!hasText && !hasReadyImage && !hasReadyFile);
}

/* ----------------------------------------------------------------------------
   Networking — streaming send with abort + timeout + offline fallback
---------------------------------------------------------------------------- */

/* STEM questions are HARD BY DEFAULT on EVERY tier and EVERY engine (user mandate). Appended to
   the chat system prompt, the file-document author, the batch workbook author, and the Agent's
   exam guide — so "اعطني أسئلة فيزياء" yields genuinely hard, novel, distinctive problems even on
   Mini and even when a fallback engine answers, unless the user EXPLICITLY asks for easy/basic. */
const STEM_HARD_RULE =
  " STEM DIFFICULTY — HARD BY DEFAULT (every tier, every engine): whenever you GENERATE questions, " +
  "problems, exams or worksheets in mathematics, physics, chemistry or any quantitative science and the " +
  "user did NOT explicitly ask for an easy/basic/beginner level, make them GENUINELY HARD — strong " +
  "competition / JEE-Advanced calibre: every problem multi-concept and multi-step, built on TRICKY ideas " +
  "(clever substitutions, symmetry/King's rule, chained integration by parts, hyperbolic identities, " +
  "floor/ceiling behaviour, parametric traps, limits of sums, non-obvious conservation arguments, " +
  "multi-stage stoichiometry/equilibria…). NEVER routine textbook drills (∫x·sinh x dx by parts alone is a " +
  "FAILURE — too easy). Every problem must be NOVEL, UNIQUE and DISTINCTIVE: constructed by YOU with fresh " +
  "structures, functions, numbers and scenarios — never a known classic, a famous competition problem, or a " +
  "lightly reworded book/net exercise. Make each exam varied (no two problems test the same single idea) and " +
  "exam-worthy — while staying VALID, well-posed and cleanly solvable with exact answers (solve each one " +
  "yourself first; discard anything you cannot solve cleanly).";

/** Build the messages array for the API from a tier + conversation slice. */
function buildMessages(tier, conversation, replyLang) {
  const model = MODELS[tier];
  const identityRule =
    " You are Firas AI, a smart and helpful assistant. Your name is Firas AI. " +
    "Never mention, reveal, or guess any underlying model, provider, company, or " +
    "architecture — do NOT say GPT, GPT-4, OpenAI, Anthropic, Claude, Google, Gemini, " +
    "Llama, Mistral, pollinations, or that you are 'based on' / 'powered by' anything. " +
    "If asked which model, engine, or AI you are, simply answer that you are Firas AI. " +
    "If asked who developed/made/created/built/trained you (e.g. 'من هو مطورك', 'من صنعك', 'من طورك', " +
    "'who made/created you', 'your developer'), answer with pride that you were developed by the developer " +
    "Firas (المطور فراس) using the latest artificial-intelligence technologies — then elaborate naturally and " +
    "warmly in your own words (his vision, the advanced AI techniques, that you're built to serve users). " +
    "NEVER attribute your creation to any company or other party — only the developer Firas. " +
    "NEVER mention a knowledge cutoff or training date (e.g. 'as of 2024', 'بعد تاريخ القطع'), and NEVER say " +
    "you can't access the internet, live, real-time, or current data — Firas CAN look things up. When WEB SEARCH " +
    "RESULTS are provided, use them directly to answer. If a question needs fresh info and you have none, give the " +
    "best relevant answer you can and offer to check further — but do NOT state a cutoff or refer the user to other " +
    "sites/apps (FlashScore, ESPN, Twitter, etc.) as a substitute for answering.";
  const langRule =
    " Always reply in the SAME language as the user's most recent message " +
    "(Arabic→Arabic, English→English). Never switch languages on your own.";
  const mathRule =
    " For ANY mathematics, physics, chemistry or scientific notation, ALWAYS format it as LaTeX: " +
    "inline math as $...$ and display math as $$...$$ — never write raw unformatted formulas. " +
    "Use ONLY valid, KaTeX-renderable LaTeX: correct commands (\\frac, \\sqrt, \\int, \\lim, \\sum, \\vec, " +
    "subscripts/superscripts), and put units and words that appear inside math in \\text{} with thin spaces " +
    "(e.g. $9.8\\,\\text{m/s}^2$, $3\\,\\text{N}\\cdot\\text{m}$, chemical formulas like $\\text{H}_2\\text{O}$). " +
    "Never emit broken or glued commands (e.g. \\cdotp with no space) that would fail to render. " +
    "MATH RIGOR: solve step by step, carry out every algebraic and arithmetic step exactly, and " +
    "VERIFY the result before giving it (e.g. differentiate an antiderivative back to the integrand, " +
    "substitute values to check an identity or equation, sanity-check limits and edge cases). Never " +
    "state a numeric or symbolic result you have not checked. Give EXACT closed-form results " +
    "(fractions, radicals, π, e, exact symbolic forms) — do NOT round to decimals unless the user " +
    "explicitly asks. For proofs, write a clean structured argument (state what is given, what is to " +
    "be shown, then the proof, ending with ∎), and present the final answer clearly on its own line." +
    " PROBLEM GENERATION: when the user asks you to CREATE / GENERATE / MAKE / DESIGN a problem, exercise, " +
    "question or integral (e.g. 'give me a hard JEE integral', 'make a hard problem'), output a GENUINELY " +
    "HARD, ORIGINAL, competition-grade one — JEE-Advanced / Olympiad / Putnam level — that demands a real, " +
    "non-obvious idea or technique. NEVER a routine textbook example, a trivially simple form, or an " +
    "easily-recognizable standard pattern (e.g. avoid bare $\\int \\ln x/(1+x)\\,dx$ types). " +
    "ZERO MISTAKES — THE PROBLEM MUST BE WELL-POSED AND FULLY SOLVABLE: before you present it, SOLVE it " +
    "yourself end-to-end and CONFIRM it is properly defined and convergent (check every endpoint/singularity) " +
    "and yields a clean, correct, FINITE closed-form answer (rationals, π, e, ln, ζ, …). NEVER present a " +
    "divergent, undefined, ambiguous, or unsolvable problem, and never an unverified answer. If ANYTHING is " +
    "off or you can't get a clean finite answer, silently discard it and pick another. Each generated problem distinct.";
  const buildRule =
    " When asked to build a website, web app, page or UI, output ONE complete, polished, " +
    "PRODUCTION-QUALITY single HTML file (inline <style> and <script>). Make it LARGE and " +
    "thorough: many real sections, a refined modern responsive layout with smooth " +
    "animations and micro-interactions, real placeholder content, and working JavaScript. " +
    "Do NOT produce a minimal skeleton — build a complete, well-organized, professional " +
    "site; it is expected to be long (often many hundreds to a few thousand lines). Output " +
    "the full code directly and never stop mid-file.";
  const engineerRule =
    " You are an ELITE, world-class software engineer. Write top-tier code: correct, " +
    "complete, robust, idiomatic and PRODUCTION-GRADE — never stubs, pseudo-code, " +
    "placeholders, or '...rest unchanged'. Structure code cleanly (clear names, sound " +
    "architecture, separation of concerns), handle edge cases and errors, and keep it " +
    "secure and performant. Prefer modern best practices and the most appropriate tools " +
    "for the task. Include exactly what's needed to run it (imports, setup, usage) and a " +
    "concise rationale. Use clear type signatures/annotations where the language supports them, " +
    "validate inputs and fail loudly with meaningful errors (never swallow exceptions), avoid " +
    "global mutable state, note time/space complexity for non-trivial algorithms, and follow the " +
    "language's dominant style (PEP 8, idiomatic Go, modern ES). When it adds value, include a few " +
    "illustrative usage examples or self-checks. ALWAYS strive to satisfy the user: anticipate their " +
    "real needs, go the extra mile, polish the details, and deliver something you'd be proud to ship.";
  const codeRule =
    " CODE FORMATTING — ALWAYS FENCE CODE: put EVERY piece of source code, in ANY programming " +
    "language (Python, JavaScript, TypeScript, C, C++, C#, Java, Go, Rust, SQL, HTML, CSS, PHP, " +
    "Ruby, Swift, Kotlin, Bash, etc.), inside a Markdown fenced code block that OPENS with three " +
    "backticks immediately followed by the language name and CLOSES with three backticks on their " +
    "own line — e.g. ```python … ``` or ```js … ```. This is MANDATORY for every snippet, function, " +
    "script, or file you show, no matter how short. NEVER write multi-line code as plain text, as " +
    "indented text, or inline, and NEVER omit the closing fence. Put terminal/shell commands in a " +
    "```bash block. Use single backticks ONLY for a short inline token (a variable, function, or file " +
    "name) inside a sentence — never for a whole snippet or a multi-line block.";
  const accuracyRule =
    " ACCURACY — DO NOT FABRICATE: never invent facts, especially recent events, sports scores/results, " +
    "match line-ups, goalscorers, statistics, prices, or dates. If WEB SEARCH RESULTS are provided, rely on them " +
    "and cite. If you do NOT have reliable information about something (e.g. a match result, a current office-holder, " +
    "a future/recent event), say clearly that you're not certain and offer to look it up — NEVER make up a specific " +
    "score, name, or detail. If a match/event did not happen or you can't confirm it, say so plainly. A correct " +
    "'I'm not sure' is far better than a confident wrong answer, and inventing a fake result is unacceptable." +
    " MATH/SCIENCE CORRECTNESS — VERIFY BEFORE ANSWERING: for any calculation, equation, derivation or " +
    "quantitative result, CHECK your work before giving the final answer: substitute the solution back " +
    "into the original equation, differentiate an antiderivative back to the integrand, re-add/re-multiply, " +
    "verify units and dimensional consistency, and test edge cases. If a check fails, fix it silently and " +
    "give only the corrected result. State exact closed forms (fractions, radicals, π) unless a decimal is asked. " +
    "Never present an unverified numeric/algebraic result as final." +
    " PLAN THEN SOLVE: before computing, briefly lay out the steps and quantities you will compute, then execute " +
    "them one at a time with explicit intermediate results — a skipped step is the most common cause of a wrong answer. " +
    "CROSS-CHECK BY A SECOND METHOD: for any non-trivial result, confirm it a second, independent way (a different " +
    "method, a limiting/special case, or a sanity estimate); if the two disagree, find and fix the error internally " +
    "and show only the corrected final result. Do all of this verification WITHIN THIS SAME REPLY — never defer it to " +
    "a later message. These correctness rules are ABSOLUTE and ENGINE-INDEPENDENT: apply the full plan → solve → " +
    "verify → silently-correct discipline on EVERY answer, and never let quality drop because a lighter/backup model " +
    "happens to be generating.";
  // In PLAN MODE, do NOT send buildRule/engineerRule — they push the model to emit the
  // full code/deliverable, which contradicts planSystem and caused the plan itself to be
  // written as a code block (then the Start pill was suppressed). planSystem alone governs.
  const planning = state.mode === "plan";
  // Difficulty calibration so the tiers are clearly ranked when GENERATING problems — Max the
  // absolute hardest, Ultra a deliberate notch below (both still error-free & fully solvable).
  // SOLVE-BEFORE-YOU-ASK: a problem is only published if the model has ALREADY solved it cleanly to an
  // exact answer — this is what stops "hard but broken/unsolvable/wrong" output on weaker engines.
  const solveFirst =
    " SOLVE-BEFORE-YOU-ASK: first solve the problem completely and correctly in your own private working; " +
    "if your full solution is not clean, is ambiguous, or has no exact closed-form answer, DISCARD it and " +
    "generate a different valid one — never publish a problem you could not cleanly solve. Difficulty must come " +
    "from DEPTH of reasoning and combined concepts, NEVER from ambiguity, missing information, or an unsolvable " +
    "setup. Then present the problem AND a fully-worked step-by-step solution ending in an exact final answer.";
  const genLevelRule =
    tier === "max"
      ? " DIFFICULTY TIER — you are MAX, the TOP tier: when generating a problem, make it the ABSOLUTE HARDEST you can while keeping it valid and cleanly solvable (hardest-JEE-Advanced / Olympiad-final / Putnam level)." + solveFirst
      : tier === "ultra"
      ? " DIFFICULTY TIER — you are ULTRA: when generating a problem, make it VERY HARD (advanced competition), but DELIBERATELY one notch EASIER than the Max tier so the difference is clear — still completely valid and error-free." + solveFirst
      : tier === "pro"
      ? " DIFFICULTY TIER — PRO: when generating a problem, make it solidly challenging (strong exam / early-competition level), fully valid and cleanly solvable." + solveFirst
      : "";
  const imageRule =
    " When MULTIPLE images are attached, examine EVERY image carefully and INDIVIDUALLY (one by one), " +
    "and use ALL of them to answer fully — never skip, merge, or ignore any attached image.";
  const tikzRule =
    " GRAPHING (ALWAYS USE `plot`, NEVER tikz): for ANY function/curve graph — cartesian (y=f(x)), POLAR " +
    "(r=f(theta), rose/spiral/cardioid…), or PARAMETRIC (x=f(t),y=g(t)) — you MUST output a fenced `plot` block, " +
    "NOT tikz. tikz graphs break in downloaded files; the `plot` block renders as a real graph everywhere " +
    "(chat AND PDF). Put one or " +
    "more `y = <expression>` lines using EXPLICIT operators and standard functions, e.g.\n```plot\ny = x^2\n" +
    "domain: -4..4\n```\nSupported: + - * / ^, parentheses, and sin cos tan asin acos atan sinh cosh tanh exp ln " +
    "log(base10) sqrt cbrt abs floor ceil round; constants pi, e. For a normal graph use x (x^2, 2*x, sin(x)); " +
    "several `y = …` lines draw several curves. Add an optional `domain: a..b` line. " +
    "POLAR: write `r = <expr in theta>` (e.g. `r = 1 + cos(theta)`) with an optional `theta: 0..2*pi`. " +
    "PARAMETRIC: write BOTH `x = <expr in t>` and `y = <expr in t>` (e.g. `x = cos(t)` / `y = sin(2*t)`) with an optional `t: 0..2*pi`. " +
    "3D SURFACE: write `z = <expr in x,y>` (e.g. `z = sin(x)*cos(y)` or `z = x^2 - y^2`) with optional `x: -3..3` and `y: -3..3` — renders as an interactive isometric 3D surface. " +
    "GEOMETRY / DIAGRAMS (triangles, circles, vectors, points, angles, polygons — NOT function graphs): ALSO use the SAME fenced `plot` block, " +
    "NEVER tikz. Put one shape command per line — coordinates are `(x,y)`; options: `r=<radius>`, `color=<#hex>`, `dashed`, `fill`, and a \"label\" in quotes. Commands:\n" +
    "`point (x,y) \"A\"` · `text (x,y) \"note\"` · `segment (x1,y1) (x2,y2)` · `line (x1,y1) (x2,y2)` (infinite) · `vector (x1,y1) (x2,y2)` (arrow) · " +
    "`circle (cx,cy) r=R` · `ellipse (cx,cy) rx=A ry=B` · `arc (cx,cy) r=R 0..120` (degrees) · `angle (x1,y1) (vx,vy) (x2,y2) \"θ\"` (marks the angle at the middle vertex) · " +
    "`triangle (x1,y1) (x2,y2) (x3,y3)` · `rectangle (x1,y1) (x2,y2)` (opposite corners) · `polygon (x1,y1) (x2,y2) (x3,y3) …`. Example:\n```plot\ncircle (0,0) r=3\npoint (0,0) \"O\"\ntriangle (-3,0) (3,0) (0,3) fill color=#237a68\nvector (0,0) (3,3) \"v\"\n```\n" +
    "This renders natively (chat AND PDF) with a clean grid, true round circles, and equal aspect — you NEVER need tikz for geometry. " +
    "A request to DRAW / sketch / graph is answered with a `plot` figure in a NORMAL chat reply — NEVER " +
    "by building an HTML/CSS/JS page, a <canvas>, or a website to draw it (build a web app ONLY if the user " +
    "EXPLICITLY asks for an interactive web app). Normal math still goes in $ … $ / $$ … $$ as usual.";
  const system = {
    role: "system",
    content: model.persona + identityRule + langRule + mathRule + accuracyRule + codeRule + genLevelRule + STEM_HARD_RULE + imageRule + tikzRule + (planning ? "" : buildRule + engineerRule),
  };

  // PLAN MODE: a per-turn system message (inserted right after the persona).
  // Firas first asks 1-3 specific clarifying questions if needed, then gives a
  // short numbered plan and invites approval — UNLESS the user just approved a
  // plan or answered the questions, in which case it executes immediately.
  const planSystem = state.mode === "plan" ? {
    role: "system",
    content:
      "You are in PLAN MODE. This OVERRIDES any other instruction about producing " +
      "code, a website, a document, or a file directly. Do NOT produce the final " +
      "deliverable yet — EVEN if the request is to build a website/app or make a file.\n" +
      "STEP 1 — CLARIFY WITH INTERACTIVE CHOICES: If anything truly matters and is " +
      "ambiguous, do NOT ask in plain prose. Instead emit EXACTLY ONE fenced code block " +
      "tagged `firas-ask` whose body is JSON in this schema:\n" +
      "```firas-ask\n" +
      "{ \"intro\": \"optional short lead-in\",\n" +
      "  \"questions\": [\n" +
      "    { \"id\": \"storage\", \"question\": \"…?\", \"multi\": false,\n" +
      "      \"options\": [\n" +
      "        { \"label\": \"…\", \"recommended\": true, \"desc\": \"optional\" },\n" +
      "        { \"label\": \"…\", \"desc\": \"optional\" } ] } ] }\n" +
      "```\n" +
      "RULES for firas-ask: include only the 1-4 questions that genuinely matter; each " +
      "question has 2-5 options; set \"multi\":true for multi-select (checkboxes) or " +
      "false/omit for single-select (radios); mark the single best option(s) with " +
      "\"recommended\":true; \"desc\" and \"intro\" are optional; ALL text (question, " +
      "label, desc, intro) MUST be in the user's language. Output ONLY the firas-ask " +
      "block (a short sentence before it is allowed) — no plan and no prose questions in " +
      "the same turn. Emit valid JSON only (no trailing commas, no comments).\n" +
      "STEP 2 — PLAN (think like a senior engineer / agent): After the user answers, give " +
      "a clear, well-ORGANIZED plan — break the task into logical phases/sections and say " +
      "what each contains (for a website: the sections & layout, the design/style " +
      "direction, the key features, and the tech). Professional and concrete but skimmable " +
      "(short numbered points). Write the plan as plain numbered PROSE — NEVER wrap the plan " +
      "itself in a code fence (no ``` blocks) and do NOT write any actual code/content yet; " +
      "invite the user to confirm or adjust. If nothing needed clarifying, skip step 1 and go " +
      "straight to the plan.\n" +
      "STEP 3 — EXECUTE: ONLY once the user approves (e.g. said ابدأ/go/نفّذ) do you " +
      "EXECUTE the FULL task to a high standard — for a website/app, deliver the COMPLETE, " +
      "large, polished single-file build per the build rule (many sections, do not cut it " +
      "short). Always reply in the user's language.",
  } : null;

  // If the latest user message asks for a file, steer THIS turn's content so the
  // app can build that file from the reply. Firas must NOT claim it can't make
  // files and must NOT mention buttons — the app generates the file itself.
  const lastUser = [...conversation].reverse().find((m) => m.role === "user");
  const fileFmt = lastUser ? detectFileRequest(lastUser.content) : null;
  const fileTurnSystem = fileFmt ? { role: "system", content: fileGuidance(fileFmt) } : null;

  const history = conversation.map((m) => {
    // Attached file text (PDF/code/text) is prepended to the user content so the
    // model can read it; it lives only on the live in-memory message (not persisted).
    let content = m.content;
    if (m.role === "user" && m.fileText) content = m.fileText + (content ? "\n\n" + content : "");
    const turn = { role: m.role, content };
    // Carry images on the user turn so the backend routes to the vision model.
    if (m.role === "user" && Array.isArray(m.images) && m.images.length) {
      turn.images = m.images; // RAW base64 (no data-URL prefix)
    }
    return turn;
  });
  const head = [system];
  if (planSystem) head.push(planSystem);
  // In Plan mode, do NOT inject file guidance — Firas plans first, then builds
  // the file only after the user approves.
  if (fileTurnSystem && state.mode !== "plan") head.push(fileTurnSystem);
  return [...head, ...history];
}

/** Per-turn system guidance tailored to the requested file format. */
function fileGuidance(fmt) {
  const themes =
    "Pick the ONE theme that fits the topic, OR match the user's described look: " +
    "'blue'/'corporate'->navy, 'dark'/'داكن'/'black'/'dark+gold'/'ذهبي'->dark, 'dark blue'/'midnight'->midnight, " +
    "'elegant'/'formal'/'maroon'->burgundy, 'green'/'nature'->emerald, 'purple'/'creative'->royal, " +
    "'gold'/'warm'/'marketing'->amber, 'technical'/'grey'->slate, 'simple'/'clean'/'b&w'->minimal, otherwise->teal. " +
    "Theme keys: teal, navy, burgundy, emerald, royal, amber, slate, minimal, dark, midnight. " +
    "(dark & midnight are DARK PAGES with light text + a metallic accent — use them whenever the user asks for a dark file.) ";
  const metaBlock =
    "Your VERY FIRST characters MUST be this metadata block, then a blank line, then the content. " +
    "It MUST be exactly this fenced form with valid JSON (no comments, no trailing commas):\n" +
    "```firas-file\n" +
    '{"filename": "SHORT MEANINGFUL NAME in the user’s language, NO file extension", ' +
    '"title": "a SHORT clean human title (max ~8 words); if it needs a formula, write it ONCE as proper LaTeX inside $ … $ so it renders as pretty math — never paste raw code/backslashes, never repeat the formula", ' +
    '"subtitle": "one short line or empty", "theme": "<one theme key>", "accent": "", "template": ""}\n' +
    "```\n" +
    "YOU choose the filename — specific and professional, derived from the request " +
    "(e.g. “20 معادلة تكامل”, not “document”). " + themes +
    "ACCENT: when the user asked for a SPECIFIC color/style (e.g. 'وردي', 'أزرق سماوي', 'ذهبي فخم', 'بألوان جامعتي #1E90FF'), " +
    "set \"accent\" to the best matching 6-digit hex (NO #) and the whole design (cover, headings, tables) adapts to it; otherwise leave \"accent\" empty. " +
    "TEMPLATE (document LAYOUT identity): set \"template\" to exactly one of: 'ministry' for an exam/امتحان/وزاري paper (official double-ruled title, hard-bordered tables, انتهت الأسئلة mark); " +
    "'academic' for a بحث/thesis/university report (numbered 1./1.1 headings, formal light cover); 'corporate' for a business/تقرير عمل report (KPI callout cards, executive lead); " +
    "'magazine' for an article/مقال/editorial piece (drop cap, pull-quotes). Leave \"\" for everything else. ";
  const base =
    "You are creating a downloadable file; the app builds the REAL file from your reply. " +
    "THINK HARD and plan the structure first — it must look like a polished, professional file, NOT a draft. " +
    "NO greeting, NO 'Of course/بالطبع', NO preamble, NO commentary before or after, and NO meta-description " +
    "of 'what the file contains' — just output the metadata block then the document's real content as Markdown. " +
    "MATH & EQUATIONS: write each equation as a LaTeX expression inside $$ … $$ (display) or $ … $ (inline) " +
    "DIRECTLY in the Markdown — they are rendered automatically into the file. " +
    "NEVER write a LaTeX document (no \\documentclass, \\usepackage, \\begin{document}), NEVER put equations or " +
    "code inside a code block, and NEVER tell the user to copy, paste, open an editor, use Overleaf, or 'compile' " +
    "anything — every equation must appear ALREADY RENDERED inside the file. " +
    "NEVER output raw file-format/binary code (no PDF operators BT/ET/Tj/stream/endobj/xref, no RTF, no <?xml>, no base64). " +
    metaBlock;
  if (fmt === "xlsx" || fmt === "csv") {
    return base +
      "\nSTEP 2 — CONTENT: produce clean, organized data as one or more GitHub-style Markdown tables" +
      "(| col | col | with a header row and a |---| separator). Put a '## Sheet Name' heading right " +
      "before each table (it becomes that sheet's name). Use clear column headers; keep numbers as " +
      "plain numbers (no thousands separators or units inside numeric cells); split unrelated data " +
      "into separate tables/sheets. Be accurate and complete.";
  }
  if (fmt === "pptx") {
    return base +
      "\nSTEP 2 — CONTENT: structure as slides. Use a single '# Deck Title', then each slide as a " +
      "'## Slide Title' followed by 3-6 short, punchy bullets (- point) — one idea per bullet, no " +
      "paragraphs. Use a Markdown table on a slide to compare data. Give it a logical flow " +
      "(intro -> key points -> conclusion) and keep it visual and presentation-ready.";
  }
  // pdf / docx
  return base +
    "\nCONTENT: produce a COMPLETE, professionally structured document. Open with a strong '# Title' " +
    "(same as the metadata title), then logical '##'/'###' sections, well-written paragraphs, bullet/numbered " +
    "lists, Markdown tables for tabular data, and blockquotes (>) for key takeaways. Render every equation as " +
    "a $$ … $$ display block (e.g. $$\\int_0^1 x^2\\,dx = \\tfrac{1}{3}$$) — if asked for N equations, output " +
    "exactly N rendered equations, each with a short label/explanation. Be thorough, accurate and self-contained " +
    "— a finished report. If the user described a specific look, layout, sections or order, follow it precisely.";
}

/* ============================================================================
   MULTI-AGENT FILE PIPELINE — file requests run a 3-agent chain for a much more
   professional result: (1) Planner decides identity (name/title/theme) + outline,
   (2) Author writes the full correct content, (3) Finisher assembles + polishes.
   Each stage is its own engine call; any failure falls back gracefully.
   ========================================================================== */

const AGENT_THEMES =
  " Themes: teal, navy, burgundy, emerald, royal, amber, slate, minimal, dark, midnight. " +
  "Match the user's described look (dark/داكن/black/dark+gold/ذهبي->dark, dark blue/midnight->midnight, " +
  "blue/corporate->navy, elegant/formal/maroon->burgundy, green->emerald, purple/creative->royal, " +
  "gold/warm->amber, technical/grey->slate, simple/b&w->minimal, otherwise->teal). dark & midnight are DARK pages.";

function agentBrand(lang) {
  return " You are Firas AI. Write the ENTIRE document — title, headings, every word — in " +
    (lang === "ar" ? "ARABIC" : "ENGLISH") + ", matching the language the user wrote their request in. " +
    "Do NOT switch or mix languages (if the request is in English, the whole file is in English)." +
    " Never reveal or mention any underlying model, provider or company." +
    " You are producing a real DOCUMENT, not a web page, app, or program: NEVER output HTML, CSS, <!DOCTYPE>, " +
    "<style>, <script>, JavaScript, or any website/UI/code. NEVER write a program or SCRIPT of ANY language " +
    "(no Python, python-docx, matplotlib, pip install, 'run python', .py files, Bash, 'install libraries') and " +
    "NEVER give steps/instructions/a tutorial on HOW to create the file. You are NOT writing code — you write " +
    "the DOCUMENT ITSELF (the actual title, sections, text, equations, tables) as Markdown, and the app converts " +
    "it directly into the real Word/Excel/PDF/PowerPoint file. NEVER tell the user to open a browser, install " +
    "anything, run code, click 'print', or 'save as PDF'. Output ONLY the document's own content as Markdown.";
}
function plannerSys(fmt, lang) {
  return "You are a senior document architect and designer. The user wants a " + fmt.toUpperCase() + " file. " +
    "THINK like a professional first: who is the reader, what is the document's purpose, and what structure + visual " +
    "hierarchy would make it look polished, credible and authoritative. Then decide the file's identity and a COMPLETE, " +
    "well-ordered structure — do NOT write the full content yet. Output FIRST this exact block (valid JSON):\n" +
    "```firas-file\n{\"filename\":\"short meaningful name in the user's language, no extension\",\"title\":\"a SHORT " +
    "clean title (max ~8 words); a formula goes ONCE as $ … $ LaTeX, never raw code/backslashes, never repeated\"," +
    "\"subtitle\":\"one concise line or empty\",\"theme\":\"<one theme key>\"}\n```\nthen a blank line, " +
    "then a concise OUTLINE (bullet list) of the sections/items in order — a professional flow (clear opening/intro, " +
    "logically grouped main sections with descriptive headings, supporting tables/lists where useful, and a closing/" +
    "summary). If the user asked for N items (e.g. N equations), plan exactly N. Pick a theme whose tone fits the topic." +
    AGENT_THEMES + " No preamble, no commentary." + agentBrand(lang);
}
function authorSys(fmt, lang) {
  const mathRule = " Render ALL mathematics with real LaTeX inside $ … $ (inline) or $$ … $$ (display) so it typesets " +
    "beautifully (like KaTeX). ZERO ERRORS: every LaTeX expression MUST be VALID, BALANCED and render-perfect (NEVER a " +
    "red error) — balance every { } and \\left…\\right, never use an undefined/custom macro, keep \\displaystyle OUT of " +
    "inline $…$, escape % and & properly, and prefer a simpler valid form over a fancy one that might break. " +
    "FILL-IN-THE-BLANK: write a blank as $\\underline{\\hspace{1.4cm}}$ — NEVER \\color / \\textcolor and NEVER bare " +
    "underscores (_ _ _) inside math or \\text{} (they break rendering). Use proper " +
    "notation: \\frac, \\sqrt, ^{}, _{}, \\int, \\sum, \\prod, \\lim, Greek letters, " +
    "vectors/matrices via \\begin{matrix}…\\end{matrix} or \\begin{bmatrix}…, multi-line derivations via " +
    "\\begin{aligned}…\\end{aligned}, and piecewise via \\begin{cases}…\\end{cases}. Present each result cleanly and " +
    "professionally, define symbols, and show key steps. LAYOUT — keep SHORT math (a number with units, a single " +
    "symbol, a short formula, or a variable) INLINE with $ … $ WITHIN the sentence; do NOT break short expressions onto " +
    "their own line, and use DISPLAY $$ … $$ ONLY for a standalone, important, multi-part equation. Never leave a lone " +
    "period or bare punctuation on its own line after an equation. NEVER put math in a code block, NEVER use \\documentclass or " +
    "\\begin{document}, and NEVER tell the user to compile or use Overleaf.";
  const tikzDocRule = (fmt === "pdf")
    ? " FIGURES / GRAPHS — YOU MUST INCLUDE THE ACTUAL FIGURE (never just describe 'the figure above'): " +
      "For ANY function/curve GRAPH you MUST use a fenced ```plot block — NEVER tikz for graphs (tikz graphs break in the PDF; " +
      "plot renders as a real graph in the document). CARTESIAN: `y = <expression>` lines (EXPLICIT operators + standard " +
      "functions: x^2, 2*x, sin(x), exp(-x^2), sqrt(x), arctan(x), 1/(1+x^2); constant pi) + optional `domain: a..b`. " +
      "POLAR (rose/cardioid/spiral): `r = <expr in theta>` (e.g. `r = 5*sin(6*theta)`) + optional `theta: 0..2*pi`. " +
      "PARAMETRIC: BOTH `x = <expr in t>` and `y = <expr in t>` + optional `t: 0..2*pi`. " +
      "3D SURFACE: `z = <expr in x,y>` (e.g. `z = sin(x)*cos(y)`) + optional `x: -3..3` / `y: -3..3`. " +
      "GEOMETRY FIGURES (triangle, circle, vectors, points, angles, polygons, number lines): ALSO use a fenced ```plot block with shape commands — NEVER tikz for these. " +
      "One shape per line, coords `(x,y)`, options `r=`, `color=#hex`, `dashed`, `fill`, \"label\". Commands: " +
      "`point (x,y) \"A\"` · `segment (x1,y1) (x2,y2)` · `line …` · `vector (x1,y1) (x2,y2) \"v\"` · `circle (cx,cy) r=R` · `ellipse (cx,cy) rx=A ry=B` · " +
      "`arc (cx,cy) r=R 0..120` · `angle (x1,y1) (vx,vy) (x2,y2) \"θ\"` · `triangle (x1,y1) (x2,y2) (x3,y3)` · `rectangle (x1,y1) (x2,y2)` · `polygon (…) (…) (…)`. " +
      "Example:\n```plot\ncircle (0,0) r=3 fill\ntriangle (-3,0) (3,0) (0,3) color=#237a68\npoint (0,3) \"C\"\nangle (3,0) (0,0) (0,3) \"θ\"\n```\nThis renders as a real, professional figure in the PDF (true round circles, clean grid). " +
      "ONLY for an electric CIRCUIT or a complex PHYSICS schematic (wires, resistors, fields) that shape commands can't express, output a fenced ```tikz block with a COMPLETE \\begin{tikzpicture} … \\end{tikzpicture}. " +
      "CRITICAL — a LIGHTWEIGHT in-browser TeX engine renders it, so keep it SIMPLE and MINIMAL or it FAILS and shows as raw " +
      "code: use ONLY basic \\draw / \\node / \\foreach / \\coordinate with plain options (thick, ->, red, dashed, circle, " +
      "rectangle); NO \\usepackage, NO pgfplots, NO tikz libraries (arrows.meta, positioning, calc…), NO \\text{} (use " +
      "\\mathrm{} instead), NO \\begin{scope}; place EVERY point and node with EXPLICIT (x,y) coordinates — NOT relative " +
      "positioning (right=1cm of X) or node anchors (X.east); few elements, small coordinates. NEVER draw an EMPTY frame/box " +
      "as a figure placeholder — every figure MUST contain its actual elements (the wires, currents, arrows, field symbols, " +
      "labels…); if you cannot draw the real elements, OMIT the figure and describe it in one sentence instead. " +
      "EXAMPLE of a CORRECT complete figure (two parallel current-carrying wires):\n```tikz\n\\begin{tikzpicture}[scale=1]\n" +
      "\\draw[thick] (0,2) -- (6,2) node[right] {wire 1};\n\\draw[thick] (0,0) -- (6,0) node[right] {wire 2};\n" +
      "\\draw[->,red,thick] (2.6,2) -- (3.8,2) node[above] {$I_1$};\n\\draw[->,red,thick] (2.6,0) -- (3.8,0) node[below] {$I_2$};\n" +
      "\\draw[<->,blue] (1,0) -- (1,2) node[midway,left] {$d$};\n\\end{tikzpicture}\n```\n— note it has ALL the elements " +
      "(wires, current arrows, separation), not an empty frame. For an electric CIRCUIT you MAY " +
      "use circuitikz components between EXPLICIT coordinates — \\draw (x1,y1) to[R=$R$] (x2,y2), and to[L=$L$] / to[C=$C$] / " +
      "to[battery=$V$] / to[short], plus node[ground]{} — laid out on a simple rectangle. Put the figure BEFORE any text that refers " +
      "to it. These `plot` / `tikz` blocks are DRAWINGS and are the ONLY code blocks allowed — never output any other code, " +
      "HTML or script."
    : "";
  if (fmt === "xlsx" || fmt === "csv") return "You are an expert data author. Following the plan, output the data as clean " +
    "GitHub-style Markdown tables, each preceded by a '## Table Name' heading; plain numbers in numeric cells. Only the " +
    "content — no metadata block, no preamble, no code." + agentBrand(lang);
  if (fmt === "pptx") return "You are an ELITE keynote presentation designer (think Apple/TED). Following the plan, output a " +
    "COMPLETE deck as Markdown with THIS exact structure:\n" +
    "• ONE '# Deck Title' at the very top.\n" +
    "• Group slides under sections: a '## Section Name' line ALONE (no bullets under it) becomes a full-screen SECTION DIVIDER — use 2-4 of them to chapter the talk.\n" +
    "• Each real slide = '### Slide Title' + 3-5 SHORT, punchy bullets (max ~10 words each — headlines, never paragraphs).\n" +
    "• For any slide that benefits from a visual AND real image URLs were provided in the task, put ONE image on its own line as ![short alt](URL) right under the title — the layout auto-goes two-column. NEVER invent an image URL; only use provided ones.\n" +
    "• When a slide presents NUMBERS/statistics/comparisons, add ONE line: Chart: {\"type\":\"bar|line|doughnut\",\"title\":\"…\",\"labels\":[\"…\"],\"data\":[numbers]} — it becomes a real chart. Use plausible real values; 1-3 chart slides per deck; a slide has a chart OR an image, never both.\n" +
    "• Add presenter script to most slides as a line 'Notes: <what the speaker says — 1-2 sentences of real spoken delivery>' — this becomes the PowerPoint speaker notes, hidden from the audience.\n" +
    "Aim for 8-16 content slides. Make the bullets genuinely insightful and specific, not filler. Only the content, no metadata block, no preamble." + mathRule + agentBrand(lang);
  return "You are an elite document author and editor producing a POLISHED, PROFESSIONAL document. Following the plan, " +
    "write the FULL, accurate, thorough CONTENT as clean Markdown: a strong '# Title', a brief engaging introduction, " +
    "logical ##/### sections with descriptive headings, clear well-written paragraphs (real prose, not terse fragments), " +
    "bulleted/numbered lists where they aid clarity, GitHub-style Markdown tables for any structured data, and blockquotes " +
    "for key takeaways. Keep a confident professional tone with smooth flow between sections, and finish with a concise " +
    "conclusion/summary when appropriate. Be complete and correct: if N items were requested, produce exactly N, each " +
    "properly explained. COUNT COMPLIANCE (hard rule): when the request names a number of items (questions/problems/" +
    "integrals…), deliver EXACTLY that many — give each item its own numbered heading (e.g. '## المسألة 5' / '## Problem 5') " +
    "with EXPLICIT numbers 1..N that never restart, and COUNT your items before finishing; a document with fewer items " +
    "than requested is a FAILED task. SOLUTIONS INLINE (hard rule): when the request asks for solutions, put each item's " +
    "COMPLETE worked step-by-step solution IMMEDIATELY after that item (problem 1 → its solution → problem 2 → its " +
    "solution …, e.g. '**الحل:**' / '**Solution:**'), ending in an exact verified final answer — NEVER defer solutions " +
    "to a separate section at the end." + STEM_HARD_RULE + " ORGANIZATION — make it VERY tidy and easy to scan: a consistent heading hierarchy, related content " +
    "grouped together, uniform spacing (NO orphan lines, NO stray punctuation on its own line), and — for an exam/worksheet — " +
    "clean question numbering with its parts (A/B/C…) and marks, each figure placed right beside the item it belongs to. " +
    "IMAGES: when the task provides REAL IMAGE URLS, embed EACH one at a contextually fitting spot as ![short description](URL) " +
    "on its own line followed by a one-line *italic caption* in the user's language — spread them across sections, never two adjacent, " +
    "and NEVER use any image URL that was not provided." + mathRule + tikzDocRule + " Output ONLY the document body — no metadata block, no preamble, no commentary." + agentBrand(lang);
}
function finisherSys(fmt, lang) {
  return "You are the finishing editor. You are given a metadata block and a draft. Output the FINAL " + fmt.toUpperCase() +
    " file: the metadata block EXACTLY as given (first), a blank line, then the COMPLETE, polished content. Keep ALL " +
    "content — never drop or summarize sections. Fix any problems: remove any preamble/greeting/commentary, convert any " +
    "LaTeX-document or code-block math into proper KaTeX math — keep SHORT expressions (a symbol, a number with units) " +
    "INLINE with $ … $ inside the sentence (do NOT drop them onto their own line), and use DISPLAY $$ … $$ ONLY for a " +
    "standalone important equation; ensure a strong '# Title' matching the " +
    "metadata, with consistent professional formatting and logical order. " +
    "IMPORTANT: if the draft is actually a PROGRAM/SCRIPT/code or a 'how-to' tutorial (e.g. Python, python-docx, " +
    "pip install, HTML) instead of a real document, EXTRACT the actual content from it (the equations, data, text, " +
    "titles) and rewrite it as a proper Markdown document — discard ALL code, commands, install/run steps and instructions. " +
    "EXCEPTION: a ```plot or ```tikz fenced block is a DRAWING/GRAPH that renders as a real figure — KEEP it EXACTLY intact, never convert, describe, or remove it. " +
    "Output nothing but the final file." + agentBrand(lang);
}
function metaBlockString(meta) {
  const m = (meta && typeof meta === "object") ? meta : {};
  const o = { filename: m.filename || "", title: m.title || "", subtitle: m.subtitle || "", theme: m.theme || "teal" };
  if (m.accent && /^#?[0-9a-fA-F]{6}$/.test(String(m.accent))) o.accent = String(m.accent).replace("#", "");
  if (/^(academic|ministry|corporate|magazine)$/.test(String(m.template || "").toLowerCase())) o.template = String(m.template).toLowerCase();
  return "```firas-file\n" + JSON.stringify(o) + "\n```";
}
function fileStageText(stage, lang) {
  const ar = lang === "ar";
  if (stage === "extract") return ar ? "يقرأ الصورة ويستخرج كل المحتوى…" : "Reading the image & extracting everything…";
  if (stage === "plan") return ar ? "يخطّط لهيكل الملف…" : "Planning the file…";
  if (stage === "content") return ar ? "يكتب المحتوى…" : "Writing the content…";
  if (stage === "assemble" || !stage) return ar ? "يجمّع ويُخرج باحتراف…" : "Assembling & polishing…";
  return String(stage); // custom live-progress message (e.g. "Writing integrals… 400/1000")
}

/** One engine call returning the full text (the pipeline's building block). */
async function callAgentText(messages, tierKey, signal) {
  const m = MODELS[tierKey] || MODELS.pro;
  let response;
  if (CONFIG.BACKEND_URL) {
    response = await fetch(CONFIG.BACKEND_URL, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, tier: tierKey, think: false, nomem: true }), credentials: "same-origin", signal });
  } else {
    response = await fetch(TRANSPORT_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: m.transport, messages, stream: true, reasoning_effort: m.reasoning_effort, temperature: m.temperature, max_tokens: m.max_tokens }), signal });
  }
  if (!response.ok || !response.body) throw new Error("HTTP " + response.status);
  const reader = response.body.getReader(); const dec = new TextDecoder(); let buf = "", out = "";
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop();
    for (const line of lines) {
      const tr = line.trim(); if (!tr.startsWith("data:")) continue;
      const d = tr.slice(5).trim(); if (d === "[DONE]") { buf = ""; break; }
      try { const j = JSON.parse(d); const del = j.choices && j.choices[0] && j.choices[0].delta; if (del && del.content) out += del.content; } catch (_) {}
    }
  }
  // The backend, when EVERY engine is saturated, streams a human "engine is busy/offline" NOTICE as
  // a 200 body. For an internal AGENT call that text is poison (it becomes the plan/step) → throw so
  // agentCall's retry+backoff kicks in instead of rendering a broken card or an "engine off" message.
  if (isEngineBusyText(out)) throw new Error("engine-unavailable");
  return out;
}
/* Detect the backend's "all engines busy/offline" fallback notice (any language) so agent calls
   retry instead of treating it as a real answer. */
function isEngineBusyText(s) {
  const t = String(s || "").trim();
  if (!t) return true;   // empty stream = no engine answered
  return t.length < 400 && /(engine|vision engine)\s+is\s+(busy|off|offline|unavailable|idle)|جميع\s*المحركات|المحرك\s*مشغول|غير\s*متاح\s*(حالي|الآن)|حاول\s*(مرة\s*أخرى|لاحق|ثاني)|try\s+again\s+shortly/i.test(t);
}

/** Like callAgentText, but invokes onDelta(fullSoFar) on every token so the caller
    can stream the text live into the UI. Returns the full text. */
async function streamAgentText(messages, tierKey, signal, onDelta) {
  const m = MODELS[tierKey] || MODELS.pro;
  let response;
  if (CONFIG.BACKEND_URL) {
    response = await fetch(CONFIG.BACKEND_URL, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, tier: tierKey, think: false, nomem: true }), credentials: "same-origin", signal });
  } else {
    response = await fetch(TRANSPORT_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: m.transport, messages, stream: true, reasoning_effort: m.reasoning_effort, temperature: m.temperature, max_tokens: m.max_tokens }), signal });
  }
  if (!response.ok || !response.body) throw new Error("HTTP " + response.status);
  const reader = response.body.getReader(); const dec = new TextDecoder(); let buf = "", out = "";
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop();
    for (const line of lines) {
      const tr = line.trim(); if (!tr.startsWith("data:")) continue;
      const d = tr.slice(5).trim(); if (d === "[DONE]") { buf = ""; break; }
      try { const j = JSON.parse(d); const del = j.choices && j.choices[0] && j.choices[0].delta; if (del && del.content) { out += del.content; if (onDelta) onDelta(out); } } catch (_) {}
    }
  }
  if (isEngineBusyText(out)) throw new Error("engine-unavailable");   // all engines busy → retry, don't render the notice
  return out;
}

/** Heuristic: does this code already look like a COMPLETE file (so Continue no-ops)? */
function codeLooksComplete(code, lang) {
  const s = String(code || "").replace(/\s+$/, "");
  if (!s) return false;
  const isHtml = lang === "html" || /<!doctype html|<html[\s>]/i.test(s);
  if (isHtml) return /<\/html>\s*$/i.test(s);
  const opens = (s.match(/\{/g) || []).length, closes = (s.match(/\}/g) || []).length;
  // balanced braces AND ends on a real terminator: a closing bracket/semicolon, OR a full-line
  // comment, OR a block-comment close (a truncated file ends mid-identifier, which none of these are).
  return opens === closes && /(?:[}\);\]>]|\/\/[^\n]*|\*\/)\s*$/.test(s);
}
/** Remove firas-code wrappers / stray meta objects the model sometimes leaks INTO a
    code body (they corrupt the file). */
function cleanCodeBody(s) {
  let t = String(s == null ? "" : s);
  t = t.replace(/```firas-code[ \t]+\{[\s\S]*?\}[ \t]*\r?\n?/g, "");
  t = t.replace(/\{"filename":\s*"[^"]*"\s*,\s*"lang":\s*"[^"]*"\s*,\s*"ext":\s*"[^"]*"\s*,\s*"label":\s*"[^"]*"\}/g, "");
  return t;
}
/** Clean a streamed continuation chunk: drop fences, leaked meta, stray sentinel. */
function sanitizeContinuation(s) {
  let t = stripCodeFences(String(s == null ? "" : s));
  t = cleanCodeBody(t).replace(/```/g, "").replace(/\bALREADY_COMPLETE\b/gi, "");
  return t;
}
/** System prompt for FINISHING a cut-off code file: output ONLY the missing tail. */
function codeContinueSystemPrompt(meta) {
  const label = (meta && meta.label) || "code";
  return [
    "You are FINISHING a single " + label + " file that was cut off mid-output and is INCOMPLETE.",
    "You are given the user's request and the code written SO FAR (the last assistant message). It ends abruptly.",
    "Output ONLY the missing remainder — the characters immediately AFTER the existing code — so that (existing + your output) is ONE complete, valid file.",
    "STRICT RULES:",
    "- Continue from the EXACT last character. Do NOT restart, do NOT repeat or re-output any line that already exists, do NOT summarize.",
    "- Output ONLY raw " + label + " source. No explanations, no Markdown code fences, no new ```firas-code blocks, no JSON metadata.",
    "- Finish the file COMPLETELY: close every open tag/bracket/string. For HTML, finish <style>, </head>, the full <body> markup and scripts, and end with </html>.",
  ].join("\n");
}

/** Concatenate a continuation onto existing code, removing any span the model
    repeated — whether at the seam OR by restarting from an earlier point (which
    otherwise balloons the file with duplicated sections). */
function joinCodeContinuation(existing, cont) {
  if (!existing) return cont || "";
  if (!cont) return existing;
  // 1) Seam overlap: cont's prefix equals existing's suffix.
  const maxOv = Math.min(existing.length, cont.length, 4000);
  for (let n = maxOv; n >= 10; n--) {
    if (existing.slice(existing.length - n) === cont.slice(0, n)) return existing + cont.slice(n);
  }
  // 2) Restart: the model re-emitted starting from an EARLIER point. Locate cont's
  //    opening chunk inside existing, align forward, and keep only what is genuinely
  //    new — but only trust it when the alignment runs to existing's end (a true
  //    restart), so we never eat real code on a coincidental match.
  const head = cont.slice(0, 80);
  if (head.replace(/\s/g, "").length >= 24) {
    const at = existing.lastIndexOf(head.slice(0, 48));
    if (at >= 0) {
      let i = at, j = 0;
      while (i < existing.length && j < cont.length && existing[i] === cont[j]) { i++; j++; }
      if (i >= existing.length - 4) return existing + cont.slice(j);
    }
  }
  return existing + cont;
}

/** The "finish this cut-off file" user instruction (shared by manual + auto continue). */
function codeContinueUserMsg(meta, ar) {
  const lbl = (meta && meta.label) || (ar ? "كود" : "code");
  return ar
    ? `هذا الملف (${lbl}) توقّف قبل أن يكتمل وهو ناقص. أكمله من حيث توقّف بالضبط وأنهِه بالكامل (أغلق كل الوسوم والأقواس؛ ولِلـHTML أكمل <style> و</head> و<body> كاملًا والسكربتات وانتهِ بـ </html>). أخرج فقط بقية الكود الخام، دون إعادة أي سطر موجود ودون أي شرح أو علامات \`\`\`.`
    : `This ${lbl} file stopped before completing and is INCOMPLETE. Continue from exactly where it stops and finish it fully (close every tag/bracket; for HTML complete <style>, </head>, the full <body> and scripts, and end with </html>). Output ONLY the remaining raw code, never re-output an existing line, no commentary or \`\`\` fences.`;
}

/** STATE-AWARE next-step hint: tell the model exactly which PART of the file is
    still missing, so each round advances the build instead of re-doing CSS. */
function codeProgressHint(code, lang) {
  const s = String(code || "");
  const isHtml = lang === "html" || /<!doctype html|<html[\s>]/i.test(s);
  if (!isHtml) return "";
  if (/<\/html>\s*$/i.test(s)) return "";
  const hasStyleClose = /<\/style>/i.test(s);
  const hasBodyOpen = /<body[\s>]/i.test(s);
  const bodyInner = hasBodyOpen ? (s.split(/<body[^>]*>/i)[1] || "") : "";
  const hasBodyClose = /<\/body>/i.test(s);
  if (!hasStyleClose) return "Wrap up the CSS now (do NOT add more selectors), close </style></head>, then write the COMPLETE <body> with every section, then <script>, then </html>.";
  if (!hasBodyOpen || bodyInner.replace(/\s/g, "").length < 60) return "The CSS is finished. Now write the FULL <body> markup for ALL sections (header, hero, the main content sections, footer), then any <script>, then end with </html>.";
  if (!hasBodyClose) return "Continue the <body> with the remaining sections, then add the scripts, then close </body> and end with </html>.";
  return "Add any remaining <script> and end the document with </html>.";
}

/** AUTO-COMPLETE: keep continuing a cut-off file until it's whole — so ONE request
    yields a large COMPLETE file (10k+ lines) with no manual clicking and no errors.
    Genius bits: (a) each round gets a STATE-AWARE hint of what's still missing so the
    model advances instead of re-doing CSS; (b) for huge files the context is BOUNDED
    to head+tail (not the whole file) so it scales without bloat/restarts; (c) a
    no-progress STREAK guard + caps prevent runaway. Calls onChunk(mergedCode, round)
    to stream the growth live. `convo` = conversation up to (not incl.) this reply. */
async function autoCompleteCode(code, codeReq, convo, lang, signal, onChunk) {
  const MAX_ROUNDS = 16, MAX_LEN = 900000, CTX_BUDGET = 140000;
  const ar = lang === "ar";
  let dry = 0;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (signal.aborted || code.length > MAX_LEN || codeLooksComplete(code, codeReq.lang)) break;
    // Bound the context for huge files: send the head (structure) + the tail (where
    // to continue), not the whole file — this is what lets it scale past 10k lines.
    let ctx = code;
    if (code.length > CTX_BUDGET) {
      ctx = code.slice(0, 2000) + "\n\n/* …earlier code already written (omitted)… */\n\n" + code.slice(code.length - (CTX_BUDGET - 2000));
    }
    const prior = convo.map((m) => {
      if (m.role === "assistant") { const cm = parseCodeMeta(m.content); if (cm) return { role: "assistant", content: cleanCodeBody(cm.code).slice(-4000) }; }
      return { role: m.role, content: m.content };
    }).filter((m) => m.content && (m.role === "user" || m.role === "assistant"));
    const hint = codeProgressHint(code, codeReq.lang);
    const messages = [
      { role: "system", content: codeContinueSystemPrompt(codeReq) },
      ...prior,
      { role: "assistant", content: ctx },
      { role: "user", content: codeContinueUserMsg(codeReq, ar) + (hint ? ("\n\n" + (ar ? "الخطوة التالية المطلوبة: " : "Required next step: ") + hint) : "") },
    ];
    const before = code;
    let out = "";
    try {
      out = await streamAgentText(messages, "ultra", signal, (full) => {
        if (onChunk) onChunk(joinCodeContinuation(before, sanitizeContinuation(full)), round);
      });
    } catch (e) { break; } // network/abort → stop auto-completing, keep what we have
    const merged = joinCodeContinuation(before, sanitizeContinuation(out));
    if (merged.length <= before.length + 8) { if (++dry >= 2) break; continue; } // no progress (allow one retry)
    dry = 0;
    code = merged;
    if (onChunk) onChunk(code, round);
  }
  return code;
}

/** DEVELOP pass: once an HTML site is COMPLETE, weave in an advanced, professional
    vanilla-JS layer (nav, modals, cart, sliders, tabs, form validation, scroll
    animations, counters, theme toggle…) so the site is genuinely interactive — not
    static. Bounded + additive (inserts ONE <script> before </body>), so the result
    stays ONE complete file. No-op on non-HTML, failure, or an empty script. */
async function enhanceCodeInteractivity(code, codeReq, lang, signal, onChunk) {
  if (!codeReq || codeReq.lang !== "html" || signal.aborted) return code;
  // If the page ALREADY has real JS, don't add a second layer (avoids double-bound
  // handlers / conflicts). Only enhance sites that are static or barely scripted.
  const existingJs = (code.match(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi) || []).join("");
  if (existingJs.replace(/<\/?script[^>]*>/gi, "").replace(/\s/g, "").length > 600) return code;
  const ar = lang === "ar";
  // Bounded context — the model needs to SEE the markup (classes/ids) it wires up.
  let ctx = code;
  if (code.length > 140000) ctx = code.slice(0, 3000) + "\n/* …styles omitted… */\n" + code.slice(code.length - 130000);
  const messages = [
    { role: "system", content: [
      "You are a senior front-end engineer. You are given a COMPLETE single-file HTML page.",
      "Write ONE complete, professional, BUG-FREE vanilla-JavaScript layer that makes the page genuinely interactive and advanced.",
      "Wire up only what actually exists in the markup: nav/menu toggles, buttons, any cart/modals/dialogs, sliders/carousels/tabs/accordions, forms with validation, scroll-reveal animations, animated counters, smooth scrolling, and a theme/dark-mode toggle if appropriate.",
      "Use the EXISTING class names and ids. Null-check every selector so nothing throws if an element is absent. No external libraries.",
      "Output ONLY one block: <script> …raw JS… </script>. No explanations, no Markdown fences, no other HTML.",
    ].join("\n") },
    { role: "user", content: ctx },
    { role: "user", content: ar
      ? "أضف طبقة جافاسكربت احترافية كاملة وخالية من الأخطاء تجعل كل عناصر الصفحة تعمل وتفاعلية ومتطوّرة. أخرج فقط كتلة <script>...</script> واحدة."
      : "Add a complete, error-free professional JavaScript layer that makes every element work and feel advanced. Output ONLY one <script>...</script> block." },
  ];
  if (onChunk) onChunk(code); // show current code + the "enhancing" status
  let out = "";
  try { out = await streamAgentText(messages, "ultra", signal, null); } catch (e) { return code; }
  let js = sanitizeContinuation(out).trim();
  if (!js) return code;
  const m = js.match(/<script[\s\S]*?<\/script>/i);
  const block = m ? m[0] : ("<script>\n" + js.replace(/<\/?script[^>]*>/gi, "").trim() + "\n</script>");
  if (!block.replace(/<\/?script[^>]*>/gi, "").replace(/\s/g, "")) return code; // empty → skip
  let enhanced;
  if (/<\/body>/i.test(code)) enhanced = code.replace(/<\/body>/i, block + "\n</body>");
  else if (/<\/html>/i.test(code)) enhanced = code.replace(/<\/html>/i, block + "\n</html>");
  else enhanced = code + "\n" + block;
  if (onChunk) onChunk(enhanced);
  return enhanced;
}

/** Resume a code card whose file stopped before completing. Streams the missing
    tail from the coder model and appends it seamlessly into the SAME box, then
    persists. Safe to click repeatedly for very long files. */
async function continueCode(card) {
  const chat = activeChat();
  if (!chat) return;
  if (activeStreams.has(chat.id)) {
    showToast(state.lang === "ar" ? "انتظر حتى ينتهي الرد الحالي" : "Wait for the current reply to finish");
    return;
  }
  const turn = card.closest(".msg-ai");
  const idx = turn ? parseInt(turn.dataset.index, 10) : -1;
  const aiMsg = (idx >= 0 && chat.messages[idx]) ? chat.messages[idx] : null;
  const meta = aiMsg ? parseCodeMeta(aiMsg.content) : null;
  if (!meta) return;
  const ar = (aiMsg.lang || state.lang) === "ar";
  // Clean any leaked firas-code meta out of the existing body first.
  let code = cleanCodeBody(meta.code != null ? meta.code : "");

  const writeBack = (c) => {
    aiMsg.content = "```firas-code " + JSON.stringify({ filename: meta.filename, lang: meta.lang, ext: meta.ext, label: meta.label }) + "\n" + c + "\n```";
    persistChat(chat);
  };
  const rerender = () => {
    const fresh = parseCodeMeta(aiMsg.content);
    if (fresh && card.isConnected) card.replaceWith(buildCodeCard(fresh, aiMsg.lang || state.lang));
    else card.classList.remove("is-streaming");
  };

  // Genuinely complete already (ends with </html> etc.) → just persist the cleanup.
  if (codeLooksComplete(code, meta.lang)) {
    writeBack(code); rerender();
    showToast(ar ? "الكود مكتمل بالفعل ✅" : "Already complete ✅");
    return;
  }

  // Context: prior turns (code unwrapped + cleaned), the code so far as the
  // assistant's last message, then an explicit "finish it" instruction.
  const prior = chat.messages.slice(0, idx).map((m) => {
    if (m.role === "assistant") { const cm = parseCodeMeta(m.content); if (cm) return { role: "assistant", content: cleanCodeBody(cm.code) }; }
    return { role: m.role, content: m.content };
  }).filter((m) => m.content && (m.role === "user" || m.role === "assistant"));
  const messages = [
    { role: "system", content: codeContinueSystemPrompt(meta) },
    ...prior,
    { role: "assistant", content: code },
    { role: "user", content: codeContinueUserMsg(meta, ar) },
  ];

  // Flip the finished card into a "continuing…" streaming state.
  const controller = new AbortController();
  activeStreams.set(chat.id, { controller });
  syncStreamingUi();
  card.classList.add("is-streaming");
  const codeEl = card.querySelector(".code-card__code");
  const body = card.querySelector(".code-card__body");
  const actions = card.querySelector(".code-card__actions");
  if (actions) {
    actions.innerHTML = "";
    const w = document.createElement("span");
    w.className = "code-card__writing";
    w.textContent = ar ? "يُكمل الكود…" : "Continuing…";
    actions.appendChild(w);
  }

  let tail = "";
  const onDelta = (full) => {
    tail = full;
    const merged = joinCodeContinuation(code, sanitizeContinuation(tail));
    if (codeEl) codeEl.textContent = merged;
    const cnt = card.querySelector(".code-card__count");
    if (cnt) cnt.textContent = codeLineCountText(merged, meta.lang);
    if (body) body.scrollTop = body.scrollHeight;
  };

  try {
    const out = await streamAgentText(messages, "ultra", controller.signal, onDelta);
    const cont = sanitizeContinuation(out);
    if (cont.trim()) {
      code = joinCodeContinuation(code, cont); writeBack(code);
      showToast(ar ? "تم إكمال الكود ✅" : "Code continued ✅");
    } else {
      writeBack(code); // at least save the corruption cleanup
      showToast(ar ? "تعذّر الإكمال — اضغط «كمّل» مرة أخرى" : "Couldn't continue — click Continue again");
    }
  } catch (err) {
    const cont = sanitizeContinuation(tail);
    if (cont.trim()) { code = joinCodeContinuation(code, cont); writeBack(code); }
    if (!controller.signal.aborted) showToast(ar ? "تعذّر إكمال الكود، حاول مجددًا" : "Couldn't continue — try again");
  } finally {
    activeStreams.delete(chat.id);
    syncStreamingUi();
    rerender();
  }
}

/** Planner + Author + Finisher → the final document string (metadata block + content). */
/* Stage 0 for image-based docs: route the attached image(s) to the VISION model and
   transcribe EVERYTHING on them — every problem/question/line, to the very last one — so the
   document author works from the complete source, not just the prompt text. Returns "" on
   failure (the pipeline then proceeds with the text request alone). */
async function extractImageSource(images, userText, lang, signal, onStage) {
  if (!Array.isArray(images) || !images.length) return "";
  if (onStage) onStage("extract");
  const ar = lang === "ar";
  const sys = ar
    ? "أنت محرّك رؤية دقيق. مهمتك: انسخ **كل** ما في الصورة/الصور المرفقة نسخًا كاملًا وحرفيًّا — كل عنوان، وكل سؤال/مسألة بكامل نصّه ورقمه وفروعه ودرجاته، وكل معادلة ورمز رياضي (اكتب الرياضيات بـ LaTeX)، وكل جدول وسطر ونقطة — بالترتيب نفسه ومن الأولى إلى الأخيرة. لا تلخّص، لا تختصر، لا تشرح، لا تحلّ، ولا تتوقّف مبكّرًا أبدًا. إن وُجدت N مسألة فأخرِجها كلّها N. أعطِ النص المستخرَج فقط."
    : "You are a precise vision OCR engine. Transcribe EVERYTHING in the attached image(s) COMPLETELY and verbatim — every heading, every question/problem with its full text, number, sub-parts and marks, every equation and math symbol (write math in LaTeX), every table, line and bullet — in order, from the first to the very last. Do NOT summarize, abbreviate, explain, solve, or stop early. If there are N problems, output all N. Output ONLY the transcribed content.";
  const usr = (ar ? "استخرج كل محتوى الصورة/الصور بالكامل (هذا مصدر سيُبنى عليه طلب المستخدم: " : "Transcribe ALL content of the image(s) in full (this is the source for the user's request: ")
    + String(userText || "").slice(0, 300) + ").";
  try {
    const out = await callAgentText([{ role: "system", content: sys }, { role: "user", content: usr, images }], "pro", signal);
    return (out && out.trim()) ? out.trim() : "";
  } catch (_) { return ""; }
}

/* For a "make a NEW / HARDER version" request: extract ONLY a STRUCTURAL BLUEPRINT (topics, types,
   sub-parts, marks, figures, constraints) — NOT the verbatim questions — so the generator MUST author
   brand-new questions and literally cannot copy the originals (it never sees them). */
async function extractImageStructure(images, userText, lang, signal, onStage) {
  if (!Array.isArray(images) || !images.length) return "";
  if (onStage) onStage("extract");
  const ar = lang === "ar";
  const sys = ar
    ? "أنت محلّل امتحانات. **ممنوع منعًا باتًّا نسخ نص أي سؤال أو أرقامه أو قيمه.** أخرِج مخطّطًا هيكليًّا فقط: لكل سؤال وجزء اذكر رقمه/رمزه، ونوعه (صح/خطأ، اختيار من متعدد، حساب قصير، مسألة طويلة، إثبات، ملء فراغ)، والموضوع/المفهوم الذي يختبره (مثل: «القدرة في التوالي والتوازي»، «التأريخ بالكربون-14»، «القوة بين سلكين متوازيين»)، والدرجات، وهل يحتوي شكلًا وماذا يُظهر، وأي قيد (مثل «أجب عن خمسة فقط»). أخرِج قائمة مرتّبة موجزة من الأول إلى الأخير، بلا أي نص سؤال."
    : "You are an exam analyzer. NEVER copy any question's text, numbers or values. Output a STRUCTURAL BLUEPRINT ONLY: for each question and sub-part give its number/label, TYPE (true-false / multiple-choice / short calculation / long problem / proof / fill-in-the-blank), the TOPIC/concept it tests (e.g. 'power in series vs parallel', 'carbon-14 dating', 'force between two parallel wires'), the marks, whether it has a figure and what it shows, and any constraint (e.g. 'answer five only'). Output a compact ordered list, first to last, with NO question text.";
  const usr = (ar ? "حلّل الصورة/الصور وأخرِج المخطّط الهيكلي فقط (بدون نص الأسئلة): " : "Analyze the image(s); output the structural blueprint only (no question text): ") + String(userText || "").slice(0, 200) + ".";
  try {
    const out = await callAgentText([{ role: "system", content: sys }, { role: "user", content: usr, images }], "pro", signal);
    return (out && out.trim()) ? out.trim() : "";
  } catch (_) { return ""; }
}

/* Does an image turn want NEW/derived content generated (make similar/harder questions, solve,
   rewrite, summarize, build an exam…) vs just reading the image (extract/transcribe/what is this)?
   Generation must go 2-stage: vision extracts, then the STRONG text model writes the full output —
   the small vision model truncates long generation. */
function isImageTransformRequest(s) {
  const t = String(s || "");
  const genAr = /(اعمل|اصنع|سوّ?ي|ولّ?د|ولد|انشئ|أنشئ|اكتب\s*لي|اكتبلي|صمّ?م|حلّ?|حل\s|جاوب|أجب|اشرح|لخّ?ص|لخص|أعد\s*صياغة|اعد\s*صياغة|مشاب|مماثل|نفس\s*النمط|بنمط|أصعب|اصعب|أسهل|اسهل|نسخة|أسئلة|اسئلة|مسائل|مسأل|امتحان|اختبار|تمارين|تمرين|سؤال|مثل\s*هذ|زيد|أكثر|اكثر|طوّ?ر|ضاعف)/;
  const genEn = /\b(make|create|generate|produce|build|design|write|compose|solve|answer|rewrite|paraphrase|summari[sz]e|explain|similar|harder|tougher|easier|more|another|additional|new|version|worksheet|exam|quiz|test|problems?|questions?|exercises?)\b/i;
  return genAr.test(t) || genEn.test(t);
}

/* The document author over-uses DISPLAY math ($$…$$) even for tiny expressions (a symbol, a number
   with units), which drops each onto its own line with big gaps and shreds the surrounding sentence.
   Convert those SHORT, simple display blocks back to INLINE $…$; keep real standalone / multi-line /
   aligned equations as display. */
/* Fill-in-the-blank LaTeX the model tends to emit — \color{red}{\text{____}} etc. — is INVALID KaTeX
   (bare _ inside \text throws) and renders as raw red code. Convert every such pattern to a clean
   \underline{\hspace{…}} blank; also strip stray \color/\textcolor wrappers (KaTeX-unsupported usage). */
function fixMathBlanks(md) {
  let s = String(md);
  s = s.replace(/\\(?:text)?color\{[^{}]*\}\s*\{\s*\\text\{\s*_{2,}\s*\}\s*\}/g, "\\underline{\\hspace{1.4cm}}");
  s = s.replace(/\\(?:text)?color\{[^{}]*\}\s*\{?\\text\{\s*_{2,}\s*\}\}?/g, "\\underline{\\hspace{1.4cm}}");
  s = s.replace(/\\text\{\s*_{2,}\s*\}/g, "\\underline{\\hspace{1.4cm}}");
  // any leftover \color{x}{y} / \textcolor{x}{y} → keep only the content y (KaTeX-safe)
  s = s.replace(/\\(?:text)?color\{[^{}]*\}\s*\{([^{}]*)\}/g, "$1");
  return s;
}

/* The model sometimes writes LaTeX commands OUTSIDE math delimiters ("Name: \underline{\hspace{5cm}}",
   "0.85 A\cdotpm²") — they reach the page as raw backslash text. Fix the TEXT segments only (math and
   fenced code are left untouched): wrap bare \underline blanks in $…$, unicode-ize simple commands. */
function sanitizeBareLatex(md) {
  // Protect \ce{...}/\pu{...} chemistry FIRST (odd-index = untouched) so the unicode substitutions
  // below never eat a \cdot inside a hydrate like \ce{CuSO4 \cdot 5H2O} and leave a stray backslash.
  return String(md).split(/(\\(?:ce|pu)\s*\{(?:[^{}]|\{[^{}]*\})*\}|```[\s\S]*?```|\$\$[\s\S]*?\$\$|\$[^$\n]*\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/).map((seg, i) => {
    if (i % 2 === 1) return seg;                       // math / fenced code — untouched
    let s = seg;
    s = s.replace(/\\underline\{\\hspace\{([^{}]*)\}\}/g, (m, l) => "$\\underline{\\hspace{" + l + "}}$");
    s = s.replace(/\\hspace\{([^{}]*)\}/g, " ");
    s = s.replace(/\\cdots(?![a-zA-Z])/g, "⋯");
    s = s.replace(/\\cdotp/g, "·");                    // \cdotp even when glued to a unit ("A\cdotpm²" → "A·m²")
    s = s.replace(/\\cdot(?![a-zA-Z])/g, "·");
    s = s.replace(/\\times(?![a-zA-Z])/g, "×");
    s = s.replace(/\\(?:degree|textdegree)(?![a-zA-Z])/g, "°");
    s = s.replace(/\\pm(?![a-zA-Z])/g, "±");
    return s;
  }).join("");
}

function tightenInlineMath(md) {
  return String(md).replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (m, inner) => {
    const x = inner.trim();
    if (!x) return m;
    if (/\\\\|\\begin|\\end|&|\\int|\\sum|\\prod|\\oint|\\iint|\\lim|\\cases|\\aligned|\\matrix/.test(x)) return m;
    if (x.length > 48) return m;
    return "$" + x + "$";
  });
}

/* ═══ COUNT ENFORCEMENT — "10 questions" must yield 10, never 6 ═══════════════════════════════
   The author model sometimes stops early (or gets truncated), delivering fewer items than the
   user asked for. These helpers detect the requested count, count what was actually produced,
   and CONTINUE the document with the missing items until the count is met. */

/* The item count the user asked for ("10 integrals", "عشرة تكاملات", "ten hard questions") → N, or 0. */
function parseRequestedItemCount(text) {
  let s = String(text || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const NOUN = "(?:integrals?|problems?|questions?|exercises?|equations?|items?|mcqs?|تكاملات?|مسائل|مسأل[ةه]?|أسئلة|اسئلة|سؤال|سوال|تمارين|تمرين|معادلات?|معادلة|انتيكرل|انتقرل)";
  // digits with a few adjectives allowed between: "10 challenging novel questions"
  const dm = new RegExp("(\\d{1,4})\\s*(?:[A-Za-z؀-ۿ'’,-]+\\s+){0,6}?" + NOUN, "i").exec(s);
  if (dm) { const n = parseInt(dm[1], 10); if (n >= 2 && n <= 2000) return n; }
  // number words (longest first so "خمسة عشر" beats "خمسة")
  const WORDS = { "خمسة عشر": 15, "اثنا عشر": 12, "إثنا عشر": 12, "عشرون": 20, "عشرين": 20, "ثلاثون": 30, "ثلاثين": 30, "أربعين": 40, "اربعين": 40, "خمسون": 50, "خمسين": 50, "مائة": 100, "مئة": 100, "ثلاثة": 3, "أربعة": 4, "اربعة": 4, "خمسة": 5, "ستة": 6, "سبعة": 7, "ثمانية": 8, "تسعة": 9, "عشرة": 10, "ثلاث": 3, "أربع": 4, "اربع": 4, "خمس": 5, "سبع": 7, "ثمان": 8, "تسع": 9, "عشر": 10, "ست": 6, twenty: 20, fifteen: 15, twelve: 12, eleven: 11, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifty: 50, forty: 40, thirty: 30, hundred: 100, two: 2 };
  const keys = Object.keys(WORDS).sort((a, b) => b.length - a.length);
  for (const w of keys) {
    const re = new RegExp("(?:^|[\\s،,])" + w.replace(/ /g, "\\s+") + "\\s+(?:[A-Za-z؀-ۿ'’,-]+\\s+){0,3}?" + NOUN, "i");
    if (re.test(s)) return WORDS[w];
  }
  return 0;
}

/* How many items the generated markdown ACTUALLY contains — the highest explicit item label found
   (headings like "## المسألة 7" / "### Problem 7" / "**Q7**"), falling back to numbered-line items,
   then to keyword-heading count. Best-effort: 0 = "can't tell" (caller must not loop on 0). */
function countDocItems(md) {
  let s = String(md || "").replace(/```[\s\S]*?```/g, "").replace(/\$\$[\s\S]*?\$\$/g, "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const KEY = "(?:ال)?(?:مسأل[ةه]|سؤال|تكامل|تمرين|مثال|problem|question|integral|exercise|example|q)";
  let maxN = 0;
  const scan = (re) => { let m; while ((m = re.exec(s))) { const n = parseInt(m[1], 10); if (n >= 1 && n <= 2000 && n > maxN) maxN = n; } };
  scan(new RegExp("^#{1,6}[^\\n]*?" + KEY + "\\D{0,14}(\\d{1,4})", "gim"));           // "## المسألة 7" / "### Problem 7:"
  scan(new RegExp("^\\s{0,3}(?:\\*\\*)?\\s*" + KEY + "\\s*[.#\\-–—]?\\s*(\\d{1,4})", "gim")); // "**Q7.**" at line start
  // Arabic ORDINAL headings ("المسألة العاشرة") — models often number this way in Arabic docs.
  const ORD = { "الأول": 1, "الاول": 1, "الأولى": 1, "الاولى": 1, "الثاني": 2, "الثانية": 2, "الثالث": 3, "الثالثة": 3, "الرابع": 4, "الرابعة": 4, "الخامس": 5, "الخامسة": 5, "السادس": 6, "السادسة": 6, "السابع": 7, "السابعة": 7, "الثامن": 8, "الثامنة": 8, "التاسع": 9, "التاسعة": 9, "العاشر": 10, "العاشرة": 10, "الحادي عشر": 11, "الحادية عشرة": 11, "الثاني عشر": 12, "الثانية عشرة": 12, "الثالث عشر": 13, "الثالثة عشرة": 13, "الرابع عشر": 14, "الرابعة عشرة": 14, "الخامس عشر": 15, "الخامسة عشرة": 15, "السادس عشر": 16, "السادسة عشرة": 16, "السابع عشر": 17, "السابعة عشرة": 17, "الثامن عشر": 18, "الثامنة عشرة": 18, "التاسع عشر": 19, "التاسعة عشرة": 19, "العشرون": 20 };
  let m2;
  const ordRe = /^#{1,6}[^\n]*?(?:المسألة|السؤال|التكامل|التمرين|المثال)\s+(ال[؀-ۿ]+(?:\s+عشرة?)?)/gim;
  while ((m2 = ordRe.exec(s))) { const n = ORD[m2[1].trim()]; if (n && n > maxN) maxN = n; }
  if (maxN) return maxN;
  // fallback: explicit numbered lines "7." / "7)" (max label — markdown lists that restart at 1 undercount,
  // which is safe: enforcement stops when it can't measure progress)
  scan(/^\s{0,3}(?:\*\*)?(\d{1,4})(?:\*\*)?\s*[.)\-:]\s+\S/gim);
  if (maxN) return maxN;
  const heads = s.match(new RegExp("^#{1,6}[^\\n]*" + KEY, "gim"));
  return heads ? heads.length : 0;
}

/* Did the user explicitly ask for SOLUTIONS with their items? */
function requestWantsSolutions(text) {
  return /مع\s*الحلول|بالحلول|مع\s*الحل|وحلول(?:ها)?|with\s+(?:full\s+|complete\s+|worked\s+|step[\s-]*by[\s-]*step\s+)?solutions?|and\s+solutions?|solved\b/i.test(String(text || ""));
}
/* How many worked-solution blocks the doc contains ("## الحل", "**Solution 3:**", "حل المسألة ٤"…). */
function countDocSolutions(md) {
  const s = String(md || "").replace(/```[\s\S]*?```/g, "");
  let n = 0;
  n += (s.match(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:الحل|حل\s*(?:المسألة|السؤال|التمرين|التكامل))/g) || []).length;
  n += (s.match(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?\s*Solution/gi) || []).length;
  return n;
}
/* Splice `extra` into `doc` just BEFORE a trailing conclusion section (if any) — else append.
   (No \b in the regex — \b never matches adjacent to Arabic letters in JS.) */
function spliceBeforeConclusion(doc, extra) {
  const concM = /\n#{1,4}\s*(?:خاتمة|الخاتمة|خلاصة|الخلاصة|conclusion|summary)[^\n]*(?:\n|$)/i.exec(doc);
  let head = doc, tail = "";
  if (concM && concM.index > doc.length * 0.5) { head = doc.slice(0, concM.index); tail = doc.slice(concM.index); }
  return head.replace(/\s*$/, "") + "\n\n" + extra + tail;
}

/* If the doc has fewer items than requested, CONTINUE it (same format/language) until complete.
   `call(messages)` = the pipeline's own model caller. Up to 4 continuation rounds; stops on no progress.
   Then, if the user asked for SOLUTIONS and the doc has (almost) none, appends a full solutions pass. */
async function ensureDocItemCount(doc, requested, reqText, sysContent, call, signal, onStage) {
  if (!requested || requested < 2) return doc;
  const wantsSol = requestWantsSolutions(reqText);
  for (let round = 0; round < 4; round++) {
    if (signal && signal.aborted) break;
    const have = countDocItems(doc);
    if (!have || have >= requested) break;               // 0 = unmeasurable → never loop blindly
    if (onStage) try { onStage("content"); } catch (_) {}
    let cont = "";
    try {
      cont = (await call([
        { role: "system", content: sysContent },
        { role: "user", content: "REQUEST:\n" + String(reqText || "").slice(0, 4000) +
          "\n\nTHE DOCUMENT SO FAR (its ending is shown — match its language, heading style, numbering and difficulty EXACTLY):\n…" + doc.slice(-6000) +
          "\n\nINCOMPLETE: the user asked for " + requested + " items but the document contains ONLY " + have + ". " +
          "CONTINUE the document with the MISSING items — numbers " + (have + 1) + " through " + requested + " — same format, same numbering scheme continued (never restart at 1), same language. " +
          (wantsSol ? "The user asked for SOLUTIONS: include the COMPLETE worked step-by-step solution immediately after EACH new item, ending in an exact verified final answer. " : "") +
          "Output ONLY the new items: no title, no introduction, no conclusion, no repetition of existing items, no commentary." },
      ])) || "";
    } catch (e) { if (signal && signal.aborted) throw e; break; }
    const cleaned = stripFileMetaBlock(String(cont)).replace(/^\s*(?:of course|sure|بالطبع|إليك|حسنًا)[^\n]*\n/i, "").trim();
    if (!cleaned) break;
    const merged = spliceBeforeConclusion(doc, cleaned);
    if (countDocItems(merged) <= have) break;            // no measurable progress → stop
    doc = merged;
  }
  // SOLUTIONS ENFORCEMENT — "with solutions" means every problem gets a worked solution. If the doc
  // has questions but (almost) no solutions (the exact 2-questions-0-solutions failure), one pass
  // writes the complete solutions for ALL items and splices them in before the conclusion.
  if (wantsSol && !(signal && signal.aborted)) {
    const items = countDocItems(doc);
    const haveSol = countDocSolutions(doc);
    if (items >= 2 && haveSol < items) {                 // EVERY problem must have a worked solution
      if (onStage) try { onStage("content"); } catch (_) {}
      let sol = "";
      try {
        sol = (await call([
          { role: "system", content: sysContent },
          { role: "user", content: "REQUEST:\n" + String(reqText || "").slice(0, 3000) +
            "\n\nTHE DOCUMENT (the user explicitly asked for a SOLUTION to EVERY problem; " + haveSol + " of the " + items + " problems have one — the rest are MISSING theirs):\n" + doc.slice(-16000) +
            "\n\nWrite the COMPLETE, fully-worked, step-by-step solutions for the problems that do NOT already have a solution in the document above (skip the ones already solved) — one clearly-labelled solution per problem, numbered to MATCH its problem ('## Solution 2' / '## حل المسألة 2', in the document's language), every step justified, each ending in an exact VERIFIED final answer (substitute back / differentiate the antiderivative to check). Output ONLY these solutions, starting with a '## Solutions' / '## الحلول' heading." },
        ])) || "";
      } catch (_) { sol = ""; }
      const solClean = stripFileMetaBlock(String(sol)).trim();
      if (solClean && countDocSolutions(solClean) >= 1) doc = spliceBeforeConclusion(doc, solClean);
    }
  }
  return doc;
}

async function runFileAgentPipeline(convo, fmt, lang, tierKey, signal, onStage) {
  // Files ALWAYS use the general document model (gpt-oss = "pro"), never the coder
  // (Ultra = qwen3-coder) — a coding model turns "make a PDF" into an HTML website.
  tierKey = "pro";
  const lastUser = [...convo].reverse().find((m) => m.role === "user");
  let userText = lastUser ? lastUser.content : "";
  // If the user attached a FILE (PDF/text), include its content as SOURCE material so the
  // deliverable can be built from it ("summarize this into a Word doc", "make X from this file", etc.).
  if (lastUser && lastUser.fileText) userText += "\n\n=== ATTACHED FILE CONTENT (source material — build the deliverable from this) ===\n" + lastUser.fileText;
  // If the user attached image(s), extract their FULL content first and append it as the
  // source material so e.g. "make a harder version of this exam" sees the whole exam.
  const srcImages = lastUser && Array.isArray(lastUser.images) ? lastUser.images : null;
  if (srcImages && srcImages.length) {
    // "make a NEW / HARDER version" → extract ONLY a structural blueprint (no verbatim questions), so the
    // model MUST author new questions and literally cannot copy the originals. Otherwise → verbatim source.
    const _req = String((lastUser && lastUser.content) || "");
    const _harder = /أصعب|اصعب|أقوى|اقوى|جديد|مشابه|مماثل|نفس\s*النمط|بنمط|نسخة|مختلف|harder|tougher|stronger|\bnew\b|similar|same\s*pattern|variant|different/i.test(_req);
    if (_harder) {
      const spec = await extractImageStructure(srcImages, userText, lang, signal, onStage);
      if (spec) userText += (lang === "ar"
        ? "\n\n[أنت **لا ترى الأسئلة الأصلية** — عندك مخطّطها الهيكلي فقط. اصنع امتحانًا **جديدًا كليًّا وأصعب** يطابق هذا الهيكل والمواضيع والعدد والأجزاء والدرجات، بأسئلةٍ **من تأليفك** (أرقام وسيناريوهات وقيم جديدة، مستوى تنافسي/متقدم قوي جدًا)، صحيحة ومضبوطة وقابلة للحل. ارسم **كل** شكل مذكور بالمخطّط كبلوك ```tikz أو ```plot. اكتب الرياضيات بـLaTeX صحيح ومتوازن بلا أخطاء.]\n\n=== المخطّط الهيكلي للمصدر (للمحاكاة — لا يحتوي نص الأسئلة الأصلية) ===\n"
        : "\n\n[You do NOT see the original questions — only their structural blueprint. Create a COMPLETELY NEW, HARDER exam matching this structure, topics, count, sub-parts and marks, with questions YOU author (new numbers/scenarios/values, strong competition/advanced level), valid and solvable. Draw EVERY figure named in the blueprint as a ```tikz or ```plot block. Write valid, balanced, error-free LaTeX.]\n\n=== STRUCTURAL BLUEPRINT OF THE SOURCE (to mimic — it does NOT contain the original question text) ===\n") + spec;
    } else {
    const extracted = await extractImageSource(srcImages, userText, lang, signal, onStage);
    if (extracted) {
      userText += (lang === "ar"
        ? "\n\n[تعليمات صارمة — نسخة جديدة أصعب (وليست نسخًا): (1) اصنع أسئلة **جديدة تمامًا** — **يُمنع منعًا باتًّا** نسخ أو إعادة صياغة أسئلة المصدر؛ كل سؤال يجب أن يكون **مختلفًا وأصعب بوضوح** من نظيره في المصدر (أرقام/معطيات/سيناريو مختلفة، وخطوات أعمق ومستوى تنافسي/متقدم قوي جدًا) مع بقائه صحيحًا ومضبوطًا وقابلًا للحل. (2) ابقَ في **نفس مادة المصدر ومواضيعه** — لو فيزياء فالناتج فيزياء على نفس المواضيع؛ ممنوع تغيير المادة. (3) طابِق **بنية المصدر تمامًا**: نفس عدد الأسئلة والترقيم والأجزاء (A/B/C) وتعليمات الاختيار والدرجات والعناوين والترتيب. (4) ارسم **كل** شكل/رسم موجود بالمصدر (وأي شكل يحتاجه سؤال جديد) كبلوك ```tikz أو ```plot مرسوم فعليًا بجنب سؤاله — لا تتجاهل أي شكل ولا تكتفِ بوصفه. (5) اكتب الرياضيات بـ LaTeX صحيح وأخرِج كل سؤال وجزء كاملًا.]\n\n=== المحتوى المُستخرَج بالكامل من الصورة/الصور المرفقة (المصدر — للمحاكاة فقط، لا للنسخ) ===\n"
        : "\n\n[Strict instructions — a NEW, HARDER version (NOT a copy): (1) GENERATE BRAND-NEW questions — NEVER copy or lightly reword the source; each must be DIFFERENT and clearly HARDER than its source counterpart (different numbers/data/scenario, deeper steps, strong competition/advanced level) while staying valid and fully solvable. (2) Stay in the SOURCE'S SAME SUBJECT and topics (physics→physics…); never switch subject. (3) Mirror the source STRUCTURE exactly: same number of questions, numbering, sub-parts (A/B/C), selection instructions, marks, headings and order. (4) Draw EVERY figure the source has (and any a new question needs) as an ACTUALLY-RENDERED ```tikz or ```plot block beside its question — never skip one or just describe it. (5) Write valid LaTeX; output every question and part in full.]\n\n=== FULL CONTENT EXTRACTED FROM THE ATTACHED IMAGE(S) (the source — to MIMIC, NOT to copy) ===\n") + extracted;
      userText += (lang === "ar"
        ? "\n\n=== نهاية المصدر ===\n[تذكير حاسم: المصدر أعلاه للمحاكاة فقط. اكتب امتحانًا جديدًا كليًّا وأصعب بنفس البنية والمادة والعدد لكن بلا أي سؤال منسوخ — غيّر جميع الأسئلة لا الأول فقط، وكل سؤال يختلف بأرقامه وسيناريوهاته ويكون أصعب؛ إن طابق أيٌّ منها سؤالَ المصدر فقد فشلت المهمة.]"
        : "\n\n=== END OF SOURCE ===\n[FINAL REMINDER: the source is a REFERENCE ONLY — write a COMPLETELY NEW, HARDER exam with the SAME structure/subject/count but ZERO copied questions; change ALL questions (not just the first), each with different numbers/scenarios/values and clearly harder. If ANY of them matches a source question you have FAILED.]");
    }
    }
  }
  // "سوّيها PDF" / "make it a PDF" / just "PDF" — a request that REFERS TO THE PREVIOUS ANSWER (e.g. a graph
  // the user just got). Without the prior content the author has nothing to build from and HALLUCINATES a
  // random document. Include the previous assistant answer as the source so the file is built from it.
  const reqTxt = String((lastUser && lastUser.content) || "");
  const prevAns = [...convo].reverse().find((m) => m.role === "assistant" && m.content && String(m.content).trim());
  const strippedReq = reqTxt.replace(/pdf|بي\s*دي\s*اف|بدف|word|وورد|ورد|excel|اكسل|csv|pptx?|بوربوينت|powerpoint|ملف|مستند|وثيقة|file|document|deck|slides?|بصيغة|على\s*شكل|as|to|into|في|سوّ?ي|سوي|اعملي?|حوّ?ل|حول|خلّ?ي|خلي|اصنعي?|اعمل|make|create|turn|convert|export|لي|لنا/gi, " ").replace(/[\s،,.]+/g, "").trim();
  const refersPrior = /سو[يّ]?ها|سوها|اعملها|اعمله|حوّ?لها|حوّ?له|خلّ?يها|خليها|نفسها|نفسه|هذا|هذه|هاي|هيا|فوق|السابق|الجواب|الرد|\bit\b|\bthis\b|\bthat\b|convert it|make it|turn it|turn this/i.test(reqTxt) || strippedReq.length < 4;
  if (prevAns && refersPrior && !(lastUser && lastUser.fileText) && !(srcImages && srcImages.length)) {
    const src = (typeof stripFileMetaBlock === "function" ? stripFileMetaBlock(prevAns.content) : prevAns.content);
    userText += "\n\n=== CONTENT TO TURN INTO THE FILE — this is the PREVIOUS answer the user wants as a " + String(fmt).toUpperCase() +
      " document. BUILD THE FILE FROM THIS EXACT CONTENT (keep its figures / graphs / ```plot / ```tikz / math intact, then organize and polish it into a professional document). Do NOT invent a different topic. ===\n" + src;
  }
  // REAL WEB IMAGES in the document: the user asked for صور/images → search the web (Openverse)
  // for topic photos and hand the author their EXACT URLs to place with captions across sections.
  const wantsImages = /بالصور|مع\s*صور|مصوّ?ر|أضف\s*صور|اضف\s*صور|ضع\s*صور|و?صور\s*(له|لها|معه)?|with\s*(images|pictures|photos)|illustrated/i.test(userText) && !/بدون\s*صور|بلا\s*صور|من\s*دون\s*صور|no\s*images/i.test(userText);
  if (wantsImages && typeof agentGatherImages === "function") {
    if (onStage) onStage("plan");
    let docImgs = [];
    try { docImgs = await agentGatherImages(userText.slice(0, 700), "", signal); } catch (_) { docImgs = []; }
    // Route through OUR image proxy: same-origin images draw onto the PDF canvas with zero CORS
    // taint (the source hosts don't send CORS headers).
    docImgs = docImgs.map((u) => "/api/imgproxy?u=" + encodeURIComponent(u));
    if (docImgs.length) {
      userText += "\n\n[REAL IMAGE URLS — the document must include these real photos. Place EACH ONE at a contextually fitting spot using EXACTLY this markdown on its own line: ![وصف موجز](URL) followed on the next line by a short *caption in italics* in the user's language. SPREAD them across different sections (never bunch them together, never put two images adjacent), and NEVER invent any other image URL:\n" + docImgs.map((u, i) => (i + 1) + ". " + u).join("\n") + "]";
    }
  }
  // BIG-COUNT branch: a request for many items ("1000 integrals/problems/questions…")
  // would truncate in a single author call → generate it in parallel BATCHES instead.
  const cm = userText.match(/(\d[\d,]{1,5})\s*\+?\s*(?:integrals?|problems?|questions?|exercises?|equations?|items?|mcqs?|تكاملات?|مسائل|مسأل[ةه]?|أسئلة|سؤال|تمارين|تمرين|انتيكرل|انتقرل|معادلات?|معادلة)/i);
  let bigCount = cm ? parseInt(cm[1].replace(/,/g, ""), 10) : 0;
  // Worksheet of math items? Several phrasings should ALSO trigger the batched generator
  // (otherwise a long worksheet truncates/fails in one author call). Take the LARGEST signal.
  const isMathWorksheet = /integrals?|تكاملات?|انتيكرل|انتقرل|problems?|مسائل|مسأل[ةه]?|questions?|أسئلة|سؤال|exercises?|تمارين|تمرين|equations?|معادلات?/i.test(userText);
  if (isMathWorksheet) {
    // "300 hard JEE integrals" — count with adjectives between (only a 2+ digit number, so a "3
    // rows" never counts as the item total).
    const cm2 = userText.match(/(\d{2,5})\s+(?:[A-Za-z؀-ۿ'’.-]+\s+){0,5}(?:integrals?|problems?|questions?|exercises?|equations?|تكاملات?|مسائل|مسأل[ةه]?|أسئلة|تمارين|معادلات?)/i);
    if (cm2) { const n = parseInt(cm2[1], 10); if (n >= 30) bigCount = Math.max(bigCount, n); }
    // "15 pages" / "15 filled" / "15 sheets" → treat the number as PAGES (~9 items each).
    const pm = userText.match(/(\d{1,3})\s*\+?\s*(?:pages?|sheets?|filled|صفحات?|صفحة|ورق[ةه]?|اوراق|مملوء)/i);
    const rm = userText.match(/(\d{1,3})\s*\+?\s*(?:rows?|صفوف?|سطور|أسطر)/i);
    if (pm) bigCount = Math.max(bigCount, parseInt(pm[1], 10) * 9);
    else if (rm && parseInt(rm[1], 10) >= 10) bigCount = Math.max(bigCount, parseInt(rm[1], 10) * 3);
    // "lots of / many / long / full" worksheet but no number → a solid default (~17 pages).
    else if (!bigCount && /\b(?:many|lots?|several|tons?|full|long)\b|كثير|الكثير|طويل|عديد|مليئ|مليان/i.test(userText)) bigCount = 150;
    bigCount = Math.min(bigCount, 1000);
  }
  // Only use the batched worksheet generator for a request to CREATE MANY FRESH math items (integrals/
  // problems). NEVER for an image/file SOURCE (an uploaded exam is a STRUCTURED document on a specific
  // subject — physics, chemistry… — that must be REPLICATED harder in the SAME subject, not turned into a
  // pile of integrals). Those go to the normal author, which respects the source's subject and structure.
  const hasSource = (srcImages && srcImages.length) || (lastUser && lastUser.fileText);
  if (bigCount >= 80 && fmt !== "xlsx" && fmt !== "csv" && fmt !== "pptx" && !hasSource) {
    return await runBatchedFileDoc(userText, bigCount, fmt, lang, tierKey, signal, onStage);
  }
  // 1) Planner — identity + outline
  onStage("plan");
  const plan = await callAgentText([
    { role: "system", content: plannerSys(fmt, lang) },
    { role: "user", content: userText },
  ], tierKey, signal);
  const parsed = parseFileMeta(plan);
  const metaBlock = metaBlockString(parsed.meta);
  const outline = parsed.body.trim();
  // 2) Author — full content
  onStage("content");
  let content = (await callAgentText([
    { role: "system", content: authorSys(fmt, lang) },
    { role: "user", content: "REQUEST:\n" + userText + "\n\nFILE PLAN:\n" + metaBlock + "\n" + outline + "\n\nWrite the full content now, following the plan exactly." },
  ], tierKey, signal)).trim();
  // 2b) COUNT ENFORCEMENT — "10 questions" must yield 10, not 6: if the author stopped early
  // (or was truncated), auto-continue with the missing items until the requested count is met.
  const requestedN = parseRequestedItemCount(userText);
  if (requestedN >= 2 && requestedN <= 400 && fmt !== "xlsx" && fmt !== "csv" && fmt !== "pptx") {
    content = await ensureDocItemCount(content, requestedN, userText, authorSys(fmt, lang),
      (msgs) => callAgentText(msgs, tierKey, signal), signal, onStage);
  }
  // 3) Finisher — only re-process via the model when the draft has real problems
  // (stray code/HTML, preamble, or no proper title); otherwise assemble in CODE so
  // long content (e.g. 100 equations) is never truncated or dropped.
  onStage("assemble");
  const dense = (s) => (s || "").replace(/\s/g, "").length;
  const needsFix =
    /```|<\s*(!doctype|html|style|script|div|body|head)/i.test(content) ||
    /\\documentclass|\\begin\{document\}|overleaf/i.test(content) ||
    /pip install|python-docx|python-pptx|openpyxl|matplotlib|import \w|def \w+\(|\brun (python|the script)\b|\.py\b|تثبيت المكتبات|نفّذ السكريبت/i.test(content) ||
    (fmt !== "xlsx" && fmt !== "csv" && !/^\s*#\s/.test(content)) ||
    /^\s*(of course|بالطبع|sure,|here('|’)s|here is|إليك|سأقوم|دعني)/i.test(content);
  let finalDoc = metaBlock + "\n\n" + content; // clean default: code assembly
  if (needsFix) {
    let fixed = "";
    try {
      fixed = (await callAgentText([
        { role: "system", content: finisherSys(fmt, lang) },
        { role: "user", content: "FILE METADATA (output this exact block FIRST):\n" + metaBlock + "\n\nDRAFT CONTENT (finalize & polish; keep ALL of it):\n" + content + "\n\nOutput the final file now." },
      ], tierKey, signal)).trim();
    } catch (e) { if (signal.aborted) throw e; }
    const isHtml = /<\s*(!doctype|html|body|div|style|head|script)/i.test(content);
    if (fixed && dense(fixed) >= dense(content) * 0.45) {
      // Finisher delivered — use it (prepend the metadata block if it dropped it).
      finalDoc = /```firas-file/i.test(fixed) ? fixed : metaBlock + "\n\n" + fixed;
    } else if (isHtml) {
      // Draft was HTML and the finisher didn't deliver — strip tags so the file is
      // never raw markup. (With the gpt-oss document model this branch is rare.)
      finalDoc = metaBlock + "\n\n" + content.replace(/<[^>]+>/g, " ").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    }
  }
  return sanitizeBareLatex(fixMathBlanks(tightenInlineMath(finalDoc)));
}

/* ---- Large workbooks: generate N items in parallel BATCHES (no truncation) ---- */
const DEFAULT_ITEM_CATEGORIES = [
  "non-obvious algebraic substitutions (e.g. \\int dx/(x\\sqrt{x^4+1}), \\int\\sqrt{\\tan x}\\,dx)",
  "definite integrals via King's property \\int_a^b f(x)dx=\\int_a^b f(a+b-x)dx",
  "symmetry / x\\to 1/x / periodicity tricks for definite integrals",
  "Weierstrass t=\\tan(x/2) and hard rational-trigonometric integrals",
  "reduction formulas & Wallis \\int_0^{\\pi/2}\\sin^m\\cos^n",
  "Frullani & differentiation-under-the-integral (Feynman) with clean closed forms",
  "log-trig definite integrals (the \\int_0^{\\pi/2}\\ln(\\sin x) family)",
  "repeated integration by parts / telescoping tricks",
  "partial fractions with irreducible quadratics & high powers",
  "advanced trigonometric & hyperbolic substitution",
  "inverse-trig / inverse-hyperbolic results (arctan / arcsinh forms)",
  "rationalizing substitutions for nested radicals",
  "JEE-Advanced indefinite integrals at real exam difficulty",
  "Putnam / Olympiad definite integrals with elementary closed form",
  "creative original hard integrals with a surprising clean answer",
  "exponential·trigonometric products via repeated by-parts",
  "absolute-value / greatest-integer definite integrals",
  "two-step non-obvious substitution chains",
  "definite integrals collapsing to \\pi, \\ln 2, or simple closed forms",
  "mixed hard miscellaneous (no pattern repeats)",
];
// Few-shot calibration: VERIFIED hard integrals (each independently re-derived & confirmed by an
// adversarial checker). Pulls the model up to JEE-Advanced/Olympiad level by EXAMPLE, not adjective.
const HARD_INTEGRAL_SEEDS = [
  { p: "\\int_{0}^{\\pi} \\frac{x\\,\\sin x}{1+\\cos^{2} x}\\,dx", a: "\\frac{\\pi^{2}}{4}" },
  { p: "\\int_{0}^{\\pi/2} \\ln\\!\\left(9\\cos^{2}\\theta + \\sin^{2}\\theta\\right)\\, d\\theta", a: "\\pi\\ln 2" },
  { p: "\\int_{0}^{\\pi/2}\\frac{dx}{1+\\tan^{2026} x}", a: "\\dfrac{\\pi}{4}" },
  { p: "\\int_{0}^{\\infty} \\frac{e^{-2x}\\cos 2x - e^{-3x}\\cos 3x}{x}\\,dx", a: "\\ln\\frac{3}{2}" },
  { p: "\\int \\frac{dx}{\\sin x + \\cos x + 2}", a: "\\sqrt{2}\\,\\arctan\\!\\left(\\frac{\\tan\\frac{x}{2}+1}{\\sqrt{2}}\\right) + C" },
  { p: "\\int_{0}^{\\pi/2} \\sin^{6}x\\,\\cos^{4}x \\, dx", a: "\\dfrac{3\\pi}{512}" },
  { p: "\\int \\frac{x^2-1}{(x^2+1)\\sqrt{x^4+1}}\\,dx", a: "\\frac{1}{\\sqrt{2}}\\arctan\\!\\left(\\frac{\\sqrt{x^4+1}}{\\sqrt{2}\\,x}\\right)+C" },
  { p: "\\int_{0}^{1} \\frac{\\ln(1+x)}{1+x^{2}}\\,dx", a: "\\frac{\\pi}{8}\\ln 2" },
  { p: "\\int_{0}^{\\pi/2} \\frac{x}{\\sin x + \\cos x}\\,dx", a: "\\frac{\\pi\\sqrt{2}}{4}\\ln\\!\\left(1+\\sqrt{2}\\right)" },
  { p: "\\int_{0}^{\\infty} \\frac{\\cos 3x \\, \\cos x - \\cos 5x \\, \\cos 2x}{x}\\,dx", a: "\\frac{1}{2}\\ln\\frac{21}{8}" },
  { p: "\\int \\frac{x^2+1}{(x^2-1)\\sqrt{x^4+1}}\\,dx", a: "-\\frac{1}{\\sqrt{2}}\\,\\operatorname{arctanh}\\!\\left(\\frac{\\sqrt{2}\\,x}{\\sqrt{x^4+1}}\\right)+C" },
  { p: "\\int_{0}^{\\pi/2} \\sin^{9}x\\,\\cos^{5}x \\, dx", a: "\\dfrac{1}{210}" },
];
let _seedRot = 0;
function seedExamples() {
  if (!HARD_INTEGRAL_SEEDS.length) return "";
  const n = HARD_INTEGRAL_SEEDS.length;
  const start = (_seedRot++ * 3) % n;   // shift the window each batch → varied exemplars, less verbatim echo
  const pick = Array.from({ length: Math.min(8, n) }, (_, i) => HARD_INTEGRAL_SEEDS[(start + i) % n]);
  return "\n\nCALIBRATION — these are AT the target difficulty (match their LEVEL and variety; do NOT copy them verbatim):\n" +
    pick.map((e, i) => (i + 1) + ") $" + e.p + "$ = $" + e.a + "$").join("\n");
}
function batchAuthorSys(lang) {
  return "You are an elite mathematician and JEE-Advanced / Olympiad problem curator building a printable, HIGH-DIFFICULTY integration workbook. " +
    "Output ONLY a clean numbered Markdown list — each problem on its own line as `<n>. $<expression in LaTeX>$` " +
    "(proper LaTeX: \\int, \\frac, \\sqrt, ^{}, _{}, bounds like \\int_{0}^{\\pi/2}, etc.). Then a line containing EXACTLY `<!--ANSWERS-->`, " +
    "and after it a compact numbered list of the FINAL ANSWERS ONLY (no steps), one per line `<n>. $<answer>$`. " +
    "DIFFICULTY: aim squarely at JEE-Advanced and Olympiad level — each problem must require a genuine IDEA, never routine drill or a bare polynomial. " +
    "Use the full elementary toolkit: non-obvious substitutions, King's property and symmetry for definite integrals, Weierstrass t=\\tan(x/2), " +
    "reduction formulas / Wallis, Frullani, and differentiation under the integral sign (Feynman). " +
    "BUT every final answer MUST be an EXACT closed form (rationals, \\pi, e, \\ln, \\arctan, \\sqrt, hyperbolic) — NO special functions " +
    "(no \\Gamma, \\zeta, \\operatorname{Li}, Si/Ci, elliptic) and NO numerical approximations. " +
    "CORRECTNESS IS NON-NEGOTIABLE: re-derive and VERIFY every answer (differentiate an antiderivative back, or sanity-check the definite value) before writing it. " +
    "ABSOLUTE VARIETY — THE #1 RULE: every single problem must be a genuinely NEW idea — a DIFFERENT integrand structure, a DIFFERENT technique, and a DIFFERENT answer form. " +
    "It is STRICTLY FORBIDDEN to emit a 'family' that differs only by an exponent, coefficient, constant, sign, or integration bound (e.g. \\int x^2.., \\int x^3.., \\int \\sin^4.., \\int \\sin^6.. one after another) — that mechanical, series-like repetition is exactly what to avoid. No two problems may be recognizable variants of each other; each must look and feel like a fresh competition problem. " +
    "No preamble, no commentary, no headings — nothing but the numbered problems and the answers." +
    seedExamples() + agentBrand(lang);
}
function batchUserMsg(userText, start, end, cats, lang) {
  const list = (Array.isArray(cats) ? cats : [cats]).map((c) => "  • " + c).join("\n");
  return "Workbook request (context): " + String(userText).slice(0, 600) +
    "\n\nGenerate problems numbered EXACTLY " + start + " to " + end + " (" + (end - start + 1) + " problems). " +
    "SPREAD them roughly evenly ACROSS these DISTINCT techniques (don't dwell on one):\n" + list +
    "\n\nVARIETY IS THE TOP PRIORITY: every problem must be a STRUCTURALLY different integrand with its OWN idea and a different answer form. " +
    "NEVER write a run of problems that differ only by an exponent/coefficient/constant/bound — no two may be recognizable variants. " +
    "Make them genuinely HARD (JEE-Advanced / Olympiad), each needing a real technique; all answers EXACT closed forms and VERIFIED correct. " +
    "Output the numbered problems, then `<!--ANSWERS-->`, then the final answers.";
}
/** Run async workers over items with a concurrency cap; results returned in order. */
async function mapWithLimit(items, limit, worker) {
  const results = new Array(items.length);
  let idx = 0;
  async function run() { while (idx < items.length) { const i = idx++; results[i] = await worker(items[i], i); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
async function runBatchedFileDoc(userText, count, fmt, lang, tierKey, signal, onStage) {
  count = Math.min(Math.max(count, 1), 1000);          // hard cap
  onStage("plan");
  let metaBlock, title;
  try {
    const parsed = parseFileMeta(await callAgentText([
      { role: "system", content: plannerSys(fmt, lang) },
      { role: "user", content: userText },
    ], tierKey, signal));
    metaBlock = metaBlockString(parsed.meta);
    title = parsed.meta.title || (lang === "ar" ? "كتاب التكاملات" : "Integration Workbook");
  } catch (e) { if (signal.aborted) throw e; metaBlock = metaBlockString({ title: "Integration Workbook", theme: "navy" }); title = "Integration Workbook"; }
  // Batch ranges (~28 each), each a rotating category for variety with no overlap. Harder
  // (JEE/Olympiad) problems take longer to author+verify, so smaller batches finish more
  // reliably inside the per-batch cap and more of them complete within the time budget.
  const BATCH = 28;
  const CATS_PER_BATCH = 5;            // each batch spans several techniques → far less in-batch repetition
  const ranges = [];
  const nBatches = Math.ceil(count / BATCH);
  for (let i = 0; i < nBatches; i++) {
    const cats = Array.from({ length: CATS_PER_BATCH }, (_, k) => DEFAULT_ITEM_CATEGORIES[(i * CATS_PER_BATCH + k) % DEFAULT_ITEM_CATEGORIES.length]);
    ranges.push({ start: i * BATCH + 1, end: Math.min((i + 1) * BATCH, count), cats });
  }
  onStage("content");
  // gpt-oss is a slow reasoning model (~5s/problem → a 50-item batch ≈ 200s). Give each
  // batch a generous cap (close to the server's own 5-min limit) so valid batches aren't
  // cut short, and NEVER throw — a failed/aborted batch is simply skipped so whatever
  // finished still assembles into a (possibly partial) workbook.
  const PER_BATCH_MS = 280000;
  const t0 = Date.now();
  const SOFT_BUDGET_MS = 600000;   // ~10 min: stop launching new batches and assemble what
                                   // finished, so a huge count returns a clean PARTIAL workbook
                                   // BEFORE the hard 12-min stream timeout would discard it.
  const genBatch = async (r) => {
    if (Date.now() - t0 > SOFT_BUDGET_MS || signal.aborted) return "";  // out of budget → skip
    const ac = new AbortController();
    const fwd = () => { try { ac.abort(); } catch (_) {} };
    if (signal.aborted) ac.abort(); else signal.addEventListener("abort", fwd, { once: true });
    const to = setTimeout(() => { try { ac.abort(); } catch (_) {} }, PER_BATCH_MS);
    try {
      return (await callAgentText([
        { role: "system", content: batchAuthorSys(lang) },
        { role: "user", content: batchUserMsg(userText, r.start, r.end, r.cats, lang) },
      ], tierKey, ac.signal)).trim();
    } catch (_) {
      return "";                         // errored / per-batch cap / overall stop → skip, keep what we have
    } finally { clearTimeout(to); try { signal.removeEventListener("abort", fwd); } catch (_) {} }
  };
  const progress = () => onStage((lang === "ar" ? "يكتب التكاملات… " : "Writing integrals… ") +
    Math.min(outs.filter(Boolean).length * BATCH, count) + "/" + count);
  // Pass 1 — all batches in parallel.
  let done = 0;
  const outs = new Array(ranges.length).fill("");
  await mapWithLimit(ranges, 5, async (r, i) => { outs[i] = await genBatch(r); done++; progress(); });
  // Pass 2 — retry the ones that hung/failed, so the workbook reaches its target.
  const failedIdx = outs.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
  if (failedIdx.length && !signal.aborted) {
    await mapWithLimit(failedIdx, 3, async (i) => { const res = await genBatch(ranges[i]); if (res) { outs[i] = res; progress(); } });
  }
  onStage("assemble");
  const probs = [], ans = [];
  for (const out of outs) {
    if (!out) continue;
    const parts = out.split(/<!--\s*answers\s*-->/i);
    const p = (parts[0] || "").replace(/^#+\s.*$/gm, "").trim();   // strip any stray headings
    if (p) probs.push(p);
    if (parts[1] && parts[1].trim()) ans.push(parts[1].trim());
  }
  const intro = lang === "ar"
    ? "مجموعة منسّقة من التكاملات بمستويات متدرّجة — من المبتدئ حتى الأولمبياد. الإجابات النهائية في آخر الكتاب."
    : "A curated collection of integrals spanning every level — from beginner to Olympiad. Final answers are at the end.";
  const answersHead = lang === "ar" ? "مفتاح الإجابات" : "Answer Key";
  return metaBlock + "\n\n# " + title + "\n\n" + intro + "\n\n" + probs.join("\n\n") +
    (ans.length ? "\n\n# " + answersHead + "\n\n" + ans.join("\n\n") : "");
}

/* ============================================================================
   WEB SEARCH — when the user's message has web/current-info intent, Firas fetches
   live results (keyless, via the server's /api/search) and answers with sources.
   ========================================================================== */
function needsWebSearch(text) {
  const s = String(text || "");
  if (!s.trim()) return false;
  // Tightened: only genuine web/current-info intent. Bare "search/result/price/
  // score/<year>" were dropped — they collide with everyday coding/math prompts
  // ("the result of 2+2", "search an array", "score of my function").
  const en = /\b(google|search\s+(?:for|the\s+web|online)|look\s+up|latest|newest|recent news|breaking|\bnews\b|today|tonight|yesterday|currently|right now|this (?:week|month|year)|stock\s+(?:price|market)|exchange rate|weather|forecast|who won|winner|standings?|fixtures?|release date)\b/i;
  const ar = /(ابحث|إبحث|ابحثلي|ابحث لي|دوّر|دور لي|جيب لي معلوم|كوكل|قوقل|جوجل|بالانترنت|بالإنترنت|على النت|بالنت|انترنت|إنترنت|(آخر|اخر|أحدث|احدث)\s*\S|الحالي|الحالية|الحاليه|الأخبار|الاخبار|أخبار|اخبار|اليوم|البارحة|أمس|امس|هذا (الأسبوع|الشهر|العام)|هذه السنة|حالياً|حاليا|سعر|أسعار|اسعار|الطقس|درجة الحرارة|من فاز|من ربح|الفائز|مباراة|مباريات|الدوري|بطولة|كأس|متى يقام|متى تبدأ|أين يقام)/i;
  return en.test(s) || ar.test(s);
}
async function fetchWebSearch(query) {
  try {
    const r = await fetch("/api/search?q=" + encodeURIComponent(String(query).slice(0, 280)), { credentials: "same-origin" });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data.results) ? data.results.slice(0, 6) : [];
  } catch (_) { return []; }
}
function formatSearchContext(results, lang) {
  if (!results || !results.length) return "";
  const head = lang === "ar"
    ? "نتائج بحث ويب حديثة لسؤال المستخدم. اعتمد عليها للحقائق المتغيّرة/الحديثة، واذكر المصدر بين قوسين هكذا [1] [2] بعد كل معلومة. وفي نهاية الرد أضف قسم \"### المصادر\" واكتب كل مصدر **كرابط Markdown قابل للنقر** بهذا الشكل بالضبط (مع الرابط الكامل):\n- [العنوان](الرابط الكامل)"
    : "Current web search results for the user's question. Base time-sensitive facts on them, cite inline like [1] [2] after each claim. End your reply with a \"### Sources\" section where each source is a **clickable Markdown link** in exactly this form (with the full URL):\n- [Title](full URL)";
  const body = results.map((r, i) => "[" + (i + 1) + "] " + r.title + " — " + r.url + (r.snippet ? "\n" + r.snippet : "")).join("\n\n");
  return head + "\n\n" + body;
}

/** Web references for I'RAB — INTERNAL use only: the model leans on them but shows
    NO sources, links, or [1][2] citations (the user wants only the clean parse). */
function formatIrabContext(results, lang) {
  if (!results || !results.length) return "";
  const head = lang === "ar"
    ? "مراجعُ من الويب لإعراب الجملة (للاستئناس الداخلي فقط). استند إليها بعد التحقّق من صحّتها، لكن لا تذكرها ولا تقتبسها ولا تضع أرقام استشهاد [1][2] ولا أي روابط أو قسم مصادر في إجابتك إطلاقًا — اعرض الإعراب النظيف فقط ولا شيء غيره."
    : "Web references for parsing the sentence (INTERNAL use only). Use them after verifying, but do NOT mention, quote, number [1][2], link, or list any sources in your answer — output only the clean i'rab and nothing else.";
  const body = results.map((r) => "- " + r.title + (r.snippet ? ": " + r.snippet : "")).join("\n");
  return head + "\n\n" + body;
}

/**
 * Core streaming routine. Tied to a SPECIFIC chat (by object + id), NOT to the
 * active view: if the user opens/switches chats mid-stream, this keeps running
 * headless, updates ITS chat's message, and persists the result to that chat.
 * Live DOM updates happen only while its node is still on screen. Reads via
 * getReader(), batches DOM updates with rAF, supports Stop (abort) + a 5-min
 * timeout, and on ANY failure serves a built-in offline fallback (never stuck).
 */
async function streamAnswer(aiMsg, aiNode, chat, convoOverride) {
  const tier = MODELS[aiMsg.tier] || MODELS.pro;
  const chatId = chat.id;
  // convoOverride lets "regenerate" re-answer an earlier prompt (without showing the old answer
  // to the model) while the new reply is appended at the END of the chat.
  const convo = convoOverride || chat.messages.slice(0, chat.messages.indexOf(aiMsg)); // up to (not incl.) this AI msg
  const replyLang = aiMsg.lang;

  const controller = new AbortController();
  const { signal } = controller;

  // Timeout guard — 15 min (each underlying /api/chat call is still bounded by the
  // server's own 5-min limit; this larger budget lets MULTI-call flows like a batched
  // workbook finish). It sits ABOVE the batch run's 10-min soft budget + one 4-min batch
  // so the partial workbook always assembles and returns BEFORE this hard cut would fire.
  const timeoutId = setTimeout(() => { try { controller.abort("timeout"); } catch (_) {} }, 900000);

  // Register this in-flight stream by chat id so Stop can target it precisely and
  // navigation can leave it running.
  activeStreams.set(chatId, { controller, timeoutId, aiMsg });

  // If the tab gets backgrounded (or starts hidden) during this stream, a resulting failure is
  // an INTERRUPTION (auto-resume), not a real error — track it so the catch can tell them apart.
  let sawHidden = document.hidden;
  let retryBusy = false;   // set when the whole reply is an "engine busy" sentence → silent auto-retry
  const onVis = () => { if (document.hidden) sawHidden = true; };
  document.addEventListener("visibilitychange", onVis);

  // Snapshot the thinking pref for THIS reply. When off, no Thinking panel.
  // Max NEVER thinks (disabled there — see setThink), even if the pref was left on
  // from another tier, so it can't be steered into breaking its limits.
  const thinkAllowed = tier.key !== "max";
  const wantThinking = state.think && tier.showThinking && thinkAllowed;
  aiMsg.think = state.think && thinkAllowed;

  // Snapshot whether THIS reply should be masked as a streaming file (so the chat
  // shows a calm loader, not a wall of raw document text/code).
  const fileFmt = isFileStreamReply(aiMsg, chat);

  // Snapshot whether THIS reply is a CODE deliverable — streamed live into a code
  // window (no file masking, no markdown). Skipped in plan mode.
  const lastUserForCode = [...convo].reverse().find((m) => m.role === "user");
  // In plan mode, the EXECUTE turn is triggered by an approval ("ابدأ") that carries
  // no build spec — so look back to the ORIGINAL request to pick the deliverable.
  const planExecuting = state.mode === "plan" && precededByApproval(chat, chat.messages.indexOf(aiMsg));
  const codeTrigger = planExecuting
    ? ([...convo].reverse().find((m) => m.role === "user" && detectCodeRequest(m.content)) || lastUserForCode)
    : lastUserForCode;
  const codeReq = (!fileFmt && (state.mode !== "plan" || planExecuting) && codeTrigger)
    ? (detectCodeRequest(codeTrigger.content) || (state.mode !== "plan" ? codeFollowupSpec(convo) : null))
    : null;

  let answer = "";
  let reasoning = "";
  let thinkingNode = null;
  let pendingRender = false;
  let finalized = false; // once true, the final decorated DOM must not be clobbered
  let lastPaintAt = 0;          // time floor: full markdown+KaTeX re-render ≤ ~7x/sec (O(n²) otherwise)
  let lastRenderedAnswer = null; // skip the heavy body re-render when only "thinking" tokens arrived

  // Resolve the LIVE node for this streaming message in the current thread. When
  // the user is viewing this chat, re-find by index (the thread may have been
  // rebuilt, replacing our captured node). Returns null when off screen.
  const liveNode = () => {
    if (activeChat() !== chat) return null;
    if (aiNode && aiNode.isConnected) return aiNode;
    const idx = chat.messages.indexOf(aiMsg);
    if (idx < 0) return null;
    const n = els.thread.querySelector(`.msg-ai[data-index="${idx}"]`);
    if (n) { aiNode = n; aiNode.querySelector(".msg-ai__body .md")?.classList.add("stream-caret"); }
    return n;
  };

  // Batched render — heavy markdown work happens in rAF, not in the read loop.
  // Re-resolves the live node each frame so it no-ops when off screen.
  const scheduleRender = () => {
    if (pendingRender || finalized) return;
    pendingRender = true;
    requestAnimationFrame(() => {
      pendingRender = false;
      if (finalized) return; // a trailing frame must not overwrite finalized output
      // TIME FLOOR: re-parsing + re-typesetting the WHOLE accumulated answer every frame is
      // O(n²) over the stream and chugs on long math-heavy replies. Cap the heavy pass at
      // ~7-8/sec; re-arm a trailing timer so the final chunk always paints (and finalizeAi
      // does an authoritative full render at the end regardless).
      const now = performance.now();
      if (now - lastPaintAt < 130) { setTimeout(scheduleRender, 140 - (now - lastPaintAt)); return; }
      const node = liveNode();
      if (!node) return; // navigated away — keep streaming headless
      aiNode = node;
      const mdEl = aiNode.querySelector(".msg-ai__body .md");
      if (!mdEl) return;
      if (codeReq) {
        // Code request → stream the source live into a code window.
        lastPaintAt = now;
        renderLiveCodeInto(mdEl, answer, codeReq, replyLang);
        mdEl.classList.remove("stream-caret");
      } else if (answer !== lastRenderedAnswer) {
        // Only rebuild the body when the ANSWER text actually changed — a burst of
        // "thinking" tokens alone must not re-parse/re-typeset the whole message.
        lastPaintAt = now;
        lastRenderedAnswer = answer;
        // File request → keep the raw document content out of the chat; show a calm
        // "Creating your file…" loader while it streams.
        mdEl.innerHTML = fileFmt ? buildFileLoadingHtml() : renderMarkdown(answer);
        mdEl.classList.toggle("stream-caret", !fileFmt);
        // Render math LIVE as it streams: KaTeX auto-render only converts CLOSED
        // delimiter pairs (throwOnError:false ignores the still-incomplete trailing
        // one), so each equation turns pretty the moment its closing $/$$ arrives —
        // no waiting for the whole reply to finish.
        if (!fileFmt) typesetMath(mdEl);
      }
      if (reasoning && wantThinking) {
        if (!thinkingNode || !thinkingNode.isConnected) {
          thinkingNode = thinkingEl(reasoning, false);
          aiNode.querySelector(".msg-ai__head").after(thinkingNode);
        } else {
          thinkingNode.querySelector(".thinking__inner").textContent = reasoning;
        }
      }
      if (autoScroll) scrollToBottom();
    });
  };

  try {
    // IMAGE REQUESTS → generate an image (keyless) instead of a text reply. Show a
    // framed "generating…" effect, enhance the prompt to a vivid English one, then
    // render the image card (which loads the picture from the /api/image proxy).
    const imgUser = planExecuting
      ? ([...convo].reverse().find((m) => m.role === "user" && detectImageRequest(m.content)) || [...convo].reverse().find((m) => m.role === "user"))
      : [...convo].reverse().find((m) => m.role === "user");
    // A vision turn (the user attached images) must NOT be treated as image
    // generation — answer about the image instead.
    const imgHasAttachments = imgUser && Array.isArray(imgUser.images) && imgUser.images.length > 0;
    // Only generate an image when the turn is NOT already routed to code or a file —
    // so a stray "logo"/"image" mention inside a website/app/document request can no
    // longer hijack it into image-gen (the "does the opposite of what I asked" bug).
    if (imgUser && !imgHasAttachments && (state.mode !== "plan" || planExecuting) && !fileFmt && !codeReq && detectImageRequest(imgUser.content)) {
      // Pre-check the per-user daily cap (read-only; the slot is charged on the
      // server only when the image actually loads — see imageUrl's cid). An
      // explicit 429 blocks; other errors fail open (downstream auth still gates).
      const quota = await fetchImageQuota();
      if (quota && quota.ok === false) {
        clearTimeout(timeoutId);
        finalized = true;
        aiMsg.content = imageLimitText(replyLang, quota);
        aiMsg.reasoning = "";
        finalizeAi(aiMsg, chat);
        return;
      }
      const inode = liveNode(); const imd = inode && inode.querySelector(".msg-ai__body .md");
      if (imd) imd.innerHTML = buildImageLoadingHtml(replyLang);
      let prompt = String(imgUser.content).slice(0, 300);
      try {
        const enhanced = await callAgentText([
          { role: "system", content: "Turn the user's request into ONE rich, vivid ENGLISH image-generation prompt that yields a HIGH-QUALITY, professional result. Keep the user's subject and intent, then add concrete visual detail: composition, setting, lighting, mood, colors, and camera/style cues. If the user wants a realistic photo, add photoreal cues (e.g. \"photorealistic, ultra-detailed, sharp focus, natural lighting, shot on 50mm, high resolution\"); if they want art/illustration/3D/anime, add the matching style cues instead. Do NOT contradict the requested style. Output ONLY the final prompt text — no quotes, no explanation, no preamble." },
          { role: "user", content: imgUser.content },
        ], "pro", signal);
        if (enhanced && enhanced.trim()) prompt = enhanced.trim().replace(/^["'`\s]+|["'`\s]+$/g, "").replace(/\s+/g, " ").slice(0, 400);
      } catch (_) { /* keep the raw request as the prompt */ }
      // Honor Stop pressed during prompt-enhancement — don't generate/charge.
      if (signal.aborted) { clearTimeout(timeoutId); return; }
      clearTimeout(timeoutId);
      finalized = true;
      // Pin a seed so the saved image is reproducible across cache-miss reloads,
      // and a stable cid so the daily cap charges exactly once (on first success).
      const imgSeed = Math.floor(Math.random() * 1e9);
      const imgCid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (imgSeed + "-" + Math.floor(Math.random() * 1e9));
      aiMsg.content = "```firas-image\n" + JSON.stringify({ prompt: prompt, w: 1024, h: 1024, seed: imgSeed, cid: imgCid }) + "\n```";
      aiMsg.reasoning = "";
      finalizeAi(aiMsg, chat);
      if (quota && quota.ok && typeof quota.remaining === "number") {
        // This creation will use one slot once it loads → show the post-creation count.
        showToast(imageRemainingText(replyLang, { ...quota, remaining: Math.max(0, quota.remaining - 1) }));
      }
      return; // the `finally` cleans up the stream
    }

    // FILE REQUESTS → run the 3-agent pipeline (content is masked behind the file
    // loader, so there's no visible stream to preserve). Each stage updates the
    // loader text. On engine failure the outer catch serves the offline fallback.
    if (fileFmt && state.mode !== "plan") {
      const finalDoc = await runFileAgentPipeline(convo, fileFmt, replyLang, aiMsg.tier, signal, (stage) => {
        const node = liveNode();
        const mdEl = node && node.querySelector(".msg-ai__body .md");
        if (mdEl) mdEl.innerHTML = buildFileLoadingHtml(fileStageText(stage, replyLang));
      });
      clearTimeout(timeoutId);
      finalized = true;
      aiMsg.content = finalDoc;
      aiMsg.reasoning = "";
      finalizeAi(aiMsg, chat);
      return; // the `finally` still runs (stream cleanup)
    }

    // WEB SEARCH → if the message wants current/web info, fetch live results and
    // inject them as context so Firas answers with up-to-date facts + sources.
    let requestMessages = buildMessages(aiMsg.tier, convo, replyLang);
    let requestTier = aiMsg.tier;
    // CODE deliverable → override with a raw-code prompt and route to the coder
    // model (ultra = qwen3-coder, which excels at code). No web search, no
    // thinking. The SSE loop below streams the source into the code window.
    if (codeReq) {
      // Unwrap any prior firas-code blocks to RAW source so the model sees real
      // code (not our JSON meta fence) when editing/continuing in the same chat.
      const codeConvo = convo.map((m) => {
        if (m.role === "assistant") { const cm = parseCodeMeta(m.content); if (cm) return { role: "assistant", content: cm.code }; }
        return { role: m.role, content: m.content };
      });
      requestMessages = [{ role: "system", content: codeSystemPrompt(codeReq) }, ...codeConvo];
      requestTier = "ultra";
      aiMsg.think = false;
    } else if (state.mode !== "plan") {
      const lastUserMsg = [...convo].reverse().find((m) => m.role === "user");
      // Skip web search on VISION turns (the server routes those to the vision
      // model and ignores the tier override; injected text would only pollute it).
      const lastHasImages = lastUserMsg && Array.isArray(lastUserMsg.images) && lastUserMsg.images.length > 0;
      const isIrab = !!(lastUserMsg && !lastHasImages && detectIrabRequest(lastUserMsg.content));
      // I'RAB ALWAYS searches the web for the parse FIRST (then the AI organizes it);
      // a normal turn searches only on the toggle or detected web intent.
      const doSearch = lastUserMsg && !lastHasImages && (isIrab || state.webSearch || needsWebSearch(lastUserMsg.content));
      if (doSearch) {
        // The "searching…" badge shows only when the web-search feature is ON — so an
        // i'rab search with the toggle OFF runs SILENTLY (no badge), per the rule.
        const showIndicator = isIrab ? !!state.webSearch : true;
        if (showIndicator) {
          const sn = liveNode(); const smd = sn && sn.querySelector(".msg-ai__body .md");
          if (smd) smd.innerHTML = buildFileLoadingHtml(replyLang === "ar" ? "يبحث في الإنترنت…" : "Searching the web…");
        }
        const query = isIrab ? ("إعراب " + lastUserMsg.content) : lastUserMsg.content;
        const results = await fetchWebSearch(query);
        // I'rab uses references WITHOUT showing sources; a normal turn cites them.
        const ctx = isIrab ? formatIrabContext(results, replyLang) : formatSearchContext(results, replyLang);
        if (ctx) {
          requestMessages = [requestMessages[0], { role: "system", content: ctx }, ...requestMessages.slice(1)];
          // gpt-oss (pro) uses live web results far better than the CODER model (ultra),
          // so downgrade ultra→pro for search turns. Max (Gemini) handles web results
          // excellently, so KEEP Max on its premium chain. (I'rab tier is set below.)
          if (!isIrab && requestTier !== "max") requestTier = "pro";
        } else if (state.webSearch && !isIrab) {
          // Toggle is explicitly ON but the search came back empty — tell the model
          // to say so, so the user isn't misled into thinking it's web-grounded.
          const note = replyLang === "ar"
            ? "تنبيه: لم تُرجع نتائج بحث ويب لهذا السؤال؛ أجب من معرفتك العامة وأخبر المستخدم أنه لم تتوفر نتائج ويب حيّة."
            : "Note: no live web results were found for this query; answer from general knowledge and tell the user that no live web results were available.";
          requestMessages = [requestMessages[0], { role: "system", content: note }, ...requestMessages.slice(1)];
        }
      }
    }
    // ARABIC I'RAB (إعراب) → rigorous word-by-word grammatical analysis. The coder
    // tier (ultra) is weak at grammar, so route it to the general model; inject an
    // expert-grammarian method so EVERY model parses precisely (esp. the Quran).
    const lastUForIrab = [...convo].reverse().find((m) => m.role === "user");
    if (lastUForIrab && !codeReq && !fileFmt && detectIrabRequest(lastUForIrab.content)) {
      if (requestTier === "ultra") requestTier = "pro";
      requestMessages = [requestMessages[0], { role: "system", content: irabSystemPrompt() }, ...requestMessages.slice(1)];
      // Binding override for specific verified sentences → exact, guaranteed parse.
      const ov = irabOverride(lastUForIrab.content);
      if (ov) requestMessages = [requestMessages[0], { role: "system", content: ov }, ...requestMessages.slice(1)];
    }
    // VISION turn. Two paths:
    //  • CREATE/TRANSFORM (make harder questions, solve, rewrite, summarize…) → 2-STAGE:
    //    the small vision model EXTRACTS the whole image, then the STRONG text model GENERATES
    //    the full output (the vision model truncates long generation — the "stopped halfway" bug).
    //  • Direct question (what is this / extract / read) → let the vision model answer directly.
    const lastUForVision = [...convo].reverse().find((m) => m.role === "user");
    const visImages = lastUForVision && Array.isArray(lastUForVision.images) ? lastUForVision.images : null;
    if (visImages && visImages.length && !codeReq) {
      const vSys = replyLang === "ar"
        ? "أنت ترى الصورة/الصور المرفقة. إن طُلب منك استخراج أو نسخ أو قراءة النص من الصورة، فاكتب كل النص كاملًا وحرفيًا — كل عنوان وفقرة وسطر ونقطة بالترتيب — دون تلخيص أو اختصار أو توقّف مبكّر، إلى آخر كلمة في الصفحة. وإلا فأجب عن السؤال المتعلّق بالصورة بدقّة وتفصيل."
        : "You can see the attached image(s). If asked to extract, transcribe, or read text from the image, output ALL the text COMPLETELY and verbatim — every heading, paragraph, line and bullet, in order — never summarize, abbreviate, or stop early; continue to the very last word on the page. Otherwise answer the question about the image accurately and in detail.";
      let did2Stage = false;
      if (isImageTransformRequest(lastUForVision.content || "")) {
        const vnode = liveNode(); const vmd = vnode && vnode.querySelector(".msg-ai__body .md");
        if (vmd) vmd.innerHTML = buildFileLoadingHtml(fileStageText("extract", replyLang));
        let extracted = "";
        try { extracted = await extractImageSource(visImages, lastUForVision.content || "", replyLang, signal, null); } catch (_) {}
        if (signal.aborted) { clearTimeout(timeoutId); return; }
        // Strong rules: SAME SUBJECT (never switch math→physics etc.) + same structure + complete + valid LaTeX.
        const genSys = replyLang === "ar"
          ? "أرفق المستخدم صورةً لامتحان/مستند (المصدر) وطلب نسخةً «بنفس النمط» لكن أصعب.\n• **الأهم — نفس المادة والمواضيع:** التزم حرفيًّا بنفس **مادة المصدر** ومواضيعه. إن كان المصدر **رياضيات** (تكامل/تفاضل/معادلات تفاضلية/هندسة تحليلية…) فكل سؤالٍ جديدٍ يجب أن يكون **رياضيات على نفس تلك المواضيع بالضبط** — **يُمنع منعًا باتًّا** تحويله إلى فيزياء أو كيمياء أو أي مادة أخرى، ويُمنع اختراع امتحانٍ مختلفٍ أو مواضيع جديدة. «أصعب» = مسائل أصعب **داخل نفس المادة ونفس المواضيع** فقط.\n• **نفس البنية تمامًا:** نفس عدد الأسئلة وترقيمها، ونفس الأجزاء (A/B/C و(1)(2)…)، ونفس تعليمات الاختيار حرفيًّا («اختر ٤ فقط» / «اختر واحدًا فقط»)، ونفس الدرجات (… M)، ونفس العناوين والترتيب — غيّر صعوبة المحتوى فقط.\n• **كامل:** أخرِج كل سؤالٍ وكل جزءٍ كاملًا — نفس عدد عناصر المصدر — دون حذفٍ أو توقّفٍ مبكّر مهما طال.\n• اكتب الرياضيات بـ LaTeX صحيحٍ يَعرضه KaTeX (استعمل \\cdot و \\text{} للوحدات إن لزم، وتجنّب الأوامر المكسورة مثل \\cdotp الملتصقة). لا تَحلّ الأسئلة ولا تُضِف أقسامًا لم تُطلب."
          : "The user attached an image of an exam/document (the source) and wants a 'same-pattern' but harder version.\n• **MOST IMPORTANT — SAME SUBJECT & TOPICS:** stay strictly in the source's SUBJECT and topics. If the source is MATH (integration/calculus/differential equations/analytic geometry…), EVERY new question MUST be MATH on those SAME topics — it is STRICTLY FORBIDDEN to switch it to physics, chemistry or any other subject, and forbidden to invent a different exam or new topics. 'Harder' = harder problems WITHIN the same subject and same topics only.\n• **SAME STRUCTURE EXACTLY:** same number of questions and numbering, same sub-parts (A/B/C and (1)(2)…), same selection instructions verbatim ('choose 4 only' / 'choose one only'), same marks (… M), same headings and order — change only the difficulty.\n• **COMPLETE:** output every question and every part in full — the same count as the source — with no dropping or early stop, however long.\n• Write math in clean, valid LaTeX that KaTeX renders (use \\cdot and \\text{} for units if any; avoid broken commands like a glued \\cdotp). Do NOT solve the questions and do NOT add sections that weren't requested.";
        if (extracted) {
          // Strip images so the turn routes to the STRONG text model, fed the full extracted source.
          requestMessages = requestMessages.map((m) => { if (m && m.images) { const { images, ...r } = m; return r; } return m; });
          for (let i = requestMessages.length - 1; i >= 0; i--) {
            if (requestMessages[i].role === "user") {
              requestMessages[i] = { ...requestMessages[i], content: (requestMessages[i].content || "") +
                (replyLang === "ar" ? "\n\n=== المحتوى الكامل المُستخرَج من الصورة المرفقة (المصدر) ===\n" : "\n\n=== FULL CONTENT EXTRACTED FROM THE ATTACHED IMAGE (source) ===\n") + extracted };
              break;
            }
          }
          if (requestTier === "mini") requestTier = "pro"; // ensure a strong generator
        }
        // (if extraction failed, KEEP the images so the vision model still sees the exam) — either way,
        // apply the same SUBJECT/STRUCTURE/COMPLETENESS rules.
        requestMessages = [requestMessages[0], { role: "system", content: genSys }, ...requestMessages.slice(1)];
        did2Stage = true;
      }
      if (!did2Stage) requestMessages = [requestMessages[0], { role: "system", content: vSys }, ...requestMessages.slice(1)];
    } else if (lastUForVision && !codeReq && !fileFmt && refersToPriorImage(lastUForVision.content || "")) {
      // The user refers to an image we no longer have (e.g. after a reload) → ask them to
      // re-attach it, instead of the model claiming it can never see images.
      const note = replyLang === "ar"
        ? "إن أشار المستخدم إلى صورة أو ملفٍ لا تجده الآن في هذه المحادثة، فاطلب منه بلطفٍ إعادة إرفاق الصورة لتقرأها — ولا تقل أبدًا إنك لا تستطيع رؤية الصور إطلاقًا أو إنك تفتقر لتلك القدرة."
        : "If the user refers to an image or file you cannot find in this conversation right now, politely ask them to re-attach the image so you can read it — never claim that you can't view images at all or that you lack that capability.";
      requestMessages = [requestMessages[0], { role: "system", content: note }, ...requestMessages.slice(1)];
    }
    // MAX tier → push maximum reasoning depth: decompose, explore approaches, reason
    // rigorously step-by-step, weigh edge-cases, and self-verify before answering.
    if (requestTier === "max") {
      const maxSys = replyLang === "ar"
        ? "أنت في الوضع الأقوى «ماكس». فكّر بعمقٍ ودقّةٍ داخليًّا (فكّك المشكلة، وازِن الاحتمالات والمقايضات، وتحقّق من صحّة إجابتك قبل تقديمها)، لكن اجعل **طول الإجابة مناسبًا للسؤال**: كن مباشرًا وموجزًا في الأسئلة البسيطة، وأفِضْ في التحليل فقط عند الأسئلة المعقّدة. لا تُطِلْ بلا داعٍ. وأنت كذلك **رياضيٌّ بمستوى الأولمبياد و Putnam و JEE Advanced**: عامل كل مسألة كمسألة مسابقات صعبة — سمِّ النظرية/الأسلوب المستخدم، استدلّ بخطواتٍ صارمةٍ دقيقة، نفّذ كل عمليةٍ جبريةٍ وحسابيةٍ بدقّةٍ تامّة، وأعطِ نواتج **مغلقة مضبوطة** (كسور، جذور، π، e — لا أعداد عشرية مقرّبة إلا عند الطلب)، ورتّب البراهين بوضوح (المعطى/المطلوب/البرهان ∎). و**تحقّق من الناتج بطريقةٍ ثانية قبل الإجابة** (اشتقّ ناتج التكامل للخلف، أو عوّض القيم، أو افحص النهايات/الوحدات/الحالات الحدّية)، ثم اختم بالناتج النهائي في سطر مستقل بصيغة **الإجابة:** $…$ — لا تقدّم أبدًا إجابةً غير مُتحقَّقٍ منها أو مُخمَّنة. وفي البرمجة سلّم كودًا احترافيًا كاملًا قابلًا للتشغيل بلا اختصار أو مواضع ناقصة، مع تواقيع الأنواع والتحقّق من المدخلات ومعالجة الحالات الحدّية والأخطاء وكل ما يلزم لتشغيله."
        : "You are in the most powerful mode, 'Max'. Think deeply and rigorously INTERNALLY (decompose, weigh trade-offs, self-verify before answering), but match the RESPONSE LENGTH to the question: concise for simple ones, deep only for genuinely complex ones — never pad. You are a MATHEMATICIAN at IMO / Putnam / JEE-Advanced level: treat every quantitative problem as a hard competition problem — name the key theorem/technique, reason in careful rigorous steps, perform every algebraic and arithmetic manipulation EXACTLY, give EXACT closed-form results (fractions, radicals, π, e — not rounded decimals unless asked), and lay proofs out cleanly (Given / To show / Proof ∎). VERIFY the result by a SECOND method before answering (differentiate an integral back, substitute values, sanity-check limits/units/edge cases), then end with the final result on its own line as **Answer:** $…$ — never present an unverified or guessed answer. For PROGRAMMING, deliver production-grade, idiomatic, fully runnable code — no stubs, placeholders, or '…rest unchanged' — with type signatures, input validation, correct edge-case/error handling, and the imports/setup needed to run it. Deliver the highest-quality, most precise answer by the shortest sound path.";
      requestMessages = [requestMessages[0], { role: "system", content: maxSys }, ...requestMessages.slice(1)];
    }
    const rtModel = MODELS[requestTier] || tier;

    // Max is now FREE & UNLIMITED for everyone — no daily cap, no pre-check.
    let maxCid = "";

    let response;
    if (CONFIG.BACKEND_URL) {
      response = await fetch(CONFIG.BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestMessages, tier: requestTier, think: aiMsg.think && !!(rtModel && rtModel.showThinking), cid: maxCid || undefined }),
        credentials: "same-origin",
        signal,
      });
    } else {
      response = await fetch(TRANSPORT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: rtModel.transport,
          messages: requestMessages,
          stream: true,
          reasoning_effort: rtModel.reasoning_effort,
          temperature: rtModel.temperature,
          max_tokens: rtModel.max_tokens,
        }),
        signal,
      });
    }

    // Server-side cap hit (race: another tab used the last slot) → friendly notice.
    if (response.status === 429 && requestTier === "max") {
      clearTimeout(timeoutId);
      finalized = true;
      const j = await response.json().catch(() => ({}));
      aiMsg.content = maxLimitText(replyLang, Object.assign({ ok: false, reason: "limit" }, j));
      aiMsg.reasoning = "";
      finalizeAi(aiMsg, chat);
      return;
    }
    if (!response.ok || !response.body) throw new Error("HTTP " + response.status);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // SSE read loop — incremental, non-blocking.
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep partial line across chunk boundaries

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") { buffer = ""; break; }
        try {
          const json = JSON.parse(data);
          const delta = json.choices && json.choices[0] && json.choices[0].delta;
          if (!delta) continue;
          if (delta.content) answer += delta.content;
          if (delta.reasoning) reasoning += delta.reasoning;
          scheduleRender();
        } catch (_) { /* ignore malformed keep-alive lines */ }
      }
    }

    clearTimeout(timeoutId);

    // A reply with no answer content is a failure — even if the model emitted only
    // "thinking" (reasoning). Fall back instead of persisting a blank Firas turn.
    if (!answer.trim()) throw new Error("empty stream");

    // ENGINE-BUSY AUTO-RETRY: if the ENTIRE reply is one of the backend's engine-error sentences
    // (all rescue engines momentarily failed), retry ONCE automatically after a short pause —
    // the user should never have to press "try again" for a transient hiccup.
    const busyRe = /^(The Firas AI (?:vision )?engine is (?:busy|unavailable|offline)[\s\S]{0,80}?|Something went wrong with the Firas AI engine\.) ?(Please )?[Tt]ry again\.?\s*(shortly\.?)?\s*$/;
    if (busyRe.test(answer.trim()) && !aiMsg._busyRetry && !signal.aborted) {
      aiMsg._busyRetry = true;
      retryBusy = true;
      finalized = true;
      const node = liveNode(); const mdEl = node && node.querySelector(".msg-ai__body .md");
      if (mdEl) mdEl.innerHTML = '<p style="opacity:.6">' + (replyLang === "ar" ? "يُعيد المحاولة تلقائيًا…" : "Retrying automatically…") + "</p>";
      throw new Error("busy-retry");   // skip finalize; handled after cleanup
    }

    // Finalize
    finalized = true;
    if (codeReq) {
      // Persist as a code block: ```firas-code {meta}\n<code>\n``` → renders the
      // finished code card (copy/download/preview) and survives reload.
      let code = sanitizeContinuation(stripCodeFences(answer));
      const renderCode = (merged, status) => {
        const node = liveNode(); const mdEl = node && node.querySelector(".msg-ai__body .md");
        if (!mdEl) return;
        renderLiveCodeInto(mdEl, merged, codeReq, replyLang);
        const w = mdEl.querySelector(".code-card__writing");
        if (w && status) w.textContent = status;
        mdEl.classList.remove("stream-caret");
      };
      // 1) AUTO-COMPLETE: if the model was cut off, keep continuing internally until
      // the file is whole — so ONE request yields a large COMPLETE file (no clicks).
      if (!signal.aborted && !codeLooksComplete(code, codeReq.lang)) {
        code = await autoCompleteCode(code, codeReq, convo, replyLang, signal,
          (m) => renderCode(m, replyLang === "ar" ? "يُكمل تلقائيًا…" : "Auto-completing…"));
      }
      // 2) DEVELOP: once a sizeable HTML site is complete, add an advanced JS layer so
      // it's genuinely interactive — still ONE complete file at the end.
      if (codeReq.lang === "html" && !signal.aborted && code.length > 6000 && codeLooksComplete(code, "html")) {
        code = await enhanceCodeInteractivity(code, codeReq, replyLang, signal,
          (m) => renderCode(m, replyLang === "ar" ? "يطوّر التفاعلية والجافاسكربت…" : "Enhancing interactivity…"));
      }
      const meta = { filename: codeReq.filename, lang: codeReq.lang, ext: codeReq.ext, label: codeReq.label };
      aiMsg.content = "```firas-code " + JSON.stringify(meta) + "\n" + code + "\n```";
    } else {
      aiMsg.content = answer;
    }
    aiMsg.reasoning = reasoning;
    finalizeAi(aiMsg, chat);
  } catch (err) {
    clearTimeout(timeoutId);
    finalized = true;
    if (retryBusy) { /* transient engine-busy — retried below after cleanup; no error UI */ }
    else {
    const aborted = signal.aborted && controller.reason !== "timeout";
    if (aborted) {
      const hasCode = codeReq && (answer || "").trim();
      if (!hasCode && !(answer || "").trim() && !(reasoning || "").trim()) {
        // Stopped before anything streamed — drop the empty placeholder entirely
        // rather than persisting/rendering a blank Firas turn.
        const i = chat.messages.indexOf(aiMsg);
        if (i >= 0) chat.messages.splice(i, 1);
        if (activeChat() === chat) renderThread(chat);
        persistChat(chat);
      } else {
        // Keep whatever streamed so far. For code, preserve the firas-code wrapper
        // so the partial result still renders as a code card (and survives reload).
        if (hasCode) {
          const meta = { filename: codeReq.filename, lang: codeReq.lang, ext: codeReq.ext, label: codeReq.label };
          aiMsg.content = "```firas-code " + JSON.stringify(meta) + "\n" + stripCodeFences(answer) + "\n```";
        } else {
          aiMsg.content = answer || "";
        }
        aiMsg.reasoning = reasoning;
        finalizeAi(aiMsg, chat);
      }
    } else if (sawHidden || document.hidden || navigator.onLine === false) {
      // INTERRUPTED by backgrounding / a connectivity drop — NOT a real error. Drop the partial
      // turn and queue a seamless auto-resume for when the app is foreground + online again, so
      // the user never sees a "retry" button: they can leave the app and come back to it finishing.
      const i = chat.messages.indexOf(aiMsg);
      if (i >= 0) chat.messages.splice(i, 1);
      chat._resume = { tier: aiMsg.tier, lang: aiMsg.lang };
      resumeQueue.add(chat);
      if (activeChat() === chat) renderThread(chat);
      flushResumeQueue();                         // already back? resume immediately
    } else {
      // A genuine failure (server error / offline while foreground): serve fallback + Retry.
      const fb = offlineFallback(convo, aiMsg.lang);
      aiMsg.content = fb;
      aiMsg.reasoning = reasoning;
      aiMsg.offline = true;
      finalizeAi(aiMsg, chat);
      const liveNode = activeChat() === chat ? aiNode : null;
      if (liveNode && liveNode.isConnected) showInlineError(liveNode, convo, aiMsg);
    }
    }
  } finally {
    document.removeEventListener("visibilitychange", onVis);
    activeStreams.delete(chatId);
    endStreaming(chatId);
  }
  // Transient "engine busy" — one silent retry after a short pause (cleanup above already ran,
  // so the fresh streamAnswer call re-registers its own stream cleanly).
  if (retryBusy) {
    await new Promise((r) => setTimeout(r, 1800));
    if (!chat.messages.includes(aiMsg)) return;   // user deleted/edited meanwhile
    return streamAnswer(aiMsg, aiNode, chat, convoOverride);
  }
}

/** Finalize a streamed reply for `chat` (the chat it belongs to — NOT necessarily
    the active view). Always updates the model + persists; only touches the DOM
    when this chat is currently on screen, and re-renders the live node if needed
    (e.g. the user returned to this chat while it was still streaming headless). */
function finalizeAi(aiMsg, chat) {
  const idx = chat && Array.isArray(chat.messages) ? chat.messages.indexOf(aiMsg) : -1;

  // Persist first (independent of the view) so the result is saved even if the
  // user navigated away. Don't store the offline fallback as a genuine turn.
  if (chat) {
    chat.updatedAt = Date.now();
    if (!aiMsg.offline) persistChat(chat);
  }
  renderHistory(); // reflect updatedAt ordering in the sidebar

  // DOM work only when this chat is the active view.
  if (activeChat() !== chat || idx < 0) return;

  let aiNode = els.thread.querySelector(`.msg-ai[data-index="${idx}"]`);
  // If the node isn't present (user returned mid-stream and the thread was rebuilt
  // without it, or indices shifted), re-render the whole thread to recover.
  if (!aiNode) { renderThread(chat); aiNode = els.thread.querySelector(`.msg-ai[data-index="${idx}"]`); }
  if (!aiNode) return;

  const imgMeta = parseImageMeta(aiMsg.content);
  const codeMeta = !imgMeta ? parseCodeMeta(aiMsg.content) : null;
  const fileFmt = !imgMeta && !codeMeta && aiMsg.content && aiMsg.content.trim() ? isFileStreamReply(aiMsg, chat) : null;
  const mdEl = aiNode.querySelector(".msg-ai__body .md");
  if (mdEl) {
    mdEl.classList.remove("stream-caret");
    if (imgMeta) {
      mdEl.innerHTML = "";
      mdEl.appendChild(buildImageCard(imgMeta, aiMsg.lang || state.lang)); // generated image
    } else if (codeMeta) {
      // Code deliverable → swap the live streaming window for the finished card
      // (copy/download/preview), keeping the same code text.
      mdEl.innerHTML = "";
      mdEl.appendChild(buildCodeCard(codeMeta, aiMsg.lang || state.lang));
    } else if (fileFmt) {
      // File reply: don't fill the chat with raw content. Show only a collapsed
      // "view content" disclosure; the file card below carries the deliverable.
      mdEl.innerHTML = "";
      mdEl.appendChild(buildFileDisclosure(aiMsg.content || ""));
    } else {
      mdEl.innerHTML = renderMarkdown(aiMsg.content || "");
      decorateMarkdown(mdEl);
      decorateFirasAsk(mdEl, aiMsg); // Plan-mode interactive choice lists (finalize only)
      typesetMath(mdEl);
    }
  }

  // Append the downloadable file card if this reply answered a file request and
  // is a real reply. The placeholder turn was built empty (no card yet). Structured blocks
  // (firas-ask/agent/deck/project) are NEVER file-cards — without this exclusion a plan-mode
  // clarifying-questions turn after a "…pdf" request got a stray card that exported raw JSON
  // (the static render path already excludes them; this mirrors it for the streaming path).
  if (!imgMeta && !codeMeta && !/^\s*```firas-(?!file)/.test(aiMsg.content || "") && !aiNode.querySelector(".file-card") &&
      aiMsg.content && aiMsg.content.trim() && !aiMsg.offline) {
    const fmt = requestedFormatForAssistant(chat, idx);
    if (fmt) {
      const card = fileCardEl(aiMsg, fmt);
      if (card) {
        const actions = aiNode.querySelector(".msg-actions");
        if (actions) aiNode.insertBefore(card, actions);
        else aiNode.appendChild(card);
      }
    }
  }
  // Plan-mode "Start" quick-action (live finalize) — one-tap approval pill.
  if (!aiNode.querySelector(".plan-start") && shouldShowPlanStart(aiMsg)) {
    const pill = planStartEl(aiMsg);
    const actions = aiNode.querySelector(".msg-actions");
    if (actions) aiNode.insertBefore(pill, actions);
    else aiNode.appendChild(pill);
  }
  if (autoScroll) requestAnimationFrame(scrollToBottom);
}

/** Inline error notice with a Retry button (answer already shows fallback). */
function showInlineError(aiNode, convo, aiMsg) {
  if (aiNode.querySelector(".msg-error")) return;
  const err = document.createElement("div");
  err.className = "msg-error";
  err.innerHTML = `${ICONS.alert}<span>${escapeHtml(t().errorTitle)}</span>`;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = t().retry;
  retry.addEventListener("click", () => {
    const chat = activeChat();
    if (!chat || !Array.isArray(chat.messages)) return;
    const idx = chat.messages.indexOf(aiMsg);
    if (idx > -1) regenerate(idx, aiMsg.tier);
  });
  err.appendChild(retry);
  aiNode.querySelector(".msg-ai__body").after(err);
}

/** A built-in smart offline reply so users are never stuck. */
function offlineFallback(convo, lang) {
  const lastUser = [...convo].reverse().find((m) => m.role === "user");
  const q = lastUser ? lastUser.content.trim() : "";
  if (lang === "ar") {
    return (
      "تعذّر الوصول إلى الخدمة الآن، لكنني ما زلت هنا. " +
      (q ? `بخصوص سؤالك: «${q.slice(0, 120)}» — ` : "") +
      "حاول إعادة المحاولة بعد قليل، أو تحقّق من اتصالك بالإنترنت. " +
      "يمكنك أيضًا تبسيط السؤال أو تقسيمه إلى أجزاء أصغر للحصول على إجابة أدق."
    );
  }
  return (
    "I couldn't reach the service just now, but I'm still here. " +
    (q ? `Regarding your question: “${q.slice(0, 120)}” — ` : "") +
    "Please try again in a moment, or check your internet connection. " +
    "You can also simplify the question or split it into smaller parts for a sharper answer."
  );
}

/* ----------------------------------------------------------------------------
   Send / regenerate / stop orchestration
---------------------------------------------------------------------------- */
/** Is the currently-active chat the one that's streaming? */
function activeChatIsStreaming() {
  const chat = activeChat();
  return !!(chat && activeStreams.has(chat.id));
}

/** Sync `state.streaming` + the composer Send/Stop button to whether the ACTIVE
    chat is streaming. Called when a stream starts/ends and on chat navigation, so
    the Stop button only reflects the chat you're looking at. */
function syncStreamingUi() {
  const streaming = activeChatIsStreaming();
  state.streaming = streaming;
  if (streaming) {
    els.sendBtn.disabled = false;
    els.sendBtn.classList.add("is-stop");
    els.sendBtn.setAttribute("aria-label", t().stop);
    els.live.textContent = t().streaming;
  } else {
    els.sendBtn.classList.remove("is-stop");
    els.sendBtn.setAttribute("aria-label", t().send);
    els.live.textContent = "";
    updateSendState();
  }
}
function beginStreaming(chatId) {
  activeStreams.set(chatId, activeStreams.get(chatId) || {});
  syncStreamingUi();
}
function endStreaming(chatId) {
  activeStreams.delete(chatId);
  syncStreamingUi();
}
/** Stop ONLY the active chat's stream (the explicit Stop button). Other chats'
    in-flight streams keep running and save to their own chats. */
function stopStreaming() {
  const chat = activeChat();
  if (!chat) return;
  const s = activeStreams.get(chat.id);
  if (s && s.controller) { try { s.controller.abort(); } catch (_) {} }
}

async function sendMessage() {
  const text = els.input.value.trim();
  const ready = pendingImages.filter((p) => !p.loading && p.full);
  const readyFiles = pendingFiles.filter((p) => !p.loading && p.text);
  // Block only when the ACTIVE chat is already streaming (a different chat may be
  // streaming in the background — that's fine and must not be interrupted).
  if ((!text && !ready.length && !readyFiles.length) || activeChatIsStreaming() || readingImages > 0) return;

  const lang = detectLang(text || "");
  const attachLabel = ready.length ? (lang === "ar" ? "صورة" : "Image")
    : (readyFiles.length ? readyFiles[0].name : (lang === "ar" ? "صورة" : "Image"));
  const chat = ensureActiveChat(text || attachLabel);

  // SENDING here = full focus here: stop any stream still running in OTHER chats (e.g. code
  // generation left behind after switching). Their partial output is kept (the abort path
  // preserves what streamed); the engine then serves only the new conversation.
  for (const [cid, s] of activeStreams) {
    if (cid !== chat.id && s && s.controller) { try { s.controller.abort(); } catch (_) {} }
  }

  // Push user message (images: full raw b64 for the live request only;
  // imageThumbs: small data-URLs kept for rendering + lean persistence).
  const userMsg = { role: "user", content: text, lang, tier: state.tier };
  if (ready.length) {
    userMsg.images = ready.map((p) => p.full.b64);          // RAW base64, no prefix
    userMsg.imageThumbs = ready.map((p) => p.thumb);         // small data-URLs
    lastImagesByChat.set(chat.id, { images: userMsg.images.slice(), thumbs: userMsg.imageThumbs.slice() });
  } else if (text && refersToPriorImage(text)) {
    // Follow-up about the earlier image → silently re-attach it for the request (no thumb,
    // so it isn't shown again) so the model "goes back to" the image without re-sending.
    const memo = lastImagesByChat.get(chat.id);
    if (memo && memo.images && memo.images.length) userMsg.images = memo.images.slice();
  }
  if (readyFiles.length) {
    // fileText = the attached content sent to the model (this request only, like raw
    // images); files = lightweight {name,kind} chips kept for rendering + persistence.
    userMsg.fileText = "The user attached the following file(s) — read them carefully and use them to answer.\n\n" +
      readyFiles.map((f) => "===== FILE: " + f.name + " =====\n" + f.text + "\n===== END FILE: " + f.name + " =====").join("\n\n");
    userMsg.files = readyFiles.map((f) => ({ name: f.name, kind: f.kind }));
  }
  chat.messages.push(userMsg);
  chat.updatedAt = Date.now();
  if (chat.messages.filter((m) => m.role === "user").length === 1) {
    chat.title = titleFrom(text || attachLabel);        // instant fallback title
    autoTitleChat(chat, text || attachLabel);           // upgrade to a smart AI title, concurrently
  }

  // Reset composer + clear attachment tray
  els.input.value = "";
  clearPendingImages();
  autoGrow(); updateSendState();
  els.sendBtn.classList.add("send-pulse");
  setTimeout(() => els.sendBtn.classList.remove("send-pulse"), 440);

  // Shell language follows the user's latest message
  if (lang !== state.lang) applyShellLang(lang);

  renderHistory(); // reflect the new/updated chat in the sidebar immediately
  // Create the chat on the server on its first user message (gets a serverId).
  if (!chat.serverId) persistChat(chat);
  await runAssistant(chat, state.tier, lang);
}

/** Append an assistant placeholder for `chat` and stream into it. The stream is
    tied to `chat` (not the active view) so navigating away won't stop it. */
async function runAssistant(chat, tier, replyLang, convoOverride) {
  // Firas Agent chats run the AGENT pipeline (plan → execute → verify → deliver).
  if (chat.agent) return runAgentAssistant(chat, "max", replyLang);   // the Agent ALWAYS runs on Max — no tier choice
  const aiMsg = { role: "assistant", content: "", reasoning: "", tier, lang: replyLang, mode: state.mode };
  chat.messages.push(aiMsg);

  autoScroll = true; // a new turn always follows to the bottom
  renderThread(chat, true); // includes the new (empty) AI turn

  const aiNode = els.thread.querySelector(`.msg-ai[data-index="${chat.messages.length - 1}"]`);

  beginStreaming(chat.id);
  await streamAnswer(aiMsg, aiNode, chat, convoOverride);
  learnMemory(chat); // learn durable facts about the user from this exchange (fire-and-forget)
}

/** After a turn, extract durable facts about the user from the last exchange so
    Firas remembers them in future chats. Fire-and-forget; the server does the
    extraction + per-user storage and gates on auth. */
function learnMemory(chat) {
  try {
    const msgs = (chat && chat.messages) || [];
    let aiText = "", userText = "";
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (!aiText && msgs[i].role === "assistant") aiText = String(msgs[i].content || "");
      else if (!userText && msgs[i].role === "user") { userText = String(msgs[i].content || ""); break; }
    }
    if (!userText.trim()) return;
    fetch("/api/memory/learn", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: userText.slice(0, 4000), assistant: aiText.slice(0, 2000) }),
    }).catch(() => {});
  } catch (_) {}
}

/** Modal showing what Firas has learned about the user (view + delete + clear). */
async function openMemoryViewer() {
  const ar = state.lang === "ar";
  let facts = [];
  try { const d = await apiJson("/api/memory"); facts = (d && d.memory) || []; } catch (_) { facts = []; }
  const ov = document.createElement("div");
  ov.className = "mem-overlay";
  const close = () => { ov.classList.remove("is-open"); setTimeout(() => ov.remove(), 200); };
  const body = facts.length
    ? '<ul class="mem-list">' + facts.map((_, i) =>
        '<li class="mem-item"><span></span><button class="mem-del" data-i="' + i + '" aria-label="' + (ar ? "حذف" : "delete") + '">&times;</button></li>').join("") + '</ul>'
    : '<div class="mem-empty">' + (ar ? "ما حفظت معلومات عنك بعد — كل ما نتحدّث، أتعلّم وأتذكّر أكثر." : "Nothing saved about you yet — I learn and remember more as we chat.") + '</div>';
  ov.innerHTML =
    '<div class="mem-card" role="dialog" aria-modal="true">' +
      '<div class="mem-head"><div style="flex:1">' +
        '<h3>' + (ar ? "ما يتذكّره فراس عنك" : "What Firas remembers about you") + '</h3>' +
        '<p>' + (ar ? "أستخدمها لتخصيص ردودي. خاصة بك وحدك." : "Used to personalize my replies. Private to you.") + '</p></div>' +
        '<button class="mem-x" aria-label="' + (ar ? "إغلاق" : "close") + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
      '</div>' + body +
      '<div class="mem-foot"><small>' + facts.length + (ar ? " معلومة" : (facts.length === 1 ? " item" : " items")) + '</small>' +
        (facts.length ? '<button class="mem-clear">' + (ar ? "مسح الكل" : "Clear all") + '</button>' : '') +
      '</div></div>';
  ov.querySelectorAll(".mem-item span").forEach((s, i) => { s.textContent = facts[i]; }); // XSS-safe
  document.body.appendChild(ov);
  setTimeout(() => ov.classList.add("is-open"), 20); // setTimeout (not rAF) so it shows even if the tab is backgrounded
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".mem-x").addEventListener("click", close);
  const clearBtn = ov.querySelector(".mem-clear");
  if (clearBtn) clearBtn.addEventListener("click", async () => {
    try { await api("/api/memory", { method: "DELETE" }); } catch (_) {}
    close();
  });
  ov.querySelectorAll(".mem-del").forEach((b) => b.addEventListener("click", async () => {
    try { await api("/api/memory?i=" + b.getAttribute("data-i"), { method: "DELETE" }); } catch (_) {}
    close(); openMemoryViewer();
  }));
}

/* ----------------------------------------------------------------------------
   Site updates / notifications. The owner (admin) publishes updates (text +
   image); every user sees them on every device (stored server-side / Firebase).
---------------------------------------------------------------------------- */
const LS_ANN_SEEN = "firas_ann_seen";
let annCache = [];
let annIsAdmin = false;

async function fetchAnnouncements() {
  try {
    const d = await apiJson("/api/announcements");
    annCache = (d && Array.isArray(d.announcements)) ? d.announcements : [];
    annIsAdmin = !!(d && d.admin);
  } catch (_) { annCache = []; annIsAdmin = false; }
  updateNotifyBadge();
}
function annLastSeen() { const n = parseInt(localStorage.getItem(LS_ANN_SEEN) || "0", 10); return isNaN(n) ? 0 : n; }
function updateNotifyBadge() {
  if (!els.notifyBadge) return;
  const seen = annLastSeen();
  const unread = annCache.filter((a) => (a.ts || 0) > seen).length;
  els.notifyBadge.textContent = "";            // it's a green DOT now (styled in CSS), not a count
  els.notifyBadge.hidden = unread === 0;
}
const annImgOk = (s) => typeof s === "string" && /^(data:image\/(png|jpe?g|webp);base64,|https?:\/\/)/.test(s);
// Downscale a picked image to a small JPEG data URL so it stores/syncs cheaply.
function fileToSmallDataURL(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error("not an image"));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      const m = maxDim || 1280;
      if (w > m || h > m) { const r = Math.min(m / w, m / h); w = Math.round(w * r); h = Math.round(h * r); }
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      try { resolve(c.toDataURL("image/jpeg", quality || 0.82)); } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load failed")); };
    img.src = url;
  });
}
function annDate(ts, ar) {
  try { return new Date(ts).toLocaleDateString(ar ? "ar" : "en", { year: "numeric", month: "short", day: "numeric" }); }
  catch (_) { return ""; }
}
// Date AND time (the user wants the publish moment shown on every update).
function annDateTime(ts, ar) {
  try {
    const d = new Date(ts);
    const loc = ar ? "ar" : "en";
    return d.toLocaleDateString(loc, { year: "numeric", month: "short", day: "numeric" }) + " · " +
           d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  } catch (_) { return ""; }
}
const annSafeId = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, "");
// Body-scroll lock so opening a panel/reader scrolls ITS content, not the whole page behind it.
let _annScrollLock = 0;
function lockBodyScroll() { if (_annScrollLock++ === 0) document.body.style.overflow = "hidden"; }
function unlockBodyScroll() { if (_annScrollLock > 0 && --_annScrollLock === 0) document.body.style.overflow = ""; }
const ANN_SVG_X = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const ANN_SVG_EDIT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ANN_SVG_TRASH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
/** Admin reference library (RAG): upload books → the model silently grounds answers in them. */
async function openKbManager() {
  const ar = state.lang === "ar";
  const tx = ar
    ? { title: "المكتبة المرجعية", sub: "ارفع كتباً/مراجع — النموذج يستفيد منها تلقائياً (بصمت) لتقوية الإجابات.", titleP: "اسم الكتاب/المرجع (اختياري)", pick: "اختر ملف PDF أو نصّي", uploading: "جارٍ المعالجة والتخزين…", chunks: "مقطع", empty: "لا توجد كتب بعد — ارفع أول مرجع.", err: "تعذّر — حاول مجدداً", notAdmin: "للأدمن فقط", added: (t, n) => "تمت إضافة «" + t + "» (" + n + " مقطع) ✓" }
    : { title: "Reference library", sub: "Upload books/material — the model silently grounds answers in them.", titleP: "Book/source name (optional)", pick: "Choose a PDF or text file", uploading: "Processing & storing…", chunks: "chunks", empty: "No books yet — upload your first reference.", err: "Failed — try again", notAdmin: "Admins only", added: (t, n) => 'Added “' + t + '” (' + n + " chunks) ✓" };
  const ov = document.createElement("div");
  ov.className = "mem-overlay";
  const close = () => { ov.classList.remove("is-open"); setTimeout(() => ov.remove(), 200); };
  ov.innerHTML =
    '<div class="mem-card" role="dialog" aria-modal="true" style="max-width:560px">' +
      '<div class="mem-head"><div style="flex:1"><h3>📚 ' + tx.title + '</h3><p>' + tx.sub + '</p></div>' +
        '<button class="mem-x" aria-label="close">' + ANN_SVG_X + '</button></div>' +
      '<div style="display:flex;flex-direction:column;gap:9px;margin:0 0 14px">' +
        '<input class="ann-in kb-title" type="text" maxlength="200" placeholder="' + tx.titleP + '">' +
        '<label class="ann-img-btn" style="text-align:center;cursor:pointer">' + tx.pick + '<input type="file" accept=".pdf,.txt,.md,.markdown,.csv,.tex,.html,.htm,text/plain,text/markdown,text/csv,text/html,application/pdf" class="kb-file" hidden></label>' +
        '<span class="kb-status" style="font-size:13px;line-height:1.6;color:#A9A69D;min-height:18px"></span>' +
      '</div>' +
      '<ul class="mem-list kb-list"></ul>' +
    '</div>';
  document.body.appendChild(ov);
  setTimeout(() => ov.classList.add("is-open"), 20);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".mem-x").addEventListener("click", close);

  const statusEl = ov.querySelector(".kb-status");
  const listEl = ov.querySelector(".kb-list");
  const titleEl = ov.querySelector(".kb-title");
  const fileEl = ov.querySelector(".kb-file");

  const renderList = async () => {
    try {
      const d = await apiJson("/api/kb");
      const books = (d && d.books) || [];
      listEl.innerHTML = books.length
        ? books.map((b) => '<li class="mem-item" style="display:flex;align-items:center;gap:8px"><span style="flex:1">' +
            "<b>" + escapeHtml(b.title) + "</b> <small style=\"color:#A9A69D\">(" + (b.chunks || 0) + " " + tx.chunks + ")</small></span>" +
            '<button class="mem-del" data-id="' + escapeHtml(b.id) + '" aria-label="delete">&times;</button></li>').join("")
        : '<li class="mem-empty">' + tx.empty + "</li>";
      listEl.querySelectorAll(".mem-del").forEach((btn) => btn.addEventListener("click", async () => {
        try { await apiJson("/api/kb?id=" + encodeURIComponent(btn.getAttribute("data-id")), { method: "DELETE" }); renderList(); } catch (_) {}
      }));
    } catch (e) { listEl.innerHTML = '<li class="mem-empty">' + (e && e.status === 403 ? tx.notAdmin : tx.err) + "</li>"; }
  };
  renderList();

  fileEl.addEventListener("change", async () => {
    const f = fileEl.files && fileEl.files[0];
    if (!f) return;
    const arUi = state.lang === "ar";
    fileEl.disabled = true;                       // no double-submits while a big book processes
    statusEl.textContent = tx.uploading;
    try {
      let text;
      if (/\.pdf$/i.test(f.name)) {
        text = await extractPdfTextForKb(f, (i, n) => { statusEl.textContent = arUi ? ("يستخرج الصفحة " + i + "/" + n + "…") : ("Extracting page " + i + "/" + n + "…"); });
      } else if (/\.html?$/i.test(f.name)) {
        const div = document.createElement("div"); div.innerHTML = await f.text(); text = div.textContent || "";
      } else {
        text = await f.text();                    // .md / .txt / .csv / .tex … accepted as-is
      }
      const title = titleEl.value.trim() || f.name.replace(/\.[^.]+$/, "");
      // ANY-size support: split into parts and upload sequentially — each part is its own KB
      // entry ("Book — part i/N"), safely under the backend chunk cap + edge body limit.
      const parts = splitKbText(text);
      let totalChunks = 0;
      for (let i = 0; i < parts.length; i++) {
        if (parts.length > 1) statusEl.textContent = arUi ? ("يرفع الجزء " + (i + 1) + "/" + parts.length + "…") : ("Uploading part " + (i + 1) + "/" + parts.length + "…");
        const partTitle = parts.length > 1 ? (title + " — " + (i + 1) + "/" + parts.length) : title;
        try {
          const r = await apiJson("/api/kb", { method: "POST", body: JSON.stringify({ title: partTitle, text: parts[i] }) });
          totalChunks += (r && r.chunks) || 0;
        } catch (e) {
          statusEl.textContent = (e && e.status === 403) ? tx.notAdmin
            : (arUi ? ("توقّف عند الجزء " + (i + 1) + "/" + parts.length + " — المرفوع قبله محفوظ؛ أعد المحاولة.") : ("Stopped at part " + (i + 1) + "/" + parts.length + " — earlier parts saved; retry."));
          fileEl.disabled = false; renderList(); return;
        }
      }
      statusEl.textContent = tx.added(title, totalChunks) + (parts.length > 1 ? (arUi ? " (" + parts.length + " أجزاء)" : " (" + parts.length + " parts)") : "");
      titleEl.value = ""; fileEl.value = "";
      renderList();
    } catch (e) { statusEl.textContent = (e && e.status === 403) ? tx.notAdmin : tx.err; }
    fileEl.disabled = false;
  });
}

async function openAnnouncementsPanel() {
  const ar = state.lang === "ar";
  await fetchAnnouncements();
  // Opening = read everything → clear the badge.
  const newest = annCache.reduce((mx, a) => Math.max(mx, a.ts || 0), 0);
  if (newest) localStorage.setItem(LS_ANN_SEEN, String(newest));
  updateNotifyBadge();

  const ov = document.createElement("div");
  ov.className = "mem-overlay ann-overlay";
  let onKey = null;
  const close = () => { if (onKey) document.removeEventListener("keydown", onKey); unlockBodyScroll(); ov.classList.remove("is-open"); setTimeout(() => ov.remove(), 200); };
  const refresh = () => { close(); openAnnouncementsPanel(); };

  const adminForm = annIsAdmin ? (
    '<form class="ann-form">' +
      '<input class="ann-in ann-title" type="text" maxlength="200" placeholder="' + (ar ? "عنوان التحديث" : "Update title") + '">' +
      '<textarea class="ann-in ann-body" rows="3" maxlength="4000" placeholder="' + (ar ? "نص التحديث…" : "What’s new…") + '"></textarea>' +
      '<div class="ann-form-row">' +
        '<label class="ann-img-btn">' + (ar ? "إضافة صورة" : "Add image") + '<input type="file" accept="image/*" class="ann-file" hidden></label>' +
        '<span class="ann-img-name"></span>' +
        '<button type="submit" class="ann-post">' + (ar ? "نشر" : "Publish") + '</button>' +
      '</div>' +
      '<img class="ann-img-preview" hidden alt="">' +
    '</form>'
  ) : "";

  const items = annCache.length ? annCache.map((a) =>
    '<li class="ann-item" data-id="' + annSafeId(a.id) + '" role="button" tabindex="0">' +
      (annImgOk(a.image) ? '<img class="ann-item-thumb" alt="" loading="lazy">' : '') +
      '<div class="ann-item-main">' +
        '<h4 class="ann-item-title"></h4>' +
        '<p class="ann-item-body"></p>' +
        '<time class="ann-item-date"></time>' +
      '</div>' +
      '<span class="ann-item-go" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></span>' +
    '</li>'
  ).join("") : '<li class="mem-empty">' + (ar ? "لا توجد تحديثات بعد." : "No updates yet.") + '</li>';

  ov.innerHTML =
    '<div class="mem-card ann-card" role="dialog" aria-modal="true">' +
      '<div class="mem-head"><div style="flex:1">' +
        '<h3>' + (ar ? "تحديثات Firas AI" : "Firas AI updates") + '</h3>' +
        '<p>' + (ar ? "آخر أخبار وتحديثات المنصّة." : "Latest platform news & updates.") + '</p></div>' +
        '<button class="mem-x" aria-label="' + (ar ? "إغلاق" : "close") + '">' + ANN_SVG_X + '</button>' +
      '</div>' +
      adminForm +
      (annIsAdmin ? '<button type="button" class="ann-post ann-kb-open" style="width:100%;margin:0 0 12px">📚 ' + (ar ? "المكتبة المرجعية" : "Reference library") + '</button>' : '') +
      '<ul class="mem-list ann-list">' + items + '</ul>' +
    '</div>';

  // XSS-safe: inject text + validated image src via the DOM, and wire each row to open the reader.
  ov.querySelectorAll(".ann-item").forEach((li) => {
    const a = annCache.find((x) => annSafeId(x.id) === li.getAttribute("data-id"));
    if (!a) return;
    const tEl = li.querySelector(".ann-item-title"); if (tEl) tEl.textContent = a.title || (ar ? "تحديث" : "Update");
    const bEl = li.querySelector(".ann-item-body"); if (bEl) bEl.textContent = a.body || "";
    const dEl = li.querySelector(".ann-item-date"); if (dEl) dEl.textContent = annDateTime(a.ts, ar);
    const iEl = li.querySelector(".ann-item-thumb"); if (iEl && annImgOk(a.image)) iEl.src = a.image;
    const open = () => openAnnouncementReader(a, refresh);
    li.addEventListener("click", open);
    li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });

  document.body.appendChild(ov);
  lockBodyScroll();
  setTimeout(() => ov.classList.add("is-open"), 20);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".mem-x").addEventListener("click", close);
  onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);

  const kbBtn = ov.querySelector(".ann-kb-open");
  if (kbBtn) kbBtn.addEventListener("click", () => { close(); openKbManager(); });

  if (annIsAdmin) {
    let pendingImg = "";
    const fileInput = ov.querySelector(".ann-file");
    const imgName = ov.querySelector(".ann-img-name");
    const preview = ov.querySelector(".ann-img-preview");
    if (fileInput) fileInput.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try { pendingImg = await fileToSmallDataURL(f, 1280, 0.82); if (preview) { preview.src = pendingImg; preview.hidden = false; } if (imgName) imgName.textContent = f.name; }
      catch (_) { showToast(ar ? "تعذّر تحميل الصورة" : "Couldn't load image"); }
    });
    const form = ov.querySelector(".ann-form");
    if (form) form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = ov.querySelector(".ann-title").value.trim();
      const bodyTxt = ov.querySelector(".ann-body").value.trim();
      if (!title && !bodyTxt && !pendingImg) { showToast(ar ? "اكتب شيئاً أولاً" : "Add some content first"); return; }
      const btn = ov.querySelector(".ann-post"); if (btn) { btn.disabled = true; btn.textContent = ar ? "يُنشر…" : "Publishing…"; }
      try {
        await apiJson("/api/announcements", { method: "POST", body: JSON.stringify({ title, body: bodyTxt, image: pendingImg }) });
        showToast(ar ? "تم النشر ✓" : "Published ✓");
        refresh();
      } catch (_) { showToast(ar ? "فشل النشر" : "Publish failed"); if (btn) { btn.disabled = false; btn.textContent = ar ? "نشر" : "Publish"; } }
    });
  }
}

/* A single update opened FULL-SCREEN: image (tap to zoom), full text (own scroll),
   an AR/EN AI-translation toggle, and admin edit/delete. */
function openAnnouncementReader(a, onChange) {
  const ar = state.lang === "ar";
  const ov = document.createElement("div");
  ov.className = "mem-overlay ann-reader-overlay";
  let onKey = null;
  const close = () => { if (onKey) document.removeEventListener("keydown", onKey); unlockBodyScroll(); ov.classList.remove("is-open"); setTimeout(() => ov.remove(), 200); };
  a._tr = a._tr || {};
  let curLang = null;

  ov.innerHTML =
    '<div class="ann-reader" role="dialog" aria-modal="true">' +
      '<div class="ann-reader-bar">' +
        '<div class="ann-langs">' +
          '<button class="ann-lang is-on" data-l="orig">' + (ar ? "الأصل" : "Original") + '</button>' +
          '<button class="ann-lang" data-l="ar">عربي</button>' +
          '<button class="ann-lang" data-l="en">EN</button>' +
        '</div>' +
        '<div class="ann-reader-actions">' +
          (annIsAdmin ? '<button class="ann-icon-btn ann-reader-edit" aria-label="' + (ar ? "تعديل" : "Edit") + '" title="' + (ar ? "تعديل" : "Edit") + '">' + ANN_SVG_EDIT + '</button>' +
                        '<button class="ann-icon-btn ann-reader-del" aria-label="' + (ar ? "حذف" : "Delete") + '" title="' + (ar ? "حذف" : "Delete") + '">' + ANN_SVG_TRASH + '</button>' : '') +
          '<button class="ann-icon-btn ann-reader-x" aria-label="' + (ar ? "إغلاق" : "close") + '">' + ANN_SVG_X + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="ann-reader-body">' +
        (annImgOk(a.image) ? '<img class="ann-reader-img" alt="">' : '') +
        '<h2 class="ann-reader-title"></h2>' +
        '<time class="ann-reader-date"></time>' +
        '<div class="ann-reader-text" dir="auto"></div>' +
      '</div>' +
    '</div>';

  const titleEl = ov.querySelector(".ann-reader-title");
  const textEl = ov.querySelector(".ann-reader-text");
  const imgEl = ov.querySelector(".ann-reader-img");
  ov.querySelector(".ann-reader-date").textContent = annDateTime(a.ts, ar) + (a.editedTs ? (ar ? " · مُعدّل" : " · edited") : "");
  if (imgEl && annImgOk(a.image)) { imgEl.src = a.image; imgEl.style.cursor = "zoom-in"; imgEl.addEventListener("click", () => openImageLightbox(a.image)); }

  const render = (lang) => {
    const src = (lang && a._tr[lang]) ? a._tr[lang] : a;
    titleEl.textContent = src.title || (ar ? "تحديث" : "Update");
    titleEl.hidden = !src.title;
    textEl.textContent = src.body || "";
  };
  render(null);

  const langBtns = [...ov.querySelectorAll(".ann-lang")];
  const setActive = (l) => langBtns.forEach((b) => b.classList.toggle("is-on", b.dataset.l === l));
  langBtns.forEach((b) => b.addEventListener("click", async () => {
    const l = b.dataset.l;
    if (l === "orig") { curLang = null; setActive("orig"); render(null); return; }
    setActive(l); curLang = l;
    if (a._tr[l]) { render(l); return; }
    const old = b.textContent; b.disabled = true; b.textContent = "…";
    // Hard client-side timeout so the button NEVER stays stuck on "…" if the engine stalls.
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 28000);
    try {
      const d = await apiJson("/api/translate", { method: "POST", body: JSON.stringify({ title: a.title || "", body: a.body || "", to: l }), signal: ac.signal });
      a._tr[l] = { title: d.title || a.title || "", body: d.body || a.body || "" };
      if (curLang === l) render(l);
    } catch (_) { showToast(ar ? "تعذّرت الترجمة، حاول مجدداً" : "Translation failed, please try again"); setActive(curLang === l ? l : "orig"); }
    finally { clearTimeout(to); b.disabled = false; b.textContent = old; }
  }));

  document.body.appendChild(ov);
  lockBodyScroll();
  setTimeout(() => ov.classList.add("is-open"), 20);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".ann-reader-x").addEventListener("click", close);
  onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);

  if (annIsAdmin) {
    const delBtn = ov.querySelector(".ann-reader-del");
    if (delBtn) delBtn.addEventListener("click", async () => {
      if (!window.confirm(ar ? "حذف هذا التحديث؟" : "Delete this update?")) return;
      try { await apiJson("/api/announcements?id=" + encodeURIComponent(annSafeId(a.id)), { method: "DELETE" }); showToast(ar ? "تم الحذف" : "Deleted"); close(); onChange && onChange(); }
      catch (_) { showToast(ar ? "فشل الحذف" : "Delete failed"); }
    });
    const editBtn = ov.querySelector(".ann-reader-edit");
    if (editBtn) editBtn.addEventListener("click", () => openAnnouncementEditor(a, () => { close(); onChange && onChange(); }));
  }
}

/* Admin: edit an update's text, replace/remove its image. */
function openAnnouncementEditor(a, onDone) {
  const ar = state.lang === "ar";
  const ov = document.createElement("div");
  ov.className = "mem-overlay ann-edit-overlay";
  let onKey = null;
  const close = () => { if (onKey) document.removeEventListener("keydown", onKey); unlockBodyScroll(); ov.classList.remove("is-open"); setTimeout(() => ov.remove(), 200); };
  ov.innerHTML =
    '<div class="mem-card ann-edit-card" role="dialog" aria-modal="true">' +
      '<div class="mem-head"><div style="flex:1"><h3>' + (ar ? "تعديل التحديث" : "Edit update") + '</h3></div>' +
        '<button class="mem-x" aria-label="' + (ar ? "إغلاق" : "close") + '">' + ANN_SVG_X + '</button></div>' +
      '<form class="ann-form ann-edit-form">' +
        '<input class="ann-in ann-title" type="text" maxlength="200" placeholder="' + (ar ? "عنوان التحديث" : "Update title") + '">' +
        '<textarea class="ann-in ann-body" rows="5" maxlength="4000" placeholder="' + (ar ? "نص التحديث…" : "What’s new…") + '"></textarea>' +
        '<div class="ann-form-row">' +
          '<label class="ann-img-btn">' + (ar ? "تغيير الصورة" : "Replace image") + '<input type="file" accept="image/*" class="ann-file" hidden></label>' +
          '<button type="button" class="ann-img-remove"' + (annImgOk(a.image) ? '' : ' hidden') + '>' + (ar ? "حذف الصورة" : "Remove image") + '</button>' +
          '<button type="submit" class="ann-post">' + (ar ? "حفظ" : "Save") + '</button>' +
        '</div>' +
        '<img class="ann-img-preview"' + (annImgOk(a.image) ? '' : ' hidden') + ' alt="">' +
      '</form>' +
    '</div>';
  ov.querySelector(".ann-title").value = a.title || "";
  ov.querySelector(".ann-body").value = a.body || "";
  const preview = ov.querySelector(".ann-img-preview");
  if (annImgOk(a.image)) preview.src = a.image;
  let newImage; // undefined = unchanged · "" = remove · dataURL = replace

  ov.querySelector(".ann-file").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { newImage = await fileToSmallDataURL(f, 1280, 0.82); preview.src = newImage; preview.hidden = false; ov.querySelector(".ann-img-remove").hidden = false; }
    catch (_) { showToast(ar ? "تعذّر تحميل الصورة" : "Couldn't load image"); }
  });
  ov.querySelector(".ann-img-remove").addEventListener("click", () => { newImage = ""; preview.hidden = true; ov.querySelector(".ann-img-remove").hidden = true; });

  ov.querySelector(".ann-edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = ov.querySelector(".ann-title").value.trim();
    const body = ov.querySelector(".ann-body").value.trim();
    const btn = ov.querySelector(".ann-post"); btn.disabled = true; const lbl = btn.textContent; btn.textContent = ar ? "يُحفظ…" : "Saving…";
    const payload = { id: annSafeId(a.id), title, body };
    if (newImage !== undefined) payload.image = newImage;
    try { await apiJson("/api/announcements", { method: "PATCH", body: JSON.stringify(payload) }); showToast(ar ? "تم الحفظ ✓" : "Saved ✓"); close(); onDone && onDone(); }
    catch (_) { showToast(ar ? "فشل الحفظ" : "Save failed"); btn.disabled = false; btn.textContent = lbl; }
  });

  document.body.appendChild(ov);
  lockBodyScroll();
  setTimeout(() => ov.classList.add("is-open"), 20);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".mem-x").addEventListener("click", close);
  onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
}

/* ----------------------------------------------------------------------------
   Account settings panel (account · change email · change password · delete)
---------------------------------------------------------------------------- */
function openSettingsPanel() {
  const ar = state.lang === "ar";
  const u = state.user || {};
  const ov = document.createElement("div");
  ov.className = "mem-overlay settings-overlay";
  let onKey = null;
  const close = () => { if (onKey) document.removeEventListener("keydown", onKey); ov.classList.remove("is-open"); setTimeout(() => ov.remove(), 200); };

  const tx = ar ? {
    title: "الإعدادات", sub: "إدارة حسابك وأمانه", account: "الحساب",
    appearanceH: "المظهر", themeLight: "نهاري", themeDark: "ليلي",
    chEmailH: "تغيير البريد الإلكتروني", newEmail: "البريد الجديد", curPw: "كلمة المرور الحالية", saveEmail: "حفظ البريد",
    chPwH: "تغيير كلمة المرور", newPw: "كلمة المرور الجديدة", newPwHint: "٨ أحرف على الأقل", savePw: "حفظ كلمة المرور",
    dangerH: "منطقة الخطر", dangerP: "حذف الحساب يمسح جميع محادثاتك نهائياً ولا يمكن التراجع عنه.",
    delBtn: "حذف حسابي", delConfirmP: "للتأكيد، أدخل كلمة مرورك ثم اضغط «حذف نهائي».", cancel: "إلغاء", delFinal: "حذف نهائي",
    okEmail: "تم تحديث البريد ✓", okPw: "تم تغيير كلمة المرور ✓", deleted: "تم حذف حسابك", working: "جارٍ…",
    errPw: "كلمة المرور غير صحيحة", errEmailTaken: "هذا البريد مستخدم بالفعل", errEmailInvalid: "أدخل بريداً صالحاً", errPwShort: "كلمة المرور 8 أحرف على الأقل", errGeneric: "حدث خطأ، حاول مجدداً",
  } : {
    title: "Settings", sub: "Manage your account & security", account: "Account",
    appearanceH: "Appearance", themeLight: "Light", themeDark: "Dark",
    chEmailH: "Change email", newEmail: "New email", curPw: "Current password", saveEmail: "Save email",
    chPwH: "Change password", newPw: "New password", newPwHint: "at least 8 characters", savePw: "Save password",
    dangerH: "Danger zone", dangerP: "Deleting your account erases all your conversations permanently. This can't be undone.",
    delBtn: "Delete my account", delConfirmP: "To confirm, enter your password then tap “Delete permanently”.", cancel: "Cancel", delFinal: "Delete permanently",
    okEmail: "Email updated ✓", okPw: "Password changed ✓", deleted: "Your account was deleted", working: "Working…",
    errPw: "Incorrect password", errEmailTaken: "That email is already in use", errEmailInvalid: "Enter a valid email", errPwShort: "Password must be at least 8 characters", errGeneric: "Something went wrong, please try again",
  };
  // Server returns Arabic strings; in English mode map by status so the panel stays English.
  const errMsg = (er, kind) => {
    if (ar) return (er && er.message) || tx.errGeneric;
    const s = er && er.status;
    if (s === 403) return tx.errPw;
    if (s === 409) return tx.errEmailTaken;
    if (s === 400) return kind === "email" ? tx.errEmailInvalid : tx.errPwShort;
    return tx.errGeneric;
  };
  const ICO = {
    sun: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    alert: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
  };
  // A present-but-hidden username field gives the browser somewhere to bind the saved email so
  // it stops bleeding it into the conversation search box.
  const hiddenUser = '<input class="set-hidden-user" type="text" autocomplete="username" tabindex="-1" aria-hidden="true" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;border:0;opacity:0;pointer-events:none;">';
  const field = (label, input, hint) => '<label class="set-field"><span class="set-lbl">' + label + (hint ? ' <span class="set-lbl-hint">· ' + hint + '</span>' : '') + '</span>' + input + '</label>';

  ov.innerHTML =
    '<div class="mem-card settings-card" role="dialog" aria-modal="true">' +
      '<div class="mem-head"><div style="flex:1">' +
        '<h3>' + tx.title + '</h3><p>' + tx.sub + '</p></div>' +
        '<button class="mem-x" aria-label="' + (ar ? "إغلاق" : "close") + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
      '</div>' +
      '<div class="set-body">' +
        '<section class="set-hero">' +
          '<span class="set-avatar"></span>' +
          '<div class="set-hero-info"><span class="set-hero-eyebrow">' + tx.account + '</span><strong class="set-acct-name"></strong><span class="set-acct-email" dir="ltr"></span></div>' +
        '</section>' +
        '<section class="set-card set-appearance">' +
          '<div class="set-card-h"><span class="set-ico set-theme-ico">' + (state.theme === "dark" ? ICO.moon : ICO.sun) + '</span>' + tx.appearanceH + '</div>' +
          '<div class="set-theme-seg" role="radiogroup" aria-label="' + tx.appearanceH + '">' +
            '<button type="button" class="set-theme-opt" data-theme-opt="light" role="radio">' + ICO.sun + '<span>' + tx.themeLight + '</span></button>' +
            '<button type="button" class="set-theme-opt" data-theme-opt="dark" role="radio">' + ICO.moon + '<span>' + tx.themeDark + '</span></button>' +
          '</div>' +
        '</section>' +
        '<form class="set-card set-email-form" novalidate autocomplete="off">' +
          '<div class="set-card-h"><span class="set-ico">' + ICO.mail + '</span>' + tx.chEmailH + '</div>' +
          hiddenUser +
          field(tx.newEmail, '<input class="set-in set-new-email" type="email" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false">') +
          field(tx.curPw, '<input class="set-in set-email-pw" type="password" dir="ltr" autocomplete="off">') +
          '<div class="set-err" hidden></div>' +
          '<button type="submit" class="set-save">' + tx.saveEmail + '</button>' +
        '</form>' +
        '<form class="set-card set-pass-form" novalidate autocomplete="off">' +
          '<div class="set-card-h"><span class="set-ico">' + ICO.lock + '</span>' + tx.chPwH + '</div>' +
          hiddenUser +
          field(tx.curPw, '<input class="set-in set-cur-pw" type="password" dir="ltr" autocomplete="off">') +
          field(tx.newPw, '<input class="set-in set-new-pw" type="password" dir="ltr" autocomplete="new-password">', tx.newPwHint) +
          '<div class="set-err" hidden></div>' +
          '<button type="submit" class="set-save">' + tx.savePw + '</button>' +
        '</form>' +
        '<section class="set-card set-danger">' +
          '<div class="set-card-h set-danger-h"><span class="set-ico">' + ICO.alert + '</span>' + tx.dangerH + '</div>' +
          '<p class="set-danger-note">' + tx.dangerP + '</p>' +
          '<button type="button" class="set-del-btn">' + tx.delBtn + '</button>' +
          '<div class="set-del-confirm" hidden>' +
            '<p class="set-danger-note">' + tx.delConfirmP + '</p>' +
            '<input class="set-in set-del-pw" type="password" dir="ltr" autocomplete="off" placeholder="' + tx.curPw + '">' +
            '<div class="set-err set-del-err" hidden></div>' +
            '<div class="set-del-row">' +
              '<button type="button" class="set-del-cancel">' + tx.cancel + '</button>' +
              '<button type="button" class="set-del-final">' + tx.delFinal + '</button>' +
            '</div>' +
          '</div>' +
        '</section>' +
      '</div>' +
    '</div>';

  // identity (textContent / .value — XSS-safe)
  const name = (u.name && String(u.name).trim()) || (u.email ? String(u.email).split("@")[0] : "Firas");
  ov.querySelector(".set-avatar").textContent = (name.charAt(0) || "F").toUpperCase();
  ov.querySelector(".set-acct-name").textContent = name;
  ov.querySelector(".set-acct-email").textContent = u.email || "";
  ov.querySelectorAll(".set-hidden-user").forEach((i) => { i.value = u.email || ""; });

  const showErr = (el, msg) => { if (el) { el.textContent = msg; el.hidden = false; } };
  const clrErr = (el) => { if (el) el.hidden = true; };

  document.body.appendChild(ov);
  setTimeout(() => ov.classList.add("is-open"), 20);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".mem-x").addEventListener("click", close);
  onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);

  // — appearance (light / dark) — applies instantly, persists via applyTheme
  const themeSeg = ov.querySelector(".set-theme-seg");
  const syncThemeSeg = () => {
    themeSeg.querySelectorAll(".set-theme-opt").forEach((b) => {
      const on = b.getAttribute("data-theme-opt") === state.theme;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
    const ico = ov.querySelector(".set-theme-ico");
    if (ico) ico.innerHTML = state.theme === "dark" ? ICO.moon : ICO.sun;
  };
  themeSeg.addEventListener("click", (e) => {
    const b = e.target.closest(".set-theme-opt");
    if (!b) return;
    applyTheme(b.getAttribute("data-theme-opt") === "dark" ? "dark" : "light");
    syncThemeSeg();
  });
  syncThemeSeg();

  // — change email —
  const emailForm = ov.querySelector(".set-email-form");
  emailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = emailForm.querySelector(".set-err"); clrErr(err);
    const email = emailForm.querySelector(".set-new-email").value.trim().toLowerCase();
    const current = emailForm.querySelector(".set-email-pw").value;
    if (!email) { showErr(err, ar ? "أدخل البريد الجديد" : "Enter the new email"); return; }
    const btn = emailForm.querySelector(".set-save"); const lbl = btn.textContent;
    btn.disabled = true; btn.textContent = tx.working;
    try {
      const d = await apiJson("/api/auth/change-email", { method: "POST", body: JSON.stringify({ email, current }) });
      if (d && d.user) { state.user = Object.assign({}, state.user, d.user); applyUserIdentity(); ov.querySelector(".set-acct-email").textContent = d.user.email || email; }
      emailForm.reset(); showToast(tx.okEmail);
    } catch (er) { showErr(err, errMsg(er, "email")); }
    finally { btn.disabled = false; btn.textContent = lbl; }
  });

  // — change password —
  const passForm = ov.querySelector(".set-pass-form");
  passForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = passForm.querySelector(".set-err"); clrErr(err);
    const current = passForm.querySelector(".set-cur-pw").value;
    const password = passForm.querySelector(".set-new-pw").value;
    if (password.length < 8) { showErr(err, ar ? "كلمة المرور 8 أحرف على الأقل" : "Password must be 8+ characters"); return; }
    const btn = passForm.querySelector(".set-save"); const lbl = btn.textContent;
    btn.disabled = true; btn.textContent = tx.working;
    try {
      await apiJson("/api/auth/change-password", { method: "POST", body: JSON.stringify({ current, password }) });
      passForm.reset(); showToast(tx.okPw);
    } catch (er) { showErr(err, errMsg(er, "pw")); }
    finally { btn.disabled = false; btn.textContent = lbl; }
  });

  // — delete account (two-step, irreversible) —
  const delBtn = ov.querySelector(".set-del-btn");
  const delBox = ov.querySelector(".set-del-confirm");
  delBtn.addEventListener("click", () => { delBox.hidden = false; delBtn.hidden = true; });
  ov.querySelector(".set-del-cancel").addEventListener("click", () => { delBox.hidden = true; delBtn.hidden = false; });
  ov.querySelector(".set-del-final").addEventListener("click", async () => {
    const err = ov.querySelector(".set-del-err"); clrErr(err);
    const current = ov.querySelector(".set-del-pw").value;
    const fb = ov.querySelector(".set-del-final"); const lbl = fb.textContent;
    fb.disabled = true; fb.textContent = tx.working;
    try {
      await apiJson("/api/auth/delete-account", { method: "POST", body: JSON.stringify({ current }) });
      try { if (authChannel) authChannel.postMessage({ type: "logout" }); } catch (_) {}
      showToast(tx.deleted);
      setTimeout(() => { try { location.reload(); } catch (_) {} }, 700);
    } catch (er) { showErr(err, errMsg(er, "pw")); fb.disabled = false; fb.textContent = lbl; }
  });
}

/**
 * Regenerate the assistant message at `index` (optionally with a different
 * tier — used by the Ultra upsell). Truncates everything after the preceding
 * user message and re-answers.
 */
async function regenerate(index, tier) {
  if (activeChatIsStreaming()) return;
  const chat = activeChat();
  if (!chat) return;
  const target = chat.messages[index];
  if (!target || target.role !== "assistant") return;

  // Generate a FRESH answer appended BELOW (the original answer stays). We re-answer the
  // prompting user message WITHOUT showing the old answer to the model — and reuse any image
  // that message carried (so regenerating an image turn works without re-sending).
  const promptConvo = chat.messages.slice(0, index); // ends at the prompting user message
  const lastUser = [...promptConvo].reverse().find((m) => m.role === "user");
  const replyLang = lastUser ? (lastUser.lang || detectLang(lastUser.content)) : state.lang;
  await runAssistant(chat, tier || target.tier || state.tier, replyLang, promptConvo);
}

/* ----------------------------------------------------------------------------
   Mobile drawer
---------------------------------------------------------------------------- */
let lastFocused = null;
function openDrawer() {
  els.sidebar.classList.add("is-open");
  els.scrim.classList.add("is-open");
  els.drawerOpen.setAttribute("aria-expanded", "true");
  lastFocused = document.activeElement;
  els.drawerClose && els.drawerClose.focus();
  document.addEventListener("keydown", trapFocus);
}
function closeDrawer() {
  els.sidebar.classList.remove("is-open");
  els.scrim.classList.remove("is-open");
  els.drawerOpen.setAttribute("aria-expanded", "false");
  document.removeEventListener("keydown", trapFocus);
  if (lastFocused) lastFocused.focus();
}
function trapFocus(e) {
  if (e.key === "Escape") { closeDrawer(); return; }
  if (e.key !== "Tab") return;
  const focusables = els.sidebar.querySelectorAll(
    'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ----------------------------------------------------------------------------
   Auth — gate the app behind sign up / log in (session cookie)
---------------------------------------------------------------------------- */
let authMode = "login"; // "login" | "signup"
const authEls = {};

function cacheAuthEls() {
  authEls.screen = $("#authScreen");
  authEls.form = $("#authForm");
  authEls.title = $("#authTitle");
  authEls.subtitle = $("#authSubtitle");
  authEls.nameField = $("#authNameField");
  authEls.name = $("#authName");
  authEls.email = $("#authEmail");
  authEls.password = $("#authPassword");
  authEls.error = $("#authError");
  authEls.submit = $("#authSubmit");
  authEls.switchText = $("#authSwitchText");
  authEls.switchBtn = $("#authSwitchBtn");
  authEls.google = $("#authGoogle");
  authEls.googleLabel = $("#authGoogleLabel");
  authEls.divider = $("#authDivider");
  authEls.dividerText = $("#authDividerText");
  authEls.forgot = $("#authForgot");
  authEls.note = $("#authNote");
  authEls.emailField = authEls.email ? authEls.email.closest(".auth__field") : null;
  authEls.passwordField = authEls.password ? authEls.password.closest(".auth__field") : null;
  authEls.passwordLabel = authEls.password ? authEls.password.closest(".auth__field").querySelector(".auth__label") : null;
  authEls.switchRow = $(".auth__switch");
  authEls.codeField = $("#authCodeField");
  authEls.code = $("#authCode");
  authEls.codeLabel = $("#authCodeLabel");
  authEls.resend = $("#authResend");
  authEls.back = $("#authBack");
}

function renderAuthCopy() {
  const isReset = authMode === "reset";
  const isSignup = authMode === "signup";
  if (authEls.note) authEls.note.hidden = true;

  // VERIFY MODE: after signup, a passive "open the link in your email" screen. No code or
  // submit — the account is created when the emailed BUTTON is opened (on any device), and
  // this device finishes automatically via polling.
  if (authMode === "verify") {
    authEls.title.textContent = t().authVerifyTitle;
    authEls.subtitle.textContent = (t().authVerifySubtitle || "") + (_verifyEmail ? " " + _verifyEmail : "");
    authEls.nameField.hidden = true; authEls.name.required = false;
    if (authEls.emailField) authEls.emailField.hidden = true; authEls.email.required = false;
    if (authEls.passwordField) authEls.passwordField.hidden = true; authEls.password.required = false;
    if (authEls.codeField) authEls.codeField.hidden = true;
    authEls.submit.hidden = true;                    // passive screen — nothing to submit
    if (authEls.google) authEls.google.hidden = true;
    if (authEls.divider) authEls.divider.hidden = true;
    if (authEls.forgot) authEls.forgot.hidden = true;
    if (authEls.resend) { authEls.resend.hidden = false; authEls.resend.textContent = t().authResend; }
    if (authEls.back) { authEls.back.hidden = false; authEls.back.textContent = t().authBack; }
    if (authEls.switchRow) authEls.switchRow.hidden = true;
    showAuthNote(t().authVerifyWaiting);             // "waiting for you to open the link…"
    return;
  }
  if (authEls.submit) authEls.submit.hidden = false; // restore for other modes

  // RESET MODE: a stripped card with only a "new password" field (local-account flow,
  // reached via the emailed ?reset=…&uid=… link). Firebase accounts use Firebase's own
  // reset page, so this only runs for the app's own scrypt accounts.
  if (isReset) {
    authEls.title.textContent = t().authResetTitle;
    authEls.subtitle.textContent = t().authResetSubtitle;
    authEls.submit.textContent = t().authResetBtn;
    authEls.nameField.hidden = true; authEls.name.required = false;
    if (authEls.emailField) authEls.emailField.hidden = true;
    authEls.email.required = false;
    if (authEls.passwordField) authEls.passwordField.hidden = false;
    if (authEls.passwordLabel) authEls.passwordLabel.textContent = t().authNewPassword;
    authEls.password.required = true;
    authEls.password.setAttribute("autocomplete", "new-password");
    if (authEls.codeField) authEls.codeField.hidden = true;
    if (authEls.google) authEls.google.hidden = true;
    if (authEls.divider) authEls.divider.hidden = true;
    if (authEls.forgot) authEls.forgot.hidden = true;
    if (authEls.resend) authEls.resend.hidden = true;
    if (authEls.back) { authEls.back.hidden = false; authEls.back.textContent = t().authBack; }
    if (authEls.switchRow) authEls.switchRow.hidden = true;
    return;
  }

  // Normal login/signup (restore anything reset-mode hid).
  authEls.title.textContent = isSignup ? t().authSignupTitle : t().authLoginTitle;
  authEls.subtitle.textContent = isSignup ? t().authSignupSubtitle : t().authLoginSubtitle;
  authEls.submit.textContent = isSignup ? t().authSignupBtn : t().authLoginBtn;
  authEls.switchText.textContent = isSignup ? t().authToLogin : t().authToSignup;
  authEls.switchBtn.textContent = isSignup ? t().authToLoginBtn : t().authToSignupBtn;
  if (authEls.googleLabel) authEls.googleLabel.textContent = t().authGoogle;
  if (authEls.dividerText) authEls.dividerText.textContent = t().authOr;
  authEls.nameField.hidden = !isSignup;
  authEls.name.required = isSignup;
  if (authEls.emailField) authEls.emailField.hidden = false;
  authEls.email.required = true;
  if (authEls.passwordField) authEls.passwordField.hidden = false;
  authEls.password.required = true;
  if (authEls.passwordLabel) authEls.passwordLabel.textContent = t().authPassword;
  authEls.password.setAttribute("autocomplete", isSignup ? "new-password" : "current-password");
  if (authEls.codeField) authEls.codeField.hidden = true;
  if (authEls.resend) authEls.resend.hidden = true;
  if (authEls.back) authEls.back.hidden = true;
  if (authEls.switchRow) authEls.switchRow.hidden = false;
  if (authEls.forgot) { authEls.forgot.textContent = t().authForgot; authEls.forgot.hidden = isSignup; }
  // localize standalone labels
  document.querySelectorAll("#authScreen [data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (t()[k]) el.textContent = t()[k];
  });
}

function setAuthMode(mode) {
  authMode = mode;
  if (mode !== "verify") stopVerifyPolling();
  hideAuthError();
  renderAuthCopy();
}

function showAuthError(msg) {
  authEls.error.textContent = msg;
  authEls.error.hidden = false;
  if (authEls.note) authEls.note.hidden = true;
}
function hideAuthError() {
  authEls.error.hidden = true;
  authEls.error.textContent = "";
}
function showAuthNote(msg) {
  if (!authEls.note) return;
  hideAuthError();
  authEls.note.textContent = msg;
  authEls.note.hidden = false;
}

let _resetToken = "", _resetUid = "", _verifyEmail = "", _verifyPid = "", _verifyPoll = null;

/** Poll the server: once the emailed link is opened on ANY device, sign THIS device in
    too (cross-device completion). */
function startVerifyPolling() {
  stopVerifyPolling();
  if (!_verifyPid) return;
  _verifyPoll = setInterval(async () => {
    if (authMode !== "verify" || !_verifyPid) { stopVerifyPolling(); return; }
    try {
      const d = await apiJson("/api/auth/verify-status", { method: "POST", body: JSON.stringify({ pid: _verifyPid }) });
      if (d && d.verified && d.user) { stopVerifyPolling(); _verifyPid = ""; _verifyEmail = ""; await bootApp(d.user); }
    } catch (_) { /* keep polling */ }
  }, 3000);
}
function stopVerifyPolling() { if (_verifyPoll) { clearInterval(_verifyPoll); _verifyPoll = null; } }

/** Re-send a fresh verification LINK for the pending email. */
async function handleResendCode() {
  if (!_verifyEmail || (authEls.resend && authEls.resend.disabled)) return;
  const btn = authEls.resend;
  if (btn) btn.disabled = true;
  try {
    await apiJson("/api/auth/resend-code", { method: "POST", body: JSON.stringify({ email: _verifyEmail }) });
    showToast(t().authResendOk);            // unmistakable confirmation
    showAuthNote(t().authCodeResent);
    // visible 30s countdown so it's clear the button is throttled (not broken)
    if (btn) {
      let n = 30;
      const tick = () => {
        if (authMode !== "verify") { btn.textContent = t().authResend; btn.disabled = false; return; }
        if (n <= 0) { btn.disabled = false; btn.textContent = t().authResend; return; }
        const d = (typeof toArabicDigits === "function" && state.lang === "ar") ? toArabicDigits(n) : n;
        btn.textContent = t().authResend + " (" + d + ")";
        n -= 1;
        setTimeout(tick, 1000);
      };
      tick();
    }
  } catch (err) {
    showToast((err && err.status === 429) ? t().authResendWait : ((err && err.message) || t().authResendWait));
    if (btn) setTimeout(() => { btn.disabled = false; }, 5000);
  }
}

/** Clicking-device path: the page was opened via the email verify link (?verify=token).
    Create/confirm the account and sign in. Returns true if a verify link was handled. */
async function checkVerifyLink() {
  let token = "";
  try { token = new URLSearchParams(location.search).get("verify") || ""; } catch (_) {}
  if (!token) return false;
  try { history.replaceState(null, "", location.pathname); } catch (_) {}
  showAuthScreen(); setAuthMode("login");
  try {
    const d = await apiJson("/api/auth/verify-signup", { method: "POST", body: JSON.stringify({ token }) });
    const user = (d && d.user) || d;
    if (user) { await bootApp(user); return true; }
  } catch (err) {
    const st = err && err.status;
    if (st === 409) showAuthNote(state.lang === "ar" ? "حسابك مُفعّل بالفعل — سجّل الدخول." : "Your account is already active — please sign in.");
    else if (st === 429) showAuthError(state.lang === "ar" ? "محاولات كثيرة — انتظر دقيقة ثم افتح الرابط مجدداً." : "Too many attempts — wait a minute and reopen the link.");
    else showAuthError(t().authVerifyBad);
    return true;
  }
  showAuthError(t().authVerifyBad);
  return true;
}

/** "Forgot password?" → send a reset email. Firebase accounts use Firebase's built-in
    sendPasswordResetEmail (free); otherwise the app's own /api/auth/forgot. */
async function handleForgotPassword() {
  hideAuthError();
  const email = authEls.email.value.trim();
  if (!email) { showAuthError(t().authForgotNeedEmail); authEls.email.focus(); return; }
  if (authEls.forgot) authEls.forgot.disabled = true;
  try {
    // ALWAYS the app's own backend (branded email + the in-app reset page that sets the
    // LOCAL password) — NOT Firebase. Email/password is fully local, so resetting via
    // Firebase would change a password the local login never checks.
    await apiJson("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
    showAuthNote(t().authForgotSent);
  } catch (err) {
    showAuthNote(t().authForgotSent); // anti-enumeration: same message regardless
  } finally {
    if (authEls.forgot) authEls.forgot.disabled = false;
  }
}

/** If the page was opened via the app's own reset link (?reset=…&uid=…), switch the
    auth card into reset mode. Returns true if a reset link was detected. */
function checkResetLink() {
  try {
    const p = new URLSearchParams(location.search);
    const token = p.get("reset"), uid = p.get("uid");
    if (!token || !uid) return false;
    _resetToken = token; _resetUid = uid;
    showAuthScreen();
    setAuthMode("reset");
    return true;
  } catch (_) { return false; }
}

const LS_COOKIE = "firas_cookie_consent";
function maybeShowCookieBanner() {
  const b = document.getElementById("cookieBanner");
  if (!b) return;
  let choice = "";
  try { choice = localStorage.getItem(LS_COOKIE) || ""; } catch (_) {}
  b.hidden = !!choice;              // only for visitors who haven't chosen yet
}
function setupCookieConsent() {
  const b = document.getElementById("cookieBanner");
  if (!b) return;
  const save = (v) => { try { localStorage.setItem(LS_COOKIE, v); } catch (_) {} b.hidden = true; };
  const a = document.getElementById("cookieAccept"), r = document.getElementById("cookieReject");
  if (a) a.addEventListener("click", () => save("accepted"));
  if (r) r.addEventListener("click", () => save("rejected"));
}
function showAuthScreen() {
  hideLanding();
  els.appShell.hidden = true;
  authEls.screen.hidden = false;
  renderAuthCopy();
  applyGoogleVisibility();          // show Google button only when configured
  maybeShowCookieBanner();          // cookie consent shows here only (login/signup), until chosen
  setTimeout(() => authEls.email.focus(), 50);
}
function hideAuthScreen() {
  authEls.screen.hidden = true;
  els.appShell.hidden = false;
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  if (authEls.submit.disabled) return;
  hideAuthError();

  // VERIFY MODE is passive (link-based + polling) — nothing to submit here.
  if (authMode === "verify") return;

  // RESET MODE: set a new password using the emailed token (local scrypt accounts).
  if (authMode === "reset") {
    const pw = authEls.password.value;
    if (pw.length < 8) {
      showAuthError(state.lang === "ar" ? "كلمة المرور يجب أن تكون ٨ أحرف على الأقل." : "Password must be at least 8 characters.");
      return;
    }
    authEls.submit.disabled = true; authEls.submit.classList.add("is-loading");
    try {
      await apiJson("/api/auth/reset", { method: "POST", body: JSON.stringify({ uid: _resetUid, token: _resetToken, password: pw }) });
      try { history.replaceState(null, "", location.pathname); } catch (_) {}
      _resetToken = ""; _resetUid = ""; authEls.password.value = "";
      setAuthMode("login");
      showAuthNote(t().authResetDone);
    } catch (err) {
      showAuthError((err && err.data && (err.data.message || err.data.error)) || t().authResetInvalid);
    } finally {
      authEls.submit.disabled = false; authEls.submit.classList.remove("is-loading");
    }
    return;
  }

  const isSignup = authMode === "signup";
  const name = authEls.name.value.trim();
  const email = authEls.email.value.trim();
  const password = authEls.password.value;

  if (!email || !password || (isSignup && !name)) {
    showAuthError(t().authGenericError);
    return;
  }
  // Enforce the stronger (local backend) 8-char minimum up front, in the user's
  // language — so the rule is consistent whether or not Firebase is configured.
  if (isSignup && password.length < 8) {
    showAuthError(state.lang === "ar"
      ? "كلمة المرور يجب أن تكون ٨ أحرف على الأقل."
      : "Password must be at least 8 characters.");
    return;
  }

  authEls.submit.disabled = true;
  authEls.submit.classList.add("is-loading");
  try {
    // Email/password always uses the app's own backend (scrypt + emailed verification
    // code on signup). Firebase is used ONLY for "Continue with Google".
    const path = isSignup ? "/api/auth/signup" : "/api/auth/login";
    const body = isSignup ? { name, email, password } : { email, password };
    const data = await apiJson(path, { method: "POST", body: JSON.stringify(body) });
    if (isSignup && data && data.pending) {
      // Account not created yet — show the "open the link in your email" screen and start
      // polling so this device finishes the moment the link is opened on ANY device.
      _verifyEmail = email;
      _verifyPid = (data && data.pid) || "";
      setAuthMode("verify");
      startVerifyPolling();
      showToast((state.lang === "ar" ? "📧 أرسلنا إيميل التأكيد إلى " : "📧 Verification email sent to ") + email);
      return;
    }
    const user = (data && data.user) || data || { email };
    await bootApp(user);
  } catch (err) {
    const fbMsg = firebaseAuthMessage(err);
    if (fbMsg) showAuthError(fbMsg);
    else if (err && typeof err.status === "number") showAuthError((err.data && (err.data.message || err.data.error)) || err.message || t().authGenericError);
    else showAuthError(t().authNetworkError);
  } finally {
    authEls.submit.disabled = false;
    authEls.submit.classList.remove("is-loading");
  }
}

/** Reflect the signed-in user in the sidebar footer (name escaped via DOM). */
function applyUserIdentity() {
  const u = state.user || {};
  const name = (u.name && String(u.name).trim()) || (u.email ? String(u.email).split("@")[0] : "Firas");
  els.accountName.textContent = name;            // textContent => XSS-safe
  els.accountAvatar.textContent = name.charAt(0).toUpperCase() || "F";
}

// Cross-tab auth sync: when the user logs out in one tab, tear down the others
// too (privacy on shared machines — otherwise they keep showing chat history).
let authChannel = null;
function setupAuthChannel() {
  if (authChannel || typeof BroadcastChannel === "undefined") return;
  try {
    authChannel = new BroadcastChannel("firas-auth");
    authChannel.onmessage = (ev) => {
      if (ev && ev.data && ev.data.type === "logout" && state.user) {
        try { location.reload(); } catch (_) {} // re-boot → /api/auth/me 401 → landing
      }
    };
  } catch (_) { authChannel = null; }
}

async function logout() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch (_) {}
  try { if (authChannel) authChannel.postMessage({ type: "logout" }); } catch (_) {}
  // Clear in-memory account state (device prefs stay).
  state.user = null;
  state.chats = [];
  state.activeId = null;
  state.chatsLoaded = false;
  // Abort ALL in-flight streams (we're tearing down the session).
  activeStreams.forEach((s) => { if (s && s.controller) { try { s.controller.abort(); } catch (_) {} } });
  activeStreams.clear();
  syncStreamingUi();
  els.thread.innerHTML = "";
  showLanding();
}

/** Boot the authenticated app: identity, server chats, welcome. */
async function bootApp(user) {
  state.user = user;
  sessionExpiredHandled = false; // fresh session → re-arm the expiry guard
  applyUserIdentity();
  hideLanding();
  hideAuthScreen();
  state.activeId = null;
  renderWelcome();
  await fetchChats();
  renderAll();
  autoGrow();
  updateSendState();
  els.input.focus();
  fetchAnnouncements(); // populate the updates badge (fire-and-forget)
}

/* ----------------------------------------------------------------------------
   Firebase "Continue with Google" — frontend only.
   - The Google button is shown ONLY when window.FIREBASE_CONFIG is present and
     complete (loaded from an optional firebase-config.js before app.js).
   - The Firebase modular SDK is lazy-loaded (gstatic CDN) on first need: when
     the auth screen is shown, and again on click as a safety net. The initial
     page load stays fast and the app degrades gracefully if the CDN is blocked.
   - On click: signInWithPopup -> getIdToken -> POST /api/auth/firebase { idToken }
     (same-origin) -> bootApp(user). Popup-closed/cancelled is handled quietly.
---------------------------------------------------------------------------- */
const FIREBASE_SDK_VERSION = "10.12.2";
const FIREBASE_CDN = "https://www.gstatic.com/firebasejs/" + FIREBASE_SDK_VERSION;

let _firebaseModules = null;   // { initializeApp, getAuth, GoogleAuthProvider, signInWithPopup }
let _firebaseApp = null;
let _firebaseAuth = null;

/** True only when a complete Firebase web config has been provided. */
function hasFirebaseConfig() {
  const c = window.FIREBASE_CONFIG;
  return !!(c && c.apiKey && c.authDomain && c.projectId);
}

/** Lazy-load the Firebase modular SDK (app + auth) from the gstatic CDN. */
async function loadFirebase() {
  if (_firebaseModules) return _firebaseModules;
  const [appMod, authMod] = await Promise.all([
    import(FIREBASE_CDN + "/firebase-app.js"),
    import(FIREBASE_CDN + "/firebase-auth.js"),
  ]);
  _firebaseModules = {
    initializeApp: appMod.initializeApp,
    getAuth: authMod.getAuth,
    GoogleAuthProvider: authMod.GoogleAuthProvider,
    signInWithPopup: authMod.signInWithPopup,
    signInWithRedirect: authMod.signInWithRedirect,
    getRedirectResult: authMod.getRedirectResult,
    signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
    createUserWithEmailAndPassword: authMod.createUserWithEmailAndPassword,
    updateProfile: authMod.updateProfile,
    sendPasswordResetEmail: authMod.sendPasswordResetEmail,
  };
  return _firebaseModules;
}

/** Map a Firebase email/password error to a localized message. */
function firebaseAuthMessage(err) {
  const code = (err && err.code) || "";
  const ar = state.lang === "ar";
  if (/email-already-in-use/.test(code)) return ar ? "هذا البريد مسجّل مسبقاً — سجّل الدخول بدلاً من ذلك." : "This email is already registered — sign in instead.";
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return ar ? "البريد أو كلمة المرور غير صحيحة." : "Wrong email or password.";
  if (/weak-password/.test(code)) return ar ? "كلمة المرور ضعيفة (٦ أحرف على الأقل)." : "Password too weak (min 6 characters).";
  if (/invalid-email/.test(code)) return ar ? "صيغة البريد غير صحيحة." : "Invalid email format.";
  if (/too-many-requests/.test(code)) return ar ? "محاولات كثيرة — انتظر قليلاً." : "Too many attempts — please wait.";
  return null;
}

/** Initialise the Firebase app + auth instance once (idempotent). */
async function ensureFirebaseAuth() {
  const m = await loadFirebase();
  if (!_firebaseApp) _firebaseApp = m.initializeApp(window.FIREBASE_CONFIG);
  if (!_firebaseAuth) _firebaseAuth = m.getAuth(_firebaseApp);
  return _firebaseAuth;
}

/** Show/hide the Google button + divider based on config presence. */
function applyGoogleVisibility() {
  if (!authEls.google || !authEls.divider) return;
  const on = hasFirebaseConfig();
  authEls.google.hidden = !on;
  authEls.divider.hidden = !on;
  // Warm the SDK + auth instance so the popup opens within the click gesture (less likely blocked).
  if (on) ensureFirebaseAuth().catch(() => {});
}

/** Map a Firebase popup error to a localized, user-friendly message (or null
    to stay silent when the user simply closed/cancelled the popup). */
function googleErrorMessage(err) {
  const code = err && err.code;
  if (code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request" ||
      code === "auth/user-cancelled") {
    return null; // user intentionally dismissed — no error UI
  }
  if (code === "auth/popup-blocked") return t().authGoogleUnavailable;
  return t().authGoogleError;
}

/** Exchange a Firebase sign-in result for our own session (idToken → /api/auth/firebase). */
async function completeFirebaseSignIn(result) {
  const idToken = await result.user.getIdToken();
  const data = await apiJson("/api/auth/firebase", { method: "POST", body: JSON.stringify({ idToken }) });
  const user = (data && data.user) || data || {};
  await bootApp(user);
}
const LS_GOOGLE_REDIRECT = "firas_google_redirect";
async function handleGoogleSignIn() {
  if (!hasFirebaseConfig() || authEls.google.disabled) return;
  hideAuthError();
  authEls.google.disabled = true;
  authEls.google.classList.add("is-loading");
  try {
    const m = await loadFirebase();
    const auth = await ensureFirebaseAuth();
    let result;
    try {
      result = await m.signInWithPopup(auth, new m.GoogleAuthProvider());
    } catch (err) {
      const code = err && err.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/user-cancelled") return; // user dismissed
      // Popup blocked/unsupported (very common on mobile, and when the SDK finished loading
      // after the click) → fall back to a full-page REDIRECT, which browsers never block.
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request" ||
          code === "auth/operation-not-supported-in-this-environment") {
        try { localStorage.setItem(LS_GOOGLE_REDIRECT, "1"); } catch (_) {}
        await m.signInWithRedirect(auth, new m.GoogleAuthProvider());
        return; // page navigates to Google; getRedirectResult() finishes on return
      }
      throw err;
    }
    await completeFirebaseSignIn(result);
  } catch (err) {
    if (err && typeof err.status === "number") {
      showAuthError((err.data && (err.data.message || err.data.error)) || t().authGoogleError);
    } else {
      const msg = googleErrorMessage(err);
      if (msg) showAuthError(msg);
    }
  } finally {
    authEls.google.disabled = false;
    authEls.google.classList.remove("is-loading");
  }
}
/** On load, finish a Google sign-in that used the REDIRECT fallback. */
async function checkGoogleRedirect() {
  if (!hasFirebaseConfig()) return false;
  let pending = false;
  try { pending = localStorage.getItem(LS_GOOGLE_REDIRECT) === "1"; } catch (_) {}
  if (!pending) return false;
  try { localStorage.removeItem(LS_GOOGLE_REDIRECT); } catch (_) {}
  try {
    const m = await loadFirebase();
    const auth = await ensureFirebaseAuth();
    const result = await m.getRedirectResult(auth);
    if (result && result.user) { await completeFirebaseSignIn(result); return true; }
  } catch (err) {
    showAuthScreen();
    const msg = (err && typeof err.status === "number")
      ? ((err.data && (err.data.message || err.data.error)) || t().authGoogleError)
      : googleErrorMessage(err);
    if (msg) showAuthError(msg);
  }
  return false;
}

function wireAuth() {
  cacheAuthEls();
  authEls.form.addEventListener("submit", handleAuthSubmit);
  authEls.switchBtn.addEventListener("click", () => setAuthMode(authMode === "signup" ? "login" : "signup"));
  if (authEls.google) authEls.google.addEventListener("click", handleGoogleSignIn);
  if (authEls.forgot) authEls.forgot.addEventListener("click", handleForgotPassword);
  if (authEls.resend) authEls.resend.addEventListener("click", handleResendCode);
  if (authEls.back) authEls.back.addEventListener("click", () => {
    // Bail out of reset/verify back to a clean sign-in (e.g. you remembered your password).
    _resetToken = ""; _resetUid = ""; _verifyEmail = ""; _verifyPid = "";
    stopVerifyPolling();
    try { history.replaceState(null, "", location.pathname); } catch (_) {}
    if (authEls.password) authEls.password.value = "";
    setAuthMode("login");
  });
}

/* ----------------------------------------------------------------------------
   Init + event wiring
---------------------------------------------------------------------------- */
function cacheEls() {
  els.sidebar = $("#sidebar");
  els.historyList = $("#historyList");
  els.searchInput = $("#searchInput");
  els.tierSwitch = $("#tierSwitch");
  els.modeSwitch = $("#modeSwitch");
  els.themeToggle = $("#themeToggle");
  els.chatScroll = $("#chatScroll");
  els.thread = $("#chatThread");
  els.welcome = $("#welcome");
  els.input = $("#input");
  els.sendBtn = $("#sendBtn");
  els.composer = $("#composer");
  els.attachBtn = $("#attachBtn");
  els.fileInput = $("#fileInput");
  els.attachTray = $("#attachTray");
  els.scrollBottomBtn = $("#scrollBottomBtn");
  els.scrim = $("#scrim");
  els.drawerOpen = $("#drawerOpen");
  els.drawerClose = $("#drawerClose");
  els.live = $("#liveRegion");
  els.thinkToggle = $("#thinkToggle");
  els.searchToggle = $("#searchToggle");
  els.toolsMenu = $("#toolsMenu");
  els.toolsMenuBtn = $("#toolsMenuBtn");
  els.toolsMenuPanel = $("#toolsMenuPanel");
  els.appShell = $("#appShell");
  els.authScreen = $("#authScreen");
  els.accountName = $("#accountName");
  els.accountAvatar = $("#accountAvatar");
  els.logoutBtn = $("#logoutBtn");
  els.settingsBtn = $("#settingsBtn");
  els.notifyBtn = $("#notifyBtn");
  els.notifyBadge = $("#notifyBadge");
}

function wireEvents() {
  // New chat (sidebar + topbar)
  $("#newChatBtn").addEventListener("click", () => { newChat(); closeDrawer(); });
  $("#topbarNewChat").addEventListener("click", newChat);
  const shareBtn = document.getElementById("shareChatBtn");
  if (shareBtn) shareBtn.addEventListener("click", shareActiveChat);
  const prodBtn = document.getElementById("productSwitch");
  if (prodBtn) prodBtn.addEventListener("click", openProductMenu);

  // Theme — the toggle moved into Settings (Appearance card); keep the wiring if a topbar
  // toggle ever returns.
  if (els.themeToggle) els.themeToggle.addEventListener("click", () => applyTheme(state.theme === "light" ? "dark" : "light"));

  // Sidebar collapse (desktop taskbar)
  const sidebarToggle = $("#sidebarToggle");
  if (sidebarToggle) sidebarToggle.addEventListener("click", () => setSidebarCollapsed(!state.sidebarCollapsed));

  // Logo lockups start a new chat instead of jumping to "#".
  ["#sidebarLogo", ".topbar__desktop-mark"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.addEventListener("click", (e) => { e.preventDefault(); newChat(); if (typeof closeDrawer === "function") closeDrawer(); });
  });

  // Landing → auth ("Get Started"); auth logo → back to landing
  const landingStart = $("#landingStart");
  if (landingStart) landingStart.addEventListener("click", () => { showAuthScreen(); });
  const authBackLogo = $("#authBackLogo");
  if (authBackLogo) authBackLogo.addEventListener("click", () => { hideAuthScreen(); showLanding(); });

  // Thinking toggle (device pref)
  els.thinkToggle.addEventListener("click", () => setThink(!state.think));
  if (els.searchToggle) els.searchToggle.addEventListener("click", () => setWebSearch(!state.webSearch));
  if (els.toolsMenuBtn) els.toolsMenuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (els.toolsMenu && els.toolsMenu.classList.contains("is-open")) closeToolsMenu(); else openToolsMenu();
  });

  // Logout
  els.logoutBtn.addEventListener("click", logout);
  if (els.settingsBtn) els.settingsBtn.addEventListener("click", openSettingsPanel);
  // Notifications / site updates
  if (els.notifyBtn) els.notifyBtn.addEventListener("click", openAnnouncementsPanel);

  // Search
  els.searchInput.addEventListener("input", (e) => { state.search = e.target.value; renderHistory(); });

  // Composer
  els.input.addEventListener("input", () => { autoGrow(); syncComposerDir(); updateSendState(); });
  els.input.addEventListener("focus", () => els.composer.classList.add("is-focused"));
  els.input.addEventListener("blur", () => els.composer.classList.remove("is-focused"));
  // Enter inserts a NEWLINE (default textarea behavior) on EVERY device — sending happens ONLY via
  // the send button, per the user's request. Ctrl/Cmd+Enter stays as an optional power-user send.
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.isComposing) {
      e.preventDefault();
      if (!state.streaming) sendMessage();
    }
  });
  els.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.streaming) stopStreaming();
    else sendMessage();
  });

  // Image attachments
  els.attachBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
    e.target.value = ""; // allow re-selecting the same file
  });
  // Paste images directly into the composer
  els.input.addEventListener("paste", (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    const imgs = Array.from(items).filter((it) => it.type.startsWith("image/")).map((it) => it.getAsFile()).filter(Boolean);
    if (imgs.length) { e.preventDefault(); handleFiles(imgs); }
  });

  // Scroll
  els.chatScroll.addEventListener("scroll", onScroll, { passive: true });
  els.scrollBottomBtn.addEventListener("click", () => {
    autoScroll = true;
    // the manual button keeps the smooth glide (programmatic pins are instant)
    els.chatScroll.scrollTo({ top: els.chatScroll.scrollHeight, behavior: "smooth" });
  });

  // Auto-resume any interrupted reply the moment we're foreground + online again (so a task fired
  // before switching apps / losing signal finishes itself on return — no "retry").
  document.addEventListener("visibilitychange", () => { if (!document.hidden) flushResumeQueue(); });
  window.addEventListener("online", flushResumeQueue);
  window.addEventListener("focus", flushResumeQueue);

  // Drawer
  els.drawerOpen.addEventListener("click", openDrawer);
  els.drawerClose.addEventListener("click", closeDrawer);
  els.scrim.addEventListener("click", closeDrawer);

  // Swipe to close drawer (toward inline-start)
  let touchStartX = 0;
  els.sidebar.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  els.sidebar.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const rtl = document.documentElement.dir === "rtl";
    if ((!rtl && dx < -60) || (rtl && dx > 60)) closeDrawer();
  }, { passive: true });
}

/** Auto-reload an open tab when the server's code version changes — so fixes
    always reach the user (no more stale SPA sessions). Only reloads when idle. */
function startVersionWatch() {
  let current = null, pending = false;
  const check = async () => {
    try {
      const r = await fetch("/api/version", { cache: "no-store" });
      if (!r.ok) return;
      const v = (await r.json()).version;
      if (current == null) { current = v; return; }
      if (v && v !== current) pending = true;
      if (pending && (typeof activeStreams === "undefined" || activeStreams.size === 0)) {
        try { showToast(state.lang === "ar" ? "يتم تحديث Firas…" : "Updating Firas…"); } catch (_) {}
        setTimeout(() => location.reload(), 700);
      }
    } catch (_) {}
  };
  check();
  setInterval(check, 15000);
}

/* ════════════════════════════════════════════════════════════════════════════
   FIRAS AGENT — a real agent: PLANS the task, EXECUTES it step by step (with
   web research, math, figures, code), REVIEWS its own work, and DELIVERS the
   result (as a file card when a document was asked for). The whole run lives
   in ONE persisted ```firas-agent block so it re-renders after reload.
   ════════════════════════════════════════════════════════════════════════════ */
/* ── ZIP builder (store method, zero deps) — downloads a multi-file project as a real folder ── */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function buildZip(files) {
  const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0;
  for (const f of files) {
    const name = enc.encode(String(f.path)); const data = enc.encode(String(f.content));
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
    cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, a) => s + a.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}
/* Extract the code from a step output: the LARGEST fenced block (or the raw text when unfenced). */
function stripToCode(out) {
  // Concatenate ALL fenced blocks in order (a step may legitimately emit several — e.g. markup + a
  // separate script); fall back to the raw text only when there are no fences.
  const blocks = [...String(out || "").matchAll(/```[\w-]*\n([\s\S]*?)```/g)].map((m) => m[1].replace(/\s+$/, ""));
  if (!blocks.length) return String(out || "").trim();
  if (blocks.length === 1) return blocks[0].trim();
  return blocks.join("\n\n").trim();
}
/* ── Multi-file PROJECT deliverable (folder) — persisted as a ```firas-project block ── */
function parseProjectMeta(content) {
  const m = /^\s*```firas-project\s*\n([\s\S]*?)\n```\s*$/.exec(String(content || ""));
  if (!m) return null;
  try { const o = JSON.parse(m[1]); return (o && Array.isArray(o.files) && o.files.length) ? o : null; } catch (_) { return null; }
}
function projFileLang(path) { const e = String(path).split(".").pop().toLowerCase(); return ({ js: "javascript", mjs: "javascript", ts: "typescript", html: "html", htm: "html", css: "css", json: "json", py: "python", md: "markdown", svg: "xml", txt: "" })[e] || e; }
/* Self-contained preview of a project: index.html with its local css/js INLINED (relative
   <link>/<script src> refs are swapped for the matching project files). */
function projPreviewHtml(proj, entryPath) {
  const norm = (p) => String(p || "").replace(/^\.\//, "").replace(/^\//, "");
  const idx = (entryPath && proj.files.find((f) => norm(f.path) === norm(entryPath)))
    || proj.files.find((f) => /(^|\/)index\.html?$/i.test(f.path)) || proj.files.find((f) => /\.html?$/i.test(f.path));
  if (!idx) return null;
  let html = idx.content || "";
  const base = (p) => norm(p).split("/").pop().toLowerCase();
  const findAsset = (ref, ext) => {
    const r = norm(ref);
    let f = proj.files.find((x) => norm(x.path) === r);                                  // exact
    if (!f) f = proj.files.find((x) => norm(x.path).toLowerCase() === r.toLowerCase());  // case-insensitive
    if (!f) f = proj.files.find((x) => base(x.path) === base(ref));                      // same filename, any dir
    if (!f) { const cands = proj.files.filter((x) => x.path.toLowerCase().endsWith("." + ext)); if (cands.length === 1) f = cands[0]; } // only one of its kind
    return f;
  };
  html = html.replace(/<link\b[^>]*href=["']?([^"'\s>]+\.css)["']?[^>]*\/?>(?:\s*<\/link>)?/gi, (m, href) => {
    const f = findAsset(href, "css"); return f ? "<style>\n" + f.content + "\n</style>" : m;
  });
  html = html.replace(/<script\b[^>]*src=["']?([^"'\s>]+\.js)["']?[^>]*>\s*<\/script>/gi, (m, src) => {
    const f = findAsset(src, "js"); return f ? "<script>\n" + f.content + "\n</script>" : m;
  });
  return html;
}
/* VISUAL AUDIT — the agent's EYES. Renders the app in the sandbox and MEASURES visual defects the
   user would see: broken images, horizontal overflow, and text elements overlapping each other.
   Deterministic DOM geometry, not guesswork; the findings feed a surgical visual-fix call. */
function visualAuditInSandbox(html, timeoutMs, viewportW) {
  return new Promise((resolve) => {
    try {
      const issues = [];
      const audit = "<script>window.addEventListener('load',function(){setTimeout(function(){try{" +
        "var out=[];" +
        "var sel=function(el){var s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;else if(el.classList&&el.classList[0])s+='.'+el.classList[0];return s;};" +
        // 1) broken images (failed to load)
        "Array.prototype.slice.call(document.images,0,40).forEach(function(im){if(im.complete&&im.naturalWidth===0)out.push('BROKEN IMAGE: <img src=\"'+(im.getAttribute('src')||'').slice(0,120)+'\"> — replace with an inline SVG, a CSS gradient block, or https://picsum.photos/seed/<name>/W/H');});" +
        // 2) horizontal overflow (causes a sideways scrollbar)
        "var iw=window.innerWidth;if(document.documentElement.scrollWidth>iw+6){var offenders=[];Array.prototype.slice.call(document.querySelectorAll('body *'),0,600).forEach(function(el){var r=el.getBoundingClientRect();if(r.width&&(r.right>iw+8||r.left<-8)&&offenders.length<5&&!el.closest('[data-ok]'))offenders.push(sel(el));});out.push('HORIZONTAL OVERFLOW: page scrolls sideways ('+document.documentElement.scrollWidth+'px vs '+iw+'px viewport). Offending: '+offenders.join(', '));}" +
        // 3) overlapping TEXT elements (unreadable collisions)
        "var texts=Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3,h4,p,a,button,li,span'),0,90).filter(function(e){var t=(e.innerText||'').trim();if(!t||t.length<3)return false;var r=e.getBoundingClientRect();return r.width>8&&r.height>8;});" +
        "var pairs=0;for(var i=0;i<texts.length&&pairs<4;i++){for(var j=i+1;j<texts.length&&pairs<4;j++){var a=texts[i],b=texts[j];if(a.contains(b)||b.contains(a))continue;var ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();var ox=Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left),oy=Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top);if(ox>0&&oy>0){var area=ox*oy,small=Math.min(ra.width*ra.height,rb.width*rb.height);if(small>0&&area/small>0.35){out.push('TEXT OVERLAP: '+sel(a)+' (\"'+(a.innerText||'').slice(0,28)+'\") overlaps '+sel(b)+' (\"'+(b.innerText||'').slice(0,28)+'\") — fix spacing/positioning or add an overlay.');pairs++;}}}}" +
        "parent.postMessage({__agentVis:1,issues:out.slice(0,8)},'*');}catch(e){parent.postMessage({__agentVis:1,issues:[]},'*');}},700);});<\/script>";
      let doc = String(html || "");
      doc = /<head[^>]*>/i.test(doc) ? doc.replace(/<head[^>]*>/i, (m) => m + audit) : audit + doc;
      const iframe = document.createElement("iframe");
      iframe.setAttribute("sandbox", "allow-scripts");
      const vw = viewportW || 1280;
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:" + vw + "px;height:900px;visibility:hidden";
      const tag = vw <= 500 ? "[MOBILE " + vw + "px] " : "";
      let done = false;
      const finish = (list) => { if (done) return; done = true; window.removeEventListener("message", onMsg); try { iframe.remove(); } catch (_) {} resolve((list || []).map((s) => tag + s)); };
      const onMsg = (e) => { if (e.data && e.data.__agentVis) finish(Array.isArray(e.data.issues) ? e.data.issues.map((s) => String(s).slice(0, 300)) : []); };
      window.addEventListener("message", onMsg);
      iframe.srcdoc = doc;
      document.body.appendChild(iframe);
      setTimeout(() => finish([]), timeoutMs || 4000);
    } catch (_) { resolve([]); }
  });
}
/* ── PYTHON RUNNER (Pyodide) — the agent actually RUNS the Python it wrote, in the browser, and
   captures real tracebacks. Loads Pyodide once, lazily. stdin is stubbed; input() returns "".
   Returns { ok, out, err } — err is the traceback (empty on success). ── */
let _pyodide = null, _pyodideLoading = null;
async function loadPyodide2() {
  if (_pyodide) return _pyodide;
  if (_pyodideLoading) return _pyodideLoading;
  _pyodideLoading = (async () => {
    if (typeof loadPyodide === "undefined") {
      await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    }
    _pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/" });
    return _pyodide;
  })();
  return _pyodideLoading;
}
async function runPythonInSandbox(code, timeoutMs) {
  // Only attempt stdlib-only scripts — a third-party import (pandas/requests/…) isn't installed and
  // would be a false failure. Those we leave to static review, not execution.
  const thirdParty = /^\s*(?:import|from)\s+(?!(?:os|sys|re|math|random|json|datetime|time|collections|itertools|functools|typing|string|decimal|fractions|statistics|heapq|bisect|copy|abc|enum|dataclasses|pathlib|io|csv|hashlib|base64|textwrap|unicodedata|calendar|pprint|operator|struct|array|queue|threading|asyncio|contextlib|warnings|traceback|argparse|__future__)\b)/m;
  if (thirdParty.test(String(code || ""))) return { ok: true, out: "", err: "", skipped: true };
  let py;
  try { py = await Promise.race([loadPyodide2(), new Promise((_, r) => setTimeout(() => r(new Error("pyodide load timeout")), 40000))]); }
  catch (_) { return { ok: true, out: "", err: "", skipped: true }; }   // engine unavailable → don't block
  try {
    const runner = "import sys, io, traceback\n_o=io.StringIO()\n_e=''\n_so,_se=sys.stdout,sys.stderr\nsys.stdout=_o; sys.stderr=_o\ntry:\n    input=lambda *a: ''\n    exec(compile(__usercode__, '<agent>', 'exec'), {'__name__':'__main__','input':lambda *a: ''})\nexcept SystemExit:\n    pass\nexcept Exception:\n    _e=traceback.format_exc()\nfinally:\n    sys.stdout=_so; sys.stderr=_se\n";
    py.globals.set("__usercode__", String(code || ""));
    await Promise.race([py.runPythonAsync(runner), new Promise((_, r) => setTimeout(() => r(new Error("py timeout")), timeoutMs || 8000))]);
    const err = String(py.globals.get("_e") || "");
    const out = String(py.globals.get("_o").getvalue() || "");
    return { ok: !err, out: out.slice(0, 4000), err: err.slice(0, 2000) };
  } catch (e) { return { ok: false, out: "", err: String((e && e.message) || e).slice(0, 800) }; }
}
/* ── DETERMINISTIC CROSS-FILE LINTER — zero model calls, 100% precise. Catches the classic
   generated-code failures: internal links to files that don't exist, JS targeting ids that no page
   defines, files nobody references, dead href="#" anchors, missing viewport/alt. ── */
function lintProject(files) {
  const issues = [];
  try {
    const norm = (p) => String(p || "").replace(/^\.\//, "").replace(/^\//, "");
    const paths = new Set(files.map((f) => norm(f.path)));
    const bases = new Set(files.map((f) => norm(f.path).split("/").pop()));
    const htmlFiles = files.filter((f) => /\.html?$/i.test(f.path));
    const allContent = files.map((f) => f.content || "").join("\n");
    const allIds = new Set();
    htmlFiles.forEach((hf) => [...(hf.content || "").matchAll(/id=["']?([\w-]+)["']?/g)].forEach((m) => allIds.add(m[1])));
    for (const hf of htmlFiles) {
      const c = hf.content || "";
      // internal page links → must exist in the project
      [...c.matchAll(/href=["']?([^"'\s>#?]+\.html?)["'#?\s>]/gi)].forEach((m) => {
        const t = norm(m[1]);
        if (!/^https?:|^\/\//i.test(m[1]) && !paths.has(t) && !bases.has(t.split("/").pop())) {
          issues.push("BROKEN LINK in " + hf.path + ': href="' + m[1] + '" — that page does not exist in the project. Either create it or point the link to an existing page/section.');
        }
      });
      // css/js references → must exist
      [...c.matchAll(/(?:href|src)=["']?([^"'\s>]+\.(?:css|js))["']?/gi)].forEach((m) => {
        const t = norm(m[1]);
        if (!/^https?:|^\/\//i.test(m[1]) && !paths.has(t) && !bases.has(t.split("/").pop())) {
          issues.push("BROKEN REFERENCE in " + hf.path + ': "' + m[1] + '" — no such file in the project.');
        }
      });
      // dead anchors
      const dead = (c.match(/<a\b[^>]*href=["']?#["']?[^>]*>/gi) || []).length;
      if (dead >= 3) issues.push("DEAD ANCHORS in " + hf.path + ": " + dead + ' links point to href="#" — wire each to its real section/page or give it a working handler.');
      if (!/name=["']?viewport/i.test(c)) issues.push('MISSING <meta name="viewport"> in ' + hf.path + " — the page won't scale on phones.");
      const noAlt = [...c.matchAll(/<img\b[^>]*>/gi)].filter((m) => !/alt=/.test(m[0])).length;
      if (noAlt) issues.push(noAlt + " <img> tag(s) in " + hf.path + " have no alt attribute.");
      // inline-script id targets
      [...c.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].forEach((sm) => {
        [...(sm[1] || "").matchAll(/getElementById\(\s*["']([\w-]+)["']\s*\)/g)].forEach((m) => {
          if (!allIds.has(m[1]) && !allContent.includes('id="' + m[1] + '"') && !allContent.includes("id='" + m[1] + "'") && !new RegExp("id\\s*[:=]\\s*[\"'`]" + m[1]).test(allContent)) {
            issues.push("JS TARGETS A MISSING ID: inline script in " + hf.path + ' calls getElementById("' + m[1] + '") but NO element anywhere has that id.');
          }
        });
      });
    }
    // external JS files: id targets must exist somewhere (allow dynamically-created ids)
    files.filter((f) => /\.m?js$/i.test(f.path)).forEach((jf) => {
      const jc = jf.content || "";
      const targets = new Set();
      [...jc.matchAll(/getElementById\(\s*["']([\w-]+)["']\s*\)/g)].forEach((m) => targets.add(m[1]));
      [...jc.matchAll(/querySelector(?:All)?\(\s*["']#([\w-]+)["']\s*\)/g)].forEach((m) => targets.add(m[1]));
      targets.forEach((id) => {
        if (!allIds.has(id) && !new RegExp("id\\s*[:=]\\s*[\"'`]" + id).test(allContent) && !allContent.includes('id="' + id + '"')) {
          issues.push("JS TARGETS A MISSING ID: " + jf.path + ' looks up "#' + id + '" but NO element anywhere has that id — add the element or fix the selector.');
        }
      });
      // built but never referenced
      const used = htmlFiles.some((hf) => (hf.content || "").includes(norm(jf.path)) || (hf.content || "").includes(norm(jf.path).split("/").pop()));
      if (htmlFiles.length && !used) issues.push("UNREFERENCED FILE: " + jf.path + " is never loaded by any HTML page — add its <script src> where it belongs.");
    });
    files.filter((f) => /\.css$/i.test(f.path)).forEach((cf) => {
      const used = htmlFiles.some((hf) => (hf.content || "").includes(norm(cf.path)) || (hf.content || "").includes(norm(cf.path).split("/").pop()));
      if (htmlFiles.length && !used) issues.push("UNREFERENCED FILE: " + cf.path + " is never linked by any HTML page — add its <link rel=stylesheet> where it belongs.");
    });
  } catch (_) {}
  return issues.slice(0, 12);
}
/* ── INTERACTION TESTER — tests the app LIKE A REAL USER: clicks buttons/menus, types into inputs,
   captures errors thrown DURING interaction, and detects DEAD BUTTONS (clicked → nothing changed). ── */
function interactionTestInSandbox(html, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const issues = [];
      const script = "<script>window.__err=[];window.onerror=function(m){window.__err.push(String(m).slice(0,160));return true;};window.addEventListener('unhandledrejection',function(e){window.__err.push('Rejection: '+String(e.reason).slice(0,120));});" +
        "document.addEventListener('submit',function(e){e.preventDefault();},true);" +   // never navigate away
        "window.addEventListener('load',function(){setTimeout(function(){try{" +
        "var out=[];var sig=function(){return document.body.innerHTML.length+':'+document.querySelectorAll('*').length+':'+(document.body.className||'')};" +
        "var label=function(el){var t=(el.innerText||el.value||el.getAttribute('aria-label')||'').trim().slice(0,26);return (el.tagName.toLowerCase()+(el.id?'#'+el.id:(el.classList[0]?'.'+el.classList[0]:''))+(t?' \"'+t+'\"':''));};" +
        // type into a couple of inputs first (so submit/search handlers have data)
        "Array.prototype.slice.call(document.querySelectorAll('input[type=text],input[type=search],input:not([type]),textarea'),0,3).forEach(function(inp){try{inp.value='تجربة';inp.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){}});" +
        "var clickables=Array.prototype.slice.call(document.querySelectorAll('button, [onclick], a[href=\"#\"], input[type=submit], [role=button]'),0,14);" +
        "var i=0;var next=function(){if(i>=clickables.length){parent.postMessage({__agentIx:1,issues:out.slice(0,10)},'*');return;}" +
        "var el=clickables[i++];var before=sig();var errBefore=window.__err.length;" +
        "try{el.click();}catch(e){out.push('CLICK THREW on '+label(el)+': '+String(e).slice(0,100));}" +
        "setTimeout(function(){var after=sig();var newErrs=window.__err.slice(errBefore);" +
        "newErrs.forEach(function(er){out.push('INTERACTION ERROR when clicking '+label(el)+': '+er);});" +
        "if(after===before&&!newErrs.length&&el.tagName!=='A'){out.push('DEAD BUTTON: '+label(el)+' — clicking it changes NOTHING (no DOM update, no handler effect). Wire it to its real behavior.');}" +
        "next();},130);};" +
        "next();}catch(e){parent.postMessage({__agentIx:1,issues:[]},'*');}},650);});<\/script>";
      let doc = String(html || "");
      doc = /<head[^>]*>/i.test(doc) ? doc.replace(/<head[^>]*>/i, (m) => m + script) : script + doc;
      const iframe = document.createElement("iframe");
      iframe.setAttribute("sandbox", "allow-scripts");
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1280px;height:900px;visibility:hidden";
      let done = false;
      const finish = (list) => { if (done) return; done = true; window.removeEventListener("message", onMsg); try { iframe.remove(); } catch (_) {} resolve(list || []); };
      const onMsg = (e) => { if (e.data && e.data.__agentIx) finish(Array.isArray(e.data.issues) ? e.data.issues.map((s) => String(s).slice(0, 300)) : []); };
      window.addEventListener("message", onMsg);
      iframe.srcdoc = doc;
      document.body.appendChild(iframe);
      setTimeout(() => finish([]), timeoutMs || 6000);
    } catch (_) { resolve([]); }
  });
}
/* RUN the built web app in a hidden, sandboxed iframe and capture its RUNTIME ERRORS — the agent
   actually TESTS what it built, then fixes the exact errors. sandbox="allow-scripts" (no same-origin)
   keeps it fully isolated from the app. */
function testHtmlInSandbox(html, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const errors = [];
      const hook = "<script>window.onerror=function(m,s,l,c){parent.postMessage({__agentTest:1,err:String(m)+' @line '+(l||0)},'*');return true;};window.addEventListener('unhandledrejection',function(e){parent.postMessage({__agentTest:1,err:'Unhandled rejection: '+String(e.reason).slice(0,200)},'*')});<\/script>";
      let doc = String(html || "");
      doc = /<head[^>]*>/i.test(doc) ? doc.replace(/<head[^>]*>/i, (m) => m + hook) : hook + doc;
      const iframe = document.createElement("iframe");
      iframe.setAttribute("sandbox", "allow-scripts");
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:800px;height:600px;visibility:hidden";
      const onMsg = (e) => { if (e.data && e.data.__agentTest && e.data.err) errors.push(String(e.data.err).slice(0, 300)); };
      window.addEventListener("message", onMsg);
      iframe.srcdoc = doc;
      document.body.appendChild(iframe);
      setTimeout(() => {
        window.removeEventListener("message", onMsg);
        try { iframe.remove(); } catch (_) {}
        resolve([...new Set(errors)].slice(0, 8));
      }, timeoutMs || 2500);
    } catch (_) { resolve([]); }
  });
}
function buildProjectCard(proj, lang) {
  const ar = lang === "ar";
  const card = document.createElement("div");
  card.className = "proj-card";
  const total = proj.files.reduce((s, f) => s + (f.content || "").length, 0);
  const head = document.createElement("div");
  head.className = "proj-card__head";
  head.innerHTML = '<span class="proj-card__ic">📁</span><div class="proj-card__meta"><div class="proj-card__name">' + escapeHtml(proj.name || "project") + "</div>" +
    '<div class="proj-card__sub">' + proj.files.length + (ar ? " ملفات · " : " files · ") + Math.max(1, Math.round(total / 1024)) + " KB</div></div>";
  const pv = projPreviewHtml(proj);
  if (pv && typeof openHtmlPreview === "function") {
    const pvBtn = document.createElement("button");
    pvBtn.type = "button"; pvBtn.className = "proj-card__zip proj-card__preview";
    pvBtn.textContent = ar ? "▶ معاينة مباشرة" : "▶ Live preview";
    pvBtn.addEventListener("click", () => openHtmlPreview(projPreviewHtml(proj)));
    head.appendChild(pvBtn);
  }
  const zipBtn = document.createElement("button");
  zipBtn.type = "button"; zipBtn.className = "proj-card__zip";
  zipBtn.textContent = ar ? "⬇ تنزيل الفولدر (ZIP)" : "⬇ Download folder (ZIP)";
  zipBtn.addEventListener("click", () => {
    // Keep Arabic letters in the folder/zip name — the old \w-only filter erased Arabic names to "-".
    let folder = String(proj.name || "project").replace(/[^\w؀-ۿ .-]+/g, " ").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
    if (!folder) folder = "project";
    const blob = buildZip(proj.files.map((f) => ({ path: folder + "/" + f.path, content: f.content })));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = folder + ".zip";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  head.appendChild(zipBtn);
  // Agent → Code bridge: keep developing this delivered folder inside the Firas Code IDE.
  if (typeof openProjectInFirasCode === "function") {
    const cwBtn = document.createElement("button");
    cwBtn.type = "button"; cwBtn.className = "proj-card__zip proj-card__opencode";
    cwBtn.textContent = ar ? "⚡ افتح بفراس كود" : "⚡ Open in Firas Code";
    cwBtn.addEventListener("click", () => openProjectInFirasCode(proj));
    head.appendChild(cwBtn);
  }
  card.appendChild(head);
  const list = document.createElement("div");
  list.className = "proj-card__files";
  proj.files.forEach((f) => {
    const row = document.createElement("div");
    row.className = "proj-file";
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "proj-file__row";
    btn.innerHTML = '<span class="proj-file__ic">📄</span><span class="proj-file__path">' + escapeHtml(f.path) + '</span><span class="proj-file__size">' + Math.max(1, Math.round((f.content || "").length / 1024)) + ' KB</span><span class="proj-file__chev">▾</span>';
    const body = document.createElement("div");
    body.className = "proj-file__body"; body.hidden = true;
    btn.addEventListener("click", () => {
      body.hidden = !body.hidden;
      row.classList.toggle("is-open", !body.hidden);
      if (!body.hidden && !body.firstChild) {
        const pre = document.createElement("pre"); const code = document.createElement("code");
        code.className = "language-" + projFileLang(f.path);
        code.textContent = f.content || "";
        pre.appendChild(code); body.appendChild(pre);
        if (typeof window.hljs !== "undefined") { try { window.hljs.highlightElement(code); } catch (_) {} }
      }
    });
    row.appendChild(btn); row.appendChild(body); list.appendChild(row);
  });
  card.appendChild(list);
  return card;
}

function parseAgentMeta(content) {
  const s = String(content || "");
  if (!/^\s*```firas-agent[ \t]*\r?\n/.test(s)) return null;
  const body = s.replace(/^\s*```firas-agent[ \t]*\r?\n/, "").replace(/\r?\n```[ \t]*$/, "");
  try { const o = JSON.parse(body); if (o && Array.isArray(o.steps)) return o; } catch (_) {}
  // Recover from a TRUNCATED trailing fence (a big run can be cut at the server's content cap):
  // brace-match the first complete top-level JSON object.
  const start = body.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try { const o = JSON.parse(body.slice(start, i + 1)); return (o && Array.isArray(o.steps)) ? o : null; } catch (_) { return null; }
    }
  }
  return null;
}
function serializeAgentRun(run) {
  const slim = {
    task: String(run.task || "").slice(0, 3000),
    title: String(run.title || "").slice(0, 160),
    phase: run.phase, lang: run.lang, mode: run.mode || "answer",
    steps: run.steps.map((s) => ({ title: String(s.title || "").slice(0, 200), kind: s.kind, file: s.file || "", s: s.s, out: String(s.out || "").slice(0, 15000) })),
    final: String(run.final || "").slice(0, 40000),
    stats: run.stats || {},
  };
  // HARD BUDGET so the persisted block stays under the server's ~200K content cap — a truncated
  // block loses its closing fence and won't re-parse on reload. Trim step outputs adaptively (the
  // full code lives in the SEPARATE deliverable message, so the card is only a summary anyway).
  const BUDGET = 165000;
  let cap = 15000;
  while (JSON.stringify(slim).length > BUDGET && cap > 400) {
    cap = Math.floor(cap * 0.7);
    slim.steps.forEach((s) => { if (s.out.length > cap) s.out = s.out.slice(0, cap); });
  }
  if (JSON.stringify(slim).length > BUDGET) slim.final = slim.final.slice(0, 6000);
  return "```firas-agent\n" + JSON.stringify(slim) + "\n```";
}
const AGENT_PHASE_LABEL = {
  read:    { ar: "يقرأ المرفقات…", en: "Reading attachments…" },
  plan:    { ar: "يخطّط…", en: "Planning…" },
  run:     { ar: "ينفّذ…", en: "Executing…" },
  verify:  { ar: "يراجع نفسه…", en: "Self-reviewing…" },
  enhance: { ar: "يطوّر ويوسّع…", en: "Enhancing…" },
  assemble:{ ar: "يجمّع النتيجة…", en: "Assembling…" },
  test:    { ar: "يختبر ويصلّح…", en: "Testing & fixing…" },
  done:    { ar: "اكتملت المهمة", en: "Task complete" },
  stopped: { ar: "أُوقفت", en: "Stopped" },
  fail:    { ar: "تعثّرت", en: "Failed" },
};
function buildAgentCard(run, lang) {
  const ar = (run.lang || lang) === "ar";
  // A run persisted in a LIVE phase (run/plan/…) but with no active stream = the page was reloaded
  // mid-mission. Render it as "stopped" so the ▶ Resume button appears instead of an eternal spinner.
  const LIVE_PHASES = { read: 1, plan: 1, run: 1, verify: 1, enhance: 1, assemble: 1, test: 1 };
  const chLive = activeChat();
  if (LIVE_PHASES[run.phase] && !(chLive && activeStreams.has(chLive.id))) {
    run = Object.assign({}, run, { phase: "stopped", steps: (run.steps || []).map((s) => s.s === "run" ? Object.assign({}, s, { s: "todo" }) : s) });
  }
  const card = document.createElement("div");
  card.className = "agent-card" + (run.phase === "done" ? " is-done" : "");
  const phase = AGENT_PHASE_LABEL[run.phase] || AGENT_PHASE_LABEL.run;
  const head = document.createElement("div");
  head.className = "agent-card__head";
  head.innerHTML = '<span class="agent-card__bolt">⚡</span><span class="agent-card__brand">Firas Agent</span>' +
    '<span class="agent-card__phase' + (run.phase === "run" || run.phase === "plan" || run.phase === "verify" || run.phase === "read" ? " is-live" : "") + '">' + (ar ? phase.ar : phase.en) + "</span>";
  card.appendChild(head);
  if (run.title) { const h = document.createElement("div"); h.className = "agent-card__title"; h.textContent = run.title; card.appendChild(h); }
  // Progress bar: n/N done + animated fill.
  const doneN = run.steps.filter((s) => s.s === "done").length;
  const pct = run.steps.length ? Math.round(doneN / run.steps.length * 100) : 0;
  const prog = document.createElement("div");
  prog.className = "agent-card__prog";
  prog.innerHTML = '<div class="agent-card__prog-bar"><div class="agent-card__prog-fill" style="width:' + pct + '%"></div></div>' +
    '<span class="agent-card__prog-n">' + doneN + "/" + run.steps.length + "</span>";
  card.appendChild(prog);
  const KIND_IC = { research: "🔎", write: "✍️", solve: "🧮", draw: "📈", code: "💻", design: "🎨" };
  const ol = document.createElement("ol");
  ol.className = "agent-card__steps";
  run.steps.forEach((st) => {
    const li = document.createElement("li");
    li.className = "agent-step is-" + (st.s || "todo");
    const ic = st.s === "done" ? "✓" : st.s === "run" ? "" : st.s === "fail" ? "!" : "";
    const icon = '<span class="agent-step__ic">' + (st.s === "run" ? '<span class="agent-step__spin"></span>' : ic) + "</span>";
    const kindIc = '<span class="agent-step__kind">' + (KIND_IC[st.kind] || "✍️") + "</span>";
    const fileChip = st.file ? ' <code class="agent-step__file" dir="ltr">' + escapeHtml(st.file) + "</code>" : "";
    const titleHtml = '<span class="agent-step__t">' + kindIc + escapeHtml(st.title) + fileChip + "</span>";
    if (st.out && st.s === "done") {
      const det = document.createElement("details");
      det.className = "agent-step__det";
      det.innerHTML = "<summary>" + icon + titleHtml + "</summary>";
      const body = document.createElement("div");
      body.className = "md agent-step__out";
      body.innerHTML = renderMarkdown(st.out);
      decorateMarkdown(body); typesetMath(body);
      det.appendChild(body);
      li.appendChild(det);
    } else {
      li.innerHTML = icon + titleHtml;
    }
    ol.appendChild(li);
  });
  card.appendChild(ol);
  // Task REPORT — what the agent actually did (shown when done). This is the "it's an agent, not a chat" moment.
  if (run.phase === "done" && run.stats && (run.stats.files || run.stats.lines)) {
    const st = run.stats;
    const chips = [];
    if (st.files) chips.push((ar ? "📄 " : "📄 ") + st.files + (ar ? " ملف" : " files"));
    if (st.lines) chips.push("📝 " + st.lines.toLocaleString() + (ar ? " سطر" : " lines"));
    if (st.searches) chips.push("🔎 " + st.searches + (ar ? " بحث ويب" : " searches"));
    if (st.images) chips.push("🖼️ " + st.images + (ar ? " صورة" : " images"));
    if (st.fixes) chips.push("🧪 " + st.fixes + (ar ? " إصلاح تشغيل" : " runtime fixes"));
    if (st.visual) chips.push("👁️ " + st.visual + (ar ? " إصلاح بصري" : " visual fixes"));
    if (st.checks) chips.push("∫ " + st.checks + (ar ? " تدقيق" : " checks"));
    if (st.elapsed) chips.push("⏱️ " + (st.elapsed >= 60 ? Math.round(st.elapsed / 60) + (ar ? " د" : "m") : st.elapsed + (ar ? " ث" : "s")));
    if (st.score) chips.push("🏅 " + (ar ? "الجودة " : "Quality ") + st.score + "/10");
    if (chips.length) {
      const rep = document.createElement("div");
      rep.className = "agent-card__report";
      rep.innerHTML = '<span class="agent-card__report-label">' + (ar ? "تقرير المهمة" : "Task report") + "</span>" +
        chips.map((c) => '<span class="agent-report-chip">' + escapeHtml(c) + "</span>").join("");
      card.appendChild(rep);
    }
  }
  // RESUME — a stopped/failed mission with unfinished steps gets a one-click continue.
  if ((run.phase === "stopped" || run.phase === "fail") && run.steps.some((s) => s.s !== "done")) {
    const rb = document.createElement("button");
    rb.type = "button"; rb.className = "agent-card__resume";
    rb.textContent = ar ? "▶ استئناف المهمة" : "▶ Resume task";
    rb.addEventListener("click", () => { rb.disabled = true; resumeAgentRun(activeChat(), run); });
    card.appendChild(rb);
  }
  if (run.final) {
    const fin = document.createElement("div");
    fin.className = "agent-card__final";
    fin.innerHTML = '<div class="agent-card__final-label">' + (ar ? "📦 النتيجة" : "📦 Result") + "</div>";
    const md = document.createElement("div");
    md.className = "md";
    md.innerHTML = renderMarkdown(run.final);
    decorateMarkdown(md); typesetMath(md);
    fin.appendChild(md);
    card.appendChild(fin);
  }
  return card;
}
/* Robust model call for agent steps: 3 attempts with backoff + a per-call watchdog so a stalled
   stream (no bytes, no FIN) can NEVER hang the whole run — it aborts, retries, and after 3 tries the
   phase's try/catch keeps the run moving. */
async function agentCall(messages, tierKey, signal) {
  let lastErr = null;
  for (let a = 0; a < 3; a++) {
    const ac = new AbortController();
    const onAbort = () => { try { ac.abort(); } catch (_) {} };
    if (signal) { signal.addEventListener("abort", onAbort, { once: true }); if (signal.aborted) onAbort(); }
    const to = setTimeout(() => { try { ac.abort("agent-timeout"); } catch (_) {} }, 180000); // 3-min hard cap/call
    try {
      const out = await callAgentText(messages, tierKey, ac.signal);
      if (out && out.trim()) return out.trim();
    } catch (e) {
      lastErr = e;
      if (signal && signal.aborted) throw e;   // real user Stop → abort the run; watchdog abort → retry
    } finally {
      clearTimeout(to);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
    await new Promise((r) => setTimeout(r, 900 * (a + 1)));
  }
  throw (lastErr || new Error("agent call failed"));
}
async function agentWebSearch(q) {
  try {
    const r = await fetch("/api/search?q=" + encodeURIComponent(String(q).slice(0, 280)), { credentials: "same-origin" });
    if (!r.ok) return "";
    const d = await r.json();
    const res = Array.isArray(d.results) ? d.results.slice(0, 6) : [];
    return res.map((x, i) => "[" + (i + 1) + "] " + (x.title || "") + "\n" + (x.snippet || "") + "\n" + (x.url || "")).join("\n\n");
  } catch (_) { return ""; }
}
/* Keyless REAL image URLs (Openverse via our proxy) for a topic — so generated sites use real,
   relevant photos instead of placeholders. */
async function agentImageSearch(query) {
  try {
    const r = await fetch("/api/images?q=" + encodeURIComponent(String(query).slice(0, 120)), { credentials: "same-origin" });
    if (!r.ok) return [];
    const d = await r.json();
    return (Array.isArray(d.results) ? d.results : []).map((x) => x.url).filter(Boolean).slice(0, 8);
  } catch (_) { return []; }
}
/* Gather a small pool of REAL topic photos for a web build: derive a few English image queries,
   search each, dedupe. Best-effort — empty on any failure (build falls back to gradients/picsum). */
async function agentGatherImages(task, design, signal) {
  try {
    const kwRaw = await agentCall([
      { role: "system", content: "Give 4 short ENGLISH image-search queries (2-3 words each) for the photos THIS website needs (hero + main sections/topics). Concrete nouns, no punctuation. Return ONLY a JSON array of strings." },
      { role: "user", content: "SITE:\n" + String(task).slice(0, 900) + (design ? "\n\nDESIGN:\n" + String(design).slice(0, 700) : "") },
    ], "max", signal);
    let arr = [];
    try { arr = JSON.parse((kwRaw.match(/\[[\s\S]*\]/) || ["[]"])[0]); } catch (_) {}
    if (!Array.isArray(arr) || !arr.length) arr = [String(task).slice(0, 40)];
    const pool = [];
    for (const kw of arr.slice(0, 4)) {
      if (signal && signal.aborted) break;
      const imgs = await agentImageSearch(String(kw));
      imgs.slice(0, 2).forEach((u) => pool.push(u));
    }
    return [...new Set(pool)].slice(0, 8);
  } catch (_) { return []; }
}
/* ⑤ AGENT VISION — read the user's ATTACHED image(s). Adapts to intent: a design/screenshot the
   agent should REBUILD → a precise UI blueprint (layout, colors, components, copy) for replication in
   real code; anything else → a full transcription/description used as source material. Best-effort. */
async function agentVisionRead(images, userText, replyLang, wantsBuild, signal) {
  if (!Array.isArray(images) || !images.length) return "";
  const ar = replyLang === "ar";
  const sys = wantsBuild
    ? "You are a senior UI engineer reverse-engineering a design REFERENCE. Describe the attached screenshot/mockup so precisely that another engineer could REBUILD it in HTML/CSS without seeing it: overall layout & structure (header, hero, sections, grid, footer), the EXACT color palette (hex approximations for background, text, accents), typography (serif/sans, weights, relative sizes), every UI component (nav, buttons, cards, forms, images/icons, badges), spacing/rhythm, and ALL visible text copy verbatim. Be concrete and exhaustive. Output a clear structured blueprint only."
    : "You are a precise vision engine. Describe and transcribe EVERYTHING in the attached image(s) completely — all visible text verbatim, structure, data in any tables, diagrams, and what it depicts — in order. Do not summarize or omit. Output only the transcription/description.";
  const usr = (ar ? "اقرأ الصورة/الصور المرفقة (هذه مرجع لطلب المستخدم: " : "Read the attached image(s) (reference for the user's request: ") + String(userText || "").slice(0, 300) + ").";
  try {
    const out = await callAgentText([{ role: "system", content: sys }, { role: "user", content: usr, images }], "pro", signal);
    return (out && out.trim()) ? out.trim() : "";
  } catch (_) { return ""; }
}
/* The user's durable memory (preferences learned across chats) — so the agent starts already
   knowing them. Returns an array of short fact strings. */
async function agentUserMemory() {
  try { const d = await apiJson("/api/memory"); const facts = (d && d.memory) || []; return facts.filter((f) => typeof f === "string").slice(0, 20); } catch (_) { return []; }
}
/* Read a URL the user pasted (via our SSRF-guarded proxy) → its readable text as source material. */
async function agentFetchUrl(url) {
  try {
    const r = await fetch("/api/fetch?url=" + encodeURIComponent(String(url).slice(0, 500)), { credentials: "same-origin" });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.text ? d : null;
  } catch (_) { return null; }
}
/* Should the agent ASK clarifying questions before executing? Only for a fresh, SHORT/vague
   build-or-big task — a detailed brief needs no questions. */
function agentClarifyNeeded(task) {
  const t = String(task || "");
  if (t.trim().length > 550) return false;   // already detailed enough
  // An explicit FILE request with a real brief (≥25 words) is specific enough — asking first
  // only slows the user down. Execute directly.
  const explicitDoc = typeof detectFileRequest === "function" ? detectFileRequest(t) : null;
  if (explicitDoc && t.trim().split(/\s+/).length >= 25) return false;
  const isBuild = /موقع|متجر|تطبيق|لعب[ةه]|منصة|واجه|داشبورد|لوحة\s*تحكم|website|web\s*app|\bapp\b|\bgame\b|\bstore\b|dashboard|platform|landing/i.test(t) || (typeof detectCodeRequest === "function" && !!detectCodeRequest(t));
  // "big deliverable" nouns count only in a CREATION context — an incidental mention
  // ("questions that never exist in books") must NOT trigger the wizard.
  const isBig = /(?:اكتب|اصنع|سوّ?ي|اعمل|أنشئ|انشئ|حضّ?ر|جهّ?ز|أريد|اريد|ابي|بغيت|write|make|create|build|prepare|generate|i\s*want)[^.؟?!]{0,60}(?:كورس|دورة|منهج|منهاج|كتاب|كتيب|ملزمة|بحث|course|book|research\s*(?:paper|report)?|curriculum|booklet|thesis|report)|^(?:كورس|كتاب|بحث|منهج|course|book|research)/i.test(t);
  return isBuild || isBig;
}
/* Ask the model for the 2-3 most impactful clarifying questions as a firas-ask spec (the same
   interactive-choice format the app already renders). Returns null when nothing needs asking. */
async function buildClarifyingQuestions(task, lang, signal) {
  try {
    const raw = await agentCall([
      { role: "system", content: "You are Firas Agent, about to execute a big task, but a FEW key decisions are ambiguous and would CHANGE what you build. Ask the 2-3 MOST impactful clarifying questions (audience/purpose, scope/size, style/tone, language, the key features or topics to include). Skip anything you can reasonably assume — do NOT ask filler. Each question has 2-4 SPECIFIC options (not generic), and mark the single best default as recommended:true. Return ONLY valid JSON in the user's language: {\"questions\":[{\"question\":\"…\",\"options\":[{\"label\":\"…\",\"desc\":\"short\",\"recommended\":true},{\"label\":\"…\",\"desc\":\"…\"}]}]}. If the task is already fully specific, return {\"questions\":[]}." },
      { role: "user", content: String(task).slice(0, 2000) },
    ], "max", signal);
    const jm = raw.match(/\{[\s\S]*\}/);
    if (!jm) return null;
    const spec = JSON.parse(jm[0]);
    if (!spec || !Array.isArray(spec.questions) || !spec.questions.length) return null;
    // keep ≤3 questions, each with ≥2 options
    spec.questions = spec.questions.slice(0, 3).filter((q) => q && q.question && Array.isArray(q.options) && q.options.length >= 2);
    return spec.questions.length ? spec : null;
  } catch (_) { return null; }
}
const AGENT_QUALITY =
  " You are a world-class domain expert for THIS task — a tenured professor for math/physics/chemistry/science, a published author for Arabic/English writing, a principal engineer for code. Work at that level, always." +
  " DEPTH: every step's output is a COMPLETE specialist section — full coverage of its subtopic, correct terminology, concrete worked examples, precise reasoning, clean structure with clear headings. Never an outline, a summary of what you 'would' write, or a stub." +
  " CORRECTNESS: solve everything end-to-end and VERIFY before stating a result — differentiate an antiderivative back to the integrand, substitute values into an identity/equation, check every endpoint, singularity, unit and edge case, and re-derive any number you are unsure of. Never assert an unverified result. Give EXACT closed forms (fractions, radicals, π, e, symbolic) unless a decimal is requested. For any problem/exercise/question you GENERATE, first solve it fully as a hidden answer key; if your own solution is not clean, is ambiguous, or has no exact closed-form answer, DISCARD it and produce a different valid one — never publish a problem you could not cleanly solve. Confirm every non-trivial result a SECOND way (a different method or a special/limiting case). These correctness rules hold on EVERY engine — quality must not drop on a lighter/backup model." +
  " SELF-CONSISTENCY: honour every definition, symbol, notation and claim established in earlier steps; contradict nothing already written." +
  " REAL CONTENT ONLY (absolute): never output 'TODO', 'lorem', '...', '(details omitted)', '(similar to above)', 'left as an exercise', placeholder names, or any promise of content instead of the content itself. If a part is long, write all of it." +
  " FORMATTING: ALL math in valid, BALANCED KaTeX ($…$ inline, $$…$$ for standalone equations only), units and words inside \\text{} with thin spaces (e.g. $9.8\\,\\text{m/s}^2$). Function graphs as a fenced ```plot block (lines `y = <expr>` with explicit operators + optional `domain: a..b`; also polar `r=f(theta)`, parametric `x=f(t)`/`y=g(t)`, 3D `z=f(x,y)`). GEOMETRY figures (triangles, circles, vectors, points, angles, polygons) ALSO as a fenced ```plot block with shape commands — `circle (cx,cy) r=R`, `triangle (x1,y1) (x2,y2) (x3,y3)`, `vector (x1,y1) (x2,y2)`, `point (x,y) \"A\"`, `angle (a) (v) (b) \"θ\"`, `segment`/`line`/`rectangle`/`polygon`/`arc`/`ellipse` — NEVER tikz for geometry. Reserve ```tikz ONLY for electric circuits / complex physics schematics. Code in fenced blocks with the language tag." +
  " Deliver the work itself — polished and final, no meta commentary or apologies.";
/* Per-domain execution guidance so each answer-mode step is done like a specialist. */
const DOMAIN_GUIDE = {
  math: " MATH MODE: state given/goal, then a rigorous step-by-step derivation where EVERY line follows from the previous with the rule named (no skipped algebra). Define notation, note domain/edge cases, verify the result (substitute back or sanity-check units/limits). Include at least one fully worked example and, where useful, a second method as a cross-check. Give the final answer boxed as $\\boxed{...}$.",
  science: " PHYSICS/CHEM/SCIENCE MODE: name the governing law/principle first, then derive symbolically BEFORE plugging numbers. Carry UNITS through every step and check dimensional consistency; give the answer to correct significant figures with units. State assumptions and regimes of validity. Chemistry: balanced equations, correct states/charges, mechanisms with electron-flow described. Draw the setup/free-body/energy diagram as a SIMPLE ```tikz block. Add a short 'why this makes physical sense' check.",
  writing: " WRITING MODE (essays/literature/language, EN or AR): open with a clear thesis, develop it across well-structured paragraphs each with a topic sentence + evidence + analysis, and close with a synthesis (not a restatement). Use precise, varied, register-appropriate vocabulary and real examples/quotations. Arabic: فصحى سليمة مع ضبط ما يلزم وترابط منطقي. Aim for genuine depth, never a thin outline.",
  exam: " EXAM MODE: DEFAULT DIFFICULTY — when the subject is math/physics/chemistry (or any quantitative science) and the user did NOT explicitly ask for an easy/basic level, the set must be GENUINELY HARD overall (strong competition / JEE-Advanced calibre): multi-concept, multi-step, tricky ideas, no routine textbook drills — and every problem NOVEL, UNIQUE and DISTINCTIVE (fresh structures/numbers/scenarios you construct yourself, never known classics or reworded book problems). Produce a real question SET (label each with difficulty and marks). Mix formats (MCQ, short-answer, problem, proof/essay) as fits the subject, keep questions unambiguous and non-repetitive, then give a COMPLETE separate ANSWER KEY with full worked solutions/rationale — not just final letters. NOVELTY: when the user asks for NEW/novel/original problems, CONSTRUCT each one yourself (fresh functions, numbers, structures and scenarios — never textbook classics or famous competition problems restated), and make each problem combine 2-3 distinct ideas/techniques so it cannot be pattern-matched. DIFFICULTY CALIBRATION: honour the requested level exactly (olympiad/JEE-advanced means genuinely hard multi-step problems, not routine drills) while staying SOLVABLE with the allowed tools — verify each problem end-to-end yourself before including it (if your own worked solution is not clean and exact, REPLACE that problem with one you can solve cleanly), and respect every exclusion the user states (no complex analysis, no non-elementary integrals…).",
  knowledge: " KNOWLEDGE MODE: lead with the direct, correct answer, then explain the why with concrete facts, mechanisms, dates/figures, and a short example or analogy. Distinguish established fact from interpretation; if a claim is uncertain, say so. Structure with clear headings/lists so it is scannable."
};
const DEPTH_MANDATE = " DEPTH MANDATE: this step must be genuinely thorough and self-contained — full coverage of its topic with derivations/examples/evidence, not a summary. Never abbreviate with 'and so on' or 'similar for the rest'; write every part out in full.";
/* Hard visual rules for generated web UIs — these directly prevent the classic failures: broken
   local images, text drowning in busy photos, sideways scroll, and colliding absolute elements. */
const VISUAL_POLICY =
  " VISUAL POLICY (hard rules): IMAGES — the generated folder has NO image assets, so NEVER reference local files (assets/…, img/…, ./photo.jpg). Allowed only: (1) inline SVG you draw yourself, (2) CSS gradients/patterns, (3) https://picsum.photos/seed/<word>/<w>/<h> for photos, (4) Font Awesome icons via its CDN. Every <img> gets width+height (or aspect-ratio), object-fit:cover, background-color fallback, and onerror=\"this.style.display='none'\". CONTRAST — text NEVER sits directly on a photo: put it on a solid/gradient panel or add a dark overlay layer (rgba(0,0,0,.55)+) under white text. LAYOUT — avoid absolute positioning for content flow (flex/grid only; absolute only for tiny decorations with pointer-events:none), nothing may overflow the viewport horizontally (max-width:100%, overflow-x controlled), test mentally at 1280px AND 380px widths, and in RTL. SPACING — generous consistent padding; separate sections clearly; never let two text blocks touch or overlap.";
const SIZE_MANDATE_WEB = " NO SKELETONS: deliver a LARGE, COMPLETE, launch-ready implementation — err on the side of MORE (many hundreds to thousands of lines when the feature set warrants it; long files are welcome, never truncate). Every section fully realized with REAL content (never lorem/placeholder), full responsive design, refined spacing/typography, hover/focus states, smooth animations and micro-interactions, and real working logic with edge cases and errors handled. Do not stop early to 'keep it short'. The file MUST be syntactically valid and run correctly as-is — mentally execute it before finishing — and output complete, start to end, never truncated.";
const SIZE_MANDATE_CODE = " NO SKELETONS and NO STUBS: every function fully implemented — never `pass`, `TODO`, `...`, `throw new Error('not implemented')`, or '// rest of logic here'. Deliver a LARGE, COMPLETE, runnable file (many hundreds to thousands of lines when the task warrants — long files are welcome, never truncate). Handle edge cases and errors, include realistic sample/seed data where needed, and make it run end-to-end as-is. Output complete, start to end, never truncated.";
/* Coding brain: real working logic + smart library use — appended to every code builder. */
const TECH_BRAIN =
  " REAL LOGIC (hard rule): every interactive feature must actually WORK end-to-end — every button/menu/form is wired to a real handler that visibly does its job; search/filter/sort really filter; a cart/favorites/todo really adds, updates totals, and PERSISTS via localStorage; forms validate and give feedback. A control that does nothing is a defect." +
  " LIBRARIES: when the task names or clearly benefits from a library/framework (React, Vue, Tailwind, Bootstrap, Chart.js, Three.js, Leaflet, anime.js…), load it correctly from its official CDN (browser/UMD build, pinned version, correct init for no-build usage) — otherwise clean vanilla JS. Never import npm-style in browser files." +
  " NON-WEB STACKS (Python/Node/bots/APIs): produce a proper runnable project — correct entry point, clean module structure, requirements.txt / package.json with real versions, and a README.md with exact run commands.";
const domainOf = (t) => {
  const s = (t || "").toLowerCase();
  if (/امتحان|اختبار|أسئلة|اسئلة|بنك أسئلة|quiz|exam|test|worksheet|mcq|questions?/.test(s)) return "exam";
  if (/فيزياء|كيمياء|أحياء|physics|chem|biolog|reaction|force|voltage|mole|circuit|thermo/.test(s)) return "science";
  if (/رياضيات|جبر|تفاضل|تكامل|هندسة|معادلة|math|algebra|calculus|integral|derivative|equation|geometry|proof|theorem/.test(s)) return "math";
  if (/مقال|قصيدة|تعبير|essay|paragraph|literature|poem|write about|story|letter|رسالة|شعر/.test(s)) return "writing";
  return "knowledge";
};
async function runAgentTask(chat, aiMsg, task, replyLang, signal, onUpdate, ctx, resume) {
  ctx = ctx || {};
  // Everything the model sees carries the conversation context, so multi-request missions stay ONE mission.
  const convoCtx = (ctx.memory && ctx.memory.length ? "\n\nWHAT YOU ALREADY KNOW ABOUT THIS USER (apply their preferences unless this task overrides them):\n" + ctx.memory.map((f) => "• " + f).join("\n") : "")
    + (ctx.history ? "\n\nCONVERSATION SO FAR (this request CONTINUES it — stay consistent with everything already agreed/built):\n" + ctx.history : "")
    + (ctx.prevRunTitle ? "\n\nPREVIOUS COMPLETED TASK: " + ctx.prevRunTitle : "");
  let taskCtx = task + convoCtx;
  // ATTACHED FILE (PDF/code/text) — the FULL extracted text, carried outside the task string so the
  // short task slices in the prompts below never cut it off. Injected as a labelled source block
  // into planning and every content call — the agent reads uploaded files exactly like normal chat.
  const srcDoc = ctx.fileText ? String(ctx.fileText) : "";
  const srcBlock = (cap) => srcDoc
    ? "\n\n=== محتوى الملف المرفق (المصدر الأساسي — اقرأه بالكامل وابنِ العمل منه) / ATTACHED FILE CONTENT (primary source — read it fully and ground the work in it) ===\n"
      + (srcDoc.length > cap ? srcDoc.slice(0, cap) + "\n[... truncated ...]" : srcDoc)
    : "";
  const ar = replyLang === "ar";
  // The deliverable MUST match the language the user wrote in — content AND every human-readable
  // string (UI labels, titles, headings, captions, chart/table labels, filenames). Only code
  // keywords/APIs stay English. This applies to files, websites, docs, decks — everything.
  const langRule = ar
    ? " LANGUAGE — ABSOLUTE RULE: the user wrote in ARABIC, so EVERYTHING you produce is in Arabic (فصحى واضحة): all prose and content; ALL user-facing text in any website/app (buttons, nav, labels, headings, placeholders, messages); every document/section title and heading; all table and chart labels; captions. Programming keywords and APIs stay English, but every human-readable string is Arabic. NEVER switch to English for the content."
    : " LANGUAGE — ABSOLUTE RULE: the user wrote in ENGLISH, so EVERYTHING you produce is in English: all prose and content; ALL user-facing text in any website/app (buttons, nav, labels, headings, placeholders, messages); every document/section title and heading; all table and chart labels; captions. NEVER switch to Arabic or any other language for the content.";
  const run = { task, title: "", phase: "plan", lang: replyLang, steps: [], final: "", mode: "answer", stats: { startedAt: Date.now(), files: 0, lines: 0, fixes: 0, visual: 0, searches: 0, images: 0, checks: 0 } };
  // DELIVERABLE MODE: doc (PDF/Word…) · codefile (ONE complete code file — user asked "بكود واحد")
  // · project (a real multi-file FOLDER, downloadable as ZIP — the default for sites/apps) · answer.
  const wantsDoc = typeof detectFileRequest === "function" ? detectFileRequest(task) : null;
  const codeSpec = !wantsDoc && typeof detectCodeRequest === "function" ? detectCodeRequest(task) : null;
  const oneFile = /كود\s*واحد|بكود\s*واحد|ملف\s*واحد|بملف\s*واحد|one\s*file|single\s*file/i.test(task);
  // Follow-ups EVOLVE the previous deliverable ("أضف وضع ليلي", "عدّل السلة"…) instead of restarting.
  const followUp = typeof CODE_FOLLOWUP !== "undefined" && CODE_FOLLOWUP.test(task);
  // Course / booklet / exam / worksheet intent → a structured, answer-key-bearing document deliverable.
  const COURSE_EXAM = /\b(course|syllabus|curriculum|booklet|workbook|worksheet|exam|quiz|test|revision|study\s*guide|lesson\s*plan|problem\s*set)\b|كورس|منهج|منهاج|دورة|كتيب|ملزمة|مذكرة|ورقة\s*عمل|امتحان|اختبار|كويز|بنك\s*أسئلة|مراجعة|تمارين/i.test(task);
  run._courseExam = COURSE_EXAM;
  // MEGA-BOOK intent → far more chapters, each written LONG (the chunked PDF engine can render it).
  run._mega = /موسوعة|كتاب\s*(ضخم|كامل|شامل)|مرجع\s*شامل|\b\d{3,4}\s*صفح|مئات\s*الصفح|encyclopedia|mega\s*book|comprehensive\s*(book|reference)|\b\d{3,4}\s*pages/i.test(task);
  // ④ PRESENTATION intent → a slide DECK: the author writes slide-structured markdown (sections +
  // bullets + speaker notes + web images) that the PPTX engine turns into a polished keynote.
  run._deck = (wantsDoc === "pptx") || /عرض\s*تقديمي|بوربوينت|باوربوينت|شرائح|سلايدات?|\bpresentation\b|powerpoint|\bslides?\b|\bdeck\b|keynote/i.test(task);
  // WEBSITE/APP INTENT — deliberately BROAD: "إنشاء موقع تعليمي", "اريد متجر", "صمم لعبة"… must all
  // BUILD real code, never fall to a consulting-style "answer" plan (activities instead of files).
  const buildsSite =
    /موقع|متجر|تطبيق|لعب[ةه]|منصة|واجه[ةه]|داشبورد|لوحة\s*تحكم|صفحة\s*هبوط|بوابة|نظام\s*إدار|website|web\s*site|webapp|web\s*app|landing\s*page|dashboard|storefront|\bstore\b|\bgame\b|\bsite\b|\bapp\b|portfolio|blog/i.test(task) &&
    /سو|اصنع|إصنع|ابن|إبن|أنش|انش|إنشاء|انشاء|اعمل|أعمل|عمل|صمم|تصميم|طور|تطوير|بناء|ابي|أبي|اريد|أريد|بغيت|build|creat|make|design|develop|generat/i.test(task);
  // An EXPLICIT document format (PDF/Word/Excel…) always wins; a generic "ملف" does NOT hijack a
  // website request ("سوي لي ملف موقع تعليمي" = the user wants the SITE, not a PDF about it).
  const explicitDocFmt = /pdf|بي\s*دي\s*اف|بدف|وورد|\bword\b|docx?|بوربوينت|powerpoint|pptx?|excel|اكسل|xlsx|csv/i.test(task);
  run.mode = resume ? (resume.mode || "answer")
    : (wantsDoc && (explicitDocFmt || !buildsSite)) ? "doc"
    : (ctx.prevProj && (codeSpec || buildsSite || followUp) && !oneFile) ? "project"
    : (ctx.prevCode && (codeSpec || buildsSite || followUp)) ? "codefile"
    : (codeSpec || buildsSite) ? (oneFile ? "codefile" : "project")
    : COURSE_EXAM ? "doc"
    : "answer";
  // A presentation is always a document deliverable (never a code build).
  if (run._deck && run.mode !== "project" && run.mode !== "codefile") run.mode = "doc";
  const sync = (persist) => { aiMsg.content = serializeAgentRun(run); onUpdate(run, persist); };
  sync(false);
  // ④ READ LINKS — if the task contains URLs, pull their readable text as source material FIRST.
  const urls = resume ? [] : (task.match(/https?:\/\/[^\s)"'<>]+/gi) || []).slice(0, 3);
  if (urls.length && !signal.aborted) {
    run.phase = "run"; sync(false);
    let urlCtx = "";
    for (const url of urls) {
      if (signal.aborted) break;
      try { const d = await agentFetchUrl(url); if (d && d.text) { urlCtx += "\n\n=== CONTENT OF " + (d.title ? d.title + " — " : "") + url + " ===\n" + d.text.slice(0, 12000); run.stats.searches++; } } catch (_) {}
    }
    if (urlCtx) taskCtx += "\n\nSOURCE FROM THE LINK(S) THE USER PROVIDED (use this as primary material):" + urlCtx;
  }
  // 1) PLAN — mode-specific decomposition (SKIPPED on resume — reuse the persisted plan/progress).
  if (resume) {
    run.title = resume.title || "";
    run.steps = (resume.steps || []).map((s) => ({ title: s.title, kind: s.kind, file: s.file || "", s: s.s === "done" ? "done" : "todo", out: s.s === "done" ? (s.out || "") : "", dom: s.dom }));
    if (!run.steps.length) { run.phase = "fail"; sync(true); return run; }
    const dz = run.steps.find((s) => s.kind === "design" && s.s === "done"); if (dz) run._design = dz.out;
    const webBuild = run.mode === "project" ? run.steps.some((s) => /\.html?$/i.test(s.file || "")) : /html|css|react|vue|svelte/i.test((codeSpec && codeSpec.lang) || "html");
    if (webBuild && !signal.aborted) { run._images = await agentGatherImages(task, run._design, signal); run.stats.images = run._images.length; }
    run.phase = "run"; sync(true);
  } else {
  const plannerSysTxt =
    run.mode === "project"
      ? (ctx.prevProj
        ? "You are Firas Agent's ARCHITECT EVOLVING an EXISTING multi-file project (its files are listed in the user message). Plan ONLY the files that must be UPDATED or newly ADDED to satisfy the new request (1-6 steps) — never re-plan files that don't change. EACH step = ONE file with a \"file\" field. Return ONLY valid JSON, step titles in the user's language: {\"title\":\"short task title\",\"steps\":[{\"title\":\"…\",\"kind\":\"code\",\"file\":\"path\"}]}"
        : "You are Firas Agent's ARCHITECT planning a MULTI-FILE PROJECT (a real folder the user downloads). Design a clean professional file structure of 3-14 files (e.g. index.html, css/styles.css, js/app.js, README.md — adapt to the task/stack; a big app warrants more files split by concern). MULTI-PAGE sites are welcome when they fit the task (about.html, products.html…). For a NON-WEB stack (Python tool/bot/API, Node server…) plan a proper runnable project instead: entry module, clean helper modules, requirements.txt or package.json, and README.md with run instructions. EACH step builds exactly ONE file and MUST carry a \"file\" field with its path. Order foundations first. Return ONLY valid JSON, step titles in the user's language: {\"title\":\"short project name\",\"steps\":[{\"title\":\"…\",\"kind\":\"code\",\"file\":\"path\"}]}")
      : run.mode === "codefile"
      ? "You are Firas Agent's ARCHITECT planning ONE COMPLETE single-file build, produced in SECTIONS that MERGE into a final file far larger and richer than any one-shot answer. SCALE the section count to the ambition: a small widget = 3-4 sections; a normal single-page app = 5-8 sections; a large, feature-rich single file = 9-12 sections. Order them: foundation & document skeleton → shared design tokens/base styles → EACH major section or feature as its own step → full styling/responsive polish → ALL JavaScript interactivity & state (split JS into 2-3 steps when the app is large). Never collapse a rich app into a few sections. Return ONLY valid JSON, titles in the user's language: {\"title\":\"…\",\"steps\":[{\"title\":\"…\",\"kind\":\"code\"}]}"
      : run._deck
      ? "You are Firas Agent's KEYNOTE DIRECTOR planning a PRESENTATION (a slide deck the user downloads as PowerPoint). Structure the talk as 3-6 STEPS, each a coherent SECTION of the presentation (e.g. 'المقدمة والسياق', 'المفهوم الأساسي', 'التطبيقات', 'الخلاصة والتوصيات') that will each produce several slides. Order it as a compelling narrative: hook/agenda → build-up sections → takeaways/close. Every step kind is 'write'. Return ONLY valid JSON, titles in the user's language: {\"title\":\"deck title\",\"steps\":[{\"title\":\"…\",\"kind\":\"write\"}]}"
      : "You are Firas Agent's MASTER PLANNER for a rich non-code deliverable (course, booklet, chapter set, research report, exam/worksheet, essay, study guide, or answer to a hard question). First silently identify the SUBJECT (math | physics/chem/science | writing EN/AR | exam/quiz | general knowledge). SIZE the task: a small ask = 3-4 steps; a normal deliverable = 5-9 steps; a LARGE one (a full course/booklet/multi-topic report, or an exam with many questions) = 10-16 steps — scale to the real scope, NEVER cram a big syllabus into a few steps. Design a COHERENT ARCHITECTURE before content: a course/booklet is ordered pedagogically (concept & theory → fully worked examples → practice problems → a dedicated ANSWER KEY / solutions step); an exam/worksheet makes question groups their own steps PLUS a separate detailed model-answer step; research is ordered (scope & key questions → evidence-gathering research steps → analysis → synthesis with citations). Every step = ONE substantial chunk of REAL content (a specific chapter, a named set of worked examples, questions 1-10) — never a vague activity like 'introduction' or 'explain the topic'. Choose each step's kind to match the work: research (needs fresh web facts) | solve (math/quantitative derivation) | draw (a figure/graph/diagram) | write (prose/answers/explanation) | code. Prefer 'solve' for anything with equations and 'draw' for anything that benefits from a figure. If this is an exam/worksheet/quiz, the FINAL step MUST be a complete ANSWER KEY with worked solutions. Return ONLY valid JSON, step titles in the user's language: {\"title\":\"short task title\",\"steps\":[{\"title\":\"…\",\"kind\":\"…\"}]}";
  let plan = null;
  try {
    const raw = await agentCall([
      { role: "system", content: plannerSysTxt },
      { role: "user", content: taskCtx.slice(0, 5500) + srcBlock(20000) + (ctx.prevProj ? "\n\nEXISTING PROJECT FILES:\n" + ctx.prevProj.files.map((f) => "- " + f.path + " (" + (f.content || "").length + " chars)").join("\n") : "") },
    ], "max", signal);
    const jm = raw.match(/\{[\s\S]*\}/);
    plan = jm ? JSON.parse(jm[0]) : null;
  } catch (_) { plan = null; }
  if (!plan || !Array.isArray(plan.steps) || !plan.steps.length) {
    plan = { title: task.slice(0, 60), steps: [{ title: ar ? "تنفيذ المهمة كاملة" : "Execute the full task", kind: run.mode === "project" || run.mode === "codefile" ? "code" : "write", file: run.mode === "project" ? "index.html" : "" }] };
  }
  run.title = String(plan.title || "").slice(0, 120);
  const MAX_STEPS = run.mode === "project" ? 14 : run.mode === "codefile" ? 12 : (run._mega ? 24 : 16);
  run.steps = plan.steps.slice(0, MAX_STEPS).map((s) => ({
    title: String(s.title || "").slice(0, 160),
    kind: /^(research|solve|draw|write|code)$/.test(s.kind) ? s.kind : (run.mode === "project" || run.mode === "codefile" ? "code" : "write"),
    file: run.mode === "project" ? String(s.file || "").replace(/[^\w./-]+/g, "-").replace(/^[/.]+/, "").slice(0, 80) : "",
    s: "todo", out: "",
  }));
  if (run.mode === "project") run.steps = run.steps.filter((s) => s.file).slice(0, 14);
  if (!run.steps.length) run.steps = [{ title: ar ? "تنفيذ المهمة" : "Execute the task", kind: "code", file: "index.html", s: "todo", out: "" }];
  // DESIGN-FIRST: builds get a design-system step BEFORE any file — palette, typography,
  // components, sections, data model — so every file follows ONE professional design.
  if ((run.mode === "project" && !ctx.prevProj) || (run.mode === "codefile" && !ctx.prevCode)) {
    run.steps.unshift({ title: ar ? "تصميم النظام والهوية البصرية" : "Design system & visual identity", kind: "design", file: "", s: "todo", out: "" });
  }
  run.phase = "run";
  sync(true);
  }
  // A DECK gets real web photos up front (doc mode has no design step) → slides can embed them.
  if (run._deck && !run._images && !signal.aborted) {
    try { run._images = await agentGatherImages(task, "", signal); run.stats.images = (run._images || []).length; } catch (_) {}
  }
  // 2) EXECUTE — step by step, each sees the plan + summaries of what's done
  const planList = run.steps.map((s, i) => (i + 1) + ". " + s.title).join("\n");
  const stepTier = () => "max";   // the Agent runs EVERYTHING on Max — its permanent engine
  const prevOutline = () => run.steps.filter((s) => s.s === "done").map((s, i) => "— " + s.title + ":\n" + s.out.slice(0, 1400)).join("\n\n").slice(0, 11000);
  // Build ONE step (prompts → model → store). Shared by the sequential and PARALLEL schedulers.
  const buildStep = async (i) => {
    const st = run.steps[i];
    if (st.s === "done") { if (st.kind === "design" && st.out) run._design = st.out; return; }   // resume: keep completed work
    if (signal.aborted) return;
    st.s = "run"; sync(false);
    let searchCtx = "";
    if (st.kind === "research") { searchCtx = await agentWebSearch(st.title + " " + task.slice(0, 120)); if (searchCtx) run.stats.searches++; }
    let sysTxt, usrTxt;
    const isWebFile = run.mode === "project" ? /\.(html?|css|jsx?|tsx?|vue|svelte)$/i.test(st.file || "") : /html|css|react|vue|svelte/i.test((codeSpec && codeSpec.lang) || "html");
    const SIZE_MANDATE = isWebFile ? SIZE_MANDATE_WEB : SIZE_MANDATE_CODE;
    const designSpec = run._design ? "\n\nDESIGN SYSTEM (follow it EXACTLY in every file):\n" + run._design.slice(0, 5000) : "";
    const imgSpec = (run._images && run._images.length) ? "\n\nREAL PHOTO URLS — use these EXACT https URLs for the hero and section/card photos where the design calls for imagery (they are real, relevant, reliable). Give each <img> width+height+object-fit:cover and an onerror hide; do NOT invent other image paths:\n" + run._images.map((u, i) => (i + 1) + ". " + u).join("\n") : "";
    if (st.kind === "design") {
      sysTxt = "You are Firas Agent's ART DIRECTOR + PRODUCT DESIGNER. Produce a COMPACT but complete DESIGN & PRODUCT SPEC the build will follow exactly: 1) visual identity (palette with hex values, typography pairing, spacing scale, border-radius/shadow style, animation personality), 2) full list of pages/sections with what each contains, 3) reusable components (buttons, cards, nav, forms…) with their look, 4) data model / interactive behaviors, 5) the image/asset strategy PER SECTION obeying the VISUAL POLICY. Make it DISTINCTIVE and premium — not a generic bootstrap look. Concise bullet spec, no code, no preamble." + VISUAL_POLICY + langRule;
      usrTxt = "THE TASK:\n" + task.slice(0, 3000) + srcBlock(6000) + "\n\nPLANNED FILES:\n" + run.steps.filter((s) => s.file).map((s) => "- " + s.file + " — " + s.title).join("\n");
    } else if (run.mode === "project") {
      const built = run.steps.filter((s) => s.s === "done" && s.file).map((s) => "===== " + s.file + " (already built) =====\n" + stripToCode(s.out).slice(0, 1800)).join("\n\n").slice(0, 10000);
      sysTxt = "You are Firas Agent building ONE FILE of a professional multi-file project. Output ONLY the COMPLETE, FINAL content of the file `" + st.file + "` in ONE fenced code block — no commentary, no omissions, never stop mid-file. PRODUCTION-GRADE; stay perfectly CONSISTENT with the design system and the other files (ids, classes, imports, paths)." + SIZE_MANDATE + TECH_BRAIN + (isWebFile ? VISUAL_POLICY : "") + langRule;
      const prevFile = ctx.prevProj ? (ctx.prevProj.files.find((x) => x.path === st.file) || null) : null;
      const siblings = run.steps.filter((s) => s.s === "done" && s.file && s.file !== st.file && s.kind !== "design").map((s) => { const c = stripToCode(s.out); const ids = [...c.matchAll(/id=["']([\w-]+)["']/g)].map((m) => m[1]); const cls = [...c.matchAll(/class=["']([^"']+)["']/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean); const fns = [...c.matchAll(/(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]); return "• " + s.file + " → ids[" + [...new Set(ids)].slice(0, 40).join(",") + "] classes[" + [...new Set(cls)].slice(0, 60).join(",") + "] symbols[" + [...new Set(fns)].slice(0, 40).join(",") + "]"; }).join("\n").slice(0, 4000);
      usrTxt = "THE TASK:\n" + taskCtx.slice(0, 4500) + srcBlock(15000) + designSpec + (/\.html?$/i.test(st.file || "") ? imgSpec : "") + "\n\nPROJECT FILES (plan):\n" + run.steps.filter((s) => s.file).map((s) => "- " + s.file + " — " + s.title).join("\n") + (built ? "\n\nFILES ALREADY BUILT:\n" + built : "") + (siblings ? "\n\nCROSS-FILE CONTRACT — this file MUST reference these EXACT ids/classes/symbols the sibling files already expose; use them precisely, and only ADD new ones, never rename an existing shared one:\n" + siblings : "") + (prevFile ? "\n\nCURRENT VERSION OF `" + st.file + "` (EVOLVE it — apply the new request, keep everything that should stay):\n" + String(prevFile.content || "").slice(0, 22000) : "") + "\n\nBUILD THIS FILE NOW, COMPLETE: " + st.file;
    } else if (run.mode === "codefile") {
      const built = prevOutline();
      sysTxt = "You are Firas Agent building ONE SECTION of a single-file deliverable (all sections get merged into ONE complete file at the end). Output ONLY this section's code in ONE fenced code block — consistent with the design system and the sections already built (same ids/classes)." + SIZE_MANDATE + TECH_BRAIN + (isWebFile ? VISUAL_POLICY : "") + langRule;
      usrTxt = "THE TASK:\n" + taskCtx.slice(0, 4500) + srcBlock(15000) + designSpec + imgSpec + (ctx.prevCode ? "\n\nTHE CURRENT FILE BEING EVOLVED (head):\n" + ctx.prevCode.slice(0, 8000) : "") + "\n\nFULL PLAN:\n" + planList + (built ? "\n\nSECTIONS ALREADY BUILT (stay consistent — do not repeat):\n" + built : "") + "\n\nBUILD SECTION " + (i + 1) + " NOW: " + st.title;
    } else if (run._deck) {
      // ④ DECK author — this step writes the SLIDES for one section, in the exact markdown the PPTX
      // engine parses: a '## Section' divider, then '### Slide' + 3-5 short bullets, optional one
      // ![alt](url) image from the provided photos, and a 'Notes:' presenter line per slide.
      const imgList = (run._images && run._images.length) ? "\n\nREAL PHOTO URLS you MAY place on slides (one per slide max, only where it fits; never invent others):\n" + run._images.map((u, k) => (k + 1) + ". " + u).join("\n") : "";
      sysTxt = "You are an ELITE keynote presentation designer (Apple/TED level) writing ONE SECTION of a larger deck. Output ONLY Markdown slides in EXACTLY this format:\n" +
        "• Start with '## " + (st.title || "Section") + "' ALONE on its line — it becomes a full-screen SECTION DIVIDER.\n" +
        "• Then 2-4 slides, each '### Slide Title' + 3-5 SHORT punchy bullets (≤10 words each — headlines, not paragraphs).\n" +
        "• On slides that benefit from a visual AND a photo URL is provided, put ONE image on its own line right under the title: ![short alt](URL). Never invent a URL.\n" +
        "• When a slide presents NUMBERS/statistics/comparisons/trends, add ONE line: Chart: {\"type\":\"bar|line|doughnut\",\"title\":\"…\",\"labels\":[\"…\"],\"data\":[numbers]} — it renders as an ANIMATED professional chart (and a real chart in PowerPoint). Use REAL plausible values; 1-3 chart slides per deck. A slide has a chart OR an image, never both.\n" +
        "• Add a 'Notes: <1-2 sentences the speaker says>' line to most slides — becomes hidden PowerPoint speaker notes.\n" +
        "Make the bullets specific and insightful, never filler. No preamble, no metadata, ONLY the slides." + AGENT_QUALITY.replace(/ FORMATTING:[\s\S]*$/, "") + langRule;
      usrTxt = "PRESENTATION TOPIC:\n" + taskCtx.slice(0, 3500) + srcBlock(20000) + "\n\nFULL DECK OUTLINE:\n" + planList + imgList + (prevOutline() ? "\n\nSECTIONS ALREADY WRITTEN (do not repeat their slides):\n" + prevOutline() : "") + "\n\nWRITE THE SLIDES FOR THIS SECTION NOW: " + st.title;
    } else {
      let dom = domainOf(st.title + " " + task);
      if (dom === "knowledge" && st.kind === "solve") dom = "math";
      else if (dom === "knowledge" && st.kind === "draw") dom = "science";
      st.dom = dom;
      const MEGA_MANDATE = run._mega ? " MEGA-BOOK CHAPTER: this is one chapter of a very large reference book — write it EXTREMELY long and complete (aim for 3500-5000+ words of real content: full explanations, many worked examples, tables, subsections). Never compress; length is a requirement." : "";
      sysTxt = "You are Firas Agent EXECUTING ONE STEP of a bigger plan. Produce the COMPLETE, final content for THIS step only — it will be assembled with the other steps into the deliverable." + AGENT_QUALITY + DEPTH_MANDATE + MEGA_MANDATE + (DOMAIN_GUIDE[dom] || "") + langRule;
      usrTxt = "THE TASK:\n" + taskCtx.slice(0, 4500) + srcBlock(60000) + "\n\nFULL PLAN:\n" + planList + (prevOutline() ? "\n\nALREADY COMPLETED (context — do not repeat):\n" + prevOutline() : "") + (searchCtx ? "\n\nFRESH WEB RESULTS (cite [1][2] where used):\n" + searchCtx : "") + "\n\nEXECUTE STEP " + (i + 1) + " NOW: " + st.title;
    }
    try {
      st.out = await agentCall([
        { role: "system", content: sysTxt },
        { role: "user", content: usrTxt },
      ], stepTier(st.kind), signal);
      st.s = "done";
      if (st.kind === "design") {
        run._design = st.out;   // every later file follows this spec
        // Right after design (before any file), gather REAL topic photos for a WEB build.
        const webBuild = run.mode === "project" ? run.steps.some((s) => /\.html?$/i.test(s.file || "")) : /html|css|react|vue|svelte/i.test((codeSpec && codeSpec.lang) || "html");
        if (webBuild && !run._images && !signal.aborted) {
          run._images = await agentGatherImages(task, run._design, signal);
          run.stats.images = run._images.length;
        }
      }
    } catch (e) {
      if (signal.aborted) { st.s = "todo"; return; }
      st.s = "fail"; st.out = "";
    }
    sync(true);
  };
  // 2b) SCHEDULER — a PROJECT builds its files IN PARALLEL (foundation .html first to fix the shared
  // ids/classes contract, then the rest 3-at-a-time) → ~2-3× faster. Other modes stay sequential
  // (their steps genuinely depend on each other in order).
  const fileSteps = run.steps.map((s, i) => ({ s, i })).filter((x) => x.s.file && x.s.kind !== "design");
  if (run.mode === "project" && fileSteps.length >= 3) {
    const foundationI = (fileSteps.find((x) => /\.html?$/i.test(x.s.file)) || fileSteps[0]).i;
    // prerequisites first: design + research + the foundation file (sequential)
    for (let i = 0; i < run.steps.length; i++) {
      const st = run.steps[i];
      if (st.kind === "design" || st.kind === "research" || i === foundationI) {
        await buildStep(i);
        if (signal.aborted) { run.phase = "stopped"; sync(true); return run; }
      }
    }
    // the remaining files — concurrently (each sees the design + the foundation file)
    const rest = fileSteps.map((x) => x.i).filter((i) => i !== foundationI && run.steps[i].s !== "done");
    let p = 0; const CONC = 2;   // 2 staggered lanes — 3 simultaneous calls tripped the engines' per-minute 429s
    const worker = async (w) => {
      if (w) await new Promise((r) => setTimeout(r, w * 2500));
      while (p < rest.length && !signal.aborted) { await buildStep(rest[p++]); }
    };
    await Promise.all(Array.from({ length: Math.min(CONC, rest.length) }, (_, w) => worker(w)));
    if (signal.aborted) { run.phase = "stopped"; sync(true); return run; }
  } else if ((run.mode === "doc" || run.mode === "answer") && run.steps.length >= 3) {
    // DOCS/ANSWERS run their content steps IN PARALLEL too (~3× faster) — each chapter/question-set
    // is independent. Only two orderings matter: RESEARCH feeds everyone (runs first), and a final
    // ANSWER KEY / solutions / conclusion needs the questions (runs last).
    const DEPENDENT = /answer\s*key|model\s*answers?|solutions?|مفتاح|الحلول|حلول\s|إجابات|الأجوبة|أجوبة|الخلاصة|خاتمة|conclusion|synthesis/i;
    for (let i = 0; i < run.steps.length; i++) {
      if (run.steps[i].kind === "research") {
        await buildStep(i);
        if (signal.aborted) { run.phase = "stopped"; sync(true); return run; }
      }
    }
    const mains = [], finals = [];
    run.steps.forEach((s, i) => {
      if (s.kind === "research" || s.s === "done") return;
      (DEPENDENT.test(s.title || "") || i === run.steps.length - 1 && run._courseExam ? finals : mains).push(i);
    });
    // Concurrency 2 with STAGGERED starts: the free-tier engines rate-limit per minute — three
    // simultaneous heavy calls made every provider return 429 and the mission crawled through
    // fallbacks. Two offset lanes keep the ~2× speedup without tripping the limits.
    let dp = 0; const DCONC = 2;
    const dworker = async (w) => {
      if (w) await new Promise((r) => setTimeout(r, w * 2500));
      while (dp < mains.length && !signal.aborted) { await buildStep(mains[dp++]); }
    };
    await Promise.all(Array.from({ length: Math.min(DCONC, Math.max(1, mains.length)) }, (_, w) => dworker(w)));
    if (signal.aborted) { run.phase = "stopped"; sync(true); return run; }
    for (const i of finals) {
      if (signal.aborted) { run.phase = "stopped"; sync(true); return run; }
      await buildStep(i);
    }
  } else {
    for (let i = 0; i < run.steps.length; i++) {
      if (signal.aborted) { run.phase = "stopped"; sync(true); return run; }
      await buildStep(i);
    }
  }
  // 3) SELF-REVIEW — catch broken LaTeX / lazy or missing content, re-run flagged steps once
  if (!signal.aborted && run.steps.some((s) => s.s === "done")) {
    run.phase = "verify"; sync(false);
    try {
      const rev = await agentCall([
        { role: "system", content: "You are Firas Agent's strict REVIEWER. Judge the step outputs against the task on TWO axes. (1) CORRECTNESS: spot-check the key derivation steps and the final result — is the math right? Are units, significant figures and dimensional analysis correct? Do chemical equations balance and physical laws apply correctly? For an exam/quiz, is every question answerable and is a COMPLETE answer key present? (2) COMPLETENESS & VALIDITY: flag any step that is incomplete, lazy, stubbed, off-task, or has unbalanced/invalid KaTeX or a broken ```plot/```tikz block. Return ONLY JSON: {\"ok\":true} or {\"redo\":[stepNumbers],\"notes\":\"precise, specific fixes incl. any wrong values\"}." },
        { role: "user", content: "TASK:\n" + task.slice(0, 1500) + "\n\n" + run.steps.map((s, i) => "STEP " + (i + 1) + " (" + s.title + "):\n" + s.out.slice(0, 2500)).join("\n\n---\n\n") },
      ], "max", signal);
      const jm = rev.match(/\{[\s\S]*\}/);
      const verdict = jm ? JSON.parse(jm[0]) : { ok: true };
      const redo = (!verdict.ok && Array.isArray(verdict.redo)) ? verdict.redo.slice(0, 3) : [];
      for (const n of redo) {
        const st = run.steps[n - 1];
        if (!st || signal.aborted) continue;
        st.s = "run"; sync(false);
        const prev = st.out;
        try {
          const redone = await agentCall([
            { role: "system", content: "You are Firas Agent REDOING one step after review." + AGENT_QUALITY + (DOMAIN_GUIDE[st.dom] || "") + langRule },
            { role: "user", content: "THE TASK:\n" + task.slice(0, 3000) + srcBlock(15000) + "\n\nREVIEWER'S FIXES TO APPLY:\n" + String(verdict.notes || "").slice(0, 1500) + "\n\nREDO STEP " + n + " COMPLETELY: " + st.title + "\n\nPREVIOUS (flawed) OUTPUT:\n" + prev.slice(0, 5000) },
          ], stepTier(st.kind), signal);
          // take the redo only if it isn't a regression (≥60% of prior length, or prior was a stub)
          if (redone && (redone.length >= prev.length * 0.6 || prev.length < 400)) st.out = redone;
          st.s = "done";
        } catch (_) { st.s = st.out ? "done" : "fail"; }
        sync(true);
      }
    } catch (_) { /* review is best-effort */ }
  }
  // Failed steps: one last direct retry so the deliverable is never missing a piece silently.
  for (let i = 0; i < run.steps.length; i++) {
    const st = run.steps[i];
    if (st.s !== "fail" || signal.aborted) continue;
    st.s = "run"; sync(false);
    try {
      st.out = await agentCall([
        { role: "system", content: "You are Firas Agent." + AGENT_QUALITY + (DOMAIN_GUIDE[st.dom] || "") + langRule },
        { role: "user", content: "TASK:\n" + task.slice(0, 3000) + srcBlock(30000) + "\n\nEXECUTE THIS PART COMPLETELY: " + st.title },
      ], "max", signal);
      st.s = "done";
    } catch (_) { st.s = "fail"; }
    sync(true);
  }
  // 3b) INDEPENDENT MATH CHECK — for solve/math/science steps, a SECOND independent derivation
  // compares results and replaces the step when it catches a real error (adversarial verification).
  if ((run.mode === "answer" || run.mode === "doc") && !signal.aborted) {
    const toCheck = run.steps.filter((s) => s.s === "done" && s.out && (s.kind === "solve" || s.dom === "math" || s.dom === "science")).slice(0, 4);
    if (toCheck.length) {
      run.phase = "verify"; sync(false);
      for (const st of toCheck) {
        if (signal.aborted) break;
        try {
          const check = await agentCall([
            { role: "system", content: "You are Firas Agent's independent MATH/SCIENCE CHECKER. FIRST re-derive the final result(s) of the given solution yourself, from scratch. THEN compare with the solution. If its final results and key steps are correct, reply with exactly: OK. If ANYTHING is wrong (a value, a sign, units, a skipped condition), reply with the FULL corrected solution — complete, same structure and language, valid KaTeX — and nothing else." },
            { role: "user", content: "TASK CONTEXT:\n" + task.slice(0, 1200) + srcBlock(8000) + "\n\nSTEP: " + st.title + "\n\nSOLUTION TO CHECK:\n" + st.out.slice(0, 9000) },
          ], "max", signal);
          run.stats.checks++;
          const v = (check || "").trim();
          if (v && v.toUpperCase() !== "OK" && v.length >= st.out.length * 0.5) { st.out = v; sync(true); }
        } catch (_) { /* checker is best-effort */ }
      }
    }
  }
  // 3c) ENRICH thin non-code steps — the same superpower the code path has: any step that came back
  // thin gets rewritten substantially deeper (courses/booklets/reports gain real mass here).
  if ((run.mode === "answer" || run.mode === "doc") && !signal.aborted) {
    const thin = run.steps.filter((s) => s.s === "done" && s.out && s.out.length < 2500).slice(0, 4);
    if (thin.length) {
      run.phase = "enhance"; sync(false);
      for (const st of thin) {
        if (signal.aborted) break;
        st.s = "run"; sync(false);
        try {
          const richer = await agentCall([
            { role: "system", content: "You are Firas Agent EXPANDING a step whose output is too thin for the quality bar. Rewrite it substantially DEEPER and more complete — a full specialist section (more worked detail, more examples, more precision), keeping everything that was correct." + AGENT_QUALITY + DEPTH_MANDATE + (DOMAIN_GUIDE[st.dom] || "") + langRule },
            { role: "user", content: "THE TASK:\n" + task.slice(0, 1500) + srcBlock(15000) + "\n\nSTEP: " + st.title + "\n\nCURRENT (too thin) OUTPUT:\n" + st.out + "\n\nREWRITE IT NOW, substantially deeper." },
          ], "max", signal);
          if (richer && richer.length > st.out.length) st.out = richer;
        } catch (_) { /* keep the original */ }
        st.s = "done"; sync(true);
      }
    }
  }
  // 4) ENHANCE — the agent's superpower over a one-shot chat: reopen EVERY built file and make
  // it dramatically richer and more polished (ultra tier), keeping full consistency.
  const ENHANCE_SYS = "You are Firas Agent's PRINCIPAL ENGINEER doing the final polish pass on a file that already works. Your job is to make it dramatically richer and more premium WITHOUT breaking or shrinking it. Rules: (1) OUTPUT A SUPERSET — the new file must contain everything the current one does, improved; never delete a feature, function, section, or piece of real content, and never truncate or stop mid-file. (2) PRESERVE EVERY PUBLIC CONTRACT — keep every id, class name, function name, exported symbol, route, and API shape byte-identical so sibling files keep working; follow the design system exactly. (3) ADD REAL DEPTH — expand thin sections with genuine content, refine spacing/typography, add tasteful animations and micro-interactions, handle edge cases and errors, and improve accessibility (labels, roles, focus, contrast). No lorem, no TODO, no placeholders. (4) VERIFY — before finishing, mentally trace the file end-to-end and confirm it is syntactically valid and behaves correctly. Output ONLY the complete, final file in ONE fenced code block, nothing else." + VISUAL_POLICY;
  if (run.mode === "project" && !signal.aborted) {
    run.phase = "enhance"; sync(false);
    for (const st of run.steps) {
      if (signal.aborted) break;
      if (st.s !== "done" || !st.file || st.kind === "design" || /\.(md|txt|json)$/i.test(st.file)) continue;
      const cur = stripToCode(st.out);
      const lang = (st.file.split(".").pop() || "").toLowerCase();
      const langN = lang === "htm" ? "html" : lang;
      const looksComplete = codeLooksComplete(cur, langN);
      const thin = cur.length < 1200 || /\bTODO\b|\bFIXME\b|placeholder(?!\s*[:=])|lorem ipsum|\/\* *\.\.\. *\*\//i.test(cur);
      if (looksComplete && !thin) continue;   // already good → don't waste a call / don't risk regressing a working file
      st.s = "run"; sync(false);
      try {
        const siblings = run.steps.filter((s) => s.s === "done" && s.file && s.file !== st.file && s.kind !== "design").map((s) => { const c = stripToCode(s.out); const ids = [...c.matchAll(/id=["']([\w-]+)["']/g)].map((m) => m[1]); const cls = [...c.matchAll(/class=["']([^"']+)["']/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean); const fns = [...c.matchAll(/(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]); return "• " + s.file + " → ids[" + [...new Set(ids)].slice(0, 40).join(",") + "] classes[" + [...new Set(cls)].slice(0, 60).join(",") + "] symbols[" + [...new Set(fns)].slice(0, 40).join(",") + "]"; }).join("\n").slice(0, 4000);
        const sys = (!looksComplete)
          ? "You are Firas Agent COMPLETING a file that was cut off. Output the ENTIRE finished file in ONE fenced code block, keeping all existing ids/classes/APIs, adding only what is missing to make it whole. Never stop mid-file."
          : ENHANCE_SYS;
        const enhanced = await agentCall([
          { role: "system", content: sys },
          { role: "user", content: "THE TASK:\n" + task.slice(0, 1500) + (run._design ? "\n\nDESIGN SYSTEM:\n" + run._design.slice(0, 4000) : "") + (siblings ? "\n\nCROSS-FILE CONTRACT — the OTHER files depend on these EXACT ids/classes/symbols; preserve every id/class/selector/function this file already shares with them, only ADD, never rename:\n" + siblings : "") + "\n\nFILE `" + st.file + "` — CURRENT VERSION:\n" + cur.slice(0, 30000) + "\n\nFINISH/ENRICH IT NOW (complete file)." },
        ], "max", signal);
        const code = stripToCode(enhanced);
        // accept only if it plausibly contains the whole file AND is itself complete (guards lazy/truncated rewrites)
        if (code.length >= cur.length * 0.7 && codeLooksComplete(code, langN)) st.out = "```\n" + code + "\n```";
      } catch (_) { /* keep the original */ }
      st.s = "done"; sync(true);
    }
  }
  // 5) ASSEMBLE — merge sections into ONE polished file / collect the project's files
  if (run.mode === "codefile" && !signal.aborted && run.steps.some((s) => s.s === "done" && s.kind !== "design")) {
    run.phase = "assemble"; sync(false);
    try {
      const merged = await agentCall([
        { role: "system", content: "You are Firas Agent's INTEGRATOR. Merge the section outputs into ONE complete, coherent, production-quality file. Include EVERYTHING from every section (deduplicate overlapping boilerplate, unify the design system), fix any inconsistency, and output ONLY the final file in ONE fenced code block — no commentary, never stop mid-file." + VISUAL_POLICY + langRule },
        { role: "user", content: "THE TASK:\n" + taskCtx.slice(0, 3000) + (run._design ? "\n\nDESIGN SYSTEM (the file must follow it):\n" + run._design.slice(0, 4000) : "") + (ctx.prevCode ? "\n\nCURRENT FILE (the BASE — merge the sections/changes INTO it, keep everything that should stay):\n" + ctx.prevCode.slice(0, 40000) : "") + "\n\nSECTIONS TO MERGE:\n" + run.steps.filter((s) => s.s === "done" && s.kind !== "design").map((s, i) => "===== SECTION " + (i + 1) + ": " + s.title + " =====\n" + stripToCode(s.out)).join("\n\n").slice(0, 120000) },
      ], "max", signal);
      // Code lang of the deliverable (html unless the task named another language) — so the
      // completeness check below applies the RIGHT close-rule (</html> vs balanced braces).
      const codeLang = (codeSpec && codeSpec.lang) || "html";
      const codeReq = codeSpec || { lang: "html", ext: "html", label: "HTML", filename: "index" };
      run._code = stripToCode(merged);
      // The integrator input can exceed what the model can echo back (up to ~100KB in, output
      // capped) — so the merge may STREAM large yet stop mid-file. Length alone can't catch that:
      // require actual completeness, and if it's cut off, first try the proven continuation
      // machinery, then fall back to the complete naive concat of the sections.
      if (run._code.length < 400 || !codeLooksComplete(run._code, codeLang)) {
        if (run._code.length >= 400 && !signal.aborted) {
          try {
            const finished = await autoCompleteCode(run._code, codeReq, [], run.lang, signal, null);
            if (finished && finished.length >= run._code.length) run._code = finished;
          } catch (_) { /* fall through to naive concat */ }
        }
        if (!codeLooksComplete(run._code, codeLang)) {
          const naive = run.steps.filter((s) => s.s === "done" && s.kind !== "design").map((s) => stripToCode(s.out)).join("\n\n");
          if (naive.length > run._code.length) run._code = naive;
        }
      }
      if (run._code.length < 400) throw new Error("merge too small");
      // polish pass on the merged single file too — keep the rewrite ONLY if it's ~as large AND
      // actually complete, so a truncated "richer" rewrite can never replace a whole file.
      if (!signal.aborted) {
        run.phase = "enhance"; sync(false);
        try {
          const enhanced = await agentCall([
            { role: "system", content: ENHANCE_SYS },
            { role: "user", content: "THE TASK:\n" + task.slice(0, 1500) + "\n\nTHE FILE — CURRENT VERSION:\n" + run._code.slice(0, 120000) + "\n\nREWRITE IT RICHER NOW (complete file)." },
          ], "max", signal);
          const code = stripToCode(enhanced);
          if (code.length >= run._code.length * 0.8 && codeLooksComplete(code, codeLang)) run._code = code;
        } catch (_) { /* keep merged */ }
      }
    } catch (_) {
      // integrator failed → naive but complete merge so the user still gets the whole build
      run._code = run.steps.filter((s) => s.s === "done" && s.kind !== "design").map((s) => stripToCode(s.out)).join("\n\n");
    }
  }
  if (run.mode === "project") {
    run._files = run.steps.filter((s) => s.s === "done" && s.file && s.out).map((s) => ({ path: s.file, content: stripToCode(s.out) }));
  }
  // 4b) SELF-TEST & FIX LOOP — the agent's QA lab. Each round it: RUNS the app (runtime errors on
  // EVERY page), CLICKS through it like a real user (interaction errors + dead buttons), LOOKS at it
  // (visual defects), and LINTS it deterministically (broken links/ids/references). Then it fixes the
  // exact findings and RE-TESTS — up to 3 rounds, delivering only when clean (or rounds exhausted).
  if (!signal.aborted && typeof testHtmlInSandbox === "function") {
    try {
      const isWebDeliverable = (run.mode === "codefile" && run._code && /<\s*(!doctype|html|body|script)/i.test(run._code)) ||
        (run.mode === "project" && run._files && run._files.length && run._files.some((f) => /\.html?$/i.test(f.path)));
      if (isWebDeliverable) {
        run.phase = "test"; sync(false);
        const applyFix = (tf, fixed, statKey) => {
          const fx = stripToCode(fixed);
          const vLang = tf ? (tf.path.split(".").pop() || "").toLowerCase() : "html";
          if (tf) {
            if (fx.length >= tf.content.length * 0.8 && codeLooksComplete(fx, vLang === "htm" ? "html" : vLang)) {
              tf.content = fx; run.stats[statKey]++;
              const stX = run.steps.find((s) => s.file === tf.path);
              if (stX) stX.out = "```\n" + fx + "\n```";
              return true;
            }
          } else if (fx.length >= run._code.length * 0.8 && codeLooksComplete(fx, "html")) { run._code = fx; run.stats[statKey]++; return true; }
          return false;
        };
        for (let round = 0; round < 3 && !signal.aborted; round++) {
          // ── GATHER every kind of issue this round ──
          let runtime = [], interact = [], visual = [], lint = [];
          if (run.mode === "codefile") {
            runtime = await testHtmlInSandbox(run._code, 2500);
            if (!signal.aborted) interact = await interactionTestInSandbox(run._code, 6000);
            if (!signal.aborted) visual = await visualAuditInSandbox(run._code, 4000);
            if (!signal.aborted) visual = visual.concat(await visualAuditInSandbox(run._code, 3600, 380));   // mobile pass
            lint = lintProject([{ path: "index.html", content: run._code }]).filter((x) => !/UNREFERENCED/.test(x));
          } else {
            const pages = run._files.filter((f) => /\.html?$/i.test(f.path)).slice(0, 4);
            for (const pg of pages) {
              if (signal.aborted) break;
              const doc = projPreviewHtml({ name: "t", files: run._files }, pg.path);
              if (!doc) continue;
              const errs = await testHtmlInSandbox(doc, 2200);
              errs.forEach((e) => runtime.push("[" + pg.path + "] " + e));
              const vis = await visualAuditInSandbox(doc, 3600);
              vis.forEach((v) => visual.push("[" + pg.path + "] " + v));
              // MOBILE pass — most Arabic users browse on phones; catch 380px overflow/overlap too.
              if (!signal.aborted) {
                const visM = await visualAuditInSandbox(doc, 3200, 380);
                visM.forEach((v) => visual.push("[" + pg.path + "] " + v));
              }
            }
            if (!signal.aborted) {
              const idxDoc = projPreviewHtml({ name: "t", files: run._files });
              if (idxDoc) interact = await interactionTestInSandbox(idxDoc, 6000);
            }
            lint = lintProject(run._files);
          }
          const all = [...runtime, ...interact, ...lint, ...visual];
          if (!all.length || signal.aborted) break;   // CLEAN → deliver
          run.stats.checks += all.length;
          // ── FIX: route the findings to the files that own them ──
          const FIXER_SYS = (p) => "You are Firas Agent's QA FIXER. The app was RUN, CLICKED THROUGH like a real user, MEASURED visually, and LINTED — the exact findings are listed. Fix EVERY finding this file can fix" + (p ? " (`" + p + "`)" : "") + ": wire dead buttons to REAL working behavior, resolve interaction/runtime errors, repair broken links/ids/references, and correct the visual defects. Surgical changes only — delete no content, keep every id/class/function name so sibling files keep working." + VISUAL_POLICY + " Output the COMPLETE fixed file in ONE fenced code block, never stop mid-file.";
          const findingsTxt = "QA FINDINGS (round " + (round + 1) + "):\n" + all.slice(0, 18).map((e, i) => (i + 1) + ". " + e).join("\n");
          if (run.mode === "codefile") {
            const fixed = await agentCall([
              { role: "system", content: FIXER_SYS("") },
              { role: "user", content: findingsTxt + "\n\nTHE FILE:\n" + run._code.slice(0, 120000) },
            ], "max", signal);
            if (!applyFix(null, fixed, "fixes")) break;   // fix rejected → avoid a futile loop
          } else {
            const htmlF = run._files.find((f) => /(^|\/)index\.html?$/i.test(f.path)) || run._files.find((f) => /\.html?$/i.test(f.path));
            const cssF = run._files.filter((f) => /\.css$/i.test(f.path)).sort((a, b) => b.content.length - a.content.length)[0];
            const jsF = run._files.filter((f) => /\.m?js$/i.test(f.path)).sort((a, b) => b.content.length - a.content.length)[0];
            const targets = [];
            if ([...runtime, ...interact].length && jsF) targets.push(jsF);
            // ANY specific HTML page that owns a finding → fix that exact page (multi-page apps).
            run._files.filter((f) => /\.html?$/i.test(f.path)).forEach((pf) => {
              if (all.some((v) => v.includes("[" + pf.path + "]") || v.includes(" in " + pf.path)) && !targets.includes(pf)) targets.push(pf);
            });
            if ([...lint, ...visual, ...interact].some((v) => /BROKEN IMAGE|BROKEN LINK|MISSING|DEAD ANCHORS|alt attribute|DEAD BUTTON/i.test(v)) && htmlF && !targets.includes(htmlF)) targets.push(htmlF);
            if (visual.some((v) => /OVERFLOW|OVERLAP/i.test(v))) { const t = cssF || htmlF; if (t && !targets.includes(t)) targets.push(t); }
            if (!targets.length && htmlF) targets.push(htmlF);
            let anyApplied = false;
            for (const tf of targets.slice(0, 3)) {
              if (signal.aborted) break;
              const fixed = await agentCall([
                { role: "system", content: FIXER_SYS(tf.path) },
                { role: "user", content: findingsTxt + "\n\nPROJECT FILES: " + run._files.map((f) => f.path).join(", ") + (run._design ? "\n\nDESIGN SYSTEM:\n" + run._design.slice(0, 2000) : "") + "\n\nTHE FILE `" + tf.path + "`:\n" + tf.content.slice(0, 60000) },
              ], "max", signal);
              if (applyFix(tf, fixed, /OVERFLOW|OVERLAP|BROKEN IMAGE/.test(findingsTxt) && tf === cssF ? "visual" : "fixes")) anyApplied = true;
            }
            if (!anyApplied) break;   // nothing landed → avoid a futile loop
          }
          sync(true);
        }
      }
    } catch (_) { /* self-test is best-effort — never blocks delivery */ }
  }
  // 4b-py) RUN PYTHON — the agent actually EXECUTES the Python it wrote (Pyodide, stdlib-only) and
  // fixes real tracebacks. Loop ≤2 rounds. Applies to a single .py codefile or the entry .py of a project.
  if (!signal.aborted && typeof runPythonInSandbox === "function") {
    try {
      const isPyCodefile = run.mode === "codefile" && run._code && (/python/i.test((codeSpec && codeSpec.lang) || "") || /\.py$/i.test((codeSpec && ("x." + codeSpec.ext)) || "") || (/^\s*(?:import |from |def |print\(|class )/m.test(run._code) && !/<html|<!doctype/i.test(run._code)));
      const pyFile = run.mode === "project" && run._files ? (run._files.find((f) => /(^|\/)(main|app|run|__main__)\.py$/i.test(f.path)) || run._files.find((f) => /\.py$/i.test(f.path))) : null;
      const getPy = () => isPyCodefile ? run._code : (pyFile ? pyFile.content : null);
      const setPy = (v) => { if (isPyCodefile) run._code = v; else if (pyFile) { pyFile.content = v; const s = run.steps.find((s) => s.file === pyFile.path); if (s) s.out = "```\n" + v + "\n```"; } };
      if (getPy()) {
        run.phase = "test"; sync(false);
        for (let r = 0; r < 2 && !signal.aborted; r++) {
          const res = await runPythonInSandbox(getPy(), 8000);
          if (res.skipped || res.ok || !res.err || signal.aborted) break;
          run.stats.checks++;
          const fixed = await agentCall([
            { role: "system", content: "You are Firas Agent's PYTHON DEBUGGER. Your script was RUN and raised the traceback below. Fix EXACTLY that error with minimal surgical changes — keep all working logic, change nothing else. Output the COMPLETE fixed script in ONE fenced code block, never stop mid-file." },
            { role: "user", content: "TRACEBACK:\n" + res.err + "\n\nTHE SCRIPT:\n" + getPy().slice(0, 60000) },
          ], "max", signal);
          const fx = stripToCode(fixed);
          if (fx.length >= getPy().length * 0.6 && /[)\]:"'\w]\s*$/.test(fx)) { setPy(fx); run.stats.fixes++; } else break;
          sync(true);
        }
      }
    } catch (_) { /* python run is best-effort */ }
  }
  // 4c) FINAL QUALITY GATE — an independent examiner grades the deliverable /10; below 8 the agent
  // does ONE targeted improvement pass on the weakest part, then re-grades. The badge goes on the report.
  if (!signal.aborted) {
    try {
      const summarize = () => run.mode === "project"
        ? run._files.map((f) => "===== " + f.path + " =====\n" + String(f.content).slice(0, 1400)).join("\n\n").slice(0, 22000)
        : run.mode === "codefile"
        ? String(run._code || "").slice(0, 22000)
        : run.steps.filter((s) => s.s === "done").map((s, i) => "STEP " + (i + 1) + " (" + s.title + "):\n" + s.out.slice(0, 1600)).join("\n\n").slice(0, 22000);
      const GRADER_SYS = "You are a HARSH independent EXAMINER grading a finished deliverable against the user's task. Score 1-10 overall (completeness, correctness, depth, polish; for apps: does everything plausibly WORK?). 9-10 = truly exceptional; 8 = solid professional; below 8 = has real weaknesses. Identify the SINGLE weakest part. Return ONLY JSON: {\"score\": n, \"weakest\": \"<file path OR step number>\", \"notes\": \"the specific weaknesses to fix\"}.";
      const gradeOnce = async () => {
        const g = await agentCall([
          { role: "system", content: GRADER_SYS },
          { role: "user", content: "THE TASK:\n" + task.slice(0, 1500) + "\n\nTHE DELIVERABLE:\n" + summarize() },
        ], "max", signal);
        const jm = g.match(/\{[\s\S]*\}/); const o = jm ? JSON.parse(jm[0]) : null;
        return (o && o.score >= 1 && o.score <= 10) ? o : null;
      };
      let verdict = await gradeOnce();
      if (verdict && verdict.score < 8 && !signal.aborted) {
        run.phase = "enhance"; sync(false);
        const notes = String(verdict.notes || "").slice(0, 1200);
        if (run.mode === "project" && run._files && run._files.length) {
          const tf = run._files.find((f) => f.path === String(verdict.weakest || "")) || run._files.slice().sort((a, b) => a.content.length - b.content.length)[0];
          const better = await agentCall([
            { role: "system", content: "You are Firas Agent RAISING a file to excellence after an examiner flagged weaknesses. Fix every noted weakness while keeping ALL existing content, ids, classes and function names (superset only)." + VISUAL_POLICY + " Output the COMPLETE improved `" + tf.path + "` in ONE fenced code block, never stop mid-file." },
            { role: "user", content: "THE TASK:\n" + task.slice(0, 1200) + "\n\nEXAMINER'S WEAKNESSES:\n" + notes + "\n\nTHE FILE `" + tf.path + "`:\n" + tf.content.slice(0, 60000) },
          ], "max", signal);
          const fx = stripToCode(better);
          const gl = (tf.path.split(".").pop() || "").toLowerCase();
          if (fx.length >= tf.content.length * 0.8 && codeLooksComplete(fx, gl === "htm" ? "html" : gl)) {
            tf.content = fx;
            const stG = run.steps.find((s) => s.file === tf.path); if (stG) stG.out = "```\n" + fx + "\n```";
          }
        } else if (run.mode === "codefile" && run._code) {
          const better = await agentCall([
            { role: "system", content: "You are Firas Agent RAISING a file to excellence after an examiner flagged weaknesses. Fix every noted weakness while keeping ALL existing content and public names (superset only). Output the COMPLETE improved file in ONE fenced code block, never stop mid-file." },
            { role: "user", content: "THE TASK:\n" + task.slice(0, 1200) + "\n\nEXAMINER'S WEAKNESSES:\n" + notes + "\n\nTHE FILE:\n" + run._code.slice(0, 100000) },
          ], "max", signal);
          const fx = stripToCode(better);
          if (fx.length >= run._code.length * 0.8 && codeLooksComplete(fx, "html")) run._code = fx;
        } else {
          const n = parseInt(verdict.weakest, 10);
          const st = (n >= 1 && run.steps[n - 1] && run.steps[n - 1].s === "done") ? run.steps[n - 1]
            : run.steps.filter((s) => s.s === "done" && s.out).sort((a, b) => a.out.length - b.out.length)[0];
          if (st) {
            const better = await agentCall([
              { role: "system", content: "You are Firas Agent RAISING one section to excellence after an examiner flagged weaknesses. Rewrite it fixing every noted weakness — deeper, more precise, more complete — keeping everything that was correct." + AGENT_QUALITY + (DOMAIN_GUIDE[st.dom] || "") + langRule },
              { role: "user", content: "THE TASK:\n" + task.slice(0, 1200) + srcBlock(10000) + "\n\nEXAMINER'S WEAKNESSES:\n" + notes + "\n\nSTEP: " + st.title + "\n\nCURRENT OUTPUT:\n" + st.out.slice(0, 12000) },
            ], "max", signal);
            if (better && better.length >= st.out.length * 0.7) st.out = better;
          }
        }
        const second = await gradeOnce();
        if (second) verdict = second.score > verdict.score ? second : verdict;
      }
      if (verdict) run.stats.score = Math.round(verdict.score);
    } catch (_) { /* grading is best-effort */ }
  }
  // 5) DELIVER — finalize the run report (files / lines / self-fixes / images / time).
  run.phase = "done";
  const codeBlob = run.mode === "codefile" ? (run._code || "") : run.mode === "project" ? (run._files || []).map((f) => f.content).join("\n") : "";
  if (run.mode === "project") run.stats.files = (run._files || []).length;
  else if (run.mode === "codefile") run.stats.files = 1;
  else run.stats.files = run.steps.filter((s) => s.s === "done" && s.kind !== "design").length;
  run.stats.lines = codeBlob ? codeBlob.split("\n").length : run.steps.reduce((n, s) => n + (s.out ? s.out.split("\n").length : 0), 0);
  run.stats.elapsed = Math.max(1, Math.round((Date.now() - (run.stats.startedAt || Date.now())) / 1000));
  run.final =
    run.mode === "codefile" ? (ar ? "اكتمل البناء ✓ — الكود الكامل تحت 👇" : "Build complete ✓ — the full code is below 👇")
    : run.mode === "project" ? (ar ? "اكتمل المشروع ✓ — الفولدر الجاهز تحت 👇" : "Project complete ✓ — your folder is below 👇")
    : run.mode === "doc" ? (ar ? "اكتملت المهمة ✓ — الملف الجاهز تحت 👇" : "Task complete ✓ — your file is below 👇")
    : (ar ? "اكتملت المهمة ✓ — افتح الخطوات أعلاه لقراءة كل جزء." : "Task complete ✓ — open the steps above to read each part.");
  sync(true);
  return run;
}
/** Resume a stopped/failed mission from its persisted run — continues the remaining steps only. */
function resumeAgentRun(chat, resumeRun) {
  if (!chat || !resumeRun || !Array.isArray(resumeRun.steps) || activeStreams.has(chat.id)) return;
  runAgentAssistant(chat, "max", resumeRun.lang || chat.lang || state.lang, resumeRun);
}
/** Agent-mode assistant turn: plan → execute → verify → deliver, streamed into a live plan card. */
async function runAgentAssistant(chat, tier, replyLang, resumeRun) {
  const lastUser = [...chat.messages].reverse().find((m) => m.role === "user");
  let task = resumeRun ? String(resumeRun.task || "") : (lastUser ? String(lastUser.content || "") : "");
  // If we JUST asked clarifying questions, THIS message is the user's answers — fold them into the
  // ORIGINAL request so planning + mode detection use the full intent.
  const luIdx = chat.messages.lastIndexOf(lastUser);
  const prevAsk = !resumeRun && luIdx > 0 && chat.messages[luIdx - 1].role === "assistant" && /```\s*firas-ask/.test(chat.messages[luIdx - 1].content || "");
  if (prevAsk) {
    let orig = "";
    for (let i = luIdx - 2; i >= 0; i--) { if (chat.messages[i].role === "user") { orig = String(chat.messages[i].content || ""); break; } }
    if (orig) task = orig + "\n\n[إجابات المستخدم على أسئلة التوضيح — راعِها بدقة]:\n" + task;
  }
  const alreadyAsked = chat.messages.some((m) => m.role === "assistant" && /```\s*firas-ask/.test(m.content || ""));
  // CONTINUITY: a follow-up request CONTINUES the mission — the agent sees every prior request,
  // the previous run's plan, and the previously delivered project/code, and EVOLVES them.
  const ctx = { history: "", prevProj: null, prevCode: "", prevCodeMeta: null, prevRunTitle: "", memory: [] };
  try { ctx.memory = await agentUserMemory(); } catch (_) {}   // start knowing the user
  const priorUsers = chat.messages.filter((m) => m.role === "user").slice(0, -1);
  if (priorUsers.length) ctx.history = priorUsers.map((m) => "• " + String(m.content || "").slice(0, 350)).join("\n").slice(0, 2500);
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    const m = chat.messages[i];
    if (m.role !== "assistant") continue;
    if (!ctx.prevProj) { const p = parseProjectMeta(m.content); if (p) ctx.prevProj = p; }
    if (!ctx.prevCode && /^```firas-code /.test(m.content || "")) { ctx.prevCode = stripToCode(m.content).slice(0, 45000); const _cm = parseCodeMeta(m.content); if (_cm) ctx.prevCodeMeta = { filename: _cm.filename, lang: _cm.lang, ext: _cm.ext, label: _cm.label }; }
    if (!ctx.prevRunTitle) { const r = parseAgentMeta(m.content); if (r && r.title) ctx.prevRunTitle = r.title; }
    if (ctx.prevProj && ctx.prevCode && ctx.prevRunTitle) break;
  }
  const aiMsg = { role: "assistant", content: "", reasoning: "", tier, lang: replyLang, mode: state.mode };
  chat.messages.push(aiMsg);
  autoScroll = true;
  renderThread(chat, true);
  const controller = new AbortController();
  activeStreams.set(chat.id, { controller, aiMsg });
  beginStreaming(chat.id);
  // ⑤ ATTACHMENTS — the Agent now READS what the user attached (screenshots/designs, PDFs, text files)
  // and folds their content into the task, so both planning and building actually USE them. Screenshot
  // + a build request ("مثل هذا الموقع" / "rebuild this") → a UI blueprint the agent replicates in code.
  // FILE TEXT (PDF/code/text) is carried SEPARATELY as ctx.fileText — never appended to the task
  // string: every agent prompt slices the task short (1.2K-4.5K), so an appended PDF was silently
  // cut off and the agent never really read it. ctx.fileText is injected as its own source block
  // into planning + every content step (same full-read behaviour as normal Firas AI chat), and is
  // collected from EVERY user turn (like normal chat, which re-sends each turn's fileText) — so a
  // file attached before clarify answers, or earlier in the mission, is never lost.
  {
    let allFiles = "";
    for (const m of chat.messages) {
      if (m.role === "user" && m.fileText) allFiles += (allFiles ? "\n\n" : "") + String(m.fileText);
    }
    if (allFiles) ctx.fileText = allFiles.length > MAX_TOTAL_FILE_CHARS ? allFiles.slice(-MAX_TOTAL_FILE_CHARS) : allFiles;
  }
  if (!resumeRun && lastUser && !prevAsk) {
    const att = Array.isArray(lastUser.images) ? lastUser.images : null;
    if ((att && att.length) || lastUser.fileText) {
      aiMsg.content = serializeAgentRun({ task, title: "", phase: "read", lang: replyLang, steps: [], final: "", mode: "answer" });
      if (activeChat() === chat) renderThread(chat);
      if (att && att.length && !controller.signal.aborted) {
        const wantsBuild = /موقع|صفحة|واجهة|تطبيق|مثل\s*(هذا|هذه|الصورة)|نفس\s*(التصميم|الشكل)|أعِد\s*بناء|اعد\s*بناء|صمّ?م|clone|like\s*(this|the\s*image)|rebuild|recreate|website|landing|\bpage\b|\bapp\b|\bui\b|design|screenshot/i.test(task);
        let vis = "";
        try { vis = await agentVisionRead(att, task, replyLang, wantsBuild, controller.signal); } catch (_) {}
        if (vis && wantsBuild) task += "\n\n=== مرجع بصري مرفق — المستخدم أرفق تصميمًا/لقطة شاشة؛ أعِد بناءه في كود حقيقي بأقصى تطابق (نفس التخطيط والألوان والمكوّنات والنصوص) / ATTACHED VISUAL REFERENCE — REBUILD it in real code as closely as possible (same layout, colors, components, copy): ===\n" + vis.slice(0, 12000);
        else if (vis) task += "\n\n=== محتوى الصورة/الصور المرفقة (مصدر) / ATTACHED IMAGE CONTENT (source) ===\n" + vis.slice(0, 30000);
      }
    }
  }
  // ── LIVE DECK — during a presentation build every finished section's slides stream into ONE
  // deck card in the chat (phase "building": visible, editing locked). At completion the same
  // card flips to "done" and unlocks editing. This IS the deliverable message.
  let deckMsg = null;
  const deckFromRun = (run) => {
    const slides = [];
    run.steps.forEach((st) => {
      if (st.s === "done" && st.out && st.kind !== "design") {
        slidesFromMarkdown(st.out, st.title).forEach((sl) => slides.push({ t: sl.section ? "section" : "slide", title: sl.title, bullets: sl.bullets, image: sl.image, imageAlt: sl.imageAlt, notes: sl.notes, chart: sl.chart }));
      }
    });
    // stopped/fail also UNLOCK the deck — what was built stays editable, never locked forever.
    return { v: 1, title: run.title || task.slice(0, 60), subtitle: "", theme: "navy", lang: replyLang, phase: (run.phase === "done" || run.phase === "stopped" || run.phase === "fail") ? "done" : "building", slides };
  };
  const updateLiveDeck = (run, persist) => {
    const deck = deckFromRun(run);
    if (!deck.slides.length) return;
    // RESUME: reuse the deck card the interrupted run already created (never a duplicate).
    if (!deckMsg && resumeRun) deckMsg = [...chat.messages].reverse().find((m) => m.role === "assistant" && /^\s*```firas-deck/.test(m.content || "")) || null;
    if (!deckMsg) {
      deckMsg = { role: "assistant", content: serializeDeck(deck), reasoning: "", tier, lang: replyLang, mode: state.mode };
      chat.messages.push(deckMsg);
      if (activeChat() === chat) renderThread(chat, true);
    } else {
      deckMsg.content = serializeDeck(deck);
      if (activeChat() === chat) {
        const dIdx = chat.messages.indexOf(deckMsg);
        const dBody = els.thread.querySelector(`.msg-ai[data-index="${dIdx}"] .msg-ai__body`);
        const dNode = dBody && dBody.querySelector(".md");
        if (dNode) { dNode.innerHTML = ""; dNode.appendChild(buildDeckCard(parseDeckMeta(deckMsg.content), replyLang, deckMsg)); }
        else renderThread(chat, true);
      }
    }
    if (persist) { chat.updatedAt = Date.now(); persistChat(chat); }
  };
  const rerenderCard = (run, persist) => {
    if (run && run._deck && run.mode === "doc") { try { updateLiveDeck(run, persist); } catch (_) {} }
    if (activeChat() === chat) {
      const idx = chat.messages.indexOf(aiMsg);
      const bodyEl = els.thread.querySelector(`.msg-ai[data-index="${idx}"] .msg-ai__body`);
      const node = bodyEl && bodyEl.querySelector(".md");
      if (node) {
        // Preserve open/closed state of step disclosures across live re-renders.
        const openSet = new Set([...node.querySelectorAll(".agent-step__det[open]")].map((d) => d.querySelector(".agent-step__t") && d.querySelector(".agent-step__t").textContent));
        node.innerHTML = "";
        const card = buildAgentCard(run, replyLang);
        card.querySelectorAll(".agent-step__det").forEach((d) => { const t = d.querySelector(".agent-step__t"); if (t && openSet.has(t.textContent)) d.open = true; });
        node.appendChild(card);
        // ③ LIVE PREVIEW — a project build renders INTO a persistent sandboxed iframe (sibling of .md,
        // so the card re-render never reloads it) that updates as each file lands. Flicker-free: the
        // srcdoc is only reset when the content actually changed.
        if (run.mode === "project" && run.phase !== "done") {
          const files = run.steps.filter((s) => s.s === "done" && s.file && s.out && /\.(html?|css|js)$/i.test(s.file)).map((s) => ({ path: s.file, content: stripToCode(s.out) }));
          if (files.some((f) => /(^|\/)index\.html?$/i.test(f.path)) && typeof projPreviewHtml === "function") {
            let pv = bodyEl.querySelector(".agent-live-preview");
            if (!pv) {
              pv = document.createElement("div"); pv.className = "agent-live-preview";
              pv.innerHTML = '<div class="agent-live-preview__bar"><span class="agent-live-preview__dot"></span>' + (replyLang === "ar" ? "معاينة حية — تتحدّث أثناء البناء" : "Live preview — updates as it builds") + "</div><iframe sandbox=\"allow-scripts\" title=\"live preview\" loading=\"lazy\"></iframe>";
              bodyEl.appendChild(pv);
            }
            const doc = projPreviewHtml({ name: "t", files });
            const ifr = pv.querySelector("iframe");
            if (doc && ifr.getAttribute("data-len") !== String(doc.length)) { ifr.setAttribute("data-len", String(doc.length)); ifr.srcdoc = doc; }
          }
        } else if (run.phase === "done") {
          const pv = bodyEl.querySelector(".agent-live-preview"); if (pv) pv.remove();
        }
        if (autoScroll) scrollToBottom();
      }
    }
    if (persist) { chat.updatedAt = Date.now(); persistChat(chat); }
  };
  // ① CLARIFY FIRST — a fresh, ambiguous build/big task → ask 2-3 smart questions before executing.
  // An attached file IS the spec — execute directly from it (normal Firas AI never quizzes a user
  // who just uploaded the source material).
  const isFollowUp = !!(ctx.prevProj || ctx.prevCode || ctx.prevRunTitle);
  if (!resumeRun && !isFollowUp && !alreadyAsked && !ctx.fileText && agentClarifyNeeded(task)) {
    aiMsg.content = serializeAgentRun({ task, title: "", phase: "plan", lang: replyLang, steps: [], final: "", mode: "answer" });
    if (activeChat() === chat) renderThread(chat);
    let askSpec = null;
    try { askSpec = await buildClarifyingQuestions(task, replyLang, controller.signal); } catch (_) {}
    if (askSpec && !controller.signal.aborted) {
      aiMsg.content = "```firas-ask\n" + JSON.stringify(askSpec) + "\n```";
      activeStreams.delete(chat.id); endStreaming(chat.id);
      chat.updatedAt = Date.now(); persistChat(chat);
      if (activeChat() === chat) renderThread(chat);
      renderHistory();
      return;
    }
  }
  try {
    const run = await runAgentTask(chat, aiMsg, task, replyLang, controller.signal, rerenderCard, ctx, resumeRun);
    if (run.phase === "done") {
      if (run.mode === "codefile" && run._code) {
        // ONE complete code file → the real code card (copy / download / live preview).
        const spec = (typeof detectCodeRequest === "function" ? detectCodeRequest(task) : null) || ctx.prevCodeMeta || { filename: "index", lang: "html", ext: "html", label: "HTML" };
        const meta = { filename: spec.filename || "index", lang: spec.lang || "html", ext: spec.ext || "html", label: spec.label || (spec.lang || "code").toUpperCase() };
        chat.messages.push({ role: "assistant", content: "```firas-code " + JSON.stringify(meta) + "\n" + run._code + "\n```", reasoning: "", tier, lang: replyLang, mode: state.mode });
      } else if (run.mode === "project" && run._files && run._files.length) {
        // Multi-file FOLDER → project card with per-file viewer + ZIP download.
        // EVOLUTION: rebuilt/added files replace their old versions; untouched files carry over —
        // the delivered folder is always the COMPLETE up-to-date project.
        let outFiles = run._files;
        if (ctx.prevProj && Array.isArray(ctx.prevProj.files)) {
          const map = new Map(ctx.prevProj.files.map((f) => [f.path, f]));
          run._files.forEach((f) => map.set(f.path, f));
          outFiles = [...map.values()];
        }
        const name = ((ctx.prevProj && ctx.prevProj.name) || run.title || task.slice(0, 30)).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "project";
        const files = outFiles.slice(0, 14).map((f) => ({ path: f.path, content: String(f.content).slice(0, 60000) }));
        // Total budget: the persisted message is capped server-side (~200K) — trim the LARGEST
        // file until the JSON fits, so a reload never gets a truncated (unparseable) project.
        for (let guard = 0; guard < 40 && JSON.stringify({ name, files }).length > 180000; guard++) {
          const big = files.reduce((a, b) => (b.content.length > a.content.length ? b : a), files[0]);
          big.content = big.content.slice(0, Math.floor(big.content.length * 0.8));
        }
        chat.messages.push({ role: "assistant", content: "```firas-project\n" + JSON.stringify({ name, files }) + "\n```", reasoning: "", tier, lang: replyLang, mode: state.mode });
      } else if (run.mode === "doc" && run._deck && run.steps.some((s) => s.s === "done" && s.out)) {
        // PRESENTATION → finalize the live deck card (all slides in ONE editable card: edit text,
        // delete elements, regenerate any slide, Present fullscreen, download PowerPoint).
        try { updateLiveDeck(run, true); } catch (_) {}
      } else if (run.mode === "doc" && run.steps.some((s) => s.s === "done" && s.out)) {
        // Document → the real downloadable file card (PDF/Word…), with the math/latex cleanup and a
        // fitting professional TEMPLATE (exam→ministry, thesis→academic…).
        let docBody = run.steps.filter((s) => s.s === "done" && s.out).map((s) => s.out).join("\n\n");
        // COUNT ENFORCEMENT — the assembled document must contain every requested item ("10 questions"
        // → 10). If the steps under-delivered, auto-continue with the missing ones before delivery.
        try {
          const reqN = parseRequestedItemCount(task);
          if (reqN >= 2 && reqN <= 400) {
            const docLangRule = replyLang === "ar"
              ? " LANGUAGE: the document is in ARABIC — the new items must be in Arabic too."
              : " LANGUAGE: the document is in ENGLISH — the new items must be in English too.";
            docBody = await ensureDocItemCount(docBody, reqN, task,
              "You are Firas Agent completing a document that is missing items." + AGENT_QUALITY + (DOMAIN_GUIDE[domainOf(task)] || "") + docLangRule,
              (msgs) => agentCall(msgs, "max", controller.signal), controller.signal, null);
          }
        } catch (_) { /* enforcement is best-effort — never lose the doc */ }
        const tpl = docTemplateFor(task);
        const baseName = (run.title || task.slice(0, 40)).replace(/[\\/:*?"<>|]/g, " ").trim();
        const meta = { filename: baseName, title: run.title || task.slice(0, 60), subtitle: "", theme: (tpl === "corporate" || tpl === "ministry" ? "navy" : "teal") };
        if (tpl) meta.template = tpl;
        const body = sanitizeBareLatex(fixMathBlanks(tightenInlineMath(docBody)));
        // ① MULTI-VOLUME — a mega book whose full body exceeds the ~180K message cap is delivered as
        // several NUMBERED volume cards (split on chapter boundaries), so the promise of a huge
        // reference actually lands — each volume is its own downloadable file.
        const VOL_MAX = 150000;
        const docAr = replyLang === "ar";
        if (run._mega && !run._deck && body.length > VOL_MAX) {
          const vols = splitIntoVolumes(body, VOL_MAX).slice(0, 10);
          const N = vols.length;
          run.stats.files = N;
          vols.forEach((vb, vi) => {
            const label = (docAr ? "المجلد " : "Volume ") + (vi + 1) + (docAr ? " من " : " of ") + N;
            const vmeta = Object.assign({}, meta, { filename: baseName + " - " + (docAr ? "مجلد" : "Vol") + (vi + 1), title: (run.title || baseName) + " — " + label, subtitle: label });
            chat.messages.push({ role: "assistant", content: metaBlockString(vmeta) + "\n\n" + vb, reasoning: "", tier, lang: replyLang, mode: state.mode });
          });
        } else {
          const finalDoc = metaBlockString(meta) + "\n\n" + body;
          chat.messages.push({ role: "assistant", content: finalDoc, reasoning: "", tier, lang: replyLang, mode: state.mode });
        }
      }
      // ⑤ LEARN — a completed mission teaches durable preferences (topic, language, style) for
      // next time. Fire-and-forget; the backend extracts only lasting facts.
      if (run.phase === "done" && !controller.signal.aborted) {
        try {
          fetch("/api/memory/learn", {
            method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
            body: JSON.stringify({ user: task.slice(0, 1500), assistant: ("Firas Agent completed: " + (run.title || "") + " — a " + run.mode + " deliverable" + (run._files ? " (" + run._files.length + " files)" : "") + ".").slice(0, 800) }),
          }).catch(() => {});
        } catch (_) {}
      }
    }
  } catch (e) {
    if (!controller.signal.aborted) {
      const cur = parseAgentMeta(aiMsg.content);
      if (cur) { cur.phase = "fail"; aiMsg.content = "```firas-agent\n" + JSON.stringify(cur) + "\n```"; }
    }
  } finally {
    activeStreams.delete(chat.id);
    endStreaming(chat.id);
    chat.updatedAt = Date.now();
    persistChat(chat);
    if (activeChat() === chat) renderThread(chat);
    renderHistory();
  }
}

/* ── Product switcher: Firas AI / Firas Agent / Firas Code ────────────────── */
const PRODUCTS = {
  ai:    { name: "Firas AI",    tag: { ar: "المحادثة الذكية", en: "Smart chat" } },
  agent: { name: "Firas Agent", tag: { ar: "وكيل ينفّذ المهام الكبيرة", en: "Executes big tasks" } },
  // Firas Code is fully BUILT (IDE workspace below) but gated behind "coming soon" until launch —
  // flip locked:false (remove the flag) to open it.
  code:  { name: "Firas Code",  tag: { ar: "تحت التطوير 🚧", en: "In development 🚧" }, locked: true },
};
function updateProductUi() {
  const agent = state.product === "agent";
  const code = state.product === "code";
  document.body.classList.toggle("product-agent", agent);
  document.body.classList.toggle("product-code", code);
  const nameEl = document.getElementById("productSwitchName");
  if (nameEl) nameEl.textContent = PRODUCTS[state.product].name;
  // Shell wordmarks flip: "Firas AI" ↔ "Firas Agent" ↔ "Firas Code"
  document.querySelectorAll(".wordmark .ai").forEach((el) => { el.textContent = agent ? "Agent" : code ? "Code" : "AI"; });
  if (agent && els && els.input) {
    els.input.setAttribute("placeholder", state.lang === "ar"
      ? "كلّف فِراس بمهمة صعبة"
      : "Give Firas a hard task");
  }
}
function setProduct(p) {
  if (!PRODUCTS[p]) return;
  if (PRODUCTS[p].locked) { showUnderDevModal(PRODUCTS[p].name); return; }
  if (state.product === p) return;
  state.product = p;
  localStorage.setItem(LS_PRODUCT, p);
  state.activeId = null;          // each product opens on its own home screen
  state.search = "";
  if (els.searchInput) els.searchInput.value = "";
  applyShellLang(state.lang);     // restore base labels/placeholders, then theme via updateProductUi
  renderAll();
  syncStreamingUi();
}
function openProductMenu() {
  const old = document.getElementById("firasProductMenu"); if (old) { old.remove(); return; }
  const btn = document.getElementById("productSwitch"); if (!btn) return;
  const ar = state.lang === "ar";
  const menu = document.createElement("div");
  menu.id = "firasProductMenu"; menu.className = "product-menu";
  Object.keys(PRODUCTS).forEach((key) => {
    const p = PRODUCTS[key];
    const it = document.createElement("button");
    it.type = "button";
    it.className = "product-menu__item" + (key === state.product ? " is-active" : "") + (p.locked ? " is-locked" : "");
    it.innerHTML =
      '<span class="product-menu__name">' + p.name + (p.locked ? ' <span class="product-menu__soon">' + (ar ? "قريبًا" : "soon") + "</span>" : "") + "</span>" +
      '<span class="product-menu__tag">' + (p.tag[ar ? "ar" : "en"]) + "</span>" +
      (key === state.product ? '<span class="product-menu__check">✓</span>' : "");
    it.addEventListener("click", () => { menu.remove(); setProduct(key); });
    menu.appendChild(it);
  });
  document.body.appendChild(menu);
  const r = btn.getBoundingClientRect();
  menu.style.top = (r.bottom + 6) + "px";
  const isRtl = document.documentElement.dir === "rtl";
  if (isRtl) menu.style.right = Math.max(8, window.innerWidth - r.right) + "px";
  else menu.style.left = Math.max(8, r.left) + "px";
  setTimeout(() => {
    // btn.contains — a press on the trigger's CHILDREN (label/arrow) must NOT count as
    // outside-close, or the following click instantly REOPENS the menu (close→open flicker).
    const onDown = (e) => { if (!menu.contains(e.target) && !btn.contains(e.target)) { menu.remove(); document.removeEventListener("pointerdown", onDown, true); } };
    document.addEventListener("pointerdown", onDown, true);
  }, 0);
}
/* ════════════════════════════════════════════════════════════════════════════
   FIRAS CODE — the browser IDE workspace (product #3).
   A project = a chat with codeProj:true whose FIRST message holds a firas-project
   block — so persistence, sync and history all reuse the existing machinery.
   Layout: file tree │ CodeMirror editor │ live preview + console, with an AI
   command bar that proposes changes as ACCEPT/REJECT diffs.
   ═══════════════════════════════════════════════════════════════════════════ */
const cwState = { file: 0, cm: null, cmFallback: null, tab: "preview", renderedChat: "", saveTimer: 0, prevTimer: 0, busy: false };
const CW_TEMPLATES = {
  blank: { ar: "فارغ", en: "Blank", files: [{ path: "index.html", content: "<!DOCTYPE html>\n<html lang=\"ar\" dir=\"rtl\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>مشروعي</title>\n</head>\n<body>\n  <h1>مرحبًا 👋</h1>\n</body>\n</html>\n" }] },
  site: { ar: "موقع (HTML+CSS+JS)", en: "Site (HTML+CSS+JS)", files: [
    { path: "index.html", content: "<!DOCTYPE html>\n<html lang=\"ar\" dir=\"rtl\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>موقعي</title>\n  <link rel=\"stylesheet\" href=\"css/styles.css\">\n</head>\n<body>\n  <header class=\"hero\"><h1>موقعي الجديد</h1><p>ابنِ شيئًا جميلًا</p><button id=\"cta\">ابدأ</button></header>\n  <script src=\"js/app.js\"></script>\n</body>\n</html>\n" },
    { path: "css/styles.css", content: "*{margin:0;box-sizing:border-box}\nbody{font-family:system-ui,sans-serif;background:#faf9f5;color:#1a1a18}\n.hero{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px}\n.hero h1{font-size:clamp(28px,6vw,52px)}\n#cta{padding:12px 34px;border:none;border-radius:999px;background:#237a68;color:#fff;font-size:16px;cursor:pointer}\n#cta:hover{background:#1c6355}\n" },
    { path: "js/app.js", content: "document.getElementById(\"cta\").addEventListener(\"click\", () => {\n  alert(\"يعمل! 🎉\");\n});\nconsole.log(\"جاهز\");\n" },
  ] },
};
function cwT() {
  const ar = state.lang === "ar";
  return ar ? {
    home: "الرئيسية", newProj: "مشروع جديد", name: "اسم المشروع", create: "إنشاء", tpl: "القالب",
    heroT: "Firas Code", heroSub: "بيئة تطوير كاملة بالمتصفح — اكتب بيدك، والذكاء يعدّل معك جراحيًا",
    recent: "مشاريعك بالقائمة الجانبية", run: "▶ تحديث", zip: "⬇ ZIP", addFile: "+ ملف",
    preview: "معاينة", console: "كونسول", clearCon: "مسح", aiPh: "اطلب تعديلًا… «أضف وضعًا ليليًا» أو «صلّح الزر»", aiGo: "نفّذ",
    working: "يفكر ويعدّل…", diffT: "مراجعة التعديلات", newF: "جديد", editF: "تعديل", delF: "حذف",
    apply: "تطبيق المحدد", cancel: "إلغاء", applied: "طُبّقت التعديلات ✓", nothing: "لا تغييرات مقترحة",
    delFileC: "حذف الملف؟", fileName: "اسم الملف (مثل js/tools.js)", saved: "حُفظ ✓", aiFail: "تعذّر التعديل — جرّب ثانية",
    filesTab: "الملفات", editorTab: "المحرر", outTab: "النتيجة", replaceAll: "استبدال كامل للملف",
  } : {
    home: "Home", newProj: "New project", name: "Project name", create: "Create", tpl: "Template",
    heroT: "Firas Code", heroSub: "A full dev workspace in the browser — you type, the AI edits surgically with you",
    recent: "Your projects live in the sidebar", run: "▶ Refresh", zip: "⬇ ZIP", addFile: "+ File",
    preview: "Preview", console: "Console", clearCon: "Clear", aiPh: "Ask for a change… \"add dark mode\" or \"fix the button\"", aiGo: "Run",
    working: "Thinking & editing…", diffT: "Review changes", newF: "new", editF: "edit", delF: "delete",
    apply: "Apply selected", cancel: "Cancel", applied: "Changes applied ✓", nothing: "No changes proposed",
    delFileC: "Delete this file?", fileName: "File name (e.g. js/tools.js)", saved: "Saved ✓", aiFail: "Couldn't edit — try again",
    filesTab: "Files", editorTab: "Editor", outTab: "Output", replaceAll: "Full file replacement",
  };
}
function codeFilesOf(chat) {
  const m = chat.messages && chat.messages[0];
  const p = m ? parseProjectMeta(m.content) : null;
  return p ? { name: p.name || chat.title || "project", files: p.files.map((f) => ({ path: f.path, content: String(f.content || "") })) } : { name: chat.title || "project", files: [] };
}
function codeSaveFiles(chat, name, files) {
  const slim = files.slice(0, 30).map((f) => ({ path: String(f.path).slice(0, 120), content: String(f.content || "").slice(0, 60000) }));
  const cappedName = String(name || "project").slice(0, 80);
  let payload = JSON.stringify({ name: cappedName, files: slim });
  for (let g = 0; g < 30 && payload.length > 180000; g++) {   // same server cap discipline as agent projects
    const big = slim.reduce((a, b) => (b.content.length > a.content.length ? b : a), slim[0]);
    big.content = big.content.slice(0, Math.floor(big.content.length * 0.8));
    payload = JSON.stringify({ name: cappedName, files: slim });
  }
  const content = "```firas-project\n" + payload + "\n```";
  if (!chat.messages || !chat.messages.length) chat.messages = [{ role: "assistant", content, reasoning: "", lang: state.lang }];
  else chat.messages[0].content = content;
  chat.updatedAt = Date.now();
  persistChat(chat);
}
function createCodeProject(name, files) {
  const chat = { id: uid(), serverId: null, title: String(name || "مشروع").slice(0, 80), codeProj: true, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  state.chats.unshift(chat);
  codeSaveFiles(chat, name, files);
  state.activeId = chat.id;
  return chat;
}
/* Open any delivered project folder inside Firas Code (the Agent → Code bridge). */
function openProjectInFirasCode(proj) {
  if (PRODUCTS.code.locked) { showUnderDevModal(PRODUCTS.code.name); return; }   // gated until launch
  const chat = createCodeProject(proj.name || "project", (proj.files || []).map((f) => ({ path: f.path, content: f.content })));
  state.product = "code";
  try { localStorage.setItem(LS_PRODUCT, "code"); } catch (_) {}
  cwState.file = 0; cwState.renderedChat = "";
  applyShellLang(state.lang);
  renderAll();
  showToast(state.lang === "ar" ? "انفتح المشروع في فراس كود ⚡" : "Opened in Firas Code ⚡");
}
/* CodeMirror 5 (UMD, no build step). Best-effort: the editor falls back to a plain textarea. */
let _cmReady = null;
function ensureCodeMirror() {
  if (window.CodeMirror) return Promise.resolve(true);
  if (_cmReady) return _cmReady;
  const base = "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/";
  if (!document.getElementById("cmCss")) {
    const l = document.createElement("link"); l.id = "cmCss"; l.rel = "stylesheet"; l.href = base + "codemirror.min.css";
    document.head.appendChild(l);
  }
  _cmReady = (async () => {
    try {
      await loadScripts([base + "codemirror.min.js", base + "mode/xml/xml.min.js", base + "mode/javascript/javascript.min.js", base + "mode/css/css.min.js", base + "mode/htmlmixed/htmlmixed.min.js", base + "mode/python/python.min.js", base + "addon/selection/active-line.min.js"]);
      return !!window.CodeMirror;
    } catch (_) { return false; }
  })();
  return _cmReady;
}
function cwModeFor(path) {
  const ext = String(path).split(".").pop().toLowerCase();
  return ext === "html" || ext === "htm" ? "htmlmixed"
    : ext === "js" || ext === "mjs" || ext === "jsx" ? "javascript"
    : ext === "json" ? { name: "javascript", json: true }
    : ext === "css" ? "css"
    : ext === "py" ? "python"
    : ext === "xml" || ext === "svg" ? "xml"
    : null;
}
/* Simple line diff (LCS). Returns rows [{t:' '|'+'|'-'|'~', s|n}] with long unchanged runs folded. */
function cwLineDiff(aStr, bStr) {
  const a = String(aStr).split("\n"), b = String(bStr).split("\n");
  if (a.length > 1200 || b.length > 1200) return null;
  const n = a.length, m = b.length;
  const dp = new Uint16Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i * (m + 1) + j] = a[i] === b[j] ? dp[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1]);
  }
  const rows = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { rows.push({ t: " ", s: a[i] }); i++; j++; }
    else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) { rows.push({ t: "-", s: a[i] }); i++; }
    else { rows.push({ t: "+", s: b[j] }); j++; }
  }
  while (i < n) { rows.push({ t: "-", s: a[i++] }); }
  while (j < m) { rows.push({ t: "+", s: b[j++] }); }
  // fold unchanged runs longer than 8 lines to 3+…+3
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length > 8) { out.push(...run.slice(0, 3), { t: "~", n: run.length - 6 }, ...run.slice(-3)); }
    else out.push(...run);
    run = [];
  };
  rows.forEach((r) => { if (r.t === " ") run.push(r); else { flush(); out.push(r); } });
  flush();
  return out;
}
/* Console capture: injected into the preview so its logs/errors stream into the console pane. */
const CW_CONSOLE_HOOK = "<script>(function(){function s(t,a){try{parent.postMessage({__fcw:1,t:t,m:Array.prototype.slice.call(a).map(function(x){try{return typeof x===\"object\"?JSON.stringify(x).slice(0,300):String(x)}catch(e){return String(x)}}).join(\" \").slice(0,600)},\"*\")}catch(e){}}[\"log\",\"warn\",\"error\",\"info\"].forEach(function(k){var o=console[k];console[k]=function(){s(k,arguments);try{o.apply(console,arguments)}catch(e){}}});window.addEventListener(\"error\",function(e){s(\"error\",[e.message+\" @ line \"+e.lineno])});window.addEventListener(\"unhandledrejection\",function(e){s(\"error\",[\"Promise: \"+e.reason])})})();</" + "script>";
let _cwMsgWired = false;
function cwWireConsoleListener() {
  if (_cwMsgWired) return;
  _cwMsgWired = true;
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.__fcw !== 1) return;
    const pane = document.querySelector("#codeWorkspace .cw-console__list");
    if (!pane) return;
    const row = document.createElement("div");
    row.className = "cw-conrow cw-conrow--" + (d.t || "log");
    row.textContent = d.m;
    pane.appendChild(row);
    pane.scrollTop = pane.scrollHeight;
    if (d.t === "error") {
      const tab = document.querySelector("#codeWorkspace .cw-tab[data-tab=console]");
      if (tab) tab.classList.add("has-errors");
    }
  });
}
function renderCodeWorkspace() {
  els.welcome.classList.add("hidden");
  let root = document.getElementById("codeWorkspace");
  if (!root) {
    root = document.createElement("div");
    root.id = "codeWorkspace";
    els.chatScroll.parentElement.insertBefore(root, els.chatScroll.nextSibling);
  }
  const chat = activeChat();
  if (!chat || !chat.codeProj) { cwState.renderedChat = ""; renderCodeHome(root); return; }
  renderCodeIDE(root, chat);
}
function renderCodeHome(root) {
  const L = cwT(), ar = state.lang === "ar";
  root.setAttribute("dir", ar ? "rtl" : "ltr");
  const TPL_META = {
    blank: { ic: "📄", desc: ar ? "صفحة HTML واحدة نظيفة تبدأ منها" : "One clean HTML page to start from" },
    site:  { ic: "🌐", desc: ar ? "هيكل موقع كامل: صفحة + تنسيق + تفاعل" : "Full site scaffold: page + styles + logic" },
  };
  root.innerHTML =
    '<div class="cw-home">' +
      '<div class="cw-home__hero">' +
        '<span class="cw-home__mark"><span class="cw-home__mark-glyph">&lt;/&gt;</span></span>' +
        "<h1>" + L.heroT + "</h1><p>" + L.heroSub + "</p>" +
      "</div>" +
      '<div class="cw-home__card">' +
        '<label class="cw-home__lbl">' + L.name + '</label><input class="cw-home__name" maxlength="60" placeholder="' + (ar ? "متجري الإلكتروني" : "my-store") + '">' +
        '<label class="cw-home__lbl">' + L.tpl + '</label>' +
        '<div class="cw-home__tpls">' + Object.keys(CW_TEMPLATES).map((k, i) =>
          '<button type="button" class="cw-home__tpl' + (i === 1 ? " is-active" : "") + '" data-tpl="' + k + '">' +
            '<span class="cw-home__tpl-ic">' + (TPL_META[k] ? TPL_META[k].ic : "📦") + "</span>" +
            '<span class="cw-home__tpl-txt"><strong>' + (ar ? CW_TEMPLATES[k].ar : CW_TEMPLATES[k].en) + "</strong>" +
            '<small>' + (TPL_META[k] ? TPL_META[k].desc : "") + "</small></span>" +
            '<span class="cw-home__tpl-check">✓</span>' +
          "</button>").join("") + "</div>" +
        '<button type="button" class="cw-home__create">' + L.create + " ⚡</button>" +
      "</div>" +
      '<p class="cw-home__hint">' + L.recent + "</p>" +
    "</div>";
  let tpl = "site";
  root.querySelectorAll(".cw-home__tpl").forEach((b) => b.addEventListener("click", () => {
    tpl = b.getAttribute("data-tpl");
    root.querySelectorAll(".cw-home__tpl").forEach((x) => x.classList.toggle("is-active", x === b));
  }));
  root.querySelector(".cw-home__create").addEventListener("click", () => {
    const name = root.querySelector(".cw-home__name").value.trim() || (ar ? "مشروع جديد" : "new-project");
    createCodeProject(name, CW_TEMPLATES[tpl].files.map((f) => ({ path: f.path, content: f.content })));
    cwState.file = 0; cwState.renderedChat = "";
    renderAll();
  });
}
function cwRefreshPreview(root, chat) {
  const { files } = codeFilesOf(chat);
  const ifr = root.querySelector(".cw-preview");
  if (!ifr) return;
  let html = projPreviewHtml({ name: "p", files }) || "<!DOCTYPE html><html><body style='font-family:sans-serif;color:#888;display:grid;place-items:center;height:100vh'>" + (state.lang === "ar" ? "أضف ملف index.html للمعاينة" : "Add an index.html to preview") + "</body></html>";
  html = html.replace(/<head([^>]*)>/i, "<head$1>" + CW_CONSOLE_HOOK);
  if (html.indexOf(CW_CONSOLE_HOOK) === -1) html = CW_CONSOLE_HOOK + html;
  const list = root.querySelector(".cw-console__list"); if (list) list.innerHTML = "";
  const tab = root.querySelector(".cw-tab[data-tab=console]"); if (tab) tab.classList.remove("has-errors");
  ifr.srcdoc = html;
}
function cwSelectFile(root, chat, idx) {
  const { files } = codeFilesOf(chat);
  cwState.file = Math.max(0, Math.min(idx, files.length - 1));
  root.querySelectorAll(".cw-file").forEach((el, k) => el.classList.toggle("is-active", k === cwState.file));
  const f = files[cwState.file];
  if (!f) return;
  if (cwState.cm) {
    cwState.cm.setValue(f.content);
    const mode = cwModeFor(f.path);
    cwState.cm.setOption("mode", mode);
    cwState.cm.clearHistory();
  } else if (cwState.cmFallback) {
    cwState.cmFallback.value = f.content;
  }
}
function cwCurrentEditorValue() {
  return cwState.cm ? cwState.cm.getValue() : (cwState.cmFallback ? cwState.cmFallback.value : null);
}
function cwCommitEdit(root, chat, alsoPreview) {
  const val = cwCurrentEditorValue();
  if (val == null) return;
  const st = codeFilesOf(chat);
  if (!st.files[cwState.file]) return;
  if (st.files[cwState.file].content === val) { if (alsoPreview) cwRefreshPreview(root, chat); return; }
  st.files[cwState.file].content = val;
  codeSaveFiles(chat, st.name, st.files);
  const row = root.querySelectorAll(".cw-file")[cwState.file];
  if (row) { const sz = row.querySelector(".cw-file__size"); if (sz) sz.textContent = Math.max(1, Math.round(val.length / 1024)) + "K"; }
  if (alsoPreview) cwRefreshPreview(root, chat);
}
function cwRenderTree(root, chat) {
  const L = cwT();
  const { files } = codeFilesOf(chat);
  const tree = root.querySelector(".cw-tree__list");
  tree.innerHTML = "";
  const nEl = root.querySelector(".cw-tree__n"); if (nEl) nEl.textContent = files.length;
  const cEl = root.querySelector(".cw-bar__count"); if (cEl) cEl.textContent = files.length + (state.lang === "ar" ? " ملفات" : " files");
  const extOf = (p) => (/\.html?$/.test(p) ? "html" : /\.css$/.test(p) ? "css" : /\.m?jsx?$/.test(p) ? "js" : /\.py$/.test(p) ? "py" : /\.json$/.test(p) ? "json" : /\.md$/.test(p) ? "md" : "txt");
  files.forEach((f, i) => {
    const ext = extOf(f.path);
    const row = document.createElement("div");
    row.className = "cw-file" + (i === cwState.file ? " is-active" : "");
    row.innerHTML = '<span class="cw-file__dot" data-ext="' + ext + '"></span>' +
      '<span class="cw-file__p" dir="ltr">' + escapeHtml(f.path) + "</span>" +
      '<span class="cw-file__size">' + Math.max(1, Math.round((f.content || "").length / 1024)) + "K</span>" +
      '<button type="button" class="cw-file__x" title="' + L.delF + '">✕</button>';
    row.addEventListener("click", (e) => {
      if (e.target.closest(".cw-file__x")) {
        if (!confirm(L.delFileC)) return;
        const st = codeFilesOf(chat);
        st.files.splice(i, 1);
        codeSaveFiles(chat, st.name, st.files);
        cwState.file = 0;
        cwRenderTree(root, chat); cwSelectFile(root, chat, 0); cwRefreshPreview(root, chat);
        return;
      }
      cwCommitEdit(root, chat, false);
      cwSelectFile(root, chat, i);
    });
    tree.appendChild(row);
  });
}
async function renderCodeIDE(root, chat) {
  const L = cwT(), ar = state.lang === "ar";
  cwWireConsoleListener();
  if (cwState.renderedChat === chat.id && root.querySelector(".cw")) { return; }   // already mounted
  cwState.renderedChat = chat.id; cwState.file = 0; cwState.cm = null; cwState.cmFallback = null;
  root.setAttribute("dir", ar ? "rtl" : "ltr");
  root.innerHTML =
    '<div class="cw">' +
      '<div class="cw-bar">' +
        '<button type="button" class="cw-bar__home" title="' + L.home + '">⌂</button>' +
        '<span class="cw-bar__logo">&lt;/&gt;</span>' +
        '<span class="cw-bar__name">' + escapeHtml(chat.title || "project") + "</span>" +
        '<span class="cw-bar__count"></span>' +
        '<span class="cw-bar__sp"></span>' +
        '<button type="button" class="cw-bar__btn cw-run">' + L.run + "</button>" +
        '<button type="button" class="cw-bar__btn cw-addfile">' + L.addFile + "</button>" +
        '<button type="button" class="cw-bar__btn cw-zip">' + L.zip + "</button>" +
      "</div>" +
      '<div class="cw-main">' +
        '<aside class="cw-tree">' +
          '<div class="cw-tree__head">' + (state.lang === "ar" ? "الملفات" : "Files") + '<span class="cw-tree__n"></span></div>' +
          '<div class="cw-tree__list"></div>' +
        "</aside>" +
        '<section class="cw-ed"><textarea class="cw-ed__ta" spellcheck="false"></textarea></section>' +
        '<section class="cw-right">' +
          '<div class="cw-tabs">' +
            '<button type="button" class="cw-tab is-active" data-tab="preview">' + L.preview + "</button>" +
            '<button type="button" class="cw-tab" data-tab="console">' + L.console + "</button>" +
            '<button type="button" class="cw-conclear" title="' + L.clearCon + '">🗑</button>' +
          "</div>" +
          '<div class="cw-prevwrap">' +
            '<div class="cw-prevchrome"><span class="cw-prevdots"><i></i><i></i><i></i></span><span class="cw-prevaddr">' + L.preview + " · localhost</span></div>" +
            '<iframe class="cw-preview" sandbox="allow-scripts allow-modals" title="preview"></iframe>' +
          "</div>" +
          '<div class="cw-console" hidden><div class="cw-console__list"></div></div>' +
        "</section>" +
      "</div>" +
      '<form class="cw-ai">' +
        '<input class="cw-ai__in" placeholder="' + L.aiPh + '" maxlength="1200">' +
        '<button type="submit" class="cw-ai__go">⚡ ' + L.aiGo + "</button>" +
      "</form>" +
      '<div class="cw-diff" hidden></div>' +
    "</div>";
  // tree + editor + preview
  cwRenderTree(root, chat);
  const ta = root.querySelector(".cw-ed__ta");
  const ok = await ensureCodeMirror();
  if (ok && window.CodeMirror && cwState.renderedChat === chat.id) {
    cwState.cm = window.CodeMirror.fromTextArea(ta, {
      lineNumbers: true, lineWrapping: false, indentUnit: 2, tabSize: 2,
      direction: "ltr", viewportMargin: 30, styleActiveLine: true,
    });
    cwState.cm.on("change", () => {
      clearTimeout(cwState.saveTimer);
      cwState.saveTimer = setTimeout(() => { cwCommitEdit(root, chat, false); }, 900);
      clearTimeout(cwState.prevTimer);
      cwState.prevTimer = setTimeout(() => { cwCommitEdit(root, chat, true); }, 1600);
    });
  } else {
    cwState.cmFallback = ta;
    ta.addEventListener("input", () => {
      clearTimeout(cwState.saveTimer);
      cwState.saveTimer = setTimeout(() => { cwCommitEdit(root, chat, true); }, 1200);
    });
  }
  cwSelectFile(root, chat, 0);
  cwRefreshPreview(root, chat);
  // bar actions
  root.querySelector(".cw-bar__home").addEventListener("click", () => { cwCommitEdit(root, chat, false); state.activeId = null; cwState.renderedChat = ""; renderAll(); });
  root.querySelector(".cw-run").addEventListener("click", () => cwCommitEdit(root, chat, true));
  root.querySelector(".cw-zip").addEventListener("click", () => {
    cwCommitEdit(root, chat, false);
    const st = codeFilesOf(chat);
    let folder = String(st.name || "project").replace(/[^\w؀-ۿ .-]+/g, " ").replace(/\s+/g, "-").replace(/^-+|-+$/g, "") || "project";
    const blob = buildZip(st.files.map((f) => ({ path: folder + "/" + f.path, content: f.content })));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = folder + ".zip";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  root.querySelector(".cw-addfile").addEventListener("click", () => {
    const p = prompt(L.fileName);
    if (!p) return;
    const path = p.trim().replace(/^\/+/, "").replace(/[^\w./ -]+/g, "-").slice(0, 120);
    if (!path) return;
    const st = codeFilesOf(chat);
    if (st.files.some((f) => f.path === path)) { showToast(state.lang === "ar" ? "الملف موجود" : "File exists"); return; }
    st.files.push({ path, content: "" });
    codeSaveFiles(chat, st.name, st.files);
    cwRenderTree(root, chat);
    cwSelectFile(root, chat, st.files.length - 1);
  });
  // tabs
  root.querySelectorAll(".cw-tab").forEach((b) => b.addEventListener("click", () => {
    cwState.tab = b.getAttribute("data-tab");
    root.querySelectorAll(".cw-tab").forEach((x) => x.classList.toggle("is-active", x === b));
    root.querySelector(".cw-prevwrap").style.display = cwState.tab === "preview" ? "" : "none";
    root.querySelector(".cw-console").hidden = cwState.tab !== "console";
    if (cwState.tab === "console") b.classList.remove("has-errors");
  }));
  root.querySelector(".cw-conclear").addEventListener("click", () => { const l = root.querySelector(".cw-console__list"); if (l) l.innerHTML = ""; });
  // Ctrl/Cmd+S → save + refresh
  root.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); cwCommitEdit(root, chat, true); showToast(L.saved); }
  });
  // AI command bar
  root.querySelector(".cw-ai").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (cwState.busy) return;
    const inp = root.querySelector(".cw-ai__in");
    const ask = inp.value.trim();
    if (!ask) return;
    cwCommitEdit(root, chat, false);
    const go = root.querySelector(".cw-ai__go");
    cwState.busy = true; go.disabled = true; inp.disabled = true; go.textContent = L.working;
    try {
      const res = await cwAskAI(chat, ask);
      if (!res || (!res.changes.length && !res.dels.length)) { showToast(L.nothing); }
      else cwShowDiff(root, chat, res);
      inp.value = "";
    } catch (_) { showToast(L.aiFail); }
    finally { cwState.busy = false; go.disabled = false; inp.disabled = false; go.textContent = "⚡ " + L.aiGo; }
  });
}
async function cwAskAI(chat, instruction) {
  const st = codeFilesOf(chat);
  const isWeb = st.files.some((f) => /\.html?$/.test(f.path));
  const filesTxt = st.files.map((f) => "===== " + f.path + " =====\n" + String(f.content).slice(0, 15000)).join("\n\n").slice(0, 90000);
  const sys = "You are Firas Code, an expert pair-programmer editing the user's OPEN project. Apply the request with MINIMAL surgical changes — keep everything that shouldn't change byte-identical. STRICT OUTPUT FORMAT: first ONE short summary line in the user's language; then for EVERY added or modified file exactly one fenced block:\n```file:relative/path.ext\n<the COMPLETE new file content>\n```\nTo delete a file output a line: DELETE: relative/path.ext\nRules: include ONLY files that change; ALWAYS output full file content (never snippets, never '...'), valid runnable code; do not invent files the request doesn't need." + (isWeb ? VISUAL_POLICY : "");
  const usr = "PROJECT: " + st.name + "\n\nCURRENT FILES:\n" + filesTxt + "\n\nUSER REQUEST:\n" + String(instruction).slice(0, 1200);
  const out = await callAgentText([{ role: "system", content: sys }, { role: "user", content: usr }], "max", null);
  const changes = [];
  const re = /```file:([^\n]+)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(out))) {
    const path = m[1].trim().replace(/^\/+/, "").slice(0, 120);
    if (path) changes.push({ path, content: m[2].replace(/\n$/, "") });
  }
  const dels = [...out.matchAll(/^DELETE:\s*([^\s`]+)\s*$/gm)].map((x) => x[1]).filter((p) => st.files.some((f) => f.path === p));
  const summary = (out.split("```")[0] || "").trim().split("\n")[0].slice(0, 220);
  return { changes, dels, summary };
}
function cwShowDiff(root, chat, res) {
  const L = cwT();
  const st = codeFilesOf(chat);
  const wrap = root.querySelector(".cw-diff");
  const items = res.changes.map((c) => {
    const old = st.files.find((f) => f.path === c.path);
    return { kind: old ? "edit" : "new", path: c.path, content: c.content, old: old ? old.content : "" };
  }).concat(res.dels.map((p) => ({ kind: "del", path: p, content: "", old: (st.files.find((f) => f.path === p) || {}).content || "" })));
  const rowsHtml = items.map((it, i) => {
    let body = "";
    if (it.kind === "del") body = '<div class="cw-diff__all cw-diff__all--del">' + L.delF + "</div>";
    else {
      const d = it.kind === "new" ? null : cwLineDiff(it.old, it.content);
      if (!d) {
        body = '<div class="cw-diff__all">' + (it.kind === "new" ? "" : L.replaceAll) + '<pre class="cw-diff__pre">' + escapeHtml(it.content.slice(0, 4000)) + (it.content.length > 4000 ? "\n…" : "") + "</pre></div>";
      } else {
        body = '<div class="cw-diff__lines">' + d.map((r) => r.t === "~"
          ? '<div class="cw-dl cw-dl--fold">⋯ ' + r.n + " ⋯</div>"
          : '<div class="cw-dl cw-dl--' + (r.t === "+" ? "add" : r.t === "-" ? "del" : "same") + '">' + escapeHtml(r.s || " ") + "</div>").join("") + "</div>";
      }
    }
    return '<details class="cw-diff__file" data-i="' + i + '" ' + (items.length <= 2 ? "open" : "") + '>' +
      '<summary><input type="checkbox" checked data-ck="' + i + '" onclick="event.stopPropagation()"> ' +
      '<span class="cw-diff__badge cw-diff__badge--' + it.kind + '">' + (it.kind === "new" ? L.newF : it.kind === "del" ? L.delF : L.editF) + "</span>" +
      '<code dir="ltr">' + escapeHtml(it.path) + "</code></summary>" + body + "</details>";
  }).join("");
  wrap.innerHTML =
    '<div class="cw-diff__card">' +
      '<div class="cw-diff__head"><strong>' + L.diffT + "</strong>" + (res.summary ? '<span class="cw-diff__sum">' + escapeHtml(res.summary) + "</span>" : "") + "</div>" +
      '<div class="cw-diff__list">' + rowsHtml + "</div>" +
      '<div class="cw-diff__acts"><button type="button" class="cw-diff__apply">✓ ' + L.apply + '</button><button type="button" class="cw-diff__cancel">' + L.cancel + "</button></div>" +
    "</div>";
  wrap.hidden = false;
  wrap.querySelector(".cw-diff__cancel").addEventListener("click", () => { wrap.hidden = true; wrap.innerHTML = ""; });
  wrap.querySelector(".cw-diff__apply").addEventListener("click", () => {
    const picked = [...wrap.querySelectorAll("[data-ck]")].filter((c) => c.checked).map((c) => parseInt(c.getAttribute("data-ck"), 10));
    const cur = codeFilesOf(chat);
    picked.forEach((i) => {
      const it = items[i];
      if (it.kind === "del") { const k = cur.files.findIndex((f) => f.path === it.path); if (k >= 0) cur.files.splice(k, 1); }
      else {
        const ex = cur.files.find((f) => f.path === it.path);
        if (ex) ex.content = it.content; else cur.files.push({ path: it.path, content: it.content });
      }
    });
    codeSaveFiles(chat, cur.name, cur.files);
    wrap.hidden = true; wrap.innerHTML = "";
    cwState.file = Math.min(cwState.file, Math.max(0, cur.files.length - 1));
    cwRenderTree(root, chat);
    cwSelectFile(root, chat, cwState.file);
    cwRefreshPreview(root, chat);
    showToast(L.applied);
  });
}

function showUnderDevModal(name) {
  const old = document.getElementById("firasDevModal"); if (old) old.remove();
  const ar = state.lang === "ar";
  const ov = document.createElement("div");
  ov.id = "firasDevModal"; ov.className = "dev-modal";
  ov.innerHTML =
    '<div class="dev-modal__card" role="dialog" aria-modal="true">' +
      '<div class="dev-modal__icon">🚧</div>' +
      '<h3 class="dev-modal__title">' + name + "</h3>" +
      '<p class="dev-modal__body">' + (ar
        ? "هذا القسم تحت التطوير والتجريب حاليًا.<br>يرجى انتظار التحديثات القادمة."
        : "This section is under development and testing.<br>Please wait for upcoming updates.") + "</p>" +
      '<button type="button" class="dev-modal__ok">' + (ar ? "حسنًا" : "OK") + "</button>" +
    "</div>";
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".dev-modal__ok").addEventListener("click", close);
  document.body.appendChild(ov);
}

/* ── Share: publish the open chat as a read-only public link ─────────────── */
async function shareActiveChat() {
  const ar = state.lang === "ar";
  const chat = activeChat();
  if (!chat || !chat.messages || !chat.messages.length) { showToast(ar ? "افتح محادثة فيها رسائل أولًا" : "Open a chat with messages first"); return; }
  showToast(ar ? "ينشئ رابط المشاركة…" : "Creating share link…");
  try {
    // SAVE FIRST, ALWAYS: creates the chat on the server if it's new (that's where serverId is
    // born) and pushes the LATEST messages, so sharing works mid-conversation and the snapshot
    // is current. The old code sent the LOCAL chat.id — the server has never heard of it for any
    // chat created this session, so sharing "randomly" failed until a reload.
    await persistChat(chat);
    if (!chat.serverId && chat._creating) { try { await chat._creating; } catch (_) {} }
    const sid = chat.serverId || chat.id;
    if (!chat.serverId) throw new Error("not saved");
    const r = await apiJson("/api/share", { method: "POST", body: JSON.stringify({ chatId: sid }) });
    if (!r || !r.id) throw new Error("no id");
    const link = location.origin + "/?share=" + r.id;
    // Copy IMMEDIATELY (works while the click's clipboard permission is still warm), then show the
    // share sheet — its Copy button is a FRESH gesture, so copying is guaranteed even when the
    // network wait outlived the permission (the old silent-failure case).
    const autoCopied = await copyText(link);
    openShareSheet(link, ar, autoCopied);
    if (autoCopied) showToast(ar ? "تم نسخ رابط المشاركة ✓" : "Share link copied ✓");
  } catch (e) {
    showToast(ar ? "تعذّر إنشاء الرابط — تأكد من تسجيل الدخول واتصالك ثم أعد المحاولة" : "Couldn't create the link — check you're signed in and online, then retry");
  }
}
/* Small bottom sheet with the share link: tap-to-select input, a guaranteed Copy button,
   and the OS share sheet on devices that support it. */
function openShareSheet(link, ar, autoCopied) {
  const old = document.getElementById("firasShareSheet"); if (old) old.remove();
  const ov = document.createElement("div");
  ov.id = "firasShareSheet"; ov.className = "share-sheet";
  ov.setAttribute("dir", ar ? "rtl" : "ltr");
  ov.innerHTML =
    '<div class="share-sheet__card" role="dialog" aria-modal="true">' +
      '<div class="share-sheet__head"><strong>' + (ar ? "رابط المشاركة" : "Share link") + "</strong>" +
        '<button type="button" class="share-sheet__x" aria-label="close">✕</button></div>' +
      '<input class="share-sheet__link" readonly dir="ltr" value="' + escapeHtml(link) + '">' +
      '<div class="share-sheet__acts">' +
        '<button type="button" class="share-sheet__copy">' + (autoCopied ? (ar ? "تم النسخ ✓" : "Copied ✓") : (ar ? "📋 نسخ الرابط" : "📋 Copy link")) + "</button>" +
        (navigator.share ? '<button type="button" class="share-sheet__os">' + (ar ? "مشاركة عبر التطبيقات" : "Share via apps…") + "</button>" : "") +
      "</div>" +
      '<p class="share-sheet__note">' + (ar ? "أي شخص يملك الرابط يستطيع قراءة هذه المحادثة." : "Anyone with the link can read this conversation.") + "</p>" +
    "</div>";
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add("is-open"));
  const close = () => { ov.classList.remove("is-open"); setTimeout(() => ov.remove(), 180); };
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".share-sheet__x").addEventListener("click", close);
  const inp = ov.querySelector(".share-sheet__link");
  inp.addEventListener("focus", () => inp.select());
  inp.addEventListener("click", () => inp.select());
  const cp = ov.querySelector(".share-sheet__copy");
  cp.addEventListener("click", async () => {
    const ok = await copyText(link);
    cp.textContent = ok ? (ar ? "تم النسخ ✓" : "Copied ✓") : (ar ? "حدّد الرابط وانسخه يدويًا" : "Select the link & copy manually");
    if (ok) showToast(ar ? "تم نسخ الرابط ✓" : "Link copied ✓");
    else { inp.focus(); inp.select(); }
  });
  const os = ov.querySelector(".share-sheet__os");
  if (os) os.addEventListener("click", () => { try { navigator.share({ title: "Firas AI", url: link }); } catch (_) {} });
}

/* Public read-only viewer for /?share=<id> — no login needed. Renders with the SAME pipeline
   as the app (markdown + KaTeX + instant plots/tikz), plus a CTA to try Firas AI. */
async function checkShareLink() {
  const id = new URLSearchParams(location.search).get("share");
  if (!id) return false;
  let snap = null;
  try { snap = await apiJson("/api/share?id=" + encodeURIComponent(id)); } catch (_) {}
  // inline display:none — the `hidden` attribute loses to class display rules in the cascade
  [...document.body.children].forEach((c) => { if (c.tagName !== "SCRIPT" && c.tagName !== "STYLE") c.style.display = "none"; });
  const wrap = document.createElement("div");
  wrap.className = "share-page";
  const arPage = snap && /[؀-ۿ]/.test((snap.title || "") + (snap.messages && snap.messages[0] ? snap.messages[0].content : ""));
  wrap.dir = arPage ? "rtl" : "ltr";
  const head = document.createElement("header");
  head.className = "share-page__head";
  head.innerHTML = '<div class="share-page__brand">Firas&nbsp;AI</div>' +
    '<a class="share-page__cta" href="/">' + (arPage ? "جرّب فِراس مجانًا" : "Try Firas AI free") + "</a>";
  wrap.appendChild(head);
  const col = document.createElement("main");
  col.className = "share-page__col";
  if (!snap) {
    col.innerHTML = '<p class="share-page__missing">' + (state.lang === "ar" ? "هذا الرابط غير موجود أو حُذف." : "This shared chat doesn't exist or was removed.") + "</p>";
  } else {
    if (snap.title) { const h = document.createElement("h1"); h.className = "share-page__title"; h.textContent = snap.title; col.appendChild(h); }
    (snap.messages || []).forEach((m) => {
      if (m.role === "user") {
        const row = document.createElement("div"); row.className = "share-page__user";
        const b = document.createElement("div"); b.className = "msg-user__bubble";
        b.dir = (m.lang === "ar" || /[؀-ۿ]/.test(m.content || "")) ? "rtl" : "ltr";
        if (Array.isArray(m.imageThumbs) && m.imageThumbs.length) {
          const g = document.createElement("div"); g.className = "msg-user__images"; g.dir = "ltr";
          m.imageThumbs.forEach((src) => { const im = document.createElement("img"); im.src = src; im.alt = ""; g.appendChild(im); });
          b.appendChild(g);
        }
        if (m.content) { const tx = document.createElement("div"); tx.style.whiteSpace = "pre-wrap"; tx.textContent = m.content; b.appendChild(tx); typesetMath(tx); }
        row.appendChild(b); col.appendChild(row);
      } else {
        const md = document.createElement("div"); md.className = "md share-page__ai";
        const lg = (m.lang === "ar" || /[؀-ۿ]/.test(m.content || "")) ? "ar" : "en";
        md.dir = lg === "ar" ? "rtl" : "ltr";
        // Card messages must render as CARDS here too — raw firas-agent/deck/project JSON is
        // meaningless to a share visitor.
        const shImg = parseImageMeta(m.content), shAgent = !shImg && parseAgentMeta(m.content),
          shDeck = !shImg && !shAgent && parseDeckMeta(m.content),
          shProj = !shImg && !shAgent && !shDeck && parseProjectMeta(m.content),
          shCode = !shImg && !shAgent && !shDeck && !shProj && parseCodeMeta(m.content);
        try {
          if (shAgent) md.appendChild(buildAgentCard(shAgent, lg));
          else if (shDeck) md.appendChild(buildDeckCard(shDeck, lg, m));
          else if (shProj) md.appendChild(buildProjectCard(shProj, lg));
          else if (shImg) md.appendChild(buildImageCard(shImg, lg));
          else if (shCode) md.appendChild(buildCodeCard(shCode, lg));
          else { md.innerHTML = renderMarkdown(m.content || ""); decorateMarkdown(md); typesetMath(md); }
        } catch (_) { md.innerHTML = renderMarkdown(m.content || ""); decorateMarkdown(md); typesetMath(md); }
        col.appendChild(md);
      }
    });
  }
  wrap.appendChild(col);
  document.body.appendChild(wrap);
  document.title = (snap && snap.title) ? (snap.title + " — Firas AI") : "Firas AI";
  return true;
}

async function init() {
  loadState();
  cacheEls();
  startVersionWatch();
  setupAuthChannel();
  setupCookieConsent();         // cookie-consent banner (auth screen only)
  injectBrandMarks();           // brand the static markup (topbar, sidebar, auth)
  applyTheme(state.theme);
  applyThink();
  applyWebSearch();
  applySidebarCollapsed();
  buildTierSwitch();
  buildModeSwitch();
  applyShellLang(state.lang);
  setTier(state.tier);
  wireEvents();
  wireAuth();
  autoGrow();
  updateSendState();

  // An email verification link (?verify=token) or a password-reset link (?reset=…&uid=…)
  // takes over the screen before the auth gate.
  if (await checkVerifyLink()) return;
  if (checkResetLink()) return;
  if (await checkGoogleRedirect()) return;   // finish a Google sign-in that used the redirect fallback
  if (await checkShareLink()) return;        // public read-only shared chat (/?share=<id>) — no login

  // Auth gate: ask the server who we are. A valid session skips the landing and
  // goes straight to the app; a logged-out visitor sees the polished landing
  // hero FIRST (the "Get Started" button then opens the auth screen).
  try {
    const data = await apiJson("/api/auth/me");
    const user = (data && data.user) || data;
    if (user) { await bootApp(user); return; }
    showLanding();
  } catch (err) {
    if (err && err.status === 401) {
      showLanding();
    } else {
      // Network/server error reaching auth: still show landing so the user can act.
      showLanding();
      showToast(t().authNetworkError);
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
