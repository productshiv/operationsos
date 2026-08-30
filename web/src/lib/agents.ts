import { connectorView, type Connector } from './connectors';

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
  /** Inline TrueForge AgentSpec passed when opening a session (Jira is added at runtime — see below). */
  spec: Record<string, unknown>;
  /**
   * How this agent wants the shared Jira connector, if one is present on the harness:
   * `'preload'` loads its tools eagerly (the Support Lead, whose whole job is tickets); `'defer'`
   * exposes them only when actually invoked (everyone else, so a ticket button never bloats normal
   * turns). See {@link buildAgentSpec}.
   */
  ticketing?: 'preload' | 'defer';
  suggestions: string[];
  /**
   * One-click follow-ups offered once the agent has replied. Each sends its `prompt` as the next
   * message — typically an action (e.g. open a ticket) that runs a write tool and so pauses at the
   * approval gate before anything is pushed. The "Open a ticket" action is only shown when a Jira
   * connector is actually available (see {@link buildAgentSpec}).
   */
  quickActions?: { label: string; prompt: string }[];
}

/**
 * Every agent can escalate a finding into a Jira ticket that the Operations Manager then coordinates.
 *
 * Jira is NOT hard-coded into the specs, because the harness rejects a turn that names an MCP server
 * it doesn't have — so a static `atlassian` (prod's name) or `jira` (another harness's name) in a
 * spec would break that agent's *normal* answers wherever the connector is absent or unauthorised.
 * That coupling is exactly what once made the Analyst go silent. Instead the live Jira connector is
 * resolved at runtime ({@link buildAgentSpec}) and injected only when it exists, and the "Open a
 * ticket" quick action is only offered then. Reliable everywhere, and the atlassian/jira name
 * difference across deployments is handled automatically.
 */
const TICKET_INSTRUCTION =
  'You can also escalate to a ticket. When asked to open or file one, draft a clear summary and description (include the finding and note that the Operations Manager should coordinate the follow-up), then call the Jira create tool directly — the harness pauses for the CEO to authorise before the issue is created, so create it rather than asking again in text.';
const OPEN_TICKET_ACTION = {
  label: 'Open a ticket',
  prompt:
    'Open a Jira ticket for what we discussed. Give it a clear summary and a description with the key details and next steps, and note that the Operations Manager should coordinate the follow-up.',
};

