const { contextBridge, ipcRenderer } = require("electron");
const call = async (channel, ...args) => {
  // contextBridge serializes thrown Errors without custom status properties.
  // Return the envelope so the renderer can reconstruct typed API errors.
  return ipcRenderer.invoke(channel, ...args);
};
contextBridge.exposeInMainWorld(
  "academy",
  Object.freeze({
    login: (data) => call("academy:login", data),
    request: (path, options) => call("academy:request", path, options),
    logout: () => call("academy:logout"),
    openLink: (data) => call("academy:link", data),
    inspectLink: (url) => call("academy:inspect-link", url),
    exportReport: (id, offset) => call("academy:export", id, offset),
    subjectQr: (id, save) => call("academy:subject-qr", id, save),
  }),
);
