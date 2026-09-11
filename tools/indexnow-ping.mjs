// tools/indexnow-ping.mjs
// Submits the site's canonical URLs to IndexNow (Bing · Yandex · Seznam · Naver).
//
// IndexNow re-verifies the site by fetching the public key file — the same one
// committed at the frontend root — before accepting the URLs, then triggers an
// instant crawl instead of waiting weeks for the next organic sweep.
//
// Usage (from the repo root):
//   node tools/indexnow-ping.mjs                 # submit sitemap URLs for www.casuya.co.tz
//   node tools/indexnow-ping.mjs --host=www.casuya.co.tz
//   node tools/indexnow-ping.mjs --host casuya.co.tz   # rebases URLs onto the apex host
//   node tools/indexnow-ping.mjs --dry-run       # print the payload without sending
//
// The canonical host is www.casuya.co.tz (the apex 308-redirects to it), so the
// default keyLocation is verified over HTTPS at that host. When --host differs,
// the key file must be reachable at the exact host named — IndexNow requires key
// verification without redirects, so pinging a bare apex only works once the key
// file is served there directly (no 308 to www).

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(".");
const FRONTEND = join(ROOT, "apps", "platform", "frontend");
const ENDPOINT = "https://api.indexnow.org/indexnow";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

let host = "www.casuya.co.tz";
const hostFlag = args.findIndex((a) => a === "--host" || a.startsWith("--host="));
if (hostFlag !== -1) {
  const inline = args[hostFlag].match(/^--host=(.+)$/);
  const next = inline ? inline[1] : args[hostFlag + 1];
  if (!next || !/^[a-z0-9.-]+(?::\d+)?$/i.test(next)) {
    throw new Error("usage: --host=<bare-domain> (e.g. --host=www.casuya.co.tz — no scheme, no path)");
  }
  host = next;
}

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

let keyFile;
try {
  keyFile = readdirSync(FRONTEND).find(
    (f) => /^[0-9a-f]{32}\.txt$/.test(f) && readFileSync(join(FRONTEND, f), "utf8").trim() === f.replace(/\.txt$/, "")
  );
} catch {
  fail(`cannot read ${FRONTEND}`);
}
if (!keyFile) fail("IndexNow key file missing or mismatched (expects <32-hex-key>.txt with the key as its only content).");
const key = keyFile.replace(/\.txt$/, "");

let sitemap;
try {
  sitemap = readFileSync(join(FRONTEND, "sitemap.xml"), "utf8");
} catch {
  fail("sitemap.xml not found under apps/platform/frontend/.");
}

// The sitemap lists www URLs today; rebase them onto the requested host so both
// the canonical (www) and apex hosts can be pinged with the same script.
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  m[1].replace(/^https:\/\/(www\.)?casuya\.co\.tz\//, `https://${host}/`)
);
if (!urlList.length) fail("no <loc> entries found in sitemap.xml.");

const keyLocation = `https://${host}/${key}.txt`;
const payload = { host, key, keyLocation, urlList };

if (dryRun) {
  console.log(`[dry-run] would submit ${urlList.length} URL(s) for host ${host}`);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

if (!urlList.every((u) => new URL(u).hostname === host)) {
  fail(`submitted URL set does not match host ${host} — refusing to ping the wrong host.`);
}

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});

if (response.ok) {
  console.log(`✓ IndexNow accepted ${urlList.length} URL(s) for ${host} (HTTP ${response.status}).`);
} else {
  const body = await response.text();
  fail(
    `IndexNow rejected the submission (HTTP ${response.status}${body ? `: ${body})` : ")"}\n` +
      `Check the key file is live at ${keyLocation}* and try again.`
  );
}