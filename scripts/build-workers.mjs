import { build } from "esbuild";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
const workers = {
  editor: "monaco-editor/esm/vs/editor/editor.worker.js",
  typescript: "monaco-editor/esm/vs/language/typescript/ts.worker.js",
  json: "monaco-editor/esm/vs/language/json/json.worker.js",
  css: "monaco-editor/esm/vs/language/css/css.worker.js",
  html: "monaco-editor/esm/vs/language/html/html.worker.js",
};
await mkdir("public/monaco-workers", { recursive: true });
await Promise.all(Object.entries(workers).map(([name, entry]) => build({
  entryPoints: [resolve("node_modules", entry)], bundle: true, minify: true, format: "iife", platform: "browser",
  outfile: `public/monaco-workers/${name}.js`, logLevel: "warning",
})));
console.log("Built 5 self-hosted Monaco workers.");
