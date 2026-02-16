import path from "node:path";

/**
 * Trims leading and trailing whitespace from environment values.
 *
 * @param value Raw environment variable value.
 * @returns Normalized string value.
 */
function normalize(value: string): string {
  return value.trim();
}

/**
 * Reads a required environment variable and throws if it is missing or empty.
 *
 * @param variableName Environment variable name.
 * @returns Normalized variable value.
 */
export function readRequiredEnv(variableName: string): string {
  const value = process.env[variableName];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${variableName}`);
  }

  return normalize(value);
}

/**
 * Reads an optional environment variable with a fallback value.
 *
 * @param variableName Environment variable name.
 * @param fallback Value returned when the variable is missing or empty.
 * @returns Normalized variable value or fallback.
 */
export function readOptionalEnv(variableName: string, fallback = ""): string {
  const value = process.env[variableName];
  if (!value || !value.trim()) {
    return fallback;
  }

  return normalize(value);
}

/**
 * Reads a comma-separated environment variable as a list.
 *
 * @param variableName Environment variable name.
 * @returns Trimmed non-empty entries.
 */
export function readCsvEnv(variableName: string): string[] {
  const value = readOptionalEnv(variableName);
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const projectRoot = process.cwd();

export const appPaths = {
  projectRoot,
  inputRootDir: path.resolve(projectRoot, readOptionalEnv("INPUT_DIR", "input")),
  musicRootDir: path.resolve(projectRoot, readOptionalEnv("MUSIC_DIR", "music")),
  musicDescriptionsPath: path.resolve(
    projectRoot,
    readOptionalEnv("MUSIC_DESCRIPTIONS_PATH", "music/descriptions.txt"),
  ),
};

export const pipelineDefaults = {
  videos: readCsvEnv("DEFAULT_VIDEOS"),
  languages: readCsvEnv("DEFAULT_LANGUAGES").map((item) => item.toUpperCase()),
};
