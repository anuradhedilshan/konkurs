import axios, { AxiosInstance } from "axios";
import fs from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import pLimit from "p-limit";
import mime from "mime-types";
import EventEmitter from "events";
import Logger from "./Logger";

export interface DocumentDownloadOptions {
  maxConcurrentDownloads?: number;
  downloadTimeout?: number;
  downloadPath?: string;
  allowedMimeTypes?: string[];
}

export interface DownloadRequest {
  id: string;
  url: string;
}

export interface DownloadResult {
  id: string;
  url: string;
  success: boolean;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
  error?: string;
}

export interface QueueStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

// constants.ts
export const SUPPORTED_DOCUMENT_TYPES = [
  "application/pdf",
  "text/html",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/rtf",
];

// DownloadQueue.ts

export class DownloadQueue extends EventEmitter {
  private queue: DownloadRequest[] = [];
  private processing: Set<string> = new Set();
  private failed: Map<string, { url: string; error: string; retries: number }> =
    new Map();
  private completed: Set<string> = new Set();
  private maxRetries = 0;
  addToQueue(request: DownloadRequest): void {
    this.queue.push(request);
    this.emit("itemAdded");
  }

  getNext(): DownloadRequest | null {
    return this.queue.shift() || null;
  }

  markAsProcessing(id: string): void {
    this.processing.add(id);
  }

  markAsCompleted(id: string): void {
    this.processing.delete(id);
    this.completed.add(id);
  }

  addFailedItem(id: string, url: string, error: string): void {
    const failedItem = this.failed.get(id) || { url, error, retries: 0 };
    failedItem.retries++;

    if (failedItem.retries < this.maxRetries) {
      this.queue.push({ id, url });
      this.emit("itemAdded");
    } else {
      this.failed.set(id, failedItem);
    }
    this.processing.delete(id);
  }

  getFailedItems(): {
    id: string;
    url: string;
    error: string;
    retries: number;
  }[] {
    return Array.from(this.failed.entries()).map(([id, item]) => ({
      id,
      ...item,
    }));
  }

