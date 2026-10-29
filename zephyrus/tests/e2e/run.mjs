// Click-through tests in a real browser (Playwright + Chromium).
//
//   npm run dev              then   npm run test:e2e             (the Next app, default http://localhost:3000)
//   npm run test:e2e -- http://localhost:3100                    (another port)
//   npm run test:e2e:spa                                         (builds the single-file copy and tests it)
//
// First time on a machine: npx playwright install chromium
import { build } from "esbuild";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const out = join(here, ".out");
mkdirSync(out, { recursive: true });

// Fixtures: the old sample day (re-keyed so the app's sample cleanup leaves it alone) and a few made-up agents.
for (const [name, entry] of [["sample", "fixtures/sample.ts"], ["agents", "fixtures/agents.ts"]]) {
  await build({ entryPoints: [join(here, entry)], bundle: true, platform: "node", format: "cjs", outfile: join(out, `${name}.cjs`), logLevel: "warning" });
}

const spa = process.argv.includes("--spa");
let base = process.argv.slice(2).find((a) => a.startsWith("http")) ?? "http://localhost:3000";
let server;

if (spa) {
  execFileSync(process.execPath, [join(root, "spa/build.mjs")], { stdio: "inherit" });
  // The artifact host wraps the page in a document skeleton; do the same here.
  const page = readFileSync(join(root, "spa/dist/zephyrus.html"), "utf8");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page}</body></html>`;
  mkdirSync(join(out, "spa"), { recursive: true });
  writeFileSync(join(out, "spa/index.html"), html);
  server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  }).listen(4173);
  base = "http://localhost:4173";
}

const suites = spa
  ? [["spa-flows.js"], ["flows3.js", "hash"], ["cleanup.js", "hash"], ["queue-flows.js", "hash"], ["cloud-test.js", "hash"]]
  : [["flows.js"], ["flows2.js"], ["flows3.js"], ["cleanup.js"], ["queue-flows.js"], ["cloud-test.js"]];

let failed = 0;
for (const [file, mode] of suites) {
  console.log(`\n== ${file}${mode ? " (" + mode + ")" : ""}`);
  // Run each suite without blocking this process, which also serves the single-file copy.
  const r = await new Promise((done) => {
    const child = spawn(process.execPath, [join(here, file), base, ...(mode ? [mode] : [])], { cwd: root });
    let buf = "";
    child.stdout.on("data", (d) => (buf += d));
    child.stderr.on("data", (d) => (buf += d));
    child.on("close", (status) => done({ status, text: buf }));
  });
  const text = r.text;
  process.stdout.write(text);
  // Every suite ends by reporting browser errors; anything but "no … errors" counts as a failure.
  const last = text.trim().split("\n").pop() ?? "";
  if (r.status !== 0 || /^FAIL /m.test(text) || !/^no (console |page )?errors$/.test(last)) failed++;
}
server?.close();
console.log(failed ? `\n${failed} suite(s) failed` : "\nAll suites passed");
process.exit(failed ? 1 : 0);
