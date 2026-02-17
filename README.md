# Video Animals Stories Maker

[Medium Article](https://medium.com/p/6041f87d4c8a)

![Project idea overview](docs/idea.png)

A TypeScript pipeline for automatic generation of vertical animal videos:
- voiceover script generation;
- title and description generation;
- multilingual voiceover synthesis;
- cloud video rendering;
- caption generation;
- artifact output into `input/<videoId>`.

## Key Features

- Fully typed runtime built with TypeScript.
- Modular architecture (`config`, `services`, `workflows`, `utils`, `domain`, `types`).
- Centralized environment-based configuration via `.env`.
- Multi-language processing in a single run.
- Idempotent workflow steps (existing artifacts are reused).

## Tech Stack

- Node.js 20+
- TypeScript
- OpenAI Responses API
- VoiceMaker API
- Zapcap API
- JSON2Video SDK
- S3-compatible Object Storage (AWS SDK)
- ffmpeg / ffprobe

## Project Structure

```text
src/
  config/
    defaults.ts
    environment.ts
  domain/
    video-workspace.ts
  services/
    caption.service.ts
    image-generation.service.ts
    media.service.ts
    music-selection.service.ts
    render.service.ts
    screenshot.service.ts
    storage.service.ts
    text-generation.service.ts
    voiceover.service.ts
  types/
    external-modules.d.ts
    pipeline.ts
  utils/
    file-system.ts
    http.ts
    openai-client.ts
    video-setup.ts
  workflows/
    video-pipeline.ts
  index.ts

input/       # input and generated artifacts per videoId
music/       # soundtrack files and selection metadata
```

## Requirements

- Node.js `>= 20`
- `ffmpeg` and `ffprobe` available in your PATH

Validation commands:

```bash
ffmpeg -version
ffprobe -version
node -v
```

## Installation

```bash
npm install
cp .env.example .env
```

Then populate `.env` with your real credentials.

## Environment Variables

Required for full pipeline execution:

- `OPENAI_API_KEY`
- `VOICE_MAKER_API_KEY`
- `JSON2VIDEO_API_KEY`
- `ZAPCAP_API_KEY`
- `ZAPCAP_TEMPLATE_ID`
- `S3_BUCKET`

Commonly used options:

- `DEFAULT_VIDEOS` - comma-separated list of `videoId`
- `DEFAULT_LANGUAGES` - comma-separated list of languages
- `INPUT_DIR` - input directory path (default: `input`)
- `MUSIC_DIR` - music directory path (default: `music`)
- `MUSIC_DESCRIPTIONS_PATH` - music descriptions file path
- `S3_REGION` - region (default: `us-east-1`)
- `S3_ENDPOINT` - custom S3 endpoint for non-AWS providers
- `S3_FORCE_PATH_STYLE` - force path-style URLs (`true`/`false`)
- `S3_PUBLIC_BASE_URL` - public URL prefix for uploaded objects
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_SESSION_TOKEN` - optional S3 credentials (if omitted, AWS default provider chain is used)

See `.env.example` for the full template.

## Input Data Format

Each `videoId` directory must contain:

```text
input/<videoId>/
  video.mp4
  originalText.txt
  setup.json            # optional
```

Example `setup.json`:

```json
{
  "videoVolume": 0.3,
  "backgroundMusic": true,
  "captions": {
    "enabled": false,
    "position": "bottom",
    "size": 16,
    "offset": 0.15
  }
}
```

## Run

Using explicit CLI arguments:

```bash
npm run dev -- --videos test,video_2 --languages RUSSIAN,ENGLISH
```

Using defaults from `.env`:

```bash
# .env
DEFAULT_VIDEOS=test,video_2
DEFAULT_LANGUAGES=RUSSIAN,ENGLISH

npm run dev
```

## Scripts

```bash
npm run dev        # run TypeScript pipeline without build
npm run typecheck  # TypeScript validation
npm run build      # compile to dist/
npm run start      # run compiled build
```

## Pipeline Flow

1. Extract a screenshot from `video.mp4`.
2. Generate voiceover texts, titles, and descriptions (`generatedTexts.json`).
3. If enabled, select background music (`selectedMusic.json`).
4. Generate `voiceover_<LANG>.mp3` for each language.
5. Upload source assets to S3-compatible object storage.
6. Render `rendered_<LANG>.mp4` via JSON2Video.
7. Generate `captioned_<LANG>.mp4` via Zapcap.
8. Print final summary in the console.

## Output Artifacts

Generated under `input/<videoId>/`:

- `screenshot.png`
- `generatedTexts.json`
- `selectedMusic.json` (if background music is enabled)
- `voiceover_<LANG>.mp3`
- `rendered_<LANG>.mp4`
- `captioned_<LANG>.mp4`

## Troubleshooting

- Render errors: verify `JSON2VIDEO_API_KEY` and public asset accessibility.
- Voiceover errors: verify `VOICE_MAKER_API_KEY` and language mapping.
- Caption errors: verify `ZAPCAP_API_KEY` and `ZAPCAP_TEMPLATE_ID`.
- Media processing errors: verify your local `ffmpeg` / `ffprobe` installation.
