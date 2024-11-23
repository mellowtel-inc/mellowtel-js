import { Logger } from "../logger/logger";
import { getLocalStorage, setLocalStorage } from "../storage/storage-helpers";

const TRIGGER_TIMESTAMP_KEY: string = "mllwtl_trigger_rules_timestamp";
const MINIMUM_RESET_INTERVAL: number = 60000; // 60 seconds in milliseconds
const RETRY_INTERVAL: number = 15000; // 15 seconds in milliseconds

export async function saveTriggerTimestamp(): Promise<boolean> {
  try {
    const timestamp = Date.now();
    const saved = await setLocalStorage(TRIGGER_TIMESTAMP_KEY, timestamp);
    Logger.log("[saveTriggerTimestamp] Saved timestamp:", timestamp);
    return saved;
  } catch (error) {
    Logger.error("[saveTriggerTimestamp] Error saving timestamp:", error);
    return false;
  }
}

export async function getTriggerTimestamp(): Promise<number> {
  try {
    const timestamp = await getLocalStorage(TRIGGER_TIMESTAMP_KEY, true);
    Logger.log("[getTriggerTimestamp] Retrieved timestamp:", timestamp);
    return timestamp || 0;
  } catch (error) {
    Logger.error("[getTriggerTimestamp] Error retrieving timestamp:", error);
    return 0;
  }
}

export async function shouldResetTriggers(): Promise<boolean> {
  const lastTimestamp = await getTriggerTimestamp();
  if (lastTimestamp === 0) return true;

  const elapsed = Date.now() - lastTimestamp;
  const shouldReset = elapsed >= MINIMUM_RESET_INTERVAL;

  Logger.log("[shouldResetTriggers] Time elapsed:", elapsed, "ms");
  Logger.log("[shouldResetTriggers] Should reset:", shouldReset);

  return shouldReset;
}

export async function waitForResetInterval(): Promise<void> {
  return new Promise((resolve) => {
    const checkAndResolve = async () => {
      if (await shouldResetTriggers()) {
        Logger.log(
          "[waitForResetInterval] Minimum interval reached, proceeding with reset",
        );
        resolve();
      } else {
        Logger.log(
          "[waitForResetInterval] Minimum interval not reached, retrying in 15 seconds",
        );
        setTimeout(checkAndResolve, RETRY_INTERVAL);
      }
    };

    checkAndResolve();
  });
}
