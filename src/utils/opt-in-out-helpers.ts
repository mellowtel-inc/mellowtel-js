export async function getOptInStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get("mellowtelOptIn", function (result) {
      if (result !== undefined && result["mellowtelOptIn"] === "true") {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}
