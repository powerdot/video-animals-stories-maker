import type { VideoSetup } from "../types/pipeline";

export const DEFAULT_VIDEO_SETUP: VideoSetup = {
  videoVolume: 0.3,
  backgroundMusic: false,
  captions: {
    enabled: false,
    position: "bottom",
    size: 16,
    offset: 0.15,
  },
};

export const DEFAULT_VIDEO_RESOLUTION = {
  width: 1080,
  height: 1920,
} as const;

export const DEFAULT_RENDER_QUALITY = "high";
