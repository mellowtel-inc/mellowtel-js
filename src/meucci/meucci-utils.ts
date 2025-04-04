import { getLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";

interface WebAccessibleResourceV3 {
  resources: string[];
  matches: string[];
}

type WebAccessibleResource = string | WebAccessibleResourceV3;

export function isMeucciEnabled(): Promise<boolean> {
  return new Promise(async (resolve) => {
    let meucciJSFileName = await getLocalStorage("mllwtl_meucciFilePath", true);
    Logger.log("[meucci]: meucciJSFileName", meucciJSFileName);

    if (!meucciJSFileName) {
      resolve(false);
      return;
    }

    const manifest: chrome.runtime.Manifest = chrome.runtime.getManifest();
    const webAccessibleResources = manifest.web_accessible_resources;

    if (!webAccessibleResources) {
      resolve(false);
      return;
    }

    let isMeucciEnabled = false;
    webAccessibleResources.forEach((resource: WebAccessibleResource) => {
      // Manifest V2 format (string)
      if (typeof resource === "string") {
        if (resource === meucciJSFileName) {
          isMeucciEnabled = true;
        }
      }
      // Manifest V3 format (object)
      else if (typeof resource === "object" && "resources" in resource) {
        const resourceV3 = resource as WebAccessibleResourceV3;
        if (
          resourceV3.resources.includes(meucciJSFileName) &&
          resourceV3.matches.includes("<all_urls>")
        ) {
          isMeucciEnabled = true;
        }
      }
    });

    resolve(isMeucciEnabled);
  });
}
