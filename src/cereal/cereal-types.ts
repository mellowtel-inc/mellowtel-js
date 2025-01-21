export interface CerealResponse {
  success: boolean;
  error?: string;
  [key: string]: any;
}

export interface CerealFrameMessage {
  type: "PROCESS_DOCUMENT";
  recordID: string;
  htmlString: string;
  cerealObject: string;
}

export interface CerealConfig {
  cerealURL: string;
  [key: string]: any;
}

export interface CerealObject {
  maxTimeout?: number;
  [key: string]: any;
}
