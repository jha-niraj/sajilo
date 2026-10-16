/**
 * Navigation benchmark: how fast every bottom-bar page (and every page behind More) opens, cold and
 * after a hover.
 *
 * Copied from Gurukul's scripts/bench-navigation.mts (itself from the Ayudocs CRM, navigation-speed
 * playbook) and adapted to Sajilo on 2026-10-16 (plan/speed-record.md):
 *
 *    export BENCH_PHONE=98XXXXXXXX BENCH_PIN=XXXX     (leading space keeps it out of shell history)
 *   pnpm bench:nav --url=https://sajilo.shunyatechofficial.workers.dev --allow-production
 *   pnpm bench:nav --url=https://sajilo.shunyatechofficial.workers.dev --allow-production --throttle=3g
 *   pnpm bench:nav --url=https://sajilo.shunyatechofficial.workers.dev --probe=30 --probe-path=/,/munshi
 *
 * Sajilo specifics: sign-in is phone + 4-digit PIN on / (better-auth phoneNumber), the start page is
 * /munshi, the "sidebar" is the bottom bar (<nav>) and More opens a menu (role=menu) whose links are
 * measured too (the menu is opened before each click), skeletons are `.gk-shimmer`/`.animate-pulse`
 * inside <main>, and client reads are Server Action POSTs (a `next-action` header), counted as "reads".
 * Use a TEST account (98000000xx) on production, never his real one.
 *
 *   --url=<origin>       the deployed app to measure (required). Staging, or a local `next start`;
 *                        `next dev` turns prefetching off, so its numbers mean nothing here.
 *   --runs=3             measurements per page and mode; the report takes the median
 *   --routes=/a,/b       only these sidebar hrefs (default: every link in the sidebar)
 *   --start=/munshi      the page every measurement starts from (where sign-in lands)
 *   --out=docs/benchmarks where the report goes
 *   --headed             watch it run
 *   --throttle=none      network emulation: none (default), fast-4g, slow-4g or 3g, Chrome DevTools'
 *                        own presets. Applied after sign-in, so only the measured clicks pay for it
 *   --cpu=1              CPU slowdown factor (4 is a mid-range phone, as Lighthouse uses)
 *   --probe=30           cold-start probe, no browser and no sign-in (see the probe section below)
 *   --probe-path=/,/munshi           the paths it alternates over
 *   --allow-production   measure the client's live site (refused otherwise: a run renders every
 *                        page several times and opens a session)
 *
 * The sign-in comes from BENCH_PHONE / BENCH_PIN so no PIN is ever written into a file or
 * a command's history file by this script; it is never printed.
 *
 * WHAT IT MEASURES, per page:
 *   cold   the click with no hover first (the pointer arrives and clicks inside the 100ms intent):
 *            shown     click -> the URL changes, which is when Next commits the new page or its
 *                      loading.tsx skeleton; the "something happened" moment
 *            ready     click -> no skeleton left in <main> and every request it started has ended
 *            server    the page's RSC request: time to first byte, and to the end of the stream
 *            reads     browser reads (/api/read) after the click: how many, and the slowest read's
 *                      own server time (the `server-timing: read;dur=` the route sends)
 *            js        script bytes the click downloaded (the route's code not yet in the browser)
 *   warm   the same click after resting on the link 300ms, so the hover prefetch has landed:
 *            prefetch  how many requests the hover made, how long, how big
 *            shown / ready as above; with a full prefetch both should be near zero
 *   load   requests the start page makes with nobody touching it; the sidebar must make none
 *
 * Every page is measured from a fresh load of the start page, so the router cache is empty and one
 * page's prefetch cannot flatter the next.
 *
 * OUTPUT: docs/benchmarks/navigation-<date>-<HHMM UTC>-<host>.md (the table, slowest first) and .json (raw).
 * Reads only; it writes nothing to any database itself.
 */
import { chromium, type Page, type Request } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Arguments ────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name: string) => argv.includes(`--${name}`);

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const base = arg("url")?.replace(/\/$/, "") ?? fail("Missing --url=<origin>, e.g. --url=https://sajilo.shunyatechofficial.workers.dev");
const runs = Math.max(1, Number(arg("runs") ?? 3) || 3);
const startPath = arg("start") ?? "/munshi";
const outDir = arg("out") ?? "plan/benchmarks";
const onlyRoutes = arg("routes")?.split(",").map((r) => r.trim()).filter(Boolean);
const probeCount = Number(arg("probe") ?? 0) || 0;
const probePath = arg("probe-path") ?? "/";

