import { getLocalStorage, setLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";
import { SW_PING_INTERVAL, FIREFOX_PING_INTERVAL } from "../constants";
import { detectBrowser, isInSW } from "../utils/utils";

const KEEP_PING_STATUS = "keep_ping_status";
let keepAliveInterval: number | null = null;
let firefoxKeepAliveListenerAdded: boolean = false;

const keepAlive = () => {
  chrome.runtime.sendMessage("ping", (response) => {
    if (chrome.runtime.lastError) {
      // Logger.log("[keepAlive] Error sending ping:", chrome.runtime.lastError.message);
    }
  });
};

// Firefox counts background activity by the events the background receives;
// a message it sends to itself never arrives. Writing to storage.session (in
// memory, hidden from content scripts) fires storage.onChanged in the
// background, which maintains the background connection while a session is
// active.
const keepAliveFirefox = () => {
  try {
    chrome.storage.session.set({ mllwtl_keep_alive: Date.now() });
  } catch (error) {
    // Logger.log("[keepAliveFirefox] Error writing keep-alive:", error);
  }
};

export const startPing = async (): Promise<void> => {
  try {
    const inServiceWorker = await isInSW();

    if (inServiceWorker) {
      // Clear any existing interval first
      await stopPing();

      // Start new interval
      let browser = detectBrowser();
      if (browser === "firefox" && chrome.storage.session) {
        if (!firefoxKeepAliveListenerAdded) {
          // storage.onChanged is only dispatched to contexts with a listener
          chrome.storage.onChanged.addListener(() => {});
          firefoxKeepAliveListenerAdded = true;
        }
        keepAliveInterval = setInterval(
          keepAliveFirefox,
          FIREFOX_PING_INTERVAL,
        );
      } else {
        keepAliveInterval = setInterval(keepAlive, SW_PING_INTERVAL);
      }
      await setLocalStorage(KEEP_PING_STATUS, true);
      Logger.log("[startPing] Keep-alive started in Service Worker");
    } else {
      // In content script - send message to SW to start ping
      chrome.runtime.sendMessage({ intent: "mllwtl_startPing" });
      Logger.log("[startPing] Requested Service Worker to start keep-alive");
    }
  } catch (error) {
    Logger.log("[startPing] Error starting keep-alive:", error);
  }
};

export const stopPing = async (): Promise<void> => {
  try {
    const inServiceWorker = await isInSW();

    if (inServiceWorker) {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      await setLocalStorage(KEEP_PING_STATUS, false);
      Logger.log("[stopPing] Keep-alive stopped in Service Worker");
    } else {
      // In content script - send message to SW to stop ping
      chrome.runtime.sendMessage({ intent: "mllwtl_stopPing" });
      Logger.log("[stopPing] Requested Service Worker to stop keep-alive");
    }
  } catch (error) {
    Logger.log("[stopPing] Error stopping keep-alive:", error);
  }
};

export const isPingEnabled = async (): Promise<boolean> => {
  try {
    const status = await getLocalStorage(KEEP_PING_STATUS, true);
    return status === true;
  } catch (error) {
    Logger.log("[isPingEnabled] Error checking ping status:", error);
    return false;
  }
};
