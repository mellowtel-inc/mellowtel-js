import { getLocalStorage, setLocalStorage } from "../utils/storage-helpers";
import { getExtensionIdentifier } from "../utils/identity-helpers";
import { Logger } from "../logger/logger";
import { isInSW } from "../utils/utils";

export function switchShouldContinue(): Promise<boolean> {
  return new Promise(async (res) => {
    try {
      // check if storage permission is granted by reading the manifest (only if in the background script)
      if (await isInSW()) {
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
        let extensionId: string = await getExtensionIdentifier();
        fetch(
          `https://mellowtel.s3.us-east-1.amazonaws.com/switch/${extensionId}.txt`,
        )
          .then(async (response) => {
            if (!response.ok && response.status !== 403) {
              throw new Error("[checkSwitch] => Network response was not ok");
            }
            if (response.status === 403) {
              Logger.log("[checkSwitch] => Access Denied error occurred");
              await setLocalStorage("already_checked_switch", true);
              await setLocalStorage("checked_switch_value", true);
              res(true);
            } else {
              return response.text();
            }
          })
          .then((data) => async () => {
            // 0 -> switch is off
            // 1 -> switch is on
            Logger.log(`The content is: ${data}`);
            await setLocalStorage("already_checked_switch", true);
            if (data === "0") {
              await setLocalStorage("checked_switch_value", false);
              res(false);
            } else {
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
