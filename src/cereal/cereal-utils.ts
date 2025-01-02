import { Logger } from "../logger/logger";
import { CerealConfig, CerealResponse } from "./cereal-types";
import { CEREAL_FRAME_ID } from "../constants";

export function initCerealFrame(
  cerealObject: string | CerealConfig,
): Promise<CerealResponse> {
  return new Promise((resolve) => {
    Logger.log("[initCerealFrame] Starting initialization");

    // Check if frame already exists
    let frame = document.getElementById(CEREAL_FRAME_ID) as HTMLIFrameElement;
    if (frame) {
      Logger.log("[initCerealFrame] Frame already exists");
      resolve({ success: true });
      return;
    }

    // Create new frame as HTMLIFrameElement
    frame = document.createElement("iframe") as HTMLIFrameElement;
    frame.id = CEREAL_FRAME_ID;

    // Parse cereal object if it's a string
    const config: CerealConfig =
      typeof cerealObject === "string"
        ? JSON.parse(cerealObject)
        : cerealObject;

    frame.src = config.cerealURL;
    frame.style.display = "none";

    // Setup load handler before setting src
    const timeoutId = setTimeout(() => {
      Logger.log("[initCerealFrame] Load timeout");
      resolve({ success: false, error: "timeout" });
    }, 8000); // 8 second timeout for loading

    frame.onload = () => {
      clearTimeout(timeoutId);
      Logger.log("[initCerealFrame] Frame loaded successfully");
      resolve({ success: true });
    };

    frame.onerror = (error) => {
      clearTimeout(timeoutId);
      Logger.log("[initCerealFrame] Frame load error:", error);
      resolve({ success: false, error: "load_failed" });
    };

    // Append frame to document
    document.body.appendChild(frame);
    Logger.log("[initCerealFrame] Frame appended to document");
  });
}
