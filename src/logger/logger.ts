export class Logger {
  static disableLogs: boolean = true;

  static info(message: any, ...optionalParams: any[]) {
    if (!this.disableLogs) {
      console.info(message, ...optionalParams);
    }
  }

  static log(message: any, ...optionalParams: any[]) {
    if (!this.disableLogs) {
      console.log(message, ...optionalParams);
    }
  }

  static warn(message: any, ...optionalParams: any[]) {
    if (!this.disableLogs) {
      console.warn(message, ...optionalParams);
    }
  }

  static error(message: any, ...optionalParams: any[]) {
    if (!this.disableLogs) {
      console.error(message, ...optionalParams);
    }
  }
}
