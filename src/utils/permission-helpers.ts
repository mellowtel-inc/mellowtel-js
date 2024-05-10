import { Logger } from "../logger/logger";
import { setLocalStorage, getLocalStorage } from "./storage-helpers";

// The following permissions have to be either in permissions or optional_permissions in manifest.json
// declarativeNetRequest is the exception, as it can't be specified in optional_permissions:
// it is replaced internally with declarativeNetRequestWithHostAccess in optional_permissions alongside
// optional_host_permissions (https://*/*)

// NOTE: starting with version 1.3.0, "tabs" and "declarativeNetRequest" are no longer required permissions if
// the extension is only requiring host_permissions on a specific domain.
// for more info: https://github.com/mellowtel-inc/mellowtel-js/issues/2

const mellowtelRequiredPermissions: string[] = [
  "storage",
  "tabs",
  "declarativeNetRequest",
];

const mellowtelAllowedHostPermissions: string[] = [
    "https://*/*",
    "<all_urls>",
    "\u003Call_urls\u003E",
    "*://*/*"
];

async function setExtensionPermissionsConfig(config: string = "all_urls", specific_domains: string[] = []): Promise<void> {
  await setLocalStorage("mellowtel_host_permissions_config", config);
  await setLocalStorage("mellowtel_specific_domains", JSON.stringify(specific_domains));
}

export async function getExtensionPermissionsConfig(): Promise<{config: string, specific_domains: string[]}> {
  let config = await getLocalStorage("mellowtel_host_permissions_config");
  let specific_domains = await getLocalStorage("mellowtel_specific_domains");
  return {config: config, specific_domains: JSON.parse(specific_domains)};
}

export async function doesItWorkOnAllDomains(): Promise<boolean> {
    let config = await getExtensionPermissionsConfig();
    return config.config === "all_urls";
}

function getChromeManifest(): chrome.runtime.Manifest {
  return chrome.runtime.getManifest();
}

function getHostPermissions(): string[] {
    return getChromeManifest().host_permissions || [];
}

function getOptionalHostPermissions(): string[] {
    return getChromeManifest().optional_host_permissions || [];
}

export function checkIfInPermissions(
  permission: string,
  callback: (isPresent: boolean) => void,
): void {
  const permissions: string[] = getChromeManifest().permissions || [];
  callback(permissions.includes(permission));
}

export function checkIfInOptionalPermissions(
  permission: string,
  callback: (isPresent: boolean) => void,
): void {
  const manifest: chrome.runtime.Manifest = chrome.runtime.getManifest();
  const optionalPermissions: string[] = manifest.optional_permissions || [];
  callback(optionalPermissions.includes(permission));
}

export async function checkRequiredPermissions(
  requestAfterChecking: boolean = false,
): Promise<void> {
  // Let's start by checking if the extension has host permissions specified in the manifest.
  // It could be:
  // 1) An extension that is only requiring host_permissions on a specific domain/s;
  // 2) An extension that is requiring host_permissions on all domains;
  // 3) An extension that is not requiring host_permissions at all

  // filter out "ftp" or "file" from host permissions & optional host permissions.
  // also filter out if it doesn't end with "/*"
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns

  let hostPermissionsExtension: string[] = getHostPermissions();
  let optionalHostPermissionsExtension: string[] = getOptionalHostPermissions();

  hostPermissionsExtension = hostPermissionsExtension.filter((permission) => {
      return !permission.includes("ftp") && !permission.includes("file") && permission.endsWith("/*");
  })

  optionalHostPermissionsExtension = optionalHostPermissionsExtension.filter((permission) => {
      return !permission.includes("ftp") && !permission.includes("file") && permission.endsWith("/*");
  })

  const mergedHostPermissions = hostPermissionsExtension.concat(optionalHostPermissionsExtension);

  if(mergedHostPermissions.length === 0){
    // 3) An extension that is not requiring host_permissions at all
    throw new Error(
        `No host permissions specified in the manifest. Mellowtel requires host permissions to be specified in the manifest`,
    );
  }

  // Now check case 2 by checking if the extension has host permissions on all domains (<all_urls> or \u003Call_urls\u003E or https://*/*)
  let hasAllHostPermissions = false;
  for (let permission of mergedHostPermissions) {
      if (mellowtelAllowedHostPermissions.includes(permission)) {
          hasAllHostPermissions = true;
          break;
      }
  }

  // if hasAllHostPermissions is true, we can proceed like normal (so check all other permissions).
  // It means that either in host_permissions or optional_host_permissions, the extension has host permissions on all domains

  // else 1) only on specific domain/s, but it has to be in host_permissions. Don't accept in optional_host_permissions

  if(!hasAllHostPermissions){
    // check on which specific domain/s
    if(hostPermissionsExtension.length === 0) {
      throw new Error(
          `No host permissions specified in the manifest. Mellowtel requires host permissions to be specified in the manifest`,
      );
    }
    // check if "storage" is in permissions
    checkIfInPermissions("storage", async (isPresent) => {
      if (!isPresent) {
        throw new Error(
            `Required permission storage is not present in the manifest`,
        );
      }
      await setExtensionPermissionsConfig("specific_domains", hostPermissionsExtension);
    })
  } else {
    await setExtensionPermissionsConfig("all_urls", []);
    let permissionsToRequest: string[] = [];
    let hostPermissions: string[] = [];
    for (let permission of mellowtelRequiredPermissions) {
      let isPermissionPresent = false;
      checkIfInPermissions(permission, (isPresent) => {
        if (isPresent) {
          isPermissionPresent = true;
        } else {
          if (permission === "declarativeNetRequest") {
            // declarativeNetRequest can't be specified in optional_permissions,
            // so we check for declarativeNetRequestWithHostAccess and add it to permissionsToRequest,
            // alongside optional_host_permissions
            permission = "declarativeNetRequestWithHostAccess";
          }
          checkIfInOptionalPermissions(permission, (isPresent) => {
            if (isPresent) {
              permissionsToRequest.push(permission);
              if (permission === "declarativeNetRequestWithHostAccess") {
                hostPermissions = chrome.runtime.getManifest()
                    .optional_host_permissions || ["https://*/*"];
              }
            }
          });
        }
      });

      if (!isPermissionPresent && !permissionsToRequest.includes(permission)) {
        throw new Error(
            `Required permission ${permission} is not present in the manifest`,
        );
      }
    }

    Logger.log(
        "PERMISSIONS TO REQUEST : " + JSON.stringify(permissionsToRequest),
    );
    Logger.log("HOST PERMISSIONS : " + JSON.stringify(hostPermissions));
    Logger.log("REQUEST AFTER CHECKING : " + requestAfterChecking);

    if (requestAfterChecking && permissionsToRequest.length > 0) {
      let alreadyGranted = await checkIfPermissionsGranted(permissionsToRequest, hostPermissions);
      if (!alreadyGranted) {
        let granted = await requirePermissions(
            permissionsToRequest,
            hostPermissions,
        );
        if (!granted) {
          throw new Error(
              `Required permissions ${permissionsToRequest.join(", ")} were not granted`,
          );
        }
      }
    }
  }
}

export async function requirePermissions(
  permissions: string[],
  hostPermissions: string[] = [],
): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.request(
      {
        permissions: permissions,
        origins: hostPermissions,
      },
      (granted) => {
        resolve(granted);
      },
    );
  });
}

export async function checkIfPermissionsGranted(
  permissions: string[],
  hostPermissions: string[] = [],
): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains(
      {
        permissions: permissions,
        origins: hostPermissions,
      },
      (granted) => {
        resolve(granted);
      },
    );
  });
}
