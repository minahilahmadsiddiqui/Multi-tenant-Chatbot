export function buildWidgetJs(chatUrl: string, configUrl: string): string {
  return `
(function () {
  if (window.__acmeWidgetLoaded) return;
  window.__acmeWidgetLoaded = true;

  var cfg = window.AcmeChatbotConfig || {};
  var botKey = cfg.botKey || cfg.widgetKey || cfg.key;
  if (!botKey) {
    console.error("Acme widget: missing botKey in window.AcmeChatbotConfig");
    return;
  }

  var CHAT_URL = "${chatUrl}";
  var CONFIG_URL = "${configUrl}";
  var STORAGE_KEY = "acme_widget_history_" + botKey;
  var SESSION_KEY = "acme_widget_session_" + botKey;
  var WELCOME_KEY = "acme_widget_welcome_" + botKey;
  var dynamicWelcome = localStorage.getItem(WELCOME_KEY) || "Hello! How can I help you today?";

  var ICONS = {
    message: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18 6 6 18M6 6l12 12"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m22 2-7 20-4-9-9-4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 2 11 13"/></svg>',
    bot: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>',
    user: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M20 3v4M22 5h-4M4 17v2M5 18H3"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m15 18-6-6 6-6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5"/></svg>'
  };

  function getSessionId() {
    var sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = "ws_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  }

  function getHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows : [];
    } catch (_e) {
      return [];
    }
  }

  function setHistory(rows) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows || []));
    } catch (_e) {}
  }

  var panelOpen = false;
  var theme = {
    navyDeep: "hsl(226,55%,10%)",
    navy: "hsl(226,45%,20%)",
    navyLight: "hsl(226,35%,30%)",
    mint: "hsl(160,62%,55%)",
    mintLight: "hsl(160,55%,92%)"
  };
  if (cfg.theme && typeof cfg.theme === "object") {
    theme = Object.assign(theme, {
      navyDeep: cfg.theme.navyDeep || cfg.theme.navy_deep || theme.navyDeep,
      navy: cfg.theme.navy || theme.navy,
      navyLight: cfg.theme.navyLight || cfg.theme.navy_light || theme.navyLight,
      mint: cfg.theme.mint || theme.mint,
      mintLight: cfg.theme.mintLight || cfg.theme.mint_light || theme.mintLight
    });
  }

  if (!document.getElementById("acme-widget-fonts")) {
    var fontLink = document.createElement("link");
    fontLink.id = "acme-widget-fonts";
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap";
    document.head.appendChild(fontLink);
  }

  if (!document.getElementById("acme-widget-styles")) {
    var styleEl = document.createElement("style");
    styleEl.id = "acme-widget-styles";
    styleEl.textContent = [
      ".acme-w-root{--acme-navy-deep:hsl(226,55%,10%);--acme-navy:hsl(226,45%,20%);--acme-navy-light:hsl(226,35%,30%);--acme-mint:hsl(160,62%,55%);--acme-mint-light:hsl(160,55%,92%);--acme-bg:hsl(220,20%,97%);--acme-card:#fff;--acme-border:hsl(220,13%,91%);--acme-text:hsl(222,47%,11%);--acme-muted:hsl(220,9%,46%);position:fixed;right:24px;bottom:24px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:12px;font-family:Inter,system-ui,-apple-system,sans-serif;color:var(--acme-text);-webkit-font-smoothing:antialiased}",
      ".acme-w-fab{width:56px;height:56px;border-radius:9999px;border:none;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--acme-navy-deep),var(--acme-navy));box-shadow:0 4px 24px hsl(226 45% 20% / 0.35),0 2px 8px hsl(0 0% 0% / 0.12);transition:transform .2s ease,box-shadow .2s ease}",
      ".acme-w-fab:hover{transform:scale(1.06);box-shadow:0 6px 28px hsl(226 45% 20% / 0.4),0 0 20px hsl(160 62% 55% / 0.12)}",
      ".acme-w-panel{display:none;width:min(400px,calc(100vw - 24px));height:min(600px,calc(100vh - 100px));border-radius:16px;overflow:hidden;background:var(--acme-card);border:1px solid var(--acme-border);box-shadow:0 24px 48px hsl(226 45% 20% / 0.22),0 8px 16px hsl(226 45% 20% / 0.1);opacity:0;transform:translateY(8px) scale(.985);transition:opacity .18s ease,transform .18s ease}",
      ".acme-w-panel.is-open{display:block;opacity:1;transform:translateY(0) scale(1)}",
      ".acme-w-intro{display:flex;flex-direction:column;height:100%}",
      ".acme-w-intro-hero{position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;padding:28px 24px 24px;background:linear-gradient(135deg,var(--acme-navy-deep) 0%,var(--acme-navy) 45%,hsl(220,40%,25%) 100%);color:#fff;overflow:hidden}",
      ".acme-w-intro-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 15% 20%,hsl(160 62% 55% / 0.18),transparent 35%),radial-gradient(circle at 85% 15%,hsl(226 55% 10% / 0.32),transparent 42%);pointer-events:none}",
      ".acme-w-intro-close{position:absolute;top:14px;right:14px;width:32px;height:32px;border:none;border-radius:8px;background:hsl(0 0% 100% / 0.08);color:hsl(0 0% 100% / 0.65);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,color .15s}",
      ".acme-w-intro-close:hover{background:hsl(0 0% 100% / 0.14);color:#fff}",
      ".acme-w-intro-avatar{width:48px;height:48px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:hsl(160 62% 55% / 0.2);border:2px solid hsl(0 0% 100% / 0.2);color:var(--acme-mint);margin-bottom:20px;position:relative;z-index:1}",
      ".acme-w-intro-title{font-family:'Space Grotesk',Inter,sans-serif;font-size:28px;line-height:1.15;font-weight:700;position:relative;z-index:1}",
      ".acme-w-intro-subtitle{font-family:'Space Grotesk',Inter,sans-serif;font-size:28px;line-height:1.15;font-weight:700;color:hsl(0 0% 100% / 0.9);margin-top:2px;position:relative;z-index:1}",
      ".acme-w-wave{display:inline-block;animation:acmeWave 2s ease-in-out infinite;transform-origin:70% 70%}",
      ".acme-w-intro-footer{padding:16px;background:var(--acme-bg)}",
      ".acme-w-cta{width:100%;border:1px solid var(--acme-border);border-radius:12px;padding:16px;background:var(--acme-card);display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;text-align:left;box-shadow:0 1px 3px hsl(226 45% 20% / 0.04),0 4px 16px hsl(226 45% 20% / 0.03);transition:border-color .2s,box-shadow .2s,transform .2s}",
      ".acme-w-cta:hover{border-color:hsl(160 62% 55% / 0.3);box-shadow:0 8px 30px hsl(226 45% 20% / 0.08);transform:translateY(-1px)}",
      ".acme-w-cta-title{font-size:14px;font-weight:600;color:var(--acme-text)}",
      ".acme-w-cta-hint{margin-top:4px;font-size:13px;color:var(--acme-muted)}",
      ".acme-w-cta-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;background:linear-gradient(135deg,var(--acme-navy),var(--acme-navy-light));box-shadow:0 1px 3px hsl(226 45% 20% / 0.1)}",
      ".acme-w-chat{display:none;flex-direction:column;height:100%}",
      ".acme-w-header{position:relative;padding:12px 14px;border-bottom:1px solid var(--acme-border);overflow:hidden}",
      ".acme-w-header-bg{position:absolute;inset:0;background:linear-gradient(90deg,var(--acme-navy-deep),var(--acme-navy),var(--acme-navy-light));background-size:200% 200%;animation:acmeGradient 8s ease infinite}",
      ".acme-w-header-inner{position:relative;display:flex;align-items:center;gap:10px}",
      ".acme-w-icon-btn{width:32px;height:32px;border-radius:8px;border:1px solid hsl(0 0% 100% / 0.12);background:hsl(0 0% 100% / 0.1);color:hsl(0 0% 100% / 0.85);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s}",
      ".acme-w-icon-btn:hover{background:hsl(0 0% 100% / 0.16)}",
      ".acme-w-header-badge{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:hsl(160 62% 55% / 0.2);border:1px solid hsl(160 62% 55% / 0.2);color:var(--acme-mint);flex-shrink:0}",
      ".acme-w-header-text{min-width:0;flex:1}",
      ".acme-w-header-title{font-family:'Space Grotesk',Inter,sans-serif;font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".acme-w-header-status{display:flex;align-items:center;gap:6px;margin-top:2px}",
      ".acme-w-status-dot{width:6px;height:6px;border-radius:9999px;background:var(--acme-mint);animation:acmePulse 2s ease-in-out infinite}",
      ".acme-w-header-sub{font-size:11px;color:hsl(0 0% 100% / 0.65)}",
      ".acme-w-header-actions{margin-left:auto;display:flex;gap:6px}",
      ".acme-w-messages{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:14px;background:var(--acme-bg);scroll-behavior:smooth}",
      ".acme-w-messages::-webkit-scrollbar{width:5px}",
      ".acme-w-messages::-webkit-scrollbar-thumb{background:hsl(220 9% 46% / 0.2);border-radius:10px}",
      ".acme-w-row{display:flex;gap:10px;align-items:flex-start;animation:acmeMessageIn .35s cubic-bezier(.22,1,.36,1)}",
      ".acme-w-row.is-user{flex-direction:row-reverse}",
      ".acme-w-avatar{width:32px;height:32px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 3px hsl(226 45% 20% / 0.08)}",
      ".acme-w-avatar.is-assistant{color:#fff;background:linear-gradient(135deg,var(--acme-navy),var(--acme-navy-light))}",
      ".acme-w-avatar.is-user{color:#fff;background:linear-gradient(135deg,var(--acme-mint),hsl(160,70%,45%))}",
      ".acme-w-bubble-wrap{max-width:78%;position:relative}",
      ".acme-w-bubble{padding:12px 14px;border-radius:16px;font-size:13px;line-height:1.55;white-space:pre-wrap;box-shadow:0 1px 3px hsl(226 45% 20% / 0.06)}",
      ".acme-w-bubble.is-assistant{background:hsl(220 14% 94% / 0.9);color:var(--acme-text);border:1px solid var(--acme-border);border-top-left-radius:6px}",
      ".acme-w-bubble.is-user{background:linear-gradient(135deg,var(--acme-navy),var(--acme-navy-light));color:#fff;border-top-right-radius:6px}",
      ".acme-w-time{font-size:10px;margin-top:6px;opacity:.55}",
      ".acme-w-copy{position:absolute;bottom:-10px;right:2px;width:22px;height:22px;border:1px solid var(--acme-border);border-radius:6px;background:var(--acme-card);color:var(--acme-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .15s,background .15s}",
      ".acme-w-row:hover .acme-w-copy{opacity:1}",
      ".acme-w-copy:hover{background:hsl(220 14% 92%)}",
      ".acme-w-welcome{margin:0 auto;width:100%;max-width:100%;padding:16px;border-radius:16px;border:1px solid var(--acme-border);background:hsl(220 14% 94% / 0.5);font-size:13px;line-height:1.55;color:var(--acme-text)}",
      ".acme-w-typing{display:flex;gap:10px;align-items:flex-start}",
      ".acme-w-typing-bubble{display:flex;align-items:center;gap:6px;padding:12px 16px;border-radius:16px;border-top-left-radius:6px;background:hsl(220 14% 94% / 0.9);border:1px solid var(--acme-border)}",
      ".acme-w-dot{width:8px;height:8px;border-radius:9999px;background:var(--acme-mint);animation:acmeTypingDot 1.4s infinite ease-in-out}",
      ".acme-w-dot:nth-child(2){animation-delay:.2s}",
      ".acme-w-dot:nth-child(3){animation-delay:.4s}",
      ".acme-w-composer{padding:12px 14px;border-top:1px solid var(--acme-border);background:hsl(0 0% 100% / 0.92);backdrop-filter:blur(8px)}",
      ".acme-w-input-wrap{display:flex;align-items:center;gap:8px;border:1px solid var(--acme-border);border-radius:12px;background:hsl(220 20% 97% / 0.8);padding:6px 8px 6px 12px;transition:border-color .2s,box-shadow .2s}",
      ".acme-w-input-wrap:focus-within{border-color:hsl(160 62% 55% / 0.4);box-shadow:0 0 0 2px hsl(160 62% 55% / 0.2)}",
      ".acme-w-input{flex:1;border:none;background:transparent;outline:none;font-size:14px;color:var(--acme-text);padding:6px 0;font-family:inherit}",
      ".acme-w-input::placeholder{color:hsl(220 9% 46% / 0.65)}",
      ".acme-w-send{width:36px;height:36px;border:none;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--acme-navy),var(--acme-navy-light));box-shadow:0 1px 3px hsl(226 45% 20% / 0.12);transition:opacity .2s,transform .15s,box-shadow .2s}",
      ".acme-w-send:hover:not(:disabled){transform:scale(1.04);box-shadow:0 0 20px hsl(226 45% 20% / 0.2)}",
      ".acme-w-send:disabled{opacity:.35;cursor:not-allowed}",
      "@keyframes acmeWave{0%,100%{transform:rotate(0)}20%{transform:rotate(14deg)}40%{transform:rotate(-8deg)}60%{transform:rotate(14deg)}80%{transform:rotate(-4deg)}}",
      "@keyframes acmeGradient{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}",
      "@keyframes acmePulse{0%,100%{opacity:1}50%{opacity:.45}}",
      "@keyframes acmeMessageIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}",
      "@keyframes acmeTypingDot{0%,80%,100%{transform:scale(.6);opacity:.3}40%{transform:scale(1);opacity:1}}",
      "@media (max-width:640px){.acme-w-root{right:12px;bottom:12px}.acme-w-panel{width:calc(100vw - 24px);height:min(76vh,560px);max-height:calc(100vh - 90px)}.acme-w-fab{width:52px;height:52px}.acme-w-intro-title,.acme-w-intro-subtitle{font-size:24px}}"
    ].join("");
    document.head.appendChild(styleEl);
  }

  var root = document.createElement("div");
  root.className = "acme-w-root";

  var panel = document.createElement("div");
  panel.className = "acme-w-panel";

  var toggleBtn = document.createElement("button");
  toggleBtn.className = "acme-w-fab";
  toggleBtn.setAttribute("aria-label", "Open chat");
  toggleBtn.innerHTML = ICONS.message;

  var introScreen = document.createElement("div");
  introScreen.className = "acme-w-intro";

  var introHero = document.createElement("div");
  introHero.className = "acme-w-intro-hero";

  var introCloseBtn = document.createElement("button");
  introCloseBtn.type = "button";
  introCloseBtn.className = "acme-w-intro-close";
  introCloseBtn.setAttribute("aria-label", "Close");
  introCloseBtn.innerHTML = ICONS.close;

  var introAvatar = document.createElement("div");
  introAvatar.className = "acme-w-intro-avatar";
  introAvatar.innerHTML = ICONS.sparkles;

  var introTitle = document.createElement("div");
  introTitle.className = "acme-w-intro-title";
  introTitle.innerHTML = 'Hi there <span class="acme-w-wave">\\uD83D\\uDC4B</span>';

  var introSubtitle = document.createElement("div");
  introSubtitle.className = "acme-w-intro-subtitle";
  introSubtitle.textContent = "How can I help you?";

  var introFooter = document.createElement("div");
  introFooter.className = "acme-w-intro-footer";

  var introCta = document.createElement("button");
  introCta.type = "button";
  introCta.className = "acme-w-cta";

  var introCtaText = document.createElement("div");
  var introCtaHeading = document.createElement("div");
  introCtaHeading.className = "acme-w-cta-title";
  introCtaHeading.textContent = "Send us a message";
  var introCtaHint = document.createElement("div");
  introCtaHint.className = "acme-w-cta-hint";
  introCtaHint.textContent = "I'm here for your assistance";
  var introCtaIcon = document.createElement("div");
  introCtaIcon.className = "acme-w-cta-icon";
  introCtaIcon.innerHTML = ICONS.send;

  var chatShell = document.createElement("div");
  chatShell.className = "acme-w-chat";

  var header = document.createElement("div");
  header.className = "acme-w-header";
  var headerBg = document.createElement("div");
  headerBg.className = "acme-w-header-bg";
  var headerInner = document.createElement("div");
  headerInner.className = "acme-w-header-inner";

  var backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "acme-w-icon-btn";
  backBtn.setAttribute("aria-label", "Back");
  backBtn.innerHTML = ICONS.back;

  var headerBadge = document.createElement("div");
  headerBadge.className = "acme-w-header-badge";
  headerBadge.innerHTML = ICONS.sparkles;

  var headerText = document.createElement("div");
  headerText.className = "acme-w-header-text";
  var title = document.createElement("div");
  title.className = "acme-w-header-title";
  title.textContent = cfg.title || "ACME Assistant";
  var headerStatus = document.createElement("div");
  headerStatus.className = "acme-w-header-status";
  var statusDot = document.createElement("span");
  statusDot.className = "acme-w-status-dot";
  var headerSub = document.createElement("span");
  headerSub.className = "acme-w-header-sub";
  headerSub.textContent = "Online · answers from your knowledge base";

  var headerActions = document.createElement("div");
  headerActions.className = "acme-w-header-actions";
  var clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "acme-w-icon-btn";
  clearBtn.setAttribute("aria-label", "Clear chat");
  clearBtn.title = "Clear chat";
  clearBtn.innerHTML = ICONS.trash;

  var body = document.createElement("div");
  body.className = "acme-w-messages";

  var composer = document.createElement("div");
  composer.className = "acme-w-composer";
  var inputWrap = document.createElement("div");
  inputWrap.className = "acme-w-input-wrap";
  var input = document.createElement("input");
  input.type = "text";
  input.className = "acme-w-input";
  input.placeholder = "Ask anything about your documents...";
  var sendBtn = document.createElement("button");
  sendBtn.type = "button";
  sendBtn.className = "acme-w-send";
  sendBtn.setAttribute("aria-label", "Send message");
  sendBtn.innerHTML = ICONS.send;

  function applyThemeStyles() {
    root.style.setProperty("--acme-navy-deep", theme.navyDeep);
    root.style.setProperty("--acme-navy", theme.navy);
    root.style.setProperty("--acme-navy-light", theme.navyLight);
    root.style.setProperty("--acme-mint", theme.mint);
    root.style.setProperty("--acme-mint-light", theme.mintLight);
  }

  function applyResponsiveLayout() {
    var isMobile = window.innerWidth <= 640;
    root.style.right = isMobile ? "12px" : "24px";
    root.style.bottom = isMobile ? "12px" : "24px";
  }

  function setFabIcon(open) {
    toggleBtn.innerHTML = open ? ICONS.close : ICONS.message;
    toggleBtn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
  }

  function openIntro() {
    introScreen.style.display = "flex";
    chatShell.style.display = "none";
  }

  function openChat() {
    introScreen.style.display = "none";
    chatShell.style.display = "flex";
    renderHistory();
    setTimeout(function () { input.focus(); }, 60);
  }

  function closePanel() {
    panelOpen = false;
    panel.classList.remove("is-open");
    setTimeout(function () {
      if (!panelOpen) panel.style.display = "none";
    }, 180);
    setFabIcon(false);
  }

  function openPanel() {
    panelOpen = true;
    panel.style.display = "block";
    requestAnimationFrame(function () {
      panel.classList.add("is-open");
    });
    setFabIcon(true);
    openIntro();
  }

  function formatTime(ts) {
    try {
      var d = ts ? new Date(ts) : new Date();
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (_e) {
      return "";
    }
  }

  function bubble(text, role, ts) {
    var row = document.createElement("div");
    row.className = "acme-w-row" + (role === "user" ? " is-user" : "");

    var avatar = document.createElement("div");
    avatar.className = "acme-w-avatar " + (role === "user" ? "is-user" : "is-assistant");
    avatar.innerHTML = role === "user" ? ICONS.user : ICONS.bot;

    var wrap = document.createElement("div");
    wrap.className = "acme-w-bubble-wrap";

    var b = document.createElement("div");
    b.className = "acme-w-bubble " + (role === "user" ? "is-user" : "is-assistant");
    b.textContent = text;

    var time = document.createElement("div");
    time.className = "acme-w-time";
    time.textContent = formatTime(ts);

    wrap.appendChild(b);
    wrap.appendChild(time);

    if (role === "user") {
      var copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "acme-w-copy";
      copyBtn.title = "Copy message";
      copyBtn.innerHTML = ICONS.copy;
      copyBtn.addEventListener("click", function () {
        var content = String(text || "");
        if (!content || !navigator.clipboard || !navigator.clipboard.writeText) return;
        navigator.clipboard.writeText(content).then(function () {
          copyBtn.innerHTML = ICONS.check;
          copyBtn.style.color = "hsl(142,72%,29%)";
          setTimeout(function () {
            copyBtn.innerHTML = ICONS.copy;
            copyBtn.style.color = "";
          }, 1200);
        }).catch(function () {});
      });
      wrap.appendChild(copyBtn);
    }

    row.appendChild(avatar);
    row.appendChild(wrap);
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  function renderWelcomeCard() {
    var card = document.createElement("div");
    card.className = "acme-w-welcome";
    card.textContent = dynamicWelcome;
    body.appendChild(card);
    body.scrollTop = body.scrollHeight;
  }

  function renderHistory() {
    body.innerHTML = "";
    var rows = getHistory();
    if (!rows.length) {
      renderWelcomeCard();
      return;
    }
    rows.forEach(function (m) {
      bubble(m.content || "", m.role || "assistant", m.ts);
    });
  }

  function addHistory(role, content) {
    var rows = getHistory();
    rows.push({ role: role, content: content, ts: Date.now() });
    setHistory(rows);
  }

  function removeTypingIndicator() {
    var existing = document.getElementById("acme-widget-typing");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  function showTypingIndicator() {
    removeTypingIndicator();
    var row = document.createElement("div");
    row.id = "acme-widget-typing";
    row.className = "acme-w-typing";

    var avatar = document.createElement("div");
    avatar.className = "acme-w-avatar is-assistant";
    avatar.innerHTML = ICONS.bot;

    var bubbleWrap = document.createElement("div");
    bubbleWrap.className = "acme-w-typing-bubble";
    for (var i = 0; i < 3; i++) {
      var dot = document.createElement("span");
      dot.className = "acme-w-dot";
      bubbleWrap.appendChild(dot);
    }

    row.appendChild(avatar);
    row.appendChild(bubbleWrap);
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  function setLoading(flag) {
    sendBtn.disabled = !!flag;
  }

  async function loadDynamicConfig() {
    try {
      var res = await fetch(CONFIG_URL + "?widget_key=" + encodeURIComponent(botKey));
      if (!res.ok) return;
      var data = await res.json();
      if (data && data.bot_name && !cfg.title) {
        title.textContent = String(data.bot_name);
      }
      if (data && data.welcome_message) {
        dynamicWelcome = String(data.welcome_message);
        localStorage.setItem(WELCOME_KEY, dynamicWelcome);
      }
      if (data && data.theme && typeof data.theme === "object") {
        theme = Object.assign(theme, {
          navyDeep: data.theme.navy_deep || data.theme.navyDeep || theme.navyDeep,
          navy: data.theme.navy || theme.navy,
          navyLight: data.theme.navy_light || data.theme.navyLight || theme.navyLight,
          mint: data.theme.mint || theme.mint,
          mintLight: data.theme.mint_light || data.theme.mintLight || theme.mintLight
        });
        applyThemeStyles();
      }
    } catch (_e) {}
  }

  async function ask() {
    var q = (input.value || "").trim();
    if (!q || sendBtn.disabled) return;
    input.value = "";
    if (!getHistory().length) body.innerHTML = "";
    addHistory("user", q);
    bubble(q, "user", Date.now());
    setLoading(true);
    showTypingIndicator();
    try {
      var res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widget_key: botKey,
          query: q,
          session_id: getSessionId()
        })
      });
      var data = await res.json();
      var answer = (data && data.answer) ? String(data.answer) : "I could not generate a response.";
      removeTypingIndicator();
      addHistory("assistant", answer);
      bubble(answer, "assistant", Date.now());
    } catch (_e) {
      var msg = "Could not reach the chat service. Please refresh and try again.";
      removeTypingIndicator();
      addHistory("assistant", msg);
      bubble(msg, "assistant", Date.now());
    } finally {
      removeTypingIndicator();
      setLoading(false);
    }
  }

  clearBtn.addEventListener("click", function () {
    setHistory([]);
    localStorage.removeItem(SESSION_KEY);
    renderHistory();
  });
  sendBtn.addEventListener("click", ask);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") ask();
  });
  introCta.addEventListener("click", openChat);
  backBtn.addEventListener("click", openIntro);
  introCloseBtn.addEventListener("click", closePanel);
  toggleBtn.addEventListener("click", function () {
    if (panelOpen) closePanel();
    else openPanel();
  });
  window.addEventListener("resize", applyResponsiveLayout);

  introCtaText.appendChild(introCtaHeading);
  introCtaText.appendChild(introCtaHint);
  introCta.appendChild(introCtaText);
  introCta.appendChild(introCtaIcon);
  introFooter.appendChild(introCta);
  introHero.appendChild(introCloseBtn);
  introHero.appendChild(introAvatar);
  introHero.appendChild(introTitle);
  introHero.appendChild(introSubtitle);
  introScreen.appendChild(introHero);
  introScreen.appendChild(introFooter);

  headerStatus.appendChild(statusDot);
  headerStatus.appendChild(headerSub);
  headerText.appendChild(title);
  headerText.appendChild(headerStatus);
  headerActions.appendChild(clearBtn);
  headerInner.appendChild(backBtn);
  headerInner.appendChild(headerBadge);
  headerInner.appendChild(headerText);
  headerInner.appendChild(headerActions);
  header.appendChild(headerBg);
  header.appendChild(headerInner);

  inputWrap.appendChild(input);
  inputWrap.appendChild(sendBtn);
  composer.appendChild(inputWrap);
  chatShell.appendChild(header);
  chatShell.appendChild(body);
  chatShell.appendChild(composer);

  panel.appendChild(introScreen);
  panel.appendChild(chatShell);
  root.appendChild(panel);
  root.appendChild(toggleBtn);
  document.body.appendChild(root);

  applyThemeStyles();
  applyResponsiveLayout();
  loadDynamicConfig();
})();
`;
}
