/**
 * Measure a Worker's bundle WITHOUT deploying it. Shared by every Worker app in the repo.
 *
 *   pnpm bundle:size          (in any Worker app) build if it needs one, then measure
 *   pnpm bundle:size:fast     measure what is already on disk - skips the Next.js build
 *
 * Each app's package.json points at this one file, so there is one implementation to fix, not nine
 * copies to keep in step. It runs in the app's own folder (pnpm sets the cwd to the package).
 *
 * ## Nothing here uploads
 *
 * `wrangler deploy --dry-run --outdir` bundles exactly what a real deploy would upload, writes it to
 * disk and exits before talking to Cloudflare. The size is read off that output.
 *
 * ## The limit is 64 MiB UNCOMPRESSED, Free and Paid alike
 *
 * Cloudflare Workers limits, re-checked 2026-10-09: "There is no compressed size limit. Only the
 * uncompressed bundle size counts." The `Total Upload` figure wrangler prints is the one that counts;
 * gzip is shown for reference. The "10 MB" people remember is the OLD Paid-plan gzip limit - both are
 * printed so the old mental model and the current rule can be read side by side.
 *
 * ## What it works out per app, so no app has to configure anything
 *
 * - **Does it need a build first?** A Next.js app on OpenNext deploys `.open-next/`, which only exists
 *   after `opennextjs-cloudflare build`. If the app has `@opennextjs/cloudflare` it runs the app's OWN
 *   `deploy:build` script (in Sajilo: `opennextjs-cloudflare build` + strip-bundled-env) - never a
 *   guessed command. A plain Worker (services, public-api, worker) needs nothing: wrangler bundles `src/`.
 * - **Which environments?** The top level of the wrangler config, plus every `env.<name>` it declares.
 *   This replaced a hard-coded `staging` + `--env prod` pair from the project this was first written
 *   for; no app here declares an `env` section, so today each app measures one target.
 *
 * ## The output is never committed
 *
 * It lands in `.wrangler/bundle-size/`, git-ignored at the repo root. An OpenNext bundle built on this
 * machine carries the local `.env` files as runtime fallbacks - fine on disk, never in git.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMIT_BYTES = 64 * 1024 * 1024; // 64 MiB uncompressed - the real limit
const LEGACY_GZIP_BYTES = 10 * 1024 * 1024; // the retired Paid-plan gzip limit, reference only
const WARN_AT = 0.8; // flag past 80% so growth is seen before the wall
const OUT_ROOT = join('.wrangler', 'bundle-size');

const mib = (b: number) => `${(b / 1024 / 1024).toFixed(2)} MiB`;
const pct = (b: number, of: number) => `${((b / of) * 100).toFixed(1)}%`;

interface PackageJson {
    name?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

function readPackageJson(): PackageJson {
    return JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;
}

function findWranglerConfig(): string | null {
    for (const f of ['wrangler.jsonc', 'wrangler.json', 'wrangler.toml']) if (existsSync(f)) return f;
    return null;
}

/** Strip `//` and `/* *\/` comments and trailing commas from JSONC, leaving string contents alone. */
function jsoncToJson(text: string): string {
    let out = '';
    let inString = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]!;
        const next = text[i + 1];
        if (inString) {
            out += ch;
            if (ch === '\\') { out += next ?? ''; i++; continue; }
            if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') { inString = true; out += ch; continue; }
        if (ch === '/' && next === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
        if (ch === '/' && next === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i++; continue; }
        out += ch;
    }
    return out.replace(/,(\s*[}\]])/g, '$1');
}

