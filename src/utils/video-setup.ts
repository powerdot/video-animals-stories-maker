import { DEFAULT_VIDEO_SETUP } from "../config/defaults";
import type { VideoSetup } from "../types/pipeline";
import { fileExists, readJsonFile } from "./file-system";

/**
 * Loads video setup from disk and merges it with project defaults.
 *
 * @param setupPath Path to `setup.json`.
 * @returns Fully resolved video setup configuration.
 */
export async function loadVideoSetup(setupPath: string): Promise<VideoSetup> {
  if (!(await fileExists(setupPath))) {
    return {
      ...DEFAULT_VIDEO_SETUP,
      captions: { ...DEFAULT_VIDEO_SETUP.captions },
    };
  }

  const setup = await readJsonFile<Partial<VideoSetup>>(setupPath);

  return {
    ...DEFAULT_VIDEO_SETUP,
    ...setup,
    captions: {
      ...DEFAULT_VIDEO_SETUP.captions,
      ...(setup.captions ?? {}),
    },
  };
}
