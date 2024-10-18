import { Logger } from "../logger/logger";
import { setLifespanForWindow } from "./reset-window";
import { isInSW } from "../utils/utils";
import {
  sendMessageToBackground,
  sendMessageToContentScript,
} from "../utils/messaging-helpers";
import { getLocalStorage, setLocalStorage } from "../storage/storage-helpers";

export function deleteUnfocusedWindow(windowId: number): Promise<boolean> {
  return new Promise(async (resolve) => {
    if (!(await isInSW())) {
      Logger.log(
        "[deleteUnfocusedWindow]: Will send message to background to delete window",
      );
      // send message to background to delete window
      let response = await sendMessageToBackground({
        intent: "deleteUnfocusedWindow",
        windowId: windowId,
      });
      resolve(response);
    } else {
      chrome.windows.remove(windowId).then(() => {});
      resolve(true);
    }
  });
}

export function createUnfocusedWindow(
  url: string,
  recordID: string,
  waitBeforeScraping: number,
  eventData: any,
): Promise<number> {
  return new Promise(async (resolve, reject) => {
    // before opening anything, check if one is already open.
    // can't afford to have multiple windows open
    // if one is already open, ignore this request
    // if not, open a new window
    let previousWindowId = await getLocalStorage("unfocusedWindowId", true);
    if (previousWindowId !== undefined && previousWindowId !== null) {
      Logger.log(
        "[createUnfocusedWindow]: Previous window found. Can't open another window",
      );
      Logger.log(
        "[createUnfocusedWindow]: Previous window id is",
        previousWindowId,
      );
      resolve(0);
    } else {
      if (!(await isInSW())) {
        Logger.log(
          "[createUnfocusedWindow]: Will send message to background to create window",
        );
        // send message to background to create window
        await sendMessageToBackground({
          intent: "createUnfocusedWindow",
          url,
          recordID,
          waitBeforeScraping,
          eventData,
        });
        resolve(0);
      } else {
        chrome.windows.getCurrent(
          {},
          function (currentWindow: chrome.windows.Window) {
            Logger.log(
              "[createUnfocusedWindow]: Current window is",
              currentWindow,
            );
            if (
              (currentWindow.width || currentWindow.width == 0) &&
              (currentWindow.height || currentWindow.height == 0) &&
              (currentWindow.left || currentWindow.left == 0) &&
              (currentWindow.top || currentWindow.top == 0)
            ) {
              const width: number = 300;
              const height: number = 300;
              const left: number = Math.round(
                (currentWindow.width - width) / 2,
              );
              const top: number = Math.round(
                (currentWindow.height - height) / 2,
              );
              chrome.windows.create(
                {
                  url: url,
                  focused: false,
                  type: "normal",
                  width: width,
                  height: height,
                  left: left + currentWindow.left,
                  top: top + currentWindow.top,
                },
                async function (newWindow: chrome.windows.Window | undefined) {
                  if (newWindow?.id && currentWindow.id) {
                    /*setLifespanForWindow(
                                          newWindow?.id,
                                          recordID,
                                          waitBeforeScraping,
                                        );*/
                    const newWindowId: number = newWindow.id;
                    const currentWindowId: number = currentWindow.id;

                    // save this window id to storage
                    await setLocalStorage("unfocusedWindowId", newWindowId);

                    // Ensure the original window remains focused
                    chrome.windows
                      .update(currentWindowId, { focused: true })
                      .then();

                    // Listen for changes in window focus
                    /* ENABLE IN PRODUCTION
                                        chrome.windows.onFocusChanged.addListener(function (
                                          windowId: number,
                                        ) {
                                          if (windowId === chrome.windows.WINDOW_ID_NONE) {
                                            Logger.log("All Chrome windows have lost focus");
                                            chrome.windows.remove(newWindowId).then();
                                          }
                                          if (windowId === newWindowId) {
                                            Logger.log("New Chrome window has gained focus");
                                            chrome.windows.remove(newWindowId).then();
                                          }
                                        });
                                        */

                    // detect when current window is minimized and close the new window
                    /*
                                        chrome.windows.onRemoved.addListener(function (
                                          windowId: number,
                                        ) {
                                          if (windowId === currentWindowId) {
                                            Logger.log("Current Chrome window has been closed");
                                            chrome.windows.remove(newWindowId).then();
                                          }
                                        });
                                        */

                    // when window loaded, send message to the tab
                    // use heartbeat mechanism to check if the tab is open or closed
                    // instead of setTimeout
                    setTimeout(() => {
                      chrome.tabs.query(
                        { windowId: newWindowId, active: true },
                        async function (tabs) {
                          if (tabs.length > 0) {
                            Logger.log(
                              "Sending message to tab in new window",
                              tabs[0].id,
                            );
                            let response = await sendMessageToContentScript(
                              tabs[0].id!,
                              {
                                intent: "triggerEventListener",
                                data: JSON.stringify(eventData),
                              },
                            );
                            Logger.log(
                              "Message sent to tab in new window. Response =>",
                              response,
                            );
                          }
                        },
                      );
                    }, 5000);

                    resolve(newWindowId);
                  } else {
                    reject(new Error("Failed to create window"));
                  }
                },
              );
            } else {
              reject(new Error("Invalid current window properties"));
            }
          },
        );
      }
    }
  });
}
