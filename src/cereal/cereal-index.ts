import { getLocalStorage, setLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";
import { isInSW } from "../utils/utils";
import {
  sendMessageToBackground,
  sendMessageToContentScript,
} from "../utils/messaging-helpers";
import { CerealObject, CerealResponse } from "./cereal-types";

export function cerealMain(
  cerealObject: string,
  recordID: string,
  htmlString: string,
) {
  return new Promise(async (resolve) => {
    Logger.log("[cerealMain] => Starting Cereal:", cerealObject);
    Logger.log("[cerealMain] => Record ID:", recordID);
    const parsedCerealObject: CerealObject = JSON.parse(cerealObject);
    const maxTimeout = parsedCerealObject.maxTimeout || 10000;

    // Set timeout to resolve empty object after maxTimeout
    const timeoutPromise = new Promise((timeoutResolve) => {
      setTimeout(() => timeoutResolve({}), maxTimeout);
    });

    const mainLogic = async () => {
      // Check if we're in service worker context
      const inSW = await isInSW();
      Logger.log("[cerealMain] => In SW:", inSW);

      if (!inSW) {
        // In content script, delegate all tab management to service worker
        Logger.log("[cerealMain] => In Content Script, Delegating to SW");
        let resultReceived = await sendMessageToBackground({
          intent: "mllwtl_handleCerealRequest",
          cerealObject: cerealObject, // Already a string
          recordID: recordID,
          htmlString: htmlString,
        });
        Logger.log("[cerealMain] => ## Result Received ##:", resultReceived);
        return resultReceived;
      } else {
        // The following code only runs in service worker
        // Check for existing cereal tab in storage
        const storedTab = await getLocalStorage("cereal_frame", true);
        Logger.log("[cerealMain] => Stored Tab:", storedTab);
        let targetTabId: number | null = storedTab?.tabId ?? null;
        Logger.log("[cerealMain] => Target Tab ID:", targetTabId);

        if (targetTabId) {
          // Verify tab still exists
          Logger.log("[cerealMain] => Verifying Tab:", targetTabId);
          try {
            const currentTabId = targetTabId;
            const tabExists = await new Promise<boolean>((resolve) => {
              chrome.tabs.get(currentTabId, (tab) => {
                resolve(!chrome.runtime.lastError && !!tab); // Convert tab to boolean
              });
            });

            Logger.log("[cerealMain] => Tab Exists:", tabExists);

            if (!tabExists) {
              targetTabId = null;
            }
          } catch {
            targetTabId = null;
          }
        }

        if (!targetTabId) {
          Logger.log("[cerealMain] => No Stored Tab, Finding New Tab");
          // Find first available tab and inject frame
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (tab.id === undefined) continue;

            try {
              const response = await sendMessageToContentScript(tab.id, {
                intent: "mllwtl_initCerealFrame",
                cerealObject: cerealObject, // Already a string
              });

              if (response?.success) {
                targetTabId = tab.id;
                Logger.log("[cerealMain] => Found Suitable Tab:", targetTabId);
                await setLocalStorage("cereal_frame", { tabId: targetTabId });
                break;
              }
            } catch {
              continue;
            }
          }
        }

        if (!targetTabId) {
          Logger.log("[cerealMain] => No Suitable Tab Found");
          return { success: false, message: "not tab found" }; // No suitable tab found
        }

        // Send the actual processing message
        return await sendMessageToContentScript(targetTabId, {
          intent: "mllwtl_processCereal",
          cerealObject: cerealObject, // Already a string
          recordID: recordID,
          htmlString: htmlString,
        });
      }
    };

    // Race between timeout and main logic
    const result = await Promise.race([timeoutPromise, mainLogic()]);
    Logger.log("[cerealMain] => FINAL Result:", result);
    resolve(result);
  });
}
