import { getLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";

interface WebAccessibleResourceV3 {
  resources: string[];
  matches: string[];
}

type WebAccessibleResource = string | WebAccessibleResourceV3;

export function isPascoliEnabled(): Promise<boolean> {
  return new Promise(async (resolve) => {
    let pascoliFilePath = await getLocalStorage("mllwtl_pascoliFilePath", true);
    Logger.log("[pascoli]: pascoliFilePath", pascoliFilePath);

    if (!pascoliFilePath) {
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
        if (resource === pascoliFilePath) {
          isPascoliEnabled = true;
        }
      }
      // Manifest V3 format (object)
      else if (typeof resource === "object" && "resources" in resource) {
        const resourceV3 = resource as WebAccessibleResourceV3;
        if (
          resourceV3.resources.includes(pascoliFilePath) &&
          resourceV3.matches.includes("<all_urls>")
        ) {
          isPascoliEnabled = true;
        }
      }
    });

    resolve(isPascoliEnabled);
  });
}
