# ResSynth AI - Multi-Agent UX Research Synthesis

Turn usability testing recordings into structured insight reports using specialized AI agents.

## Architecture

```
User uploads video/audio (up to 750MB)
         |
    Supervisor (orchestrator)
    /         |            \
Video Agent  Audio Agent   Transcript Agent
(Gemini/Kimi) (Gemini/Kimi) (Groq Whisper)
    \         |            /
     Synthesis Agent (Claude/Gemini)
         |
   Insight Report
```

### Supervisor Strategies

The system automatically selects the best strategy based on configured models:

| Strategy | When | Flow |
|----------|------|------|
| Multi-agent | Multimodal + reasoning models available | Media model analyzes raw file, reasoning model synthesizes |
| Transcript-based | Only text models available | Whisper transcribes first, text model analyzes transcript |
| Single model | Only one model configured | That model handles everything |

### Provider Capability Matrix

| Provider | Video | Audio | Accuracy | Speed | Best For |
|----------|-------|-------|----------|-------|----------|
| Gemini 2.5 Pro | Native | Native | High | Medium | Raw media analysis |
| Kimi (Moonshot) | Native | Native | High | Medium | Long recordings |
| Claude (Anthropic) | - | - | High | Medium | Synthesis, reasoning |
| Qwen (Alibaba) | Native | Native | High | Medium | Multimodal analysis |
| Groq | - | Whisper | Medium | Fast | Transcription, fast text |
| OpenRouter | - | - | Varies | Varies | Catch-all fallback |

## Setup

### Prerequisites
- Node.js 20+
- At least one API key from a supported provider

### Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:3000 and click Settings (gear icon) to add your API keys.

### API Keys

Get API keys from:
- **Gemini**: https://ai.google.dev/docs
- **Kimi**: https://platform.moonshot.cn
- **Anthropic**: https://console.anthropic.com
- **Qwen**: https://dashscope.aliyun.com
- **Groq**: https://console.groq.com
- **OpenRouter**: https://openrouter.ai/keys

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

The app is fully client-side. No server-side API keys needed - users provide their own keys stored in localStorage.

## File Structure

```
ressynth/
  App.tsx                          # Main application
  types.ts                         # TypeScript types
  constants.ts                     # Config constants
  index.html                       # Entry HTML (Tailwind CDN)
  index.tsx                        # React entry
  components/
    AnalysisView.tsx               # Report display + agent status
    UploadSection.tsx              # File upload with 750MB limit
    Settings/
      SettingsModal.tsx            # Provider config + token usage
    ErrorBoundary.tsx
    Spinner.tsx
  services/
    supervisor.ts                  # Multi-agent orchestration
    knowledgeBase.ts               # System prompts (video, audio, synthesis)
    tokenTracker.ts                # Per-provider usage tracking
    memory.ts                      # localStorage session persistence
    providers/
      registry.ts                  # Provider configs + capability matrix
      api.ts                       # API implementations (6 providers)
  vercel.json                      # Vercel deployment config
```

## How It Works

1. User uploads a recording (video or audio, up to 750MB)
2. Supervisor checks which AI models are configured and their capabilities
3. Tasks are distributed to specialist agents:
   - **Video-capable models** (Gemini, Kimi, Qwen) analyze raw media directly
   - **Text-only models** (Claude, OpenRouter) need a transcript first
   - **Groq Whisper** handles transcription for text-only models
4. The supervisor synthesizes observations into a structured insight report
5. If any agent fails or exhausts tokens, the next provider in the fallback chain picks up
6. Token usage is tracked per-provider with cost estimates

## Knowledge Base

All models receive consistent system prompts from the knowledge base:
- **Video Analysis Prompt**: Screen interactions, navigation paths, body language
- **Audio Analysis Prompt**: Think-aloud protocol, sentiment, verbatim quotes
- **Synthesis Prompt**: Cross-references video and audio, produces final report
- **Condensed Prompt**: For models with smaller context windows

Reports follow Nielsen's 10 Usability Heuristics framework consistently across all models.
