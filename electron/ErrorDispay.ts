import { dialog } from "electron";

class ErrorDisplay {
  static async showError(message: string, details = "") {
    const result = await dialog.showMessageBox({
      type: "error",
      title: "Error",
      message: message,
      detail:
        details ||
        "Please try again. If the problem persists, contact support.",
      buttons: ["OK"],
      defaultId: 0,
      noLink: true,
    });

    return result;
  }

  static async showDataFetchError() {
    return await this.showError(
      "Data Fetching Failed",
      "Unable to retrieve the requested data. Please check your connection and try again."
    );
  }
}

export default ErrorDisplay;
