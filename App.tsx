import React, { useState, useEffect, useRef } from 'react';
import { UploadSection } from './components/UploadSection';
import { AnalysisView } from './components/AnalysisView';
import { SettingsModal } from './components/Settings/SettingsModal';
import { runSupervisedAnalysis } from './services/supervisor';
import { getEnabledProviders } from './services/providers/registry';
import { saveSession, generateSessionId } from './services/memory';
import { AnalysisState, AnalysisStatus, FileData, GeminiFileInfo, AgentStatus, TokenUsage } from './types';
import { BrainCircuit, Sparkles, Settings, Smile, BarChart3 } from 'lucide-react';

const App: React.FC = () => {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    status: AnalysisStatus.IDLE,
    result: null,
    error: null,
  });
  const [estimatedTimeMs, setEstimatedTimeMs] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasModels, setHasModels] = useState(false);
  const [sessionUsage, setSessionUsage] = useState<TokenUsage[]>([]);
  const [savedGeminiFile, setSavedGeminiFile] = useState<GeminiFileInfo | null>(null);
  const wakeLockRef = useRef<any>(null);

  // Check if models are configured
  const refreshModelStatus = () => {
    setHasModels(getEnabledProviders().length > 0);
  };

  useEffect(() => {
    refreshModelStatus();
    // Show settings on first visit if no models configured
    const hasVisited = localStorage.getItem('ressynth_visited');
    if (!hasVisited) {
      localStorage.setItem('ressynth_visited', 'true');
      if (getEnabledProviders().length === 0) {
        setIsSettingsOpen(true);
      }
    }
  }, []);

  // Wake lock during processing
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) { /* silent */ }
    };

    if (analysisState.status === AnalysisStatus.PROCESSING) {
      requestWakeLock();
    } else if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [analysisState.status]);

  const handleFileSelected = (file: File) => {
    const url = URL.createObjectURL(file);
    setFileData({
      file,
      previewUrl: url,
      type: file.type.startsWith('video') ? 'video' : 'audio',
    });
    
    const fileSizeMB = file.size / (1024 * 1024);
    const estimatedSeconds = Math.max(60, fileSizeMB * 1.5);
    setEstimatedTimeMs(estimatedSeconds * 1000);

    startAnalysis(file);
  };

  const startAnalysis = async (file: File) => {
    setSessionUsage([]);
    setAnalysisState({
      status: AnalysisStatus.PROCESSING,
      result: null,
      error: null,
      step: 'Starting analysis...',
      activeAgents: [],
    });

    try {
      const { result, tokenUsage } = await runSupervisedAnalysis({
        file,
        geminiFileInfo: savedGeminiFile || undefined,
        onStep: (step) => {
          setAnalysisState(prev => ({ ...prev, step }));
        },
        onAgentUpdate: (agents) => {
          setAnalysisState(prev => ({ ...prev, activeAgents: agents }));
        },
        onFileUploaded: (info) => {
          setSavedGeminiFile(info);
        },
      });

      setSessionUsage(tokenUsage);
      setAnalysisState({
        status: AnalysisStatus.COMPLETED,
        result,
        error: null,
      });

      // Save to memory
      const sessionId = generateSessionId();
      saveSession({
        id: sessionId,
        sessionId,
        fileName: file.name,
        timestamp: Date.now(),
        summary: result.substring(0, 500),
        insights: [],
        tokenUsage,
        result,
      });

    } catch (error: any) {
      setAnalysisState({
        status: AnalysisStatus.ERROR,
        result: null,
        error: error.message || 'An error occurred during analysis.',
      });
    }
  };

  const handleReset = () => {
    if (fileData?.previewUrl) URL.revokeObjectURL(fileData.previewUrl);
    setFileData(null);
    setSessionUsage([]);
    setSavedGeminiFile(null);
    setAnalysisState({ status: AnalysisStatus.IDLE, result: null, error: null });
  };

  useEffect(() => {
    return () => {
      if (fileData?.previewUrl) URL.revokeObjectURL(fileData.previewUrl);
    };
  }, [fileData]);

  const enabledProviders = getEnabledProviders();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-orange-500 p-1.5 rounded-lg shadow-sm shadow-orange-500/20 rotate-2">
              <BrainCircuit className="text-white" size={20} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">
              res<span className="text-orange-500">synth</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {enabledProviders.length > 0 && (
              <div className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <Sparkles size={12} className="text-orange-500" />
                {enabledProviders.length} model{enabledProviders.length > 1 ? 's' : ''} active
              </div>
            )}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
              title="Settings"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {!fileData && analysisState.status === AnalysisStatus.IDLE ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            
            <div className="absolute top-20 left-20 w-64 h-64 bg-purple-200/30 rounded-full blur-3xl -z-10"></div>
            <div className="absolute bottom-20 right-20 w-80 h-80 bg-orange-100/50 rounded-full blur-3xl -z-10"></div>

            <div className="text-center max-w-3xl mx-auto mb-8">
              <div className="inline-block mb-5">
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-sm rotate-1 inline-block">
                  Multi-Agent UX Research
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 leading-tight tracking-tight">
                turn interviews into insights <br/> 
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500">
                  with AI agents
                </span>
              </h2>
              <p className="text-slate-500 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                Upload your usability testing video or audio. Specialized AI agents analyze visual interactions, 
                verbal protocol, and sentiment, then a supervisor synthesizes the final insight report.
              </p>
            </div>
            
            <UploadSection 
              onFileSelected={handleFileSelected} 
              isLoading={false}
              hasModels={hasModels}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />

            {/* Feature cards */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full px-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-purple-500 bg-purple-50 w-fit p-2.5 rounded-xl mb-3">
                  <span className="font-bold text-xl">6+</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-0.5">AI Models</h3>
                <p className="text-slate-500 text-xs">Gemini, Claude, Kimi, Qwen, Groq, OpenRouter with automatic fallback.</p>
              </div>
              
              <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-pink-500 bg-pink-50 w-fit p-2.5 rounded-xl mb-3">
                  <Smile size={22} />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-0.5">Multi-Agent</h3>
                <p className="text-slate-500 text-xs">Video and audio agents analyze in parallel. Supervisor synthesizes insights.</p>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-orange-500 bg-orange-50 w-fit p-2.5 rounded-xl mb-3">
                  <BarChart3 size={22} />
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-0.5">Token Tracking</h3>
                <p className="text-slate-500 text-xs">Real-time cost tracking per provider. Use your own API keys.</p>
              </div>
            </div>
          </div>
        ) : (
          <AnalysisView 
            fileData={fileData} 
            analysisState={analysisState} 
            onReset={handleReset}
            onRetry={() => {
              if (fileData) startAnalysis(fileData.file);
            }}
            estimatedTimeMs={estimatedTimeMs}
            sessionUsage={sessionUsage}
          />
        )}
      </main>

      <footer className="py-6 text-center text-slate-400 text-xs border-t border-slate-100 bg-white">
        <p>&copy; {new Date().getFullYear()} ResSynth AI <span className="text-slate-200 mx-1.5">|</span> Multi-agent UX research synthesis</p>
      </footer>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={refreshModelStatus}
      />
    </div>
  );
};

export default App;
