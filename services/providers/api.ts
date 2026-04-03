import { GoogleGenAI } from '@google/genai';
import { ProviderID, TokenUsage, GeminiFileInfo } from '../../types';

/**
 * Provider API layer
 * Each function handles the specific API contract for its provider.
 * Returns: { text: string, usage: TokenUsage }
 */

interface ProviderResponse {
  text: string;
  usage: TokenUsage;
}

interface AnalyzeOptions {
  apiKey: string;
  model: string;
  prompt: string;
  file?: File;
  geminiFileInfo?: GeminiFileInfo;
  transcript?: string;
  onStep?: (step: string) => void;
  onFileUploaded?: (info: GeminiFileInfo) => void;
  task: string;
}

// ─── Gemini ───
export async function callGemini(opts: AnalyzeOptions): Promise<ProviderResponse> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const startTime = Date.now();

  let fileUri = '';
  let mimeType = '';

  if (opts.geminiFileInfo) {
    fileUri = opts.geminiFileInfo.uri;
    mimeType = opts.geminiFileInfo.mimeType;
    opts.onStep?.('Recovering uploaded file from cloud...');
  } else if (opts.file) {
    opts.onStep?.('Uploading file to Gemini...');
    const uploadResult = await ai.files.upload({
      file: opts.file,
      config: { mimeType: opts.file.type, displayName: opts.file.name }
    });

    opts.onStep?.('Processing file on Gemini servers...');
    let fileInfo = await ai.files.get({ name: uploadResult.name! });
    while (fileInfo.state === 'PROCESSING') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      fileInfo = await ai.files.get({ name: uploadResult.name! });
    }
    if (fileInfo.state === 'FAILED') throw new Error('File processing failed on Gemini servers.');

    fileUri = fileInfo.uri!;
    mimeType = fileInfo.mimeType || opts.file.type;
    opts.onFileUploaded?.({ uri: fileUri, name: fileInfo.name!, mimeType });
  }

  opts.onStep?.('Generating analysis with Gemini...');

  const parts: any[] = [];
  if (fileUri) {
    parts.push({ fileData: { mimeType, fileUri } });
  }
  if (opts.transcript) {
    parts.push({ text: `## Transcript\n\n${opts.transcript}` });
  }
  parts.push({ text: opts.prompt });

  const response = await ai.models.generateContent({
    model: opts.model,
    contents: { parts },
  });

  const text = response.text;
  if (!text || text.trim() === '') {
    const reason = response.candidates?.[0]?.finishReason;
    if (reason === 'SAFETY') throw new Error('Analysis blocked by safety filters.');
    throw new Error('No analysis generated. The recording may lack clear speech or relevant content.');
  }

  const inputTokens = response.usageMetadata?.promptTokenCount || 0;
  const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;

  return {
    text,
    usage: {
      provider: 'gemini',
      model: opts.model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: ((inputTokens + outputTokens) / 1_000_000) * 1.25,
      timestamp: Date.now(),
      task: opts.task,
    }
  };
}

// ─── Anthropic (Claude) ───
export async function callAnthropic(opts: AnalyzeOptions): Promise<ProviderResponse> {
  if (!opts.transcript && !opts.prompt) {
    throw new Error('Anthropic requires a transcript for audio/video analysis.');
  }

  opts.onStep?.('Analyzing with Claude...');

  const messages: any[] = [{
    role: 'user',
    content: opts.transcript
      ? `${opts.prompt}\n\n## Session Transcript / Observations\n\n${opts.transcript}`
      : opts.prompt,
  }];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 8192,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.map((b: any) => b.text || '').join('') || '';
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;

  return {
    text,
    usage: {
      provider: 'anthropic',
      model: opts.model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: ((inputTokens * 3 + outputTokens * 15) / 1_000_000),
      timestamp: Date.now(),
      task: opts.task,
    }
  };
}

// ─── Kimi (Moonshot) ───
export async function callKimi(opts: AnalyzeOptions): Promise<ProviderResponse> {
  opts.onStep?.('Analyzing with Kimi...');

  const messages: any[] = [];

  // Kimi supports file upload via their API
  if (opts.file) {
    // Upload file to Kimi first
    opts.onStep?.('Uploading file to Kimi...');
    const formData = new FormData();
    formData.append('file', opts.file);
    formData.append('purpose', 'file-extract');

    const uploadResp = await fetch('https://api.moonshot.cn/v1/files', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${opts.apiKey}` },
      body: formData,
    });

    if (uploadResp.ok) {
      const uploadData = await uploadResp.json();
      const fileId = uploadData.id;

      // Get file content
      const contentResp = await fetch(`https://api.moonshot.cn/v1/files/${fileId}/content`, {
        headers: { 'Authorization': `Bearer ${opts.apiKey}` },
      });

      if (contentResp.ok) {
        const fileContent = await contentResp.text();
        messages.push({
          role: 'system',
          content: fileContent,
        });
      }
    }
  }

  if (opts.transcript) {
    messages.push({
      role: 'system',
      content: `Session Transcript:\n${opts.transcript}`,
    });
  }

  messages.push({ role: 'user', content: opts.prompt });

  opts.onStep?.('Generating analysis with Kimi...');

  const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model === 'kimi-latest' ? 'moonshot-v1-auto' : opts.model,
      messages,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Kimi API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;

  return {
    text,
    usage: {
      provider: 'kimi',
      model: opts.model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: ((inputTokens + outputTokens) / 1_000_000) * 2.00,
      timestamp: Date.now(),
      task: opts.task,
    }
  };
}

