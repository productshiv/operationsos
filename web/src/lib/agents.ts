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

/** Agents that are live in the app, keyed by desk id. Others are roadmap for now. */
export const AGENTS: Record<string, AgentConfig> = {
  analyst: dataAnalyst,
};
