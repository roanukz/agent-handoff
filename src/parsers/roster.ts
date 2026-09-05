/**
 * A roster names the tools each agent declares. The event stream never does,
 * and the routing check cannot say "went to an agent whose tools could not do
 * it" without one.
 */
export interface Roster {
  agents: Record<string, string[]>
  /** Phrases that mean a tool, per tool name. Optional. */
  capabilities?: Record<string, string[]>
  toolKinds?: Record<string, 'read' | 'write'>
}

export function parseRoster(text: string): Roster {
  const parsed = JSON.parse(text) as Partial<Roster>
  if (!parsed || typeof parsed !== 'object' || !parsed.agents || typeof parsed.agents !== 'object') {
    throw new Error('A roster is a JSON object with an "agents" map of agent name to tool names')
  }
  return { agents: parsed.agents, capabilities: parsed.capabilities, toolKinds: parsed.toolKinds }
}
