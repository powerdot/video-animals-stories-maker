import axios from "axios";

import { readOptionalEnv, readRequiredEnv } from "../config/environment";
import type { Language } from "../types/pipeline";
import { fileExists } from "../utils/file-system";
import { downloadFile } from "../utils/http";

const languageToVoiceMakerCode: Record<string, string> = {
  ENGLISH: "en-US",
  SPANISH: "es-ES",
  RUSSIAN: "ru-RU",
  FRENCH: "fr-FR",
  GERMAN: "de-DE",
  ITALIAN: "it-IT",
  PORTUGUESE: "pt-PT",
  UKRAINIAN: "uk-UA",
  CHINESE: "zh-CN",
};

interface GenerateVoiceoverParams {
  text: string;
  language: Language;
  outputPath: string;
}

export class VoiceoverService {
  private readonly apiKey: string;
  private readonly voiceId: string;

  /**
   * Reads VoiceMaker credentials and voice configuration from environment.
   */
  public constructor() {
    this.apiKey = readRequiredEnv("VOICE_MAKER_API_KEY");
    this.voiceId = readOptionalEnv("VOICE_MAKER_VOICE_ID", "pro1-Thomas");
  }

  /**
   * Generates a voiceover file for a specific language.
   *
   * @param params Voiceover generation input.
   * @returns Path to generated audio file.
   */
  public async generateVoiceover(params: GenerateVoiceoverParams): Promise<string> {
    const { text, language, outputPath } = params;

    if (await fileExists(outputPath)) {
      console.log(`[voiceover] File already exists: ${outputPath}`);
      return outputPath;
    }

    const languageCode = languageToVoiceMakerCode[language.toUpperCase()];
    if (!languageCode) {
      throw new Error(`Unsupported voiceover language: ${language}`);
    }

    const response = await axios.post(
      "https://developer.voicemaker.in/voice/api",
      {
        Engine: "neural",
        VoiceId: this.voiceId,
        LanguageCode: languageCode,
        Text: `<${languageCode.toLowerCase()}>${text}</${languageCode.toLowerCase()}>`,
        OutputFormat: "mp3",
        SampleRate: "48000",
        Effect: "default",
        MasterVolume: "0",
        MasterSpeed: "0",
        MasterPitch: "0",
        speed: 10,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    );

    const downloadUrl = response.data?.path as string | undefined;
    if (!downloadUrl) {
      throw new Error("VoiceMaker response does not contain audio file URL");
    }

    await downloadFile(downloadUrl, outputPath);

    return outputPath;
  }
}
