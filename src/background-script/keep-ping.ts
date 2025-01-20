import { getLocalStorage, setLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";
import { SW_PING_INTERVAL } from "../constants";
import { isInSW } from "../utils/utils";

const KEEP_PING_STATUS = "keep_ping_status";
let keepAliveInterval: number | null = null;

const keepAlive = () => {
  chrome.runtime.sendMessage("ping").catch((error) => {
    // Logger.log("[keepAlive] Error sending ping:", error);
  });
};

export const startPing = async (): Promise<void> => {
  try {
    const inServiceWorker = await isInSW();

    if (inServiceWorker) {
      // Clear any existing interval first
      await stopPing();

      // Start new interval
      keepAliveInterval = setInterval(keepAlive, SW_PING_INTERVAL);
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