// Chrome DevTools' presets (latency already multiplied the way DevTools does), throughput in kbit/s.
const THROTTLE: Record<string, { latencyMs: number; downKbps: number; upKbps: number } | null> = {
  none: null,
  "fast-4g": { latencyMs: 165, downKbps: 9000, upKbps: 1500 },
  "slow-4g": { latencyMs: 563, downKbps: 1600, upKbps: 750 },
  "3g": { latencyMs: 2000, downKbps: 400, upKbps: 400 },
};
const throttleName = arg("throttle") ?? "none";
if (!(throttleName in THROTTLE)) fail(`Unknown --throttle=${throttleName}. One of: ${Object.keys(THROTTLE).join(", ")}`);
const throttle = THROTTLE[throttleName] ?? null;
const cpuRate = Math.max(1, Number(arg("cpu") ?? 1) || 1);
const throttleLabel = [throttle ? throttleName : null, cpuRate > 1 ? `cpu-${cpuRate}x` : null].filter(Boolean).join("-");
const phone = probeCount ? "" : (process.env.BENCH_PHONE ?? fail("Set BENCH_PHONE (and BENCH_PIN) for the TEST account to sign in as."));
const pin = probeCount ? "" : (process.env.BENCH_PIN ?? fail("Set BENCH_PIN."));
const e164 = phone.startsWith("+") ? phone : `+977${phone.replace(/\D/g, "").slice(-10)}`;

