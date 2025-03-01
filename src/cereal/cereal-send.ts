import {isInSW} from "../utils/utils";
import {Logger} from "../logger/logger";
import {sendMessageToBackground} from "../utils/messaging-helpers";

/**
 * Sends a message through the appropriate WebSocket channel
 * based on the current execution context (service worker or content script)
 *
 * @param messageData - The data to send through the WebSocket
 * @returns Promise<boolean> - Whether the send operation was successful
 */
export async function sendWebSocketMessage(messageData: any): Promise<boolean> {
    const inServiceWorker = await isInSW();
    Logger.log("[sendWebSocketMessage] In service worker:", inServiceWorker);

    try {
        if (inServiceWorker) {
            // If we're in the service worker, directly use the WebSocket service
            const { websocketService } = await import("../content-script/websocket");

            Logger.log("[sendWebSocketMessage] WebSocket state:",
                websocketService.getWebSocket() ? "exists" : "null",
                "connected:", websocketService.isConnected());

            if (websocketService.isConnected()) {
                websocketService.sendMessage(
                    typeof messageData === 'string' ? messageData : JSON.stringify(messageData)
                );
                Logger.log("[sendWebSocketMessage] Message sent directly from service worker");
                return true;
            } else {
                Logger.log("[sendWebSocketMessage] WebSocket not connected in service worker");
                return false;
            }
        } else {
            // If we're in a content script, relay the message to the service worker
            const response = await sendMessageToBackground({
                intent: "sendWebSocketMessage",
                messageData: typeof messageData === 'string' ? messageData : JSON.stringify(messageData)
            });

            Logger.log("[sendWebSocketMessage] Message relayed to service worker, response:", response);
            return response?.success || false;
        }
    } catch (error) {
        Logger.error("[sendWebSocketMessage] Error sending message:", error);
        return false;
    }
}