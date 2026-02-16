import { readRequiredEnv, readOptionalEnv } from "../config/environment";
import type { GeneratedTexts, SelectedMusic } from "../types/pipeline";
import { fileExists, readJsonFile, readTextFile, writeJsonFile } from "../utils/file-system";
import { createOpenAIClient } from "../utils/openai-client";

interface SelectMusicParams {
  screenshotBase64: string;
  generatedTexts: GeneratedTexts;
  descriptionsPath: string;
  outputPath: string;
}

export class MusicSelectionService {
  private readonly openAIClient: {
    responses: {
      create: (params: unknown) => Promise<{ output_text?: string }>;
    };
  };
  private readonly model: string;

  /**
   * Initializes OpenAI client and model settings for music selection.
   */
  public constructor() {
    this.openAIClient = createOpenAIClient(readRequiredEnv("OPENAI_API_KEY"));
    this.model = readOptionalEnv("MUSIC_SELECTION_MODEL", "gpt-4.1");
  }

  /**
   * Chooses the best background track based on visual and textual context.
   *
   * @param params Selection payload with screenshot, generated texts, and catalog description file.
   * @returns Selected music metadata.
   */
  public async selectTrack(params: SelectMusicParams): Promise<SelectedMusic> {
    const { screenshotBase64, generatedTexts, descriptionsPath, outputPath } = params;

    if (await fileExists(outputPath)) {
      return readJsonFile<SelectedMusic>(outputPath);
    }

    const descriptions = await readTextFile(descriptionsPath);

    const response = await this.openAIClient.responses.create({
      model: this.model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${descriptions}
---
Choose the best background music track for this animal video.
Voiceover context:
${generatedTexts.ENGLISH ?? Object.values(generatedTexts)[0] ?? ""}`,
            },
            {
              type: "input_image",
              image_url: `data:image/png;base64,${screenshotBase64}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "selected_music",
          strict: true,
          schema: {
            type: "object",
            properties: {
              mp3file: {
                type: "string",
                description: "File name of the selected .mp3 track",
              },
            },
            required: ["mp3file"],
            additionalProperties: false,
          },
        },
      },
    });

    if (!response.output_text) {
      throw new Error("OpenAI did not return output_text for selected music");
    }

    const selectedMusic = JSON.parse(response.output_text) as SelectedMusic;
    await writeJsonFile(outputPath, selectedMusic);

    return selectedMusic;
  }
}