// The client's live site only on purpose: compare hosts with .env.production's auth URL.
const host = new URL(base).host;
const prodHost = (() => {
  const envFile = "apps/main/.env.production";
  if (!existsSync(envFile)) return null;
  const line = readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => l.startsWith("BETTER_AUTH_URL="));
  try {
    return line ? new URL(line.slice("BETTER_AUTH_URL=".length).trim().replace(/^["']|["']$/g, "")).host : null;
  } catch {
    return null;
  }
})();
if (prodHost && host === prodHost && !flag("allow-production")) {
  fail(`${host} is production. Pass --allow-production to measure the client's live site on purpose.`);
}

// ── Request log ──────────────────────────────────────────────────────────────────────────────────
interface Rec {
  url: string;
  type: string;
  rsc: boolean;
  start: number;
  end: number | null;
  ttfb: number | null;
  bytes: number;
  serverMs: number | null;
  /** A Server Action POST (header `next-action`): how apps/main's client queries read. */
  action: boolean;
  /** A router prefetch (background warm-up for the NEXT tap), not part of opening this page. */
  prefetch: boolean;
  /** x-isolate-requests from the middleware: 1 means a fresh isolate answered. */
  isolateRequests: number | null;
  isolateAgeMs: number | null;
}

const TRACKED = new Set(["document", "fetch", "xhr", "script"]);

function track(page: Page) {
  const recs: Rec[] = [];
  const open = new Map<Request, Rec>();
  page.on("request", (req) => {
    if (!TRACKED.has(req.resourceType())) return;
    const rec: Rec = {
      url: req.url(),
      type: req.resourceType(),
      rsc: req.headers()["rsc"] === "1",
      action: req.method() === "POST" && Boolean(req.headers()["next-action"]),
      prefetch: Boolean(req.headers()["next-router-prefetch"] || req.headers()["next-router-segment-prefetch"]),
      start: Date.now(),
      end: null,
      ttfb: null,
      bytes: 0,
      serverMs: null,
      isolateRequests: null,
      isolateAgeMs: null,
    };
    recs.push(rec);
    open.set(req, rec);
  });
  const finish = async (req: Request) => {
    const rec = open.get(req);
    if (!rec) return;
    open.delete(req);
    rec.end = Date.now();
    const t = req.timing();
    if (t.responseStart > 0) rec.ttfb = Math.round(t.responseStart);
    try {
      rec.bytes = Math.max(0, (await req.sizes()).responseBodySize);
      const headers = (await req.response())?.headers() ?? {};
      const m = /read;dur=(\d+(?:\.\d+)?)/.exec(headers["server-timing"] ?? "");
      if (m) rec.serverMs = Number(m[1]);
      if (headers["x-isolate-requests"]) rec.isolateRequests = Number(headers["x-isolate-requests"]);
      if (headers["x-isolate-age-ms"]) rec.isolateAgeMs = Number(headers["x-isolate-age-ms"]);
    } catch {
      // A request the page abandoned has no sizes; it still counts as ended.
    }
  };
  page.on("requestfinished", finish);
  page.on("requestfailed", finish);
  return {
    recs,
    // "Quiet" means the page is done: background prefetches for the next tap are counted, not waited on.
    inflight: () => [...open.values()].filter((r) => !r.prefetch).length,
    since: (t: number) => recs.filter((r) => r.start >= t),
  };
}

type Tracker = ReturnType<typeof track>;

async function quiet(t: Tracker, quietMs = 500, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let calmSince = Date.now();
  while (Date.now() < deadline) {
    if (t.inflight() > 0) calmSince = Date.now();
    else if (Date.now() - calmSince >= quietMs) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

const SKELETON = "main .gk-shimmer, main .animate-pulse";
const skeletonCount = (page: Page) => page.locator(SKELETON).count();

/**
 * An UNPINNED sidebar sits off-screen until the pointer touches the left edge (the 12px hot edge
 * peeks it in). Rest the pointer there and wait for the rail's links to become visible. A no-op
 * when the sidebar is pinned. The first baseline found 0 pages because of this.
 */
/** Bottom-bar links plus, while it is open, the More menu's links (Radix portals it to <body>). */
const RAIL_LINKS = 'nav a[href^="/"], [role="menu"] a[href^="/"]';
const railLink = (href: string) => `nav a[href="${href}"], [role="menu"] a[href="${href}"]`;

async function revealSidebar(page: Page): Promise<void> {
  const visible = () =>
    page.locator(RAIL_LINKS).evaluateAll((els) =>
      els.some((e) => {
        const r = (e as HTMLElement).getBoundingClientRect();
        return r.width > 0 && r.right > 0 && r.left < window.innerWidth;
      })
    );
  if (await visible()) return;
  await page.mouse.move(215, 860);
  for (let i = 0; i < 20 && !(await visible()); i++) await page.waitForTimeout(100);
}

/** The sidebar's module rows: buttons that open ONE group of links at a time. */
const MODULE_BUTTONS = 'nav button[aria-haspopup="menu"]';
/** href -> index of the module button whose group holds it (absent: always visible). */
const moduleOf = new Map<string, number>();

async function openModuleFor(page: Page, href: string): Promise<void> {
  await revealSidebar(page);
  const i = moduleOf.get(href);
  if (i === undefined) return;
  const btn = page.locator(MODULE_BUTTONS).nth(i);
  if ((await btn.getAttribute("aria-expanded")) !== "true") {
    await btn.click();
    await page.locator(railLink(href)).first().waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
  }
}

/** A fresh start page with every sidebar group open, the pointer parked over <main>. */
async function freshStart(page: Page, t: Tracker): Promise<void> {
  await page.goto(base + startPath, { waitUntil: "load" });
  await quiet(t);
  // Groups are opened per link in measure(), so the start page is measured as a person finds it.
  await page.mouse.move(215, 400);
  await quiet(t);
}

// ── One measurement ──────────────────────────────────────────────────────────────────────────────
interface Sample {
  shownMs: number;
  readyMs: number;
  skeletonTimedOut: boolean;
  /** RSC requests the new page fired itself after the click (its own links prefetching on sight). */
  pagePrefetches: number;
  /** The request that ended last, which is what "ready" waited for. */
  lastRequest: string | null;
  /** The page's server render came from a fresh isolate (a cold start). */
  coldRender: boolean;
  rscTtfbMs: number | null;
  rscEndMs: number | null;
  reads: number;
  slowestReadMs: number | null;
  jsKb: number;
  prefetchRequests?: number;
  prefetchMs?: number;
  prefetchKb?: number;
}

const pathOf = (href: string) => new URL(href, base).pathname + new URL(href, base).search;

async function measure(page: Page, t: Tracker, href: string, warm: boolean): Promise<Sample | null> {
  await freshStart(page, t);
  await openModuleFor(page, href);
  // Park the pointer INSIDE the rail (it stays open while hovered) rather than out over <main>,
  // which would let an unpinned rail slide away before the click.
  await page.mouse.move(215, 860);
  await quiet(t);
  const link = page.locator(railLink(href)).first();
  if (!(await link.isVisible())) return null;

  let prefetch: Pick<Sample, "prefetchRequests" | "prefetchMs" | "prefetchKb"> = {};
  if (warm) {
    const h0 = Date.now();
    await link.hover();
    await page.waitForTimeout(300);
    await quiet(t);
    const recs = t.since(h0).filter((r) => r.rsc);
    const ends = recs.map((r) => r.end ?? h0);
    prefetch = {
      prefetchRequests: recs.length,
      prefetchMs: recs.length ? Math.max(...ends) - h0 : 0,
      prefetchKb: Math.round(recs.reduce((a, r) => a + r.bytes, 0) / 1024),
    };
  }

  const target = pathOf(href);
  const t0 = Date.now();
  await link.click();
  await page.waitForURL((u) => u.pathname + u.search === target, { timeout: 30_000 });
  const shownMs = Date.now() - t0;

  let skeletonTimedOut = false;
  let skeletonGoneAt = Date.now();
  try {
    await page.waitForFunction((sel) => document.querySelectorAll(sel).length === 0, SKELETON, {
      timeout: 30_000,
    });
    skeletonGoneAt = Date.now();
  } catch {
    skeletonTimedOut = true;
  }
  await quiet(t);
  if ((await skeletonCount(page)) > 0) skeletonTimedOut = true;

  const after = t.since(t0);
  const lastEnd = Math.max(skeletonGoneAt, ...after.filter((r) => !r.prefetch).map((r) => r.end ?? t0));
  const rscAll = after.filter((r) => r.rsc && r.type === "fetch");
  // The page's own render: the first RSC request that is not a background prefetch.
  const rsc = rscAll.find((r) => !r.prefetch) ?? rscAll[0];
  const last = [...after].filter((r) => r.end !== null && !r.prefetch).sort((a, b) => (b.end ?? 0) - (a.end ?? 0))[0];
  const short = (u: string) => {
    const x = new URL(u);
    return `${x.pathname}${x.search.includes("_rsc") ? " (rsc)" : ""}`.slice(0, 60);
  };
  const reads = after.filter((r) => r.action || r.url.includes("/api/read/"));
  // Server Actions send no server-timing; their whole round trip is the honest figure.
  const readTimes = reads.map((r) => r.serverMs ?? (r.end !== null ? r.end - r.start : null)).filter((v): v is number => v !== null);

  return {
    shownMs,
    readyMs: lastEnd - t0,
    skeletonTimedOut,
    rscTtfbMs: rsc?.ttfb ?? null,
    rscEndMs: rsc?.end ? rsc.end - rsc.start : null,
    reads: reads.length,
    slowestReadMs: readTimes.length ? Math.max(...readTimes) : null,
    jsKb: Math.round(after.filter((r) => r.type === "script").reduce((a, r) => a + r.bytes, 0) / 1024),
    pagePrefetches: rscAll.filter((r) => r.prefetch).length,
    lastRequest: last ? `${short(last.url)} ${last.end! - last.start}ms` : null,
    coldRender: rsc?.isolateRequests === 1,
    ...prefetch,
  };
}

function median(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : Math.round((v[mid - 1]! + v[mid]!) / 2);
}

function summarise(samples: Sample[]) {
  const pick = <K extends keyof Sample>(k: K) => median(samples.map((s) => s[k] as number | null | undefined));
  return {
    shownMs: pick("shownMs"),
    readyMs: pick("readyMs"),
    rscTtfbMs: pick("rscTtfbMs"),
    rscEndMs: pick("rscEndMs"),
    reads: pick("reads"),
    slowestReadMs: pick("slowestReadMs"),
    jsKb: pick("jsKb"),
    prefetchRequests: pick("prefetchRequests"),
    prefetchMs: pick("prefetchMs"),
    prefetchKb: pick("prefetchKb"),
    skeletonStuck: samples.some((s) => s.skeletonTimedOut),
    pagePrefetches: pick("pagePrefetches"),
    lastRequest: samples[Math.floor(samples.length / 2)]?.lastRequest ?? null,
    coldRenders: samples.filter((s) => s.coldRender).length,
  };
}

process.on("unhandledRejection", (err) => fail(`Stopped: ${String((err as Error)?.message ?? err).split("\n")[0]}`));
process.on("uncaughtException", (err) => fail(`Stopped: ${String(err?.message ?? err).split("\n")[0]}`));

// ── Run ──────────────────────────────────────────────────────────────────────────────────────────
// ── Probe: cold starts without a browser or a sign-in ───────────────────────────────────────────
// `--probe=30` requests each path in `--probe-path` (default /) 30 times, alternating, each on
// a new connection, and reports every response's time to first byte with the isolate that answered
// (x-isolate-requests from the middleware: 1 is a fresh isolate, a cold start).
//
// Give it two paths to split the cost: `--probe-path=/,/munshi`. Signed out, /munshi is
// answered by the middleware's redirect before OpenNext loads the server bundle, while /
// renders a page and needs it. If a fresh isolate's redirect is fast and its page is slow, the cold
// start is the server bundle's load inside the first request, not Cloudflare starting the Worker.
// (It cannot be timed from inside: a Worker's clock does not move while code runs.)
if (probeCount) {
  const paths = probePath.split(",").map((p) => p.trim()).filter(Boolean);
  type Row = { i: number; path: string; ttfbMs: number; isolateRequests: number | null; status: number };
  const rows: Row[] = [];
  for (let i = 1; i <= probeCount; i++) {
    for (const path of paths) {
      const t = performance.now();
      const res = await fetch(base + path, { redirect: "manual", headers: { connection: "close" } });
      const ttfbMs = Math.round(performance.now() - t);
      await res.arrayBuffer();
      const n = res.headers.get("x-isolate-requests");
      rows.push({ i, path, ttfbMs, isolateRequests: n === null ? null : Number(n), status: res.status });
    }
  }
  const med = (v: number[]) => median(v) ?? 0;
  const now = new Date();
  const stampP = `${now.toISOString().slice(0, 10)}-${now.toISOString().slice(11, 19).replace(/:/g, "")}`;
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `probe-${stampP}-${host.replace(/[^a-z0-9.-]/gi, "_")}.md`);
  const summary = paths.map((path) => {
    const mine = rows.filter((r) => r.path === path);
    const fresh = mine.filter((r) => r.isolateRequests === 1);
    const warm = mine.filter((r) => (r.isolateRequests ?? 0) > 1);
    const unknown = mine.filter((r) => r.isolateRequests === null).length;
    if (unknown === mine.length) {
      // A build without the isolate headers: fresh vs warm cannot be told apart, so report every
      // response together rather than two empty medians of 0 ms.
      return `- \`${path}\` (status ${[...new Set(mine.map((r) => r.status))].join("/")}): **${mine.length}** requests, median first byte **${med(mine.map((r) => r.ttfbMs))} ms**, slowest **${Math.max(...mine.map((r) => r.ttfbMs))} ms** (no isolate headers, so cold and warm are not separated)`;
    }
    return (
      `- \`${path}\` (status ${[...new Set(mine.map((r) => r.status))].join("/")}): fresh isolate **${fresh.length}** of ${mine.length}, ` +
      `median first byte **${med(fresh.map((r) => r.ttfbMs))} ms**; warm **${warm.length}**, median **${med(warm.map((r) => r.ttfbMs))} ms**` +
      (unknown ? `; ${unknown} without isolate headers` : "")
    );
  });
  const lines = [
    `# Cold-start probe - ${host} - ${stampP} UTC`,
    ``,
    `${probeCount} rounds over ${paths.length} path(s), alternating, each request on a new connection.`,
    ``,
    ...summary,
    ``,
    `| # | path | first byte ms | isolate requests | status |`,
    `|---|---|---|---|---|`,
    ...rows.map((r) => `| ${r.i} | \`${r.path}\` | ${r.ttfbMs} | ${r.isolateRequests ?? "-"} | ${r.status} |`),
    ``,
  ];
  writeFileSync(file, lines.join("\n"));
  console.log(`\n${summary.map((l) => "  " + l).join("\n")}\n  Report: ${file}\n`);
  process.exit(0);
}

const browser = await chromium.launch({ headless: !flag("headed") });
// Phone-sized: Sajilo is a phone app and the bottom bar is its navigation.
// Service workers blocked: Sajilo's worker warms 11 pages for offline use a few seconds after each
// load (which "ready" would wait for), and on a throttled network it answers navigations from its
// offline copy, which has no bottom bar. The benchmark measures the network path.
const context = await browser.newContext({ viewport: { width: 430, height: 900 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });

// Signed in from inside the page, as the app's own form does, so the cookie lands in this browser.
// Errors are reduced to their first line everywhere below: Playwright's full error text can quote
// response headers, and those carry the session cookie.
const page = await context.newPage();
await page.goto(`${base}/`, { waitUntil: "load" });
const signInStatus = await page.evaluate(
  async ([e, p]) =>
    (
      await fetch("/api/auth/sign-in/phone-number", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: e, password: p, rememberMe: true }),
      })
    ).status,
  [e164, pin] as const
);
if (signInStatus !== 200) fail(`Sign-in failed (${signInStatus}). Check BENCH_PHONE / BENCH_PIN for ${host}.`);

// Throttling goes on the page's CDP session, which outlives every goto below.
if (throttle || cpuRate > 1) {
  const cdp = await context.newCDPSession(page);
  if (throttle) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: throttle.latencyMs,
      downloadThroughput: (throttle.downKbps * 1000) / 8,
      uploadThroughput: (throttle.upKbps * 1000) / 8,
    });
  }
  if (cpuRate > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
}
const tracker = track(page);

