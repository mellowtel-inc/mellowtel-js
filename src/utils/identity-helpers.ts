import { getLocalStorage, setLocalStorage } from "./storage-helpers";

export async function getOrGenerateIdentifier(
  configuration_key: string,
): Promise<string> {
  return new Promise((resolve) => {
    getLocalStorage("mllwtl_identifier").then((result) => {
      if (
        result.mllwtl_identifier &&
        result.mllwtl_identifier.startsWith(`mllwtl_${configuration_key}`)
      ) {
        resolve(result.mllwtl_identifier);
      } else if (
        result.mllwtl_identifier &&
        result.mllwtl_identifier.startsWith(`mllwtl_`)
      ) {
        generateIdentifier(
          configuration_key,
          true,
          result.mllwtl_identifier,
        ).then((identifier) => {
          resolve(identifier);
        });
      } else {
        generateIdentifier(configuration_key).then((identifier) => {
          resolve(identifier);
        });
      }
    });
  });
}

export async function generateIdentifier(
  configuration_key: string,
  just_update_key: boolean = false,
  previous_identifier: string = "",
): Promise<string> {
  return new Promise((resolve) => {
    const random_string: string = just_update_key
      ? previous_identifier.split("_")[1]
      : generateRandomString(10);
    const identifier: string = `mllwtl_${configuration_key}_${random_string}`;
    setLocalStorage("mllwtl_identifier", identifier).then((result) => {
      resolve(identifier);
    });
  });
}

function generateRandomString(length: number): string {
  return Math.random()
    .toString(36)
    .substring(2, length + 2);
}

export function getIdentifier(): Promise<string> {
  return new Promise((resolve) => {
    getLocalStorage("mllwtl_identifier").then((result) => {
      if (result.mllwtl_identifier) {
        resolve(result.mllwtl_identifier);
      } else {
        setTimeout(() => {
          getIdentifier().then((identifier) => {
            resolve(identifier);
          });
        }, 200);
      }
    });
  });
}
