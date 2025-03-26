interface BurkeConfig {
  include_urls?: string[];
  exclude_urls?: string[];
  burke_id: string;
  api_endpoint: string;
  callback?: (requestData: any) => void;
}

export async function initializeBurke(): Promise<void> {
  // Get the script element that loaded this file
  const currentScript = document.currentScript as HTMLScriptElement;
  if (!currentScript) {
    console.error("Burke: Could not find current script element");
    return;
  }

  // Parse configuration from script attributes
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

  // Validate required parameters
  if (!config.burke_id) {
    console.error("Burke: burke-id attribute is required");
    return;
  }

  if (!config.api_endpoint) {
    console.error("Burke: api-endpoint attribute is required");
    return;
  }

  // Start monitoring
  monitorXHRRequests(config);
}

function monitorXHRRequests(options: BurkeConfig) {
  // Default options
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

  // Store the original XMLHttpRequest prototype methods
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  const originalGetAllResponseHeaders =
    XMLHttpRequest.prototype.getAllResponseHeaders;

  // Function to match URL against glob patterns
  function matchesGlobPattern(url: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      // Convert glob pattern to regex
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

  // Generate a unique ID for each request
  const randomId = function (length = 6): string {
    return Math.random()
      .toString(36)
      .substring(2, length + 2);
  };

  // Send the captured data to the API endpoint
  function sendToApiEndpoint(data: any): void {
    console.log("Sending data to API endpoint", data);
    // simply post this to window.parent and let the parent handle it
    // add something like isBurkeProcessed: true to the message
    window.parent.postMessage({ 
        isBurkeProcessed: true, 
        recordID: data.id, 
        resultToSave: JSON.stringify(data),
        apiEndpoint: config.api_endpoint,
        type: "saveBurkeResult",
    }, "*");
    /*const xhr = new XMLHttpRequest();
    (xhr as any)._isMonitoringRequest = true; // Mark this request to avoid infinite recursion
    xhr.open("POST", config.api_endpoint, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(data));*/
  }

  // Replace the open method with our monitored version
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string,
    async?: boolean,
    user?: string,
    password?: string,
  ): void {
    // Store request information on the XHR object itself
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

    // Check if monitoring should be skipped for this request
    const fullUrl = (this as any)._requestInfo.full_url;

    // Skip monitoring for our own API calls to avoid infinite recursion
    (this as any)._skipMonitoring =
      (this as any)._isMonitoringRequest ||
      (config.exclude_urls.length > 0 &&
        matchesGlobPattern(fullUrl, config.exclude_urls)) ||
      (config.include_urls.length > 0 &&
        !matchesGlobPattern(fullUrl, config.include_urls));

    // Call the original open method
    return originalOpen.apply(this, arguments as any);
  };

  // Replace the setRequestHeader method
  XMLHttpRequest.prototype.setRequestHeader = function (
    header: string,
    value: string,
  ): void {
    if ((this as any)._requestInfo && !(this as any)._skipMonitoring) {
      (this as any)._requestInfo.headers[header] = value;
    }
    return originalSetRequestHeader.apply(this, arguments as any);
  };

  // Replace the send method with our monitored version
  XMLHttpRequest.prototype.send = function (data?: any): void {
    if ((this as any)._requestInfo && !(this as any)._skipMonitoring) {
      (this as any)._requestInfo.sentData = data;
      (this as any)._requestInfo.sendTimestamp = new Date().toISOString();

      // Add response listeners
      this.addEventListener("load", () => {
        try {
          // Calculate request duration
          const endTime = new Date();
          (this as any)._requestInfo.duration =
            endTime.getTime() -
            new Date((this as any)._requestInfo.timestamp).getTime();

          // Capture response information
          (this as any)._requestInfo.status = this.status;
          (this as any)._requestInfo.statusText = this.statusText;
          (this as any)._requestInfo.responseHeaders =
            this.getAllResponseHeaders();
          (this as any)._requestInfo.responseType = this.responseType;
          (this as any)._requestInfo.responseSize = this.responseText
            ? this.responseText.length
            : null;
          (this as any)._requestInfo.completed = true;

          // Capture response data based on type
          if (this.responseType === "" || this.responseType === "text") {
            (this as any)._requestInfo.responseData = this.responseText;

            // Try to parse as JSON if it looks like JSON
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

          // Send data to API endpoint
          sendToApiEndpoint((this as any)._requestInfo);

          // Call the callback if provided
          if (typeof config.callback === "function") {
            config.callback((this as any)._requestInfo);
          }
        } catch (e) {
          console.error("Error in XHR monitoring:", e);
        }
      });

      // Add error listener
      this.addEventListener("error", () => {
        (this as any)._requestInfo.error = true;
        (this as any)._requestInfo.completed = true;
        (this as any)._requestInfo.errorTimestamp = new Date().toISOString();

        // Send data to API endpoint even on error
        sendToApiEndpoint((this as any)._requestInfo);

        if (typeof config.callback === "function") {
          config.callback((this as any)._requestInfo);
        }
      });

      // Add timeout listener
      this.addEventListener("timeout", () => {
        (this as any)._requestInfo.timedOut = true;
        (this as any)._requestInfo.completed = true;
        (this as any)._requestInfo.timeoutTimestamp = new Date().toISOString();

        // Send data to API endpoint even on timeout
        sendToApiEndpoint((this as any)._requestInfo);

        if (typeof config.callback === "function") {
          config.callback((this as any)._requestInfo);
        }
      });

      // Add abort listener
      this.addEventListener("abort", () => {
        (this as any)._requestInfo.aborted = true;
        (this as any)._requestInfo.completed = true;
        (this as any)._requestInfo.abortTimestamp = new Date().toISOString();

        // Send data to API endpoint even on abort
        sendToApiEndpoint((this as any)._requestInfo);

        if (typeof config.callback === "function") {
          config.callback((this as any)._requestInfo);
        }
      });
    }

    // Call the original send method
    return originalSend.apply(this, arguments as any);
  };

  // Return a function to restore the original methods
  return function stopMonitoring(): boolean {
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalSend;
    XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
    console.log("XHR monitoring stopped");
    return true;
  };
}
