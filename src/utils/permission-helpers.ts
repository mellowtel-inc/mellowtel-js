import { Logger } from "../logger/logger";

// The following permissions have to be either in permissions or optional_permissions in manifest.json
// declarativeNetRequest is the exception, as it can't be specified in optional_permissions:
// it is replaced internally with declarativeNetRequestWithHostAccess in optional_permissions alongside
// optional_host_permissions (https://*/*)
export const requiredPermissions: string[] = [
  "storage",
  "tabs",
  "declarativeNetRequest",
];

export function checkIfInPermissions(
  permission: string,
  callback: (isPresent: boolean) => void,
): void {
  const manifest: chrome.runtime.Manifest = chrome.runtime.getManifest();
  const permissions: string[] = manifest.permissions || [];
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
  let permissionsToRequest: string[] = [];
  let hostPermissions: string[] = [];
  for (let permission of requiredPermissions) {
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
    let alreadyGranted = await checkIfPermissionsGranted(permissionsToRequest);
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
): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains(
      {
        permissions: permissions,
      },
      (granted) => {
        resolve(granted);
      },
    );
  });
}
