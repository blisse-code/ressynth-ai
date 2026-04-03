import { ProviderConfig, ProviderID, UserProviderSettings } from '../../types';

/**
 * Provider Registry
 * 
 * Models are ranked by ACCURACY and COMPREHENSIVENESS, not speed.
 * The fallback chain prioritizes thorough analysis over fast results.
 * 
 * Capability tiers:
 *   Tier 1 (Native multimodal): Gemini, Kimi - handle raw video/audio
 *   Tier 2 (Strong reasoning): Anthropic - best for synthesis, needs transcript
 *   Tier 3 (Capable): Qwen - good analysis, some multimodal
 *   Tier 4 (Fast fallback): Groq - transcription via Whisper, fast text
 *   Tier 5 (Catch-all): OpenRouter - routes to best available model
 */

export const PROVIDER_CONFIGS: Record<ProviderID, ProviderConfig> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Native video and audio analysis with massive context window. Best for raw media processing.',
    models: [
      {
        id: 'gemini-2.5-pro-preview-06-05',
        name: 'Gemini 2.5 Pro',
        description: 'Most capable Gemini model. Native video/audio, 1M context.',
        capabilities: {
          nativeVideo: true,
          nativeAudio: true,
          maxFileSizeMB: 2048,
          maxContextTokens: 1048576,
          strengths: ['native video analysis', 'native audio analysis', 'long context', 'multimodal'],
          accuracy: 'high',
          speed: 'medium',
          costPerMillionTokens: 1.25,
        }
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: 'Faster Gemini variant. Good for shorter recordings.',
        capabilities: {
          nativeVideo: true,
          nativeAudio: true,
          maxFileSizeMB: 2048,
          maxContextTokens: 1048576,
          strengths: ['fast multimodal', 'native video', 'native audio'],
          accuracy: 'medium',
          speed: 'fast',
          costPerMillionTokens: 0.10,
        }
      }
    ],
    capabilities: {
      nativeVideo: true,
      nativeAudio: true,
      maxFileSizeMB: 2048,
      maxContextTokens: 1048576,
      strengths: ['native video analysis', 'native audio analysis', 'long context'],
      accuracy: 'high',
      speed: 'medium',
      costPerMillionTokens: 1.25,
    },
    apiKeyPlaceholder: 'AIza...',
    docsUrl: 'https://ai.google.dev/docs',
    color: '#4285F4',
  },

  kimi: {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    description: 'Strong multimodal with excellent long-context handling. Native video support.',
    models: [
      {
        id: 'kimi-latest',
        name: 'Kimi Latest',
        description: 'Latest Kimi model with video and long-context support.',
        capabilities: {
          nativeVideo: true,
          nativeAudio: true,
          maxFileSizeMB: 1024,
          maxContextTokens: 131072,
          strengths: ['long context', 'video analysis', 'detailed comprehension'],
          accuracy: 'high',
          speed: 'medium',
          costPerMillionTokens: 2.00,
        }
      }
    ],
    capabilities: {
      nativeVideo: true,
      nativeAudio: true,
      maxFileSizeMB: 1024,
      maxContextTokens: 131072,
      strengths: ['long context', 'video analysis', 'detailed comprehension'],
      accuracy: 'high',
      speed: 'medium',
      costPerMillionTokens: 2.00,
    },
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.moonshot.cn/docs',
    color: '#6366F1',
  },

  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Exceptional reasoning and synthesis. Best supervisor model. Needs transcript for audio/video.',
    models: [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        description: 'Strong reasoning and analysis. Excellent for synthesis.',
        capabilities: {
          nativeVideo: false,
          nativeAudio: false,
          maxFileSizeMB: 0,
          maxContextTokens: 200000,
          strengths: ['reasoning', 'synthesis', 'structured analysis', 'nuanced writing'],
          accuracy: 'high',
          speed: 'medium',
          costPerMillionTokens: 3.00,
        }
      },
      {
        id: 'claude-haiku-3-5-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fast and capable. Good for secondary analysis.',
        capabilities: {
          nativeVideo: false,
          nativeAudio: false,
          maxFileSizeMB: 0,
          maxContextTokens: 200000,
          strengths: ['fast reasoning', 'structured output', 'cost efficient'],
          accuracy: 'medium',
          speed: 'fast',
          costPerMillionTokens: 0.80,
        }
      }
    ],
    capabilities: {
      nativeVideo: false,
      nativeAudio: false,
      maxFileSizeMB: 0,
      maxContextTokens: 200000,
      strengths: ['reasoning', 'synthesis', 'structured analysis', 'nuanced writing'],
      accuracy: 'high',
      speed: 'medium',
      costPerMillionTokens: 3.00,
    },
    apiKeyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://docs.anthropic.com',
    color: '#D97757',
  },

  qwen: {
    id: 'qwen',
    name: 'Qwen (Alibaba)',
    description: 'Strong multimodal capabilities with good audio understanding. Competitive pricing.',
    models: [
      {
        id: 'qwen-max',
        name: 'Qwen Max',
        description: 'Most capable Qwen model. Good multimodal support.',
        capabilities: {
          nativeVideo: true,
          nativeAudio: true,
          maxFileSizeMB: 500,
          maxContextTokens: 131072,
          strengths: ['multimodal', 'multilingual', 'detailed analysis'],
          accuracy: 'high',
          speed: 'medium',
          costPerMillionTokens: 1.60,
        }
      },
      {
        id: 'qwen-plus',
        name: 'Qwen Plus',
        description: 'Balanced performance and cost.',
        capabilities: {
          nativeVideo: true,
          nativeAudio: true,
          maxFileSizeMB: 500,
          maxContextTokens: 131072,
          strengths: ['multimodal', 'cost efficient'],
          accuracy: 'medium',
          speed: 'medium',
          costPerMillionTokens: 0.80,
        }
      }
    ],
    capabilities: {
      nativeVideo: true,
      nativeAudio: true,
      maxFileSizeMB: 500,
      maxContextTokens: 131072,
      strengths: ['multimodal', 'multilingual', 'detailed analysis'],
      accuracy: 'high',
      speed: 'medium',
      costPerMillionTokens: 1.60,
    },
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://help.aliyun.com/zh/model-studio/',
    color: '#7C3AED',
  },

  groq: {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast inference. Whisper transcription. Use for speed when accuracy tier is covered.',
    models: [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        description: 'Fast, capable text analysis. No native media.',
        capabilities: {
          nativeVideo: false,
          nativeAudio: false,
          maxFileSizeMB: 0,
          maxContextTokens: 131072,
          strengths: ['ultra fast inference', 'text analysis'],
          accuracy: 'medium',
          speed: 'fast',
          costPerMillionTokens: 0.59,
        }
      },
      {
        id: 'whisper-large-v3-turbo',
        name: 'Whisper Large V3 Turbo',
        description: 'Audio transcription only. Very fast.',
        capabilities: {
          nativeVideo: false,
          nativeAudio: true,
          maxFileSizeMB: 25,
          maxContextTokens: 0,
          strengths: ['transcription', 'speaker diarization'],
          accuracy: 'high',
          speed: 'fast',
          costPerMillionTokens: 0.04,
        }
      }
    ],
    capabilities: {
      nativeVideo: false,
      nativeAudio: true,
      maxFileSizeMB: 25,
      maxContextTokens: 131072,
      strengths: ['ultra fast inference', 'transcription'],
      accuracy: 'medium',
      speed: 'fast',
      costPerMillionTokens: 0.59,
    },
    apiKeyPlaceholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/docs',
    color: '#F97316',
  },

  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Meta-provider routing to 200+ models. Catch-all fallback when other providers exhaust tokens.',
    models: [
      {
        id: 'auto',
        name: 'Auto (Best Available)',
        description: 'OpenRouter selects the best model for the task.',
        capabilities: {
          nativeVideo: false,
          nativeAudio: false,
          maxFileSizeMB: 0,
          maxContextTokens: 200000,
          strengths: ['model variety', 'fallback', 'auto routing'],
          accuracy: 'high',
          speed: 'medium',
          costPerMillionTokens: 3.00,
        }
      },
      {
        id: 'anthropic/claude-sonnet-4',
        name: 'Claude Sonnet 4 (via OR)',
        description: 'Claude via OpenRouter. Good fallback if direct Anthropic key exhausted.',
        capabilities: {
          nativeVideo: false,
          nativeAudio: false,
          maxFileSizeMB: 0,
          maxContextTokens: 200000,
          strengths: ['reasoning', 'synthesis'],
          accuracy: 'high',
          speed: 'medium',
          costPerMillionTokens: 3.50,
        }
      },
      {
        id: 'google/gemini-2.5-pro-preview',
        name: 'Gemini 2.5 Pro (via OR)',
        description: 'Gemini via OpenRouter.',
        capabilities: {
          nativeVideo: false,
          nativeAudio: false,
          maxFileSizeMB: 0,
          maxContextTokens: 1048576,
          strengths: ['long context', 'analysis'],
          accuracy: 'high',
          speed: 'medium',
          costPerMillionTokens: 1.50,
        }
      }
    ],
    capabilities: {
      nativeVideo: false,
      nativeAudio: false,
      maxFileSizeMB: 0,
      maxContextTokens: 200000,
      strengths: ['model variety', 'fallback', 'auto routing'],
      accuracy: 'high',
      speed: 'medium',
      costPerMillionTokens: 3.00,
    },
    apiKeyPlaceholder: 'sk-or-...',
    docsUrl: 'https://openrouter.ai/docs',
    color: '#6B7280',
  },
};

// ─── Default fallback order (by accuracy, not speed) ───
export const DEFAULT_FALLBACK_ORDER: ProviderID[] = [
  'gemini',      // Tier 1: Native multimodal, high accuracy
  'kimi',        // Tier 1: Native multimodal, high accuracy
  'anthropic',   // Tier 2: Best reasoning, needs transcript
  'qwen',        // Tier 3: Good multimodal, competitive
  'groq',        // Tier 4: Fast, transcription, less thorough
  'openrouter',  // Tier 5: Catch-all, routes to best available
];

// ─── Storage keys ───
const SETTINGS_KEY = 'ressynth_provider_settings';

export function loadProviderSettings(): UserProviderSettings[] {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load provider settings:', e);
  }
  return [];
}

export function saveProviderSettings(settings: UserProviderSettings[]): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save provider settings:', e);
  }
}

export function getEnabledProviders(): UserProviderSettings[] {
  return loadProviderSettings()
    .filter(s => s.enabled && s.apiKey)
    .sort((a, b) => a.priority - b.priority);
}

export function getProviderConfig(id: ProviderID): ProviderConfig {
  return PROVIDER_CONFIGS[id];
}
