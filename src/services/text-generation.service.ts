import { readOptionalEnv, readRequiredEnv } from "../config/environment";
import type { GeneratedTexts, Language } from "../types/pipeline";
import { fileExists, writeJsonFile, readJsonFile } from "../utils/file-system";
import { createOpenAIClient } from "../utils/openai-client";

interface GenerateTextsParams {
  languages: Language[];
  originalText: string;
  screenshotBase64: string;
  outputPath: string;
}

export class TextGenerationService {
  private readonly openAIClient: {
    responses: {
      create: (params: unknown) => Promise<{ output_text?: string }>;
    };
  };
  private readonly model: string;

  /**
   * Initializes OpenAI client and model settings for text generation.
   */
  public constructor() {
    this.openAIClient = createOpenAIClient(readRequiredEnv("OPENAI_API_KEY"));
    this.model = readOptionalEnv("TEXT_GENERATION_MODEL", "o3");
  }

  /**
   * Generates localized voiceover texts, titles, and descriptions for a video.
   *
   * @param params Generation payload with text/image context and output path.
   * @returns Generated texts by language and metadata keys.
   */
  public async generateTexts(params: GenerateTextsParams): Promise<GeneratedTexts> {
    const { languages, originalText, screenshotBase64, outputPath } = params;

    if (await fileExists(outputPath)) {
      return readJsonFile<GeneratedTexts>(outputPath);
    }

    const schemaProperties: Record<string, unknown> = {};
    for (const language of languages) {
      schemaProperties[language] = {
        type: "string",
        description: `Voiceover text in ${language}`,
      };
      schemaProperties[`${language}_VideoTitle`] = {
        type: "string",
        description: `Short title in ${language} (2-5 words)`,
      };
      schemaProperties[`${language}_VideoDescription`] = {
        type: "string",
        description: `Description in ${language} with hashtags`,
      };
    }

    const response = await this.openAIClient.responses.create({
      model: this.model,
      reasoning: {
        effort: "high",
        summary: "auto",
      },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${originalText}
---
Write voiceover text for a short animal video:
1. Who the animal is and what it is doing
2. Where this species lives
3. Three rare, cool, or cute facts
4. Why this species is important

Use a natural narrative tone without numbered bullets.
Also generate a short title and a short description for each language.
Finish with a localized call to action to subscribe.

Write in these languages: ${languages.join(", ")}.`,
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
          name: "generated_texts",
          strict: true,
          schema: {
            type: "object",
            properties: schemaProperties,
            required: [
              ...languages,
              ...languages.map((language) => `${language}_VideoTitle`),
              ...languages.map((language) => `${language}_VideoDescription`),
            ],
            additionalProperties: false,
          },
        },
      },
      tools: [
        {
          type: "web_search_preview",
          user_location: {
            type: "approximate",
          },
          search_context_size: "medium",
        },
      ],
    });

    if (!response.output_text) {
      throw new Error("OpenAI did not return output_text for generated texts");
    }

    const generatedTexts = JSON.parse(response.output_text) as GeneratedTexts;
    await writeJsonFile(outputPath, generatedTexts);

    return generatedTexts;
  }
}
