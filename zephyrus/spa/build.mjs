// Builds Zephyrus as one self-contained HTML file (dist/zephyrus.html) for
// hosting as a Claude artifact: CSS and fonts inlined, React 18 from cdnjs.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = resolve(root, "spa/.tmp");
const dist = resolve(root, "spa/dist");
mkdirSync(tmp, { recursive: true });
mkdirSync(dist, { recursive: true });

// 1. CSS: the app's own globals, fonts embedded, compiled by Tailwind.
const font = (pkg, file, family) => {
  const b64 = readFileSync(resolve(root, "node_modules/@fontsource-variable", pkg, "files", file)).toString("base64");
  return `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:100 900;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
};
let css = readFileSync(resolve(root, "app/globals.css"), "utf8")
  .replace('@import "@fontsource-variable/bricolage-grotesque";\n', "")
  .replace('@import "@fontsource-variable/onest";\n', "");
css = css.replace(
  '@import "tailwindcss";',
  [
    '@import "tailwindcss";',
    '@source "../../app";',
    '@source "../../components";',
    '@source "../../lib";',
    '@source "../shims";',
    font("onest", "onest-latin-wght-normal.woff2", "Onest Variable"),
    font("bricolage-grotesque", "bricolage-grotesque-latin-wght-normal.woff2", "Bricolage Grotesque Variable"),
  ].join("\n"),
);
writeFileSync(resolve(tmp, "styles.css"), css);
execFileSync(resolve(root, "node_modules/.bin/tailwindcss"), ["-i", resolve(tmp, "styles.css"), "-o", resolve(tmp, "out.css"), "--minify"], { cwd: tmp, stdio: "inherit" });

// 2. JS: React and ReactDOM come from the page's CDN scripts as globals.
const globals = {
  name: "globals",
  setup(b) {
    const map = { react: "React", "react-dom": "ReactDOM", "react-dom/client": "ReactDOM" };
    b.onResolve({ filter: /^(react|react-dom|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/ }, (a) => ({ path: a.path, namespace: "g" }));
    b.onLoad({ filter: /.*/, namespace: "g" }, (a) => {
      if (a.path.startsWith("react/jsx")) {
        return {
          contents: `const R = window.React; const j = (t, p, k) => R.createElement(t, k === undefined ? p : { ...p, key: k }); module.exports = { jsx: j, jsxs: j, jsxDEV: j, Fragment: R.Fragment };`,
          loader: "js",
        };
      }
      return { contents: `module.exports = window.${map[a.path]};`, loader: "js" };
    });
  },
};
const out = await build({
  entryPoints: [resolve(root, "spa/main.tsx")],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "next/link": resolve(root, "spa/shims/next-link.tsx"), "next/navigation": resolve(root, "spa/shims/next-navigation.ts"), "@": root },
  plugins: [globals],
  loader: { ".webp": "dataurl" },
  logLevel: "warning",
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

// 3. One page. The artifact host adds doctype, head and body around it.
const reactSrc = process.env.REACT_SRC ?? "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js";
const domSrc = process.env.REACT_DOM_SRC ?? "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js";
const html = `<title>Zephyrus</title>
<meta name="description" content="Your YouTube channels and AI ad agency, in one day.">
<style>${readFileSync(resolve(tmp, "out.css"), "utf8")}</style>
<div id="root"></div>
<script src="${reactSrc}"></script>
<script src="${domSrc}"></script>
<script>${js}</script>
`;
const file = resolve(dist, process.env.OUT ?? "zephyrus.html");
writeFileSync(file, html);
console.log(`wrote ${file} (${(html.length / 1024).toFixed(0)} KB)`);
