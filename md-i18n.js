/* MD Cloud — site-wide English/Arabic layer. Translates visible text by exact-match dictionary (md-ar.js), flips to RTL. */
(function () {
  if (document.body && document.body.hasAttribute("data-i18n-off")) return;
  var KEY = "md.lang", lang = "en", DICT = null, PATS = [], busy = false, obs = null;
  try { var s = localStorage.getItem(KEY); if (s) lang = JSON.parse(s); } catch (e) {}
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, PRE: 1, CODE: 1, NOSCRIPT: 1 };
  function norm(t) { return t.replace(/\s+/g, " ").trim(); }
  function tr(t) {
    var k = norm(t); if (!k) return null;
    if (DICT[k]) return DICT[k];
    for (var i = 0; i < PATS.length; i++) { var m = k.match(PATS[i][0]); if (m) return PATS[i][1].apply(null, m); }
    return null;
  }
  function skip(el) { while (el) { if (SKIP[el.nodeName] || (el.hasAttribute && (el.hasAttribute("data-i18n-skip") || el.classList.contains("preview")))) return true; el = el.parentNode; } return false; }
  function run(root) {
    if (!DICT) return; busy = true; if (obs) obs.disconnect();
    var w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, null), n, nodes = [];
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (n) {
      if (skip(n.parentNode)) return;
      if (lang === "ar") {
        var src = n.__en != null ? n.__en : n.nodeValue, t = tr(src);
        if (t) { if (n.__en == null) n.__en = n.nodeValue; var lead = (src.match(/^\s*/) || [""])[0], trail = (src.match(/\s*$/) || [""])[0]; if (n.nodeValue !== lead + t + trail) n.nodeValue = lead + t + trail; }
      } else if (n.__en != null) { n.nodeValue = n.__en; n.__en = null; }
    });
    [].forEach.call((root || document.body).querySelectorAll("[placeholder],[title],[aria-label]"), function (e) {
      ["placeholder", "title", "aria-label"].forEach(function (a) {
        if (!e.hasAttribute(a)) return; var k = "__en_" + a;
        if (lang === "ar") { var src = e[k] != null ? e[k] : e.getAttribute(a), t = tr(src); if (t) { if (e[k] == null) e[k] = e.getAttribute(a); e.setAttribute(a, t); } }
        else if (e[k] != null) { e.setAttribute(a, e[k]); e[k] = null; }
      });
    });
    var tt = DICT["__title:" + (location.pathname.split("/").pop() || "index.html")];
    if (!document.__enTitle) document.__enTitle = document.title;
    document.title = lang === "ar" && tt ? tt : document.__enTitle;
    busy = false; watch();
  }
  function watch() { if (!obs) obs = new MutationObserver(function () { if (!busy) { clearTimeout(watch.t); watch.t = setTimeout(function () { run(document.body); }, 30); } }); obs.observe(document.body, { childList: true, subtree: true, characterData: true }); }
  function apply() {
    var ownDir = document.documentElement.hasAttribute("data-own-dir");
    if (!ownDir) { document.documentElement.setAttribute("lang", lang); document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr"); }
    var b = document.getElementById("md-lang"); if (b) b.textContent = lang === "ar" ? "EN" : "ع";
    if (lang === "ar" && !DICT) { var sc = document.createElement("script"); sc.src = "md-ar.js"; sc.onload = function () { DICT = window.MD_AR.dict; PATS = window.MD_AR.pats || []; run(document.body); }; document.head.appendChild(sc); }
    else run(document.body);
  }
  function set(l) { lang = l; try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {} if (window.MD && MD.track) MD.track("lang-" + l); apply(); }
  function init() {
    var b = document.createElement("button"); b.id = "md-lang"; b.className = "md-theme md-lang"; b.setAttribute("aria-label", "Switch language / تغيير اللغة");
    b.onclick = function () { set(lang === "ar" ? "en" : "ar"); }; document.body.appendChild(b);
    window.MDI18N = { set: set, get: function () { return lang; } };
    if (lang === "ar") apply(); else { b.textContent = "ع"; }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