// Requests the start page makes on its own: the sidebar should contribute none.
const loadT0 = Date.now();
await page.goto(base + startPath, { waitUntil: "load" });
await quiet(tracker, 1500);
const idlePrefetches = tracker.since(loadT0).filter((r) => r.rsc).length;

await freshStart(page, tracker);
await revealSidebar(page);
const sidebarHrefs = () =>
  page.locator(RAIL_LINKS).evaluateAll((els) =>
    els
      .filter((e) => {
        const r = (e as HTMLElement).getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right > 0;
      })
      .map((e) => e.getAttribute("href") ?? "")
  );
const found = new Set(await sidebarHrefs());
const moduleCount = await page.locator(MODULE_BUTTONS).count();
for (let i = 0; i < moduleCount; i++) {
  const btn = page.locator(MODULE_BUTTONS).nth(i);
  if (!(await btn.isVisible())) continue;
  await revealSidebar(page);
  if ((await btn.getAttribute("aria-expanded")) !== "true") await btn.click();
  await page.waitForTimeout(400);
  for (const h of await sidebarHrefs()) {
    if (!found.has(h)) {
      found.add(h);
      moduleOf.set(h, i);
    }
  }
}
if (found.size === 0) fail("Found no sidebar links on " + startPath + ". Pass --start=/home (or another page with the staff sidebar), or check the sign-in.");
const hrefs = [...found].filter((h) => h && h !== startPath && h !== "/" && !h.startsWith("/signup") && (!onlyRoutes || onlyRoutes.includes(h)));

