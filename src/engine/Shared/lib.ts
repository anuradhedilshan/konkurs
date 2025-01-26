import { HttpsAgent } from "agentkeepalive";
import axios, { AxiosResponse, RawAxiosRequestHeaders } from "axios";

export type ContentType = "articles" | "promotions";

const DefaultHeaders: RawAxiosRequestHeaders = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "cache-control": "max-age=0",
  "sec-ch-ua":
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Linux"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
  'Connection': 'keep-alive'
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
