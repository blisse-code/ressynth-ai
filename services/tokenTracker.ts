import { TokenUsage, ProviderID } from '../types';

const USAGE_KEY = 'ressynth_token_usage';
const MAX_ENTRIES = 500;

export function trackTokenUsage(usage: TokenUsage): void {
  try {
    const history = getUsageHistory();
    history.push(usage);
    // Keep only last N entries to avoid localStorage bloat
    const trimmed = history.slice(-MAX_ENTRIES);
    localStorage.setItem(USAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to track token usage:', e);
  }
}

export function getUsageHistory(): TokenUsage[] {
  try {
    const stored = localStorage.getItem(USAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getTotalTokensForProvider(provider: ProviderID): number {
  return getUsageHistory()
    .filter(u => u.provider === provider)
    .reduce((sum, u) => sum + u.totalTokens, 0);
}

export function getTotalCostForProvider(provider: ProviderID): number {
  return getUsageHistory()
    .filter(u => u.provider === provider)
    .reduce((sum, u) => sum + u.estimatedCost, 0);
}

export function getSessionUsage(sessionUsage: TokenUsage[]): {
  totalTokens: number;
  totalCost: number;
  byProvider: Record<string, { tokens: number; cost: number }>;
} {
  const byProvider: Record<string, { tokens: number; cost: number }> = {};
  let totalTokens = 0;
  let totalCost = 0;

  for (const u of sessionUsage) {
    totalTokens += u.totalTokens;
    totalCost += u.estimatedCost;

    if (!byProvider[u.provider]) {
      byProvider[u.provider] = { tokens: 0, cost: 0 };
    }
    byProvider[u.provider].tokens += u.totalTokens;
    byProvider[u.provider].cost += u.estimatedCost;
  }

  return { totalTokens, totalCost, byProvider };
}

export function getLifetimeStats(): {
  totalTokens: number;
  totalCost: number;
  totalSessions: number;
  byProvider: Record<string, { tokens: number; cost: number; sessions: number }>;
} {
  const history = getUsageHistory();
  const byProvider: Record<string, { tokens: number; cost: number; sessions: number }> = {};
  let totalTokens = 0;
  let totalCost = 0;

  const sessions = new Set<number>();

  for (const u of history) {
    totalTokens += u.totalTokens;
    totalCost += u.estimatedCost;
    sessions.add(Math.floor(u.timestamp / 3600000)); // rough session grouping by hour

    if (!byProvider[u.provider]) {
      byProvider[u.provider] = { tokens: 0, cost: 0, sessions: 0 };
    }
    byProvider[u.provider].tokens += u.totalTokens;
    byProvider[u.provider].cost += u.estimatedCost;
  }

  return { totalTokens, totalCost, totalSessions: sessions.size, byProvider };
}

export function clearUsageHistory(): void {
  localStorage.removeItem(USAGE_KEY);
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}
