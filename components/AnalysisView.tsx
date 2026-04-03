import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { FileData, AnalysisState, AnalysisStatus, AgentStatus, TokenUsage, ProviderID } from '../types';
import { Spinner } from './Spinner';
import { Check, Copy, RefreshCw, AlertTriangle, FileText, Download, Bot, CircleDot } from 'lucide-react';
import { PROVIDER_CONFIGS } from '../services/providers/registry';
import { formatTokenCount, formatCost, getSessionUsage } from '../services/tokenTracker';

interface AnalysisViewProps {
  fileData: FileData | null;
  analysisState: AnalysisState;
  onReset: () => void;
  onRetry: () => void;
  estimatedTimeMs?: number;
  sessionUsage?: TokenUsage[];
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ 
  fileData, analysisState, onReset, onRetry, estimatedTimeMs = 90000, sessionUsage = []
}) => {
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const isProcessing = analysisState.status === AnalysisStatus.PROCESSING;
  const isCompleted = analysisState.status === AnalysisStatus.COMPLETED;
  const isError = analysisState.status === AnalysisStatus.ERROR;

  useEffect(() => {
    if (isProcessing) {
      const startTime = Date.now();
      const timer = setInterval(() => setElapsedMs(Date.now() - startTime), 1000);
      return () => clearInterval(timer);
    } else if (isCompleted) {
      setProgress(100);
    } else {
      setElapsedMs(0);
      setProgress(0);
    }
  }, [isProcessing, isCompleted]);

  useEffect(() => {
    if (isProcessing && estimatedTimeMs > 0) {
      setProgress(Math.min((elapsedMs / estimatedTimeMs) * 100, 95));
    }
  }, [elapsedMs, estimatedTimeMs, isProcessing]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const handleCopy = () => {
    if (analysisState.result) {
      navigator.clipboard.writeText(analysisState.result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (analysisState.result) {
      const blob = new Blob([analysisState.result], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usability_insights_${new Date().toISOString().slice(0,10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const usageStats = getSessionUsage(sessionUsage);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
      
      {/* Left Column */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        
        {/* Media Card */}
        {fileData && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                {fileData.type === 'video' ? 'Source Recording' : 'Audio Recording'}
              </h3>
              <button 
                onClick={onReset}
                className="text-xs font-semibold text-slate-400 hover:text-orange-500 transition-colors px-3 py-1 rounded-full bg-slate-50 hover:bg-orange-50"
              >
                New Analysis
              </button>
            </div>
            <div className="relative bg-slate-50 aspect-video flex items-center justify-center">
              {fileData.type === 'video' ? (
                <video src={fileData.previewUrl} controls className="w-full h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-4 text-slate-400 w-full p-6">
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border-2 border-slate-100">
                    <FileText size={28} className="text-slate-300" />
                  </div>
                  <audio src={fileData.previewUrl} controls className="w-full accent-orange-500" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agent Status Cards */}
        {isProcessing && (
          <div className="bg-white border border-orange-100 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Spinner className="w-5 h-5 text-orange-500" />
              <h3 className="font-bold text-slate-900">Analysis in Progress</h3>
            </div>
            
            <p className="text-sm text-slate-600 font-medium">
              {analysisState.step || 'Preparing analysis...'}
            </p>

            {/* Agent pipeline */}
            {analysisState.activeAgents && analysisState.activeAgents.length > 0 && (
              <div className="space-y-2">
                {analysisState.activeAgents.map(agent => (
                  <div key={agent.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      agent.status === 'running' ? 'bg-orange-500 animate-pulse' :
                      agent.status === 'completed' ? 'bg-green-500' :
                      agent.status === 'failed' ? 'bg-red-500' :
                      'bg-slate-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{agent.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{agent.task}</p>
                    </div>
                    {agent.tokensUsed && (
                      <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                        {formatTokenCount(agent.tokensUsed)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>Elapsed: {formatTime(elapsedMs)}</span>
              <span>Est: ~{formatTime(estimatedTimeMs)}</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center space-y-3">
            <AlertTriangle size={24} className="text-red-500 mx-auto" />
            <h3 className="font-bold text-red-700">Analysis Failed</h3>
            <p className="text-sm text-red-600/80">{analysisState.error}</p>
            <button 
              onClick={onRetry}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {/* Session Token Usage (shown when completed) */}
        {isCompleted && sessionUsage.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-700 mb-3">Session Usage</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-3 bg-slate-50 rounded-xl text-center">
                <p className="text-lg font-bold text-slate-900">{formatTokenCount(usageStats.totalTokens)}</p>
                <p className="text-[10px] text-slate-500">Tokens</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl text-center">
                <p className="text-lg font-bold text-slate-900">{formatCost(usageStats.totalCost)}</p>
                <p className="text-[10px] text-slate-500">Est. Cost</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {Object.entries(usageStats.byProvider).map(([pid, data]) => (
                <div key={pid} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_CONFIGS[pid as ProviderID]?.color || '#888' }} />
                    <span className="text-slate-600">{PROVIDER_CONFIGS[pid as ProviderID]?.name || pid}</span>
                  </div>
                  <span className="text-slate-400 font-medium">{formatTokenCount(data.tokens)} / {formatCost(data.cost)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Report */}
      <div className="lg:col-span-7 flex flex-col h-[600px] lg:h-auto min-h-[500px]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-orange-100 p-1.5 rounded-lg">
              <FileText className="text-orange-600" size={18} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Research Insights</h2>
          </div>
          
          {isCompleted && (
            <div className="flex items-center gap-2">
              <button onClick={handleDownload} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors" title="Download Markdown">
                <Download size={16} />
              </button>
              <button
                onClick={handleCopy}
                className={`p-2 rounded-lg transition-colors ${copied ? "text-green-600 bg-green-50" : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"}`}
                title="Copy"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          )}
        </div>

        <div className={`flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${!isCompleted ? "flex items-center justify-center" : ""}`}>
          {isCompleted ? (
            <div className="h-full overflow-y-auto p-6 md:p-8">
              <div className="markdown-body">
                <ReactMarkdown>{analysisState.result || ''}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="text-center p-8 max-w-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl rotate-3 flex items-center justify-center mx-auto mb-4 border border-slate-100 text-slate-300">
                <FileText size={32} />
              </div>
              <h4 className="text-slate-900 font-bold mb-1">
                {isProcessing ? 'Analyzing...' : 'Ready to Analyze'}
              </h4>
              <p className="text-sm text-slate-500">
                {isProcessing ? 'Multi-agent analysis in progress...' : 'Upload a session recording to generate insights.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
