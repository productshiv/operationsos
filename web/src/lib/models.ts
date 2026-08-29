import { trueforgeControl } from './trueforge';

/**
 * A model configured on the harness, shown as `<provider>/<model>` — exactly how an AgentSpec
 * references it (e.g. `openrouter/minimax-m3`).
 */
export interface ModelRef {
  provider: string;
  model: string;
  /** Upstream id sent to the provider API (may differ from the local model name). */
  modelId: string;
}

/** The model providers configured on the harness, flattened to one entry per usable model. */
export async function listModels(): Promise<ModelRef[]> {
  const resp = await trueforgeControl.settings.modelProviders.list();
  const out: ModelRef[] = [];
  for (const provider of resp.data ?? []) {
    // Well-known providers (openai, anthropic, …) have no explicit name — the type is the name.
    const providerName = 'name' in provider.manifest ? provider.manifest.name : provider.manifest.type;
    for (const m of provider.manifest.models ?? []) {
      out.push({ provider: providerName, model: m.name, modelId: m.modelId });
    }
  }
  return out;
}

export interface CustomProviderInput {
  /** Provider name, used as the `<provider>` half of the model reference. */
  name: string;
  /** OpenAI-compatible base URL, e.g. https://openrouter.ai/api/v1 */
  baseUrl: string;
  apiKey: string;
  /** Local model name, the `<model>` half of the reference. */
  modelName: string;
  /** Upstream model id sent to the provider, e.g. minimax/minimax-m1 */
  modelId: string;
}

/**
 * Add a Custom (OpenAI-compatible) model provider to the harness — the shape OpenRouter and most
 * hosted gateways use. Once created, agents can reference `<name>/<modelName>`. The API key is
 * stored server-side on the harness (redacted in every read-back).
 */
export async function createCustomProvider(input: CustomProviderInput): Promise<void> {
  await trueforgeControl.settings.modelProviders.create({
    manifest: {
      type: 'custom',
      name: input.name,
      baseUrl: input.baseUrl,
      auth: { apiKey: input.apiKey },
      models: [{ modelId: input.modelId, name: input.modelName, properties: {} }],
    },
  });
}
