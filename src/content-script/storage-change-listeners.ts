import {
  startMellowtelWebsocket,
  stopMellowtelConnection,
} from "../utils/start-stop-helpers";
import { Logger } from "../logger/logger";

export async function setUpStorageChangeListeners(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.onChanged.addListener(function (changes, namespace) {
      for (let key in changes) {
        if (key === "mellowtelStatus") {
          let newValue = changes[key].newValue;
          if (newValue === "start") {
            Logger.info("Mellowtel is starting...");
            startMellowtelWebsocket();
          } else if (newValue === "stop") {
            Logger.info("Mellowtel is stopping...");
            stopMellowtelConnection();
          }
        }
      }
    });
  });
}