console.log(`\n  ${host}: ${hrefs.length} sidebar pages, ${runs} run(s) each, cold and warm, ${throttleLabel || "no throttling"}.`);
console.log(`  Start page made ${idlePrefetches} prefetch request(s) with nobody touching it.\n`);

const results: { href: string; cold: ReturnType<typeof summarise> | null; warm: ReturnType<typeof summarise> | null; raw: { cold: Sample[]; warm: Sample[] } }[] = [];
for (const href of hrefs) {
  const raw = { cold: [] as Sample[], warm: [] as Sample[] };
  for (let i = 0; i < runs; i++) {
    for (const warm of [false, true]) {
      try {
        const s = await measure(page, tracker, href, warm);
        if (s) (warm ? raw.warm : raw.cold).push(s);
      } catch (err) {
        console.warn(`  ${href} (${warm ? "warm" : "cold"}) failed: ${(err as Error).message.split("\n")[0]}`);
      }
    }
  }
  const row = {
    href,
    cold: raw.cold.length ? summarise(raw.cold) : null,
    warm: raw.warm.length ? summarise(raw.warm) : null,
    raw,
  };
  results.push(row);
  console.log(
    `  ${href.padEnd(42)} cold shown ${String(row.cold?.shownMs ?? "-").padStart(5)}ms ready ${String(row.cold?.readyMs ?? "-").padStart(5)}ms` +
      `   warm shown ${String(row.warm?.shownMs ?? "-").padStart(5)}ms ready ${String(row.warm?.readyMs ?? "-").padStart(5)}ms`
  );
}
await browser.close();

