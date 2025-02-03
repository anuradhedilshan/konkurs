import { CB } from "../electron/render";
import start, { setLoggerCallback } from "./engine/main";

const eventTest: CB = (Type, message) => {
  console.log(Type, message);
};

(async () => {
  setLoggerCallback(eventTest);
  console.log("Testing Start");
  await start(
    "https://www.konkurs.ro/concursuri-terminate/",
    "all",
    {
      start: 1,
      end: 50,
    },
    "./"
  );
})();
