declare module "json2video-sdk" {
  export class Scene {
    /**
     * Sets a scene-level property.
     *
     * @param key Property name.
     * @param value Property value.
     */
    public set(key: string, value: unknown): void;
    /**
     * Adds an element to the scene.
     *
     * @param element Scene element description.
     */
    public addElement(element: Record<string, unknown>): void;
  }

  export class Movie {
    /**
     * Configures API key used for rendering requests.
     *
     * @param apiKey JSON2Video API key.
     */
    public setAPIKey(apiKey: string): void;
    /**
     * Sets a movie-level property.
     *
     * @param key Property name.
     * @param value Property value.
     */
    public set(key: string, value: unknown): void;
    /**
     * Appends a scene to the movie timeline.
     *
     * @param scene Scene instance.
     */
    public addScene(scene: Scene): void;
    /**
     * Starts asynchronous movie rendering.
     *
     * @returns Render operation handle.
     */
    public render(): Promise<unknown>;
    /**
     * Waits until render completion and streams status updates.
     *
     * @param callback Status update callback.
     * @returns Final render status.
     */
    public waitToFinish(callback: (status: unknown) => void): Promise<unknown>;
  }
}

declare module "fluent-ffmpeg" {
  interface ScreenshotOptions {
    timestamps: string[];
    filename: string;
    folder: string;
    size?: string;
  }

  interface FfmpegCommand {
    /**
     * Subscribes to ffmpeg lifecycle events.
     *
     * @param event Event name.
     * @param handler Event handler.
     * @returns Current command instance.
     */
    on(event: "end", handler: () => void): FfmpegCommand;
    /**
     * Subscribes to ffmpeg error events.
     *
     * @param event Error event name.
     * @param handler Error handler.
     * @returns Current command instance.
     */
    on(event: "error", handler: (error: unknown) => void): FfmpegCommand;
    /**
     * Captures screenshots using provided options.
     *
     * @param options Screenshot options.
     */
    screenshots(options: ScreenshotOptions): void;
  }

  /**
   * Creates ffmpeg command builder for an input media file.
   *
   * @param input Input media path.
   * @returns ffmpeg command instance.
   */
  export default function ffmpeg(input: string): FfmpegCommand;
}

declare module "replicate" {
  interface ReplicateRunInput {
    prompt: string;
    aspect_ratio?: string;
    safety_filter_level?: string;
  }

  interface ReplicateRunOptions {
    input: ReplicateRunInput;
  }

  export default class Replicate {
    /**
     * Creates Replicate client instance.
     */
    public constructor();
    /**
     * Executes a model inference request.
     *
     * @param model Model identifier.
     * @param options Model execution options.
     * @returns Model output payload.
     */
    public run(model: string, options: ReplicateRunOptions): Promise<unknown>;
  }
}
