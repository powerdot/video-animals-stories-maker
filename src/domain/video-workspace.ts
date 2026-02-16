import path from "node:path";

import type { Language } from "../types/pipeline";

export class VideoWorkspace {
  public readonly directoryPath: string;

  /**
   * Creates a workspace helper bound to a single input video directory.
   *
   * @param inputRootDirectory Root input folder.
   * @param videoId Identifier of the current video.
   */
  public constructor(
    private readonly inputRootDirectory: string,
    public readonly videoId: string,
  ) {
    this.directoryPath = path.resolve(this.inputRootDirectory, this.videoId);
  }

  /**
   * Resolves an absolute path inside the workspace directory.
   *
   * @param fileName File name relative to workspace.
   * @returns Absolute file path.
   */
  public filePath(fileName: string): string {
    return path.resolve(this.directoryPath, fileName);
  }

  /**
   * Returns source video path.
   *
   * @returns Absolute path to `video.mp4`.
   */
  public get sourceVideoPath(): string {
    return this.filePath("video.mp4");
  }

  /**
   * Returns screenshot path.
   *
   * @returns Absolute path to `screenshot.png`.
   */
  public get screenshotPath(): string {
    return this.filePath("screenshot.png");
  }

  /**
   * Returns original text path.
   *
   * @returns Absolute path to `originalText.txt`.
   */
  public get originalTextPath(): string {
    return this.filePath("originalText.txt");
  }

  /**
   * Returns setup configuration path.
   *
   * @returns Absolute path to `setup.json`.
   */
  public get setupPath(): string {
    return this.filePath("setup.json");
  }

  /**
   * Returns generated texts path.
   *
   * @returns Absolute path to `generatedTexts.json`.
   */
  public get generatedTextsPath(): string {
    return this.filePath("generatedTexts.json");
  }

  /**
   * Returns selected music metadata path.
   *
   * @returns Absolute path to `selectedMusic.json`.
   */
  public get selectedMusicPath(): string {
    return this.filePath("selectedMusic.json");
  }

  /**
   * Returns voiceover file path for a language.
   *
   * @param language Output language.
   * @returns Absolute path to language voiceover file.
   */
  public voiceoverPath(language: Language): string {
    return this.filePath(`voiceover_${language}.mp3`);
  }

  /**
   * Returns rendered video path for a language.
   *
   * @param language Output language.
   * @returns Absolute path to rendered video file.
   */
  public renderedVideoPath(language: Language): string {
    return this.filePath(`rendered_${language}.mp4`);
  }

  /**
   * Returns captioned video path for a language.
   *
   * @param language Output language.
   * @returns Absolute path to captioned video file.
   */
  public captionedVideoPath(language: Language): string {
    return this.filePath(`captioned_${language}.mp4`);
  }
}
