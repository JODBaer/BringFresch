// Schlüsselpaar für Benachrichtigungen (Web Push, VAPID) erzeugen. Einmal pro Server (WG-Server und Test-Server je eigenes):
//   node tools/vapid.mjs
// Dann die zwei Zeilen als Secrets eintragen (cd worker):
//   npx wrangler secret put VAPID_PUBLIC   (+ --env stage für den Test-Server)
//   npx wrangler secret put VAPID_PRIVATE
// Neuer Schlüssel = alle Handys müssen Benachrichtigungen neu einschalten. Den privaten Schlüssel nie ins Repo.
const b64u = buf => Buffer.from(buf).toString("base64url");
const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const pub = await crypto.subtle.exportKey("raw", keys.publicKey);
const { d } = await crypto.subtle.exportKey("jwk", keys.privateKey);
console.log(`VAPID_PUBLIC=${b64u(pub)}`);
console.log(`VAPID_PRIVATE=${d}`);
