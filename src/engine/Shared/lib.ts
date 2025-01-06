import { HttpsAgent } from "agentkeepalive";
import axios, { AxiosResponse, RawAxiosRequestHeaders } from "axios";

export type ContentType = "articles" | "promotions";

const DefaultHeaders: RawAxiosRequestHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0",
};

/**
 *  GET method with flexible configuration
 * @param url - The full URL to send the GET request to
 * @param options - Optional configuration for query params, headers, and other axios settings
 * @returns Promise with AxiosResponse
 */

const keepaliveAgent = new HttpsAgent({
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000, // active socket keepalive for 60 seconds
  freeSocketTimeout: 30000, // free socket keepalive for 30 seconds
});

export function Get(
  url: string,
  options: {
    params?: Record<string, string | number | boolean>;
    headers?: RawAxiosRequestHeaders;
    timeout?: number;
  } = {}
): Promise<AxiosResponse> {
  // Merge default headers with any custom headers
  const mergedHeaders = {
    ...DefaultHeaders,
    ...options.headers,
  };

  mergedHeaders["Host"] = "www.konkurs.ro";
  return axios.get(url, {
    headers: mergedHeaders,
    params: options.params,
    timeout: options.timeout || 30000, // Default 10 second timeout
    validateStatus: (status) => status >= 200 && status < 300,
    httpsAgent: keepaliveAgent,
  });
}
