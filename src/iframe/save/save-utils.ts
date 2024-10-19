import { getFromOnlyIfMustStorage } from "../../unfocused-window/only-if-must-storage";
import { createUnfocusedWindow } from "../../unfocused-window/create-window";

export function checkIfOpenTabIfMustAndShould(
  recordID: string,
  serverResponse: string,
): Promise<boolean> {
  return new Promise(async (resolve) => {
    let onlyIfMustItem = await getFromOnlyIfMustStorage(recordID);
    if (onlyIfMustItem === null) {
      resolve(false);
    } else {
      if (serverResponse.includes("shouldOpen")) {
        createUnfocusedWindow(
          onlyIfMustItem.url,
          recordID,
          onlyIfMustItem.waitBeforeScraping,
          onlyIfMustItem.eventData,
        ).then((windowId) => {
          resolve(true);
        });
      }
    }
  });
}
