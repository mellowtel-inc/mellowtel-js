import {
  getExtensionIdentifier,
  getIdentifier,
} from "../utils/identity-helpers";
import { setLocalStorage, getLocalStorage } from "../storage/storage-helpers";
import { shouldDelegateTabsAPI } from "../utils/tabs-helpers";
import { sendMessageToBackground } from "../utils/messaging-helpers";
import { detectBrowser, openPopupWindow } from "../utils/utils";
import { Logger } from "../logger/logger";
const BASE_DOMAIN: string = "https://www.mellow.tel/";
const BASE_LINK_SETTING: string = BASE_DOMAIN + "settings/";
const BASE_LINK_OPT_IN: string = BASE_DOMAIN + "opt-in/";
const BASE_LINK_UPDATE: string = BASE_DOMAIN + "update/";
const BASE_LINK_FEEDBACK: string = BASE_DOMAIN + "uninstall-feedback/";

/*
    generateAndOpenOptInLink is a convenience function that generates an opt-in link
    and opens it in a new tab. It returns a Promise that resolves to the generated link.
    It also keeps track to only open it once.
    It can be called both from the background script and the content script.
    If called from the content script, it will send a message to the background script to open the link.
*/

const optInOpenedKey: string = "mellowtelOptInOpened";
const updateOpenedKey: string = "mUpdateOpened";

async function setAlreadyOpened(
  optInOrUpdate: string = "optIn",
): Promise<boolean> {
  return new Promise((resolve) => {
    let optIn = optInOrUpdate === "optIn";
    setLocalStorage(optIn ? optInOpenedKey : updateOpenedKey, "true").then(
      () => {
        resolve(true);
      },
    );
  });
}

async function getAlreadyOpened(
  optInOrUpdate: string = "optIn",
): Promise<boolean> {
  return new Promise((resolve) => {
    let optIn = optInOrUpdate === "optIn";
    getLocalStorage(optIn ? optInOpenedKey : updateOpenedKey).then((result) => {
      if (
        result === undefined ||
        !result.hasOwnProperty(optIn ? optInOpenedKey : updateOpenedKey)
      ) {
        resolve(false);
      } else {
        let opened =
          result[optIn ? optInOpenedKey : updateOpenedKey]
            .toString()
            .toLowerCase() === "true";
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
    let alreadyOpened = await getAlreadyOpened("optIn");
    if (!alreadyOpened) {
      let extension_id = await getExtensionIdentifier();
      getIdentifier().then(async (deviceId) => {
        let configuration_key = deviceId.split("_")[1];
        let link = `${BASE_LINK_OPT_IN}?extension_id=${encodeURIComponent(extension_id)}&configuration_key=${configuration_key}&browser=${detectBrowser()}`;
        await setAlreadyOpened("optIn");
        chrome.tabs.create({ url: link });
        resolve(link);
      });
    } else {
      resolve("");
    }
  });
}

export function generateAndOpenUpdateLink(): Promise<string> {
  return new Promise(async (resolve) => {
    // if not access to tabs api, send message to background script to open the link
    let shouldDelegate = await shouldDelegateTabsAPI();
    if (shouldDelegate) {
      let link = await sendMessageToBackground({ intent: "openUpdateLink" });
      resolve(link);
    }
    let alreadyOpened = await getAlreadyOpened("update");
    if (!alreadyOpened) {
      let extension_id = await getExtensionIdentifier();
      getIdentifier().then(async (deviceId) => {
        let configuration_key = deviceId.split("_")[1];
        let link = `${BASE_LINK_UPDATE}?extension_id=${encodeURIComponent(extension_id)}&configuration_key=${configuration_key}&browser=${detectBrowser()}`;
        await setAlreadyOpened("update");
        chrome.tabs.create({ url: link }, (tab) => {
          resolve(link);
        });
      });
    } else {
      resolve("");
    }
  });
}

export function generateOptInLink(): Promise<string> {
  return new Promise(async (resolve) => {
    let extension_id = await getExtensionIdentifier();
    getIdentifier().then((deviceId) => {
      let configuration_key = deviceId.split("_")[1];
      resolve(
        `${BASE_LINK_OPT_IN}?extension_id=${encodeURIComponent(extension_id)}&configuration_key=${configuration_key}&browser=${detectBrowser()}`,
      );
    });
  });
}

export function generateUpdateLink(): Promise<string> {
  return new Promise(async (resolve) => {
    let extension_id = await getExtensionIdentifier();
    getIdentifier().then((deviceId) => {
      let configuration_key = deviceId.split("_")[1];
      resolve(
        `${BASE_LINK_UPDATE}?extension_id=${encodeURIComponent(extension_id)}&configuration_key=${configuration_key}&browser=${detectBrowser()}`,
      );
    });
  });
}

export function generateSettingsLink(): Promise<string> {
  return new Promise(async (resolve) => {
    let extension_id = await getExtensionIdentifier();
    getIdentifier().then((deviceId) => {
      let configuration_key = deviceId.split("_")[1];
      resolve(
        `${BASE_LINK_SETTING}?extension_id=${encodeURIComponent(extension_id)}&configuration_key=${configuration_key}&browser=${detectBrowser()}`,
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
    await openPopupWindow(userSettingsLink, "Settings", 768, 400);
    resolve(true);
  });
}

export function generateAndOpenFeedbackLink(): Promise<string> {
  return new Promise(async (resolve) => {
    // if not access to tabs api, send message to background script to open the link
    let shouldDelegate = await shouldDelegateTabsAPI();
    if (shouldDelegate) {
      let link = await sendMessageToBackground({ intent: "openFeedbackLink" });
      resolve(link);
    }
    let extension_id = await getExtensionIdentifier();
    getIdentifier().then(async (deviceId) => {
      let configuration_key = deviceId.split("_")[1];
      let link = `${BASE_LINK_FEEDBACK}?extension_id=${encodeURIComponent(extension_id)}&configuration_key=${configuration_key}`;
      chrome.tabs.create({ url: link }, (tab) => {
        resolve(link);
      });
    });
  });
}

export function generateFeedbackLink(): Promise<string> {
  return new Promise(async (resolve) => {
    let extension_id = await getExtensionIdentifier();
    getIdentifier().then((deviceId) => {
      let configuration_key = deviceId.split("_")[1];
      resolve(
        `${BASE_LINK_FEEDBACK}?extension_id=${encodeURIComponent(extension_id)}&configuration_key=${configuration_key}`,
      );
    });
  });
}
