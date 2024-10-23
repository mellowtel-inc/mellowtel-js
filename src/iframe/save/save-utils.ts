import { getFromOnlyIfMustStorage } from "../../unfocused-window/only-if-must-storage";
import { createUnfocusedWindow } from "../../unfocused-window/create-window";
import { Logger } from "../../logger/logger";

export function checkIfOpenTabIfMustAndShould(
  recordID: string,
  serverResponse: string,
): Promise<boolean> {
  return new Promise(async (resolve) => {
    Logger.log("[checkIfOpenTabIfMustAndShould] : recordID => " + recordID);
    Logger.log(
      "[checkIfOpenTabIfMustAndShould] : serverResponse => " + serverResponse,
    );
    let onlyIfMustItem = await getFromOnlyIfMustStorage(recordID);
    Logger.log(
      "[checkIfOpenTabIfMustAndShould] : onlyIfMustItem => ",
      onlyIfMustItem,
    );
    if (onlyIfMustItem === null) {
      resolve(false);
    } else {
      if (serverResponse.includes("shouldOpen")) {
        Logger.log("[checkIfOpenTabIfMustAndShould] : shouldOpen => true");
        await createUnfocusedWindow(
          onlyIfMustItem.url,
          onlyIfMustItem.recordID,
          onlyIfMustItem.waitBeforeScraping,
          onlyIfMustItem.eventData,
        ).then((windowId) => {
          Logger.log(
            "[checkIfOpenTabIfMustAndShould] : windowId => " + windowId,
          );
          resolve(true);
        });
      }
    }
  });
}
