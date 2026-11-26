/* Automotive Spirit: compare two generations side by side (compare/index.html).
   Reads compare/<brand>.json from this same site when a brand is picked; the choice is kept in the address
   (?a=brand/model/generation&b=...) so it can be shared, and nowhere else. */
(function () {
  "use strict";
  var box = document.querySelector(".cmp[data-data]");
  if (!box) return;
  var dataDir = new URL(".", new URL(box.getAttribute("data-data"), location.href));
  var root = new URL(".", new URL(box.getAttribute("data-root"), location.href));
  var out = box.querySelector(".cmp-out"), cache = {};
  var LABELS = [["production", "Production"], ["body_style", "Body"], ["layout", "Layout"], ["engine", "Engines"],
    ["motor", "Electric motor"], ["battery", "Battery"], ["transmission", "Gearbox"], ["length", "Length"],
    ["width", "Width"], ["height", "Height"], ["wheelbase", "Wheelbase"], ["weight", "Weight"]];
  var BARS = { length: "mm", width: "mm", height: "mm", wheelbase: "mm", weight: "kg" };
  box.querySelector(".cmp-ideas").hidden = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function brandData(slug) {
    if (!cache[slug]) {
      var url = new URL(slug + ".json", dataDir);
      cache[slug] = fetch(url.href, { credentials: "same-origin", redirect: "error" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    }
    return cache[slug];
  }
  function fill(select, items, placeholder) {
    select.textContent = "";
    select.appendChild(new Option(placeholder, ""));
    items.forEach(function (it) { select.appendChild(new Option(it[1], it[0])); });
    select.disabled = !items.length;
  }
  var sides = {};
  box.querySelectorAll(".cmp-pick").forEach(function (fs) {
    var k = fs.getAttribute("data-side");
    var s = sides[k] = { brand: fs.querySelector("[name=brand]"), model: fs.querySelector("[name=model]"),
      gen: fs.querySelector("[name=gen]"), data: null };
    s.brand.addEventListener("change", function () { pickBrand(k, null, null); });
    s.model.addEventListener("change", function () { pickModel(k, null); });
    s.gen.addEventListener("change", update);
  });
  function pickBrand(k, model, gen) {
    var s = sides[k];
    fill(s.model, [], "—"); fill(s.gen, [], "—"); s.data = null;
    if (!s.brand.value) { update(); return Promise.resolve(); }
    s.model.disabled = true;
    return brandData(s.brand.value).then(function (d) {
      s.data = d;
      fill(s.model, d.m.map(function (m) { return [m.s, m.t + (m.k === "racing" ? " (racing)" : "")]; }), "Choose a model");
      if (model) { s.model.value = model; return pickModel(k, gen); }
      update();
    }).catch(function () { out.textContent = "The figures could not be read. Each model's sheet gives them."; });
  }
  function current(k) {
    var s = sides[k];
    if (!s.data) return null;
    var m = s.data.m.filter(function (x) { return x.s === s.model.value; })[0];
    return m ? { m: m, i: s.gen.value === "" ? -1 : +s.gen.value } : null;
  }
  function pickModel(k, gen) {
    var s = sides[k], c = current(k);
    fill(s.gen, c ? c.m.g.map(function (g, i) { return [String(i), g.l + (g.y ? " · " + g.y : "")]; }) : [], c ? "Choose a generation" : "—");
    if (c) {
      var n = c.m.g.length, i = gen == null ? n - 1 : (+gen < 0 ? n + +gen : +gen);
      s.gen.value = String(Math.max(0, Math.min(n - 1, i)));
    }
    update();
  }
  function num(list) {
    var m = list && list.join(" ").replace(/,(\d{3})/g, "$1").match(/(\d+(?:\.\d+)?)(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*(mm|kg|in|lb)/);
    if (!m) return null;
    var v = parseFloat(m[1]);
    if (m[2] === "in") v *= 25.4; else if (m[2] === "lb") v *= 0.4536;
    return v;
  }
  function card(c) {
    var g = c.m.g[c.i], art = el("article", "cmp-card");
    var fig = el("figure", "cmp-photo");
    if (g.p) {
      var img = el("img"); img.src = new URL(g.p.f, root).href; img.alt = c.m.t + ", " + g.l;
      img.width = g.p.w; img.height = g.p.h; fig.appendChild(img);
      fig.appendChild(el("figcaption", null, "Photo: " + g.p.a + " · " + g.p.l));
    } else {
      fig.appendChild(el("p", "cmp-nophoto", "No free photo yet"));
    }
    art.appendChild(fig);
    var h = el("h2"); var a = el("a", null, c.m.t); a.href = new URL(c.m.u, root).href; h.appendChild(a); art.appendChild(h);
    art.appendChild(el("p", "cmp-gen", g.l + (g.y ? " · " + g.y : "")));
    return art;
  }
  function update() {
    var A = current("a"), B = current("b");
    var q = [];
    ["a", "b"].forEach(function (k) {
      var c = current(k);
      if (c && c.i >= 0) q.push(k + "=" + sides[k].brand.value + "/" + c.m.s + "/" + c.i);
    });
    history.replaceState(null, "", location.pathname + (q.length ? "?" + q.join("&") : ""));
    out.textContent = "";
    if (!A || !B || A.i < 0 || B.i < 0) {
      if (A || B) out.appendChild(el("p", "muted", "Pick the second car to see them side by side."));
      return;
    }
    var ga = A.m.g[A.i], gb = B.m.g[B.i];
    var head = el("div", "cmp-cards"); head.appendChild(card(A)); head.appendChild(el("span", "cmp-vs", "vs")); head.appendChild(card(B));
    out.appendChild(head);
    var table = el("table", "cmp-table");
    var cap = el("caption", "visually-hidden", A.m.t + " compared with " + B.m.t); table.appendChild(cap);
    var cols = el("colgroup");
    ["cmp-col-head", "", ""].forEach(function (c) { cols.appendChild(el("col", c || null)); });
    table.appendChild(cols);
    var tb = el("tbody");
    LABELS.forEach(function (lb) {
      var fa = ga.f[lb[0]], fb = gb.f[lb[0]];
      if (!fa && !fb) return;
      var tr = el("tr"); tr.appendChild(el("th", null, lb[1]));
      var va = num(fa), vb = num(fb), max = Math.max(va || 0, vb || 0);
      [[fa, va], [fb, vb]].forEach(function (x, j) {
        var td = el("td");
        (x[0] || ["—"]).forEach(function (line) { td.appendChild(el("span", "cmp-line", line)); });
        if (BARS[lb[0]] && x[1] && va && vb) {
          var bar = el("span", "cmp-bar" + (x[1] === max && va !== vb ? " cmp-bar--max" : ""));
          bar.style.setProperty("--w", (x[1] / max * 100).toFixed(1) + "%");
          td.appendChild(bar);
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    out.appendChild(table);
    var src = el("p", "muted small");
    src.appendChild(document.createTextNode("Sources: "));
    [ga, gb].forEach(function (g, j) {
      var a = el("a", null, g.s.t); a.href = g.s.u; a.rel = "noopener noreferrer";
      if (j) src.appendChild(document.createTextNode(" · "));
      src.appendChild(a);
    });
    src.appendChild(document.createTextNode(". Bars compare the first figure given for each car."));
    out.appendChild(src);
  }
  // the choice in the address (?a=brand/model/generation&b=...), e.g. from a link "Try: …"
  function restore() {
    var params = new URLSearchParams(location.search);
    ["a", "b"].forEach(function (k) {
      var v = (params.get(k) || "").split("/");
      var s = sides[k];
      if (v.length === 3 && s.brand.querySelector('option[value="' + v[0].replace(/[^a-z0-9-]/g, "") + '"]')) {
        s.brand.value = v[0];
        pickBrand(k, v[1], v[2]);
      }
    });
  }
  box.querySelectorAll(".cmp-ideas a").forEach(function (a) {
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      history.replaceState(null, "", a.getAttribute("href"));
      restore();
    });
  });
  restore();
})();
