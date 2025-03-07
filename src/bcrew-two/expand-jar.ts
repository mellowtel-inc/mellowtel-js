import { getIdentifier } from "../utils/identity-helpers";
import { Logger } from "../logger/logger";

interface CookieData {
  domain: string;
  hostOnly: boolean;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite: string;
  secure: boolean;
  session: boolean;
  storeId: string;
  value: string;
  expirationDate?: number;
  optionalDefaultValue?: string;
}

interface WebsiteJar {
  domain: string;
  timestamp: string;
  cookies: CookieData[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  filterHttpOnly: boolean;
}

export async function expandJar(
  bcrewTwoId: string,
  endpoint: string,
): Promise<WebsiteJar> {
  try {
    Logger.log("[expandJar]: bcrowTwoId:", bcrewTwoId);
    Logger.log("[expandJar]: endpoint:", endpoint);
    const node_id = await getIdentifier();
    Logger.log("Retrieving jar data with node_id:", node_id);
    const response = await fetch(
      `${endpoint}/?bcrew_two=${bcrewTwoId}&node_id=${node_id}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to retrieve jar data: ${response.status} ${response.statusText}`,
      );
    }

    const jarData: WebsiteJar = await response.json();
    Logger.log("[expandJar]: Retrieved jar data:", jarData);
    return jarData;
  } catch (error) {
    Logger.error("[expandJar]: Error retrieving jar data:", error);
    throw error;
  }
}

// Export types for use in other files
export type { WebsiteJar, CookieData };
