import { appPaths } from "../config/environment";
import { VideoWorkspace } from "../domain/video-workspace";
import { CaptionService } from "../services/caption.service";
import { MusicSelectionService } from "../services/music-selection.service";
import { RenderService } from "../services/render.service";
import { ScreenshotService } from "../services/screenshot.service";
import { StorageService } from "../services/storage.service";
import { TextGenerationService } from "../services/text-generation.service";
import { VoiceoverService } from "../services/voiceover.service";
import type { GeneratedTexts, Language, PipelineOptions, SelectedMusic } from "../types/pipeline";
import { readTextFile } from "../utils/file-system";
import { loadVideoSetup } from "../utils/video-setup";

export class VideoPipeline {
  private readonly screenshotService = new ScreenshotService();
  private readonly textGenerationService = new TextGenerationService();
  private readonly musicSelectionService = new MusicSelectionService();
  private readonly voiceoverService = new VoiceoverService();
  private readonly storageService = new StorageService();
  private readonly renderService = new RenderService();
  private readonly captionService = new CaptionService();

  /**
   * Runs the full pipeline for every requested video.
   *
   * @param options Pipeline execution options.
   * @returns Promise resolved when all videos are processed.
   */
  public async run(options: PipelineOptions): Promise<void> {
    for (const videoId of options.videoIds) {
      console.log(`\n[pipeline] Processing video: ${videoId}`);
      await this.processVideo(videoId, options.languages);
    }
  }

  /**
   * Executes all processing stages for a single video.
   *
   * @param videoId Video identifier.
   * @param languages Output languages.
   * @returns Promise resolved when processing is complete.
   */
  private async processVideo(videoId: string, languages: Language[]): Promise<void> {
    const workspace = new VideoWorkspace(appPaths.inputRootDir, videoId);
    const setup = await loadVideoSetup(workspace.setupPath);

    await this.screenshotService.extractScreenshot(workspace.sourceVideoPath, workspace.screenshotPath);

    const screenshotBase64 = await this.screenshotService.toBase64(workspace.screenshotPath);
    const originalText = await readTextFile(workspace.originalTextPath);

    const generatedTexts = await this.textGenerationService.generateTexts({
      languages,
      originalText,
      screenshotBase64,
      outputPath: workspace.generatedTextsPath,
    });

    let selectedMusic: SelectedMusic | undefined;
    if (setup.backgroundMusic) {
      selectedMusic = await this.musicSelectionService.selectTrack({
        screenshotBase64,
        generatedTexts,
        descriptionsPath: appPaths.musicDescriptionsPath,
        outputPath: workspace.selectedMusicPath,
      });
    }

    await this.generateVoiceovers(workspace, languages, generatedTexts);

    const storageUploadPayload = selectedMusic?.mp3file
      ? {
          workspace,
          languages,
          backgroundMusicFileName: selectedMusic.mp3file,
        }
      : {
          workspace,
          languages,
        };

    const storageBaseUrl = await this.storageService.uploadVideoAssets(storageUploadPayload);

    for (const language of languages) {
      await this.renderService.renderLanguageVideo({
        workspace,
        language,
        setup,
        storageBaseUrl,
      });

      const voiceoverText = generatedTexts[language];
      if (!voiceoverText) {
        throw new Error(`Missing generated text for language: ${language}`);
      }

      await this.captionService.createCaptionedVideo({
        sourceVideoPath: workspace.renderedVideoPath(language),
        outputPath: workspace.captionedVideoPath(language),
        language,
        originalText: voiceoverText,
      });
    }

    this.logVideoSummary(workspace, languages, generatedTexts);
  }

  /**
   * Generates voiceover files for each configured language.
   *
   * @param workspace Workspace with resolved file paths.
   * @param languages Output languages.
   * @param generatedTexts Generated text map.
   * @returns Promise resolved when all voiceovers are generated.
   */
  private async generateVoiceovers(
    workspace: VideoWorkspace,
    languages: Language[],
    generatedTexts: GeneratedTexts,
  ): Promise<void> {
    for (const language of languages) {
      const voiceoverText = generatedTexts[language];

      if (!voiceoverText) {
        throw new Error(`No generated text found for language: ${language}`);
      }

      await this.voiceoverService.generateVoiceover({
        text: voiceoverText,
        language,
        outputPath: workspace.voiceoverPath(language),
      });
    }
  }

  /**
   * Prints pipeline output summary for a processed video.
   *
   * @param workspace Workspace with output paths.
   * @param languages Output languages.
   * @param generatedTexts Generated text map.
   */
  private logVideoSummary(
    workspace: VideoWorkspace,
    languages: Language[],
    generatedTexts: GeneratedTexts,
  ): void {
    console.log("\n==========================================================");
    console.log(`[pipeline] Completed video: ${workspace.videoId}`);

    for (const language of languages) {
      console.log(`${language}:`);
      console.log(`- Title: ${generatedTexts[`${language}_VideoTitle`] ?? ""}`);
      console.log(`- Description: ${generatedTexts[`${language}_VideoDescription`] ?? ""}`);
      console.log(`- Output: ${workspace.captionedVideoPath(language)}`);
    }

    console.log("==========================================================\n");
  }
}
