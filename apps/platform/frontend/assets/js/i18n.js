// i18n.js — English/Swahili translation system for Casuya Platform.
// Uses data-i18n attributes on HTML elements. Toggle stores preference in localStorage.

(function () {
  "use strict";

  var STORAGE_KEY = "casuya_lang";

  // ── Swahili translations ──────────────────────────────────────────────
  // Real Swahili used in Tanzanian educational context.
  var SW = {
    // Navigation
    "nav.features": "Vipengele",
    "nav.subjects": "Masomo",
    "nav.about": "Kuhusu",
    "nav.login": "Ingia",
    "nav.get_started": "Anza Sasa",
    "nav.start": "Anza",
    "nav.create_account": "Fungua Akaunti",
    "nav.users": "Watumiaji",

    // Hero
    "hero.badge": "Elimu Ilivyobadilishwa",
    "hero.title1": "Jifunze kwa Akili.",
    "hero.title2": "Fundisha Bora.",
    "hero.title3": "Jenga Mustakabali.",
    "hero.desc": "Mfumo wa elimu wenye akili unaounganisha walimu, wanafunzi, na shule kwa zana za kidijitali za kisasa zilizojengwa kwa miundombinu yoyote.",
    "hero.start": "Anza Kujifunza",
    "hero.demo": "Angalia Onyesho",

    // Hero mock UI
    "hero.today_lesson": "Masomo ya Leo",
    "hero.dive_into": "\"Zama katika mazoezi ya kushirikiana yenye maswali na ufuatiliaji wa maendeleo kwa wakati halisi.\"",
    "hero.class_sync": "Usawazishaji wa Darasa",
    "hero.offline_ready": "Tayari Kwa Mtandao 100%",
    "hero.avg_score": "Wastani wa Alama",
    "hero.progress": "+18% Maendeleo",

    // Trusted
    "trusted.title": "Kuwezesha Mifumo ya Elimu ya Kisasa",

    // Features
    "features.badge": "Uwezo wa Jukwaa",
    "features.title": "Kwa Nini Shule Zinachagua Casuya",
    "features.desc": "Kila moduli imeboreshwa kwa kasi ya umeme na utendaji wa kuaminika kwa vifaa vya chini.",

    // Subjects
    "subjects.badge": "Muundo wa Mtaala",
    "subjects.title": "Chunguza Masomo Kote Kwenye Mfumo",
    "subjects.physics": "Fizikia",
    "subjects.chemistry": "Kemikali",
    "subjects.biology": "Biolojia",
    "subjects.math": "Hisabati",

    // Audiences
    "audiences.badge": "Uzoefu Maalum",
    "audiences.title": "Imejengwa kwa Kila Mtu Shuleni",
    "audiences.desc": "Akaunti za usajili zinapatikana kama Mwanafunzi au Mwalimu. Wazazi na shule wanafaidika kupitia uzoefu wa mwanafunzi na mwalimu.",

    // Audience cards
    "audiences.teachers": "Walimu",
    "audiences.teachers.f1": "Unda maudhui tajiri ya kidijitali",
    "audiences.teachers.f2": "Simamia vikundi vya masomo",
    "audiences.teachers.f3": "Tathmini miongozo ya data",
    "audiences.students": "Wanafunzi",
    "audiences.students.f1": "Soma popote pale",
    "audiences.students.f2": "Fanya mitihani nje ya mtandao",
    "audiences.students.f3": "Fuatilia rekodi za kujifunza",
    "audiences.parents": "Wazazi",
    "audiences.parents.f1": "Angalia viashiria vya maendeleo",
    "audiences.parents.f2": "Tazama sasisha za eneo",
    "audiences.schools": "Shule",
    "audiences.schools.f1": "Boresha ugavi wa kazi kwa wafanyakazi",
    "audiences.schools.f2": "Hamisha data ngumu za uchambuzi",

    // CTA
    "cta.title": "Tayari Kubadilisha Elimu?",
    "cta.desc": "Junge na maelfu ya walimu, wanafunzi, na wasimamizi wa mfumo wanaosanidi mitandao ya shule ya akili leo.",

    // Demo modal
    "demo.step1": "Hatua ya 1 — Ingia",
    "demo.step2": "Hatua ya 2 — Umesahau Nenosiri",
    "demo.step3": "Hatua ya 3 — Jisajili",
    "demo.step4": "Hatua ya 4 — Dashibodi",
    "demo.welcome_back": "Karibu Tena",
    "demo.sign_in_continue": "Ingia ili kuendelea na safari yako ya kujifunza",
    "demo.email": "Barua Pepe",
    "demo.password": "Nenosiri",
    "demo.forgot_password": "Umesahau nenosiri?",
    "demo.remember_me": "Nikumbuke",
    "demo.sign_in": "Ingia",
    "demo.no_account": "Huna akaunti?",
    "demo.sign_up_free": "Jisajili bure",
    "demo.forgot_title": "Umesahau Nenosiri?",
    "demo.forgot_desc": "Weka barua pepe yako na tutakutumia kiungo cha kurejesha.",
    "demo.send_reset": "Tuma Kiungo cha Kurejesha",
    "demo.link_sent": "Kiungo Kimetumwa!",
    "demo.check_email": "Angalia barua pepe yako kwa kiungo.",
    "demo.remember_password": "Unakumbuka nenosiri lako?",
    "demo.create_account_title": "Fungua akaunti yako",
    "demo.join_desc": "Jiunge na Casuya na uanze kujifunza leo.",
    "demo.full_name": "Jina Kamili",
    "demo.role": "Jukumu",
    "demo.student": "Mwanafunzi",
    "demo.phone": "Simu",
    "demo.confirm_password": "Thibitisha Nenosiri",
    "demo.create_btn": "Fungua Akaunti",
    "demo.already_account": "Tayari una akaunti?",
    "demo.sign_in_link": "Ingia",
    "demo.welcome": "Karibu tena",
    "demo.ready_continue": "Tayari kuendelea na safari yako ya kujifunza?",
    "demo.lessons": "Masomo",
    "demo.avg_score": "Wastani wa Alama",
    "demo.streak": "Mfuatano",
    "demo.my_subjects": "Masomo Yangu",

    // Footer
    "footer.platform": "Jukwaa",
    "footer.features": "Vipengele",
    "footer.docs": "Nyaraka",
    "footer.subjects": "Masomo",
    "footer.support": "Msaada",
    "footer.help": "Kituo cha Msaada",
    "footer.contact": "Wasiliana Nasi",
    "footer.whatsapp": "WhatsApp",
    "footer.legal": "Kisheria",
    "footer.privacy": "Sera ya Faragha",
    "footer.terms": "Masharti ya Huduma",
    "footer.links": "Viungo",
    "footer.github": "Shirika la GitHub",
    "footer.copyright": "© 2026 Jukwaa la Casuya. Haki zote zimehifadhiwa.",
    "footer.built": "Imeundwa kwa utunzaji kwa shule za Tanzania",
    "footer.chat": "Ongea nasi kupitia WhatsApp",

    // Login
    "login.title": "Karibu Tena",
    "login.desc": "Ingia ili kuendelea na safari yako ya kujifunza",
    "login.email_label": "Barua Pepe",
    "login.email_placeholder": "Weka barua pepe yako",
    "login.password_label": "Nenosiri",
    "login.password_placeholder": "Weka nenosiri lako",
    "login.show_password": "Onyesha nenosiri",
    "login.hide_password": "Ficha nenosiri",
    "login.forgot": "Umesahau nenosiri?",
    "login.remember": "Nikumbuke barua pepe yangu",
    "login.remember_desc": "Nibaki nimeingia kwa siku 30",
    "login.or": "AU",
    "login.google": "Ingia na Google",
    "login.facebook": "Ingia na Facebook",
    "login.submit": "Ingia kwenye akaunti yako ya Casuya",
    "login.no_account": "Huna akaunti?",
    "login.signup_free": "Jisajili bure",
    "login.signing_in": "Inaingia...",
    "login.success": "Umeingia kwa mafanikio. Inaelekeza...",

    // Register
    "register.title": "Fungua akaunti yako",
    "register.desc": "Jiunge na Casuya na endelea na lango lako la mwanafunzi au mwalimu.",
    "register.fullname_label": "Jina Kamili",
    "register.fullname_placeholder": "Weka jina lako kamili",
    "register.email_label": "Barua Pepe",
    "register.email_placeholder": "mfano@barua pepe.com",
    "register.phone_label": "Nambari ya Simu",
    "register.phone_placeholder": "+255...",
    "register.account_type": "Aina ya Akaunti",
    "register.student": "Mwanafunzi",
    "register.teacher": "Mwalimu",
    "register.special_needs": "Mahitaji Maalum / Msomaji Mwengine",
    "register.account_type_desc": "Chagua aina ya akaunti inayoelezea vyema.",
    "register.accessibility": "Mapendeleo ya Upatikanaji",
    "register.accessibility_desc": "Chagua kitakachokusaidia kujifunza vizuri. Unaweza kubadilisha hii wakati wowote kwenye Mipangilio.",
    "register.reading_support": "Msaada wa Kusoma",
    "register.dyslexia_font": "Fonti rafiki kwa wasomaji",
    "register.larger_text": "Ukubwa mkubwa wa maandishi",
    "register.listening_support": "Msaada wa Kusikiliza",
    "register.tts_enabled": "Uwezeshaji wa maandishi kuwa sauti",
    "register.visual_support": "Msaada wa Kuona",
    "register.high_contrast": "Hali ya tofauti kubwa",
    "register.password_label": "Nenosiri",
    "register.password_placeholder": "Herufi 8 au zaidi",
    "register.strength": "Nguvu ya nenosiri",
    "register.req_8char": "Herufi 8+",
    "register.req_upper": "Herufi kubwa",
    "register.req_lower": "Herufi ndogo",
    "register.req_number": "Nambari",
    "register.req_special": "Herufi maalum",
    "register.confirm_label": "Thibitisha Nenosiri",
    "register.confirm_placeholder": "Weka nenosiri lako tena",
    "register.terms_prefix": "Ninakubali",
    "register.terms_link": "Masharti ya Huduma",
    "register.privacy_link": "Sera ya Faragha",
    "register.terms_summary": "Soma kwa lugha rahisi",
    "register.what_collect": "Tunachokusanya:",
    "register.collect_desc": "Jina lako, barua pepe, simu (hiari), na maendeleo ya kujifunza.",
    "register.how_use": "Tunavyotumia:",
    "register.use_desc": "Kufuatilia masomo yako, maswali, na kutoa kujifunza kwa kibinafsi.",
    "register.your_data": "Data yako:",
    "register.data_desc": "Unaweza kuomba tufute akaunti yako na data yako wakati wowote.",
    "register.payments": "Malipo:",
    "register.payments_desc": "Hatuwezi kuhifadhi kadi yako. Malipo yanashughulikiwa na watoa huduma wa kuaminika.",
    "register.safety": "Usalama:",
    "register.safety_desc": "Tunafuata sheria za ulinzi wa data za Tanzania na kuhifadhi data yako salama.",
    "register.submit": "Fungua akaunti yako ya Casuya",
    "register.has_account": "Tayari una akaunti?",
    "register.signin_link": "Ingia kwenye akaunti yako",
    "register.creating": "Inaunda akaunti...",
    "register.success": "Akaunti imeundwa kwa mafanikio. Inaelekeza...",

    // Forgot password
    "forgot.title": "Umesahau Nenosiri?",
    "forgot.desc": "Weka barua pepe au nambari ya simu na tutakusaidia kurejesha nenosiri lako.",
    "forgot.tab_email": "Barua Pepe",
    "forgot.tab_phone": "Nambari ya Simu",
    "forgot.email_label": "Barua Pepe",
    "forgot.email_placeholder": "mfano@barua pepe.com",
    "forgot.phone_label": "Nambari ya Simu",
    "forgot.phone_placeholder": "+255 7XX XXX XXX",
    "forgot.submit_email": "Nitumie kiungo cha kurejesha nenosiri",
    "forgot.submit_phone": "Tuma nambari ya kurejesha kupitia SMS",
    "forgot.link_sent": "Kiungo Kimetumwa!",
    "forgot.check_email": "Angalia barua pepe yako kwa kiungo. Inaweza kuchukua dakika chache kufika.",
    "forgot.next_steps": "Nini cha kufanya baadae:",
    "forgot.step1": "Fungua kisanduku chako cha barua pepe",
    "forgot.step2": "Pata barua pepe kutoka Jukwaa la Casuya",
    "forgot.step3": "Bofya kiungo la \"Kurejesha Nenosiri\" kwenye barua pepe",
    "forgot.step4": "Fungua nenosiri lako jipya",
    "forgot.spam": "Hujapokea? Angalia folda yako ya au jaribu tena.",
    "forgot.return": "Rudi kwenye Uingizaji",
    "forgot.remember": "Unakumbuka nenosiri lako?",
    "forgot.signin": "Ingia kwenye akaunti yako",

    // Accessibility
    "a11y.title": "Mipangilio ya Upatikanaji",
    "a11y.dyslexia": "Fonti ya Wasomaji",
    "a11y.contrast": "Tofauti Kubwa",
    "a11y.large_text": "Maandishi Makubwa",
    "a11y.wide_spacing": "Nafasi Pana",
    "a11y.size": "Ukubwa",
    "a11y.tts": "Maandishi kuwa Sauti",
    "a11y.ready": "Tayari",
    "a11y.speaking": "Inasema...",
    "a11y.done": "Imekamilika",
    "a11y.error": "Hitilafu",
    "a11y.paused": "Imesimamishwa",
    "a11y.stopped": "Imesimama",

    // Password strength
    "strength.weak": "Dhaifu",
    "strength.fair": "Wastani",
    "strength.good": "Nzuri",
    "strength.strong": "Imara",
    "strength.very_strong": "Imara Sana",

    // Validation errors
    "error.fullname_required": "Jina kamili linahitajika.",
    "error.email_required": "Barua pepe inahitajika.",
    "error.email_invalid": "Tafadhali weka barua pepe sahihi.",
    "error.phone_invalid": "Tafadhali weka nambari ya simu sahihi.",
    "error.password_required": "Nenosiri linahitajika.",
    "error.password_min8": "Nenosiri lazima liwe na herufi 8 au zaidi.",
    "error.password_strong": "Tafadhali chagua nenosiri dhabihu.",
    "error.password_mismatch": "Nenosiri hazifanani.",
    "error.terms_required": "Lazima ukubali Masharti ya Huduma na Sera ya Faragha.",
    "error.server": "Haiwezi kufikia seva. Tafadhali jaribu tena baadaye.",
    "error.phone_required": "Nambari ya simu inahitajika.",
    "error.phone_format": "Tafadhali weka nambari ya simu sahihi (herufi 10-15).",
    "error.something_wrong": "Kuna kitu kimeenda vibaya.",

    // Misc
    "skip.main_content": "Ruka hadi maandishi makuu",
    "skip.login_form": "Ruka hadi fomu ya kuingia",
    "skip.register_form": "Ruka hadi fomu ya usajili",
    "skip.forgot_form": "Ruka hadi fomu ya kusahau nenosiri",
  };

  // ── Init ──────────────────────────────────────────────────────────────

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || "en";
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === "sw" ? "sw" : "en";
    applyTranslations(lang);
    updateToggleButtons(lang);
  }

  function t(key) {
    var lang = getLang();
    if (lang === "sw" && SW[key]) return SW[key];
    // Fallback: return the element's original English text (stored as data-i18n-en)
    return null;
  }

  // ── Apply translations ────────────────────────────────────────────────

  function applyTranslations(lang) {
    var els = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute("data-i18n");

      // Store original English text on first run
      if (!el.getAttribute("data-i18n-en")) {
        el.setAttribute("data-i18n-en", el.textContent);
      }

      if (lang === "sw" && SW[key]) {
        el.textContent = SW[key];
      } else {
        // Restore English
        var en = el.getAttribute("data-i18n-en");
        if (en) el.textContent = en;
      }
    }

    // Placeholders
    var phEls = document.querySelectorAll("[data-i18n-ph]");
    for (var j = 0; j < phEls.length; j++) {
      var phEl = phEls[j];
      var phKey = phEl.getAttribute("data-i18n-ph");
      if (!phEl.getAttribute("data-i18n-ph-en")) {
        phEl.setAttribute("data-i18n-ph-en", phEl.placeholder || "");
      }
      if (lang === "sw" && SW[phKey]) {
        phEl.placeholder = SW[phKey];
      } else {
        var phEn = phEl.getAttribute("data-i18n-ph-en");
        if (phEn !== null) phEl.placeholder = phEn;
      }
    }

    // aria-labels
    var ariaEls = document.querySelectorAll("[data-i18n-aria]");
    for (var k = 0; k < ariaEls.length; k++) {
      var ariaEl = ariaEls[k];
      var ariaKey = ariaEl.getAttribute("data-i18n-aria");
      if (!ariaEl.getAttribute("data-i18n-aria-en")) {
        ariaEl.setAttribute("data-i18n-aria-en", ariaEl.getAttribute("aria-label") || "");
      }
      if (lang === "sw" && SW[ariaKey]) {
        ariaEl.setAttribute("aria-label", SW[ariaKey]);
      } else {
        var ariaEn = ariaEl.getAttribute("data-i18n-aria-en");
        if (ariaEn) ariaEl.setAttribute("aria-label", ariaEn);
      }
    }
  }

  // ── Toggle buttons ────────────────────────────────────────────────────

  function updateToggleButtons(lang) {
    var btns = document.querySelectorAll("[data-lang-toggle]");
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      if (lang === "sw") {
        btn.textContent = "EN";
        btn.title = "Switch to English";
        btn.setAttribute("aria-label", "Switch to English");
      } else {
        btn.textContent = "SW";
        btn.title="Badilisha Kiswahili";
        btn.setAttribute("aria-label", "Badilisha Kiswahili");
      }
    }
  }

  function toggleLang() {
    var current = getLang();
    setLang(current === "en" ? "sw" : "en");
  }

  // ── Expose globals ────────────────────────────────────────────────────
  window.CasuyaI18n = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    toggle: toggleLang,
  };

  // ── Init ──────────────────────────────────────────────────────────────

  function init() {
    var lang = getLang();
    document.documentElement.lang = lang === "sw" ? "sw" : "en";
    applyTranslations(lang);
    updateToggleButtons(lang);

    // Bind all toggle buttons
    var btns = document.querySelectorAll("[data-lang-toggle]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", toggleLang);
    }
  }

  // Run immediately if DOM is already ready (script loaded late), otherwise wait.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
