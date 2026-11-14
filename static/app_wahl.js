// Obsonare – Wochenwahl (Memory): 14 Saison-Gerichte, Stimmen der WG, Bilder, Top 7 -> Plan, Pop-up beim Start.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { CORE, isoWeek, weekKey, plusWeek, DAYS, STORE, load, save, VOTE_KEY, ME_KEY, state, savePlan, $,
    recipeLinkLabel, recipeHref, esc, currentMonth, initialsMap, toast, allRecipes, makeDay, DIET_LABEL, refresh,
    recipeById, dietGroup, nextWeekKey, canPlanNext, shownWeek } = app;

  // ---------------------------------------------------------------------------
  // Wochenwahl (Memory): 14 Saison-Gerichte, alle tippen Favoriten an, Top 7 → Plan
  // ---------------------------------------------------------------------------
  const GRID_SIZE = 14;
  const PLAN_SIZE = 7;


  // Ersatz-Gericht: zuerst saisonal + gleiche Gruppe, dann saisonal, dann irgendeins
  // quick = Schnelles/Reste (Pizza, Nuggets, Gnocchi …): eigener Topf, damit sie das Saison-Memory nicht fluten
  const backupRecipe = (group, excludeIds, quick = false) => CORE.backupRecipe(allRecipes(), group, excludeIds, quick, currentMonth());

  // 14 Kandidaten: halb vegi (inkl. vegan), halb Fleisch, saisonal zuerst
  const QUICK_SLOTS = 2; // pro Woche 2 schnelle Sachen / Resteessen im Memory
  const pickCandidates = () => CORE.pickCandidates(allRecipes(), currentMonth(), GRID_SIZE, QUICK_SLOTS);
  // ohne Unbekanntes und ohne doppelte Gerichte, wieder auf 14 aufgefüllt
  const cleanCandidates = ids => CORE.cleanCandidates(allRecipes(), ids, currentMonth(), GRID_SIZE, QUICK_SLOTS);
  // Liste vom WG-Server mit demselben Gericht zweimal (alte Version hat beim Mischen doppelt gezogen)?
  function hasDuplicateDish(ids) {
    const known = ids.map(recipeById).filter(Boolean);
    return known.some((r, i) => known.findIndex(o => CORE.sameDish(o, r)) !== i);
  }

  const voteKey = week => `${VOTE_KEY}_${week}`;
  function loadVote() {
    const week = shownWeek();
    const saved = load(voteKey(week), null);
    if (saved && saved.week === week && Array.isArray(saved.candidates)) {
      saved.candidates = cleanCandidates(saved.candidates);
      return saved;
    }
    return { week, candidates: pickCandidates(), votes: {} };
  }

  state.vote = null;
  const saveVote = () => save(voteKey(state.vote.week), state.vote);

  // Mit dem Worker abgleichen: Kandidaten + Stimmen aller holen, eigene Stimme bleibt lokal führend
  async function pullVote() {
    if (!app.connected() || !state.vote) return;
    const v = state.vote; // Woche kann während des Wartens wechseln: nur in die Wahl schreiben, die angefragt wurde
    try {
      const remote = await app.api(`/week/${v.week}`);
      if (v !== state.vote) return;
      if (!remote.candidates) {
        await app.api(`/week/${v.week}/candidates`, { method: "PUT", body: { candidates: v.candidates } });
      } else if (hasDuplicateDish(remote.candidates)) {
        // doppelte Karten auf dem Server: bereinigen und für alle zurückschreiben
        v.candidates = cleanCandidates(remote.candidates);
        app.api(`/week/${v.week}/candidates`, { method: "PUT", body: { candidates: v.candidates } }).catch(e => app.setSyncStatus(e.message, false));
      } else {
        // Unbekanntes (z.B. eigenes Rezept, das hier noch fehlt) nur ausblenden, nicht vom Server löschen
        v.candidates = remote.candidates.filter(id => recipeById(id));
      }
      const me = myId();
      Object.entries(remote.votes || {}).forEach(([member, mv]) => {
        if (member !== me || !v.votes[me]) v.votes[member] = mv;
      });
      saveVote();
      if ($("voteDialog").open) renderVote();
    } catch (e) {
      app.setSyncStatus(e.message, false);
    }
  }

  // Pro Person ein eigener Timer: wechselt «Ich bin» innerhalb von 0.5 s, geht die Stimme davor nicht verloren
  const votePushTimers = {};
  function pushMyVote() {
    if (!app.connected()) return;
    const id = myId();
    clearTimeout(votePushTimers[id]);
    votePushTimers[id] = setTimeout(() => {
      delete votePushTimers[id];
      const v = state.vote.votes[id] || { likes: [], days: {} };
      app.api(`/week/${state.vote.week}/vote/${encodeURIComponent(id)}`, { method: "PUT", body: v }).catch(e => app.setSyncStatus(e.message, false));
    }, 500);
  }

  function pushCandidates() {
    if (!app.connected()) return;
    app.api(`/week/${state.vote.week}/candidates`, { method: "PUT", body: { candidates: state.vote.candidates } }).catch(e => app.setSyncStatus(e.message, false));
  }

  function myId() {
    const saved = load(ME_KEY, null);
    return state.members.some(m => m.id === saved) ? saved : state.members[0].id;
  }

  function myVote() {
    const id = myId();
    state.vote.votes[id] = state.vote.votes[id] || { likes: [], days: {} };
    return state.vote.votes[id];
  }

  const votersOf = recipeId => CORE.votersOf(state.members, state.vote.votes, recipeId);

  const ranking = () => CORE.ranking(state.vote.candidates, state.members, state.vote.votes);

  // Bilder zu den Gerichten: der WG-Server holt sie einmal von der Rezeptseite; das Handy merkt sie sich (Cache «bf-img»)
  const imgCache = new Map(); // source_url -> Objekt-URL, "" = kein Bild
  const imgState = u => (imgCache.has(u) ? (imgCache.get(u) ? " ok" : " none") : "");
  // ohne Bild: ein passendes Emoji auf ruhiger Fläche (Reste, Pizza, Pasta, Suppe, Curry, Salat, Fisch, Fleisch, sonst Gemüse)
  function dishEmoji(r) {
    const t = `${r.title || ""} ${(r.ingredients || []).map(i => i.name).join(" ")}`.toLowerCase();
    if (r.is_leftovers) return "♻️";
    const rules = [[/müesli|muesli/, "🥣"], [/café complet|kaffee/, "☕"], [/fondue|raclette|käseschnitt/, "🧀"], [/abendbrot|toast|fotzel/, "🥪"], [/pizza|flammkuchen/, "🍕"], [/dumpling|maultasch|gyoza/, "🥟"], [/nugget|schnitzel|cordon/, "🍗"], [/spaghetti|penne|pasta|nudel|magronen|hörnli|lasagne|orecchiette|pappardelle|gnocchi/, "🍝"], [/suppe|eintopf|voressen/, "🍲"], [/curry|dal\b|massaman/, "🍛"], [/risotto|reis\b/, "🍚"], [/salat/, "🥗"], [/rösti|gschwellti|kartoffel/, "🥔"], [/lachs|fisch|forelle|thun|kabeljau|saibling|seeteufel/, "🐟"], [/poulet|huhn|chicken/, "🍗"], [/burger|wrap|quesadilla|tortilla/, "🌯"], [/wähe|quiche|tarte|gratin/, "🥧"]];
    const hit = rules.find(([re]) => re.test(t));
    return hit ? hit[1] : r.diet === "fleisch" ? "🥩" : "🥕";
  }
  const imgLoading = new Set();
  async function loadImg(u) {
    const req = `${state.sync.url.replace(/\/+$/, "")}/img?url=${encodeURIComponent(u)}`;
    let cache = null;
    try { cache = window.caches ? await caches.open("bf-img") : null; } catch (e) { /* ohne Cache */ }
    let res = cache ? await cache.match(req).catch(() => null) : null;
    if (!res) {
      const r = await fetch(req, { headers: { "X-WG-PIN": state.sync.pin, ...(state.sync.wg ? { "X-WG": state.sync.wg } : {}) } });
      if (r.status === 204 || r.status === 404) { imgCache.set(u, ""); return; } // kein Bild zu diesem Rezept
      if (!r.ok) return; // später nochmals
      if (cache) await cache.put(req, r.clone()).catch(() => {});
      res = r;
    }
    imgCache.set(u, URL.createObjectURL(await res.blob()));
  }
  async function loadVoteImages() {
    const todo = [...new Set([...document.querySelectorAll("#voteGrid .vimg[data-img]")].map(e => e.dataset.img))]
      .filter(u => !imgCache.has(u) && !imgLoading.has(u));
    const show = u => document.querySelectorAll("#voteGrid .vimg[data-img]").forEach(e => {
      if (e.dataset.img !== u || !imgCache.has(u)) return;
      const src = imgCache.get(u);
      e.className = `vimg${src ? " ok" : " none"}`;
      if (src) e.style.backgroundImage = `url(${src})`;
    });
    const worker = async () => {
      for (let u; (u = todo.shift()); ) {
        imgLoading.add(u);
        try { await loadImg(u); } catch (e) { /* offline: Fläche bleibt grau */ }
        imgLoading.delete(u);
        show(u);
      }
    };
    await Promise.all([worker(), worker(), worker()]); // höchstens 3 gleichzeitig
  }

  let voteOpen = null; // umgedrehte Memory-Karte (Gericht-ID)
  function renderVote() {
    const short = initialsMap();
    const mine = myVote();
    $("voteSubtitle").textContent = `KW ${+state.vote.week.split("W")[1]}${state.viewNext ? " (nächste Woche)" : ""} · ${GRID_SIZE} Saison-Gerichte, die Top ${PLAN_SIZE} kommen in den Plan`;
    $("voteMe").innerHTML = state.members.map(m => `<option value="${esc(m.id)}"${m.id === myId() ? " selected" : ""}>${esc(m.name)}</option>`).join("");
    $("voteMine").textContent = `${mine.likes.length} gewählt`;

    $("voteGrid").innerHTML = state.vote.candidates.map(id => {
      const r = recipeById(id);
      const on = mine.likes.includes(id);
      const wish = mine.days[id];
      // Memory-Karte: Umdrehen = wählen. Titel, Beschreibung und 🌐-Link stehen vorne wie hinten an derselben Stelle;
      // hinten oben Wunschtag (oder «egal») und «Doch nicht». Antippen irgendwo dreht zurück (bleibt gewählt).
      const href = recipeHref(r);
      const meta = `${r.is_leftovers ? "♻️ Reste" : r.quick ? "⚡ schnell" : DIET_LABEL[r.diet] || "Vegi"} · ${r.prep_time_min || 30} Min.`;
      const band = `<span class="vband"><span class="vbt">${esc(r.title)}</span><span class="vbm">${meta}</span></span>${href
        ? `<a class="vgo" href="${esc(href)}" target="_blank" rel="noopener" aria-label="${esc(recipeLinkLabel(r))}" title="${esc(recipeLinkLabel(r))}">🌐</a>` : ""}`;
      return `
        <div class="vcard${on ? " on" : ""}${voteOpen === id ? " open" : ""}" data-id="${esc(id)}">
          <div class="vflip">
            <div class="vfront" role="button" tabindex="0" aria-label="${esc(r.title)} ${on ? "umdrehen" : "wählen"}">
              ${r.source_url && app.connected()
                ? `<span class="vimg${imgState(r.source_url)}" data-img="${esc(r.source_url)}" data-emoji="${dishEmoji(r)}" aria-hidden="true"${imgCache.get(r.source_url) ? ` style="background-image:url(${imgCache.get(r.source_url)})"` : ""}></span>`
                : `<span class="vimg none" data-emoji="${dishEmoji(r)}" aria-hidden="true"></span>`}
              <span class="vshade" aria-hidden="true"></span>
              ${band}
              ${on && wish != null ? `<span class="vwish">${DAYS[wish].slice(0, 2)}</span>` : ""}
              <span class="vv">${votersOf(id).map(m => `<span class="mini" title="${esc(m.name)}">${esc(short[m.id])}</span>`).join("")}</span>
            </div>
            <div class="vback" role="group" aria-label="${esc(r.title)}">
              <span class="vtop">
                <span class="vt" hidden>${esc(r.title)}</span>
                <span class="vm" hidden>${meta}</span>
                <span class="days-l">${on ? "✓ Gewählt · Wunschtag?" : "Nicht gewählt"}</span>
                ${on ? `<span class="days-pick" role="group" aria-label="Wunschtag">${DAYS.map((d, i) => `<button type="button" data-wish="${esc(id)}" data-day="${i}" aria-pressed="${wish === i}">${d.slice(0, 2)}</button>`).join("")}<button type="button" class="egal" data-wish="${esc(id)}" data-day="-1" aria-pressed="${wish == null}">egal</button></span>` : ""}
                <button class="vpick" type="button" data-like="${esc(id)}" aria-pressed="${on}">${on ? "Doch nicht" : "Wählen"}</button>
              </span>
              ${band}
            </div>
          </div>
        </div>`;
    }).join("");

    loadVoteImages();
    const voted = state.members.filter(m => ((state.vote.votes[m.id] || {}).likes || []).length > 0);
    $("voteWho").textContent = `${voted.length} von ${state.members.length} haben gewählt`;
    $("voteRank").innerHTML = ranking().map((x, k) => {
      const r = recipeById(x.id);
      return `<div class="rank-row${k < PLAN_SIZE ? "" : " out"}">
        <span class="n">${k + 1}</span><span class="t">${esc(r.title)}</span>
        <span class="vv">${x.voters.map(m => `<span class="mini">${esc(short[m.id])}</span>`).join("")}</span>
      </div>`;
    }).join("");
  }

  let votePoll = null;
  function openVote() {
    voteOpen = null;
    state.vote = loadVote();
    saveVote();
    renderVote();
    $("voteDialog").showModal();
    pullVote();
    clearInterval(votePoll);
    // Stimmen der anderen live nachladen – alle 30 s und nur, wenn die App sichtbar ist (schont das Gratis-Kontingent des WG-Servers)
    if (app.connected()) votePoll = setInterval(() => { if (document.visibilityState !== "hidden") pullVote(); }, 30000);
  }
  $("voteDialog").addEventListener("close", () => clearInterval(votePoll));

  // Kalender-Symbol: ab Donnerstag geht es zur nächsten Woche, solange dort noch nichts gewählt ist
  function openVoteFor() {
    if (canPlanNext() && !state.viewNext && !wahlDone(nextWeekKey())) app.setWeekView(true);
    openVote();
  }
  $("openVoteBtn").onclick = openVoteFor;

  $("voteMe").onchange = () => {
    save(ME_KEY, $("voteMe").value);
    renderVote();
    app.renderMembers();
    app.renderDays();
  };

  // Tastatur: Enter/Leertaste auf der Vorderseite dreht um
  $("voteGrid").addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("vfront")) { e.preventDefault(); e.target.click(); }
  });
  $("voteGrid").addEventListener("click", e => {
    if (e.target.closest("a")) return; // Link zum Rezept: öffnen, nicht umdrehen
    const card = e.target.closest(".vcard");
    if (card && !e.target.closest("[data-like], [data-wish]")) {
      // ganze Karte = umdrehen; Umdrehen aufs Bild-Rückseite = wählen (zurückdrehen lässt es gewählt)
      const id = card.dataset.id;
      const opening = voteOpen !== id;
      const mine = myVote();
      if (opening && !mine.likes.includes(id)) {
        mine.likes.push(id);
        saveVote();
        pushMyVote();
        renderVote(); // zeichnet noch mit der alten offenen Karte – gedreht wird gleich danach
      }
      flipTo(opening ? id : null);
      return;
    }
    const wish = e.target.closest("[data-wish]");
    if (wish) {
      const mine = myVote();
      const day = +wish.dataset.day;
      if (day < 0 || mine.days[wish.dataset.wish] === day) delete mine.days[wish.dataset.wish]; // «egal» = kein Wunschtag
      else mine.days[wish.dataset.wish] = day;
      saveVote();
      pushMyVote();
      renderVote();
      return;
    }
    const like = e.target.closest("[data-like]");
    if (!like) return;
    const mine = myVote();
    const id = like.dataset.like;
    const off = mine.likes.includes(id);
    if (off) {
      mine.likes = mine.likes.filter(x => x !== id);
      delete mine.days[id];
    } else {
      mine.likes.push(id);
    }
    saveVote();
    pushMyVote();
    renderVote();
    if (off && voteOpen === id) flipTo(null); // abgewählt: zurück aufs Bild
  });

  // Karten drehen: nur Klassen umschalten (nicht neu zeichnen), damit die Drehung sichtbar ist; immer nur eine Karte offen
  function flipTo(id) {
    voteOpen = id;
    document.querySelectorAll("#voteGrid .vcard").forEach(c => {
      const open = c.dataset.id === voteOpen;
      if (open === c.classList.contains("open")) return;
      void c.offsetWidth; // frisch gezeichnete Karte: Ausgangslage festhalten, sonst springt sie ohne Drehung
      // Karte hebt sich beim Drehen an (grösser, Schatten), landet danach wieder
      c.classList.add("lift");
      clearTimeout(c._lift);
      c._lift = setTimeout(() => c.classList.remove("lift"), 280);
      c.classList.toggle("open", open);
    });
  }

  // Nur Gerichte ohne Stimme werden durch saisonale Reserve ersetzt
  $("voteShuffleBtn").onclick = () => {
    let swapped = 0;
    // alles, was schon im Raster steht oder gerade neu gezogen wurde, nie doppelt (sonst 2× dasselbe Gericht)
    const taken = [...state.vote.candidates];
    state.vote.candidates = state.vote.candidates.map(id => {
      if (votersOf(id).length > 0) return id;
      const old = recipeById(id);
      const r = backupRecipe(dietGroup(old), taken, !!(old && old.quick));
      if (!r) return id;
      swapped++;
      taken.push(String(r.id));
      return String(r.id);
    });
    saveVote();
    pushCandidates();
    renderVote();
    toast(swapped ? `${swapped} Gerichte neu gemischelt` : "Alle Gerichte haben schon Stimmen");
  };

  $("voteAddBtn").onclick = () => {
    state.catalogMode = "vote";
    $("voteDialog").close();
    app.openCatalog(0);
  };

  // Faire Tagesverteilung: Gericht auf Tag, an dem seine Fans zuhause sind (+2 je Fan), Wunschtag +3
  const assignDays = recipeIds => CORE.assignDays(recipeIds, state.plan, state.members, state.vote.votes);

  $("voteApplyBtn").onclick = () => {
    const top = ranking().slice(0, PLAN_SIZE);
    const withVotes = top.filter(x => x.voters.length > 0).length;
    if (withVotes === 0) return toast("Noch niemand hat gewählt");
    const previous = state.plan;
    const days = assignDays(top.map(x => x.id));
    const next = [...state.plan];
    Object.entries(days).forEach(([id, day]) => { next[day] = makeDay(recipeById(id), day, state.plan[day]); app.countDish(id); });
    state.plan = next;
    savePlan();
    refresh();
    save(STORE.wahlKey(state.vote.week), true);
    markWahl();
    $("voteDialog").close();
    toast(withVotes < PLAN_SIZE ? `Plan übernommen (${PLAN_SIZE - withVotes} ohne Stimme aufgefüllt)` : "Plan übernommen", {
      label: "Rückgängig",
      run: () => { state.plan = previous; savePlan(); refresh(); }
    });
  };

  $("voteRandomBtn").onclick = () => {
    $("voteDialog").close();
    app.planRandomWeek();
  };

  // Wochenwahl-Pop-up: beim Start, wenn für diese Woche noch nichts gewählt ist
  function wahlDone(week = shownWeek()) {
    if (load(STORE.wahlKey(week), false)) return true;
    if (week === nextWeekKey() && state.nextDoc && state.nextDoc.week === week && Array.isArray(state.nextDoc.plan) && state.nextDoc.plan.every(d => !d.empty)) return true;
    const v = load(voteKey(week), null);
    const me = load(ME_KEY, null);
    return !!(v && v.week === week && me && v.votes && v.votes[me] && (v.votes[me].likes || []).length);
  }
  // Roter Punkt: Mo–Mi für diese Woche, ab Donnerstag für die nächste
  const wahlDue = () => (canPlanNext() ? !wahlDone(nextWeekKey()) : !wahlDone(weekKey()));
  function markWahl() { $("openVoteBtn").classList.toggle("due", wahlDue()); }
  function openWahlPop() {
    $("wpopText").textContent = canPlanNext()
      ? `Ab Donnerstag könnt ihr schon die nächste Woche planen. Für KW ${isoWeek(plusWeek())} ist noch nichts gewählt.`
      : `Für KW ${isoWeek(new Date())} ist noch nichts gewählt. Stellt den Plan in einer Minute zusammen – der Rest füllt sich von selbst.`;
    const pop = $("wpop");
    pop.hidden = false;
    pop.style.cssText = "";
    requestAnimationFrame(() => requestAnimationFrame(() => { pop.classList.add("show"); $("wscrim").classList.add("show"); }));
    setTimeout(() => $("wgo").focus({ preventScroll: true }), 350);
  }
  // Pop-up fliegt in das Kalender-Symbol oben (FLIP)
  function dockWahlPop(then) {
    const pop = $("wpop");
    const btn = $("openVoteBtn");
    $("wscrim").classList.remove("show");
    const finish = () => { pop.classList.remove("show"); pop.hidden = true; markWahl(); if (then) then(); };
    const a = pop.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    if (!pop.animate || !a.width || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    const anim = pop.animate([
      { transform: getComputedStyle(pop).transform, opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${b.width / a.width}, ${b.height / a.height})`, opacity: 0, borderRadius: "999px" }
    ], { duration: 520, easing: "cubic-bezier(.3,0,.1,1)" });
    anim.onfinish = () => {
      finish();
      if (btn.animate) btn.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(.34,1.45,.5,1)" });
    };
  }
  $("wgo").onclick = () => dockWahlPop(openVoteFor);
  $("wlater").onclick = () => dockWahlPop();
  $("wscrim").onclick = () => dockWahlPop();
  $("wpop").addEventListener("keydown", e => { if (e.key === "Escape") dockWahlPop(); });

  Object.assign(app, { voteKey, saveVote, pullVote, pushCandidates, myId, renderVote, openVoteFor, wahlDue, markWahl,
    openWahlPop });
})();
