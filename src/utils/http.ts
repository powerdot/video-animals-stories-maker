import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

import axios from "axios";

import { ensureDirectoryForFile } from "./file-system";

/**
 * Delays execution for a given number of milliseconds.
 *
 * @param milliseconds Delay duration in milliseconds.
 * @returns Promise resolved after the delay.
 */
export async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Polls a URL with HEAD requests until it becomes available.
 *
 * @param url URL to probe.
 * @param maxAttempts Maximum polling attempts.
 * @param intervalMs Delay between attempts in milliseconds.
 * @returns Promise resolved when URL is available.
 */
export async function waitForUrlAvailability(
  url: string,
  maxAttempts = 60,
  intervalMs = 10_000,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await axios.head(url, {
        timeout: 10_000,
        maxRedirects: 3,
        headers: {
          Connection: "close",
        },
      });
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error(`URL is not available after ${maxAttempts} attempts: ${url}`);
      }
      await sleep(intervalMs);
    }
  }
}

/**
 * Downloads a remote file to the specified local path.
 *
 * @param url Remote file URL.
 * @param outputPath Destination path.
 * @returns Path to the downloaded file.
 */
export async function downloadFile(url: string, outputPath: string): Promise<string> {
  await ensureDirectoryForFile(outputPath);

  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 30_000,
    maxRedirects: 3,
    headers: {
      Connection: "close",
    },
  });

  await pipeline(response.data, createWriteStream(outputPath));
  response.data.destroy();

  return outputPath;
}
