/* MD Cloud — shared layer: profile, save/resume, export (MD/Word/PDF), CTA, analytics.  Client-side only. */
(function () {
  var CFG = {
    email: "moh.dassen@gmail.com",
    linkedin: "https://www.linkedin.com/in/mohdassen/",
    newsletter: "",                         // optional: email-service subscribe endpoint (e.g. Buttondown embed URL)
    calendly: "",                            // optional booking link
    goatcounter: "mohdassen",                       // optional: your GoatCounter code, e.g. "mohdassen"
    site: "https://mohdassen.github.io/aws-consulting-roadmap/"
  };
  var K = "md.";
  var MD = window.MD = { cfg: CFG };

  /* ---------- storage ---------- */
  function get(k, d) { try { var v = localStorage.getItem(K + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  MD.get = get; MD.set = set;

  /* ---------- shared client profile (cross-tool prefill) ---------- */
  MD.profile = {
    fields: ["org", "sector", "contact", "region", "employees", "workloads", "date"],
    get: function () { return get("profile", {}); },
    save: function (p) { var c = get("profile", {}); for (var k in p) if (p[k] !== "" && p[k] != null) c[k] = p[k]; set("profile", c); },
    bind: function (map) { // map: {org:'#id', ...}
      var p = get("profile", {});
      Object.keys(map).forEach(function (k) {
        var el = document.querySelector(map[k]); if (!el) return;
        if (p[k] && !el.value) el.value = p[k];
        el.addEventListener("change", function () { var o = {}; o[k] = el.value; MD.profile.save(o); });
      });
    }
  };

  /* ---------- results shared between tools ---------- */
  MD.results = { save: function (tool, data) { var r = get("results", {}); r[tool] = { at: new Date().toISOString(), data: data }; set("results", r); },
                 get: function (tool) { var r = get("results", {}); return r[tool] || null; } };

  /* ---------- save / resume ---------- */
  MD.state = function (tool, collect, apply) {
    var key = "state." + tool;
    function save() { try { set(key, { at: Date.now(), d: collect() }); flash("Progress saved on this device"); } catch (e) {} }
    var t; function auto() { clearTimeout(t); t = setTimeout(save, 700); }
    document.addEventListener("input", auto); document.addEventListener("change", auto); document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-autosave]")) auto(); });
    var s = get(key, null);
    if (s && s.d) { try { apply(s.d); flash("Resumed your saved session"); } catch (e) {} }
    return { save: save, clear: function () { try { localStorage.removeItem(K + key); } catch (e) {} location.reload(); },
      exportJSON: function () { download(tool + "-session.json", JSON.stringify({ tool: tool, saved: new Date().toISOString(), data: collect() }, null, 2), "application/json"); },
      importJSON: function (file) { var r = new FileReader(); r.onload = function () { try { var j = JSON.parse(r.result); apply(j.data); save(); } catch (e) { alert("Invalid session file"); } }; r.readAsText(file); } };
  };
  function flash(msg) {
    var el = document.getElementById("md-toast");
    if (!el) { el = document.createElement("div"); el.id = "md-toast"; el.className = "md-toast"; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("on"); clearTimeout(flash.t); flash.t = setTimeout(function () { el.classList.remove("on"); }, 1800);
  }
  MD.flash = flash;

  /* ---------- download helpers ---------- */
  function download(name, content, type) {
    var b = new Blob([content], { type: type || "text/plain" }), a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  MD.download = download;

  /* ---------- markdown -> html (headings, lists, tables, bold, code, hr) ---------- */
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*(.+?)\*/g, "<i>$1</i>"); }
  MD.mdToHtml = function (md) {
    var L = md.split("\n"), o = [], i = 0, list = null;
    function close() { if (list) { o.push("</" + list + ">"); list = null; } }
    while (i < L.length) {
      var l = L[i];
      if (/^```/.test(l)) { close(); var buf = []; i++; while (i < L.length && !/^```/.test(L[i])) buf.push(esc(L[i++])); o.push("<pre>" + buf.join("\n") + "</pre>"); i++; continue; }
      if (/^\|/.test(l) && /^\|[\s:|-]+\|?\s*$/.test(L[i + 1] || "")) {
        close(); var head = l.split("|").slice(1, -1), rows = []; i += 2;
        while (i < L.length && /^\|/.test(L[i])) { rows.push(L[i].split("|").slice(1, -1)); i++; }
        o.push("<table><thead><tr>" + head.map(function (h) { return "<th>" + inline(h.trim()) + "</th>"; }).join("") + "</tr></thead><tbody>" +
          rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + inline(c.trim()) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>"); continue;
      }
      var m;
      if ((m = l.match(/^(#{1,4})\s+(.*)/))) { close(); o.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">"); }
      else if (/^---+\s*$/.test(l)) { close(); o.push("<hr>"); }
      else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (list !== "ul") { close(); o.push("<ul>"); list = "ul"; } o.push("<li>" + inline(m[1]) + "</li>"); }
      else if ((m = l.match(/^\s*\d+\.\s+(.*)/))) { if (list !== "ol") { close(); o.push("<ol>"); list = "ol"; } o.push("<li>" + inline(m[1]) + "</li>"); }
      else if ((m = l.match(/^>\s?(.*)/))) { close(); o.push("<blockquote>" + inline(m[1]) + "</blockquote>"); }
      else if (l.trim() === "") { close(); }
      else { close(); o.push("<p>" + inline(l) + "</p>"); }
      i++;
    }
    close(); return o.join("\n");
  };
  var DOC_CSS = "body{font-family:Calibri,'Segoe UI',Arial,sans-serif;color:#1a2233;line-height:1.5;font-size:11pt;max-width:820px;margin:24px auto;padding:0 24px}" +
    "h1{font-family:Georgia,serif;color:#0b2447;border-bottom:3px solid #f59e0b;padding-bottom:6px;font-size:22pt}h2{font-family:Georgia,serif;color:#0b2447;font-size:15pt;margin-top:22px;border-bottom:1px solid #d5dbe6;padding-bottom:3px}h3{color:#19376d;font-size:12pt}" +
    "table{border-collapse:collapse;width:100%;margin:10px 0}th{background:#0b2447;color:#fff;text-align:left;padding:6px 8px;font-size:10pt}td{border:1px solid #d5dbe6;padding:5px 8px;font-size:10pt;vertical-align:top}" +
    "code{background:#eef1f6;padding:1px 4px;border-radius:3px;font-family:Consolas,monospace;font-size:9.5pt}pre{background:#f3f5f9;border:1px solid #d5dbe6;padding:10px;font-family:Consolas,monospace;font-size:9pt;white-space:pre-wrap}blockquote{border-left:4px solid #f59e0b;margin:10px 0;padding:4px 12px;background:#fff8e6}" +
    "@media print{body{margin:0;max-width:none}}";
  MD.docHtml = function (title, md, dir) {
    return "<!DOCTYPE html><html" + (dir ? ' dir="' + dir + '"' : "") + "><head><meta charset='utf-8'><title>" + esc(title) + "</title><style>" + DOC_CSS + (dir === "rtl" ? "body{direction:rtl;text-align:right}th{text-align:right}" : "") + "</style></head><body>" + MD.mdToHtml(md) + "</body></html>";
  };
  MD.exportWord = function (name, title, md, dir) {
    var html = MD.docHtml(title, md, dir).replace("<html", "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'");
    download(name.replace(/\.(docx?|md)$/i, "") + ".doc", "﻿" + html, "application/msword");
  };
  MD.exportPDF = function (title, md, dir) {
    var w = window.open("", "_blank"); if (!w) { alert("Please allow pop-ups to export PDF"); return; }
    w.document.write(MD.docHtml(title, md, dir)); w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 400);
  };
  MD.exportMD = function (name, md) { download(name.replace(/\.md$/i, "") + ".md", md, "text/markdown"); };
  MD.copy = function (txt) { (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { flash("Copied to clipboard"); }, function () { var t = document.createElement("textarea"); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); flash("Copied to clipboard"); } catch (e) {} t.remove(); }); };
  MD.exportBar = function (mount, getName, getTitle, getMd, getDir) {
    var el = typeof mount === "string" ? document.querySelector(mount) : mount; if (!el) return;
    el.innerHTML = '<button class="btn" data-x="copy">📋 Copy Markdown</button><button class="btn" data-x="md">⬇ .md</button><button class="btn" data-x="word">⬇ Word</button><button class="btn" data-x="pdf">🖨 PDF / Print</button>';
    el.addEventListener("click", function (e) { var b = e.target.closest("[data-x]"); if (!b) return; var md = getMd(), d = getDir ? getDir() : ""; MD.track("export-" + b.dataset.x);
      ({ copy: function () { MD.copy(md); }, md: function () { MD.exportMD(getName(), md); }, word: function () { MD.exportWord(getName(), getTitle(), md, d); }, pdf: function () { MD.exportPDF(getTitle(), md, d); } })[b.dataset.x](); });
  };

  /* ---------- share card (PNG for LinkedIn) ---------- */
  MD.shareCard = function (o) { // {title, big, sub, lines:[], file}
    var c = document.createElement("canvas"); c.width = 1200; c.height = 630; var x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 1200, 630); g.addColorStop(0, "#0a1020"); g.addColorStop(1, "#162036"); x.fillStyle = g; x.fillRect(0, 0, 1200, 630);
    x.fillStyle = "#e5b04a"; x.fillRect(70, 70, 70, 6);
    x.fillStyle = "#aab5cd"; x.font = "600 26px Segoe UI, Arial"; x.fillText((o.eyebrow || "AWS CLOUD ADVISORY · RIYADH").toUpperCase(), 70, 120);
    x.fillStyle = "#eaf0fb"; x.font = "700 54px Georgia, serif"; wrap(x, o.title, 70, 200, 1060, 64);
    x.fillStyle = "#e5b04a"; x.font = "700 150px Georgia, serif"; x.fillText(o.big || "", 70, 430);
    x.fillStyle = "#aab5cd"; x.font = "500 28px Segoe UI, Arial"; x.fillText(o.sub || "", 70, 480);
    (o.lines || []).slice(0, 3).forEach(function (l, i) { x.fillStyle = "#eaf0fb"; x.font = "600 26px Segoe UI, Arial"; x.fillText("• " + l, 560, 340 + i * 44); });
    x.fillStyle = "#8794b0"; x.font = "500 24px Segoe UI, Arial"; x.fillText("Mohammad Dassen · mohdassen.github.io/aws-consulting-roadmap", 70, 585);
    c.toBlob(function (b) { var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = (o.file || "result") + ".png"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); MD.track("share-card"); });
    function wrap(ctx, t, px, py, mw, lh) { var w = (t || "").split(" "), l = ""; w.forEach(function (k) { var tt = l + k + " "; if (ctx.measureText(tt).width > mw && l) { ctx.fillText(l, px, py); l = k + " "; py += lh; } else l = tt; }); ctx.fillText(l, px, py); }
  };

  /* ---------- analytics (optional, cookie-less GoatCounter) ---------- */
  MD.track = function (ev) { try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "event/" + ev, title: ev, event: true }); } catch (e) {} };
  if (CFG.goatcounter) { var s = document.createElement("script"); s.async = true; s.src = "https://gc.zgo.at/count.js"; s.setAttribute("data-goatcounter", "https://" + CFG.goatcounter + ".goatcounter.com/count"); document.head.appendChild(s); }

  /* ---------- CTA strip ---------- */
  /* self-contained styles so pages without tools.css still render toast/CTA */
  var st=document.createElement("style");st.textContent=".md-toast{position:fixed;bottom:22px;left:50%;transform:translate(-50%,20px);background:var(--s3,#1a1f2e);color:var(--text,#e8edf5);border:1px solid var(--gold,#f59e0b);padding:8px 16px;border-radius:99px;font:600 .78rem 'Segoe UI',sans-serif;opacity:0;transition:.25s;z-index:9999;pointer-events:none}.md-toast.on{opacity:1;transform:translate(-50%,0)}.md-cta{max-width:1100px;margin:10px auto 30px;padding:20px 24px;border:1px solid var(--border2,rgba(245,158,11,.3));border-radius:16px;background:var(--surface,#0e1219);box-shadow:var(--shadow,none);display:flex;align-items:center;gap:20px;flex-wrap:wrap;justify-content:space-between;font-family:'Segoe UI',sans-serif;color:var(--text,#e8edf5)}.md-cta b{display:block;font-family:Georgia,serif;font-size:1.05rem}.md-cta span{font-size:.82rem;color:var(--muted2,#9aa3bd)}.md-cta .btn{display:inline-flex;background:var(--gold,#f59e0b);color:var(--on-gold,#1a1200);padding:9px 16px;border-radius:8px;font-weight:700;font-size:.82rem;text-decoration:none}@media print{.md-cta{display:none}}";document.head.appendChild(st);
  MD.mailto = function (subject, body) { return "mailto:" + CFG.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body || ""); };
  function injectCTA() {
    if (document.body.hasAttribute("data-no-cta") || document.getElementById("md-cta")) return;
    var d = document.createElement("div"); d.id = "md-cta"; d.className = "md-cta";
    d.innerHTML = '<div><b>Need this done for your organisation?</b><span>Fixed-scope AWS advisory engagements — Well-Architected Review, NCA/PDPL gap assessment, governance workshop.</span></div><a class="btn gold" href="work-with-me.html" data-track="cta-work-with-me">Work With Me →</a>';
    var f = document.querySelector("footer, .site-footer"); if (f && f.parentNode) f.parentNode.insertBefore(d, f); else document.body.appendChild(d);
    d.addEventListener("click", function (e) { var a = e.target.closest("[data-track]"); if (a) MD.track(a.dataset.track); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectCTA); else injectCTA();
  /* theme toggle */
  function themeBtn(){var b=document.createElement("button");b.className="md-theme";b.setAttribute("aria-label","Toggle light/dark theme");
    function sync(){b.textContent=document.documentElement.getAttribute("data-theme")==="light"?"🌙":"☀️"}
    b.onclick=function(){var n=document.documentElement.getAttribute("data-theme")==="light"?"dark":"light";document.documentElement.setAttribute("data-theme",n);set("theme",n);sync()};sync();document.body.appendChild(b)}
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", themeBtn); else themeBtn();
  MD.track("pageview-" + (location.pathname.split("/").pop() || "index"));
})();
