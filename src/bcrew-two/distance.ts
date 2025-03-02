import { WebsiteJar } from "./expand-jar";

export function applyDistance(jarData: WebsiteJar): Promise<void> {
  return new Promise((resolve) => {
    console.log("Applying distance with jar data:", jarData);

    // Filter to get only non-HTTP-only cookies
    const nonHttpOnlyCookies = jarData.cookies.filter(
      (cookie) => !cookie.httpOnly,
    );

    // Set non-HTTP-only cookies using JavaScript
    nonHttpOnlyCookies.forEach((cookie) => {
      let cookieStr = `${cookie.name}=${cookie.value}; path=${cookie.path}`;

      if (cookie.domain) cookieStr += `; domain=${cookie.domain}`;
      if (cookie.secure) cookieStr += "; secure";

      // Add expiration if not a session cookie
      if (!cookie.session && cookie.expirationDate) {
        const expirationDate = new Date(cookie.expirationDate * 1000);
        cookieStr += `; expires=${expirationDate.toUTCString()}`;
      }

      // Set the cookie
      document.cookie = cookieStr;
      console.log(`Set cookie: ${cookieStr}`);
    });

    // Set localStorage items
    Object.entries(jarData.localStorage).forEach(([key, value]) => {
      try {
        localStorage.setItem(key, value);
        console.log(`Set localStorage: ${key}`);
      } catch (error) {
        console.error(`Error setting localStorage item ${key}:`, error);
      }
    });

    // Set sessionStorage items
    Object.entries(jarData.sessionStorage).forEach(([key, value]) => {
      try {
        sessionStorage.setItem(key, value);
        console.log(`Set sessionStorage: ${key}`);
      } catch (error) {
        console.error(`Error setting sessionStorage item ${key}:`, error);
      }
    });

    // Add event listener for page load completion
    window.addEventListener("load", function loadHandler() {
      window.removeEventListener("load", loadHandler);
      console.log("Page load complete after applying distance");
      setTimeout(() => {
        resolve();
      }, 500); // Small delay to ensure everything is settled
    });

    // Refresh the page to apply all changes
    console.log("Reloading page to apply changes");
    window.location.reload();
  });
}
