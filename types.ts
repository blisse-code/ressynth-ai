// ─── Analysis State ───
export enum AnalysisStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface AnalysisState {
  status: AnalysisStatus;
  result: string | null;
  error: string | null;
  step?: string;
  activeAgents?: AgentStatus[];
}

export interface AgentStatus {
  id: string;
  name: string;
  provider: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  tokensUsed?: number;
}

export interface FileData {
  file: File;
  previewUrl: string;
  type: 'video' | 'audio';
}

export interface GeminiFileInfo {
  uri: string;
  name: string;
  mimeType: string;
}

// ─── Provider System ───
export type ProviderID = 'gemini' | 'anthropic' | 'kimi' | 'qwen' | 'groq' | 'openrouter';

export interface ProviderCapabilities {
  nativeVideo: boolean;
  nativeAudio: boolean;
  maxFileSizeMB: number;
  maxContextTokens: number;
  strengths: string[];
  accuracy: 'high' | 'medium' | 'low';
  speed: 'fast' | 'medium' | 'slow';
  costPerMillionTokens: number;
}

export interface ProviderConfig {
  id: ProviderID;
  name: string;
  description: string;
  models: ModelOption[];
  capabilities: ProviderCapabilities;
  apiKeyPlaceholder: string;
  docsUrl: string;
  color: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  capabilities: ProviderCapabilities;
}

export interface UserProviderSettings {
  id: ProviderID;
  apiKey: string;
  enabled: boolean;
  selectedModel: string;
  priority: number; // lower = higher priority in fallback chain
}

// ─── Token Tracking ───
export interface TokenUsage {
  provider: ProviderID;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: number;
  task: string;
}

export interface TokenBudget {
  provider: ProviderID;
  maxTokens: number;
  usedTokens: number;
  remainingTokens: number;
}

// ─── Supervisor System ───
export interface AnalysisTask {
  id: string;
  type: 'video_analysis' | 'audio_analysis' | 'transcript' | 'synthesis' | 'heuristic_mapping';
  description: string;
  requiredCapabilities: (keyof ProviderCapabilities)[];
  input: any;
  priority: number;
}

export interface AgentResult {
  taskId: string;
  provider: ProviderID;
  model: string;
  output: string;
  tokensUsed: TokenUsage;
  duration: number;
  success: boolean;
  error?: string;
}

export interface SupervisorPlan {
  tasks: AnalysisTask[];
  assignments: Map<string, ProviderID>;
  estimatedTokens: number;
  estimatedCost: number;
  estimatedDuration: number;
}

// ─── Memory ───
export interface MemoryEntry {
  id: string;
  sessionId: string;
  fileName: string;
  timestamp: number;
  summary: string;
  insights: string[];
  tokenUsage: TokenUsage[];
  result?: string;
}

export interface TimelineEvent {
  time: string;
  label: string;
}
