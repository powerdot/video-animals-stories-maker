import OpenAIImport from "openai";

interface OpenAIClientLike {
  responses: {
    create: (params: unknown) => Promise<{ output_text?: string }>;
  };
}

interface OpenAIConstructor {
  new (options: { apiKey: string }): OpenAIClientLike;
}

/**
 * Creates a compatibility-safe OpenAI client instance that supports Responses API.
 *
 * @param apiKey OpenAI API key.
 * @returns Initialized OpenAI client wrapper.
 */
export function createOpenAIClient(apiKey: string): OpenAIClientLike {
  const moduleRef = OpenAIImport as unknown as {
    default?: unknown;
  };

  const constructorCandidate =
    (typeof moduleRef.default === "function" ? moduleRef.default : undefined) ??
    (typeof OpenAIImport === "function" ? OpenAIImport : undefined);

  if (!constructorCandidate) {
    throw new Error(
      "Incompatible OpenAI SDK detected. Install openai@^5 to use Responses API.",
    );
  }

  return new (constructorCandidate as OpenAIConstructor)({ apiKey });
}
