import { startWebsocket, stopConnection } from "../utils/start-stop-helpers";
import { Logger } from "../logger/logger";

export async function setUpStorageChangeListeners(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.onChanged.addListener(function (changes, namespace) {
      for (let key in changes) {
        if (key === "mlStatus") {
          let newValue = changes[key].newValue;
          if (newValue === "start") {
            Logger.info("Starting to connect...");
            startWebsocket();
          } else if (newValue === "stop") {
            Logger.info("Stopping the connection...");
            stopConnection();
          }
        }
      }
    });
  });
}
