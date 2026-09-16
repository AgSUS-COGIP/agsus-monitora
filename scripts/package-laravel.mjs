import { cp, mkdir, access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const pages = ["index.html", "analises.html", "auth/callback.html"];
const assets = [
  "assets",
  "icons",
  "manifest.webmanifest",
  "offline.html",
  "sw.js",
  "sw-policy.js",
];
await Promise.all(
  [...pages, ...assets].map((path) => access(resolve(root, "dist", path))),
);
for (const file of pages) {
  const dest = resolve(root, "laravel/resources/frontend", file);
  await mkdir(resolve(dest, ".."), { recursive: true });
  await cp(resolve(root, "dist", file), dest);
}
for (const file of assets) {
  await cp(resolve(root, "dist", file), resolve(root, "laravel/public", file), {
    recursive: true,
  });
}
console.log(
  "MONITORA preparado para Laravel: páginas privadas ao servidor e assets públicos.",
);
