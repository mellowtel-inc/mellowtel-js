import { getLocalStorage, setLocalStorage } from "../storage/storage-helpers";

export function saveToOnlyIfMustStorage(
  recordID: string,
  waitBeforeScraping: number,
  eventData: any,
  url: string,
): Promise<boolean> {
  return new Promise(async (resolve) => {
    let onlyIfMustArray = await getLocalStorage("onlyIfMustArray", true);
    if (onlyIfMustArray === undefined || onlyIfMustArray === null) {
      onlyIfMustArray = [];
    }
    onlyIfMustArray.push({
      recordID: recordID,
      waitBeforeScraping: waitBeforeScraping,
      eventData: eventData,
      url: url,
    });
    await setLocalStorage("onlyIfMustArray", onlyIfMustArray);
    resolve(true);
  });
}

export function getFromOnlyIfMustStorage(recordID: string): Promise<any> {
  return new Promise(async (resolve) => {
    let onlyIfMustArray = await getLocalStorage("onlyIfMustArray", true);
    if (onlyIfMustArray === undefined || onlyIfMustArray === null) {
      resolve(null);
    } else {
      let record = onlyIfMustArray.find(
        (record: any) => record.recordID === recordID,
      );
      resolve(record);
    }
  });
}
