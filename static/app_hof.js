// Obsonare – Hofläden & Märkte (keine Karte). Oben «Am nächsten» und «Lieblings», dann Spezialmärkte der nächsten Wochen,
// dann nach Art (Wochenmärkte, Hofläden, Bio-Läden, Hofautomaten; Joshua 17.11.): pro Ort eine Zeile mit Zustand, Wochenzeiten klein,
// Umkreis wählbar. Unten ein kleiner Knopf «Google-Suche» als Zusatz. «Route» öffnet Apple Karten (iPhone) bzw. Google Maps.
// Daten: static/hoflaeden.js (OpenStreetMap, tools/update_hoflaeden.mjs) und static/maerkte_spezial.js (von Hand). Regeln: core.js.
// Standort: nur nach Knopfdruck «Standort verwenden»; bleibt im Speicher, wird nie gesendet oder gespeichert (nur ja/nein pro Handy).
// Lieblinge: pro WG gemeinsam in den WG-Einstellungen (favMarkets). Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { state, $, esc, toast, CORE, load, save, STORE } = app;
  const RAPPERSWIL = { lat: 47.2267, lon: 8.8184 }; // ohne Standort: von hier aus gemessen
  const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const KIND = { hof: "Hofladen", markt: "Markt" };
  const DATA = () => (window.BF_HOF && window.BF_HOF.items) || [];
  const SPECIAL = () => (window.BF_SPECIAL && window.BF_SPECIAL.items) || [];
  const ref = () => state.hof.ref || RAPPERSWIL;
  const favs = () => load(STORE.KEYS.FAV_KEY, []) || [];
  const ios = () => document.documentElement.classList.contains("glass");
  const kmText = km => (km < 1 ? `${Math.round(km * 1000 / 50) * 50} m` : `${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`);
  const dayText = (d, now) => {
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const k = Math.round((d - t) / 864e5);
    return `${WD[(d.getDay() + 6) % 7]} ${d.getDate()}.${d.getMonth() + 1}.${k === 0 ? " · heute" : k === 1 ? " · morgen" : ""}`;
  };

  const star = (key, on) => `<button type="button" class="hofstar" data-fav="${esc(key)}" aria-pressed="${on}" aria-label="${on ? "Lieblingsort entfernen" : "Als Lieblingsort merken"}">${on ? "★" : "☆"}</button>`;
  const route = it => `<a class="hofroute" href="${esc(CORE.routeUrl(it, ios()))}" target="_blank" rel="noopener">Route</a>`;
  const stText = it => (it.state ? (it.state.open || /^(öffnet \d|Saisonpause)/.test(it.state.text) ? it.state.text : `heute zu · ${it.state.text}`) : "Zeiten unbekannt");

  function card(label, it, empty, fav, now) {
    if (!it) return `<div class="hofcard"><small>${label}</small><p class="hint">${empty}</p></div>`;
    return `<div class="hofcard"><small>${label}</small>
      <div class="hofrow"><b>${esc(it.n)}</b>${star(it.key, fav.includes(it.key))}</div>
      <span class="st${it.state && it.state.open ? " open" : ""}">${esc(stText(it))}</span>
      <small>${esc(CORE.hoursText(it.oh, now))}</small>
      <small>${esc(KIND[it.k] || "")}${it.ort ? ` · ${esc(it.ort)}` : ""} · ${kmText(it.km)}</small>
      <div class="hofact">${route(it)}${it.web ? `<a class="hofroute" href="${esc(it.web)}" target="_blank" rel="noopener">Webseite</a>` : ""}</div></div>`;
  }

  function renderHof() {
    const now = new Date(), r = ref(), fav = favs(), items = DATA();
    const stand = window.BF_HOF && window.BF_HOF.stand ? ` · Stand ${window.BF_HOF.stand.split("-").reverse().join(".")}` : "";
    $("hofSub").textContent = `Entfernung ${state.hof.ref ? "ab deinem Standort" : "ab Rapperswil-Jona"}${stand}`;
    $("hofGeo").hidden = !!state.hof.ref;
    $("hofNote").textContent = "Öffnungszeiten aus OpenStreetMap (© OpenStreetMap-Mitwirkende, ODbL)" + (items.some(i => i.src === "discover") ? " und discover.swiss (CC BY-SA, Tourismus-Partner)" : "") + " – können veraltet sein. Die besonderen Märkte pflegen wir von Hand.";
    const mapUrl = load(STORE.KEYS.MAPS_URL_KEY, "");
    const layers = CORE.kmlLayers(DATA(), SPECIAL(), now);
    $("hofAll").innerHTML = (mapUrl ? `<a class="btn" href="${esc(mapUrl)}" target="_blank" rel="noopener">Alle in Google Maps</a>` : "")
      + `<details><summary>${mapUrl ? "Karte in Google «Meine Karten» erneuern" : "Alle Märkte in Google Maps?"}</summary>
        <ol class="hint"><li>Unten je Art «Exportieren» (oder «Alle») und die Dateien speichern.</li><li>In «Meine Karten» (google.com/maps/d): Ebene hinzufügen → Importieren, je Datei eine Ebene (jede hat ein Häkchen).</li><li>Den Link der Karte in den Einstellungen bei «Karte Märkte» eintragen.</li></ol>
        ${layers.map(l => `<div class="hofrow"><span>${esc(l.name)} <small>${l.count} Orte</small></span><button type="button" class="hofroute" data-kml="${l.key}">Exportieren</button></div>`).join("")}
        <div class="hofrow"><span>Alle zusammen</span><button type="button" class="hofroute" id="hofKml">Alle exportieren</button></div></details>`;
    const favIt = CORE.favFarm(items, fav, r, now);
    $("hofCards").innerHTML = card("Am nächsten", CORE.nearestFarm(items, r, now, favIt && favIt.key), "Keine Orte mit Öffnungszeiten.", fav, now)
      + card("Lieblings", favIt, "Tippe bei einem Ort auf ☆, dann steht er hier.", fav, now);
    // Saisongemüse des Monats (gleiche Daten wie «Rezepte & Saison»); was ein einzelner Hofladen verkauft, wissen wir nicht
    const veg = CORE.seasonVeg((app.DATA && app.DATA.season_items) || [], now.getMonth() + 1, it => app.vegLook(it)[0]);
    $("hofSeason").innerHTML = veg.length ? `<div class="hofvegs"><b>Jetzt Saison:</b> ${esc(veg.slice(0, 6).join(" · "))}${veg.length > 6 ? ` <details><summary>mehr</summary>${esc(veg.slice(6).join(" · "))}</details>` : ""}</div>
      <small>Was es auf dem Markt gibt, kann abweichen · <a href="https://www.gemuese.ch/" target="_blank" rel="noopener">Saisonkalender: gemuese.ch</a></small>` : "";
    const sp = CORE.specialUpcoming(SPECIAL(), { ref: r, now });
    $("hofSpecial").innerHTML = sp.length ? `<h3>Bald: besondere Märkte</h3>` + sp.map(e => `<div class="hofsp">
        <div class="hofrow"><b>${esc(e.n)}</b><span class="st${e.today ? " open" : ""}">${esc(dayText(e.first, now))}${e.count > 1 ? ` bis ${e.last.getDate()}.${e.last.getMonth() + 1}.` : ""}</span></div>
        <small>${esc(e.ort)} · ${esc(e.zeit || "")} · ${kmText(e.km)}${e.pruefen ? " · <b>Datum prüfen</b>" : ""}</small>
        <div class="hofact">${route(e)}${e.web ? `<a class="hofroute" href="${esc(e.web)}" target="_blank" rel="noopener">Webseite</a>` : ""}</div></div>`).join("") : "";
    // Nach Art: zuerst 6 je Abschnitt, «Alle zeigen» klappt auf (gemerkt bis zum Schliessen)
    document.querySelectorAll("#hofKm [data-km]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.km === state.hof.km)));
    const groups = CORE.farmGroups(items, { ref: r, now, maxKm: state.hof.km, favs: fav });
    const SHOW = 6;
    $("hofGroups").innerHTML = groups.map(g => {
      const all = !!state.hof.open[g.key], rows = all ? g.rows : g.rows.slice(0, SHOW);
      return `<section class="hofgroup" data-group="${g.key}"><h3>${esc(g.name)} <small>${g.rows.length}</small></h3>${rows.map(it => `<div class="hofit">
        <div class="hofrow"><b>${esc(it.n)}</b>${star(it.key, it.fav)}</div>
        <small>${it.oh ? `<span class="st${it.state && it.state.open ? " open" : ""}">${esc(stText(it))}</span> · ${esc(CORE.hoursText(it.oh, now))}` : "Zeiten unbekannt"}</small>
        <small>${it.ort ? `${esc(it.ort)} · ` : ""}${kmText(it.km)}${it.bio && it.k !== "hof" ? " · Bio" : ""}</small>
        <div class="hofact">${route(it)}${it.web ? `<a class="hofroute" href="${esc(it.web)}" target="_blank" rel="noopener">Webseite</a>` : ""}</div></div>`).join("")}
        ${g.rows.length > SHOW ? `<button type="button" class="hofroute hofmore" data-more="${g.key}">${all ? "Weniger zeigen" : `Alle ${g.rows.length} zeigen`}</button>` : ""}</section>`;
    }).join("") || `<p class="hint">Im Umkreis von ${state.hof.km} km nichts gefunden.</p>`;
    // Kleiner Zusatz: freie Google-Maps-Suche (Ergebnisse können kurios sein), ab Standort bzw. Rapperswil-Jona
    const g = q => `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${r.lat.toFixed(4)},${r.lon.toFixed(4)},12z`;
    $("hofGoogle").innerHTML = `<small>Mehr in Google Maps:</small> <a class="hofroute" href="${esc(g("Hofladen"))}" target="_blank" rel="noopener">Hofladen</a><a class="hofroute" href="${esc(g("Wochenmarkt"))}" target="_blank" rel="noopener">Wochenmarkt</a>`;
  }

  // Standort: nur nach Knopfdruck (Zustimmung ja/nein pro Handy), dann bei jedem Öffnen frisch. Nie senden oder speichern.
  function locate(then) {
    if (!navigator.geolocation) { toast("Standort nicht verfügbar – Entfernung ab Rapperswil-Jona"); return then && then(); }
    navigator.geolocation.getCurrentPosition(pos => {
      state.hof.ref = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      save(STORE.KEYS.HOF_GEO_KEY, true);
      renderGeo();
      then && then();
    }, () => {
      state.hof.ref = null;
      save(STORE.KEYS.HOF_GEO_KEY, false);
      renderGeo();
      toast("Standort nicht erlaubt – Entfernung ab Rapperswil-Jona");
      then && then();
    }, { timeout: 10000, maximumAge: 60000 });
  }
  function openHof() {
    state.hof.ref = null;
    state.hof.open = {};
    $("hofDialog").showModal();
    renderHof();
    if (load(STORE.KEYS.HOF_GEO_KEY, false) === true) locate(renderHof);
  }

  // Einstellungen → Standort: zeigt, ob die Hofläden den Standort nehmen, und schaltet ihn wieder aus (Joshua 19.11.)
  function renderGeo() {
    const on = load(STORE.KEYS.HOF_GEO_KEY, false) === true;
    $("geoState").textContent = on ? "an – Entfernung ab deinem Standort" : "aus – einschalten in Hofläden mit «Standort verwenden»";
    $("geoOff").hidden = !on;
  }
  $("geoOff").onclick = () => {
    save(STORE.KEYS.HOF_GEO_KEY, false);
    state.hof.ref = null;
    renderGeo();
    toast("Standort aus – Entfernung ab Rapperswil-Jona");
  };
  app.subscribe(renderGeo);
  renderGeo();

  $("hofBtn").onclick = openHof;
  $("hofLocate").onclick = () => locate(renderHof);
  // KML für Google «Meine Karten»: teilen (Handy) oder herunterladen
  async function exportKml(key) {
    const layers = CORE.kmlLayers(DATA(), SPECIAL(), new Date()).filter(l => !key || l.key === key);
    const files = layers.map(l => new File([l.kml], l.file, { type: "application/vnd.google-earth.kml+xml" }));
    try {
      if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title: "Hofläden und Märkte" }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    files.forEach((file, i) => setTimeout(() => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, i * 400));
    toast(files.length > 1 ? `${files.length} KML-Dateien gespeichert` : "KML gespeichert");
  }
  $("hofKm").addEventListener("click", e => {
    const b = e.target.closest("[data-km]");
    if (!b) return;
    state.hof.km = +b.dataset.km;
    renderHof();
  });
  $("hofGroups").addEventListener("click", e => {
    const b = e.target.closest("[data-more]");
    if (!b) return;
    state.hof.open[b.dataset.more] = !state.hof.open[b.dataset.more];
    renderHof();
  });
  $("hofDialog").addEventListener("click", e => {
    const one = e.target.closest("[data-kml]");
    if (one) exportKml(one.dataset.kml);
    else if (e.target.closest("#hofKml")) exportKml();
  });
  $("hofDialog").addEventListener("click", e => {
    const b = e.target.closest("[data-fav]");
    if (!b) return;
    const key = b.dataset.fav, list = favs(), i = list.indexOf(key);
    if (i < 0) list.push(key); else list.splice(i, 1);
    save(STORE.KEYS.FAV_KEY, list);
    app.settingsChanged();
    renderHof();
  });

  Object.assign(app, { renderHof, openHof });
})();
