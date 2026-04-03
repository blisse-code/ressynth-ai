import { 
  ProviderID, UserProviderSettings, TokenUsage, AgentStatus, GeminiFileInfo 
} from '../types';
import { getEnabledProviders, PROVIDER_CONFIGS } from './providers/registry';
import { callProvider, transcribeWithGroq } from './providers/api';
import { getPromptForTask } from './knowledgeBase';
import { trackTokenUsage, getTotalTokensForProvider } from './tokenTracker';

/**
 * Supervisor: Orchestrates multi-agent analysis
 * 
 * Decision logic:
 * 1. If a native multimodal model is available (Gemini, Kimi, Qwen),
 *    use it for BOTH video and audio analysis in parallel if possible.
 * 2. If only text models are available (Claude, Groq, OpenRouter),
 *    first transcribe with Whisper (Groq), then analyze the transcript.
 * 3. The supervisor (best reasoning model) synthesizes all observations.
 * 4. If only ONE model is available, it does everything (single-model mode).
 * 
 * Fallback: If a provider fails or exhausts tokens, the next provider 
 * in the chain picks up the task.
 */

interface SupervisorOptions {
  file: File;
  geminiFileInfo?: GeminiFileInfo;
  onStep: (step: string) => void;
  onAgentUpdate: (agents: AgentStatus[]) => void;
  onFileUploaded?: (info: GeminiFileInfo) => void;
}

export async function runSupervisedAnalysis(opts: SupervisorOptions): Promise<{
  result: string;
  tokenUsage: TokenUsage[];
}> {
  const providers = getEnabledProviders();
  if (providers.length === 0) {
    throw new Error('No AI models configured. Please add at least one API key in Settings.');
  }

  const allUsage: TokenUsage[] = [];
  const agents: AgentStatus[] = [];

  const updateAgent = (id: string, update: Partial<AgentStatus>) => {
    const idx = agents.findIndex(a => a.id === id);
    if (idx >= 0) {
      agents[idx] = { ...agents[idx], ...update };
    } else {
      agents.push({
        id,
        name: update.name || id,
        provider: update.provider || '',
        task: update.task || '',
        status: update.status || 'pending',
        ...update,
      });
    }
    opts.onAgentUpdate([...agents]);
  };

  // ─── Classify available providers by capability ───
  const multimodalProviders = providers.filter(p => {
    const config = PROVIDER_CONFIGS[p.id];
    const model = config.models.find(m => m.id === p.selectedModel) || config.models[0];
    return model.capabilities.nativeVideo || model.capabilities.nativeAudio;
  });

  const textProviders = providers.filter(p => {
    const config = PROVIDER_CONFIGS[p.id];
    const model = config.models.find(m => m.id === p.selectedModel) || config.models[0];
    return !model.capabilities.nativeVideo && !model.capabilities.nativeAudio;
  });

  const reasoningProviders = providers.filter(p =>
    ['anthropic', 'gemini', 'kimi', 'openrouter'].includes(p.id)
  );

  opts.onStep('Planning analysis strategy...');

  // ─── Strategy Selection ───
  // Strategy A: Multi-agent with native multimodal models
  // Strategy B: Transcribe first, then text analysis
  // Strategy C: Single model does everything

  if (providers.length === 1) {
    // Single model mode
    return runSingleModelAnalysis(providers[0], opts, allUsage, updateAgent);
  }

  if (multimodalProviders.length >= 1 && reasoningProviders.length >= 1) {
    // Best case: multimodal for observation + reasoning model for synthesis
    return runMultiAgentAnalysis(
      multimodalProviders, reasoningProviders, textProviders,
      opts, allUsage, updateAgent
    );
  }

  if (multimodalProviders.length >= 1) {
    // Has multimodal but no separate reasoning model
    return runSingleModelAnalysis(multimodalProviders[0], opts, allUsage, updateAgent);
  }

  // No multimodal at all - transcribe first
  return runTranscriptBasedAnalysis(
    textProviders, providers, opts, allUsage, updateAgent
  );
}

