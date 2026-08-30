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

/** One model within a provider, with its upstream id. */
export interface ProviderModel {
  name: string;
  modelId: string;
  properties?: Record<string, unknown>;
}

/** A configured provider, with enough to display and (for custom ones) edit it. */
export interface ProviderConfig {
  /** Display + reference name — the custom name, or the well-known type. */
  name: string;
  /** Manifest type (`openai`, `anthropic`, `custom`, …). */
  type: string;
  /** Custom providers are user-defined (base URL + models) and therefore editable. */
  isCustom: boolean;
  /** Base URL (custom providers, and well-known overrides). */
  baseUrl?: string;
  /** The stored API key, redacted — re-send it on an update to keep the key without re-entering it. */
  apiKeyRedacted?: string;
  models: ProviderModel[];
}

/** The providers configured on the harness, grouped (unlike {@link listModels}, which flattens). */
export async function listProviders(): Promise<ProviderConfig[]> {
  const resp = await trueforgeControl.settings.modelProviders.list();
  return (resp.data ?? []).map((p) => {
    const m = p.manifest as {
      type: string;
      name?: string;
      baseUrl?: string;
      auth?: { apiKey?: string };
      models?: Array<{ name: string; modelId: string; properties?: Record<string, unknown> }>;
    };
    const isCustom = m.type === 'custom';
    return {
      name: m.name ?? m.type,
      type: m.type,
      isCustom,
      baseUrl: m.baseUrl,
      apiKeyRedacted: m.auth?.apiKey,
      models: (m.models ?? []).map((x) => ({ name: x.name, modelId: x.modelId, properties: x.properties })),
    };
  });
}

/* --------------------------------- Presets --------------------------------- */

/** A well-known provider offered by the harness catalog — the user only supplies an API key. */
export interface CatalogProvider {
  /** Manifest type (`openai`, `anthropic`, `google-gemini`, …). */
  type: string;
  logo?: string;
  /** Preset models the provider ships with — created as-is. */
  models: ProviderModel[];
}

/** The harness's catalog of well-known model providers (excludes the `custom` marker). */
export async function listProviderCatalog(): Promise<CatalogProvider[]> {
  const resp = await trueforgeControl.catalogs.modelProviders.list();
  const items = (resp.data ?? []) as unknown as Array<{
    type: string;
    logo?: string;
    models?: Array<{ name: string; modelId: string; properties?: Record<string, unknown> }>;
  }>;
  return items
    .filter((p) => p.type !== 'custom')
    .map((p) => ({
      type: p.type,
      logo: p.logo,
      models: (p.models ?? []).map((m) => ({ name: m.name, modelId: m.modelId, properties: m.properties })),
    }));
}

/**
 * Built-in presets for OpenAI-compatible gateways that aren't in the well-known catalog. Base URL and
 * a sensible default model are prefilled, so the user only supplies a key (and can tweak the model).
 */
export interface CustomPreset {
  /** Provider name / reference prefix. */
  name: string;
  label: string;
  baseUrl: string;
  model: ProviderModel;
}
export const CUSTOM_PRESETS: CustomPreset[] = [
  {
    name: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: {
      name: 'minimax-m3',
      modelId: 'minimax/minimax-m3',
      properties: { max_output_tokens: 16000, reasoning_efforts: ['medium'] },
    },
  },
  {
    name: 'gmicloud',
    label: 'GMI Cloud',
    baseUrl: 'https://api.gmi-serving.com/v1',
    model: {
      name: 'minimax-m3',
      modelId: 'MiniMaxAI/MiniMax-M3',
      properties: { max_output_tokens: 16000, reasoning_efforts: ['medium'] },
    },
  },
];

/* --------------------------------- Create ---------------------------------- */

/** Add/update a well-known provider (openai, anthropic, …) — the user supplies only an API key. */
export async function addWellKnownProvider(type: string, apiKey: string, models: ProviderModel[]): Promise<void> {
  await trueforgeControl.settings.modelProviders.createOrUpdate({
    manifest: {
      type,
      auth: { apiKey },
      models: models.map((m) => ({ modelId: m.modelId, name: m.name, properties: m.properties ?? {} })),
    },
  } as never);
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
  /** Optional model properties (limits, reasoning efforts). */
  properties?: Record<string, unknown>;
}

/**
 * Add or update a Custom (OpenAI-compatible) model provider on the harness — the shape OpenRouter and
 * most hosted gateways use. Once saved, agents can reference `<name>/<modelName>`. Uses upsert
 * (createOrUpdate), so re-saving with the same provider name **corrects** an existing one — e.g. to
 * fix a wrong base URL or model id that was returning 404s, which is also how "Edit" works. The API
 * key is stored server-side on the harness (redacted in every read-back).
 */
export async function createCustomProvider(input: CustomProviderInput): Promise<void> {
  await trueforgeControl.settings.modelProviders.createOrUpdate({
    manifest: {
      type: 'custom',
      name: input.name,
      baseUrl: input.baseUrl,
      auth: { apiKey: input.apiKey },
      models: [{ modelId: input.modelId, name: input.modelName, properties: input.properties ?? {} }],
    },
  });
}