// ── Report ───────────────────────────────────────────────────────────────────────────────────────
const now = new Date();
const date = now.toISOString().slice(0, 10);
// Date AND time in the file name: two runs on one day used to overwrite each other.
const stamp = `${date}-${now.toISOString().slice(11, 16).replace(":", "")}`;
mkdirSync(outDir, { recursive: true });
// A throttled run says so in its file name, so it is never read as the unthrottled baseline.
const stem = join(outDir, `navigation-${stamp}-${host.replace(/[^a-z0-9.-]/gi, "_")}${throttleLabel ? `-${throttleLabel}` : ""}`);
const allRecs = tracker.recs.filter((r) => r.isolateRequests !== null && r.ttfb !== null);
const freshRecs = allRecs.filter((r) => r.isolateRequests === 1);
const warmRecs = allRecs.filter((r) => (r.isolateRequests ?? 0) > 1);
const coldSummary = allRecs.length
  ? `Server responses from a fresh isolate (cold start): **${freshRecs.length} of ${allRecs.length}**, median first byte **${median(freshRecs.map((r) => r.ttfb)) ?? "-"} ms** against **${median(warmRecs.map((r) => r.ttfb)) ?? "-"} ms** warm.`
  : "No isolate headers in the responses: the deployed build predates the isolate headers (x-isolate-requests in apps/main/middleware.ts).";
