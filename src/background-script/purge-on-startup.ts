import { RULE_ID_START_BCREW } from "../constants";
import { Logger } from "../logger/logger";
import { deleteLocalStorage } from "../storage/storage-helpers";

export async function purgeOnStartup(): Promise<void> {
  chrome.runtime.onStartup.addListener(async function () {
    const keysToPurge: string[] = [
      "webSocketConnected",
      "queue_batch",
      "queue",
      "already_checked_switch",
      "checked_switch_value",
      "recordsRequestInfo",
      "recordsMessageInfo",
      "unfocusedWindowId",
      "onlyIfMustArray",
      "mllwtl_cereal_frame_tab",
      "device_disconnect_session",
    ];
    await deleteLocalStorage(keysToPurge);
  });
}

export async function purgeDNROnStartup(): Promise<void> {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  const rulesToRemove = rules.filter((rule) => rule.id >= RULE_ID_START_BCREW);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rulesToRemove.map((rule) => rule.id),
  });
  Logger.log(
    `[purgeDNROnStartup] Removed ${rulesToRemove.length} dynamic rules`,
  );
}
