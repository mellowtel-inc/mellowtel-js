import { DATA_ID_IFRAME, DATA_ID_IFRAME_BATCH } from "../constants";

export function getFrameCount(BATCH_execution: boolean) {
  return document.querySelectorAll(
    `[data-id=${BATCH_execution ? DATA_ID_IFRAME_BATCH : DATA_ID_IFRAME}]`,
  ).length;
}
