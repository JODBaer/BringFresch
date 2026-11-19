// Auto-Release (Joshua 19.11.): Was seit dem letzten Release-Tag auf main kam, entscheidet, ob es ohne Freigabe zur WG geht.
//   - nur kleine Änderungen (fix, docs, test, chore, ci, style, refactor, perf, build) -> «patch»: nächster Tag v1.2.(3+1)
//   - mindestens eine neue Funktion (feat, oder «!»/BREAKING) -> «wait»: Joshua schaut in der Test-App und gibt frei
//     (Test-Server setzt dann v1.(2+1).0, worker/src/freigabe.js). Ein Fix wartet mit, damit nichts Ungeprüftes mitgeht.
//   - nichts Neues -> «none»
//   node tools/release_decide.mjs        -> schreibt action=…, tag=… (für GITHUB_OUTPUT) und eine Zeile Begründung
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const semver = t => { const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(t || ""); return m ? [+m[1], +m[2], +m[3]] : null; };
export const isFeature = subject => /^feat(\([^)]*\))?!?:/i.test(subject) || /^\w+(\([^)]*\))?!:/.test(subject) || /BREAKING/.test(subject);

export function decide(lastTag, subjects) {
  const list = subjects.map(s => s.trim()).filter(s => s && !/^Merge /.test(s));
  if (!list.length) return { action: "none", tag: "", why: `nichts Neues seit ${lastTag || "–"}` };
  const feats = list.filter(isFeature);
  if (feats.length) return { action: "wait", tag: "", why: `${feats.length} neue Funktion(en) – wartet auf Freigabe in der Test-App` };
  const v = semver(lastTag) || [0, 0, 0];
  return { action: "patch", tag: `v${v[0]}.${v[1]}.${v[2] + 1}`, why: `${list.length} kleine Änderung(en) – geht automatisch raus` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const git = a => { const r = spawnSync("git", a, { encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() : ""; };
  const lastTag = git(["tag", "--list", "v*", "--sort=-v:refname"]).split("\n").find(t => semver(t)) || "";
  const subjects = git(["log", "--first-parent", "--format=%s", lastTag ? `${lastTag}..HEAD` : "HEAD"]).split("\n");
  const d = decide(lastTag, subjects);
  console.log(`${d.action}${d.tag ? " " + d.tag : ""}: ${d.why}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `action=${d.action}\ntag=${d.tag}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Auto-Release\n\n**${d.action}${d.tag ? " " + d.tag : ""}** – ${d.why}\n`);
}
