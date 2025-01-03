import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CB } from "./render";
import { Get } from "../src/engine/Shared/lib";
import { parseFooterArchive, parseHomePageRight } from "../src/engine/utils";
import start, { setLoggerCallback } from "../src/engine/main";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 800,
    resizable: false,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: false,
    },
  });

  //win.setMenu(null);

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

// Events

const fireEvent: CB = (Type, message) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send("event", { Type, message });
  }
};

const logger = setLoggerCallback(fireEvent);

ipcMain.handle("openPathDialog", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return result;
});

ipcMain.handle("show-file-path-error", async () => {
  const result = await dialog.showMessageBox({
    type: "error",
    title: "Configuration Error",
    message: "File Path Not Set",
    detail:
      "Please specify a valid file path in the application settings before proceeding. This is required for proper operation of the application.",
    buttons: ["Cancel"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });

  return result.response;
});

ipcMain.handle("fetchFilters", async () => {
  const d = await Get("https://www.konkurs.ro/concursuri-terminate");
  const years = parseFooterArchive(d.data);
  const { maxpages } = parseHomePageRight(d.data);
  return {
    years,
    maxpages,
  };
});

let State = false;

ipcMain.on("start", async (_e, type, location, range, link) => {
  if (State) {
    logger.error("Already running a task");
    return;
  }
  State = true;
  logger.log("Staring . . . . ");
  try {
    await start(link, type, range, location);
    fireEvent("complete", true);
    State = false;
  } catch (e) {
    State = false;
    fireEvent("complete", true);
    console.log(e);

    logger.error(`Error in start "ipcMain.on("start",": ${e}`);
  }
});

// (async () => {
//   const a = await start(
//     "https://www.konkurs.ro/concursuri-online/Ianuarie/2024/"
//   );
//   console.log(a);
// })();
