import { spawn } from "node:child_process";
import { rename, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Runs a child process and collects stdout/stderr output.
 *
 * @param command Executable to run.
 * @param args Command arguments.
 * @returns Process output streams.
 */
function runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const processRef = spawn(command, args);

    let stdout = "";
    let stderr = "";

    processRef.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    processRef.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    processRef.on("error", (error) => reject(error));

    processRef.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with code ${exitCode}: ${stderr}`));
      }
    });
  });
}

/**
 * Reads media duration in seconds using `ffprobe`.
 *
 * @param filePath Media file path.
 * @returns Duration in seconds.
 */
export async function getMediaDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await runProcess("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration)) {
    throw new Error(`Unable to parse media duration: ${filePath}`);
  }

  return duration;
}

/**
 * Reads audio sample rate from the first audio stream using `ffprobe`.
 *
 * @param filePath Audio or video file path.
 * @returns Audio sample rate in hertz.
 */
export async function getAudioSampleRate(filePath: string): Promise<number> {
  const { stdout } = await runProcess("ffprobe", [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_streams",
    "-select_streams",
    "a",
    filePath,
  ]);

  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ sample_rate?: string }>;
  };

  const firstStream = parsed.streams?.[0];
  if (!firstStream?.sample_rate) {
    throw new Error(`Audio sample_rate was not found: ${filePath}`);
  }

  const sampleRate = Number.parseInt(firstStream.sample_rate, 10);
  if (!Number.isFinite(sampleRate)) {
    throw new Error(`Audio sample_rate is invalid: ${filePath}`);
  }

  return sampleRate;
}

/**
 * Resamples audio in-place when file sample rate differs from the target rate.
 *
 * @param filePath Audio/video file path to resample.
 * @param targetRate Target sample rate in hertz.
 * @returns Final file path.
 */
export async function resampleAudioIfNeeded(filePath: string, targetRate = 44_100): Promise<string> {
  const sampleRate = await getAudioSampleRate(filePath);
  if (sampleRate === targetRate) {
    return filePath;
  }

  const { dir, name, ext } = path.parse(filePath);
  const temporaryOutputPath = path.resolve(dir, `${name}_resampled_${targetRate}${ext}`);

  await runProcess("ffmpeg", [
    "-i",
    filePath,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-ar",
    String(targetRate),
    "-y",
    temporaryOutputPath,
  ]);

  await unlink(filePath);
  await rename(temporaryOutputPath, filePath);

  return filePath;
}
