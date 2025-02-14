import { Logger } from "../logger/logger";
import { detectBrowser } from "../utils/utils";

// The following permissions have to be either in permissions or optional_permissions in manifest.json
// declarativeNetRequest is the exception, as it can't be specified in optional_permissions:
// it is replaced internally with declarativeNetRequestWithHostAccess in optional_permissions alongside
// optional_host_permissions (https://*/*)
export let requiredPermissions: string[] = ["storage", "declarativeNetRequest"];

export function checkIfInPermissions(permission: string): Promise<boolean> {
  return new Promise((resolve) => {
    const manifest: chrome.runtime.Manifest = chrome.runtime.getManifest();
    const permissions: string[] = manifest.permissions || [];
    resolve(permissions.includes(permission));
  });
}

export function checkIfInOptionalPermissions(permission: string): Promise<boolean> {
  return new Promise((resolve) => {
    const manifest: chrome.runtime.Manifest = chrome.runtime.getManifest();
    const optionalPermissions: string[] = manifest.optional_permissions || [];
    resolve(optionalPermissions.includes(permission));
  });
}

export function checkHostPermissionsMV2_3(): Promise<boolean> {
  return new Promise((resolve) => {
    const manifest: chrome.runtime.Manifest = chrome.runtime.getManifest();

    if (manifest.manifest_version === 2) {
      const permissions = manifest.permissions || [];
      const optionalPermissions = manifest.optional_permissions || [];

      if (
        !permissions.includes("<all_urls>") &&
        !permissions.includes("https://*/*") &&
        !optionalPermissions.includes("<all_urls>") &&
        !optionalPermissions.includes("https://*/*")
      ) {
        throw new Error(
          'Required permission "https://*/*" is not present in either permissions or optional_permissions in manifest version 2',
        );
      }
    } else if (manifest.manifest_version === 3) {
      const hostPermissions = manifest.host_permissions || [];
      const optionalHostPermissions = manifest.optional_host_permissions || [];

      if (
        !hostPermissions.includes("<all_urls>") &&
        !hostPermissions.includes("https://*/*") &&
        !optionalHostPermissions.includes("<all_urls>") &&
        !optionalHostPermissions.includes("https://*/*")
      ) {
        throw new Error(
          'Required permission "https://*/*" is not present in either host_permissions or optional_host_permissions in manifest version 3',
        );
      }
    }
    Logger.log("[checkHostPermissionsMV2_3] Host permissions are present");
    resolve(true);
  });
}

export async function checkRequiredPermissions(
  requestAfterChecking: boolean = false,
): Promise<void> {
  let permissionsToRequest: string[] = [];
  let hostPermissions: string[] = [];
  // if browser is safari, we can remove declarativeNetRequest from requiredPermissions
  if (detectBrowser() === "safari") {
    requiredPermissions.splice(
      requiredPermissions.indexOf("declarativeNetRequest"),
      1,
    );
  }
  for (let permission of requiredPermissions) {
    Logger.log("[checkRequiredPermissions] Checking : " + permission);
    let isPermissionPresent = false;
    let isPresent = await checkIfInPermissions(permission);
    Logger.log(
      "[checkRequiredPermissions] Permission : " +
        permission +
        " is present : " +
        isPresent,
    );
    if (isPresent) {
      isPermissionPresent = true;
    } else if (permission === "declarativeNetRequest") {
      // declarativeNetRequest can't be specified in optional_permissions,
      // so we check for declarativeNetRequestWithHostAccess and add it to permissionsToRequest,
      // alongside optional_host_permissions
      permission = "declarativeNetRequestWithHostAccess";
      hostPermissions = chrome.runtime.getManifest()
        .optional_host_permissions || ["https://*/*"];
      Logger.log(
        "declarativeNetRequest is not present in permissions, checking for declarativeNetRequestWithHostAccess",
      );
      const isDNRWithHostAccessInPermissions = await checkIfInPermissions(permission);
      const isDNRWithHostAccessInOptionalPermissions = await checkIfInOptionalPermissions(permission);
      if (isDNRWithHostAccessInPermissions) {
        Logger.log("declarativeNetRequestWithHostAccess is present");
        isPermissionPresent = true;
      }
      else if (isDNRWithHostAccessInOptionalPermissions) {
        Logger.log("declarativeNetRequestWithHostAccess is present in optional_permissions");
        permissionsToRequest.push(permission);
      }
    }

    Logger.log(
      "PERMISSION : " + permission + " IS PRESENT : " + isPermissionPresent,
    );

    if (!isPermissionPresent && !permissionsToRequest.includes(permission)) {
      throw new Error(
        `[init]: Required permission ${permission} is not present in the manifest`,
      );
    }
  }

  await checkHostPermissionsMV2_3();

  if (requestAfterChecking) {
    const alreadyGranted = await checkIfPermissionsGranted(permissionsToRequest, hostPermissions);
    if (!alreadyGranted) {
      let granted = await requirePermissions(
        permissionsToRequest,
        hostPermissions,
      );
      if (!granted) {
        throw new Error(
          `Required permissions ${permissionsToRequest.join(", ")}, or Host permissions ${hostPermissions.join(", ")} were not granted`,
        );
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
  host_permissions: string[],
): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains(
      {
        permissions: permissions,
        origins: host_permissions,
      },
      (granted) => {
        resolve(granted);
      },
    );
  });
}
