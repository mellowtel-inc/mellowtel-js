interface BurkeConfig {
  include_urls?: string[];
  exclude_urls?: string[];
  burke_id: string;
  api_endpoint: string;
  callback?: (requestData: any) => void;
}

export async function initializeBurke(): Promise<void> {
  const currentScript = document.currentScript as HTMLScriptElement;
  if (!currentScript) {
    console.error("Burke: Could not find current script element");
    return;
  }

  const config: BurkeConfig = {
    include_urls: currentScript
      .getAttribute("include-urls")
      ?.split(",")
      .map((url) => url.trim()) || ["/**"],
    exclude_urls:
      currentScript
        .getAttribute("exclude-urls")
        ?.split(",")
        .map((url) => url.trim()) || [],
    burke_id: currentScript.getAttribute("burke-id") || "",
    api_endpoint: currentScript.getAttribute("api-endpoint") || "",
    callback: undefined,
  };

  if (!config.burke_id) {
    console.error("Burke: burke-id attribute is required");
    return;
  }

  if (!config.api_endpoint) {
    console.error("Burke: api-endpoint attribute is required");
    return;
  }

  monitorXHRRequests(config);
}

function monitorXHRRequests(options: BurkeConfig) {
  const config = {
    ...options,
    include_urls: options.include_urls || ["/**"],
    exclude_urls: options.exclude_urls || [],
    burke_id: options.burke_id || "",
    api_endpoint: options.api_endpoint || "",
    callback: options.callback || null,
  };

  if (!config.burke_id) {
    console.error("burke_id is required");
    return () => {};
  }

  if (!config.api_endpoint) {
    console.error("api_endpoint is required");
    return () => {};
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  const originalGetAllResponseHeaders =
    XMLHttpRequest.prototype.getAllResponseHeaders;

  function matchesGlobPattern(url: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      if (pattern === "/*" || pattern === "/**") {
        return true;
      }
      const regexPattern = pattern
        .replace(/\*\*\*/g, ".*") // *** for recursive matching
        .replace(/\*\*/g, "[^/]*") // ** for multiple characters (non-recursive)
        .replace(/\*/g, "[^/]*") // * for any characters (non-recursive)
        .replace(/\./g, "\\.") // Escape dots
        .replace(/\//g, "\\/"); // Escape slashes

      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(url);
    });
  }

  const randomId = function (length = 6): string {
    return Math.random()
      .toString(36)
      .substring(2, length + 2);
  };

  function sendToApiEndpoint(data: any): void {
    console.log("Sending data to API endpoint", data);
    window.parent.postMessage({ 
        isBurkeProcessed: true, 
        recordID: data.id, 
        resultToSave: JSON.stringify(data),
        apiEndpoint: config.api_endpoint,
        type: "saveBurkeResult",
    }, "*");
  }

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string,
    async?: boolean,
    user?: string,
    password?: string,
  ): void {
    (this as any)._requestInfo = {
      id: randomId(),
      burke_id: config.burke_id,
      timestamp: new Date().toISOString(),
      url: url,
      full_url: url.startsWith("http")
        ? url
        : window.location.origin + (url.startsWith("/") ? "" : "/") + url,
      method: method,
      async: async !== false, // async is true by default
      user: user || null,
      headers: {},
      sentData: null,
      responseData: null,
      responseHeaders: null,
      status: null,
      statusText: null,
      duration: null,
      error: null,
    };

    const fullUrl = (this as any)._requestInfo.full_url;

    (this as any)._skipMonitoring =
      (this as any)._isMonitoringRequest ||
      (config.exclude_urls.length > 0 &&
        matchesGlobPattern(fullUrl, config.exclude_urls)) ||
      (config.include_urls.length > 0 &&
        !matchesGlobPattern(fullUrl, config.include_urls));

    return originalOpen.apply(this, arguments as any);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (
    header: string,
    value: string,
  ): void {
    if ((this as any)._requestInfo && !(this as any)._skipMonitoring) {
      (this as any)._requestInfo.headers[header] = value;
    }
    return originalSetRequestHeader.apply(this, arguments as any);
  };

  XMLHttpRequest.prototype.send = function (data?: any): void {
    if ((this as any)._requestInfo && !(this as any)._skipMonitoring) {
      (this as any)._requestInfo.sentData = data;
      (this as any)._requestInfo.sendTimestamp = new Date().toISOString();

      this.addEventListener("load", () => {
        try {
          const endTime = new Date();
          (this as any)._requestInfo.duration =
            endTime.getTime() -
            new Date((this as any)._requestInfo.timestamp).getTime();

          (this as any)._requestInfo.status = this.status;
          (this as any)._requestInfo.statusText = this.statusText;
          (this as any)._requestInfo.responseHeaders =
            this.getAllResponseHeaders();
          (this as any)._requestInfo.responseType = this.responseType;
          (this as any)._requestInfo.responseSize = this.responseText
            ? this.responseText.length
            : null;
          (this as any)._requestInfo.completed = true;

          if (this.responseType === "" || this.responseType === "text") {
            (this as any)._requestInfo.responseData = this.responseText;

            try {
              if (
                this.responseText.trim().startsWith("{") ||
                this.responseText.trim().startsWith("[")
              ) {
                (this as any)._requestInfo.parsedResponse = JSON.parse(
                  this.responseText,
                );
              }
            } catch (e) {
              (this as any)._requestInfo.jsonParseError = (e as Error).message;
            }
          } else if (this.responseType === "json") {
            (this as any)._requestInfo.responseData = this.response;
            (this as any)._requestInfo.parsedResponse = this.response;
          } else if (
            this.responseType === "arraybuffer" ||
            this.responseType === "blob"
          ) {
            (this as any)._requestInfo.responseData = "[Binary data]";
          } else {
            (this as any)._requestInfo.responseData = this.response;
          }

          sendToApiEndpoint((this as any)._requestInfo);

          if (typeof config.callback === "function") {
            config.callback((this as any)._requestInfo);
          }
        } catch (e) {
          console.error("Error in XHR monitoring:", e);
        }
      });

      this.addEventListener("error", () => {
        (this as any)._requestInfo.error = true;
        (this as any)._requestInfo.completed = true;
        (this as any)._requestInfo.errorTimestamp = new Date().toISOString();

        sendToApiEndpoint((this as any)._requestInfo);

        if (typeof config.callback === "function") {
          config.callback((this as any)._requestInfo);
        }
      });

      this.addEventListener("timeout", () => {
        (this as any)._requestInfo.timedOut = true;
        (this as any)._requestInfo.completed = true;
        (this as any)._requestInfo.timeoutTimestamp = new Date().toISOString();

        sendToApiEndpoint((this as any)._requestInfo);

        if (typeof config.callback === "function") {
          config.callback((this as any)._requestInfo);
        }
      });

      this.addEventListener("abort", () => {
        (this as any)._requestInfo.aborted = true;
        (this as any)._requestInfo.completed = true;
        (this as any)._requestInfo.abortTimestamp = new Date().toISOString();

        sendToApiEndpoint((this as any)._requestInfo);

        if (typeof config.callback === "function") {
          config.callback((this as any)._requestInfo);
        }
      });
    }

    return originalSend.apply(this, arguments as any);
  };

  return function stopMonitoring(): boolean {
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalSend;
    XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
    console.log("XHR monitoring stopped");
    return true;
  };
}