/** The environments a wrangler config declares, beyond its top level. */
function declaredEnvs(configFile: string): string[] {
    const text = readFileSync(configFile, 'utf8');
    if (configFile.endsWith('.toml')) {
        // `[env.prod]`, `[env.prod.vars]`, `[[env.prod.d1_databases]]` all name the env `prod`.
        const names = [...text.matchAll(/^\s*\[\[?env\.([A-Za-z0-9_-]+)/gm)].map((m) => m[1]!);
        return [...new Set(names)];
    }
    const parsed = JSON.parse(jsoncToJson(text)) as { env?: Record<string, unknown> };
    return Object.keys(parsed.env ?? {});
}

function dirBytes(dir: string): { total: number; files: { path: string; bytes: number }[] } {
    const files: { path: string; bytes: number }[] = [];
    const walk = (d: string) => {
        for (const e of readdirSync(d)) {
            const p = join(d, e);
            const s = statSync(p);
            if (s.isDirectory()) walk(p);
            else files.push({ path: p, bytes: s.size });
        }
    };
    if (existsSync(dir)) walk(dir);
    return { total: files.reduce((n, f) => n + f.bytes, 0), files };
}

/** wrangler prints "Total Upload: 12.34 MiB / gzip: 2.34 MiB" - the authoritative number. */
function parseWranglerTotals(stdout: string): { upload?: number; gzip?: number } {
    const toBytes = (n: string, unit: string) => {
        const v = parseFloat(n);
        return unit === 'MiB' ? v * 1024 * 1024 : unit === 'KiB' ? v * 1024 : v;
    };
    const m = stdout.match(/Total Upload:\s*([\d.]+)\s*(KiB|MiB|B)\s*\/\s*gzip:\s*([\d.]+)\s*(KiB|MiB|B)/);
    if (!m) return {};
    return { upload: toBytes(m[1]!, m[2]!), gzip: toBytes(m[3]!, m[4]!) };
}

function run(cmd: string, args: string[], opts: { capture: boolean }) {
    return spawnSync(cmd, args, {
        stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        env: process.env,
    });
}

function main(): number {
    const noBuild = process.argv.includes('--no-build');
    const pkg = readPackageJson();
    const app = pkg.name ?? process.cwd();

    const configFile = findWranglerConfig();
    if (!configFile) {
        console.error(`${app}: no wrangler.jsonc / wrangler.json / wrangler.toml here - not a Worker.`);
        return 1;
    }

    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const isOpenNext = '@opennextjs/cloudflare' in deps;

    if (isOpenNext) {
        if (!noBuild) {
            const buildScript = pkg.scripts?.['deploy:build'];
            const [cmd, args] = buildScript
                ? ['pnpm', ['run', 'deploy:build']]
                : ['pnpm', ['exec', 'opennextjs-cloudflare', 'build']];
            console.log(`\n> ${cmd} ${args.join(' ')}   (Next.js build, a few minutes; use bundle:size:fast to skip)\n`);
            const b = run(cmd, args, { capture: false });
            if (b.status !== 0) {
                console.error(`\nThe build failed (exit ${b.status}). Nothing was measured.`);
                return b.status ?? 1;
            }
        } else if (!existsSync('.open-next')) {
            console.error(`${app}: no .open-next on disk yet. Run \`pnpm bundle:size\` once (it builds), then :fast works.`);
            return 1;
        } else if (!existsSync(join('.open-next', 'worker.js')) || !existsSync(join('.open-next', 'assets'))) {
            // A build that was interrupted, or a dev run, leaves a PARTIAL .open-next - apps/main had one
            // with no assets/ folder, and wrangler's "assets.directory does not exist" reads like a config
            // bug rather than "build first".
            console.error(`${app}: .open-next is incomplete (missing worker.js or assets/). Run \`pnpm bundle:size\` to rebuild it.`);
            return 1;
        }
    }

    const targets = [
        { name: 'default', args: [] as string[] },
        ...declaredEnvs(configFile).map((e) => ({ name: e, args: ['--env', e] })),
    ];

    let over = false;
    const rows: string[] = [];

    for (const t of targets) {
        const out = join(OUT_ROOT, t.name);
        rmSync(out, { force: true, recursive: true });

        const args = ['exec', 'wrangler', 'deploy', '--dry-run', ...t.args, '--outdir', out];
        console.log(`> pnpm ${args.join(' ')}`);
        const res = run('pnpm', args, { capture: true });
        const text = `${res.stdout ?? ''}${res.stderr ?? ''}`;
        if (res.status !== 0) {
            console.error(text.split('\n').slice(-25).join('\n'));
            console.error(`\nwrangler exited ${res.status} for ${t.name}. Nothing was uploaded.`);
            return res.status ?? 1;
        }

        const { total, files } = dirBytes(out);
        const byName = files.find((f) => /[\\/](worker|index)\.js$/.test(f.path));
        const largest = byName ?? [...files].sort((a, b) => b.bytes - a.bytes)[0];
        const parsed = parseWranglerTotals(text);
        const upload = parsed.upload ?? total;
        const gzip = parsed.gzip ?? (largest ? gzipSync(readFileSync(largest.path)).byteLength : 0);

        const ratio = upload / LIMIT_BYTES;
        const status = ratio >= 1 ? 'OVER' : ratio >= WARN_AT ? 'WARN' : 'ok';
        if (ratio >= 1) over = true;

        rows.push(
            `${t.name.padEnd(8)} ${mib(upload).padStart(11)}  ${pct(upload, LIMIT_BYTES).padStart(6)} of 64 MiB   ` +
            `gzip ${mib(gzip).padStart(10)}  ${pct(gzip, LEGACY_GZIP_BYTES).padStart(6)} of old 10 MiB   ${status}`,
        );
        if (largest) rows.push(`         main file: ${largest.path} (${mib(largest.bytes)}), ${files.length} file(s) in ${out}`);
    }

    console.log(`\n${app} - Worker bundle size (nothing was uploaded)`);
    console.log('-'.repeat(100));
    for (const r of rows) console.log(r);
    console.log('-'.repeat(100));
    console.log('Limit: 64 MiB UNCOMPRESSED ("Total Upload"), Free and Paid. gzip is reference only; 10 MiB was the old gzip limit.');
    console.log(`WARN at ${WARN_AT * 100}%. Output stays under ${OUT_ROOT}/ (git-ignored).`);
    return over ? 1 : 0;
}

process.exit(main());
