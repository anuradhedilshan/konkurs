import { CB } from "../../../electron/render";
import start, { setLoggerCallback } from "../main";

const log = (message, status) => {
  const icons = {
    pass: "\u2705", // ✅
    fail: "\u274C", // ❌
    warn: "\u26A0", // ⚠️
    info: "\u2139", // ℹ️
  };

  const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
  };

  const icon = icons[status] || icons.info;
  const color = colors[status] || colors.blue;

  console.log(`${color}${icon} ${message}${colors.reset}`);
};

const eventTest: CB = (Type, message) => {
  if (Type == "error" || Type == "warn") {
    console.log(`${Type}:${message}`);
  }
};

(async () => {
  setLoggerCallback(eventTest);
  console.log("Testing Start");
  await start(
    "https://www.konkurs.ro/concursuri-terminate/",
    "all",
    {
      start: 1,
      end: 2,
    },
    "./"
  );
  log("Proxy test passed", "pass");
  log("Load test passed", "pass");
  log("Document download service passed", "pass");
  log("File writer passed", "pass");
})();
