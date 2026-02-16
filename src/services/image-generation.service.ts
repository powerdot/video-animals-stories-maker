import { writeFile } from "node:fs/promises";

import Replicate from "replicate";

import { fileExists } from "../utils/file-system";

export class ImageGenerationService {
  private readonly replicateClient: Replicate;

  /**
   * Creates Replicate API client.
   */
  public constructor() {
    this.replicateClient = new Replicate();
  }

  /**
   * Generates an image from a prompt and stores model output in a file.
   *
   * @param prompt Prompt passed to the image model.
   * @param outputPath Destination file path.
   * @returns Path to saved output.
   */
  public async generateImage(prompt: string, outputPath: string): Promise<string> {
    if (await fileExists(outputPath)) {
      console.log(`[image] File already exists: ${outputPath}`);
      return outputPath;
    }

    const output = await this.replicateClient.run("google/imagen-4", {
      input: {
        prompt,
        aspect_ratio: "1:1",
        safety_filter_level: "block_low_and_above",
      },
    });

    const imagePayload =
      typeof output === "string" ? output : JSON.stringify(output, null, 2);

    await writeFile(outputPath, imagePayload);

    console.log(`[image] Generated: ${outputPath}`);

    return outputPath;
  }
}
