import { Logger } from "../logger/logger";

export function saveBurkeResult(recordID: string, apiEndpoint: string, resultToSave: string) {
    return new Promise((resolve, reject) => {
        try {
            Logger.log("[saveBurkeResult] => Result => ", resultToSave);
            Logger.log("[saveBurkeResult] => API Endpoint => ", apiEndpoint);
            fetch(apiEndpoint, {
                method: "POST",
                body: resultToSave
            }).then(response => response.json()).then(data => {
                Logger.log("[saveBurkeResult] => Response => ", data);
                resolve(data);
            }).catch(error => reject(error));
        } catch (error) {
            reject(error);
        }
    });
}