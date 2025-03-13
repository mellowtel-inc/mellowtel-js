import { EAGLE_FRAME_ID_PREFIX } from "../constants";
import { Logger } from "../logger/logger";
import { EagleConfig, EagleResponse } from "./eagle-types";

export function initEagleFrame(
  eagleObject: string | EagleConfig,
  eagleId: string,
): Promise<EagleResponse> {
  return new Promise((resolve) => {
    Logger.log("[initEagleFrame] Starting initialization");

    // Check if frame already exists
    const frameId = EAGLE_FRAME_ID_PREFIX + eagleId;
    let frame = document.getElementById(frameId) as HTMLIFrameElement;
    if (frame) {
      Logger.log("[initEagleFrame] Frame already exists");
      resolve({ success: true });
      return;
    }

    // Create new frame as HTMLIFrameElement
    frame = document.createElement("iframe") as HTMLIFrameElement;
    frame.id = frameId;
    frame.style.display = "none";

    // Parse eagle object if it's a string
    const config: EagleConfig =
      typeof eagleObject === "string" ? JSON.parse(eagleObject) : eagleObject;

    // Setup load handler before setting src
    const timeoutId = setTimeout(() => {
      Logger.log("[initEagleFrame] Load timeout");
      resolve({ success: false, error: "timeout" });
    }, 8000); // 8 second timeout for loading

    frame.onload = () => {
      clearTimeout(timeoutId);
      Logger.log("[initEagleFrame] Frame loaded successfully");
      resolve({ success: true });
    };

    frame.onerror = (error) => {
      clearTimeout(timeoutId);
      Logger.log("[initEagleFrame] Frame load error:", error);
      resolve({ success: false, error: "load_failed" });
    };

    // Set up message listener for this frame
    window.addEventListener("message", (event) => {
      if (event.source === frame.contentWindow) {
        if (event.data.type === "EAGLE_RESPONSE") {
          Logger.log("[initEagleFrame] Received eagle response:", event.data);
        }
      }
    });

    // Append frame to document
    document.body.appendChild(frame);
    Logger.log("[initEagleFrame] Frame appended to document");
  });
}

export function getEagleFrameId(eagleId: string): string {
  return EAGLE_FRAME_ID_PREFIX + eagleId;
}
