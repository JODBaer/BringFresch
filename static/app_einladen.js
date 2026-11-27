// Obsonare – Erster Start in 3 Schritten (plan.md Schritt 1, Entwurf docs/design/erster-start-entwurf.html, Joshua 25.11.):
// Einladungslink statt WG-Name + PIN abtippen, «Wer bist du?» als Kacheln, «Bring! verbinden» nur solange die WG noch keine
// Liste hat (Weg A: Liste in Bring! mit dem Bot teilen, Joshua 27.11.), am Schluss «deine erste Woche».
// Der PIN reist verschlüsselt: das einladende Handy verschlüsselt ihn mit einem Schlüssel aus dem Code im Link (AES-GCM),
// der WG-Server bekommt nur { id, iv, box } und kennt weder Code noch PIN (worker/src/einladung.js).
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { DEFAULT_SYNC_URL, load, ME_KEY, state, $, esc, toast, copyText, CORE } = app;

  const BOT_MAIL = "allmenbot@gmail.com";
  const BRING_WEB = "https://web.getbring.com/";

  // ---------------------------------------------------------------------------
  // Verschlüsselung (WebCrypto, kein Paket): Schlüssel und id aus dem Code
  // ---------------------------------------------------------------------------
  const enc = new TextEncoder();
  const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  async function keysFor(code) {
    const [raw, idBuf] = await Promise.all([
      crypto.subtle.digest("SHA-256", enc.encode("obsonare-key:" + code)),
      crypto.subtle.digest("SHA-256", enc.encode("obsonare-id:" + code))
    ]);
    return { key: await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]), id: hex(idBuf) };
  }
  const serverUrl = () => (state.sync.url || DEFAULT_SYNC_URL).replace(/\/+$/, "");

  // ---------------------------------------------------------------------------
  // Einladen (Einstellungen → Mitbewohner): Link erstellen, per WhatsApp / Teilen / Kopieren senden
  // ---------------------------------------------------------------------------
  let inviteUrl = "";
  async function createInvite() {
    const code = b64u(crypto.getRandomValues(new Uint8Array(16)));
    const { key, id } = await keysFor(code);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const box = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify({ pin: state.sync.pin })));
    await app.api("/invite", { method: "POST", body: { id, iv: b64u(iv), box: b64u(box) } });
    return CORE.inviteLink(location.href, state.sync.wg || "", code);
  }
  const inviteText = () => `Komm in unsere WG bei Obsonare 🥕 ${inviteUrl}`;
  async function openInvite() {
    if (!app.connected()) return toast("Zuerst mit dem WG-Server verbinden");
    inviteUrl = "";
    $("inviteLink").textContent = "Link wird erstellt …";
    $("inviteActions").hidden = true;
    $("inviteDialog").showModal();
    try {
      inviteUrl = await createInvite();
      $("inviteLink").textContent = inviteUrl;
      $("inviteWa").href = "https://wa.me/?text=" + encodeURIComponent(inviteText());
      $("inviteShare").hidden = !navigator.share;
      $("inviteActions").hidden = false;
    } catch (e) {
      $("inviteLink").textContent = `✗ ${e.message || "Link konnte nicht erstellt werden"} – nochmals versuchen`;
    }
  }
  $("inviteBtn").onclick = openInvite;
  $("inviteCopy").onclick = async () => { if (inviteUrl && await copyText(inviteUrl)) toast("Link kopiert – gilt 7 Tage"); };
  $("inviteShare").onclick = () => { if (inviteUrl && navigator.share) navigator.share({ title: "Obsonare", text: "Komm in unsere WG bei Obsonare 🥕", url: inviteUrl }).catch(() => {}); };

  // ---------------------------------------------------------------------------
  // Link öffnen: Einladung holen, PIN entschlüsseln, verbinden → «Wer bist du?»
  // ---------------------------------------------------------------------------
  async function joinFromLink(join) {
    app.openWelcome();
    const status = $("welcomeStatus");
    status.textContent = "Einladung wird geprüft …";
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ohne History */ }
    try {
      const { key, id } = await keysFor(join.code);
      const res = await fetch(`${serverUrl()}/join/${id}`);
      const inv = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(inv.error || `Einladung nicht gefunden (${res.status})`);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(inv.iv) }, key, unb64u(inv.box));
      const { pin } = JSON.parse(new TextDecoder().decode(plain));
      $("welcomeWg").value = inv.wg || "";
      await app.connectWelcome(inv.wg || "", pin);
    } catch (e) {
      status.textContent = /Failed to fetch|NetworkError|Load failed/.test(e.message) ? "Keine Verbindung zum WG-Server – Internet?"
        : `✗ ${e.name === "OperationError" ? "Link ist beschädigt" : e.message} – frag nach einem neuen Link oder gib WG-Name und PIN ein`;
    }
  }

  // ---------------------------------------------------------------------------
  // Nach «Wer bist du?»: Bring! verbinden (nur ohne Liste) → Fertig
  // ---------------------------------------------------------------------------
  const STEPS = ["who", "bring", "done"];
  function showStep(step) {
    ["welcomeJoin", "welcomeWho", "welcomeBring", "welcomeDone"].forEach(id => { $(id).hidden = id !== "welcome" + step[0].toUpperCase() + step.slice(1); });
    const k = STEPS.indexOf(step);
    $("welcomeDots").innerHTML = k < 0 ? "" : STEPS.map((_, i) => `<i class="${i <= k ? "on" : ""}"></i>`).join("");
    if (step !== "bring") stopPoll();
  }
  let pollT = null;
  const stopPoll = () => { clearInterval(pollT); pollT = null; };

  async function afterWho() {
    let lists = null;
    try { lists = app.connected() ? await app.api("/bring/lists") : null; } catch (e) { /* ohne Server: einfach weiter */ }
    const cur = lists && lists.lists.find(l => l.uuid === lists.active && !l.test);
    if (!lists || cur) return showDone(cur ? cur.name : "");
    showBring();
  }

  // Bring! verbinden: alle paar Sekunden nachfragen; eine Liste, die der Bot NEU sieht, wird gleich gewählt.
  // Listen, die er schon vorher sah (z.B. alte Listen des Bot-Kontos), nur auf Antippen – nie ungefragt.
  let known = null;
  async function chooseList(l) {
    stopPoll();
    try {
      await app.api("/bring/target", { method: "PUT", body: { uuid: l.uuid } });
      $("welcomeBringState").textContent = `Liste «${l.name}» gefunden ✓`;
      $("welcomeBringPick").innerHTML = "";
      $("welcomeBringNext").disabled = false;
      $("welcomeBringNext").dataset.list = l.name;
    } catch (e) {
      $("welcomeBringState").textContent = `✗ ${e.message}`;
    }
  }
  function showBring() {
    showStep("bring");
    known = null;
    $("welcomeBringState").innerHTML = `<span class="wspin" aria-hidden="true"></span>Obsonare sucht eure Liste …`;
    $("welcomeBringPick").innerHTML = "";
    $("welcomeBringNext").disabled = true;
    const check = async () => {
      try {
        const { lists } = await app.api("/bring/lists");
        const real = lists.filter(l => !l.test);
        if (known === null) {
          known = new Set(real.map(l => l.uuid));
          $("welcomeBringPick").innerHTML = real.length ? `<small>Oder ist es eine davon?</small>` + real.map(l => `<button class="btn" type="button" data-list="${esc(l.uuid)}">${esc(l.name)}</button>`).join("") : "";
          return;
        }
        const fresh = real.find(l => !known.has(l.uuid));
        if (fresh) chooseList(fresh);
      } catch (e) { /* nochmals in ein paar Sekunden */ }
    };
    stopPoll();
    check();
    pollT = setInterval(check, 4000);
  }
  $("welcomeBringPick").addEventListener("click", async e => {
    const b = e.target.closest("[data-list]");
    if (!b) return;
    const { lists } = await app.api("/bring/lists").catch(() => ({ lists: [] }));
    const l = lists.find(x => x.uuid === b.dataset.list);
    if (l) chooseList(l);
  });
  $("welcomeBotCopy").onclick = async () => { if (await copyText(BOT_MAIL)) { $("welcomeBotCopy").textContent = "Kopiert ✓"; } };
  $("welcomeBringOpen").href = BRING_WEB;
  $("welcomeBringNext").onclick = () => showDone($("welcomeBringNext").dataset.list || "");
  $("welcomeBringLater").onclick = () => showDone("");

  function showDone(listName) {
    showStep("done");
    const me = state.members.find(m => m.id === load(ME_KEY, null));
    $("welcomeHello").textContent = `Hoi ${me ? me.name : "du"} 👋`;
    $("welcomeDoneOk").hidden = !listName;
    $("welcomeDoneOk").textContent = listName ? `Bring! ist verbunden ✓ Liste «${listName}»` : "";
  }
  $("welcomeVoteBtn").onclick = () => { app.closeWelcome({ pop: false }); app.openVoteFor(); };
  $("welcomeDoneBtn").onclick = () => app.closeWelcome({ pop: false });
  $("welcomeDialog").addEventListener("close", stopPoll);

  Object.assign(app, { joinFromLink, afterWho, showWelcomeStep: showStep, openInvite });
})();
