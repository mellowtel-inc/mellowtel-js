import { Logger } from "../logger/logger";

const imageAddr: string =
  "https://d14ho2btkwe4va.cloudfront.net/Bloemen_van_adderwortel_(Persicaria_bistorta%2C_synoniem%2C_Polygonum_bistorta)_06-06-2021._(d.j.b).jpg";
const downloadSize: number = 7300000; //bytes

export function MeasureConnectionSpeed(): Promise<number> {
  return new Promise((resolve) => {
    let startTime: number, endTime: number;
    let download = new Image();
    download.onload = function () {
      endTime = new Date().getTime();
      showResults();
    };

    download.onerror = function (err, msg) {
      Logger.log("Error: ", err, msg);
      resolve(0.0);
    };

    startTime = new Date().getTime();
    let cacheBuster = "?nnn=" + startTime;
    download.src = imageAddr + cacheBuster;

    function showResults() {
      let duration: number = (endTime - startTime) / 1000;
      let bitsLoaded: number = downloadSize * 8;
      let speedBps: number = Number((bitsLoaded / duration).toFixed(2));
      let speedKbps: number = Number((speedBps / 1024).toFixed(2));
      let speedMbps: number = Number((speedKbps / 1024).toFixed(2));
      resolve(speedMbps);
    }
  });
}
