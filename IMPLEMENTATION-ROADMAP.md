# Implementation Roadmap

Check if it has host permissions only for specific hosts (such as fiverr.com, youtube.com, etc.). If this condition is met, omit the checks for tabs and declarativeNetRequest. Instead, establish a variable in local storage indicating to the server to solely transmit URLs conforming to that pattern.

For all other "tabs" API usage, its purpose is to maintain a single active WebSocket at any given time. By incorporating a server-side enforcement mechanism, when these configurations are conveyed, we can trigger a server-side check to uphold a singular connection. Thus, the server supersedes the "tabs" API functionality.

Considering that the iframe will be injected on the same host, the usage of declarativeNetRequest becomes redundant. Skip this step if the configuration is present in local storage.