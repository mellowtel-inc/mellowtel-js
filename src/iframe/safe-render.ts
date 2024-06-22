import { Logger } from "../logger/logger";
export function safeRenderIframe(): boolean {
  try {
    // Override the alert, prompt and confirm functions
    window.alert = function () {
      return null;
    };
    window.confirm = function () {
      return false;
    };
    window.print = function () {
      return false;
    };
    window.prompt = function () {
      return null;
    };
    overWriteBlank();
    return true;
  } catch (e) {
    Logger.log("Error in safeRenderIframe => " + e);
    return false;
  }
}

function overWriteBlank(): boolean {
  try {
    var originalWindowOpen = window.open;
    // Override the window.open method
    window.open = function (url, windowName, windowFeatures) {
      // Change the windowName to '_self' to always open in the same window/tab
      windowName = "_self"; // This forces it to open in the same window
      // Call the original window.open method with new arguments
      return originalWindowOpen(url, windowName, windowFeatures);
    };
    return true;
  } catch (e) {
    Logger.log("Error in overWriteBlank => " + e);
    return false;
  }
}
