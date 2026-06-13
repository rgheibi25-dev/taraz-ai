/*!
 * پرسش از پرونده‌های تراز — TarazQAWidget
 * One reusable, CMS-agnostic widget. Auto-mounts on every [data-taraz-qa] placeholder.
 * Modes: full | compact | inline. No chatbot, no bot avatar, no floating bubble.
 *
 * Endpoint resolution order: element data-api  ->  window.TARAZ_QA_API  ->  "/api/taraz-qa"
 */
(function () {
  "use strict";

  var STR = {
    title: "پرسش از پرونده‌های تراز",
    subtitle: "پاسخ‌های کوتاه و مستند، فقط بر اساس گزارش‌های منتشرشده تراز.",
    inlineTitle: "این گزارش را سریع‌تر بخوانید",
    placeholder: "مثلا: ریسک‌های اقتصاد دیجیتال در پرونده‌های تراز چیست؟",
    button: "دریافت پاسخ مستند",
    loading: "در حال جست‌وجو در پرونده‌های تراز...",
    empty: "در پرونده‌های منتشرشده تراز، پاسخ مستند کافی برای این پرسش پیدا نشد.",
    privacy: "پرسش شما برای تولید پاسخ مستند پردازش می‌شود. اطلاعات شخصی وارد نکنید.",
    secAnswer: "پاسخ کوتاه",
    secPoints: "نکات اصلی",
    secSources: "منابع تراز",
    secConfidence: "سطح اطمینان",
    secLimit: "محدودیت پاسخ",
    secMore: "لینک مطالعه بیشتر",
    noUrl: "لینک عمومی موجود نیست",
    conf: { high: "بالا", medium: "متوسط", low: "پایین" }
  };

  var DEFAULT_Q = {
    dossier: [
      "خلاصه ریسک اصلی این پرونده چیست؟",
      "تراز در این پرونده چه نشانه‌هایی را دنبال می‌کند؟",
      "این پرونده برای تصمیم‌گیران چه معنایی دارد؟"
    ],
    report: [
      "خلاصه این گزارش چیست؟",
      "مهم‌ترین ریسک مطرح‌شده چیست؟",
      "این گزارش به کدام پرونده‌های تراز وصل است؟"
    ]
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function endpointFor(root) {
    return root.getAttribute("data-api") || window.TARAZ_QA_API || "/api/taraz-qa";
  }

  function suggestedFor(root, contentType) {
    var raw = root.getAttribute("data-suggested");
    if (raw) {
      try { var arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; } catch (e) {}
      return raw.split("|").map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return contentType === "dossier" ? DEFAULT_Q.dossier : DEFAULT_Q.report;
  }

  function render(root) {
    if (root.getAttribute("data-enabled") === "false") return;        // CMS off-switch
    if (root.__tzqaMounted) return;                                    // no double-mount
    var scope = root.getAttribute("data-scope") || "site";
    var dossierSlug = root.getAttribute("data-dossier-slug") || null;
    var contentSlug = root.getAttribute("data-content-slug") || null;
    var contentType = root.getAttribute("data-content-type") || "dossier";
    var mode = root.getAttribute("data-mode") || (scope === "site" ? "full" : "compact");
    // If scope demands a slug but it's missing, render nothing rather than break the page.
    if (scope === "dossier" && !dossierSlug) return;
    if (scope === "content" && !contentSlug) return;

    root.__tzqaMounted = true;
    root.setAttribute("dir", "rtl");
    root.classList.add("tzqa", "tzqa--" + mode);

    var head = el("div", "tzqa-head");
    head.appendChild(el("div", "tzqa-title", mode === "inline" ? STR.inlineTitle : STR.title));
    if (mode !== "inline") head.appendChild(el("div", "tzqa-sub", STR.subtitle));
    var intro = root.getAttribute("data-intro");
    if (intro) head.appendChild(el("div", "tzqa-intro", intro));
    root.appendChild(head);

    var form = el("form", "tzqa-form");
    var input = el("input", "tzqa-input");
    input.type = "text";
    input.placeholder = STR.placeholder;
    input.setAttribute("maxlength", "500");
    var btn = el("button", "tzqa-btn", STR.button);
    btn.type = "submit";
    form.appendChild(input);
    form.appendChild(btn);
    root.appendChild(form);

    root.appendChild(el("div", "tzqa-privacy", STR.privacy));

    // Suggested questions as quiet chips.
    var sugg = suggestedFor(root, contentType);
    if (sugg.length) {
      var chips = el("div", "tzqa-chips");
      sugg.forEach(function (q) {
        var c = el("button", "tzqa-chip", q);
        c.type = "button";
        c.addEventListener("click", function () { input.value = q; ask(); });
        chips.appendChild(c);
      });
      root.appendChild(chips);
    }

    var result = el("div", "tzqa-result");
    result.setAttribute("aria-live", "polite");
    root.appendChild(result);

    function setBusy(b) {
      btn.disabled = b;
      input.disabled = b;
    }

    function ask() {
      var question = (input.value || "").trim();
      if (question.length < 3) return;
      result.innerHTML = "";
      result.appendChild(el("div", "tzqa-loading", STR.loading));
      setBusy(true);

      fetch(endpointFor(root), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question,
          scope: scope,
          dossier_slug: dossierSlug,
          content_slug: contentSlug,
          content_type: contentType,
          page_url: location.href,
          page_title: document.title
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) { setBusy(false); paint(result, data); })
        .catch(function () {
          setBusy(false);
          result.innerHTML = "";
          result.appendChild(el("div", "tzqa-empty", STR.empty));
        });
    }

    form.addEventListener("submit", function (e) { e.preventDefault(); ask(); });
  }

  function paint(result, data) {
    result.innerHTML = "";
    if (!data || !data.answer || (data.sources && data.sources.length === 0 && (!data.key_points || !data.key_points.length))) {
      // Insufficient / refusal still has an answer string; show it plainly.
      result.appendChild(el("div", "tzqa-empty", (data && data.answer) || STR.empty));
      if (data && data.limitations) result.appendChild(el("div", "tzqa-limit", data.limitations));
      return;
    }

    var box = el("div", "tzqa-card");

    // پاسخ کوتاه
    var a = el("div", "tzqa-sec");
    a.appendChild(el("div", "tzqa-sec-h", STR.secAnswer));
    a.appendChild(el("p", "tzqa-answer", data.answer));
    box.appendChild(a);

    // نکات اصلی
    if (data.key_points && data.key_points.length) {
      var kp = el("div", "tzqa-sec");
      kp.appendChild(el("div", "tzqa-sec-h", STR.secPoints));
      var ul = el("ul", "tzqa-points");
      data.key_points.forEach(function (p) { ul.appendChild(el("li", null, p)); });
      kp.appendChild(ul);
      box.appendChild(kp);
    }

    // منابع تراز
    if (data.sources && data.sources.length) {
      var s = el("div", "tzqa-sec");
      s.appendChild(el("div", "tzqa-sec-h", STR.secSources));
      var list = el("div", "tzqa-sources");
      data.sources.forEach(function (src) {
        var card = el("div", "tzqa-source");
        if (src.public_url) {
          var link = el("a", "tzqa-source-t", src.title);
          link.href = src.public_url;
          link.target = "_blank";
          link.rel = "noopener";
          card.appendChild(link);
        } else {
          card.appendChild(el("div", "tzqa-source-t", src.title));
          card.appendChild(el("div", "tzqa-source-x", STR.noUrl));
        }
        var meta = [src.dossier, src.published_date].filter(Boolean).join(" · ");
        if (meta) card.appendChild(el("div", "tzqa-source-m", meta));
        list.appendChild(card);
      });
      s.appendChild(list);
      box.appendChild(s);
    }

    // سطح اطمینان + محدودیت پاسخ
    var foot = el("div", "tzqa-foot");
    if (data.confidence) {
      var conf = el("span", "tzqa-conf tzqa-conf--" + data.confidence);
      conf.textContent = STR.secConfidence + ": " + (STR.conf[data.confidence] || data.confidence);
      foot.appendChild(conf);
    }
    box.appendChild(foot);
    if (data.limitations) {
      var lim = el("div", "tzqa-limit");
      lim.appendChild(el("span", "tzqa-limit-h", STR.secLimit + ": "));
      lim.appendChild(document.createTextNode(data.limitations));
      box.appendChild(lim);
    }

    // لینک مطالعه بیشتر (followups)
    if (data.suggested_followups && data.suggested_followups.length) {
      var more = el("div", "tzqa-sec tzqa-more");
      more.appendChild(el("div", "tzqa-sec-h", STR.secMore));
      var chips = el("div", "tzqa-chips");
      data.suggested_followups.forEach(function (q) {
        var c = el("button", "tzqa-chip", q);
        c.type = "button";
        c.addEventListener("click", function () {
          var input = result.parentNode.querySelector(".tzqa-input");
          if (input) { input.value = q; input.focus(); }
        });
        chips.appendChild(c);
      });
      more.appendChild(chips);
      box.appendChild(more);
    }

    result.appendChild(box);
  }

  function mountAll() {
    var nodes = document.querySelectorAll("[data-taraz-qa]");
    for (var i = 0; i < nodes.length; i++) {
      try { render(nodes[i]); } catch (e) { /* never break the host page */ }
    }
  }

  window.TarazQA = { mountAll: mountAll };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll);
  } else {
    mountAll();
  }
})();
