import { getLocalStorage, setLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";
import { isInSW } from "../utils/utils";
import { sendMessageToContentScript } from "../utils/messaging-helpers";
import { CerealObject } from "./cereal-types";

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
      const inSW = await isInSW();
      Logger.log("[cerealMain] => In SW:", inSW);

      if (!inSW) {
        Logger.log("[cerealMain] => In Content Script, Delegating to SW");
        const resultReceived = await new Promise((innerResolve) => {
          chrome.runtime.sendMessage(
            {
              intent: "mllwtl_handleCerealRequest",
              cerealObject: cerealObject,
              recordID: recordID,
              htmlString: htmlString,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                Logger.log(
                  "Hey, error in RUNTIME Error:",
                  chrome.runtime.lastError,
                );
              }
              Logger.log(
                "[cerealMain] => Response from SW @@@@@@@@@@@@@@:",
                response,
              );
              innerResolve(response);
            },
          );
        });

        Logger.log("[cerealMain] => ## Result Received ##:", resultReceived);
        return resultReceived;
      } else {
        // The following code only runs in service worker
        // Check for existing cereal tab in storage
        const storedTab = await getLocalStorage(
          "mllwtl_cereal_frame_tab",
          true,
        );
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
                await setLocalStorage("mllwtl_cereal_frame_tab", {
                  tabId: targetTabId,
                });
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

    const result = await Promise.race([timeoutPromise, mainLogic()]);
    Logger.log("[cerealMain] => FINAL Result:", result);
    resolve(result);
  });
}

export function refreshCereal() {
  return new Promise(async (resolve) => {
    // check if the tab with cereal exists.
    // if it does, send message to refresh the frame and return success
    // if it doesn't, return failure
    const storedTab = await getLocalStorage("mllwtl_cereal_frame_tab", true);
    Logger.log("[refreshCereal] => Stored Tab:", storedTab);
    let targetTabId: number | null = storedTab?.tabId ?? null;
    Logger.log("[refreshCereal] => Target Tab ID:", targetTabId);

    if (targetTabId === null) {
      Logger.log("[refreshCereal] => No Stored tab found.");
      resolve({ success: false, message: "not tab found" });
    }

    // Verify tab still exists
    Logger.log("[refreshCereal] => Verifying Tab:", targetTabId);
    try {
      const tabExists = await new Promise<boolean>((res) => {
        if (targetTabId != null) {
          chrome.tabs.get(targetTabId, (tab) => {
            res(!chrome.runtime.lastError && !!tab); // Convert tab to boolean
          });
        }
      });

      Logger.log("[refreshCereal] => Tab Exists:", tabExists);

      if (!tabExists) {
        targetTabId = null;
      }
    } catch {
      targetTabId = null;
    }

    if (targetTabId === null) {
      Logger.log("[refreshCereal] => Tab does not exist.");
      resolve({ success: false, message: "not tab found" });
    }

    // now we know the tab exists, send message to refresh the frame
    Logger.log(
      "[refreshCereal] => Sending message to refresh tab:",
      targetTabId,
    );
    if (targetTabId != null) {
      await sendMessageToContentScript(targetTabId, {
        intent: "mllwtl_refreshCerealFrame",
      });
      resolve({ success: true });
    }
  });
}
