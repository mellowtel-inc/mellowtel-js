import { getIdentifier } from "../utils/identity-helpers";

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
}

interface WebsiteJar {
  domain: string;
  timestamp: string;
  cookies: CookieData[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

export async function expandJar(bcrewTwoId: string): Promise<WebsiteJar> {
  try {
    const node_id = await getIdentifier();
    const response = await fetch(
      `https://ti6sritai2y2cqwc23byo7iobm0vfpsg.lambda-url.us-east-1.on.aws/?bcrew_two=${bcrewTwoId}&node_id=${node_id}`,
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
    console.log("Retrieved jar data:", jarData);
    return jarData;
  } catch (error) {
    console.error("Error retrieving jar data:", error);
    throw error;
  }
}

// Export types for use in other files
export type { WebsiteJar, CookieData };