// ─── Qwen (DashScope) ───
export async function callQwen(opts: AnalyzeOptions): Promise<ProviderResponse> {
  opts.onStep?.('Analyzing with Qwen...');

  const content: any[] = [];

  if (opts.file && (opts.file.type.startsWith('video/') || opts.file.type.startsWith('audio/'))) {
    // Qwen supports multimodal via base64 for smaller files
    if (opts.file.size < 20 * 1024 * 1024) {
      const base64 = await fileToBase64(opts.file);
      content.push({
        type: opts.file.type.startsWith('video/') ? 'video' : 'audio',
        [opts.file.type.startsWith('video/') ? 'video' : 'audio']: base64,
      });
    }
  }

  if (opts.transcript) {
    content.push({ type: 'text', text: `Session Transcript:\n${opts.transcript}` });
  }
  content.push({ type: 'text', text: opts.prompt });

  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model === 'qwen-max' ? 'qwen-max-latest' : opts.model,
      messages: [{ role: 'user', content }],
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Qwen API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;

  return {
    text,
    usage: {
      provider: 'qwen',
      model: opts.model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: ((inputTokens + outputTokens) / 1_000_000) * 1.60,
      timestamp: Date.now(),
      task: opts.task,
    }
  };
}

// ─── Groq ───
export async function callGroq(opts: AnalyzeOptions): Promise<ProviderResponse> {
  opts.onStep?.('Analyzing with Groq...');

  const messages: any[] = [];
  if (opts.transcript) {
    messages.push({
      role: 'system',
      content: `Session Transcript:\n${opts.transcript}`,
    });
  }
  messages.push({ role: 'user', content: opts.prompt });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;

  return {
    text,
    usage: {
      provider: 'groq',
      model: opts.model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: ((inputTokens + outputTokens) / 1_000_000) * 0.59,
      timestamp: Date.now(),
      task: opts.task,
    }
  };
}

// ─── Groq Whisper Transcription ───
export async function transcribeWithGroq(
  apiKey: string,
  file: File,
  onStep?: (step: string) => void
): Promise<{ text: string; usage: TokenUsage }> {
  onStep?.('Transcribing audio with Whisper (Groq)...');

  // Whisper has a 25MB limit - extract audio chunk if needed
  const audioFile = file.type.startsWith('video/')
    ? file // We'll send as-is; Groq handles video files too
    : file;

  if (audioFile.size > 25 * 1024 * 1024) {
    throw new Error('File too large for Whisper transcription (25MB limit). Use a native multimodal model instead.');
  }

  const formData = new FormData();
  formData.append('file', audioFile);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq Whisper error: ${response.status}`);
  }

  const data = await response.json();

  // Format transcript with timestamps
  let transcript = '';
  if (data.segments) {
    for (const seg of data.segments) {
      const mins = Math.floor(seg.start / 60);
      const secs = Math.floor(seg.start % 60);
      const ts = `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
      transcript += `${ts} ${seg.text.trim()}\n`;
    }
  } else {
    transcript = data.text || '';
  }

  return {
    text: transcript,
    usage: {
      provider: 'groq',
      model: 'whisper-large-v3-turbo',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: Math.ceil(data.duration || 0),
      estimatedCost: ((data.duration || 0) / 3600) * 0.04,
      timestamp: Date.now(),
      task: 'transcription',
    }
  };
}

// ─── OpenRouter (catch-all) ───
export async function callOpenRouter(opts: AnalyzeOptions): Promise<ProviderResponse> {
  opts.onStep?.('Analyzing with OpenRouter...');

  const messages: any[] = [];
  if (opts.transcript) {
    messages.push({
      role: 'system',
      content: `Session Transcript:\n${opts.transcript}`,
    });
  }
  messages.push({ role: 'user', content: opts.prompt });

  const modelId = opts.model === 'auto'
    ? 'anthropic/claude-sonnet-4.6'
    : opts.model;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'ResSynth AI',
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;

  return {
    text,
    usage: {
      provider: 'openrouter',
      model: modelId,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: ((inputTokens + outputTokens) / 1_000_000) * 3.00,
      timestamp: Date.now(),
      task: opts.task,
    }
  };
}

// ─── Dispatch to correct provider ───
export async function callProvider(
  provider: ProviderID,
  opts: AnalyzeOptions
): Promise<ProviderResponse> {
  switch (provider) {
    case 'gemini': return callGemini(opts);
    case 'anthropic': return callAnthropic(opts);
    case 'kimi': return callKimi(opts);
    case 'qwen': return callQwen(opts);
    case 'groq': return callGroq(opts);
    case 'openrouter': return callOpenRouter(opts);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// ─── Utility ───
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
