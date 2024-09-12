import { getLocalStorage, setLocalStorage } from "../utils/storage-helpers";
import { getExtensionIdentifier } from "../utils/identity-helpers";
import { Logger } from "../logger/logger";

export function checkSwitch(): Promise<boolean> {
  return new Promise(async (res) => {
    // make this work independently of the rest of the code
    // so also check storage permission, before fetching
    try {
      let already_checked_switch: boolean = await getLocalStorage(
        "already_checked_switch",
        true,
      );
      if (already_checked_switch) {
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
          .then((response) => {
            if (!response.ok && response.status !== 403) {
              throw new Error("Network response was not ok");
            }
            if (response.status === 403) {
              return "0";
            }
            return response.text();
          })
          .then((data) => async () => {
            // 0 -> switch is off
            // 1 -> switch is on
            console.log(`The content is: ${data}`);
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
              console.log("Access Denied error occurred");
            } else {
              console.log("An error occurred:", error.message);
            }
          });
      }
    } catch (e) {
      Logger.log("[checkSwitch] => Error:", e);
      res(false);
    }
  });
}
