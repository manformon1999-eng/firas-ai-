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
    max_tokens: 5000,
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
      "You are Firas Max, THE most powerful and intelligent Firas tier — a frontier-level " +
      "expert. Reason with exceptional depth and rigor, think step by step, and double-check " +
      "yourself before answering. You are a world-class mathematician at the level of the " +
      "International Mathematical Olympiad, Putnam, and JEE Advanced: treat every quantitative " +
      "problem as a hard competition problem — identify the underlying structure, name and apply " +
      "the relevant theorems/lemmas, and build a clean, fully rigorous derivation with every " +
      "algebraic and arithmetic step exact (exact closed forms — fractions, radicals, π, e — " +
      "never rounded decimals unless explicitly asked). INDEPENDENTLY VERIFY the result by a " +
      "second method (differentiate back, substitute, check limits/units/special cases) before " +
      "giving it, then present the final answer on its own line as **Answer:** $…$. WRAP ALL " +
      "math in LaTeX (inline $...$, display $$...$$). For PROGRAMMING, deliver production-grade, " +
      "idiomatic, fully runnable code — never stubs or placeholders — with type signatures where " +
      "supported, input validation, correct edge-case/error handling, and the imports/setup " +
      "needed to run it. Be the most thorough, insightful and reliable assistant possible — " +
      "handle nuance, edge-cases and trade-offs explicitly. Always answer in the user's language.",
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
      { icon: "spark", title: "أربعة نماذج ذكية", desc: "«ميني» للسرعة، و«برو» للمهام اليومية، و«أولترا» للأسئلة الصعبة والبرمجة، و«ماكس» (تجريبي) الأقوى للرياضيات والتحليل العميق." },
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
      { icon: "spark", title: "Four smart models", desc: "“Mini” for speed, “Pro” for everyday tasks, “Ultra” for hard questions & coding, and “Max” (beta) — the strongest for math & deep analysis." },
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

