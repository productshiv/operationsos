/** The Supabase project the business lives in (the agent must not wander to other projects). */
export const WEATHERAPI_PROJECT_REF = 'mgtwzdwalrvisiqnmwhc';

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  /** Inline TrueForge AgentSpec passed when opening a session. */
  spec: Record<string, unknown>;
  suggestions: string[];
}

const dataAnalyst: AgentConfig = {
  id: 'analyst',
  name: 'Analyst',
  role: 'Data Analyst',
  spec: {
    model: { name: 'openrouter/minimax-m3' },
    instructions: [
      'You are the Data Analyst for a business whose operational data is in Supabase.',
      'You do NOT know the schema in advance. First discover it — call list_tables (or SELECT from information_schema.tables / information_schema.columns via execute_sql) to learn the real tables and columns — then write read-only SQL to answer. SELECT only; never INSERT, UPDATE, DELETE, or run DDL.',
      `The business's Supabase project ref is ${WEATHERAPI_PROJECT_REF} (name: WeatherAPI). Always pass it as project_id to the supabase tools; never use another project.`,
      'Answer concisely: lead with the key number, then one line of context. For trends, describe the shape (up/down/flat and rough magnitude). Money is stored in cents.',
    ].join(' '),
    // camelCase per the SDK AgentSpec; preload exposes the tools directly (not the deferred
    // call_tool wrapper) so the model calls execute_sql with its real schema.
    mcpServers: [
      {
        name: 'supabase',
        enableTools: ['execute_sql', 'list_tables', 'list_projects', 'get_project'],
        preload: true,
      },
    ],
    config: { iterationLimit: 25 },
  },
  suggestions: [
    'How many customers do we have, and what is our MRR?',
    'Which account looks like it is churning?',
    'Any incident in the last week?',
  ],
};

const support: AgentConfig = {
  id: 'medic',
  name: 'Medic',
  role: 'Support',
  spec: {
    model: { name: 'openrouter/minimax-m3' },
    instructions: [
      'You are the Support agent for a Weather API company. Ticketing is Jira — use the jira tools (discover their fields if unsure).',
      'Help summarise open tickets, spot what customers are hitting, and draft replies.',
      'Creating or updating a Jira issue is irreversible and will pause for the CEO to authorise — propose it clearly (summary + description) and only after they approve does it get created.',
      'Be concise.',
    ].join(' '),
    mcpServers: [{ name: 'jira', preload: true }],
    config: { iterationLimit: 25 },
  },
  suggestions: [
    'Summarise our open tickets',
    'Draft a ticket for the /v1/forecast incident',
    'What are customers running into?',
  ],
};

const incident: AgentConfig = {
  id: 'watch',
  name: 'Watch',
  role: 'Incident',
  spec: {
    model: { name: 'openrouter/minimax-m3' },
    instructions: [
      'You are the Incident agent for a Weather API company. The error data is in Supabase.',
      'Discover the schema (list_tables / information_schema) then run read-only SELECT only — never modify data.',
      `The Supabase project ref is ${WEATHERAPI_PROJECT_REF} (WeatherAPI); always pass it as project_id.`,
      'Watch for error spikes by endpoint and day, quantify them (events, affected customers), and name the likely cause. Lead with the key number.',
    ].join(' '),
    mcpServers: [
      { name: 'supabase', enableTools: ['execute_sql', 'list_tables', 'list_projects', 'get_project'], preload: true },
    ],
    config: { iterationLimit: 25 },
  },
  suggestions: [
    'Any incident in the last week?',
    'Which endpoint is erroring most?',
    'How many customers did the last spike hit?',
  ],
};

const research: AgentConfig = {
  id: 'scout',
  name: 'Scout',
  role: 'Research',
  spec: {
    model: { name: 'openrouter/minimax-m3' },
    instructions: [
      'You are the Research agent. Use the exa web tools to research companies, markets, and topics, and bring back a short, sourced summary.',
      'Be concise and cite your sources (URLs).',
    ].join(' '),
    mcpServers: [{ name: 'exa', preload: true }],
    config: { iterationLimit: 25 },
  },
  suggestions: [
    'Research a company by name',
    'What does the weather-API market look like?',
    'Find recent news on a competitor',
  ],
};

/** Agents that are live in the app, keyed by desk id. Others are roadmap for now. */
export const AGENTS: Record<string, AgentConfig> = {
  analyst: dataAnalyst,
  medic: support,
  watch: incident,
  scout: research,
};
