// Architektur-Übersicht: Demo-Umgebung im Handy – feste Uhr (Do 12.11.2026), nachgebauter WG-Server (KV) und Bring!-Liste. Wird von tools/build_architektur.mjs eingebaut.
(() => {
  // Donnerstag 12.11.2026 -> damit auch «KW 47 ->» (nächste Woche ab Donnerstag) sofort sichtbar und ausprobierbar ist!
  const FIXED_TIME = new Date("2026-11-12T17:30:00+01:00").getTime();
  const RealDate = Date;
  const t0 = RealDate.now();
  function FakeDate(...args) {
    if (args.length === 0) return new RealDate(FIXED_TIME + (RealDate.now() - t0));
    return new RealDate(...args);
  }
  FakeDate.now = () => FIXED_TIME + (RealDate.now() - t0);
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  FakeDate.prototype = RealDate.prototype;
  window.Date = FakeDate;

  const kvStore = new Map();
  const bringItems = [
    { name: "Milch", specification: "1 l (von Hand eingetragen)", uuid: "u-milch" },
    { name: "Kürbis", specification: "800 g, Butternuss-Kürbis", uuid: "u-kuerbis" }
  ];
  window.__ARCH_KV = kvStore;
  window.__ARCH_BRING = bringItems;

  const notifyParent = (evt) => {
    try {
      if (window.parent && window.parent.__onPhoneEvent) window.parent.__onPhoneEvent(evt);
    } catch (e) {}
  };

  if (!localStorage.getItem("bringfrisch_terms")) {
    localStorage.setItem("bringfrisch_terms", "1");
    localStorage.setItem("bringfrisch_welcome_done", "true");
    localStorage.setItem("bringfrisch_me", JSON.stringify("joshua"));
    localStorage.setItem("bringfrisch_sync", JSON.stringify({
      url: "https://bringfrisch.allmen.workers.dev",
      pin: "4711",
      wg: "allmen"
    }));
  }

  kvStore.set("bringList", "list-wg");
  kvStore.set("bot:list-wg", JSON.stringify({
    "kürbis": { name: "Kürbis", spec: "800 g, Butternuss-Kürbis", seen: true, t: FIXED_TIME - 60000 }
  }));
  kvStore.set("pop", JSON.stringify({
    weeks: {
      "2026-W45": { "lauchgratin": 4, "kuerbis-risotto": 3, "aelplermagronen": 3, "spaghetti-pesto": 2 },
      "2026-W46": { "lauchgratin": 3, "kuerbis-risotto": 4, "ruebli-curry": 2 }
    }
  }));
  kvStore.set("shared:index", JSON.stringify(["allmen", "sonnenhof"]));
  kvStore.set("shared:sonnenhof", JSON.stringify({
    name: "Sonnenhof",
    updated: FIXED_TIME - 86400000,
    recipes: [{
      id: "sonnenhof-lasagne",
      title: "Sonnenhof-Gemüselasagne",
      diet: "vegi",
      servings: 4,
      prep_time_min: 45,
      season_months: [1,2,3,4,5,6,7,8,9,10,11,12],
      ingredients: [
        { name: "Lasagneblätter", amount: "250", unit: "g" },
        { name: "Lauch", amount: "400", unit: "g" },
        { name: "Reibkäse", amount: "150", unit: "g" }
      ],
      instructions: "Schichten und 30 Min. bei 200 Grad backen."
    }]
  }));

  window.fetch = async (url, init = {}) => {
    const u = new URL(String(url), "https://bringfrisch.allmen.workers.dev");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const method = (init.method || "GET").toUpperCase();
    let reqBody = null;
    if (init.body) {
      try { reqBody = JSON.parse(init.body); } catch { reqBody = String(init.body); }
    }

    const reply = (data, status = 200, workerFile = "worker/src/index.js", kvKey = null) => {
      notifyParent({
        type: "fetch",
        method,
        path: path + u.search,
        status,
        workerFile,
        kvKey,
        reqBody,
        resBody: data
      });
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" }
      });
    };

    if (path === "/health") return reply({ ok: true }, 200, "worker/src/index.js");
    if (path === "/wg") return reply({ name: "Allmen", main: true }, 200, "worker/src/auth.js (requireWg)");
    if (path === "/cal-link") return reply({ url: "https://bringfrisch.allmen.workers.dev/cal/allmen-secret-token.ics" }, 200, "worker/src/kalender.js");

    if (path === "/plan" && method === "GET") {
      const cur = kvStore.get("plan") ? JSON.parse(kvStore.get("plan")) : { plan: null };
      return reply(cur, 200, "worker/src/speicher.js", "plan");
    }
    if (path === "/plan" && method === "PUT") {
      const doc = { ...reqBody, updated: FakeDate.now() };
      kvStore.set("plan", JSON.stringify(doc));
      return reply({ ok: true, updated: doc.updated }, 200, "worker/src/speicher.js (putDoc)", "plan");
    }
    const mPlanWk = path.match(/^\/plan\/(\d{4}-W\d{2})$/);
    if (mPlanWk) {
      const k = "plan:" + mPlanWk[1];
      if (method === "GET") {
        const cur = kvStore.get(k) ? JSON.parse(kvStore.get(k)) : { plan: null };
        return reply(cur, 200, "worker/src/speicher.js", k);
      }
      if (method === "PUT") {
        const doc = { ...reqBody, updated: FakeDate.now() };
        kvStore.set(k, JSON.stringify(doc));
        return reply({ ok: true, updated: doc.updated }, 200, "worker/src/speicher.js (putDoc)", k);
      }
    }

    if (path === "/vorrat" && method === "GET") {
      const cur = kvStore.get("vorrat") ? JSON.parse(kvStore.get("vorrat")) : { staples: null, updated: 0 };
      return reply(cur, 200, "worker/src/speicher.js", "vorrat");
    }
    if (path === "/vorrat" && method === "PUT") {
      const doc = { staples: reqBody.staples, updated: FakeDate.now() };
      kvStore.set("vorrat", JSON.stringify(doc));
      return reply({ ok: true, updated: doc.updated }, 200, "worker/src/speicher.js (putDoc)", "vorrat");
    }

    if (path === "/settings" && method === "GET") {
      const cur = kvStore.get("settings") ? JSON.parse(kvStore.get("settings")) : { settings: null, updated: 0 };
      return reply(cur, 200, "worker/src/speicher.js", "settings");
    }
    if (path === "/settings" && method === "PUT") {
      const doc = { settings: reqBody.settings, updated: FakeDate.now() };
      kvStore.set("settings", JSON.stringify(doc));
      return reply({ ok: true, updated: doc.updated }, 200, "worker/src/geteilt.js (publishShared)", "settings");
    }

    if (path === "/popular") {
      const pop = kvStore.get("pop") ? JSON.parse(kvStore.get("pop")) : { weeks: {} };
      return reply(pop, 200, "worker/src/speicher.js (getPopular)", "pop");
    }
    if (path === "/recipes/shared") {
      const sh = JSON.parse(kvStore.get("shared:sonnenhof") || '{"recipes":[]}');
      return reply({ recipes: sh.recipes.map(r => ({ ...r, id: "x-sonnenhof-" + r.id, shared_from: true })) }, 200, "worker/src/geteilt.js (getShared)", "shared:sonnenhof");
    }

    const mWeek = path.match(/^\/week\/(\d{4}-W\d{2})(?:\/(candidates|vote)(?:\/([\w-]+))?)?$/);
    if (mWeek) {
      const [, wk, part, member] = mWeek;
      if (!part && method === "GET") {
        const cands = kvStore.get("week:" + wk + ":candidates") ? JSON.parse(kvStore.get("week:" + wk + ":candidates")) : null;
        const votes = {};
        for (const [k, v] of kvStore.entries()) {
          if (k.startsWith("week:" + wk + ":vote:")) votes[k.split(":").pop()] = JSON.parse(v);
        }
        return reply({ week: wk, candidates: cands, votes }, 200, "worker/src/speicher.js (getWeek)", "week:" + wk + ":*");
      }
      if (part === "candidates" && method === "PUT") {
        const k = "week:" + wk + ":candidates";
        kvStore.set(k, JSON.stringify(reqBody.candidates || []));
        return reply({ ok: true }, 200, "worker/src/index.js", k);
      }
      if (part === "vote" && member && method === "PUT") {
        const k = "week:" + wk + ":vote:" + member;
        kvStore.set(k, JSON.stringify({ likes: reqBody.likes || [], days: reqBody.days || {} }));
        return reply({ ok: true }, 200, "worker/src/speicher.js (countWeek)", k);
      }
    }

    if (path === "/bring/lists") {
      return reply({
        active: kvStore.get("bringList") || "list-wg",
        lists: [
          { uuid: "list-wg", name: "WG Allmen" },
          { uuid: "list-ferien", name: "Ferienhaus" },
          { uuid: "list-test", name: "Home-test" }
        ]
      }, 200, "worker/src/bring.js (bringLists)", "bringList");
    }
    if (path === "/bring/target" && method === "PUT") {
      kvStore.set("bringList", reqBody.uuid);
      return reply({ ok: true, active: reqBody.uuid, name: "WG Allmen" }, 200, "worker/src/bring.js (bringSetTarget)", "bringList");
    }
    if (path === "/bring/list") {
      const own = JSON.parse(kvStore.get("bot:list-wg") || "{}");
      const details = bringItems.map(p => ({ name: p.name, spec: p.specification || "", uuid: p.uuid }));
      const mineDetails = Object.values(own).map(o => ({ name: o.name, spec: o.spec }));
      return reply({
        items: details.map(d => d.name),
        details,
        mine: mineDetails.map(o => o.name),
        mineDetails
      }, 200, "worker/src/bring.js (bringList)", "bot:list-wg");
    }
    if (path === "/bring/sync" && method === "POST") {
      const own = JSON.parse(kvStore.get("bot:list-wg") || "{}");
      for (const it of (reqBody.items || [])) {
        const ex = bringItems.find(x => x.name.toLowerCase() === it.name.toLowerCase());
        if (ex) ex.specification = it.spec || "";
        else bringItems.push({ name: it.name, specification: it.spec || "", uuid: "u-" + Math.random().toString(36).slice(2, 7) });
        own[it.name.toLowerCase()] = { name: it.name, spec: it.spec || "", seen: true, t: FakeDate.now() };
      }
      kvStore.set("bot:list-wg", JSON.stringify(own));
      return reply({ ok: true, pushed: (reqBody.items || []).length, errors: [], mode: "batch" }, 200, "worker/src/bring.js (bringSync -> bringBatch)", "bot:list-wg");
    }
    if (path === "/bring/remove" && method === "POST") {
      const own = JSON.parse(kvStore.get("bot:list-wg") || "{}");
      let removed = 0;
      for (const nm of (reqBody.names || [])) {
        const k = String(nm).toLowerCase();
        if (own[k]) {
          delete own[k];
          const idx = bringItems.findIndex(x => x.name.toLowerCase() === k);
          if (idx >= 0) bringItems.splice(idx, 1);
          removed++;
        }
      }
      kvStore.set("bot:list-wg", JSON.stringify(own));
      return reply({ ok: true, removed, notMine: [], gone: [] }, 200, "worker/src/bring.js (bringRemove)", "bot:list-wg");
    }
    if (path === "/recipe") {
      return reply({
        title: "Winterlicher Lauch-Kürbis-Gratin",
        servings: 4,
        minutes: 35,
        ingredients: [
          { name: "Lauch", amount: "500", unit: "g" },
          { name: "Butternuss-Kürbis", amount: "400", unit: "g" },
          { name: "Halbrahm", amount: "2", unit: "dl" },
          { name: "Gruyère", amount: "120", unit: "g" }
        ]
      }, 200, "worker/src/rezept.js (importRecipe)");
    }

    return reply({ ok: true }, 200, "worker/src/index.js");
  };
})();
