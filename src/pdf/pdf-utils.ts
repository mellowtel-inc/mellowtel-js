import { getLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";
import { normalizePath } from "../utils/utils";

interface WebAccessibleResourceV3 {
  resources: string[];
  matches: string[];
}

type WebAccessibleResource = string | WebAccessibleResourceV3;

export function isPdfModuleEnabled(): Promise<boolean> {
  return new Promise(async (resolve) => {
    let pdfFilePath = await getLocalStorage("mllwtl_pdfFilePath", true);
    Logger.log("[pdf-module]: pdfFilePath", pdfFilePath);

    if (!pdfFilePath) {
      resolve(false);
      return;
    }

    const manifest: chrome.runtime.Manifest = chrome.runtime.getManifest();
    const webAccessibleResources = manifest.web_accessible_resources;
    Logger.log("[pdf-module]: webAccessibleResources", webAccessibleResources);

    if (!webAccessibleResources) {
      resolve(false);
      return;
    }

    let isEnabled = false;
    webAccessibleResources.forEach((resource: WebAccessibleResource) => {
      // Manifest V2 format (string)
      if (typeof resource === "string") {
        if (normalizePath(resource) === normalizePath(pdfFilePath)) {
          isEnabled = true;
        }
      }
      // Manifest V3 format (object)
      else if (typeof resource === "object" && "resources" in resource) {
        const resourceV3 = resource as WebAccessibleResourceV3;
        if (
          resourceV3.resources.some(
            (r) => normalizePath(r) === normalizePath(pdfFilePath),
          ) &&
          resourceV3.matches.includes("<all_urls>")
        ) {
          isEnabled = true;
        }
      }
    });

    resolve(isEnabled);
  });
}
