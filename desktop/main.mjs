import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  net,
  session,
  shell,
} from "electron";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFile, readFile, stat, rename, unlink, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { startLocal, AcademyBridge } from "./bridge.mjs";
import {
  buildExportPackage,
  parseAndValidateImport,
  importPackage,
  MAX_PACKAGE_BYTES,
} from "./transfer.mjs";

const root = dirname(fileURLToPath(import.meta.url));
protocol.registerSchemesAsPrivileged([
  {
    scheme: "academy",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
let window,
  local,
  bridge,
  closing = false;
const smoke = process.argv.includes("--smoke-test");
const automated = !app.isPackaged && process.env.ACADEMY_TEST_DATA;
if (automated) app.setPath("userData", process.env.ACADEMY_TEST_DATA);
if (smoke)
  app.setPath(
    "userData",
    join(app.getPath("temp"), `academy-smoke-${process.pid}`),
  );
async function boot() {
  if (!smoke && !automated && !app.requestSingleInstanceLock()) app.quit();
  else {
    app.on("second-instance", () => {
      if (window) {
        if (window.isMinimized()) window.restore();
        window.focus();
      }
    });
    await app.whenReady();
    try {
      local = await startLocal(
        join(app.getPath("userData"), "local-test-workspace"),
        {legacyFixture:Boolean(automated&&process.env.ACADEMY_TEST_LEGACY_SEED==="1"),
         materialsForTests:Boolean(automated&&process.env.ACADEMY_TEST_PDFS==="1")},
      );
      bridge = new AcademyBridge(local, {
        openExternal: (url) =>
          automated ? Promise.resolve() : shell.openExternal(url),
      });
      protocol.handle("academy", (request) => {
        const url = new URL(request.url);
        const files = {
          "/": "index.html",
          "/index.html": "index.html",
          "/app.js": "app.js",
          "/reader.js": "reader.js",
          "/schedule.js": "schedule.js",
          "/presenter.js": "presenter.js",
          "/editor.js": "editor.js",
          "/style.css": "style.css",
        };
        if(url.host==='app'&&/^\/pdfjs\/(?:pdf(?:\.worker)?\.mjs|(?:cmaps|wasm|standard_fonts)\/[a-zA-Z0-9_.-]+)$/.test(url.pathname))
          return net.fetch(pathToFileURL(join(root,'vendor','pdfjs',url.pathname.slice(7))).href);
        if (url.host !== "app" || !files[url.pathname])
          return new Response("Not found", { status: 404 });
        return net.fetch(
          pathToFileURL(join(root, "ui", files[url.pathname])).href,
        );
      });
      session.defaultSession.on("will-download", event => event.preventDefault());
      session.defaultSession.setPermissionRequestHandler(
        (wc, permission, done) =>
          done(permission === "fullscreen" && wc.getURL() === "academy://app/"),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      window = new BrowserWindow({
        width: 1480,
        height: 960,
        minWidth: 1060,
        minHeight: 720,
        backgroundColor: "#f5f7fb",
        title: "Aeronautical Academy Repository",
        autoHideMenuBar: true,
        webPreferences: {
          preload: join(root, "preload.cjs"),
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          spellcheck: true,
          devTools: !app.isPackaged,
        },
      });
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("context-menu", (event) => event.preventDefault());
      window.webContents.on("before-input-event", (event, input) => {
        const key = String(input.key || "").toLowerCase();
        if ((input.control || input.meta) && ["p", "s"].includes(key))
          event.preventDefault();
      });
      window.webContents.on("will-navigate", (e) => e.preventDefault());
      window.webContents.on("will-attach-webview", (e) => e.preventDefault());
      window.webContents.on("will-prevent-unload", (event) => {
        const choice = dialog.showMessageBoxSync(window, {
          type: "question",
          buttons: ["Keep editing", "Discard and close"],
          defaultId: 0,
          cancelId: 0,
          title: "Unsaved work",
          message: "Close Aeronautical Academy Repository and discard your unsaved text?",
        });
        if (choice === 1) event.preventDefault();
      });
      const register = (name, fn) =>
        ipcMain.handle(name, async (event, ...args) => {
          if (
            event.sender !== window.webContents ||
            event.senderFrame !== window.webContents.mainFrame ||
            event.senderFrame.url !== "academy://app/"
          )
            throw new Error("Untrusted application frame.");
          try {
            return { ok: true, value: await fn(...args) };
          } catch (e) {
            return { ok: false, error: e.message, status: e.status };
          }
        });
      const pendingImports = new Map();
      register("academy:login", async (data) => ({...await bridge.login(data), version:app.getVersion()}));
      register("academy:request", (path, options) =>
        bridge.request(path, options),
      );
      register("academy:logout", async () => {
        pendingImports.clear();
        return bridge.logout();
      });
      register("academy:sync", () => bridge.sync());
      register("academy:read-material", (id, revision) => bridge.readMaterial(id, revision));
      register("academy:upload-material", async (id, version) => {
        const item=(await bridge.request(`/v1/items/${id}`)).item;
        if(!bridge.account||item.can_edit===false||!(bridge.account.role==='admin'||bridge.account.role==='instructor'&&item.owner_id===bridge.account.id))throw new Error('Instructor access required.');
        const selected=await dialog.showOpenDialog(window,{title:'Upload PDF material',properties:['openFile'],filters:[{name:'PDF',extensions:['pdf']}]});
        if(selected.canceled)return {canceled:true};
        if((await stat(selected.filePaths[0])).size>50*1024*1024)throw new Error('Choose a PDF up to 50 MiB.');
        return bridge.uploadMaterial(id,version,await readFile(selected.filePaths[0]));
      });
      register("academy:upload-image", async (subjectId, base64) => {
        if (typeof base64 !== "string" || base64.length > 7 * 1024 * 1024)
          throw new Error("Paste or choose an image up to 5 MB.");
        const bytes = Buffer.from(base64, "base64");
        return bridge.uploadImage(subjectId, bytes);
      });
      register("academy:pick-image", async (subjectId) => {
        if (!bridge.account || !["admin", "instructor"].includes(bridge.account.role))
          throw new Error("Administrator or instructor access required.");
        const selected = await dialog.showOpenDialog(window, {
          title: "Insert image",
          properties: ["openFile"],
          filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
        });
        if (selected.canceled) return { canceled: true };
        if ((await stat(selected.filePaths[0])).size > 5 * 1024 * 1024)
          throw new Error("Choose an image up to 5 MB.");
        return bridge.uploadImage(subjectId, await readFile(selected.filePaths[0]));
      });
      register("academy:read-image", (params) => bridge.readImage(params || {}));
      register("academy:export-package", async (options = {}) => {
        const scope = options?.scope === "repository" ? "repository" : "subject";
        const subjectId = typeof options?.subjectId === "string" ? options.subjectId : null;
        const pkg = await buildExportPackage(bridge, {
          scope,
          subjectId,
          appVersion: app.getVersion(),
        });
        let targetPath;
        if (automated) {
          targetPath = join(process.env.ACADEMY_TEST_DATA, pkg.filename);
        } else {
          const saved = await dialog.showSaveDialog(window, {
            title: scope === "repository" ? "Export repository backup" : "Export subject package",
            defaultPath: join(app.getPath("documents"), pkg.filename),
            filters: [{ name: "Aeronautical Academy Export", extensions: ["aoa.json", "json"] }],
          });
          if (saved.canceled || !saved.filePath) return { canceled: true };
          targetPath = saved.filePath;
        }
        const tempPath = `${targetPath}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
        try {
          await writeFile(tempPath, pkg.json, { encoding: "utf8", mode: 0o600 });
          await rename(tempPath, targetPath);
        } catch (err) {
          await unlink(tempPath).catch(() => {});
          throw err;
        }
        return {
          canceled: false,
          filename: basename(targetPath),
          summary: pkg.summary,
        };
      });
      register("academy:preview-import", async () => {
        if (!bridge.account || !["admin", "instructor"].includes(bridge.account.role)) {
          const err = new Error("Administrator or instructor access required.");
          err.status = 403;
          throw err;
        }
        let filePath;
        if (automated) {
          if (process.env.ACADEMY_TEST_IMPORT_FILE) {
            filePath = process.env.ACADEMY_TEST_IMPORT_FILE;
          } else {
            const entries = (await readdir(process.env.ACADEMY_TEST_DATA)).filter((name) =>
              name.endsWith(".aoa.json"),
            );
            if (!entries.length) throw new Error("No export package found for automated import.");
            const stats = await Promise.all(
              entries.map(async (name) => ({
                path: join(process.env.ACADEMY_TEST_DATA, name),
                mtime: (await stat(join(process.env.ACADEMY_TEST_DATA, name))).mtimeMs,
              })),
            );
            stats.sort((a, b) => b.mtime - a.mtime);
            filePath = stats[0].path;
          }
        } else {
          const selected = await dialog.showOpenDialog(window, {
            title: "Import subject or repository package",
            properties: ["openFile"],
            filters: [{ name: "Aeronautical Academy Export", extensions: ["aoa.json", "json"] }],
          });
          if (selected.canceled || !selected.filePaths.length) return { canceled: true };
          filePath = selected.filePaths[0];
        }
        const info = await stat(filePath);
        if (info.size > MAX_PACKAGE_BYTES) {
          throw new Error("Choose an export file up to 50 MB.");
        }
        const raw = await readFile(filePath);
        const { payload, summary } = parseAndValidateImport(raw, basename(filePath));
        while (pendingImports.size >= 5) {
          const oldest = pendingImports.keys().next().value;
          pendingImports.delete(oldest);
        }
        const importId = randomUUID();
        pendingImports.set(importId, payload);
        return { canceled: false, importId, summary };
      });
      register("academy:commit-import", async (importId) => {
        if (typeof importId !== "string" || !pendingImports.has(importId)) {
          const err = new Error("Import session expired. Select the export file again.");
          err.status = 400;
          throw err;
        }
        const payload = pendingImports.get(importId);
        pendingImports.delete(importId);
        return importPackage(bridge, payload);
      });
      register("academy:cancel-import", (importId) => {
        if (typeof importId === "string") pendingImports.delete(importId);
        return { cleared: true };
      });
      register("academy:link", (data) => bridge.openLink(data));
      register("academy:inspect-link", (url) => bridge.inspectLink(url));
      await window.loadURL("academy://app/");
      if (smoke) {
        const result = await window.webContents.executeJavaScript(
          `window.academy.login({mode:'local',username:'instructor',password:'instructor'}).then(x=>({role:x.value?.account.role,bridge:x.ok && !!window.academy}))`,
        );
        if (result.role !== "instructor" || !result.bridge)
          throw new Error("Desktop bridge smoke test failed.");
        await bridge.logout();
        await writeFile(
          join(app.getPath("temp"), "academy-smoke-result.json"),
          JSON.stringify(result),
        );
        app.quit();
      }
    } catch (error) {
      if (!smoke && !automated)
        dialog.showErrorBox("Aeronautical Academy Repository could not start", error.message);
      console.error(error.message);
      app.exit(1);
    }
  }
}
async function finishQuit() {
  if (closing) return;
  closing = true;
  try { await bridge?.logout(); } catch { /* Local cleanup still runs offline. */ }
  try { await local?.academy.close(); } finally { app.quit(); }
}
app.on("window-all-closed", () => void finishQuit());
app.on("before-quit", (event) => {
  if (closing) return;
  event.preventDefault();
  // Let the renderer's unsaved-work confirmation finish before closing its API.
  if (window && !window.isDestroyed()) window.close();
  else void finishQuit();
});

void boot();
