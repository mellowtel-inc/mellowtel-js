const mellowtelDomains = ["https://*.mellowtel.it/*", "https://*.mellow.tel/*"];

export async function checkWebPlatformMessaging() {
  return new Promise((resolve) => {
    let is_external_connectable = false;
    let matchedDomains = 0;
    chrome.runtime
      .getManifest()
      ?.externally_connectable?.matches?.forEach((match) => {
        if (mellowtelDomains.includes(match)) {
          matchedDomains++;
        }
      });
    if (matchedDomains === mellowtelDomains.length) {
      is_external_connectable = true;
    } else {
      console.error(
        "[Mellowtel Important] : Web platform messaging permission not present for all domains",
      );
    }
    resolve(is_external_connectable);
  });
}
