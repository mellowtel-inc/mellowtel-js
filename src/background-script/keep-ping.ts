import { getLocalStorage, setLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";
import { SW_PING_INTERVAL } from "../constants";

const KEEP_PING_STATUS = "keep_ping_status";
let keepAliveInterval: number | null = null;

const keepAlive = () => {
  chrome.runtime.sendMessage("ping").catch((error) => {
    // Logger.log("[keepAlive] Error sending ping:", error);
  });
};

export const startPing = async (): Promise<void> => {
  try {
    // Clear any existing interval first
    await stopPing();

    // Start new interval
    keepAliveInterval = setInterval(keepAlive, SW_PING_INTERVAL);

    // Store state
    await setLocalStorage(KEEP_PING_STATUS, true);
    Logger.log("[startPing] Keep-alive started");
  } catch (error) {
    Logger.log("[startPing] Error starting keep-alive:", error);
  }
};

export const stopPing = async (): Promise<void> => {
  try {
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }

    await setLocalStorage(KEEP_PING_STATUS, false);
    Logger.log("[stopPing] Keep-alive stopped");
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
