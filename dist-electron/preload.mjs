"use strict";
const electron = require("electron");
electron.ipcRenderer.on("event", (_e, arg) => {
  console.log("on Event call from preload");
  sendEvent(arg.Type, arg.message);
});
function sendEvent(Type, message) {
  if (window.MyApi.OnEvent) window.MyApi.OnEvent(Type, message);
}
window.MyApi = {
  start: (type, location, range, link) => {
    electron.ipcRenderer.send("start", type, location, range, link);
  },
  fetchFilters: () => {
    return electron.ipcRenderer.invoke("fetchFilters");
  },
  showFilePathError: () => electron.ipcRenderer.invoke("show-file-path-error"),
  openFilePicker: async () => {
    const e = await electron.ipcRenderer.invoke("openPathDialog");
    return e.filePaths[0];
  },
  OnEvent: null
};
