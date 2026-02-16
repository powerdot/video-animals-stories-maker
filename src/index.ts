import "dotenv/config";

import { pipelineDefaults } from "./config/environment";
import type { Language, PipelineOptions } from "./types/pipeline";
import { VideoPipeline } from "./workflows/video-pipeline";

interface CliArguments {
  videos?: string;
  languages?: string;
}

/**
 * Parses CLI arguments in the `--key value` format.
 *
 * @param rawArguments Raw process arguments without the node executable and script path.
 * @returns A map with known CLI argument values.
 */
function parseCliArguments(rawArguments: string[]): CliArguments {
  const argumentsMap: CliArguments = {};

  for (let index = 0; index < rawArguments.length; index += 1) {
    const value = rawArguments[index];
    if (!value || !value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2) as keyof CliArguments;
    const nextValue = rawArguments[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      continue;
    }

    argumentsMap[key] = nextValue;
    index += 1;
  }

  return argumentsMap;
}

/**
 * Splits a comma-separated CLI value into trimmed entries.
 *
 * @param value Raw comma-separated string.
 * @returns A list of non-empty values.
 */
function parseCsvList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Builds pipeline options by merging CLI arguments with defaults from environment.
 *
 * @param cliArguments Parsed CLI arguments.
 * @returns Fully resolved pipeline options.
 */
function buildPipelineOptions(cliArguments: CliArguments): PipelineOptions {
  const videos = parseCsvList(cliArguments.videos);
  const languages = parseCsvList(cliArguments.languages).map((item) => item.toUpperCase() as Language);

  const resolvedVideos = videos.length > 0 ? videos : pipelineDefaults.videos;
  const resolvedLanguages =
    languages.length > 0
      ? languages
      : pipelineDefaults.languages.length > 0
        ? (pipelineDefaults.languages as Language[])
        : (["RUSSIAN"] as Language[]);

  if (resolvedVideos.length === 0) {
    throw new Error(
      "No videos specified. Pass --videos video_1,video_2 or set DEFAULT_VIDEOS in .env",
    );
  }

  return {
    videoIds: resolvedVideos,
    languages: resolvedLanguages,
  };
}

/**
 * Entry point for pipeline execution.
 *
 * @returns Promise that resolves when all videos are processed.
 */
async function main(): Promise<void> {
  const cliArguments = parseCliArguments(process.argv.slice(2));
  const options = buildPipelineOptions(cliArguments);

  const pipeline = new VideoPipeline();
  await pipeline.run(options);
}

main().catch((error) => {
  console.error("[pipeline] Fatal error:", error);
  process.exitCode = 1;
});
