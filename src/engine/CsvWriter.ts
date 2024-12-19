/* eslint-disable @typescript-eslint/no-explicit-any */
import { createWriteStream, rename } from "fs";
import { Transform } from "stream";
import Logger from "./Shared/Logger";

export class CSVWriter {
  private writeStream: NodeJS.WritableStream;
  private headers: string[] = [];
  private batchSize: number = 5000;
  private logger: Logger | null;
  private tempFilePath: string;
  private finalFilePath: string;
  private readonly bufferSize: number = 16384; // 16KB buffer for better performance
  private headersWritten: boolean = false;

  constructor(filePath: string, name: string, logger: Logger | null) {
    this.finalFilePath = `${filePath}/${name}.csv`;
    this.tempFilePath = `${filePath}/.${name}.csv`;
    this.writeStream = createWriteStream(this.tempFilePath, {
      flags: "a",
      highWaterMark: this.bufferSize,
    });
    this.logger = logger;
    this.logger?.log(
      `CSVWriter initialized with temp file: ${this.tempFilePath}`
    );
  }

  /**
   * Safely escape and format CSV value
   */
  private escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '""';
    }

    const stringValue =
      typeof value === "object" ? JSON.stringify(value) : String(value);

    // Double escape quotes and wrap in quotes if needed
    if (
      stringValue.includes('"') ||
      stringValue.includes(",") ||
      stringValue.includes("\n")
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Extract all unique headers from data array
   */
  private extractHeaders(data: Record<string, any>[]): string[] {
    const headerSet = new Set<string>();
    data.forEach((obj) => {
      Object.keys(obj).forEach((key) => headerSet.add(key));
    });
    return Array.from(headerSet);
  }

  /**
   * Update headers with any new fields found
   */
  private updateHeaders(newHeaders: string[]): boolean {
    let headersChanged = false;
    newHeaders.forEach((header) => {
      if (!this.headers.includes(header)) {
        this.headers.push(header);
        headersChanged = true;
      }
    });
    return headersChanged;
  }

  /**
   * Convert object to CSV line ensuring all headers are represented
   */
  private objectToCSVLine(obj: Record<string, any>): string {
    return (
      this.headers
        .map((header) => this.escapeCSVValue(obj[header] ?? ""))
        .join(",") + "\n"
    );
  }

  /**
   * Write headers to CSV file
   */
  private writeHeaders(): void {
    const headerLine =
      this.headers.map((header) => this.escapeCSVValue(header)).join(",") +
      "\n";

    this.writeStream.write(headerLine);
    this.headersWritten = true;
    this.logger?.log(`Headers written to CSV file: ${this.headers.join(", ")}`);
  }

  /**
   * Write data array to CSV with optimized streaming and complete headers
   */
  public async writeData(data: Record<string, any>[]): Promise<void> {
    if (!Array.isArray(data) || data.length === 0) {
      return;
    }

    this.logger?.log(`Processing ${data.length} records for CSV`);

    return new Promise((resolve, reject) => {
      try {
        // Extract and update headers from new data
        const newHeaders = this.extractHeaders(data);
        const headersChanged = this.updateHeaders(newHeaders);

        // If headers changed or haven't been written yet, write them
        if (!this.headersWritten || headersChanged) {
          this.writeHeaders();
        }

        const transformStream = new Transform({
          objectMode: true,
          transform: (chunk: Record<string, any>, _encoding, callback) => {
            try {
              const csvLine = this.objectToCSVLine(chunk);
              callback(null, csvLine);
            } catch (error: unknown) {
              callback(error as Error);
            }
          },
          highWaterMark: this.batchSize,
        });

        transformStream.pipe(this.writeStream, { end: false });

        let processedCount = 0;

        const processBatch = () => {
          const batch = data.slice(
            processedCount,
            processedCount + this.batchSize
          );

          if (batch.length === 0) {
            transformStream.end();
            resolve();
            this.logger?.log("All data written to CSV");
            return;
          }

          const canContinue = batch.every((item) =>
            transformStream.write(item)
          );
          processedCount += batch.length;

          if (canContinue) {
            setImmediate(processBatch);
          } else {
            transformStream.once("drain", processBatch);
          }
        };

        transformStream.on("error", (error) => {
          this.logger?.error(`Transform stream error: ${error}`);
          reject(error);
        });

        processBatch();
      } catch (error) {
        this.logger?.error(`Error writing data: ${error}`);
        reject(error);
      }
    });
  }

  /**
   * Write multiple arrays while maintaining complete headers
   */
  public async writeArrays(dataArrays: Record<string, any>[][]): Promise<void> {
    try {
      // First pass: collect all possible headers
      const allHeaders = new Set<string>();
      dataArrays.forEach((dataArray) => {
        dataArray.forEach((obj) => {
          Object.keys(obj).forEach((key) => allHeaders.add(key));
        });
      });
      this.headers = Array.from(allHeaders);

      // Second pass: write data
      for (const dataArray of dataArrays) {
        await this.writeData(dataArray);
      }
    } catch (error) {
      this.logger?.error(`Error writing arrays: ${error}`);
      throw error;
    }
  }

  public setBatchSize(size: number): void {
    if (size < 1) {
      throw new Error("Batch size must be greater than 0");
    }
    this.batchSize = size;
    this.logger?.log(`Batch size set to ${size}`);
  }

  public async close(): Promise<void> {
    this.logger?.log("Closing write stream");
    return new Promise((resolve, reject) => {
      const cleanup = (error?: Error) => {
        this.headers = [];
        this.headersWritten = false;
        if (error) {
          this.logger?.error(`Error during close: ${error}`);
          reject(error);
        } else {
          resolve();
        }
      };

      this.writeStream.end(() => {
        rename(this.tempFilePath, this.finalFilePath, (err) => {
          if (err) {
            cleanup(err);
          } else {
            this.logger?.log(`File renamed to ${this.finalFilePath}`);
            cleanup();
          }
        });
      });

      this.writeStream.on("error", cleanup);
    });
  }
}
