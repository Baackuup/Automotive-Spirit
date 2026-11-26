/* Automotive Spirit: instant search over brands, models, countries and stories.
   Reads search.json from this same site the first time the search opens; the query never leaves the page.
   Without JavaScript the "Search" link opens the catalog. */
(function () {
  "use strict";
  var link = document.querySelector("a.search-link[data-search]");
  if (!link || !window.HTMLDialogElement) return;
  var indexUrl = new URL(link.getAttribute("data-search"), location.href);
  var root = new URL(".", new URL(link.getAttribute("data-root"), location.href));
  var items = null, loading = null, dialog, input, list, status, active = -1, shown = [];
  var FR = document.documentElement.lang === "fr";
  var KIND = FR ? { b: "Marque", m: "Modèle", r: "Course", c: "Pays", s: "Histoire", p: "Plateforme" }
    : { b: "Brand", m: "Model", r: "Racing car", c: "Country", s: "Story", p: "Platform" };
  var TXT = FR ? { hint: "Tapez une marque, un modèle ou un pays.", loading: "Chargement…", none: "Aucun résultat.",
      one: " résultat", many: " résultats", for_: " pour ", place: "Chercher parmi 4 000 modèles, marques, pays…",
      label: "Rechercher sur le site" }
    : { hint: "Type a brand, a model or a country.", loading: "Loading…", none: "No result.", one: " result",
      many: " results", for_: " for ", place: "Search 4,000+ models, brands, countries…", label: "Search the site" };

  function fold(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  function load() {
    if (items) return Promise.resolve(items);
    if (location.protocol === "file:") return Promise.reject(new Error("file"));
    if (!loading) {
      loading = fetch(indexUrl.href, { credentials: "same-origin", redirect: "error" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) {
          items = data.map(function (it) { it.k = fold(it.n); it.w = fold(it.n + " " + it.s); return it; });
          return items;
        });
    }
    return loading;
  }

  function score(it, q, words) {
    for (var i = 0; i < words.length; i++) if (it.w.indexOf(words[i]) < 0) return -1;
    var s = 0;
    if (it.k === q) s += 100;
    else if (it.k.indexOf(q) === 0) s += 60;
    else if ((" " + it.k).indexOf(" " + words[0]) >= 0) s += 35;
    else if (it.k.indexOf(words[0]) >= 0) s += 15;
    if (it.t === "b") s += 25; else if (it.t === "c") s += 10; else if (it.t === "r") s -= 5;
    return s - it.k.length / 50;
  }

  function find(q, words) {
    var scored = [];
    items.forEach(function (it) { var s = score(it, q, words); if (s >= 0) scored.push([s, it]); });
    return scored;
  }

  function render(q) {
    list.textContent = "";
    active = -1;
    shown = [];
    q = fold(q.trim());
    if (!q || !items) { status.textContent = items ? TXT.hint : TXT.loading; return; }
    var words = q.split(/\s+/), note = "";
    var scored = find(q, words);
    if (!scored.length && words.length > 1) {
      // no page has every word ("golf gti"): drop words from the end until something matches, and say so
      for (var k = words.length - 1; k > 0 && !scored.length; k--) {
        var kept = words.slice(0, k);
        scored = find(kept.join(" "), kept);
        note = TXT.for_ + "“" + kept.join(" ") + "”";
      }
    }
    scored.sort(function (a, b) { return b[0] - a[0]; });
    shown = scored.slice(0, 12).map(function (x) { return x[1]; });
    status.textContent = scored.length ? scored.length + (scored.length > 1 ? TXT.many : TXT.one) + note : TXT.none;
    shown.forEach(function (it, i) {
      var li = document.createElement("li");
      li.id = "search-opt-" + i;
      li.setAttribute("role", "option");
      var a = document.createElement("a");
      a.href = new URL(it.u, root).href;
      a.tabIndex = -1;
      var name = document.createElement("span"); name.className = "search-name"; name.textContent = it.n;
      var sub = document.createElement("span"); sub.className = "search-sub"; sub.textContent = it.s;
      var tag = document.createElement("span"); tag.className = "search-kind search-kind--" + it.t; tag.textContent = KIND[it.t] || "";
      a.appendChild(tag); a.appendChild(name); a.appendChild(sub);
      li.appendChild(a);
      li.addEventListener("mousemove", function () { select(i); });
      list.appendChild(li);
    });
  }

  function select(i) {
    var opts = list.children;
    if (!opts.length) return;
    active = (i + opts.length) % opts.length;
    for (var j = 0; j < opts.length; j++) opts[j].setAttribute("aria-selected", j === active ? "true" : "false");
    input.setAttribute("aria-activedescendant", "search-opt-" + active);
    opts[active].scrollIntoView({ block: "nearest" });
  }

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "search-dialog";
    dialog.setAttribute("aria-label", TXT.label);
    var box = document.createElement("div"); box.className = "search-box";
    input = document.createElement("input");
    input.type = "search";
    input.placeholder = TXT.place;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-controls", "search-results");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    var esc = document.createElement("kbd"); esc.textContent = "Esc";
    box.appendChild(input); box.appendChild(esc);
    list = document.createElement("ul"); list.id = "search-results"; list.className = "search-results"; list.setAttribute("role", "listbox");
    status = document.createElement("p"); status.className = "search-status"; status.setAttribute("aria-live", "polite");
    dialog.appendChild(box); dialog.appendChild(status); dialog.appendChild(list);
    document.body.appendChild(dialog);
    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { ev.preventDefault(); select(active + 1); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); select(active - 1); }
      else if (ev.key === "Enter") {
        var a = list.children[active < 0 ? 0 : active];
        if (a) { ev.preventDefault(); location.href = a.querySelector("a").href; }
      }
    });
    dialog.addEventListener("click", function (ev) { if (ev.target === dialog) dialog.close(); });
  }

  function open() {
    if (!dialog) build();
    if (!dialog.open) dialog.showModal();
    input.select();
    render(input.value);
    load().then(function () { render(input.value); }, function () {
      location.href = link.href;            // no index (opened from disk): the catalog and its filters
    });
  }

  link.addEventListener("click", function (ev) {
    if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (location.protocol === "file:") return;
    ev.preventDefault();
    open();
  });
  document.addEventListener("keydown", function (ev) {
    var t = ev.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if ((ev.key === "/" && !typing) || ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k")) {
      if (location.protocol === "file:") return;
      ev.preventDefault();
      open();
    }
  });
  link.classList.add("is-live");
})();