/** Data Analyst — reads the business database, and can escalate a finding into a Jira ticket. */
const dataAnalyst: AgentConfig = {
  id: 'analyst',
  name: 'Data Analyst',
  role: 'business database',
  blurb: 'Ask about customers, revenue, usage, or churn. I discover the schema and query it — and pause for your sign-off before any query runs.',
  spec: {
    model: { name: AGENT_MODEL },
    instructions: [
      'You are the Data Analyst for a business whose operational data is in Supabase.',
      'You do NOT know the schema in advance. First discover it — call list_tables (or SELECT from information_schema.tables / information_schema.columns via execute_sql) to learn the real tables and columns — then write read-only SQL to answer. SELECT only; never INSERT, UPDATE, DELETE, or run DDL.',
      `The business's Supabase project ref is ${WEATHERAPI_PROJECT_REF} (name: WeatherAPI). Always pass it as project_id to the supabase tools; never use another project.`,
      'Answer concisely: lead with the key number, then one line of context. For trends, describe the shape (up/down/flat and rough magnitude). Money is stored in cents.',
      TICKET_INSTRUCTION,
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
  ticketing: 'defer',
  suggestions: [
    'How many customers do we have, and what is our MRR?',
    'Which account looks like it is churning?',
    'How has usage trended this month?',
  ],
  quickActions: [OPEN_TICKET_ACTION],
};

/** Market Research — researches companies, markets, and competitors on the web. */
const research: AgentConfig = {
  id: 'scout',
  name: 'Market Research',
  role: 'web research',
  blurb: 'Ask me to research a company, market, or competitor. I search the web and bring back a short, sourced summary.',
  spec: {
    model: { name: AGENT_MODEL },
    instructions: [
      'You are the Market Research agent. Use the exa web tools to research companies, markets, and competitors, and bring back a short, sourced summary.',
      'Be concise and cite your sources (URLs).',
      TICKET_INSTRUCTION,
    ].join(' '),
    mcpServers: [{ name: 'exa', preload: true }],
    config: { iterationLimit: 25 },
  },
  ticketing: 'defer',
  suggestions: [
    'Research a company by name',
    'What does the weather-API market look like?',
    'Find recent news on a competitor',
  ],
  quickActions: [OPEN_TICKET_ACTION],
};

/** Support Desk — reads Jira and, on the CEO's sign-off, opens or updates tickets. */
const support: AgentConfig = {
  id: 'medic',
  name: 'Support Lead',
  role: 'Jira tickets',
  blurb: 'Ask about support tickets — I read Jira and summarise what customers are hitting. On your sign-off I can open or update a ticket.',
  spec: {
    model: { name: AGENT_MODEL },
    instructions: [
      'You are the Support Lead for a Weather API company. Ticketing is Jira — use the Jira tools (discover their fields if unsure).',
      'Inbound customer complaints arrive in the business database, in public.oos_support_complaints (ts, customer_id, channel, subject, body, severity, status; status is open/triaged/closed). Read them with SELECT — discover the schema first (list_tables / information_schema) and never modify data.',
      `The Supabase project ref is ${WEATHERAPI_PROJECT_REF} (WeatherAPI); always pass it as project_id.`,
      'When asked to triage: pull the open complaints newest first, group them by what is actually going wrong, say which are urgent and why (severity, how many customers, whether it is billing or an outage), and draft the reply you would send. Join to public.oos_customers for who they are and what plan they are on, so the reply fits the account.',
      'Help summarise open tickets, spot what customers are hitting, and draft replies.',
      'When asked to open or file a ticket, draft it (a clear summary and a description) and then call the Jira create tool directly in that turn. The harness automatically pauses for the CEO to authorise before the issue is created, so create it rather than asking permission again in text.',
      'Be concise.',
    ].join(' '),
    // Jira is this agent's whole job, so it's preloaded (added at runtime by buildAgentSpec).
    // Supabase too, read-only: complaints land in the business database, and a support agent that
    // can't see its own inbox can only ever talk about tickets someone else already filed.
    mcpServers: [
      { name: 'supabase', enableTools: ['execute_sql', 'list_tables', 'list_projects', 'get_project'], preload: true },
    ],
    config: { iterationLimit: 25 },
  },
  ticketing: 'preload',
  suggestions: [
    'Triage the open complaints',
    'What are customers running into?',
    'Draft a reply for the newest high-severity complaint',
  ],
  quickActions: [
    {
      label: 'Triage complaints',
      prompt:
        'Pull the open rows from public.oos_support_complaints (newest first), group them by what is actually going wrong, tell me which need action first and why, and draft the reply for the most urgent one.',
    },
    OPEN_TICKET_ACTION,
  ],
};

/** Incident Response — watches error spikes and quantifies incidents (read-only). */
const incident: AgentConfig = {
  id: 'watch',
  name: 'Incident Response',
  role: 'error monitoring',
  blurb: 'Ask about errors and incidents. I read the error data (read-only), quantify what is happening, and name the likely cause.',
  spec: {
    model: { name: AGENT_MODEL },
    instructions: [
      'You are the Incident Response agent for a Weather API company. The error data is in Supabase.',
      'Discover the schema (list_tables / information_schema) then run read-only SELECT only — never modify data.',
      `The Supabase project ref is ${WEATHERAPI_PROJECT_REF} (WeatherAPI); always pass it as project_id.`,
      'Watch for error spikes by endpoint and day, quantify them (events, affected customers), and name the likely cause. Lead with the key number.',
      'Then prepare the response, do not stop at the diagnosis. For 429 / rate-limit spikes: look up the affected customers in public.oos_customers and their limits in public.oos_pricing, and say plainly whether this is a customer calling wrongly (recommend the correct pattern — caching, backoff, batching, the right endpoint) or a customer who has genuinely outgrown their plan (recommend the upgrade, with the tier and price). For 5xx spikes: say what is failing, who it hit, and what we tell them while we fix it. Draft the customer-facing message, ready to send.',
      TICKET_INSTRUCTION,
    ].join(' '),
    mcpServers: [
      { name: 'supabase', enableTools: ['execute_sql', 'list_tables', 'list_projects', 'get_project'], preload: true },
    ],
    config: { iterationLimit: 25 },
  },
  ticketing: 'defer',
  suggestions: [
    'Any incident in the last week?',
    'Who is hitting rate limits, and should they upgrade?',
    'Draft what we tell customers about the latest spike',
  ],
  quickActions: [
    {
      label: 'Prepare the response',
      prompt:
        'Find the latest error spike in public.oos_error_events. Quantify it, name the likely cause, and prepare what we send the affected customers — for 429s say whether each should change how they call us or upgrade (name the tier and price from public.oos_pricing), and draft the message.',
    },
    OPEN_TICKET_ACTION,
  ],
};

/**
 * Operations Manager — turns a situation into a routed plan. It doesn't execute the specialists' work
 * (its only tool is the deferred Jira escalation, so its plans never depend on data/web connectors and
 * it always runs): it breaks a request into ordered steps and routes each to the specialist who holds
 * the tools, and can file a Jira ticket to track the plan. It deliberately does NOT spawn sub-agents,
 * because dynamically created children inherit this agent's toolset and couldn't do the specialists'
 * work. Jira is added at runtime by {@link buildAgentSpec}, so it has no connector of its own here.
 */
const coordinator: AgentConfig = {
  id: 'handler',
  name: 'Operations Manager',
  role: 'planning & routing',
  blurb: 'Hand me a situation and I turn it into a plan — which specialist to ask for each step, and in what order. I route the work; the specialists run it.',
  spec: {
    model: { name: AGENT_MODEL },
    instructions: [
      'You are the Operations Manager. You do NOT have direct access to the database or the web — the specialists do, and you route work to them.',
      'When the CEO hands you a situation, break it into a clear, ordered plan and assign each step to the right specialist by name: the Data Analyst (business numbers from the database), Market Research (companies, markets, and competitors on the web), the Support Lead (read or file Jira tickets), and Incident Response (error spikes and incidents). For each step, say what to ask that specialist and why.',
      'You can open a Jira ticket yourself to track the plan and coordinate the follow-up: draft a clear summary and description (the objective and the routed steps), then call the Jira create tool directly — the harness pauses for the CEO to authorise before it is created.',
      'Do NOT invent data, results, or ticket ids, and do not claim to have run the specialists’ work yourself — you plan, route, and track. Be concise and structured.',
    ].join(' '),
    mcpServers: [],
    config: { iterationLimit: 25 },
  },
  ticketing: 'defer',
  suggestions: [
    'Plan a save for our biggest at-risk account',
    'How should we investigate the latest incident?',
    'Map out how we research and enter a new market',
  ],
  quickActions: [OPEN_TICKET_ACTION],
};

/** Agents that are live in the app, keyed by desk id. */
export const AGENTS: Record<string, AgentConfig> = {
  analyst: dataAnalyst,
  scout: research,
  medic: support,
  watch: incident,
  handler: coordinator,
};

/** The Atlassian/Jira MCP endpoint — the same URL however a deployment named the connector. */
const JIRA_MCP_URL = 'https://mcp.atlassian.com/v1/mcp';

/**
 * Find the live Jira connector on the harness, if any — matched by its Atlassian MCP URL so it works
 * whether the deployment named it `atlassian` or `jira`, and skipping any connector hidden as a dead
 * duplicate ({@link connectorView}). Prefers an authenticated one, but falls back to an unauthenticated
 * Jira connector so the ticket flow still appears and routes through the chat's connector fix-it card.
 * Returns the connector name, or null if the harness has no Jira connector at all.
 */
export function resolveJiraConnector(list: Connector[]): string | null {
  const view = connectorView(list);
  const jira = list.filter((c) => c.url === JIRA_MCP_URL && !view.hidden.has(c.name));
  if (jira.length === 0) return null;
  return (jira.find((c) => c.status === 'authenticated') ?? jira[0]).name;
}

/**
 * The spec actually sent to the harness: the agent's static (Jira-free) spec plus the resolved Jira
 * connector, injected only when one is present and the agent opts in via `ticketing`. Keeping Jira
 * out of the static spec is deliberate — the harness fails any turn that names a server it doesn't
 * have, so injecting only when it exists keeps every agent's normal answers reliable. See the note
 * on {@link TICKET_INSTRUCTION}.
 */
export function buildAgentSpec(
  agent: AgentConfig,
  jiraName: string | null,
  model?: string,
): Record<string, unknown> {
  const spec: Record<string, unknown> = { ...agent.spec };
  // Run on the CEO's chosen default model (falls back to the spec's own AGENT_MODEL).
  if (model) spec.model = { name: model };
  // Attach the resolved Jira connector when present and the agent opts in.
  if (agent.ticketing && jiraName) {
    const servers = Array.isArray(agent.spec.mcpServers) ? [...(agent.spec.mcpServers as unknown[])] : [];
    servers.push({ name: jiraName, preload: agent.ticketing === 'preload' });
    spec.mcpServers = servers;
  }
  return spec;
}
