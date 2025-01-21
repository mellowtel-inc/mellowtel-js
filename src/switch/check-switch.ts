import { getLocalStorage, setLocalStorage } from "../storage/storage-helpers";
import { getExtensionIdentifier } from "../utils/identity-helpers";
import { Logger } from "../logger/logger";
import { isInSW } from "../utils/utils";

export function switchShouldContinue(): Promise<boolean> {
  return new Promise(async (res) => {
    try {
      Logger.log("[checkSwitch] => Checking switch");
      // check if storage permission is granted by reading the manifest (only if in the background script)
      if (await isInSW()) {
        Logger.log("[checkSwitch] => In the background script");
        let storagePermission: boolean = await chrome.permissions.contains({
          permissions: ["storage"],
        });
        if (!storagePermission) {
          Logger.log("[checkSwitch] => Storage permission not granted");
          res(false);
        }
      }
      let already_checked_switch: boolean = await getLocalStorage(
        "already_checked_switch",
        true,
      );
      if (already_checked_switch) {
        Logger.log("[checkSwitch] => Already checked switch for the session");
        let checked_switch_value: boolean = await getLocalStorage(
          "checked_switch_value",
          true,
        );
        res(checked_switch_value);
      } else {
        Logger.log("[checkSwitch] => Checking switch for the first time");
        let extensionId: string = await getExtensionIdentifier();
        Logger.log(`[checkSwitch] => Extension ID: ${extensionId}`);
        let cacheBuster: string = new Date().getTime().toString();
        fetch(
          `https://mellowtel-bucket.s3.us-east-1.amazonaws.com/switch/${extensionId}.txt?${cacheBuster}`,
        )
          .then(async (response) => {
            Logger.log(`[checkSwitch] => Response is: ${response}`);
            if (!response.ok && response.status !== 403) {
              throw new Error("[checkSwitch] => Network response was not ok");
            }
            if (response.status === 403) {
              Logger.log("[checkSwitch] => Access Denied error occurred");
              await setLocalStorage("already_checked_switch", true);
              await setLocalStorage("checked_switch_value", true);
              res(true);
            } else {
              Logger.log("[checkSwitch] => Response is ok");
              return response.text();
            }
          })
          .then(async (data: string | undefined) => {
            // 0 -> switch is off
            // 1 -> switch is on
            Logger.log(`[checkSwitch] => The content is: ${data}`);
            await setLocalStorage("already_checked_switch", true);
            if (data?.toString() === "0") {
              Logger.log("[checkSwitch] => Switch is off. Content is 0");
              await setLocalStorage("checked_switch_value", false);
              res(false);
            } else {
              Logger.log("[checkSwitch] => Switch is on. Content is 1");
              await setLocalStorage("checked_switch_value", true);
              res(true);
            }
          })
          .catch((error) => {
            if (error.message.includes("AccessDenied")) {
              Logger.log("Access Denied error occurred");
            } else {
              Logger.log("An error occurred:", error.message);
            }
          });
      }
    } catch (e) {
      Logger.log("[checkSwitch] => Error:", e);
      res(false);
    }
  });
}
