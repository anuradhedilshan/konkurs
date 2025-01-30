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
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import axiosRetry, { IAxiosRetryConfig } from "axios-retry";

// Type for DNS error codes
type DnsErrorCode = "ECONNREFUSED" | "ETIMEDOUT" | "ENOTFOUND" | "EAI_AGAIN";

// DNS resolution errors that should trigger a retry
const DNS_ERROR_CODES: DnsErrorCode[] = [
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
];

// Configure axios-retry with enhanced retry logic
const retryConfig: IAxiosRetryConfig = {
  retries: 5, // Increased from 3 to 5 for DNS issues
  retryDelay: (retryCount: number, _error: AxiosError): number => {
    // Start with 1s delay, then exponential backoff with jitter
    const baseDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    const jitter = Math.random() * 1000;
    console.log(
      `Retry attempt ${retryCount + 1}, waiting ${baseDelay + jitter}ms`
    );
    return baseDelay + jitter;
  },
  retryCondition: (error: AxiosError): boolean => {
    const url = error.config?.url;
    const isKonkursUrl = url && url.startsWith("https://www.konkurs.ro/");
    const isDnsError = error.code
      ? DNS_ERROR_CODES.includes(error.code as DnsErrorCode)
      : false;

    // Retry if it's a Konkurs URL and either a DNS error or a network error
    if (
      isKonkursUrl ||
      isDnsError ||
      axiosRetry.isNetworkOrIdempotentRequestError(error)
    ) {
      console.log("Retrying request due to DNS or network error");
      return true;
    }

    return false;
  },
  // Reset timeout between retries
  shouldResetTimeout: true,
  // Optional: Called after a retry attempt
  onRetry: (
    retryCount: number,
    error: AxiosError,
    config: AxiosRequestConfig
  ): void => {
    console.log(
      `Retry ${retryCount} for ${config.url}. Error: ${error.message}`
    );
  },
};

axiosRetry(axios, retryConfig);

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
  let isRunning = true;
  const DocumentData = await Get(url);
  let downloadService = null;
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

    downloadService = new DocumentDownloadService(
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
        await downloadService.addToQueue(documentRequests);
        console.log("Current queue stats:", downloadService.getQueueStats());
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
    while (isRunning) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (!downloadService?.IsProcessing()) {
        console.log("All downloads completed");
        isRunning = false;
        downloadService = null;
      } else {
        const queueStats = downloadService.getQueueStats();
        logger?.warn(
          `Queue stats: queued: ${queueStats.queued}, processing: ${queueStats.processing}, completed: ${queueStats.completed}, failed: ${queueStats.failed}, total: ${queueStats.total}`
        );
        console.log("Downloads in progress...");
      }
    }
  }

  logger?.warn("Download complete");
  fireEvent("complete", true);
  return;
}
