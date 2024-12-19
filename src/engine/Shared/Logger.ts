import { CB } from "../../../electron/render";

export default class Logger {
  private Callback!: CB;
  constructor(event_callback: CB) {
    this.Callback = event_callback;
  }

  error(message: number | boolean | string | null) {
    this.Callback("error", message);
  }

  log(message: number | boolean | string | null) {
    this.Callback("details", message);
  }
  warn(message: number | boolean | string | null) {
    this.Callback("warn", message);
  }
}
