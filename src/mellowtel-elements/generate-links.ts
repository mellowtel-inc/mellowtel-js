import {
  getChromeExtensionIdentifier,
  getIdentifier,
} from "../utils/identity-helpers";
const BASE_LINK_SETTING = "https://www.mellow.tel/settings/";
const BASE_LINK_OPT_IN = "https://www.mellow.tel/opt-in/";

export function generateOptInLink(): Promise<string> {
  return new Promise(async (resolve) => {
    let extension_id = await getChromeExtensionIdentifier();
    getIdentifier().then((nodeId) => {
      let configuration_key = nodeId.split("_")[1];
      resolve(
        `${BASE_LINK_OPT_IN}$?extension_id=${extension_id}&configuration_key=${configuration_key}`,
      );
    });
  });
}

export function generateSettingsLink(): Promise<string> {
  return new Promise(async (resolve) => {
    let extension_id = await getChromeExtensionIdentifier();
    getIdentifier().then((nodeId) => {
      let configuration_key = nodeId.split("_")[1];
      resolve(
        `${BASE_LINK_SETTING}$?extension_id=${extension_id}&configuration_key=${configuration_key}`,
      );
    });
  });
}
