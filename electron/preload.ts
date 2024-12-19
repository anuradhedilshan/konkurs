import { ipcRenderer } from "electron";

ipcRenderer.on("event", (_e, arg) => {
  console.log("on Event call from preload");

  sendEvent(arg.Type, arg.message);
});

function sendEvent(
  Type: "progress" | "count" | "complete" | "error" | "details" | "warn",
  message: number | boolean | string | null
) {
  if (window.MyApi.OnEvent) window.MyApi.OnEvent(Type, message);
}

window.MyApi = {
  start: (
    type: Type,
    location: string,
    range: { start: number; end: number },
    link?: string
  ) => {
    ipcRenderer.send("start", type, location, range, link);
  },
  fetchFilters: () => {
    return ipcRenderer.invoke("fetchFilters");
  },
  showFilePathError: () => ipcRenderer.invoke("show-file-path-error"),
  openFilePicker: async () => {
    const e = await ipcRenderer.invoke("openPathDialog");
    return e.filePaths[0];
  },
  OnEvent: null,
};
