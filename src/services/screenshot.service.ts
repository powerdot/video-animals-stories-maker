import { readFile } from "node:fs/promises";
import path from "node:path";

import ffmpeg from "fluent-ffmpeg";

import { fileExists } from "../utils/file-system";

export class ScreenshotService {
  /**
   * Extracts a screenshot from the source video, skipping generation if it already exists.
   *
   * @param videoPath Source video path.
   * @param screenshotPath Destination image path.
   * @returns Screenshot path.
   */
  public async extractScreenshot(videoPath: string, screenshotPath: string): Promise<string> {
    if (await fileExists(screenshotPath)) {
      console.log(`[screenshot] File already exists: ${screenshotPath}`);
      return screenshotPath;
    }

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .on("end", () => resolve())
        .on("error", (error: unknown) => reject(error))
        .screenshots({
          timestamps: ["00:00:02.000"],
          filename: path.basename(screenshotPath),
          folder: path.dirname(screenshotPath),
          size: "720x1280",
        });
    });

    console.log(`[screenshot] Extracted: ${screenshotPath}`);

    return screenshotPath;
  }

  /**
   * Reads an image file and returns its Base64 payload.
   *
   * @param imagePath Image file path.
   * @returns Base64-encoded image content.
   */
  public async toBase64(imagePath: string): Promise<string> {
    const imageBuffer = await readFile(imagePath);
    return imageBuffer.toString("base64");
  }
}
