/** The Supabase project the business lives in (the agent must not wander to other projects). */
export const WEATHERAPI_PROJECT_REF = 'mgtwzdwalrvisiqnmwhc';

/**
 * The model every agent runs on, as `<provider>/<model>`. Single source of truth: agent specs
 * reference it, and platform-readiness checks confirm this exact model is configured on the harness
 * (a differently named provider does not make agents runnable).
 */
export const AGENT_MODEL = 'openrouter/minimax-m3';

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  /** One-line empty-state description shown before the first message. */
  blurb: string;
  /** Inline TrueForge AgentSpec passed when opening a session. */
  spec: Record<string, unknown>;
  suggestions: string[];
  /**
   * One-click follow-ups offered once the agent has replied. Each sends its `prompt` as the next
   * message — typically an action (e.g. open a ticket) that runs a write tool and so pauses at the
   * approval gate before anything is pushed.
   */
  quickActions?: { label: string; prompt: string }[];
}

/** Data Analyst — reads the business database. Supabase only, so it never depends on other tools. */
const dataAnalyst: AgentConfig = {
  id: 'analyst',
  name: 'Analyst',
  role: 'Data Analyst',
  blurb: 'Ask about customers, revenue, usage, or churn. I discover the schema and query it — and pause for your sign-off before any query runs.',
  spec: {
    model: { name: AGENT_MODEL },
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
    'How has usage trended this month?',
  ],
};

/** Market Research — researches companies, markets, and competitors on the web. */
const research: AgentConfig = {
  id: 'scout',
  name: 'Scout',
  role: 'Market Research',
  blurb: 'Ask me to research a company, market, or competitor. I search the web and bring back a short, sourced summary.',
  spec: {
    model: { name: AGENT_MODEL },
    instructions: [
      'You are the Market Research agent. Use the exa web tools to research companies, markets, and competitors, and bring back a short, sourced summary.',
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

/** Support Desk — reads Jira and, on the CEO's sign-off, opens or updates tickets. */
const support: AgentConfig = {
  id: 'medic',
  name: 'Support',
  role: 'Support Desk',
  blurb: 'Ask about support tickets — I read Jira and summarise what customers are hitting. On your sign-off I can open or update a ticket.',
  spec: {
    model: { name: AGENT_MODEL },
    instructions: [
      'You are the Support agent for a Weather API company. Ticketing is Jira — use the atlassian/Jira tools (discover their fields if unsure).',
      'Help summarise open tickets, spot what customers are hitting, and draft replies.',
      'When asked to open or file a ticket, draft it (a clear summary and a description) and then call the Jira create tool directly in that turn. The harness automatically pauses for the CEO to authorise before the issue is created, so create it rather than asking permission again in text.',
      'Be concise.',
    ].join(' '),
    mcpServers: [{ name: 'atlassian', preload: true }],
    config: { iterationLimit: 25 },
  },
  suggestions: [
    'Summarise our open tickets',
    'What are customers running into?',
    'Draft a ticket for the /v1/forecast incident',
  ],
  quickActions: [
    {
      label: 'Open a ticket',
      prompt:
        'Open a Jira ticket for the issue in our conversation. Give it a clear summary and a description with the details and the recommended fix.',
    },
  ],
};

/** Incident Response — watches error spikes and quantifies incidents (read-only). */
const incident: AgentConfig = {
  id: 'watch',
  name: 'Watch',
  role: 'Incident Response',
  blurb: 'Ask about errors and incidents. I read the error data (read-only), quantify what is happening, and name the likely cause.',
  spec: {
    model: { name: AGENT_MODEL },
    instructions: [
      'You are the Incident Response agent for a Weather API company. The error data is in Supabase.',
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

/**
 * Ops Coordinator — turns a situation into a routed plan. It has no MCP connector of its own (so it
 * always runs) and it does not execute the work: it breaks a request into ordered steps and routes
 * each to the specialist who actually has the tools. It deliberately does NOT spawn sub-agents,
 * because dynamically created children inherit this agent's (empty) toolset and so couldn't act.
 */
const coordinator: AgentConfig = {
  id: 'handler',
  name: 'Handler',
  role: 'Ops Coordinator',
  blurb: 'Hand me a situation and I turn it into a plan — which specialist to ask for each step, and in what order. I route the work; the specialists run it.',
  spec: {
    model: { name: AGENT_MODEL },
    instructions: [
      'You are the Ops Coordinator. You do NOT have direct access to the database, the web, or Jira — the specialists do, and you route work to them.',
      'When the CEO hands you a situation, break it into a clear, ordered plan and assign each step to the right specialist by name: the Data Analyst (business numbers from the database), Market Research (companies, markets, and competitors on the web), Support (read or file Jira tickets), and Incident Response (error spikes and incidents). For each step, say what to ask that specialist and why.',
      'Do NOT invent data, results, or ticket ids, and do not claim to have run anything yourself — you plan and route; the specialists execute. Be concise and structured.',
    ].join(' '),
    config: { iterationLimit: 25 },
  },
  suggestions: [
    'Plan a save for our biggest at-risk account',
    'How should we investigate the latest incident?',
    'Map out how we research and enter a new market',
  ],
};

/** Agents that are live in the app, keyed by desk id. */
export const AGENTS: Record<string, AgentConfig> = {
  analyst: dataAnalyst,
  scout: research,
  medic: support,
  watch: incident,
  handler: coordinator,
};
