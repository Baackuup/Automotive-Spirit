// Automotive Spirit: progressive enhancements only. Every page works without JavaScript.
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  document.addEventListener("DOMContentLoaded", function () {
    // Mobile menu
    var toggle = document.querySelector(".menu-toggle");
    var nav = document.getElementById("main-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && nav.classList.contains("open")) {
          nav.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.focus();
        }
      });
    }

    // Model sheets open over the brand page; "Download PDF" prints the sheet (A4 layout in the style sheet)
    setupSheets();
    setupShowcase();
    // Platforms: filter the cards by name or brand as you type
    var plFilter = document.querySelector(".pl-filter");
    if (plFilter) {
      plFilter.hidden = false;
      var cards = Array.prototype.slice.call(document.querySelectorAll(".pl-card"));
      plFilter.addEventListener("input", function () {
        var q = plFilter.value.trim().toLowerCase();
        cards.forEach(function (c) { c.parentNode.hidden = q && c.textContent.toLowerCase().indexOf(q) < 0; });
      });
    }
    document.querySelectorAll("[data-print]").forEach(function (b) { b.hidden = false; });
    document.addEventListener("click", function (ev) {
      if (ev.target.closest && ev.target.closest("[data-print]")) window.print();
    });

    // Ownership map: zoom and pan by changing the SVG viewBox (wheel, pinch, drag, buttons)
    var chart = document.querySelector(".og-chart");
    if (chart) setupMap(chart);

    // Catalog filters
    var form = document.querySelector(".filters");
    if (!form) return;
    var cards = Array.prototype.slice.call(document.querySelectorAll(".letter-group .brand-card"));
    var groups = Array.prototype.slice.call(document.querySelectorAll(".letter-group"));
    var count = form.querySelector(".filters-count");
    var empty = document.querySelector(".empty");
    var q = form.elements.q, country = form.elements.country, pages = form.elements.namedItem("pages");

    function normalise(text) {
      return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    }

    function apply() {
      var term = normalise(q.value), code = country.value, onlyPages = pages ? pages.checked : false, shown = 0;
      cards.forEach(function (card) {
        var ok = (!term || card.dataset.name.indexOf(term) !== -1) &&
                 (!code || card.dataset.country === code) &&
                 (!onlyPages || card.dataset.page === "1");
        card.hidden = !ok;
        if (ok) shown += 1;
      });
      groups.forEach(function (group) {
        var visible = group.querySelector(".brand-card:not([hidden])") !== null;
        group.hidden = !visible;
        var link = document.querySelector('.letters a[href="#' + group.id + '"]');
        if (link) link.classList.toggle("off", !visible);
      });
      count.textContent = shown + (shown === 1 ? " brand" : " brands");
      empty.hidden = shown !== 0;
    }

    form.hidden = false;
    form.addEventListener("input", apply);
    form.addEventListener("submit", function (ev) { ev.preventDefault(); });
    apply();
  });
  function setupMap(svg) {
    var start = svg.getAttribute("viewBox").split(" ").map(Number);
    // First view: on a box narrower than the map (a phone held upright), fill its height and keep the
    // centre, so names are readable at once; the rest is one drag away. Wide boxes show the whole map.
    function firstView() {
      var r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return start.slice();
      var w = start[3] * r.width / r.height;
      if (w >= start[2] * 0.9) return start.slice();
      return [start[0] + (start[2] - w) / 2, start[1], w, start[3]];
    }
    var home = firstView();
    var vb = home.slice();
    var minW = start[2] / 8, maxW = start[2] * 1.5;
    var tools = document.querySelector(".og-tools");
    var pointers = {}, last = null, moved = 0, pinch = null;

    function apply() { svg.setAttribute("viewBox", vb.join(" ")); }
    apply();
    function toSvg(clientX, clientY) {
      var r = svg.getBoundingClientRect();
      var s = Math.max(vb[2] / r.width, vb[3] / r.height);          // "meet": the larger ratio wins
      var ox = (r.width * s - vb[2]) / 2, oy = (r.height * s - vb[3]) / 2;
      return [vb[0] - ox + (clientX - r.left) * s, vb[1] - oy + (clientY - r.top) * s, s];
    }
    function zoom(factor, cx, cy) {
      var w = Math.min(maxW, Math.max(minW, vb[2] * factor));
      var k = w / vb[2];
      vb = [cx - (cx - vb[0]) * k, cy - (cy - vb[1]) * k, vb[2] * k, vb[3] * k];
      apply();
    }
    function centre() { return [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2]; }

    if (tools) {
      tools.hidden = false;
      tools.addEventListener("click", function (ev) {
        var b = ev.target.closest("button");
        if (!b) return;
        var c = centre();
        if (b.dataset.zoom === "in") zoom(0.7, c[0], c[1]);
        else if (b.dataset.zoom === "out") zoom(1 / 0.7, c[0], c[1]);
        else { vb = home.slice(); apply(); }
      });
    }
    svg.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      var p = toSvg(ev.clientX, ev.clientY);
      zoom(Math.exp(ev.deltaY * 0.0015), p[0], p[1]);
    }, { passive: false });
    svg.addEventListener("pointerdown", function (ev) {
      pointers[ev.pointerId] = [ev.clientX, ev.clientY];
      var ids = Object.keys(pointers);
      if (ids.length === 1) { last = [ev.clientX, ev.clientY]; moved = 0; }
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
      }
    });
    svg.addEventListener("pointermove", function (ev) {
      if (!(ev.pointerId in pointers)) return;
      pointers[ev.pointerId] = [ev.clientX, ev.clientY];
      var ids = Object.keys(pointers);
      if (ids.length === 2 && pinch) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        var m = toSvg((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        zoom(pinch / d, m[0], m[1]);
        pinch = d; moved = 99;
      } else if (ids.length === 1 && last) {
        var s = toSvg(0, 0)[2];
        var dx = ev.clientX - last[0], dy = ev.clientY - last[1];
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6) {
          if (!svg.hasPointerCapture(ev.pointerId)) svg.setPointerCapture(ev.pointerId);
          svg.classList.add("dragging");
          vb[0] -= dx * s; vb[1] -= dy * s; apply();
        }
        last = [ev.clientX, ev.clientY];
      }
    });
    function end(ev) {
      delete pointers[ev.pointerId];
      if (Object.keys(pointers).length < 2) pinch = null;
      if (!Object.keys(pointers).length) { last = null; svg.classList.remove("dragging"); }
    }
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    // A drag must not open the brand under the finger
    svg.addEventListener("click", function (ev) { if (moved > 6) { ev.preventDefault(); moved = 0; } }, true);
  }

  // Model sheets: a link marked data-sheet opens the model page's <article class="sheet"> in a dialog over
  // the current page, and the address bar shows the model page so it can be shared or reloaded. The sheet is
  // read from this same site only (the page's Content-Security-Policy allows nothing else). If anything fails
  // (old browser, file:// preview, network), the link simply opens the model page.
  // Showcase effects: reveal on scroll, counters, pointer spotlight. All optional:
  // without this script the content is simply shown as it is, and reduced motion skips the effects.
  function setupShowcase() {
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var counters = document.querySelectorAll("[data-count]");
    function count(el) {
      var end = parseInt(el.getAttribute("data-count"), 10), t0 = null,
        from = parseInt(el.getAttribute("data-from") || "0", 10), plain = el.hasAttribute("data-plain");
      if (still || !end || !window.requestAnimationFrame) return;
      function step(t) {
        if (t0 === null) t0 = t;
        var k = Math.min(1, (t - t0) / 1400), eased = 1 - Math.pow(1 - k, 3),
          v = Math.round(from + (end - from) * eased);
        el.textContent = plain ? String(v) : v.toLocaleString(document.documentElement.lang === "fr" ? "fr" : "en");
        if (k < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }
    var shown = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && !still) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add("is-in");
          if (en.target.hasAttribute("data-count")) count(en.target);
          io.unobserve(en.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
      shown.forEach(function (el) { io.observe(el); });
      counters.forEach(function (el) { io.observe(el); });
    } else {
      shown.forEach(function (el) { el.classList.add("is-in"); });
    }
    if (still) return;
    // a soft light under the pointer on cards and in the home hero
    document.addEventListener("pointermove", function (ev) {
      var el = ev.target.closest && ev.target.closest(".brand-card a, .story-tile, .country-tile, .model, .home-hero, .page-head--brand");
      if (!el) return;
      var r = el.getBoundingClientRect(),
        box = el.querySelector(":scope > .wall-veil, :scope > .head-bg") || el;
      if (!box) return;
      box.style.setProperty("--mx", (ev.clientX - r.left) + "px");
      box.style.setProperty("--my", (ev.clientY - r.top) + "px");
    }, { passive: true });
  }

  function setupSheets() {
    var links = document.querySelectorAll("a[data-sheet]");
    if (!links.length || !window.fetch || !window.DOMParser || typeof HTMLDialogElement !== "function") return;
    var dialog = document.createElement("dialog");
    dialog.className = "sheet-dialog";
    dialog.setAttribute("aria-label", "Model sheet");
    document.body.appendChild(dialog);
    var opener = null;         // link to focus again on close

    function absolutize(root, base) {
      root.querySelectorAll("[src],[href]").forEach(function (el) {
        ["src", "href"].forEach(function (attr) {
          var v = el.getAttribute(attr);
          if (v && !/^(#|[a-z]+:)/i.test(v)) el.setAttribute(attr, new URL(v, base).href);
        });
      });
    }
    function show(article, url, push) {
      dialog.innerHTML = "";
      dialog.appendChild(article);
      document.documentElement.classList.add("sheet-open");
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
      if (push) history.pushState({ sheet: url }, "", url);
      var title = article.querySelector("h1");
      if (title) document.title = title.textContent + " · Automotive Spirit";
      article.querySelectorAll("[data-print]").forEach(function (b) { b.hidden = false; });
      var close = article.querySelector(".sheet-close");
      if (close) {
        close.addEventListener("click", function (ev) { ev.preventDefault(); closeSheet(); });
        close.focus();
      }
    }
    function load(url, push) {
      return fetch(url, { credentials: "same-origin", redirect: "error" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (text) {
          var doc = new DOMParser().parseFromString(text, "text/html");
          var article = doc.querySelector("article.sheet");
          if (!article) throw new Error("no sheet");
          absolutize(article, url);
          show(document.importNode(article, true), url, push);
        });
    }
    var baseTitle = document.title;
    function hide() {
      if (dialog.open) dialog.close();
      dialog.innerHTML = "";
      document.documentElement.classList.remove("sheet-open");
      document.title = baseTitle;
      if (opener) opener.focus();
    }
    function closeSheet() {
      if (history.state && history.state.sheet) history.back();   // popstate hides it
      else hide();
    }
    links.forEach(function (a) {
      a.addEventListener("click", function (ev) {
        if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        var url = new URL(a.getAttribute("href"), location.href);
        if (url.origin !== location.origin || location.protocol === "file:") return;
        ev.preventDefault();
        opener = a;
        load(url.href, true).catch(function () { location.href = url.href; });
      });
    });
    dialog.addEventListener("cancel", function (ev) { ev.preventDefault(); closeSheet(); });   // Escape
    dialog.addEventListener("click", function (ev) { if (ev.target === dialog) closeSheet(); }); // outside the sheet
    window.addEventListener("popstate", function (ev) {
      if (ev.state && ev.state.sheet) {
        load(ev.state.sheet, false).catch(function () { location.reload(); });
      } else if (dialog.open) {
        hide();
      }
    });
  }
})();
