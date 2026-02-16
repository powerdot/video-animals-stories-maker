import { createReadStream } from "node:fs";

import axios, { type AxiosInstance } from "axios";
import FormData from "form-data";

import { readOptionalEnv, readRequiredEnv } from "../config/environment";
import type { Language } from "../types/pipeline";
import { fileExists } from "../utils/file-system";
import { downloadFile, sleep } from "../utils/http";
import { createOpenAIClient } from "../utils/openai-client";
import { resampleAudioIfNeeded } from "./media.service";

const languageToZapcapCode: Record<string, string> = {
  ENGLISH: "en",
  SPANISH: "es",
  RUSSIAN: "ru",
  FRENCH: "fr",
  GERMAN: "de",
  ITALIAN: "it",
  PORTUGUESE: "pt",
};

interface CaptionTaskStatus {
  status: string;
  error?: string;
  downloadUrl?: string;
  transcript?: string;
}

interface TranscriptChunk {
  text?: string;
  [key: string]: unknown;
}

interface TranscriptionCorrectionChunk {
  text: string;
}

interface CreateCaptionedVideoParams {
  sourceVideoPath: string;
  outputPath: string;
  language: Language;
  originalText: string;
}

export class CaptionService {
  private readonly httpClient: AxiosInstance;
  private readonly templateId: string;
  private readonly openAIClient: {
    responses: {
      create: (params: unknown) => Promise<{ output_text?: string }>;
    };
  };
  private readonly reviewModel: string;
  private readonly maxRetryAttempts: number;

  /**
   * Initializes Zapcap and OpenAI clients for caption generation workflow.
   */
  public constructor() {
    const zapcapApiKey = readRequiredEnv("ZAPCAP_API_KEY");

    this.httpClient = axios.create({
      baseURL: readOptionalEnv("ZAPCAP_API_BASE_URL", "https://api.zapcap.ai"),
      headers: {
        "x-api-key": zapcapApiKey,
      },
    });

    this.templateId = readRequiredEnv("ZAPCAP_TEMPLATE_ID");
    this.openAIClient = createOpenAIClient(readRequiredEnv("OPENAI_API_KEY"));
    this.reviewModel = readOptionalEnv("CAPTION_REVIEW_MODEL", "o3");
    this.maxRetryAttempts = Number.parseInt(readOptionalEnv("CAPTION_MAX_RETRIES", "3"), 10);
  }

  /**
   * Creates a captioned version of a rendered video with retry logic.
   *
   * @param params Captioning payload.
   * @returns Path to the captioned output file.
   */
  public async createCaptionedVideo(params: CreateCaptionedVideoParams): Promise<string> {
    const { sourceVideoPath, outputPath, language, originalText } = params;

    if (await fileExists(outputPath)) {
      console.log(`[captions] File already exists: ${outputPath}`);
      return outputPath;
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetryAttempts; attempt += 1) {
      try {
        const videoId = await this.uploadVideo(sourceVideoPath);
        const taskId = await this.createCaptionTask(videoId, language);

        const transcriptUrl = await this.waitForTranscription(videoId, taskId, language);
        const originalTranscript = await this.loadTranscript(transcriptUrl);
        const correctedTranscript = await this.correctTranscript(originalText, originalTranscript);

        await this.applyTranscript(videoId, taskId, correctedTranscript);
        await this.approveTranscript(videoId, taskId);

        const downloadUrl = await this.waitForCompletedVideo(videoId, taskId, language);
        await downloadFile(downloadUrl, outputPath);
        await resampleAudioIfNeeded(outputPath);

        return outputPath;
      } catch (error) {
        lastError = error;
        console.error(`[captions] Attempt ${attempt} failed for ${language}:`, error);

        if (attempt < this.maxRetryAttempts) {
          await sleep(2_000 * attempt);
        }
      }
    }

    throw new Error(`Failed to create captioned video after retries: ${String(lastError)}`);
  }

