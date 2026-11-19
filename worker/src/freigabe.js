// Test-Freigabe (nur Test-Server, Secret RELEASE_TOKEN): aus der Test-App heraus freigeben oder ein Problem melden.
//   GET  /release/status?sha=…           -> { enabled, released, tag }   (ist dieser Stand schon als Release getaggt?)
//   POST /release/approve {sha}          -> { ok, tag, url }              setzt den nächsten Tag v1.2.(3+1) auf sha
//                                                                          -> deploy-pages.yml: Tests, WG-Server, WG-App
//   POST /release/issue {text, version, sha} -> { ok, number, url }       legt ein GitHub-Issue an, kein Release
// Nur die erste WG des Test-Servers (Test-PIN). Freigegeben wird nur, was gerade auf main liegt (sonst 409:
// es kam inzwischen etwas Neues dazu, das noch niemand angeschaut hat). Token: fein-granular, nur dieses Repo,
// Contents + Issues lesen/schreiben, Actions lesen.
import { body, httpError, json } from "./http.js";

export const RELEASE_REPO = "JODBaer/BringFresch";
const API = `https://api.github.com/repos/${RELEASE_REPO}`;

async function gh(env, path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.RELEASE_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "obsonare-test-freigabe",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(res.status === 401 || res.status === 403 ? 502 : res.status === 422 ? 409 : 502,
    `GitHub: ${data.message || res.status}${res.status === 401 ? " (Token abgelaufen?)" : ""}`);
  return data;
}

const isSha = s => /^[0-9a-f]{7,40}$/.test(String(s || ""));
const semver = t => { const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(t); return m ? [+m[1], +m[2], +m[3]] : null; };
const newer = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export async function latestTag(env) {
  const tags = await gh(env, "/tags?per_page=100");
  return tags.filter(t => semver(t.name)).sort((a, b) => newer(semver(b.name), semver(a.name)))[0] || null;
}
export const nextTag = name => { const v = semver(name || "v0.0.0"); return `v${v[0]}.${v[1]}.${v[2] + 1}`; };

export async function release(request, env, path, url) {
  if (!env.RELEASE_TOKEN) {
    if (path === "/release/status") return json({ enabled: false });
    throw httpError(501, "Freigabe ist auf diesem Server nicht eingerichtet (Secret RELEASE_TOKEN fehlt)");
  }
  if (!env.WG_CTX?.main) throw httpError(403, "Freigeben geht nur mit der Test-PIN");

  if (path === "/release/status" && request.method === "GET") {
    const sha = url.searchParams.get("sha");
    const tag = await latestTag(env);
    return json({ enabled: true, tag: tag?.name || null, released: !!(tag && isSha(sha) && tag.commit.sha.startsWith(sha)) });
  }

  if (path === "/release/approve" && request.method === "POST") {
    const { sha } = await body(request);
    if (!isSha(sha)) throw httpError(400, "Stand (sha) fehlt");
    const main = await gh(env, "/commits/main");
    if (!main.sha.startsWith(sha)) throw httpError(409, "Auf main ist inzwischen etwas Neues – Test-App neu laden und das zuerst anschauen");
    const last = await latestTag(env);
    if (last && last.commit.sha === main.sha) return json({ ok: true, tag: last.name, already: true, url: `https://github.com/${RELEASE_REPO}/actions` });
    const tag = nextTag(last?.name);
    await gh(env, "/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/tags/${tag}`, sha: main.sha }) });
    return json({ ok: true, tag, url: `https://github.com/${RELEASE_REPO}/actions/workflows/deploy-pages.yml` });
  }

  if (path === "/release/issue" && request.method === "POST") {
    const { text, version, sha } = await body(request);
    const t = String(text || "").trim().slice(0, 4000);
    if (!t) throw httpError(400, "Was stimmt nicht? Bitte kurz beschreiben");
    const title = "Test: " + t.split("\n")[0].slice(0, 70);
    const info = [`Gemeldet aus der Test-App`, version && `Version ${String(version).slice(0, 40)}`, isSha(sha) && `Stand ${sha}`].filter(Boolean).join(" · ");
    const issue = await gh(env, "/issues", { method: "POST", body: JSON.stringify({ title, body: `${t}\n\n---\n${info}` }) });
    return json({ ok: true, number: issue.number, url: issue.html_url });
  }
  throw httpError(404, "Unbekannter Endpunkt");
}
