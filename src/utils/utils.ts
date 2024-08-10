import { DATA_ID_IFRAME, DATA_ID_IFRAME_BATCH } from "../constants";
import { sendMessageToContentScript } from "./messaging-helpers";

export function getFrameCount(BATCH_execution: boolean) {
  return document.querySelectorAll(
    `[data-id=${BATCH_execution ? DATA_ID_IFRAME_BATCH : DATA_ID_IFRAME}]`,
  ).length;
}

export function openPopupWindow(
  url: string,
  title: string,
  w: number,
  h: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    let left = screen.width / 2 - w / 2;
    let top = screen.height / 2 - h / 2 - 150;
    window.open(
      url,
      title,
      `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${w}, height=${h}, top=${top}, left=${left}`,
    );
    resolve(true);
  });
}

export function detectBrowser() {
  if(typeof navigator === "undefined") return "unknown";
  var userAgent = navigator.userAgent;
  if (userAgent.indexOf("Edg") > -1) {
    return "edge";
  } else if (userAgent.indexOf("OPR") > -1) {
    return "opera";
  } else if (userAgent.indexOf("Chrome") > -1) {
    return "chrome";
  } else if (userAgent.indexOf("Firefox") > -1) {
    return "firefox";
  } else if (userAgent.indexOf("Safari") > -1) {
    return "safari";
  } else if (
    userAgent.indexOf("Trident") > -1 ||
    userAgent.indexOf("MSIE") > -1
  ) {
    return "ie";
  }

  return "unknown";
}

export function getManifestVersion() {
  return chrome.runtime.getManifest().manifest_version;
}
