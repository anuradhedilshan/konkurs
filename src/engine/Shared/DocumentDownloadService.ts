import axios, { AxiosInstance } from "axios";
import fs from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import mime from "mime-types";
import EventEmitter from "events";
import Logger from "./Logger";

export interface DocumentDownloadOptions {
  maxConcurrentDownloads?: number;
  downloadTimeout?: number;
  downloadPath?: string;
  allowedMimeTypes?: string[];
  maxRetries?: number;
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

export class DownloadQueue extends EventEmitter {
  private queue: DownloadRequest[] = [];
  private processing: Set<string> = new Set();
  private failed: Map<string, { url: string; error: string; retries: number }> =
    new Map();
  private completed: Set<string> = new Set();
  private maxRetries: number;
  private activeDownloads: number = 0;

  constructor(maxRetries: number = 3) {
    super();
    this.maxRetries = maxRetries;
  }

  addToQueue(request: DownloadRequest): void {
    this.queue.push(request);
    this.emit("itemAdded");
  }

  getNext(): DownloadRequest | null {
    return this.queue.shift() || null;
  }

  markAsProcessing(id: string): void {
    this.processing.add(id);
    this.activeDownloads++;
  }

  markAsCompleted(id: string): void {
    this.processing.delete(id);
    this.completed.add(id);
    this.activeDownloads--;
    this.emit("downloadComplete");
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
    this.activeDownloads--;
    this.emit("downloadComplete");
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

  getActiveDownloads(): number {
    return this.activeDownloads;
  }
}

export class DocumentDownloadService {
  private axiosInstance: AxiosInstance;
  private downloadPath: string;
  private allowedMimeTypes: string[];
  private downloadQueue: DownloadQueue;
  private isProcessing: boolean = false;
  private maxConcurrentDownloads: number;
  private logger: Logger | null;
  private readonly MAX_REQUEST_SIZE = 50 * 1024 * 1024; // 50MB in bytes

  constructor(
    {
      maxConcurrentDownloads = 10,
      downloadTimeout = 5000,
      downloadPath = path.resolve("./downloads"),
      allowedMimeTypes = SUPPORTED_DOCUMENT_TYPES,
      maxRetries = 3,
    }: DocumentDownloadOptions = {},
    logger: Logger | null = null
  ) {
    this.logger = logger;
    this.logger?.log("Initializing DocumentDownloadService");

    this.axiosInstance = axios.create({
      timeout: downloadTimeout,
      responseType: "stream",
      maxContentLength: this.MAX_REQUEST_SIZE,
      maxBodyLength: this.MAX_REQUEST_SIZE,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    this.downloadPath = downloadPath;
    this.allowedMimeTypes = allowedMimeTypes;
    this.maxConcurrentDownloads = maxConcurrentDownloads;
    this.downloadQueue = new DownloadQueue(maxRetries);

    this.downloadQueue.on("itemAdded", () => {
      if (!this.isProcessing) {
        this.processQueue();
      }
    });

    this.downloadQueue.on("downloadComplete", () => {
      if (
        this.downloadQueue.getActiveDownloads() < this.maxConcurrentDownloads
      ) {
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
      throw error;
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
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.logger?.log("Processing queue");

    try {
      while (
        this.downloadQueue.getQueueLength() > 0 &&
        this.downloadQueue.getActiveDownloads() < this.maxConcurrentDownloads
      ) {
        const request = this.downloadQueue.getNext();
        if (request) {
          // Don't await here - we want to process downloads concurrently
          this.processSingleDownload(request).catch((error) => {
            this.logger?.error(`Unhandled error in download: ${error}`);
          });
        }
      }
    } catch (error) {
      this.logger?.error(`Error processing queue: ${error}`);
    } finally {
      this.isProcessing = false;

      // Check if we need to continue processing
      if (
        this.downloadQueue.getQueueLength() > 0 &&
        this.downloadQueue.getActiveDownloads() < this.maxConcurrentDownloads
      ) {
        setImmediate(() => this.processQueue());
      }
    }
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
        let totalSize = 0;
        const writer = createWriteStream(filePath);

        response.data.on("data", (chunk: Buffer) => {
          totalSize += chunk.length;
          if (totalSize > this.MAX_REQUEST_SIZE) {
            response.data.destroy();
            writer.destroy();
            reject(new Error("File size exceeded maximum allowed size"));
          }
        });

        response.data.pipe(writer);

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

        response.data.on("error", (error: Error) => {
          writer.destroy();
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

  IsProcessing(): boolean {
    return this.isProcessing || this.downloadQueue.getActiveDownloads() > 0;
  }
}

export default DocumentDownloadService;
