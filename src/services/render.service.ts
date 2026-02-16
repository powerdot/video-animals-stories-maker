import { Movie, Scene } from "json2video-sdk";

import { DEFAULT_RENDER_QUALITY, DEFAULT_VIDEO_RESOLUTION } from "../config/defaults";
import { readRequiredEnv } from "../config/environment";
import { VideoWorkspace } from "../domain/video-workspace";
import type { Language, VideoSetup } from "../types/pipeline";
import { fileExists } from "../utils/file-system";
import { downloadFile } from "../utils/http";
import { getMediaDurationSeconds } from "./media.service";

interface RenderParams {
  workspace: VideoWorkspace;
  language: Language;
  setup: VideoSetup;
  storageBaseUrl: string;
}

interface RenderStatus {
  movie: {
    status: string;
    message?: string;
    url?: string;
  };
}

export class RenderService {
  private readonly apiKey: string;

  /**
   * Reads JSON2Video API credentials from environment.
   */
  public constructor() {
    this.apiKey = readRequiredEnv("JSON2VIDEO_API_KEY");
  }

  /**
   * Renders a video for a language by combining source footage, voiceover, and optional music.
   *
   * @param params Render payload for a single language.
   * @returns Path to the rendered video file.
   */
  public async renderLanguageVideo(params: RenderParams): Promise<string> {
    const { workspace, language, setup, storageBaseUrl } = params;
    const outputPath = workspace.renderedVideoPath(language);

    if (await fileExists(outputPath)) {
      console.log(`[render] File already exists: ${outputPath}`);
      return outputPath;
    }

    const normalizedBaseUrl = storageBaseUrl.replace(/\/$/, "");
    const cacheBust = `cacheBust=${Date.now()}`;

    const sourceVideoUrl = `${normalizedBaseUrl}/video.mp4?${cacheBust}`;
    const voiceoverUrl = `${normalizedBaseUrl}/voiceover_${language}.mp3?${cacheBust}`;
    const backgroundMusicUrl = `${normalizedBaseUrl}/background.mp3?${cacheBust}`;

    const sourceVideoDuration = Math.max(
      0.1,
      (await getMediaDurationSeconds(workspace.sourceVideoPath)) - 0.1,
    );
    const voiceoverDuration = await getMediaDurationSeconds(workspace.voiceoverPath(language));

    const extraClipCount =
      sourceVideoDuration < voiceoverDuration
        ? Math.max(0, Math.ceil(voiceoverDuration / sourceVideoDuration) - 1)
        : 0;

    const voiceoverClipDuration =
      sourceVideoDuration > voiceoverDuration ? sourceVideoDuration : undefined;

    const movie = new Movie();
    movie.setAPIKey(this.apiKey);
    movie.set("quality", DEFAULT_RENDER_QUALITY);
    movie.set("draft", false);
    movie.set("width", DEFAULT_VIDEO_RESOLUTION.width);
    movie.set("height", DEFAULT_VIDEO_RESOLUTION.height);

    const scene = new Scene();
    scene.set("background-color", "#000000");

    scene.addElement({
      type: "video",
      src: sourceVideoUrl,
      start: 0,
      height: DEFAULT_VIDEO_RESOLUTION.height,
      cache: false,
      volume: setup.videoVolume,
    });

    for (let index = 0; index < extraClipCount; index += 1) {
      const clipStart = sourceVideoDuration * (index + 1);
      const remainingDuration = voiceoverDuration - clipStart;

      const element: Record<string, unknown> = {
        type: "video",
        src: sourceVideoUrl,
        start: clipStart,
        height: DEFAULT_VIDEO_RESOLUTION.height,
        cache: false,
        volume: setup.videoVolume,
      };

      if (index === extraClipCount - 1) {
        element.duration = Math.max(0.1, remainingDuration);
      }

      scene.addElement(element);
    }

    const voiceoverElement: Record<string, unknown> = {
      type: "audio",
      src: voiceoverUrl,
      start: 0,
      volume: 1,
      cache: false,
    };

    if (voiceoverClipDuration) {
      voiceoverElement.duration = voiceoverClipDuration;
    }

    scene.addElement(voiceoverElement);

    if (setup.backgroundMusic) {
      scene.addElement({
        type: "audio",
        src: backgroundMusicUrl,
        start: 0,
        volume: 0.3,
        cache: false,
        duration: Math.max(sourceVideoDuration, voiceoverDuration),
      });
    }

    movie.addScene(scene);

    await movie.render();

    const status = (await movie.waitToFinish((rawStatus: unknown) => {
      const renderStatus = rawStatus as RenderStatus;
      console.log(`[render] ${language}: ${renderStatus.movie.status} ${renderStatus.movie.message ?? ""}`);

      if (renderStatus.movie.status === "error") {
        throw new Error(renderStatus.movie.message ?? "Render failed");
      }
    })) as RenderStatus;

    const downloadUrl = status.movie.url;
    if (!downloadUrl) {
      throw new Error(`Render completed without output URL for language: ${language}`);
    }

    await downloadFile(downloadUrl, outputPath);

    return outputPath;
  }
}
