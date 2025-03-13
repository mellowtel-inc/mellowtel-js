export interface EagleResponse {
  success: boolean;
  error?: string;
  [key: string]: any;
}

export interface EagleFrameMessage {
  type: "FETCH_URL";
  recordID: string;
  url: string;
  eagleObject: string;
}

export interface EagleConfig {
  eagleEnabled: boolean;
  eagleId: string;
  [key: string]: any;
}

export interface EagleObject {
  maxTimeout?: number;
  [key: string]: any;
}