  getStats(): QueueStats {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      total:
        this.queue.length +
        this.processing.size +
        this.completed.size +
        this.failed.size,
    };
  }

  isProcessing(): boolean {
    return this.processing.size > 0 || this.queue.length > 0;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export class DocumentDownloadService {
  private axiosInstance: AxiosInstance;
  private downloadPath: string;
  private concurrencyLimit: ReturnType<typeof pLimit>;
  private allowedMimeTypes: string[];
  private downloadQueue: DownloadQueue;
  private isProcessing: boolean = false;
  private isShuttingDown = false;
  logger: Logger | null;

  constructor(
    {
      maxConcurrentDownloads = 10,
      downloadTimeout = 5000,
      downloadPath = path.resolve("./downloads"),
      allowedMimeTypes = SUPPORTED_DOCUMENT_TYPES,
    }: DocumentDownloadOptions = {},
    logger: Logger | null = null
  ) {
    this.logger = logger;
    this.logger?.log("Initializing DocumentDownloadService");

    this.axiosInstance = axios.create({
      timeout: downloadTimeout,
      responseType: "stream",
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    this.downloadPath = downloadPath;
    this.concurrencyLimit = pLimit(maxConcurrentDownloads);
    this.allowedMimeTypes = allowedMimeTypes;
    this.downloadQueue = new DownloadQueue();

    this.downloadQueue.on("itemAdded", () => {
      if (!this.isProcessing) {
        this.processQueue();
      }
    });

    this.ensureDownloadDirectory();
  }

  private async ensureDownloadDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.downloadPath, { recursive: true });
      this.logger?.log(`Download directory created: ${this.downloadPath}`);
    } catch (error) {
      this.logger?.error(`Failed to create download directory: ${error}`);
    }
  }

  private generateFileName(id: string, mimeType: string): string {
    const extension = mime.extension(mimeType) || "bin";
    return `${id}.${extension}`;
  }

  private validateDocumentType(mimeType: string): boolean {
    return this.allowedMimeTypes.includes(mimeType);
  }

  async addToQueue(
    requests: DownloadRequest | DownloadRequest[]
  ): Promise<void> {
    const requestArray = Array.isArray(requests) ? requests : [requests];
    requestArray.forEach((request) => {
      this.downloadQueue.addToQueue(request);
      this.logger?.log(`Added to queue: ${request.url} (ID: ${request.id})`);
    });

    const stats = this.downloadQueue.getStats();
    this.logger?.log(
      `Queue status: ${stats.queued} queued, ${stats.processing} processing, ` +
        `${stats.completed} completed, ${stats.failed} failed (Total: ${stats.total})`
    );
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;
    this.logger?.log("Starting queue processing");

    while (this.downloadQueue.isProcessing()) {
      const concurrentDownloads: Promise<void>[] = [];
      const maxConcurrent = 5;

      while (
        concurrentDownloads.length < maxConcurrent &&
        this.downloadQueue.getQueueLength() > 0
      ) {
        const request = this.downloadQueue.getNext();
        if (request) {
          const downloadPromise = this.processSingleDownload(request);
          concurrentDownloads.push(downloadPromise);
        }
      }

      if (concurrentDownloads.length > 0) {
        await Promise.all(concurrentDownloads);
        const stats = this.downloadQueue.getStats();
        this.logger?.log(
          `Batch complete - Successfully downloaded: ${stats.completed}, ` +
            `Failed: ${stats.failed}, Remaining in queue: ${stats.queued}`
        );
      }
    }

    const finalStats = this.downloadQueue.getStats();
    this.logger?.log(
      `Download session complete - Total processed: ${finalStats.total}, ` +
        `Successfully downloaded: ${finalStats.completed}, Failed: ${finalStats.failed}`
    );
    this.isProcessing = false;
  }

  private async processSingleDownload(request: DownloadRequest): Promise<void> {
    this.downloadQueue.markAsProcessing(request.id);
    this.logger?.log(`Starting download: ${request.url} (ID: ${request.id})`);

    try {
      const response = await this.axiosInstance.get(request.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/pdf,text/html,application/msword,*/*",
          "Accept-Encoding": "gzip, deflate, br",
        },
      });

      const contentType =
        response.headers["content-type"]?.split(";")[0].trim() ||
        "application/octet-stream";

      if (!this.validateDocumentType(contentType)) {
        throw new Error(`Unsupported document type: ${contentType}`);
      }

      const fileName = this.generateFileName(request.id, contentType);
      const filePath = path.join(this.downloadPath, fileName);

      await new Promise<void>((resolve, reject) => {
        const writer = createWriteStream(filePath);
        (response.data as Readable).pipe(writer);

        writer.on("finish", () => {
          this.downloadQueue.markAsCompleted(request.id);
          this.logger?.log(
            `Successfully downloaded: ${request.url} -> ${fileName}`
          );
          resolve();
        });

        writer.on("error", (error) => {
          fs.unlink(filePath).catch(() => {});
          reject(error);
        });
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger?.error(
        `Download failed for ${request.url} (ID: ${request.id}): ${errorMessage}`
      );
      this.downloadQueue.addFailedItem(request.id, request.url, errorMessage);
    }
  }

  getFailedDownloads(): {
    id: string;
    url: string;
    error: string;
    retries: number;
  }[] {
    return this.downloadQueue.getFailedItems();
  }

  getQueueStats(): QueueStats {
    return this.downloadQueue.getStats();
  }

  isprocessing(): boolean {
    return this.downloadQueue.isProcessing();
  }
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    if (!this.downloadQueue.isProcessing()) {
      process.exit(0);
    }
    // Will exit when queue becomes empty due to event listener
  }
}

export default DocumentDownloadService;
