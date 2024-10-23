import { Logger } from "../logger/logger";

export function addToRequestMessageStorage(record: any) {
  return new Promise(function (res) {
    try {
      chrome.storage.local.get(["recordsMessageInfo"], function (result) {
        let records: any[] = result.recordsMessageInfo || [];
        let recordExists: boolean = false;
        for (let i = 0; i < records.length; i++) {
          if (records[i].recordID === record.recordID) {
            records[i] = record;
            recordExists = true;
            break;
          }
        }
        if (!recordExists) {
          records.push(record);
        }
        chrome.storage.local.set({ recordsMessageInfo: records }, function () {
          res("done");
        });
      });
    } catch (e) {
      Logger.log("addToRequestMessageStorage error", e);
      res("done");
    }
  });
}

export function deleteFromRequestMessageStorage(recordID: string) {
  return new Promise(function (res) {
    try {
      chrome.storage.local.get(["recordsMessageInfo"], function (result) {
        let records: any[] = result.recordsMessageInfo || [];
        let newRecords: any[] = [];
        for (let i = 0; i < records.length; i++) {
          if (records[i].recordID !== recordID) {
            newRecords.push(records[i]);
          }
        }
        chrome.storage.local.set(
          { recordsMessageInfo: newRecords },
          function () {
            res("done");
          },
        );
      });
    } catch (e) {
      Logger.log("deleteFromRequestInfoStorage error", e);
      res("done");
    }
  });
}

export function getFromRequestMessageStorage(recordID: string): Promise<any> {
  return new Promise(function (res) {
    try {
      chrome.storage.local.get(["recordsMessageInfo"], function (result) {
        let records: any[] = result.recordsMessageInfo || [];
        for (let i = 0; i < records.length; i++) {
          if (records[i].recordID === recordID) {
            res(records[i]);
            return;
          }
        }
        res({ statusCode: 1000, isPDF: false });
      });
    } catch (e) {
      Logger.log("getFromRequestMessageStorage error", e);
      res(null);
    }
  });
}
