import {
  LOG_BATCH_INTERVAL,
  LOG_RETENTION_HOURS,
  LOG_STORAGE_KEY,
} from "../constants";

interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  params?: any[];
}

export class Logger {
  static disableLogs: boolean = true;
  static saveLogs: boolean = false;
  private static pendingLogs: LogEntry[] = [];
  private static batchTimeout: number | null = null;

  private static formatMessage(message: any): string {
    return typeof message === "object"
      ? JSON.stringify(message)
      : String(message);
  }

  private static formatParams(params: any[]): string[] {
    return params.map((p) =>
      typeof p === "object" ? JSON.stringify(p) : String(p),
    );
  }

  private static addToPendingLogs(level: string, message: any, params?: any[]) {
    if (!this.saveLogs) return;

    this.pendingLogs.push({
      timestamp: Date.now(),
      level,
      message: this.formatMessage(message),
      params: params ? this.formatParams(params) : undefined,
    });

    this.scheduleBatchSave();
  }

  private static scheduleBatchSave() {
    if (this.batchTimeout) return;

    this.batchTimeout = setTimeout(() => {
      this.saveBatchToStorage();
    }, LOG_BATCH_INTERVAL);
  }

  private static async saveBatchToStorage() {
    if (this.pendingLogs.length === 0) return;

    const currentTime = Date.now();
    const retentionTime = currentTime - LOG_RETENTION_HOURS * 60 * 60 * 1000;

    try {
      const storage = await chrome.storage.local.get(LOG_STORAGE_KEY);
      let logs: LogEntry[] = storage[LOG_STORAGE_KEY] || [];

      logs = [
        ...logs.filter((log) => log.timestamp > retentionTime),
        ...this.pendingLogs,
      ];

      await chrome.storage.local.set({ [LOG_STORAGE_KEY]: logs });
      this.pendingLogs = [];
    } catch (error) {
      console.error("Failed to save logs to storage:", error);
    } finally {
      this.batchTimeout = null;
    }
  }

  static info(message: any, ...optionalParams: any[]) {
    if (!this.disableLogs) {
      console.info(message, ...optionalParams);
    }
    this.addToPendingLogs("INFO", message, optionalParams);
  }

  static log(message: any, ...optionalParams: any[]) {
    if (!this.disableLogs) {
      console.log(message, ...optionalParams);
    }
    this.addToPendingLogs("LOG", message, optionalParams);
  }

  static warn(message: any, ...optionalParams: any[]) {
    if (!this.disableLogs) {
      console.warn(message, ...optionalParams);
    }
    this.addToPendingLogs("WARN", message, optionalParams);
  }

  static error(message: any, ...optionalParams: any[]) {
    if (!this.disableLogs) {
      console.error(message, ...optionalParams);
    }
    this.addToPendingLogs("ERROR", message, optionalParams);
  }

  static async downloadLogs(): Promise<boolean> {
    await this.saveBatchToStorage(); // Ensure pending logs are saved

    const storage = await chrome.storage.local.get(LOG_STORAGE_KEY);
    const logs: LogEntry[] = storage[LOG_STORAGE_KEY] || [];

    if (logs.length === 0) return false;

    const logText = logs
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((log) => {
        const date = new Date(log.timestamp).toISOString();
        const paramsText = log.params
          ? ` | Params: ${log.params.join(", ")}`
          : "";
        return `[${date}] ${log.level}: ${log.message}${paramsText}`;
      })
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `mllwtl_logs_${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return true;
  }
}