// ─── Strategy A: Multi-Agent with Supervisor ───
async function runMultiAgentAnalysis(
  multimodal: UserProviderSettings[],
  reasoning: UserProviderSettings[],
  text: UserProviderSettings[],
  opts: SupervisorOptions,
  allUsage: TokenUsage[],
  updateAgent: (id: string, update: Partial<AgentStatus>) => void
): Promise<{ result: string; tokenUsage: TokenUsage[] }> {

  const primaryMM = multimodal[0];
  const primaryConfig = PROVIDER_CONFIGS[primaryMM.id];
  const primaryModel = primaryConfig.models.find(m => m.id === primaryMM.selectedModel)
    || primaryConfig.models[0];

  // Pick supervisor: prefer Claude for reasoning, then Gemini, then best available
  const supervisor = reasoning.find(p => p.id === 'anthropic')
    || reasoning.find(p => p.id === 'gemini')
    || reasoning[0];

  opts.onStep(`Deploying agents: ${primaryConfig.name} (media) + ${PROVIDER_CONFIGS[supervisor.id].name} (supervisor)`);

  // ─── Phase 1: Media Analysis ───
  updateAgent('media-analyst', {
    name: `${primaryConfig.name} Media Analyst`,
    provider: primaryMM.id,
    task: 'Analyzing video and audio content',
    status: 'running',
  });

  let mediaObservations = '';
  let mediaSuccess = false;

  // Try multimodal providers in order
  for (const mm of multimodal) {
    try {
      const config = PROVIDER_CONFIGS[mm.id];
      const model = config.models.find(m => m.id === mm.selectedModel) || config.models[0];

      opts.onStep(`${config.name} analyzing session recording...`);

      const result = await callProvider(mm.id, {
        apiKey: mm.apiKey,
        model: model.id,
        prompt: getPromptForTask('single'), // Full analysis for native multimodal
        file: opts.file,
        geminiFileInfo: mm.id === 'gemini' ? opts.geminiFileInfo : undefined,
        task: 'media_analysis',
        onStep: opts.onStep,
        onFileUploaded: opts.onFileUploaded,
      });

      mediaObservations = result.text;
      allUsage.push(result.usage);
      trackTokenUsage(result.usage);
      mediaSuccess = true;

      updateAgent('media-analyst', {
        status: 'completed',
        tokensUsed: result.usage.totalTokens,
      });

      break; // Success, no need for fallback
    } catch (err: any) {
      console.error(`${PROVIDER_CONFIGS[mm.id].name} failed:`, err);
      updateAgent('media-analyst', {
        status: 'failed',
        task: `Failed: ${err.message}. Trying fallback...`,
      });
      continue; // Try next multimodal provider
    }
  }

  if (!mediaSuccess) {
    // All multimodal failed. Fall back to transcript-based.
    opts.onStep('Multimodal analysis failed. Falling back to transcript-based analysis...');
    return runTranscriptBasedAnalysis(
      text.length > 0 ? text : [supervisor],
      [...multimodal, ...reasoning, ...text],
      opts, allUsage, updateAgent
    );
  }

  // ─── Phase 2: Supervisor Synthesis ───
  // If the supervisor is the same as the media analyst, we already have a full report.
  if (supervisor.id === primaryMM.id) {
    return { result: mediaObservations, tokenUsage: allUsage };
  }

  updateAgent('supervisor', {
    name: `${PROVIDER_CONFIGS[supervisor.id].name} Supervisor`,
    provider: supervisor.id,
    task: 'Synthesizing final insight report',
    status: 'running',
  });

  opts.onStep(`${PROVIDER_CONFIGS[supervisor.id].name} synthesizing insights...`);

  try {
    const synthesisPrompt = getPromptForTask('synthesis');
    const fullPrompt = `${synthesisPrompt}\n\n---\n\n## Agent Observations\n\n${mediaObservations}`;

    const result = await callProvider(supervisor.id, {
      apiKey: supervisor.apiKey,
      model: supervisor.selectedModel || PROVIDER_CONFIGS[supervisor.id].models[0].id,
      prompt: fullPrompt,
      transcript: mediaObservations,
      task: 'synthesis',
      onStep: opts.onStep,
    });

    allUsage.push(result.usage);
    trackTokenUsage(result.usage);

    updateAgent('supervisor', {
      status: 'completed',
      tokensUsed: result.usage.totalTokens,
    });

    return { result: result.text, tokenUsage: allUsage };
  } catch (err: any) {
    // Supervisor failed, return the media observations directly
    console.error('Supervisor synthesis failed:', err);
    updateAgent('supervisor', { status: 'failed' });
    opts.onStep('Supervisor synthesis failed. Returning direct analysis.');
    return { result: mediaObservations, tokenUsage: allUsage };
  }
}

