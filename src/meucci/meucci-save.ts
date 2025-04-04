import { Logger } from "../logger/logger";

export function saveMeucciResult(
  recordID: string,
  apiEndpoint: string,
  resultToSave: string,
) {
  return new Promise((resolve, reject) => {
    try {
      Logger.log("[saveMeucciResult] => Result => ", resultToSave);
      Logger.log("[saveMeucciResult] => API Endpoint => ", apiEndpoint);
      fetch(apiEndpoint, {
        method: "POST",
        body: resultToSave,
      })
        .then((response) => response.json())
        .then((data) => {
          Logger.log("[saveMeucciResult] => Response => ", data);
          resolve(data);
        })
        .catch((error) => reject(error));
    } catch (error) {
      reject(error);
    }
  });
}
