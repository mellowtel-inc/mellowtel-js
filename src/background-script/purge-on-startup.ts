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