const state = {
  chats: [],          // sidebar list: [{ id, title, updatedAt, messages? }] — messages loaded on open
  activeId: null,
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
function detectCodeRequest(text) {
  if (!text) return null;
  const s = String(text);
  if (CODE_DOC_OVERRIDE.test(s)) return null; // explicit doc format → not code
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

/** Should this assistant message be MASKED as a streaming/finished FILE (loader +
    card + collapsed disclosure instead of raw content)? True when the user
    requested a file format for this turn AND this turn actually delivers it —
    i.e. not a plan-mode clarifying/plan turn (those come before approval). */
function isFileStreamReply(msg, chat) {
  if (!msg || msg.offline) return null;
  const c = chat || activeChat();
  if (!c || !Array.isArray(c.messages)) return null;
  const index = c.messages.indexOf(msg);
  if (index < 0) return null;
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
  const payload = { title: chat.title, messages: serializeMessages(chat.messages), pinned: !!chat.pinned };
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
function protectMath(text, store) {
  const stash = (m) => { const i = store.length; store.push(m); return "" + i + ""; };
  let s = String(text);
  s = s.replace(/\$\$[\s\S]+?\$\$/g, stash);     // display $$ ... $$
  s = s.replace(/\\\[[\s\S]+?\\\]/g, stash);     // display \[ ... \]
  s = s.replace(/\\\([\s\S]+?\\\)/g, stash);     // inline  \( ... \)
  s = s.replace(/\$(?!\s)[^$\n]*?[^\s$]\$(?!\d)/g, stash); // inline $ ... $
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

function renderMarkdown(text, opts) {
  text = stripFileMetaBlock(text); // never render the AI's file-metadata block
  text = stripImageMetaBlock(text); // nor the image-generation block
  text = stripCodeMetaBlock(text); // nor the code-deliverable block
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
}

/** Typeset LaTeX math in a rendered node via KaTeX auto-render. Never throws.
    Runs on already-sanitized DOM. Supports $..$, \(..\), $$..$$, \[..\]. */
function typesetMath(node) {
  if (!node || typeof window.renderMathInElement !== "function") return;
  try {
    window.renderMathInElement(node, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
    });
  } catch (_) { /* KaTeX unavailable or parse issue — leave text as-is */ }
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
  els.themeToggle.setAttribute("aria-checked", theme === "dark" ? "true" : "false");
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
      `<span class="tier-name" data-short="${m.short[state.lang]}">${m.short[state.lang]}</span>` +
      (m.key === "max" ? `<span class="tier-beta">beta</span>` : "");
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
  let chats = state.chats.slice().sort((a, b) => b.updatedAt - a.updatedAt);
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
  }
  turn.appendChild(bubble);
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
  head.innerHTML =
    `<span class="msg-ai__avatar" aria-hidden="true"><span class="glyph">F</span></span>` +
    `<span class="msg-ai__name">Firas</span>` +
    `<span class="msg-ai__badge" data-tier="${tier.key}"><span class="dot"></span>${tier.short.en.toUpperCase()}</span>`;
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
  const codeMeta = !imgMeta ? parseCodeMeta(msg.content) : null;
  const fileFmt = !imgMeta && !codeMeta && msg.content && msg.content.trim() ? isFileStreamReply(msg, activeChat()) : null;
  if (imgMeta) {
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
  // it survives a reload) and is a real reply (not the offline fallback).
  if (msg.content && msg.content.trim() && !msg.offline && !imgMeta && !codeMeta) {
    const fmt = requestedFormatForAssistant(activeChat(), index);
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
    `<button type="button" class="file-card__dl">${ICONS.download}<span>${escapeHtml(t().fileDownload)}</span></button>`;

  const run = () => {
    const turn = card.closest(".msg-ai");
    meta.run(turn, msg);
  };
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
function themeFor(meta) {
  const key = meta && String(meta.theme || "").toLowerCase().trim();
  return FILE_THEMES[key] || FILE_THEMES.teal;
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
      const want = isAr
        ? ["400 1em Tajawal", "500 1em Tajawal", "700 1em Tajawal", "800 1em Tajawal", "600 1em Cairo", "700 1em Cairo", "800 1em Cairo"]
        : ["400 1em Lora", "500 1em Lora", "700 1em Lora", "italic 400 1em Lora", "500 1em Inter", "600 1em Inter", "700 1em Inter"];
      // Never hang the export on a slow/blocked CDN → cap the wait, then fall back.
      await Promise.race([
        Promise.all(want.map((f) => document.fonts.load(f).catch(() => {}))).then(() => document.fonts.ready),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    }
  } catch (_) { /* offline / blocked → system fonts */ }
}

function exportCss(th, isAr, scope) {
  const fontStack = isAr ? '"Tajawal","Segoe UI","Tahoma",Arial,sans-serif' : '"Lora",Georgia,"Times New Roman","Cambria",serif';
  const sansStack = isAr ? '"Cairo","Tajawal","Segoe UI",Arial,sans-serif' : '"Inter","Helvetica Neue","Segoe UI",Arial,sans-serif';
  const bg = th.bg || "FFFFFF", ink = th.ink || "1A1A18", line = th.border || "D8D6CB";
  const root = scope || "body";
  const dp = scope ? scope + " " : "";
  const rdp = scope ? scope + "[dir=rtl] " : "[dir=rtl] ";
  return (
    (scope ? scope + "{width:794px;overflow:hidden}" : "@page{size:A4;margin:18mm 16mm}") +
    dp + "*{box-sizing:border-box}" +
    root + "{font-family:" + fontStack + ";color:#" + ink + ";background:#" + bg + ";line-height:1.7;font-size:11.5pt;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    dp + ".cover{position:relative;height:251mm;background:#" + th.deep + ";color:#FFF;page-break-after:always;break-after:page;overflow:hidden}" +
    dp + ".cover__pad{position:absolute;inset:0;padding:26mm 22mm;display:flex;flex-direction:column}" +
    dp + ".cover__brand{font-family:" + sansStack + ";font-size:13pt;font-weight:700;letter-spacing:.06em;color:#" + th.coverAccent + ";text-transform:uppercase}" +
    dp + ".cover__mid{margin-top:auto;margin-bottom:auto}" +
    dp + ".cover__title{font-family:" + fontStack + ";font-size:34pt;line-height:1.15;font-weight:700;margin:0;color:#FFF}" +
    dp + ".cover__sub{font-family:" + sansStack + ";font-size:15pt;line-height:1.4;margin:.6em 0 0;color:#" + th.coverAccent + ";font-weight:400}" +
    dp + ".cover__rule{width:64mm;height:4px;background:#" + th.coverAccent + ";margin-top:10mm;border-radius:2px}" +
    rdp + ".cover__rule{margin-left:auto}" +
    dp + ".cover__date{font-family:" + sansStack + ";font-size:11pt;color:rgba(255,255,255,.72)}" +
    dp + ".doc{padding-top:2mm}" +
    dp + "h1," + dp + "h2," + dp + "h3," + dp + "h4{font-family:" + sansStack + ";color:#" + ink + ";line-height:1.3;font-weight:700;" + (isAr ? "letter-spacing:normal;word-spacing:.04em;" : "letter-spacing:-.01em;") + "page-break-after:avoid;break-after:avoid}" +
    dp + "h1{font-size:22pt;margin:.2em 0 .5em;padding-bottom:.22em;border-bottom:2.5px solid #" + th.accent + "}" +
    dp + "h2{font-size:16.5pt;margin:1.2em 0 .45em;color:#" + th.accent + "}" +
    dp + "h3{font-size:13.5pt;margin:1em 0 .4em}" +
    dp + "h4{font-size:12pt;margin:.9em 0 .35em}" +
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
    dp + "pre{background:#1f2422;color:#eef1ef;border-radius:8px;padding:13px 15px;overflow:auto;direction:ltr;text-align:left;page-break-inside:avoid;font-size:9.5pt;line-height:1.55}" +
    dp + "pre code{background:none;padding:0;font-size:inherit;color:inherit}" +
    dp + "table{border-collapse:collapse;width:100%;margin:.6em 0 1.1em;font-size:10pt;page-break-inside:avoid}" +
    dp + "th," + dp + "td{border:1px solid #" + line + ";padding:8px 11px;text-align:start;vertical-align:top}" +
    dp + "th{background:#" + th.accent + ";color:#fff;font-weight:700}" +
    dp + "tr:nth-child(even) td{background:#" + th.zebra + "}" +
    dp + "img{max-width:100%;page-break-inside:avoid;border-radius:6px}" +
    dp + ".katex{font-size:1.05em}" +
    dp + ".katex-display{margin:1.15em 0;max-width:100%;overflow:visible;page-break-inside:avoid;direction:ltr;text-align:center}" +
    dp + ".katex{max-width:100%;direction:ltr}" +
    dp + ".katex-display>.katex{display:inline-block;text-align:initial}"
  );
}

/** Build the cover + body HTML (no <style>). Returns { cover, body, hasCover }. */
function exportBody(mdNode, lang, meta) {
  const clone = mdNode.cloneNode(true);
  clone.querySelectorAll(".code-block__head, .code-block__copy, .code-preview-btn, .file-disclosure__summary").forEach((n) => n.remove());
  const body = clone.innerHTML;
  const title = escapeHtml(meta.title || (activeChat() && activeChat().title) || "");
  const subtitle = escapeHtml(meta.subtitle || "");
  const dateStr = escapeHtml(meta.date || todayStr(lang));
  const cover = title ? (
    "<section class='cover'><div class='cover__pad'>" +
      "<div class='cover__brand'>Firas&nbsp;AI</div>" +
      "<div class='cover__mid'>" +
        "<h1 class='cover__title'>" + title + "</h1>" +
        (subtitle ? "<p class='cover__sub'>" + subtitle + "</p>" : "") +
        "<div class='cover__rule'></div>" +
      "</div>" +
      "<div class='cover__date'>" + dateStr + "</div>" +
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
    '<head><meta charset="utf-8"><style>' + exportCss(th, isAr, "") + "</style></head><body>" +
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
  root.innerHTML = "<style>" + exportCss(th, isAr, "#firasExportRoot") + "</style>" + cover + "<div class='doc'>" + body + "</div>";
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
  showToast(t().preparing);
  let root = null;
  try {
    await loadScripts(EXPORT_LIBS.pdf);
    const H2C = window.html2canvas;
    const JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!H2C || !JsPDF) throw new Error("nolib");
    ensureFileTitle(meta, mdNode);
    const th = themeFor(meta);
    const bg = "#" + (th.bg || "FFFFFF");
    const rgb = hexToRgb(th.accent);
    const footRgb = hexToRgb(th.ink || "808080");
    // Build + attach the themed root in-place (styles + KaTeX apply correctly).
    root = buildExportRoot(mdNode, lang, meta);
    document.body.appendChild(root);
    await ensureExportFonts(lang === "ar");       // professional fonts ready before capture
    await new Promise((r) => setTimeout(r, 220)); // let layout + fonts + KaTeX fully settle (prevents mis-measured breaks)

    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const pageW = 210, pageH = 297, mL = 14, mT = 15, mB = 16;
    const contentW = pageW - mL - 14;           // 182mm text column
    const contentH = pageH - mT - mB;           // 266mm text height
    // Adaptive scale: crisp (~300 DPI) for normal docs, auto-reduced for very long ones so the
    // single html2canvas capture never exceeds the browser's max canvas size (which would blank/
    // clip the bottom — a cause of "deleted" content).
    const _docPxH = ((root.querySelector(".doc") || {}).scrollHeight) || 1;
    const scale = (_docPxH * 2.7 > 30000) ? Math.max(1.6, 30000 / _docPxH) : 2.7;
    const toJpeg = (c) => c.toDataURL("image/jpeg", 0.97);
    let pageStarted = false;

    // ---- Cover: full-bleed page 1 ----
    const coverEl = root.querySelector(".cover");
    if (coverEl) {
      const cc = await H2C(coverEl, { scale, backgroundColor: "#" + th.deep, windowWidth: 794, logging: false, useCORS: true });
      pdf.addImage(toJpeg(cc), "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
      pageStarted = true;
    }

    // ---- Content: render .doc once, paginate at block boundaries (never split an equation/table/figure) ----
    const docEl = root.querySelector(".doc");
    const dc = await H2C(docEl, { scale, backgroundColor: bg, windowWidth: 794, logging: false, useCORS: true });
    const pxPerMm = dc.width / contentW;
    const pageHpx = Math.floor(contentH * pxPerMm);
    const dTop = docEl.getBoundingClientRect().top;
    // Break candidates = the BOTTOM edge (canvas px) of every block we must not split:
    // direct children PLUS display equations, tables, images, code, lists, paragraphs &
    // headings (even when nested), so a page can always end cleanly before a tall block.
    const headings = new Set(docEl.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    const blockEls = new Set([
      ...docEl.querySelectorAll(":scope > *"),
      ...docEl.querySelectorAll(".katex-display, table, img, pre, blockquote, figure, p, li"),
    ]);
    const raw = [];
    // Non-heading blocks: break AFTER (bottom edge). Headings: break BEFORE (top edge) so a
    // heading is never left orphaned at the bottom — it travels to the next page WITH its content.
    for (const el of blockEls) { if (!headings.has(el)) raw.push((el.getBoundingClientRect().bottom - dTop) * scale); }
    for (const el of headings) { raw.push((el.getBoundingClientRect().top - dTop) * scale); }
    const bounds = raw.map((b) => Math.round(b)).filter((b) => b > 0).sort((a, b) => a - b);
    const MIN_FILL = pageHpx * 0.12;   // allow an early break to push a tall block down, but avoid near-empty pages
    let start = 0;
    while (start < dc.height - 1) {
      const maxEnd = Math.min(start + pageHpx, dc.height);
      let end = maxEnd;
      if (end < dc.height) {
        // largest block boundary that fits → clean break, no split. If none fits, a single
        // block is taller than a whole page → forced split at maxEnd (unavoidable).
        let cut = 0;
        for (const b of bounds) { if (b > start + MIN_FILL && b <= maxEnd) cut = b; }
        if (cut > start) end = cut;
      }
      const sliceH = Math.max(1, end - start);
      const tmp = document.createElement("canvas");
      tmp.width = dc.width; tmp.height = sliceH;
      const ctx = tmp.getContext("2d");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, tmp.width, tmp.height);
      ctx.drawImage(dc, 0, start, dc.width, sliceH, 0, 0, dc.width, sliceH);
      if (pageStarted) pdf.addPage();
      pageStarted = true;
      pdf.addImage(toJpeg(tmp), "JPEG", mL, mT, contentW, sliceH / pxPerMm, undefined, "FAST");
      start = end;
    }

    // ---- Footers with page numbers (skip the cover) ----
    const total = pdf.internal.getNumberOfPages();
    const firstContent = coverEl ? 2 : 1;
    for (let i = firstContent; i <= total; i++) {
      pdf.setPage(i);
      pdf.setDrawColor(rgb.r, rgb.g, rgb.b); pdf.setLineWidth(0.3);
      pdf.line(14, pageH - 10, pageW - 14, pageH - 10);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
      pdf.setTextColor(rgb.r, rgb.g, rgb.b); pdf.text("Firas AI", 14, pageH - 6);
      pdf.setTextColor(footRgb.r, footRgb.g, footRgb.b); pdf.text(i + " / " + total, pageW - 14, pageH - 6, { align: "right" });
    }
    pdf.save(resolveFileName(meta, "pdf"));
  } catch (_) {
    showToast(t().formatUnavailable);
  } finally {
    if (root) { try { root.remove(); } catch (_) {} }
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
  const push = () => { if (cur && (cur.title || cur.bullets.length)) slides.push(cur); };
  lines.forEach((raw) => {
    const line = raw.replace(/\r$/, "");
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      push();
      cur = { title: h[2].replace(/[*_`#]/g, "").trim(), bullets: [] };
      return;
    }
    const txt = line.replace(/^[-*+]\s+/, "").replace(/[*_`#>]/g, "").trim();
    if (!txt) return;
    if (!cur) cur = { title: fallbackTitle, bullets: [] };
    cur.bullets.push(txt);
  });
  push();
  // Cap bullets per slide so content stays readable.
  return slides.map((s) => ({ title: s.title, bullets: s.bullets.slice(0, 12) }));
}

async function exportPpt(turn, lang, msg) {
  const parsed = parseFileMeta(msg && msg.content);
  const meta = parsed.meta;
  const md = (parsed.body && parsed.body.trim()) || (mdNodeForTurn(turn) ? mdNodeForTurn(turn).textContent : "");
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
    let slides = slidesFromMarkdown(md, titleText);
    // Drop a leading "# Deck Title" slide (no bullets, title == the cover) so the
    // deck doesn't open with a near-empty duplicate of the cover.
    const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (slides.length && !slides[0].bullets.length && norm(slides[0].title) === norm(titleText)) {
      slides = slides.slice(1);
    }
    const list = slides.length ? slides : [{ title: titleText, bullets: md.split(/\n+/).slice(0, 12) }];
    list.forEach((s, idx) => {
      const sl = pptx.addSlide();
      sl.background = { color: "FFFFFF" };
      sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.14, fill: { color: accent } }); // top accent bar
      if (s.title) {
        sl.addText(s.title.slice(0, 110), { x: 0.55, y: 0.45, w: W - 1.1, h: 0.8, fontSize: 26, bold: true, color: deep, align: al, rtlMode: rtl, fontFace: titleFace });
        sl.addShape(pptx.ShapeType.rect, { x: 0.55, y: 1.2, w: 1.6, h: 0.05, fill: { color: accent } });
      }
      if (s.bullets.length) {
        sl.addText(s.bullets.map((b) => ({ text: b, options: { bullet: { code: "2022", indent: 16 }, breakLine: true } })), {
          x: 0.65, y: 1.5, w: W - 1.3, h: H - 2.1, fontSize: 16, color: "1A1A18", lineSpacingMultiple: 1.18,
          align: al, rtlMode: rtl, valign: "top",
        });
      }
      // Footer: brand + page number.
      sl.addText("Firas AI", { x: 0.55, y: H - 0.42, w: 3, h: 0.3, fontSize: 9, color: "A8A69E", align: al, rtlMode: rtl });
      sl.addText(String(idx + 1), { x: W - 1.05, y: H - 0.42, w: 0.5, h: 0.3, fontSize: 9, color: "A8A69E", align: "right" });
    });
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
  els.chatScroll.scrollTop = els.chatScroll.scrollHeight;
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
const MAX_IMAGES = 4;
const MAX_EDGE = 1568;       // longest edge sent to the vision model
const THUMB_EDGE = 256;      // tiny thumb persisted to history
let pendingImages = [];
let readingImages = 0;       // >0 while ANY attachment (image/doc) is being processed (disables send)

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
    " For ANY mathematics, physics or scientific notation, ALWAYS format it as LaTeX: " +
    "inline math as $...$ and display math as $$...$$ — never write raw unformatted formulas. " +
    "MATH RIGOR: solve step by step, carry out every algebraic and arithmetic step exactly, and " +
    "VERIFY the result before giving it (e.g. differentiate an antiderivative back to the integrand, " +
    "substitute values to check an identity or equation, sanity-check limits and edge cases). Never " +
    "state a numeric or symbolic result you have not checked. Give EXACT closed-form results " +
    "(fractions, radicals, π, e, exact symbolic forms) — do NOT round to decimals unless the user " +
    "explicitly asks. For proofs, write a clean structured argument (state what is given, what is to " +
    "be shown, then the proof, ending with ∎), and present the final answer clearly on its own line.";
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
  const accuracyRule =
    " ACCURACY — DO NOT FABRICATE: never invent facts, especially recent events, sports scores/results, " +
    "match line-ups, goalscorers, statistics, prices, or dates. If WEB SEARCH RESULTS are provided, rely on them " +
    "and cite. If you do NOT have reliable information about something (e.g. a match result, a current office-holder, " +
    "a future/recent event), say clearly that you're not certain and offer to look it up — NEVER make up a specific " +
    "score, name, or detail. If a match/event did not happen or you can't confirm it, say so plainly. A correct " +
    "'I'm not sure' is far better than a confident wrong answer, and inventing a fake result is unacceptable.";
  // In PLAN MODE, do NOT send buildRule/engineerRule — they push the model to emit the
  // full code/deliverable, which contradicts planSystem and caused the plan itself to be
  // written as a code block (then the Start pill was suppressed). planSystem alone governs.
  const planning = state.mode === "plan";
  const system = {
    role: "system",
    content: model.persona + identityRule + langRule + mathRule + accuracyRule + (planning ? "" : buildRule + engineerRule),
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
    '"title": "the document/deck title", "subtitle": "one short line or empty", "theme": "<one theme key>"}\n' +
    "```\n" +
    "YOU choose the filename — specific and professional, derived from the request " +
    "(e.g. “20 معادلة تكامل”, not “document”). " + themes;
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
    "```firas-file\n{\"filename\":\"short meaningful name in the user's language, no extension\",\"title\":\"a strong, " +
    "specific title\",\"subtitle\":\"one concise line or empty\",\"theme\":\"<one theme key>\"}\n```\nthen a blank line, " +
    "then a concise OUTLINE (bullet list) of the sections/items in order — a professional flow (clear opening/intro, " +
    "logically grouped main sections with descriptive headings, supporting tables/lists where useful, and a closing/" +
    "summary). If the user asked for N items (e.g. N equations), plan exactly N. Pick a theme whose tone fits the topic." +
    AGENT_THEMES + " No preamble, no commentary." + agentBrand(lang);
}
function authorSys(fmt, lang) {
  const mathRule = " Render ALL mathematics with real LaTeX inside $ … $ (inline) or $$ … $$ (display) so it typesets " +
    "beautifully (like KaTeX) — use proper notation: \\frac, \\sqrt, ^{}, _{}, \\int, \\sum, \\prod, \\lim, Greek letters, " +
    "vectors/matrices via \\begin{matrix}…\\end{matrix} or \\begin{bmatrix}…, multi-line derivations via " +
    "\\begin{aligned}…\\end{aligned}, and piecewise via \\begin{cases}…\\end{cases}. Present each result cleanly and " +
    "professionally, define symbols, and show key steps. NEVER put math in a code block, NEVER use \\documentclass or " +
    "\\begin{document}, and NEVER tell the user to compile or use Overleaf.";
  if (fmt === "xlsx" || fmt === "csv") return "You are an expert data author. Following the plan, output the data as clean " +
    "GitHub-style Markdown tables, each preceded by a '## Table Name' heading; plain numbers in numeric cells. Only the " +
    "content — no metadata block, no preamble, no code." + agentBrand(lang);
  if (fmt === "pptx") return "You are an expert presentation author. Following the plan, output slides: a single " +
    "'# Deck Title' then each slide as '## Slide Title' + 3-6 short bullets. Only the content, no metadata block, no " +
    "preamble." + mathRule + agentBrand(lang);
  return "You are an elite document author and editor producing a POLISHED, PROFESSIONAL document. Following the plan, " +
    "write the FULL, accurate, thorough CONTENT as clean Markdown: a strong '# Title', a brief engaging introduction, " +
    "logical ##/### sections with descriptive headings, clear well-written paragraphs (real prose, not terse fragments), " +
    "bulleted/numbered lists where they aid clarity, GitHub-style Markdown tables for any structured data, and blockquotes " +
    "for key takeaways. Keep a confident professional tone with smooth flow between sections, and finish with a concise " +
    "conclusion/summary when appropriate. Be complete and correct: if N items were requested, produce exactly N, each " +
    "properly explained." + mathRule + " Output ONLY the document body — no metadata block, no preamble, no commentary." + agentBrand(lang);
}
function finisherSys(fmt, lang) {
  return "You are the finishing editor. You are given a metadata block and a draft. Output the FINAL " + fmt.toUpperCase() +
    " file: the metadata block EXACTLY as given (first), a blank line, then the COMPLETE, polished content. Keep ALL " +
    "content — never drop or summarize sections. Fix any problems: remove any preamble/greeting/commentary, convert any " +
    "LaTeX-document or code-block math into inline $$ … $$ rendered math, ensure a strong '# Title' matching the " +
    "metadata, with consistent professional formatting and logical order. " +
    "IMPORTANT: if the draft is actually a PROGRAM/SCRIPT/code or a 'how-to' tutorial (e.g. Python, python-docx, " +
    "pip install, HTML) instead of a real document, EXTRACT the actual content from it (the equations, data, text, " +
    "titles) and rewrite it as a proper Markdown document — discard ALL code, commands, install/run steps and instructions. " +
    "Output nothing but the final file." + agentBrand(lang);
}
function metaBlockString(meta) {
  const m = (meta && typeof meta === "object") ? meta : {};
  return "```firas-file\n" + JSON.stringify({
    filename: m.filename || "", title: m.title || "", subtitle: m.subtitle || "", theme: m.theme || "teal",
  }) + "\n```";
}
function fileStageText(stage, lang) {
  const ar = lang === "ar";
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
  return out;
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
  return out;
}

/** Heuristic: does this code already look like a COMPLETE file (so Continue no-ops)? */
function codeLooksComplete(code, lang) {
  const s = String(code || "").replace(/\s+$/, "");
  if (!s) return false;
  const isHtml = lang === "html" || /<!doctype html|<html[\s>]/i.test(s);
  if (isHtml) return /<\/html>\s*$/i.test(s);
  const opens = (s.match(/\{/g) || []).length, closes = (s.match(/\}/g) || []).length;
  return opens === closes && /[}\);\]>]\s*$/.test(s);
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
async function runFileAgentPipeline(convo, fmt, lang, tierKey, signal, onStage) {
  // Files ALWAYS use the general document model (gpt-oss = "pro"), never the coder
  // (Ultra = qwen3-coder) — a coding model turns "make a PDF" into an HTML website.
  tierKey = "pro";
  const lastUser = [...convo].reverse().find((m) => m.role === "user");
  const userText = lastUser ? lastUser.content : "";
  // BIG-COUNT branch: a request for many items ("1000 integrals/problems/questions…")
  // would truncate in a single author call → generate it in parallel BATCHES instead.
  const cm = userText.match(/(\d[\d,]{1,5})\s*\+?\s*(?:integrals?|problems?|questions?|exercises?|equations?|items?|mcqs?|تكاملات?|مسائل|مسأل[ةه]?|أسئلة|سؤال|تمارين|تمرين|انتيكرل|انتقرل|معادلات?|معادلة)/i);
  const bigCount = cm ? parseInt(cm[1].replace(/,/g, ""), 10) : 0;
  if (bigCount >= 80 && fmt !== "xlsx" && fmt !== "csv" && fmt !== "pptx") {
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
  const content = (await callAgentText([
    { role: "system", content: authorSys(fmt, lang) },
    { role: "user", content: "REQUEST:\n" + userText + "\n\nFILE PLAN:\n" + metaBlock + "\n" + outline + "\n\nWrite the full content now, following the plan exactly." },
  ], tierKey, signal)).trim();
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
  return finalDoc;
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
    "Be CREATIVE and VARIED — never repeat a pattern. No preamble, no commentary, no headings — nothing but the numbered problems and the answers." +
    seedExamples() + agentBrand(lang);
}
function batchUserMsg(userText, start, end, cat, lang) {
  return "Workbook request (context): " + String(userText).slice(0, 600) +
    "\n\nGenerate problems numbered EXACTLY " + start + " to " + end + " (" + (end - start + 1) + " problems), this batch " +
    "FOCUSED on: " + cat + ". Make them genuinely HARD (JEE-Advanced / Olympiad) — avoid textbook clones and trivial polynomials; " +
    "every problem should need a real technique. Keep all answers exact closed forms and VERIFIED correct. " +
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
  const ranges = [];
  for (let i = 0; i < Math.ceil(count / BATCH); i++) ranges.push({ start: i * BATCH + 1, end: Math.min((i + 1) * BATCH, count), cat: DEFAULT_ITEM_CATEGORIES[i % DEFAULT_ITEM_CATEGORIES.length] });
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
        { role: "user", content: batchUserMsg(userText, r.start, r.end, r.cat, lang) },
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
async function streamAnswer(aiMsg, aiNode, chat) {
  const tier = MODELS[aiMsg.tier] || MODELS.pro;
  const chatId = chat.id;
  const convo = chat.messages.slice(0, chat.messages.indexOf(aiMsg)); // up to (not incl.) this AI msg
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
      const node = liveNode();
      if (!node) return; // navigated away — keep streaming headless
      aiNode = node;
      const mdEl = aiNode.querySelector(".msg-ai__body .md");
      if (!mdEl) return;
      if (codeReq) {
        // Code request → stream the source live into a code window.
        renderLiveCodeInto(mdEl, answer, codeReq, replyLang);
        mdEl.classList.remove("stream-caret");
      } else {
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
    // VISION turn → tell the model to answer thoroughly and, when asked to extract/
    // read text, transcribe ALL of it COMPLETELY and verbatim (not just a summary).
    const lastUForVision = [...convo].reverse().find((m) => m.role === "user");
    if (lastUForVision && Array.isArray(lastUForVision.images) && lastUForVision.images.length && !codeReq) {
      const vSys = replyLang === "ar"
        ? "أنت ترى الصورة/الصور المرفقة. إن طُلب منك استخراج أو نسخ أو قراءة النص من الصورة، فاكتب كل النص كاملًا وحرفيًا — كل عنوان وفقرة وسطر ونقطة بالترتيب — دون تلخيص أو اختصار أو توقّف مبكّر، إلى آخر كلمة في الصفحة. وإلا فأجب عن السؤال المتعلّق بالصورة بدقّة وتفصيل."
        : "You can see the attached image(s). If asked to extract, transcribe, or read text from the image, output ALL the text COMPLETELY and verbatim — every heading, paragraph, line and bullet, in order — never summarize, abbreviate, or stop early; continue to the very last word on the page. Otherwise answer the question about the image accurately and in detail.";
      requestMessages = [requestMessages[0], { role: "system", content: vSys }, ...requestMessages.slice(1)];
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
    } else {
      // Any failure (offline, CORS, 5xx, timeout, empty): serve fallback.
      const fb = offlineFallback(convo, aiMsg.lang);
      aiMsg.content = fb;
      aiMsg.reasoning = reasoning;
      aiMsg.offline = true;
      finalizeAi(aiMsg, chat);
      const liveNode = activeChat() === chat ? aiNode : null;
      if (liveNode && liveNode.isConnected) showInlineError(liveNode, convo, aiMsg);
    }
  } finally {
    activeStreams.delete(chatId);
    endStreaming(chatId);
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
  // is a real reply. The placeholder turn was built empty (no card yet).
  if (!imgMeta && !codeMeta && !aiNode.querySelector(".file-card") &&
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
    els.sendBtn.setAttribute("aria-label", "Send");
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

  // Push user message (images: full raw b64 for the live request only;
  // imageThumbs: small data-URLs kept for rendering + lean persistence).
  const userMsg = { role: "user", content: text, lang, tier: state.tier };
  if (ready.length) {
    userMsg.images = ready.map((p) => p.full.b64);          // RAW base64, no prefix
    userMsg.imageThumbs = ready.map((p) => p.thumb);         // small data-URLs
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
async function runAssistant(chat, tier, replyLang) {
  const aiMsg = { role: "assistant", content: "", reasoning: "", tier, lang: replyLang, mode: state.mode };
  chat.messages.push(aiMsg);

  autoScroll = true; // a new turn always follows to the bottom
  renderThread(chat, true); // includes the new (empty) AI turn

  const aiNode = els.thread.querySelector(`.msg-ai[data-index="${chat.messages.length - 1}"]`);

  beginStreaming(chat.id);
  await streamAnswer(aiMsg, aiNode, chat);
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
  if (unread > 0) { els.notifyBadge.textContent = unread > 9 ? "9+" : String(unread); els.notifyBadge.hidden = false; }
  else els.notifyBadge.hidden = true;
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
async function openAnnouncementsPanel() {
  const ar = state.lang === "ar";
  await fetchAnnouncements();
  // Opening = read everything → clear the badge.
  const newest = annCache.reduce((mx, a) => Math.max(mx, a.ts || 0), 0);
  if (newest) localStorage.setItem(LS_ANN_SEEN, String(newest));
  updateNotifyBadge();

  const ov = document.createElement("div");
  ov.className = "mem-overlay ann-overlay";
  const close = () => { ov.classList.remove("is-open"); setTimeout(() => ov.remove(), 200); };

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
    '<li class="ann-item" data-id="' + String(a.id).replace(/[^A-Za-z0-9_-]/g, "") + '">' +
      (annIsAdmin ? '<button class="ann-del" aria-label="delete" title="' + (ar ? "حذف" : "delete") + '">×</button>' : '') +
      (a.title ? '<h4 class="ann-item-title"></h4>' : '') +
      (annImgOk(a.image) ? '<img class="ann-item-img" alt="">' : '') +
      (a.body ? '<p class="ann-item-body"></p>' : '') +
      '<time class="ann-item-date">' + annDate(a.ts, ar) + '</time>' +
    '</li>'
  ).join("") : '<li class="mem-empty">' + (ar ? "لا توجد تحديثات بعد." : "No updates yet.") + '</li>';

  ov.innerHTML =
    '<div class="mem-card ann-card" role="dialog" aria-modal="true">' +
      '<div class="mem-head"><div style="flex:1">' +
        '<h3>' + (ar ? "تحديثات فِراس AI" : "Firas AI updates") + '</h3>' +
        '<p>' + (ar ? "آخر أخبار وتحديثات المنصّة." : "Latest platform news & updates.") + '</p></div>' +
        '<button class="mem-x" aria-label="' + (ar ? "إغلاق" : "close") + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
      '</div>' +
      adminForm +
      '<ul class="mem-list ann-list">' + items + '</ul>' +
    '</div>';

  // XSS-safe: inject text + validated image src via the DOM, not the HTML string.
  ov.querySelectorAll(".ann-item").forEach((li) => {
    const a = annCache.find((x) => String(x.id).replace(/[^A-Za-z0-9_-]/g, "") === li.getAttribute("data-id"));
    if (!a) return;
    const tEl = li.querySelector(".ann-item-title"); if (tEl) tEl.textContent = a.title || "";
    const bEl = li.querySelector(".ann-item-body"); if (bEl) bEl.textContent = a.body || "";
    const iEl = li.querySelector(".ann-item-img"); if (iEl && annImgOk(a.image)) iEl.src = a.image;
  });

  document.body.appendChild(ov);
  setTimeout(() => ov.classList.add("is-open"), 20);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".mem-x").addEventListener("click", close);

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
        close(); openAnnouncementsPanel();
      } catch (_) { showToast(ar ? "فشل النشر" : "Publish failed"); if (btn) { btn.disabled = false; btn.textContent = ar ? "نشر" : "Publish"; } }
    });
    ov.querySelectorAll(".ann-del").forEach((b) => b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = b.closest(".ann-item").getAttribute("data-id");
      if (!window.confirm(ar ? "حذف هذا التحديث؟" : "Delete this update?")) return;
      try { await apiJson("/api/announcements?id=" + encodeURIComponent(id), { method: "DELETE" }); } catch (_) {}
      close(); openAnnouncementsPanel();
    }));
  }
}

/* ----------------------------------------------------------------------------
   Account settings panel (account · change email · change password · delete)
---------------------------------------------------------------------------- */
function openSettingsPanel() {
  const ar = state.lang === "ar";
  const u = state.user || {};
  const ov = document.createElement("div");
  ov.className = "mem-overlay settings-overlay";
  const close = () => { ov.classList.remove("is-open"); setTimeout(() => ov.remove(), 200); };

  const tx = ar ? {
    title: "الإعدادات", sub: "إدارة حسابك",
    chEmailH: "تغيير البريد الإلكتروني", newEmail: "البريد الجديد", curPw: "كلمة المرور الحالية", saveEmail: "حفظ البريد",
    chPwH: "تغيير كلمة المرور", newPw: "كلمة المرور الجديدة (8 أحرف فأكثر)", savePw: "حفظ كلمة المرور",
    dangerH: "منطقة الخطر", dangerP: "حذف الحساب يمسح جميع محادثاتك نهائياً ولا يمكن التراجع عنه.",
    delBtn: "حذف حسابي", delConfirmP: "للتأكيد، أدخل كلمة مرورك ثم اضغط «حذف نهائي».", cancel: "إلغاء", delFinal: "حذف نهائي",
    okEmail: "تم تحديث البريد ✓", okPw: "تم تغيير كلمة المرور ✓", deleted: "تم حذف حسابك", working: "جارٍ…",
  } : {
    title: "Settings", sub: "Manage your account",
    chEmailH: "Change email", newEmail: "New email", curPw: "Current password", saveEmail: "Save email",
    chPwH: "Change password", newPw: "New password (8+ characters)", savePw: "Save password",
    dangerH: "Danger zone", dangerP: "Deleting your account erases all your conversations permanently. This can't be undone.",
    delBtn: "Delete my account", delConfirmP: "To confirm, enter your password then tap “Delete permanently”.", cancel: "Cancel", delFinal: "Delete permanently",
    okEmail: "Email updated ✓", okPw: "Password changed ✓", deleted: "Your account was deleted", working: "Working…",
  };

  ov.innerHTML =
    '<div class="mem-card settings-card" role="dialog" aria-modal="true">' +
      '<div class="mem-head"><div style="flex:1">' +
        '<h3>' + tx.title + '</h3><p>' + tx.sub + '</p></div>' +
        '<button class="mem-x" aria-label="' + (ar ? "إغلاق" : "close") + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
      '</div>' +
      '<div class="set-body">' +
        '<section class="set-section set-account">' +
          '<span class="set-avatar"></span>' +
          '<div class="set-acct-info"><strong class="set-acct-name"></strong><span class="set-acct-email" dir="ltr"></span></div>' +
        '</section>' +
        '<form class="set-section set-form set-email-form" novalidate>' +
          '<h4>' + tx.chEmailH + '</h4>' +
          '<input class="set-in set-new-email" type="email" dir="ltr" autocomplete="email" placeholder="' + tx.newEmail + '">' +
          '<input class="set-in set-email-pw" type="password" dir="ltr" autocomplete="current-password" placeholder="' + tx.curPw + '">' +
          '<div class="set-err" hidden></div>' +
          '<button type="submit" class="set-save">' + tx.saveEmail + '</button>' +
        '</form>' +
        '<form class="set-section set-form set-pass-form" novalidate>' +
          '<h4>' + tx.chPwH + '</h4>' +
          '<input class="set-in set-cur-pw" type="password" dir="ltr" autocomplete="current-password" placeholder="' + tx.curPw + '">' +
          '<input class="set-in set-new-pw" type="password" dir="ltr" autocomplete="new-password" placeholder="' + tx.newPw + '">' +
          '<div class="set-err" hidden></div>' +
          '<button type="submit" class="set-save">' + tx.savePw + '</button>' +
        '</form>' +
        '<section class="set-section set-danger">' +
          '<h4>' + tx.dangerH + '</h4>' +
          '<p class="set-danger-note">' + tx.dangerP + '</p>' +
          '<button type="button" class="set-del-btn">' + tx.delBtn + '</button>' +
          '<div class="set-del-confirm" hidden>' +
            '<p class="set-danger-note">' + tx.delConfirmP + '</p>' +
            '<input class="set-in set-del-pw" type="password" dir="ltr" autocomplete="current-password" placeholder="' + tx.curPw + '">' +
            '<div class="set-err set-del-err" hidden></div>' +
            '<div class="set-del-row">' +
              '<button type="button" class="set-del-cancel">' + tx.cancel + '</button>' +
              '<button type="button" class="set-del-final">' + tx.delFinal + '</button>' +
            '</div>' +
          '</div>' +
        '</section>' +
      '</div>' +
    '</div>';

  // identity (textContent — XSS-safe)
  const name = (u.name && String(u.name).trim()) || (u.email ? String(u.email).split("@")[0] : "Firas");
  ov.querySelector(".set-avatar").textContent = (name.charAt(0) || "F").toUpperCase();
  ov.querySelector(".set-acct-name").textContent = name;
  ov.querySelector(".set-acct-email").textContent = u.email || "";

  const showErr = (el, msg) => { if (el) { el.textContent = msg; el.hidden = false; } };
  const clrErr = (el) => { if (el) el.hidden = true; };

  document.body.appendChild(ov);
  setTimeout(() => ov.classList.add("is-open"), 20);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".mem-x").addEventListener("click", close);

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
    } catch (er) { showErr(err, (er && er.message) || "error"); }
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
    } catch (er) { showErr(err, (er && er.message) || "error"); }
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
    } catch (er) { showErr(err, (er && er.message) || "error"); fb.disabled = false; fb.textContent = lbl; }
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

  // Regenerating an OLDER reply discards every turn after it. That's destructive
  // and irreversible (and persisted), so confirm when it isn't the last turn.
  const droppedAfter = chat.messages.length - (index + 1);
  if (droppedAfter > 0) {
    const ok = window.confirm(
      state.lang === "ar"
        ? `سيؤدي هذا إلى حذف ${toArabicDigits(droppedAfter)} رسالة تالية في المحادثة. هل تريد المتابعة؟`
        : `This will delete ${droppedAfter} later message(s) in this conversation. Continue?`
    );
    if (!ok) return;
  }

  // Drop the assistant message (and any trailing messages) at/after index.
  chat.messages = chat.messages.slice(0, index);
  // Persisted after the new reply finalizes (finalizeAi -> persistChat).

  // Reply language = last user message language.
  const lastUser = [...chat.messages].reverse().find((m) => m.role === "user");
  const replyLang = lastUser ? (lastUser.lang || detectLang(lastUser.content)) : state.lang;

  await runAssistant(chat, tier || state.tier, replyLang);
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
  if (authEls.resend) authEls.resend.disabled = true;
  try {
    await apiJson("/api/auth/resend-code", { method: "POST", body: JSON.stringify({ email: _verifyEmail }) });
    showAuthNote(t().authCodeResent);
  } catch (_) { /* ignore */ } finally {
    setTimeout(() => { if (authEls.resend) authEls.resend.disabled = false; }, 15000); // throttle re-sends
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

function showAuthScreen() {
  hideLanding();
  els.appShell.hidden = true;
  authEls.screen.hidden = false;
  renderAuthCopy();
  applyGoogleVisibility();          // show Google button only when configured
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
  // Warm the SDK in the background so the first click feels instant.
  if (on) loadFirebase().catch(() => {});
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

async function handleGoogleSignIn() {
  if (!hasFirebaseConfig() || authEls.google.disabled) return;
  hideAuthError();
  authEls.google.disabled = true;
  authEls.google.classList.add("is-loading");
  try {
    const m = await loadFirebase();
    const auth = await ensureFirebaseAuth();
    const result = await m.signInWithPopup(auth, new m.GoogleAuthProvider());
    const idToken = await result.user.getIdToken();
    const data = await apiJson("/api/auth/firebase", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    const user = (data && data.user) || data || {};
    await bootApp(user);
  } catch (err) {
    // Server-side failures (401 invalid, 501 not configured) carry an HTTP status.
    if (err && typeof err.status === "number") {
      showAuthError((err.data && (err.data.message || err.data.error)) || t().authGoogleError);
    } else {
      // Otherwise it's a Firebase/popup error — possibly a quiet cancellation.
      const msg = googleErrorMessage(err);
      if (msg) showAuthError(msg);
    }
  } finally {
    authEls.google.disabled = false;
    authEls.google.classList.remove("is-loading");
  }
}

function wireAuth() {
  cacheAuthEls();
  authEls.form.addEventListener("submit", handleAuthSubmit);
  authEls.switchBtn.addEventListener("click", () => setAuthMode(authMode === "signup" ? "login" : "signup"));
  if (authEls.google) authEls.google.addEventListener("click", handleGoogleSignIn);
  if (authEls.forgot) authEls.forgot.addEventListener("click", handleForgotPassword);
  if (authEls.resend) authEls.resend.addEventListener("click", handleResendCode);
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

  // Theme
  els.themeToggle.addEventListener("click", () => applyTheme(state.theme === "light" ? "dark" : "light"));

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
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
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
  els.scrollBottomBtn.addEventListener("click", () => { autoScroll = true; scrollToBottom(); });

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

async function init() {
  loadState();
  cacheEls();
  startVersionWatch();
  setupAuthChannel();
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
