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
    sync: () => call("academy:sync"),
    readMaterial: (id, revision) => call("academy:read-material", id, revision),
    uploadMaterial: (id, version) => call("academy:upload-material", id, version),
    uploadImage: (subjectId, base64) => call("academy:upload-image", subjectId, base64),
    pickImage: (subjectId) => call("academy:pick-image", subjectId),
    readImage: (params) => call("academy:read-image", params),
  }),
);
