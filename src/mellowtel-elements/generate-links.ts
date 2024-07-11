import {
  getExtensionIdentifier,
  getIdentifier,
} from "../utils/identity-helpers";
import { setLocalStorage, getLocalStorage } from "../utils/storage-helpers";
import { shouldDelegateTabsAPI } from "../utils/tabs-helpers";
import { sendMessageToBackground } from "../utils/messaging-helpers";
import { openPopupWindow } from "../utils/utils";
import { Logger } from "../logger/logger";
const BASE_LINK_SETTING: string = "https://www.mellow.tel/settings/";
const BASE_LINK_OPT_IN: string = "https://www.mellow.tel/opt-in/";

/*
    generateAndOpenOptInLink is a convenience function that generates an opt-in link
    and opens it in a new tab. It returns a Promise that resolves to the generated link.
    It also keeps track to only open it once.
    It can be called both from the background script and the content script.
    If called from the content script, it will send a message to the background script to open the link.
*/

async function setAlreadyOpened() {
  return new Promise((resolve) => {
    setLocalStorage("mellowtelOptInOpened", "true").then(() => {
      resolve(true);
    });
  });
}

async function getAlreadyOpened(): Promise<boolean> {
  return new Promise((resolve) => {
    getLocalStorage("mellowtelOptInOpened").then((result) => {
      if (
        result === undefined ||
        !result.hasOwnProperty("mellowtelOptInOpened")
      ) {
        resolve(false);
      } else {
        let opened =
          result["mellowtelOptInOpened"].toString().toLowerCase() === "true";
        resolve(opened);
      }
    });
  });
}

export function generateAndOpenOptInLink(): Promise<string> {
  return new Promise(async (resolve) => {
    // if not access to tabs api, send message to background script to open the link
    let shouldDelegate = await shouldDelegateTabsAPI();
    if (shouldDelegate) {
      let link = await sendMessageToBackground({ intent: "openOptInLink" });
      resolve(link);
    }
    let alreadyOpened = await getAlreadyOpened();
    if (!alreadyOpened) {
      let extension_id = await getExtensionIdentifier();
      getIdentifier().then(async (nodeId) => {
        let configuration_key = nodeId.split("_")[1];
        let link = `${BASE_LINK_OPT_IN}?extension_id=${extension_id}&configuration_key=${configuration_key}`;
        await setAlreadyOpened();
        chrome.tabs.create({ url: link });
        resolve(link);
      });
    } else {
      resolve("");
    }
  });
}

export function generateOptInLink(): Promise<string> {
  return new Promise(async (resolve) => {
    let extension_id = await getExtensionIdentifier();
    getIdentifier().then((nodeId) => {
      let configuration_key = nodeId.split("_")[1];
      resolve(
        `${BASE_LINK_OPT_IN}?extension_id=${extension_id}&configuration_key=${configuration_key}`,
      );
    });
  });
}

export function generateSettingsLink(): Promise<string> {
  return new Promise(async (resolve) => {
    let extension_id = await getExtensionIdentifier();
    getIdentifier().then((nodeId) => {
      let configuration_key = nodeId.split("_")[1];
      resolve(
        `${BASE_LINK_SETTING}?extension_id=${extension_id}&configuration_key=${configuration_key}`,
      );
    });
  });
}

export function openUserSettingsInPopupWindow(): Promise<boolean> {
  return new Promise(async (resolve) => {
    let userSettingsLink: string = await generateSettingsLink();
    let isInBackgroundScript: boolean = !(await shouldDelegateTabsAPI());
    if (isInBackgroundScript) {
      Logger.log(
        "openUserSettingsInPopupWindow: Method not supported in background script",
      );
      resolve(false);
    }
    await openPopupWindow(userSettingsLink, "Mellowtel Settings", 768, 400);
    resolve(true);
  });
}
