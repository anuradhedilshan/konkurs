/* eslint-disable @typescript-eslint/no-unused-vars */
import { CB } from "../../electron/render";
import DocumentDownloadService from "./Shared/DocumentDownloadService";
import { Get } from "./Shared/lib";
import Logger from "./Shared/Logger";
import {
  extractTop20Links,
  parseCampaign,
  parseHomePageRight,
  sleep,
} from "./utils";
import { CSVWriter } from "./CsvWriter";
import axios from "axios";
import axiosRetry from "axios-retry";

// Configure axios-retry
axiosRetry(axios, {
  retries: 2,
  retryCondition: (error) => {
    // Extract the URL from the error config
    const url = error.config?.url;
    console.log("Retrying", url);
    
    if (url && url.startsWith("https://www.konkurs.ro/")) {
      return true;
    }

    // Do not retry for other URLs
    return false;
  },
  retryDelay: axiosRetry.exponentialDelay, // Optional: Use exponential backoff
});

let logger: Logger | null = null;
let f: CB | null = null;

export function setLoggerCallback(cb: CB): Logger {
  f = cb;
  logger = new Logger(cb);
  return logger;
}

function fireEvent(
  Type:
    | "progress"
    | "count"
    | "complete"
    | "error"
    | "details"
    | "warn"
    | "data",
  message: number | boolean | string | null | object | Array<unknown>
) {
  if (f) f(Type, message);
}

export default async function start(
  url: string,
  type: Type,
  range: { start: number; end: number },
  location: string
) {
  const DocumentData = await Get(url);
  if (DocumentData.data) {
    const { maxpages, title } = parseHomePageRight(DocumentData.data);
    const Writer = new CSVWriter(location, title, logger);
    fireEvent("count", `Found ${maxpages} pages on ${title}`);
    if (maxpages == null) {
      logger?.error("Error in parseHomePageRight");
      return;
    }

    logger?.log(`Starting download of ${title} campaigns`);

    let start, end;
    if (type === "all") {
      ({ start, end } = range);
      end += 1;
    } else {
      start = 1;
      end = maxpages + 1;
    }
    console.log(type, range);

    logger?.warn(`TYPE: ${type}, start: ${start}, end: ${end}`);

    const downloadService = new DocumentDownloadService(
      {
        maxConcurrentDownloads: 10,
        downloadPath: `${location}/regulamente`,
        // Optional: Customize allowed document types
        allowedMimeTypes: [
          "application/pdf",
          "text/html",
          "application/msword",
        ],
      },
      logger
    );
    await sleep(1000);
    for (let p = start; p < end; p++) {
      const DocumentData = await Get(`${url}/${p}`);
      console.log(`${url}/${p}`);

      const list = extractTop20Links(DocumentData.data);
      const queue = [];
      let listData: CampaignData[] = [];
     

      for (let i = 0; i < list.length; i++) {
        logger?.log(`length : ${list.length} - Current : ${i}`);
        logger?.log(`Downloading ${list[i]}`);
        queue.push(
          (async () => {
            const data = await Get(`${list[i]}`);
            const ob = parseCampaign(data.data);
            listData.push(ob);
            return;
          })()
        );
        await sleep(50);
      }
      logger?.log(`Downloading ${listData.length} campaigns`);
      await Promise.all(queue);
      // “Regulament [Campaign Title and Period].pdf

      const documentRequests = listData
        .filter((d) => d.termsAndConditions != "N/A")
        .map((d) => ({
          id: `Regulament_${d.title}_${d.startPeriod}`, // Fixed quotes
          url: d.termsAndConditions,
        }));

      logger?.log(`Downloading ${documentRequests.length} documents`);

      try {
        const results = await downloadService.downloadDocuments(
          documentRequests
        );
        logger?.log(
          `Downloaded ${results.successful.length} documents successfully, ${results.failed.length} documents failed`
        );
      } catch (error) {
        console.error("Batch download failed:", error);
        logger?.error("Batch download failed");
        fireEvent("error", error as string);
      }
      fireEvent("progress", (p / end) * 100);
      Writer.writeData(listData);
      listData = [];
    }
    Writer.close();
  }

  logger?.warn("Download complete");
  fireEvent("complete", true);
  return;
}
