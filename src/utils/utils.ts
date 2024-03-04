import { DATA_ID_IFRAME } from "../constants";

export function getFrameCount() {
  return document.querySelectorAll(`[data-id=${DATA_ID_IFRAME}]`).length;
}
