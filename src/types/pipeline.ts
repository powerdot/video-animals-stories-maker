export type KnownLanguage =
  | "ENGLISH"
  | "SPANISH"
  | "RUSSIAN"
  | "FRENCH"
  | "GERMAN"
  | "ITALIAN"
  | "PORTUGUESE"
  | "UKRAINIAN"
  | "CHINESE";

export type Language = KnownLanguage | (string & {});

export interface CaptionSettings {
  enabled: boolean;
  position: "top" | "center" | "bottom";
  size: number;
  offset: number;
}

export interface VideoSetup {
  videoVolume: number;
  backgroundMusic: boolean;
  captions: CaptionSettings;
}

export type GeneratedTexts = Record<string, string>;

export interface SelectedMusic {
  mp3file: string;
}

export interface PipelineOptions {
  videoIds: string[];
  languages: Language[];
}