// ─── Strategy B: Transcript-based Analysis ───
async function runTranscriptBasedAnalysis(
  textProviders: UserProviderSettings[],
  allProviders: UserProviderSettings[],
  opts: SupervisorOptions,
  allUsage: TokenUsage[],
  updateAgent: (id: string, update: Partial<AgentStatus>) => void
): Promise<{ result: string; tokenUsage: TokenUsage[] }> {

  // Step 1: Get transcript (Groq Whisper preferred)
  const groqProvider = allProviders.find(p => p.id === 'groq');
  let transcript = '';

  if (groqProvider && opts.file.size <= 25 * 1024 * 1024) {
    updateAgent('transcriber', {
      name: 'Groq Whisper Transcriber',
      provider: 'groq',
      task: 'Transcribing audio',
      status: 'running',
    });

    try {
      const transcription = await transcribeWithGroq(
        groqProvider.apiKey, opts.file, opts.onStep
      );
      transcript = transcription.text;
      allUsage.push(transcription.usage);
      trackTokenUsage(transcription.usage);

      updateAgent('transcriber', {
        status: 'completed',
        tokensUsed: transcription.usage.totalTokens,
      });
    } catch (err: any) {
      console.error('Whisper transcription failed:', err);
      updateAgent('transcriber', { status: 'failed' });
    }
  }

  if (!transcript) {
    // No transcript available. Try sending file to a multimodal provider for transcription.
    const mmProvider = allProviders.find(p =>
      PROVIDER_CONFIGS[p.id].capabilities.nativeAudio
    );

    if (mmProvider) {
      try {
        opts.onStep('Extracting transcript via multimodal model...');
        const result = await callProvider(mmProvider.id, {
          apiKey: mmProvider.apiKey,
          model: mmProvider.selectedModel || PROVIDER_CONFIGS[mmProvider.id].models[0].id,
          prompt: 'Transcribe this recording with timestamps. Format: [MM:SS] Speaker: "text". Distinguish between interviewer and participant.',
          file: opts.file,
          geminiFileInfo: mmProvider.id === 'gemini' ? opts.geminiFileInfo : undefined,
          task: 'transcription',
          onStep: opts.onStep,
          onFileUploaded: opts.onFileUploaded,
        });
        transcript = result.text;
        allUsage.push(result.usage);
        trackTokenUsage(result.usage);
      } catch (err) {
        throw new Error('Could not transcribe the recording. Please provide a text model with a transcript, or add a multimodal model (Gemini, Kimi, or Qwen).');
      }
    } else {
      throw new Error('No multimodal model or Whisper available for transcription. Please add Gemini, Kimi, Qwen, or Groq API keys.');
    }
  }

  // Step 2: Analyze transcript with best text model
  const analyst = textProviders.find(p => p.id === 'anthropic')
    || textProviders.find(p => p.id === 'openrouter')
    || textProviders[0];

  if (!analyst) {
    throw new Error('No text analysis model available.');
  }

  updateAgent('text-analyst', {
    name: `${PROVIDER_CONFIGS[analyst.id].name} Analyst`,
    provider: analyst.id,
    task: 'Analyzing transcript for insights',
    status: 'running',
  });

  for (const provider of textProviders) {
    try {
      opts.onStep(`${PROVIDER_CONFIGS[provider.id].name} analyzing transcript...`);

      const result = await callProvider(provider.id, {
        apiKey: provider.apiKey,
        model: provider.selectedModel || PROVIDER_CONFIGS[provider.id].models[0].id,
        prompt: getPromptForTask('single'),
        transcript,
        task: 'transcript_analysis',
        onStep: opts.onStep,
      });

      allUsage.push(result.usage);
      trackTokenUsage(result.usage);

      updateAgent('text-analyst', {
        status: 'completed',
        tokensUsed: result.usage.totalTokens,
      });

      return { result: result.text, tokenUsage: allUsage };
    } catch (err: any) {
      console.error(`${PROVIDER_CONFIGS[provider.id].name} failed:`, err);
      updateAgent('text-analyst', {
        status: 'failed',
        task: `Failed: ${err.message}`,
      });
      continue;
    }
  }

  throw new Error('All text analysis providers failed. Please check your API keys and try again.');
}

// ─── Strategy C: Single Model ───
async function runSingleModelAnalysis(
  provider: UserProviderSettings,
  opts: SupervisorOptions,
  allUsage: TokenUsage[],
  updateAgent: (id: string, update: Partial<AgentStatus>) => void
): Promise<{ result: string; tokenUsage: TokenUsage[] }> {

  const config = PROVIDER_CONFIGS[provider.id];
  const model = config.models.find(m => m.id === provider.selectedModel) || config.models[0];

  updateAgent('solo-analyst', {
    name: `${config.name} (Full Analysis)`,
    provider: provider.id,
    task: 'Complete session analysis',
    status: 'running',
  });

  const isMultimodal = model.capabilities.nativeVideo || model.capabilities.nativeAudio;
  const promptType = model.capabilities.maxContextTokens < 65536 ? 'condensed' : 'single';

  opts.onStep(`${config.name} performing full analysis...`);

  const result = await callProvider(provider.id, {
    apiKey: provider.apiKey,
    model: model.id,
    prompt: getPromptForTask(promptType),
    file: isMultimodal ? opts.file : undefined,
    geminiFileInfo: provider.id === 'gemini' ? opts.geminiFileInfo : undefined,
    task: 'full_analysis',
    onStep: opts.onStep,
    onFileUploaded: opts.onFileUploaded,
  });

  allUsage.push(result.usage);
  trackTokenUsage(result.usage);

  updateAgent('solo-analyst', {
    status: 'completed',
    tokensUsed: result.usage.totalTokens,
  });

  return { result: result.text, tokenUsage: allUsage };
}
