import { createReadStream } from "node:fs";
import path from "node:path";

import AWS from "aws-sdk";

import { appPaths, readOptionalEnv, readRequiredEnv } from "../config/environment";
import type { Language } from "../types/pipeline";
import { VideoWorkspace } from "../domain/video-workspace";

interface UploadAssetsParams {
  workspace: VideoWorkspace;
  languages: Language[];
  backgroundMusicFileName?: string;
}

export class StorageService {
  private readonly storageClient: AWS.S3;
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;

  /**
   * Initializes S3 client configuration from environment.
   */
  public constructor() {
    this.bucketName = readRequiredEnv("S3_BUCKET");
    const region = readOptionalEnv("S3_REGION", "us-east-1");
    const endpoint = readOptionalEnv("S3_ENDPOINT");
    const forcePathStyle = readOptionalEnv("S3_FORCE_PATH_STYLE", "false") === "true";

    const accessKeyId = readOptionalEnv("S3_ACCESS_KEY_ID", process.env.AWS_ACCESS_KEY_ID ?? "");
    const secretAccessKey = readOptionalEnv("S3_SECRET_ACCESS_KEY", process.env.AWS_SECRET_ACCESS_KEY ?? "");
    const sessionToken = readOptionalEnv("S3_SESSION_TOKEN", process.env.AWS_SESSION_TOKEN ?? "");

    if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
      throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set together");
    }

    const clientConfiguration: AWS.S3.ClientConfiguration = {
      region,
      s3ForcePathStyle: forcePathStyle,
    };

    if (endpoint) {
      clientConfiguration.endpoint = endpoint;
    }

    if (accessKeyId && secretAccessKey) {
      clientConfiguration.credentials = {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      };
    }

    this.storageClient = new AWS.S3(clientConfiguration);
    this.publicBaseUrl = this.resolvePublicBaseUrl(region, endpoint, forcePathStyle);
  }

  /**
   * Resolves base URL used by external render services to access uploaded objects.
   *
   * @param region S3 region.
   * @param endpoint Custom S3 endpoint.
   * @param forcePathStyle Whether path-style URLs are used.
   * @returns Public base URL without trailing slash.
   */
  private resolvePublicBaseUrl(region: string, endpoint: string, forcePathStyle: boolean): string {
    const explicitPublicBaseUrl = readOptionalEnv("S3_PUBLIC_BASE_URL");
    if (explicitPublicBaseUrl) {
      return explicitPublicBaseUrl.replace(/\/$/, "");
    }

    if (!endpoint) {
      return `https://${this.bucketName}.s3.${region}.amazonaws.com`;
    }

    const endpointWithProtocol =
      endpoint.startsWith("http://") || endpoint.startsWith("https://") ? endpoint : `https://${endpoint}`;
    const normalizedEndpoint = endpointWithProtocol.replace(/\/$/, "");

    if (forcePathStyle) {
      return `${normalizedEndpoint}/${this.bucketName}`;
    }

    const endpointUrl = new URL(normalizedEndpoint);
    const normalizedPath = endpointUrl.pathname.replace(/\/$/, "");

    if (normalizedPath) {
      return `${endpointUrl.origin}${normalizedPath}/${this.bucketName}`;
    }

    return `${endpointUrl.protocol}//${this.bucketName}.${endpointUrl.host}`;
  }

  /**
   * Uploads a local file to the configured S3 bucket.
   *
   * @param localPath Local source file path.
   * @param objectKey Remote object key in the bucket.
   * @returns Promise resolved when upload is complete.
   */
  private async uploadFile(localPath: string, objectKey: string): Promise<void> {
    await this.storageClient
      .upload({
        Bucket: this.bucketName,
        Key: objectKey,
        Body: createReadStream(localPath),
      })
      .promise();
  }

  /**
   * Uploads source assets required by the render service and returns public base URL.
   *
   * @param params Upload payload with workspace paths and languages.
   * @returns Public base URL for uploaded asset directory.
   */
  public async uploadVideoAssets(params: UploadAssetsParams): Promise<string> {
    const { workspace, languages, backgroundMusicFileName } = params;
    const objectPrefix = `${workspace.videoId}/`;

    if (backgroundMusicFileName) {
      await this.uploadFile(
        path.resolve(appPaths.musicRootDir, "mp3s", backgroundMusicFileName),
        `${objectPrefix}background.mp3`,
      );
    }

    await this.uploadFile(workspace.sourceVideoPath, `${objectPrefix}video.mp4`);

    for (const language of languages) {
      const voiceoverPath = workspace.voiceoverPath(language);
      await this.uploadFile(voiceoverPath, `${objectPrefix}${path.basename(voiceoverPath)}`);
    }

    return `${this.publicBaseUrl}/${workspace.videoId}`;
  }
}
