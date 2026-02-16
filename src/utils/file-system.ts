import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Checks whether a file or directory exists.
 *
 * @param filePath Path to test.
 * @returns `true` when path is accessible, otherwise `false`.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a directory recursively when needed.
 *
 * @param directoryPath Directory path to ensure.
 * @returns Promise resolved when directory exists.
 */
export async function ensureDirectory(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, { recursive: true });
}

/**
 * Ensures that the parent directory for a file path exists.
 *
 * @param filePath File path whose directory should be created.
 * @returns Promise resolved when the directory exists.
 */
export async function ensureDirectoryForFile(filePath: string): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
}

/**
 * Reads UTF-8 text from a file.
 *
 * @param filePath Path to the text file.
 * @returns File content as a string.
 */
export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

/**
 * Writes UTF-8 text to a file, creating parent directories if needed.
 *
 * @param filePath Destination file path.
 * @param content Text content to write.
 * @returns Promise resolved after file is written.
 */
export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await ensureDirectoryForFile(filePath);
  await writeFile(filePath, content, "utf8");
}

/**
 * Reads and parses a JSON file.
 *
 * @param filePath Path to the JSON file.
 * @returns Parsed JSON payload.
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const fileContent = await readTextFile(filePath);
  return JSON.parse(fileContent) as T;
}

/**
 * Serializes a payload to formatted JSON and writes it to disk.
 *
 * @param filePath Destination JSON file path.
 * @param payload Value to serialize.
 * @returns Promise resolved after file is written.
 */
export async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  await writeTextFile(filePath, content);
}
