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
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import { startLocal, AcademyBridge } from "./bridge.mjs";

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
          "/style.css": "style.css",
        };
        if (url.host !== "app" || !files[url.pathname])
          return new Response("Not found", { status: 404 });
        return net.fetch(
          pathToFileURL(join(root, "ui", files[url.pathname])).href,
        );
      });
      session.defaultSession.setPermissionRequestHandler(
        (_wc, _permission, done) => done(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      window = new BrowserWindow({
        width: 1480,
        height: 960,
        minWidth: 1060,
        minHeight: 720,
        backgroundColor: "#f5f7fb",
        title: "Aeronautical Open Academy",
        autoHideMenuBar: true,
        webPreferences: {
          preload: join(root, "preload.cjs"),
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          spellcheck: true,
        },
      });
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (e) => e.preventDefault());
      window.webContents.on("will-attach-webview", (e) => e.preventDefault());
      window.webContents.on("will-prevent-unload", (event) => {
        const choice = dialog.showMessageBoxSync(window, {
          type: "question",
          buttons: ["Keep editing", "Discard and close"],
          defaultId: 0,
          cancelId: 0,
          title: "Unsaved work",
          message: "Close Academy and discard your unsaved text?",
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
      register("academy:login", (data) => bridge.login(data));
      register("academy:request", (path, options) =>
        bridge.request(path, options),
      );
      register("academy:logout", () => bridge.logout());
      register("academy:link", (data) => bridge.openLink(data));
      register("academy:inspect-link", (url) => bridge.inspectLink(url));
      register("academy:subject-qr", async (id, save = false) => {
        const qr = await bridge.subjectQr(id);
        if (!save) return {image:qr.image, payload:qr.payload};
        if (automated) {
          await writeFile(join(app.getPath("userData"), "test-subject-qr.svg"), qr.svg);
          return {saved:true};
        }
        const result = await dialog.showSaveDialog(window, {
          title:"Save subject QR code", defaultPath:`Academy-subject-${id}.svg`,
          filters:[{name:"QR image (SVG)", extensions:["svg"]}],
        });
        if (result.canceled) return {saved:false};
        await writeFile(result.filePath, qr.svg, {mode:0o600});
        return {saved:true};
      });
      register("academy:export", async (id, offset) => {
        const bytes = await bridge.exportReport(id, offset);
        if (automated) {
          await writeFile(
            join(app.getPath("userData"), "test-report.xlsx"),
            bytes,
          );
          return { saved: true };
        }
        const result = await dialog.showSaveDialog(window, {
          title: "Export student progress",
          defaultPath: `Academy-progress-${offset + 1}.xlsx`,
          filters: [{ name: "Excel workbook", extensions: ["xlsx"] }],
        });
        if (result.canceled) return { saved: false };
        await writeFile(result.filePath, bytes, { mode: 0o600 });
        return { saved: true };
      });
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
        dialog.showErrorBox("Academy could not start", error.message);
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
