/* EHBO Depot · app.js
   Winkelwagen (localStorage), zoeken, megamenu, taalswitch NL/EN,
   categoriefilters, productdetail, checkout. */
(function () {
  "use strict";
  var P = window.EHBO_PRODUCTS || [];
  var CATS = window.EHBO_CATS || {};
  var SHIP = window.EHBO_SHIPPING || { cost: 7.95, freeFrom: 100 };
  var ROOT = document.body.getAttribute("data-root") || "";
  var byId = {};
  P.forEach(function (p) { byId[p.id] = p; });

  /* ---------- taal ---------- */
  var LANG = localStorage.getItem("ehbodepot_lang") || "nl";
  var EN = window.EHBO_EN || {};
  function T(key, nlFallback) {
    if (LANG === "en" && EN[key]) return EN[key];
    return nlFallback;
  }
  function applyLang() {
    document.documentElement.lang = LANG;
    var btn = document.getElementById("lang-label");
    if (btn) btn.textContent = LANG === "nl" ? "EN" : "NL";
    if (LANG === "en") {
      document.querySelectorAll("[data-i18n]").forEach(function (el) {
        var k = el.getAttribute("data-i18n");
        if (EN[k] !== undefined) el.innerHTML = EN[k];
      });
      document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
        var k = el.getAttribute("data-i18n-ph");
        if (EN[k] !== undefined) el.setAttribute("placeholder", EN[k]);
      });
      // lange NL SEO-blokken op categoriepaginas verbergen in de Engelse weergave
      document.querySelectorAll(".cat-seo").forEach(function (el) { el.style.display = "none"; });
    }
  }
  var langBtn = document.getElementById("lang-btn");
  if (langBtn) langBtn.addEventListener("click", function () {
    localStorage.setItem("ehbodepot_lang", LANG === "nl" ? "en" : "nl");
    location.reload();
  });

  /* ---------- helpers ---------- */
  function fmt(v) {
    return v.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function excl(p) { return p.price / (1 + p.vat / 100); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function catName(slug) {
    var c = CATS[slug];
    if (!c) return slug;
    return LANG === "en" ? c.en : c.nl;
  }
  function mediaHTML(p, cls) {
    if (p.img) return '<img src="' + ROOT + "assets/img/products/" + p.img + '" alt="' + esc(p.name) + '" loading="lazy">';
    return '<span class="ph-icon ' + (cls || "") + '" aria-hidden="true"><svg class="icon"><use href="#ic-' + p.cat + '"/></svg></span>';
  }
  function badgeHTML(p) {
    if (p.bundle) return '<span class="pcard-badge badge-green">' + T("ui.badge.bundle", "Voordeelpakket") + "</span>";
    if (p.pop >= 8) return '<span class="pcard-badge">' + T("ui.badge.bestseller", "Bestseller") + "</span>";
    return "";
  }
  function cardHTML(p) {
    var priceH, btnH;
    if (p.price != null) {
      priceH = '<div class="price"><strong>&euro; ' + fmt(p.price) + "</strong>" +
        '<span class="price-sub">' + T("ui.inclprefix", "incl. btw &middot;") + " &euro; " + fmt(excl(p)) + " " + T("ui.exclsuffix", "excl.") + "</span></div>";
      btnH = '<button class="btn btn-add" data-add="' + p.id + '" type="button"><svg class="icon"><use href="#ic-cart"/></svg><span>' + T("ui.addtocart", "In winkelwagen") + "</span></button>";
    } else {
      priceH = '<div class="price"><strong>' + T("ui.onrequest", "Prijs op aanvraag") + "</strong></div>";
      btnH = '<a class="btn btn-add btn-outline" href="' + ROOT + "offerte.html?product=" + p.id + '"><span>' + T("ui.requestquote", "Offerte aanvragen") + "</span></a>";
    }
    var brand = p.brand ? '<span class="card-brand">' + esc(p.brand) + "</span>" : "";
    return '<article class="pcard" data-id="' + p.id + '">' + badgeHTML(p) +
      '<a class="pcard-media" href="' + ROOT + "product/" + p.id + '.html">' + mediaHTML(p) + "</a>" +
      '<div class="pcard-body">' + brand +
      '<h3 class="pcard-title"><a href="' + ROOT + "product/" + p.id + '.html">' + esc(p.name) + "</a></h3>" +
      priceH + btnH + "</div></article>";
  }

  /* ---------- megamenu ---------- */
  var mega = document.getElementById("mega-cats");
  if (mega) {
    var counts = {};
    P.forEach(function (p) { counts[p.cat] = (counts[p.cat] || 0) + 1; });
    var order = Object.keys(CATS);
    mega.innerHTML = order.map(function (slug) {
      var n = counts[slug] || 0;
      if (!n) return "";
      return '<a class="mega-link" href="' + ROOT + "categorie/" + slug + '.html">' +
        '<span class="mega-ic"><svg class="icon"><use href="#ic-' + slug + '"/></svg></span>' +
        "<span>" + esc(catName(slug)) + "<small>" + n + " " + T("ui.products", "producten") + "</small></span></a>";
    }).join("");
  }

  /* ---------- mobiel menu ---------- */
  var burger = document.getElementById("nav-burger");
  var nav = document.getElementById("main-nav");
  if (burger && nav) {
    burger.addEventListener("click", function () { nav.classList.toggle("open"); });
    nav.addEventListener("click", function (e) {
      if (e.target === nav) nav.classList.remove("open");
      var link = e.target.closest && e.target.closest(".has-mega > .nav-link, .has-drop > .nav-link");
      if (link && window.matchMedia("(max-width:860px)").matches) {
        e.preventDefault();
        link.parentElement.classList.toggle("m-open");
      }
    });
  }

  /* ---------- winkelwagen ---------- */
  function getCart() {
    try { return JSON.parse(localStorage.getItem("ehbodepot_cart") || "[]"); }
    catch (e) { return []; }
  }
  function setCart(c) {
    localStorage.setItem("ehbodepot_cart", JSON.stringify(c));
    updateBadge();
  }
  function addToCart(id, qty) {
    var c = getCart();
    var row = c.find(function (r) { return r.id === id; });
    if (row) row.qty += qty; else c.push({ id: id, qty: qty });
    setCart(c);
  }
  function cartCount() {
    return getCart().reduce(function (s, r) { return s + r.qty; }, 0);
  }
  function updateBadge() {
    var el = document.getElementById("cart-count");
    if (!el) return;
    var n = cartCount();
    el.hidden = n === 0;
    el.textContent = n > 99 ? "99+" : n;
  }
  var toastTimer = null;
  function toast(html) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.innerHTML = '<svg class="icon"><use href="#ic-check"/></svg><span>' + html + "</span>";
    t.hidden = false;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3400);
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-add]");
    if (!btn) return;
    var id = btn.getAttribute("data-add");
    var qty = 1;
    var qi = btn.getAttribute("data-qty-input");
    if (qi) qty = Math.max(1, parseInt(document.getElementById(qi).value, 10) || 1);
    if (!byId[id]) return;
    addToCart(id, qty);
    toast(esc(byId[id].name) + " " + T("ui.added", "toegevoegd") +
      ' &middot; <a href="' + ROOT + 'winkelwagen.html">' + T("ui.viewcart", "Bekijk winkelwagen") + "</a>");
  });
  updateBadge();

  /* ---------- qty-knoppen (productdetail) ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".qty-btn");
    if (!b) return;
    var input = b.parentElement.querySelector("input");
    if (!input) return;
    var v = Math.max(1, Math.min(999, (parseInt(input.value, 10) || 1) + parseInt(b.getAttribute("data-qty"), 10)));
    input.value = v;
    if (input.hasAttribute("data-cart-id")) {
      var c = getCart();
      var row = c.find(function (r) { return r.id === input.getAttribute("data-cart-id"); });
      if (row) { row.qty = v; setCart(c); renderCartPage(); }
    }
  });

  /* ---------- zoeken ---------- */
  var input = document.getElementById("search-input");
  var drop = document.getElementById("search-drop");
  function searchProducts(q, limit) {
    q = q.toLowerCase().trim();
    if (!q) return [];
    var terms = q.split(/\s+/);
    var scored = [];
    P.forEach(function (p) {
      var hay = (p.name + " " + (p.brand || "") + " " + p.sub + " " + catName(p.cat)).toLowerCase();
      var score = 0;
      var ok = terms.every(function (t) { return hay.indexOf(t) !== -1; });
      if (!ok) return;
      if (p.name.toLowerCase().indexOf(q) === 0) score += 40;
      else if (p.name.toLowerCase().indexOf(q) !== -1) score += 20;
      score += p.pop || 0;
      scored.push([score, p]);
    });
    scored.sort(function (a, b) { return b[0] - a[0]; });
    return scored.slice(0, limit || 8).map(function (x) { return x[1]; });
  }
  if (input && drop) {
    input.addEventListener("input", function () {
      var q = input.value;
      if (q.trim().length < 2) { drop.hidden = true; return; }
      var hits = searchProducts(q, 7);
      if (!hits.length) {
        drop.innerHTML = '<div class="search-hit"><span class="search-hit-name">' + T("ui.noresults", "Geen producten gevonden") + "</span></div>";
        drop.hidden = false;
        return;
      }
      drop.innerHTML = hits.map(function (p) {
        var price = p.price != null ? "&euro; " + fmt(p.price) : T("ui.onrequest.short", "op aanvraag");
        return '<a class="search-hit" href="' + ROOT + "product/" + p.id + '.html">' + mediaHTML(p) +
          '<span class="search-hit-name">' + esc(p.name) + '</span><span class="search-hit-price">' + price + "</span></a>";
      }).join("") +
        '<a class="search-all" href="' + ROOT + "assortiment.html?q=" + encodeURIComponent(q) + '">' +
        T("ui.allresults", "Alle resultaten bekijken") + " &rsaquo;</a>";
      drop.hidden = false;
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        location.href = ROOT + "assortiment.html?q=" + encodeURIComponent(input.value);
      }
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest("#head-search")) drop.hidden = true;
    });
  }

  /* ---------- categoriepagina: filter + sortering ---------- */
  var catGrid = document.getElementById("cat-grid");
  if (catGrid) {
    var chips = document.querySelectorAll("[data-filter-sub]");
    var sortSel = document.getElementById("sort-select");
    function applyCat() {
      var active = document.querySelector(".chip.is-active");
      var sub = active ? active.getAttribute("data-filter-sub") : "*";
      var cards = Array.prototype.slice.call(catGrid.querySelectorAll(".pcard"));
      var mode = sortSel ? sortSel.value : "pop";
      cards.sort(function (a, b) {
        var pa = byId[a.getAttribute("data-id")], pb = byId[b.getAttribute("data-id")];
        if (!pa || !pb) return 0;
        if (mode === "price-asc") return (pa.price == null) - (pb.price == null) || (pa.price || 0) - (pb.price || 0);
        if (mode === "price-desc") return (pa.price == null) - (pb.price == null) || (pb.price || 0) - (pa.price || 0);
        if (mode === "name") return pa.name.localeCompare(pb.name, "nl");
        return (pb.pop || 0) - (pa.pop || 0) || pa.name.localeCompare(pb.name, "nl");
      });
      cards.forEach(function (el) {
        var p = byId[el.getAttribute("data-id")];
        el.style.display = (sub === "*" || (p && p.sub === sub)) ? "" : "none";
        catGrid.appendChild(el);
      });
    }
    chips.forEach(function (ch) {
      ch.addEventListener("click", function () {
        document.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-active"); });
        ch.classList.add("is-active");
        applyCat();
      });
    });
    if (sortSel) sortSel.addEventListener("change", applyCat);
  }

  /* ---------- productdetail: gerelateerd ---------- */
  var rel = document.getElementById("related-grid");
  if (rel) {
    var pid = rel.getAttribute("data-related");
    var cur = byId[pid];
    if (cur) {
      var same = P.filter(function (p) { return p.cat === cur.cat && p.id !== pid && p.price != null; });
      same.sort(function (a, b) {
        var sa = (a.sub === cur.sub ? 100 : 0) + (a.pop || 0);
        var sb = (b.sub === cur.sub ? 100 : 0) + (b.pop || 0);
        return sb - sa;
      });
      rel.innerHTML = same.slice(0, 4).map(cardHTML).join("");
      if (!same.length) { var sec = rel.closest(".pd-related"); if (sec) sec.style.display = "none"; }
    }
  }

  /* ---------- winkelwagenpagina ---------- */
  function renderCartPage() {
    var wrap = document.getElementById("cart-page");
    if (!wrap) return;
    var c = getCart().filter(function (r) { return byId[r.id]; });
    var itemsEl = document.getElementById("cart-items");
    var sideEl = document.getElementById("cart-summary");
    var emptyEl = document.getElementById("cart-empty");
    var formWrap = document.getElementById("checkout-wrap");
    if (!c.length) {
      if (emptyEl) emptyEl.hidden = false;
      if (itemsEl) itemsEl.innerHTML = "";
      if (sideEl) sideEl.parentElement.style.display = "none";
      if (formWrap) formWrap.style.display = "none";
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    var sub = 0, vatTotal = 0;
    itemsEl.innerHTML = c.map(function (r) {
      var p = byId[r.id];
      var line = p.price * r.qty;
      sub += line;
      vatTotal += line - line / (1 + p.vat / 100);
      return '<div class="cart-row">' +
        '<a class="cart-row-media" href="' + ROOT + "product/" + p.id + '.html">' + mediaHTML(p) + "</a>" +
        "<div><h3>" + esc(p.name) + '</h3><span class="unit">&euro; ' + fmt(p.price) + " " + T("ui.each", "per stuk") + " &middot; " + esc(p.sub) + "</span></div>" +
        '<div class="cart-row-right">' +
        '<div class="qty"><button type="button" class="qty-btn" data-qty="-1">&minus;</button><input type="number" min="1" max="999" value="' + r.qty + '" data-cart-id="' + p.id + '"><button type="button" class="qty-btn" data-qty="1">+</button></div>' +
        '<span class="cart-row-total">&euro; ' + fmt(line) + "</span>" +
        '<button class="cart-remove" data-remove="' + p.id + '" type="button">' + T("ui.remove", "Verwijderen") + "</button>" +
        "</div></div>";
    }).join("");
    var shipping = sub >= SHIP.freeFrom ? 0 : SHIP.cost;
    var total = sub + shipping;
    var freeLeft = SHIP.freeFrom - sub;
    var shipLabel = shipping === 0 ? '<strong style="color:var(--green-dark)">' + T("ui.free", "Gratis") + "</strong>" : "&euro; " + fmt(shipping);
    var progress = Math.min(100, Math.round((sub / SHIP.freeFrom) * 100));
    var freeMsg = shipping === 0
      ? "&#10003; " + T("ui.freeship.done", "U heeft gratis verzending")
      : T("ui.freeship.more1", "Nog") + " <strong>&euro; " + fmt(freeLeft) + "</strong> " + T("ui.freeship.more2", "tot gratis verzending");
    var staffelMsg = sub >= 250
      ? '<div class="freeship" style="background:#fdf3dd;color:#6b4a00">' +
        T("ui.staffel1", "Uw orderwaarde komt in aanmerking voor staffelkorting (5 tot 10%).") + " " +
        '<a href="' + ROOT + 'offerte.html">' + T("ui.staffel2", "Vraag de korting aan via een offerte") + "</a> " +
        T("ui.staffel3", "of vermeld “staffelkorting” bij de opmerkingen, dan verwerken wij die in de factuur.") + "</div>"
      : "";
    sideEl.innerHTML =
      '<div class="cart-line"><span>' + T("ui.subtotal", "Subtotaal") + "</span><span>&euro; " + fmt(sub) + "</span></div>" +
      '<div class="cart-line"><span>' + T("ui.shipping", "Verzendkosten") + "</span><span>" + shipLabel + "</span></div>" +
      '<div class="freeship">' + freeMsg + '<div class="bar"><i style="width:' + progress + '%"></i></div></div>' +
      staffelMsg +
      '<div class="cart-line total"><span>' + T("ui.total", "Totaal") + "</span><span>&euro; " + fmt(total) + "</span></div>" +
      '<div class="cart-line"><small>' + T("ui.vatincluded", "Waarvan btw") + "</small><small>&euro; " + fmt(vatTotal) + "</small></div>";
    var orderField = document.getElementById("order-field");
    if (orderField) {
      orderField.value = c.map(function (r) {
        var p = byId[r.id];
        return r.qty + "x " + p.name + " (" + p.id + ") a EUR " + fmt(p.price) + " = EUR " + fmt(p.price * r.qty);
      }).join("\n") +
        "\n\nSubtotaal: EUR " + fmt(sub) +
        "\nVerzending: " + (shipping === 0 ? "gratis" : "EUR " + fmt(shipping)) +
        "\nTotaal (incl. btw): EUR " + fmt(total);
    }
    var totField = document.getElementById("order-total-field");
    if (totField) totField.value = "EUR " + fmt(total);
  }
  document.addEventListener("click", function (e) {
    var rm = e.target.closest && e.target.closest("[data-remove]");
    if (!rm) return;
    setCart(getCart().filter(function (r) { return r.id !== rm.getAttribute("data-remove"); }));
    renderCartPage();
  });
  document.addEventListener("change", function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute("data-cart-id")) {
      var c = getCart();
      var row = c.find(function (r) { return r.id === e.target.getAttribute("data-cart-id"); });
      if (row) { row.qty = Math.max(1, parseInt(e.target.value, 10) || 1); setCart(c); renderCartPage(); }
    }
  });
  renderCartPage();

  /* ---------- assortimentpagina ---------- */
  var allGrid = document.getElementById("all-grid");
  if (allGrid) {
    var params = new URLSearchParams(location.search);
    var q = params.get("q") || "";
    var activeCat = params.get("cat") || "*";
    var qInput = document.getElementById("assort-q");
    if (qInput) qInput.value = q;
    function renderAll() {
      var list = q.trim().length >= 2 ? searchProducts(q, 500) : P.slice().sort(function (a, b) { return (b.pop || 0) - (a.pop || 0) || a.name.localeCompare(b.name, "nl"); });
      if (activeCat !== "*") list = list.filter(function (p) { return p.cat === activeCat; });
      var cnt = document.getElementById("assort-count");
      if (cnt) cnt.textContent = list.length;
      allGrid.innerHTML = list.map(cardHTML).join("") ||
        '<p style="grid-column:1/-1;color:var(--mut)">' + T("ui.noresults", "Geen producten gevonden") + "</p>";
    }
    document.querySelectorAll("[data-cat-filter]").forEach(function (ch) {
      if (ch.getAttribute("data-cat-filter") === activeCat) {
        document.querySelectorAll("[data-cat-filter]").forEach(function (x) { x.classList.remove("is-active"); });
        ch.classList.add("is-active");
      }
      ch.addEventListener("click", function () {
        activeCat = ch.getAttribute("data-cat-filter");
        document.querySelectorAll("[data-cat-filter]").forEach(function (x) { x.classList.remove("is-active"); });
        ch.classList.add("is-active");
        renderAll();
      });
    });
    if (qInput) qInput.addEventListener("input", function () { q = qInput.value; renderAll(); });
    renderAll();
  }

  /* ---------- home: bestsellers ---------- */
  var best = document.getElementById("best-grid");
  if (best) {
    var picks = P.filter(function (p) { return p.price != null; })
      .sort(function (a, b) { return (b.pop || 0) - (a.pop || 0); }).slice(0, 8);
    best.innerHTML = picks.map(cardHTML).join("");
  }
  var bundleGrid = document.getElementById("bundle-grid");
  if (bundleGrid) {
    var bundles = P.filter(function (p) { return p.cat === "pakketten"; }).slice(0, 4);
    bundleGrid.innerHTML = bundles.map(cardHTML).join("");
  }

  /* ---------- offerte: voorgeselecteerd product + checklist-advies ---------- */
  var quoteProd = document.getElementById("quote-product");
  if (quoteProd) {
    var qp = new URLSearchParams(location.search).get("product");
    if (qp && byId[qp]) quoteProd.value = byId[qp].name + " (" + qp + ")";
    var advies = localStorage.getItem("ehbodepot_advies");
    if (advies) {
      var form = quoteProd.closest("form");
      var ta = form && form.querySelector("textarea:not([name='_honey'])");
      if (ta && !ta.value) ta.value = advies;
    }
  }

  /* ---------- checkout: bedrijfsnaam verplicht bij factuurbestelling ---------- */
  var coType = document.getElementById("co-type");
  var coCompany = document.getElementById("co-company");
  if (coType && coCompany) {
    var coLabel = document.querySelector('label[for="co-company"]');
    function syncCompanyRequired() {
      var biz = coType.value === "zakelijk";
      coCompany.required = biz;
      if (coLabel) {
        var base = coLabel.textContent.replace(/\s*\*\s*$/, "");
        coLabel.textContent = biz ? base + " *" : base;
      }
    }
    coType.addEventListener("change", syncCompanyRequired);
    setTimeout(syncCompanyRequired, 0); // na de taal-pass, zodat het sterretje blijft staan
  }

  /* ---------- pagina-specifieke init ---------- */
  applyLang();
  if (typeof window.EHBO_INIT === "function") {
    try { window.EHBO_INIT({ products: P, cats: CATS, T: T, fmt: fmt, cardHTML: cardHTML, addToCart: addToCart, searchProducts: searchProducts, toast: toast, root: ROOT, lang: LANG }); } catch (err) { console.error(err); }
  }
})();
