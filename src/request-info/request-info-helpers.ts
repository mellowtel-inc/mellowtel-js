import { Logger } from "../logger/logger";

export function addToRequestInfoStorage(record: any) {
  return new Promise(function (res) {
    try {
      chrome.storage.local.get(["recordsRequestInfo"], function (result) {
        let records: any[] = result.recordsRequestInfo || [];
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
        chrome.storage.local.set({ recordsRequestInfo: records }, function () {
          Logger.log("[addToRequestInfoStorage]: added record", record);
          res("done");
        });
      });
    } catch (e) {
      Logger.log("addToRequestInfoStorage error", e);
      res("done");
    }
  });
}

export function deleteFromRequestInfoStorage(recordID: string) {
  return new Promise(function (res) {
    try {
      chrome.storage.local.get(["recordsRequestInfo"], function (result) {
        let records: any[] = result.recordsRequestInfo || [];
        let newRecords: any[] = [];
        for (let i = 0; i < records.length; i++) {
          if (records[i].recordID !== recordID) {
            newRecords.push(records[i]);
          }
        }
        chrome.storage.local.set(
          { recordsRequestInfo: newRecords },
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

export function getFromRequestInfoStorage(recordID: string) {
  return new Promise(function (res) {
    try {
      chrome.storage.local.get(["recordsRequestInfo"], function (result) {
        let records: any[] = result.recordsRequestInfo || [];
        for (let i = 0; i < records.length; i++) {
          if (records[i].recordID === recordID) {
            res(records[i]);
            return;
          }
        }
        res({ statusCode: 1000, isPDF: false });
      });
    } catch (e) {
      Logger.log("getFromRequestInfoStorage error", e);
      res(null);
    }
  });
}