writeFileSync(`${stem}.json`, JSON.stringify({ host, date, runs, startPath, throttle: throttleLabel || "none", idlePrefetches, coldSummary, results }, null, 2));

const n = (v: number | null | undefined) => (v === null || v === undefined ? "-" : String(v));
const sorted = [...results].sort((a, b) => (b.cold?.readyMs ?? 0) - (a.cold?.readyMs ?? 0));
const lines = [
  `# Navigation benchmark - ${host} - ${date}`,
  ``,
  `Median of ${runs} run(s) per page, each from a fresh load of \`${startPath}\`. Times in ms, sizes in KB.`,
  `Slowest first by cold "ready". Produced by \`scripts/bench-navigation.ts\`.`,
  throttle || cpuRate > 1
    ? `Throttled: ${throttle ? `${throttleName} (${throttle.latencyMs}ms latency, ${throttle.downKbps}/${throttle.upKbps} kbit/s down/up)` : "no network throttling"}, CPU ${cpuRate}x.`
    : `No throttling: full network speed and CPU.`,
  ``,
  `- Start page prefetch requests with nobody touching it: **${idlePrefetches}** (should be 0).`,
  `- ${coldSummary}`,
  `- **cold**: click with no hover. **warm**: click after resting on the link for 300ms.`,
  `- **shown**: click to the new page or its skeleton. **ready**: click to no skeleton and no request in flight.`,
  `- **page prefetches**: RSC requests the opened page fired by itself (its links prefetching on sight). **last request**: what \"ready\" waited for.`,
  `- **RSC ttfb / end**: the page's server render, first byte and end of stream. **reads**: Server Action POSTs (client queries) after the click, and the slowest one's round trip.`,
  ``,
  `| Page | cold shown | cold ready | RSC ttfb | RSC end | reads | slowest read | JS KB | hover requests | hover ms | hover KB | warm shown | warm ready | page prefetches | last request (cold) | cold renders | note |`,
  `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`,
  ...sorted.map((r) =>
    [
      `\`${r.href}\``,
      n(r.cold?.shownMs),
      n(r.cold?.readyMs),
      n(r.cold?.rscTtfbMs),
      n(r.cold?.rscEndMs),
      n(r.cold?.reads),
      n(r.cold?.slowestReadMs),
      n(r.cold?.jsKb),
      n(r.warm?.prefetchRequests),
      n(r.warm?.prefetchMs),
      n(r.warm?.prefetchKb),
      n(r.warm?.shownMs),
      n(r.warm?.readyMs),
      n(r.cold?.pagePrefetches),
      r.cold?.lastRequest ? `\`${r.cold.lastRequest}\`` : "-",
      `${(r.cold?.coldRenders ?? 0) + (r.warm?.coldRenders ?? 0)} of ${r.raw.cold.length + r.raw.warm.length}`,
      !r.cold && !r.warm ? "link not visible" : r.cold?.skeletonStuck || r.warm?.skeletonStuck ? "a skeleton never cleared" : "",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |")
  ),
  ``,
];
writeFileSync(`${stem}.md`, lines.join("\n"));
console.log(`\n  Report: ${stem}.md\n`);