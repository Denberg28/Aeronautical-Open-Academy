import { downloadArtifact } from "@electron/get";
import { extract } from "@electron-internal/extract-zip";
import { execFileSync } from "node:child_process";
import { mkdir, cp, rename, rm, writeFile, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
const desktop = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(desktop, "..");
const pkg = JSON.parse(await readFile(join(desktop, "package.json"), "utf8"));
const output = join(root, "out", `Academy-PC-${pkg.version}-win32-x64`);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const zip = await downloadArtifact({
  version: pkg.devDependencies.electron,
  artifactName: "electron",
  platform: "win32",
  arch: "x64",
});
await extract(zip, { dir: output });
await rename(join(output, "electron.exe"), join(output, "Academy.exe"));
await rm(join(output, "resources", "default_app.asar"), { force: true });
const dest = join(output, "resources", "app");
await mkdir(join(dest, "desktop"), { recursive: true });
for (const path of [
  "main.mjs",
  "preload.cjs",
  "bridge.mjs",
  "materials.mjs",
  "enrollment.mjs",
  "vendor",
  "package.json",
  "ui",
])
  await cp(join(desktop, path), join(dest, "desktop", path), {
    recursive: true,
  });
await writeFile(
  join(dest, "package.json"),
  JSON.stringify({
    name: pkg.name,
    version: pkg.version,
    main: "desktop/main.mjs",
    type: "module",
  }),
);
await cp(join(root, "server", "src"), join(dest, "server", "src"), {
  recursive: true,
});
await cp(join(root, "LICENSE"), join(dest, "LICENSE"));
await cp(join(desktop, "README.md"), join(output, "READ-ME.md"));
const source =
  process.env.GITHUB_SHA ||
  execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
await writeFile(join(output, "source-commit.txt"), source + "\n");
await cp(
  join(root, "docs", "DESKTOP_TESTING.md"),
  join(output, "VERIFICATION.md"),
);
await cp(join(root, "docs", "DESKTOP_RELEASE_NOTES.md"), join(output, "RELEASE-NOTES.md"));
const hashes = {};
async function hashFiles(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) await hashFiles(join(dir, entry.name), name + "/");
    else hashes[name] = createHash("sha256").update(await readFile(join(dir, entry.name))).digest("hex");
  }
}
await hashFiles(output);
await writeFile(join(output, "package-manifest.json"), JSON.stringify({ version: pkg.version, source, electron: pkg.devDependencies.electron, platform: "win32-x64", sha256: hashes }, null, 2) + "\n");
console.log(output);
