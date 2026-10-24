const { contextBridge, ipcRenderer } = require("electron");
const call = async (channel, ...args) => {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result.ok) {
    const error = new Error(result.error);
    error.status = result.status;
    throw error;
  }
  return result.value;
};
contextBridge.exposeInMainWorld(
  "academy",
  Object.freeze({
    login: (data) => call("academy:login", data),
    request: (path, options) => call("academy:request", path, options),
    logout: () => call("academy:logout"),
    openLink: (data) => call("academy:link", data),
    exportReport: (id, offset) => call("academy:export", id, offset),
  }),
);
