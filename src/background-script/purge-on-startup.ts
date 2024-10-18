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
    ];
    await deleteLocalStorage(keysToPurge);
  });
}
