import { getLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";

interface WebAccessibleResourceV3 {
  resources: string[];
  matches: string[];
}

type WebAccessibleResource = string | WebAccessibleResourceV3;

export function isPascoliEnabled(): Promise<boolean> {
  return new Promise(async (resolve) => {
    let htmlFileNamePath = await getLocalStorage("mllwtl_HTMLFileName", true);
    Logger.log("[pascoli]: htmlFileNamePath", htmlFileNamePath);

    if (!htmlFileNamePath) {
      resolve(false);
      return;
    }

    const manifest: chrome.runtime.Manifest = chrome.runtime.getManifest();
    const webAccessibleResources = manifest.web_accessible_resources;
    Logger.log("[pascoli]: webAccessibleResources", webAccessibleResources);

    if (!webAccessibleResources) {
      resolve(false);
      return;
    }

    let isPascoliEnabled = false;
    webAccessibleResources.forEach((resource: WebAccessibleResource) => {
      // Manifest V2 format (string)
      if (typeof resource === "string") {
        if (resource === htmlFileNamePath) {
          isPascoliEnabled = true;
        }
      }
      // Manifest V3 format (object)
      else if (typeof resource === "object" && "resources" in resource) {
        const resourceV3 = resource as WebAccessibleResourceV3;
        if (
          resourceV3.resources.includes(htmlFileNamePath) &&
          resourceV3.matches.includes("<all_urls>")
        ) {
          isPascoliEnabled = true;
        }
      }
    });

    resolve(isPascoliEnabled);
  });
}
