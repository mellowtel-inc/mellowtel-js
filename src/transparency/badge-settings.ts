import { getLocalStorage, setLocalStorage } from "../utils/storage-helpers";
import { Logger } from "../logger/logger";
import { BADGE_COLOR } from "../constants";
import {sendMessageToBackground} from "../utils/messaging-helpers";

export function showBadge(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // if chrome action not defined, send message to background
      if (!chrome.action) {
        sendMessageToBackground({
          intent: "showBadge",
        }).then((response) => {
          resolve(response);
        });
      }
      chrome.action.setBadgeTextColor({ color: BADGE_COLOR });
      chrome.action.setBadgeText({ text: "." });
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
      resolve(true);
    } catch (error) {
      Logger.log("[showBadge]: error " + error);
      resolve(false);
    }
  });
}

export function hideBadge(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // if chrome action not defined, send message to background
      if (!chrome.action) {
        sendMessageToBackground({
          intent: "hideBadge",
        }).then((response) => {
          resolve(response);
        });
      }
      chrome.action.setBadgeText({ text: "" });
      resolve(true);
    } catch (error) {
      Logger.log("[hideBadge]: error " + error);
      resolve(false);
    }
  });
}

export function shouldShowBadge(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      getLocalStorage("shouldShowBadge").then((result) => {
        if (result === undefined || !result.hasOwnProperty("shouldShowBadge")) {
          resolve(false);
        } else {
          let shouldShowBadge = result["shouldShowBadge"]
            .toString()
            .toLowerCase();
          if (shouldShowBadge === "true") {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      });
    } catch (error) {
      Logger.log("[shouldShowBadge]: error " + error);
      resolve(false);
    }
  });
}

export function showBadgeIfShould(): Promise<boolean> {
  return new Promise((resolve) => {
    shouldShowBadge().then((result) => {
      if (result) {
        showBadge().then(() => {
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  });
}

export function hideBadgeIfShould(): Promise<boolean> {
  return new Promise((resolve) => {
    shouldShowBadge().then((result) => {
      if (result) {
        hideBadge().then(() => {
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  });
}

export function setShouldShowBadge(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      setLocalStorage("shouldShowBadge", true).then(() => {
        resolve(true);
      });
    } catch (error) {
      Logger.log("[setShouldShowBadge]: error " + error);
      resolve(false);
    }
  });
}

export function unsetShouldShowBadge(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      setLocalStorage("shouldShowBadge", false).then(() => {
        resolve(true);
      });
    } catch (error) {
      Logger.log("[unsetShouldShowBadge]: error " + error);
      resolve(false);
    }
  });
}
