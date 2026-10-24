import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dirname, "../..");
const pkg = JSON.parse(
  await readFile(join(root, "desktop/package.json"), "utf8"),
);
const dir = join(root, "out", `Academy-PC-${pkg.version}-win32-x64`);
const exe = await readFile(join(dir, "Academy.exe"));
assert.equal(exe.subarray(0, 2).toString(), "MZ");
const pe = exe.readUInt32LE(0x3c);
assert.equal(exe.readUInt16LE(pe + 4), 0x8664);
for (const file of [
  "resources/app/package.json",
  "resources/app/desktop/main.mjs",
  "resources/app/desktop/preload.cjs",
  "resources/app/desktop/bridge.mjs",
  "resources/app/desktop/ui/index.html",
  "resources/app/desktop/ui/app.js",
  "resources/app/desktop/ui/style.css",
  "resources/app/server/src/server.mjs",
  "resources/app/server/src/schema.sql",
  "resources/app/server/src/store.mjs",
  "READ-ME.md",
])
  assert.ok((await readFile(join(dir, file))).length, file);
const walk = async (folder) => {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    assert.ok(
      !/\.sqlite|^\.env$|\.pem$|\.key$|\.jks$|\.keystore$/i.test(entry.name),
      path,
    );
    if (entry.isDirectory()) await walk(path);
  }
};
await walk(dir);
console.log(
  "PASS: Windows x64 PE, packaged renderer/preload/backend/schema and user guide, no data or key files.",
);