  /**
   * Uploads a source video to Zapcap and returns assigned video ID.
   *
   * @param videoPath Local video file path.
   * @returns Zapcap video ID.
   */
  private async uploadVideo(videoPath: string): Promise<string> {
    const form = new FormData();
    form.append("file", createReadStream(videoPath));

    const response = await this.httpClient.post<{ id: string }>("/videos", form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    if (!response.data?.id) {
      throw new Error("Zapcap upload response does not contain video id");
    }

    return response.data.id;
  }

  /**
   * Creates a captioning task for an uploaded video.
   *
   * @param videoId Zapcap video ID.
   * @param language Target caption language.
   * @returns Zapcap task ID.
   */
  private async createCaptionTask(videoId: string, language: Language): Promise<string> {
    const languageCode = languageToZapcapCode[language.toUpperCase()];
    if (!languageCode) {
      throw new Error(`Unsupported caption language: ${language}`);
    }

    const response = await this.httpClient.post<{ taskId: string }>(`/videos/${videoId}/task`, {
      templateId: this.templateId,
      autoApprove: false,
      language: languageCode,
    });

    if (!response.data?.taskId) {
      throw new Error("Zapcap task response does not contain taskId");
    }

    return response.data.taskId;
  }

  /**
   * Waits until Zapcap transcription is available and returns transcript URL.
   *
   * @param videoId Zapcap video ID.
   * @param taskId Zapcap task ID.
   * @param language Target caption language.
   * @returns URL to transcript payload.
   */
  private async waitForTranscription(videoId: string, taskId: string, language: Language): Promise<string> {
    const status = await this.waitForTaskStatus(videoId, taskId, ["transcriptionCompleted"], language);

    if (!status.transcript) {
      throw new Error("Zapcap did not provide transcript URL");
    }

    return status.transcript;
  }

  /**
   * Waits until Zapcap finishes rendering the captioned video.
   *
   * @param videoId Zapcap video ID.
   * @param taskId Zapcap task ID.
   * @param language Target caption language.
   * @returns Download URL of the completed captioned video.
   */
  private async waitForCompletedVideo(videoId: string, taskId: string, language: Language): Promise<string> {
    const status = await this.waitForTaskStatus(videoId, taskId, ["completed"], language);

    if (!status.downloadUrl) {
      throw new Error("Zapcap did not provide download URL");
    }

    return status.downloadUrl;
  }

  /**
   * Polls Zapcap task status until one of target statuses is reached.
   *
   * @param videoId Zapcap video ID.
   * @param taskId Zapcap task ID.
   * @param targetStatuses Statuses considered successful for this step.
   * @param language Target caption language.
   * @returns Latest task status payload.
   */
  private async waitForTaskStatus(
    videoId: string,
    taskId: string,
    targetStatuses: string[],
    language: Language,
  ): Promise<CaptionTaskStatus> {
    while (true) {
      const response = await this.httpClient.get<CaptionTaskStatus>(`/videos/${videoId}/task/${taskId}`);
      const status = response.data;

      console.log(`[captions] ${language}: ${status.status}`);

      if (targetStatuses.includes(status.status)) {
        return status;
      }

      if (status.status === "failed") {
        throw new Error(`Zapcap task failed: ${status.error ?? "unknown error"}`);
      }

      await sleep(2_000);
    }
  }

  /**
   * Downloads and parses transcript JSON from Zapcap.
   *
   * @param transcriptUrl Transcript URL returned by Zapcap.
   * @returns Transcript chunks.
   */
  private async loadTranscript(transcriptUrl: string): Promise<TranscriptChunk[]> {
    const response = await axios.get<unknown>(transcriptUrl, {
      responseType: "json",
    });

    const transcript =
      typeof response.data === "string"
        ? (JSON.parse(response.data) as unknown)
        : response.data;

    if (!Array.isArray(transcript)) {
      throw new Error("Zapcap transcript format is invalid");
    }

    return transcript as TranscriptChunk[];
  }

  /**
   * Replaces transcript text chunks with spelling-corrected variants.
   *
   * @param originalText Reference script.
   * @param transcript Transcript chunks from Zapcap.
   * @returns Corrected transcript with original structure preserved.
   */
  private async correctTranscript(
    originalText: string,
    transcript: TranscriptChunk[],
  ): Promise<TranscriptChunk[]> {
    const chunksWithText = transcript.filter(
      (chunk): chunk is TranscriptChunk & { text: string } =>
        typeof chunk.text === "string" && chunk.text.length > 0,
    );

    const compactTranscript = chunksWithText.map((chunk) => ({
      text: chunk.text,
    }));

    const correctedChunks = await this.correctTranscriptChunks(originalText, compactTranscript);

    if (correctedChunks.length !== compactTranscript.length) {
      throw new Error("Corrected transcript length does not match original transcript length");
    }

    const transcriptCopy = transcript.map((chunk) => ({ ...chunk }));

    let correctionIndex = 0;
    for (const chunk of transcriptCopy) {
      if (typeof chunk.text === "string" && chunk.text.length > 0) {
        chunk.text = correctedChunks[correctionIndex]?.text ?? chunk.text;
        correctionIndex += 1;
      }
    }

    return transcriptCopy;
  }

  /**
   * Requests OpenAI to correct spelling in transcript chunks.
   *
   * @param originalText Reference script.
   * @param chunks Transcript chunks containing text.
   * @returns Corrected transcript chunks.
   */
  private async correctTranscriptChunks(
    originalText: string,
    chunks: TranscriptionCorrectionChunk[],
  ): Promise<TranscriptionCorrectionChunk[]> {
    const response = await this.openAIClient.responses.create({
      model: this.reviewModel,
      reasoning: {
        effort: "high",
      },
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: "Check transcript chunks against the original text. Fix only word spelling errors. Do not change order, do not change array size, and keep punctuation placeholders.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Original text: ${originalText}\n\nTranscript chunks: ${JSON.stringify(chunks, null, 2)}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "corrected_transcript",
          strict: true,
          schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                    },
                  },
                  required: ["text"],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      },
    });

    if (!response.output_text) {
      throw new Error("OpenAI did not return corrected transcript");
    }

    const parsed = JSON.parse(response.output_text) as { items?: TranscriptionCorrectionChunk[] };

    if (!Array.isArray(parsed.items)) {
      throw new Error("Corrected transcript response format is invalid");
    }

    return parsed.items;
  }

  /**
   * Uploads corrected transcript back to Zapcap.
   *
   * @param videoId Zapcap video ID.
   * @param taskId Zapcap task ID.
   * @param transcript Corrected transcript payload.
   */
  private async applyTranscript(videoId: string, taskId: string, transcript: TranscriptChunk[]): Promise<void> {
    await this.httpClient.put(`/videos/${videoId}/task/${taskId}/transcript`, transcript, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Confirms transcript approval so Zapcap can finalize rendering.
   *
   * @param videoId Zapcap video ID.
   * @param taskId Zapcap task ID.
   */
  private async approveTranscript(videoId: string, taskId: string): Promise<void> {
    await this.httpClient.post(
      `/videos/${videoId}/task/${taskId}/approve-transcript`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}
