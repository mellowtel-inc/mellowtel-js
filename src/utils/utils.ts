import { DATA_ID_IFRAME, DATA_ID_IFRAME_BATCH } from "../constants";
import { inIframe } from "./iframe-helpers";

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
  if (typeof navigator === "undefined") return "unknown";
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

export function isInSW(): Promise<boolean> {
  // Detect the MV3 service worker by its global scope. The service worker has
  // no `window` (popup, content scripts and offscreen documents all do) and is
  // an instance of ServiceWorkerGlobalScope. Note: do NOT probe for an API like
  // declarativeNetRequest here, as extension pages (popup, options, offscreen)
  // share the same permissions and would be misdetected as the service worker.
  const g: any = typeof self !== "undefined" ? self : undefined;
  const inServiceWorker: boolean =
    typeof window === "undefined" &&
    g !== undefined &&
    typeof g.ServiceWorkerGlobalScope !== "undefined" &&
    g instanceof g.ServiceWorkerGlobalScope;

  return new Promise((resolve) => {
    if (inServiceWorker) {
      resolve(true);
      return;
    }
    // Firefox has no extension service worker: its background page / event
    // page has a `window`, so detect it explicitly. Firefox only.
    if (typeof window !== "undefined" && detectBrowser() === "firefox") {
      try {
        // @ts-ignore
        resolve(chrome.extension.getBackgroundPage() === window);
      } catch (error) {
        resolve(false);
      }
      return;
    }
    resolve(false);
  });
}

export function getManifestVersion() {
  return chrome.runtime.getManifest().manifest_version;
}

export function normalizePath(path: string): string {
  return path.replace(/^\/+/, "");
}

export function getFinalUrl() {
  if (inIframe()) {
    return window.location.href;
  }
  return "https://endpoint-example.com";
}
