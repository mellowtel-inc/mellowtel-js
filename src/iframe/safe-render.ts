import { Logger } from "../logger/logger";
export function safeRenderIframe(): boolean {
  try {
    // Override the alert, prompt and confirm functions
    window.alert = function () {};
    window.prompt = function () {
      return null;
    };
    window.confirm = function () {
      return false;
    };
    return true;
  } catch (e) {
    Logger.log("Error in safeRenderIframe => " + e);
    return false;
  }
}
