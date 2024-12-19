import axios, { AxiosInstance } from "axios";
import fs from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import pLimit from "p-limit";
import mime from "mime-types";
import Logger from "./Logger";

// Comprehensive list of supported document types
const SUPPORTED_DOCUMENT_TYPES = [
  "application/pdf",
  "text/html",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/rtf",
];

interface DocumentDownloadOptions {
  maxConcurrentDownloads?: number;
  downloadTimeout?: number;
  downloadPath?: string;
  allowedMimeTypes?: string[];
}

interface DownloadRequest {
  id: string;
  url: string;
}

interface DownloadResult {
  id: string;
  url: string;
  success: boolean;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
  error?: string;
}

class DocumentDownloadService {
  private axiosInstance: AxiosInstance;
  private downloadPath: string;
  private concurrencyLimit: ReturnType<typeof pLimit>;
  private allowedMimeTypes: string[];
  logger: Logger | null;

  constructor(
    {
      maxConcurrentDownloads = 20,
      downloadTimeout = 10000,
      downloadPath = path.resolve("./downloads"),
      allowedMimeTypes = SUPPORTED_DOCUMENT_TYPES,
    }: DocumentDownloadOptions = {},
    logger: Logger | null
  ) {
    this.logger = logger;
    // Create axios instance with robust configuration
    this.logger?.log(
      "DocumentDownloadService initialized with download path: " + downloadPath
    );
    this.axiosInstance = axios.create({
      timeout: downloadTimeout,
      responseType: "stream",
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: (status) => status >= 200 && status < 400, // Wider success range
    });

    this.downloadPath = downloadPath;
    this.concurrencyLimit = pLimit(maxConcurrentDownloads);
    this.allowedMimeTypes = allowedMimeTypes;

    // Ensure download directory exists
    this.ensureDownloadDirectory();
  }

  private async ensureDownloadDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.downloadPath, { recursive: true });
    } catch (error) {
      console.error("Failed to create download directory:", error);
    }
  }

  private generateFileName(id: string, mimeType: string): string {

    const extension = mime.extension(mimeType) || "bin";
    this.logger?.log(`Generated file name for ${id}: ${id}.${extension}`);
    return `${id}.${extension}`;
  }

  private validateDocumentType(mimeType: string): boolean {
    return this.allowedMimeTypes.includes(mimeType);
  }

  private async downloadSingleDocument(
    request: DownloadRequest
  ): Promise<DownloadResult> {
    try {
      // Enhanced request with more robust headers
      const response = await this.axiosInstance.get(request.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept: "application/pdf,text/html,application/msword,*/*",
          "Accept-Encoding": "gzip, deflate, br",
        },
      });

      // Extract content type
      const contentType =
        response.headers["content-type"]?.split(";")[0].trim() ||
        "application/octet-stream";

      // Validate document type
      if (!this.validateDocumentType(contentType)) {
        throw new Error(`Unsupported document type: ${contentType}`);
      }

      const fileName = this.generateFileName(request.id, contentType);
      const filePath = path.join(this.downloadPath, fileName);

      // Stream download
      const writer = createWriteStream(filePath);
      (response.data as Readable).pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () =>
          resolve({
            id: request.id,
            url: request.url,
            success: true,
            fileName,
            filePath,
            mimeType: contentType,
          })
        );

        writer.on("error", (error) => {
          // Attempt to remove partial file
          fs.unlink(filePath).catch(() => {});

          reject({
            id: request.id,
            url: request.url,
            success: false,
            error: error.message,
            mimeType: contentType,
          });
        });
      });
    } catch (error) {
      // Log the specific error for debugging
      if (error instanceof Error) {
        this.logger?.error(
          `Download failed for ${request.url}: ${error.message}`
        );
      } else {
        this.logger?.error(`Download failed for ${request.url}: Unknown error`);
      }
      console.error(`Download failed for ${request.url}:`, error);

      return {
        id: request.id,
        url: request.url,
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown download error",
      };
    }
  }

  async downloadDocuments(requests: DownloadRequest[]): Promise<{
    successful: DownloadResult[];
    failed: DownloadResult[];
  }> {
    // Create download tasks with concurrency limit
    const downloadTasks = requests.map((request) =>
      this.concurrencyLimit(() =>
        this.downloadSingleDocument(request).catch((error) => ({
          id: request.id,
          url: request.url,
          success: false,
          error: error.message || "Unexpected error",
        }))
      )
    );

    // Wait for all downloads to complete
    const results = await Promise.all(downloadTasks);

    // Separate successful and failed downloads
    return {
      successful: results.filter((result) => result.success),
      failed: results.filter((result) => !result.success),
    };
  }

  // Method to update allowed MIME types
  setAllowedMimeTypes(mimeTypes: string[]): void {
    this.allowedMimeTypes = mimeTypes;
  }
}

export default DocumentDownloadService;
