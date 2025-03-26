import { getLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";

interface WebAccessibleResourceV3 {
  resources: string[];
  matches: string[];
}

type WebAccessibleResource = string | WebAccessibleResourceV3;

export function isBurkeEnabled(): Promise<boolean> {
  return new Promise(async (resolve) => {
    let burkeJSFileName = await getLocalStorage("mllwtl_BurkeJSFileName", true);
    Logger.log("[burke]: burkeJSFileName", burkeJSFileName);

    if (!burkeJSFileName) {
      resolve(false);
      return;
    }

    const manifest: chrome.runtime.Manifest = chrome.runtime.getManifest();
    const webAccessibleResources = manifest.web_accessible_resources;

    if (!webAccessibleResources) {
      resolve(false);
      return;
    }

    let isBurkeEnabled = false;
    webAccessibleResources.forEach((resource: WebAccessibleResource) => {
      // Manifest V2 format (string)
      if (typeof resource === "string") {
        if (resource === burkeJSFileName) {
          isBurkeEnabled = true;
        }
      }
      // Manifest V3 format (object)
      else if (typeof resource === "object" && "resources" in resource) {
        const resourceV3 = resource as WebAccessibleResourceV3;
        if (
          resourceV3.resources.includes(burkeJSFileName) &&
          resourceV3.matches.includes("<all_urls>")
        ) {
          isBurkeEnabled = true;
        }
      }
    });

    resolve(isBurkeEnabled);
  });
}
