import React, { useState, useEffect } from 'react';
import { X, Key, GripVertical, Check, AlertCircle, Zap, Brain, Eye, Ear, ChevronDown, ChevronUp, ExternalLink, BarChart3 } from 'lucide-react';
import { ProviderID, UserProviderSettings } from '../../types';
import { PROVIDER_CONFIGS, DEFAULT_FALLBACK_ORDER, loadProviderSettings, saveProviderSettings } from '../../services/providers/registry';
import { getLifetimeStats, formatTokenCount, formatCost } from '../../services/tokenTracker';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState<UserProviderSettings[]>([]);
  const [expandedProvider, setExpandedProvider] = useState<ProviderID | null>(null);
  const [activeTab, setActiveTab] = useState<'providers' | 'integrations' | 'usage'>('providers');
  const [saved, setSaved] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');

  useEffect(() => {
    if (isOpen) {
      const existing = loadProviderSettings();
      setGoogleClientId(localStorage.getItem('ressynth_google_client_id') || '');
      // Ensure all providers have entries
      const allSettings: UserProviderSettings[] = DEFAULT_FALLBACK_ORDER.map((id, idx) => {
        const found = existing.find(s => s.id === id);
        return found || {
          id,
          apiKey: '',
          enabled: false,
          selectedModel: PROVIDER_CONFIGS[id].models[0].id,
          priority: idx + 1,
        };
      });
      setSettings(allSettings);
      setSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyChange = (id: ProviderID, apiKey: string) => {
    setSettings(prev => prev.map(s =>
      s.id === id ? { ...s, apiKey, enabled: apiKey.length > 0 } : s
    ));
    setSaved(false);
  };

  const handleModelChange = (id: ProviderID, modelId: string) => {
    setSettings(prev => prev.map(s =>
      s.id === id ? { ...s, selectedModel: modelId } : s
    ));
    setSaved(false);
  };

  const handleToggle = (id: ProviderID) => {
    setSettings(prev => prev.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled && s.apiKey.length > 0 } : s
    ));
    setSaved(false);
  };

  const handleSave = () => {
    saveProviderSettings(settings);
    localStorage.setItem('ressynth_google_client_id', googleClientId.trim());
    setSaved(true);
    onSave();
    setTimeout(() => onClose(), 600);
  };

  const enabledCount = settings.filter(s => s.enabled && s.apiKey).length;
  const stats = getLifetimeStats();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Settings</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {enabledCount > 0 ? `${enabledCount} model${enabledCount > 1 ? 's' : ''} active` : 'Add at least one API key to start'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0">
          <button
            onClick={() => setActiveTab('providers')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'providers'
                ? 'text-orange-600 border-b-2 border-orange-500'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            AI Models
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'integrations'
                ? 'text-orange-600 border-b-2 border-orange-500'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Integrations
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'usage'
                ? 'text-orange-600 border-b-2 border-orange-500'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Token Usage
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'providers' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-4 p-3 bg-slate-50 rounded-xl leading-relaxed">
                Models are ordered by accuracy for UX analysis. The system will use the first available model, 
                falling back through the chain if tokens run out or errors occur. Add your API keys below.
              </p>

              {settings
                .sort((a, b) => a.priority - b.priority)
                .map((setting, idx) => {
                  const config = PROVIDER_CONFIGS[setting.id];
                  const isExpanded = expandedProvider === setting.id;
                  const cap = config.capabilities;

                  return (
                    <div
                      key={setting.id}
                      className={`border rounded-xl overflow-hidden transition-all ${
                        setting.enabled && setting.apiKey
                          ? 'border-green-200 bg-green-50/30'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      {/* Provider header */}
                      <div className="flex items-center gap-3 p-4">
                        <div className="flex items-center gap-1 text-slate-300 text-xs font-bold shrink-0 w-6">
                          {idx + 1}
                        </div>

                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: config.color }}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">{config.name}</span>
                            {cap.nativeVideo && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                <Eye size={10} /> Video
                              </span>
                            )}
                            {cap.nativeAudio && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded">
                                <Ear size={10} /> Audio
                              </span>
                            )}
                            {cap.accuracy === 'high' && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                <Brain size={10} /> Accurate
                              </span>
                            )}
                            {cap.speed === 'fast' && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                <Zap size={10} /> Fast
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{config.description}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {setting.apiKey && (
                            <button
                              onClick={() => handleToggle(setting.id)}
                              className={`w-10 h-5 rounded-full transition-colors relative ${
                                setting.enabled ? 'bg-green-500' : 'bg-slate-200'
                              }`}
                            >
                              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                setting.enabled ? 'left-5' : 'left-0.5'
                              }`} />
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedProvider(isExpanded ? null : setting.id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded config */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-slate-500 flex items-center gap-1 mb-1.5">
                              <Key size={12} /> API Key
                            </label>
                            <input
                              type="password"
                              value={setting.apiKey}
                              onChange={(e) => handleKeyChange(setting.id, e.target.value)}
                              placeholder={config.apiKeyPlaceholder}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Model</label>
                            <select
                              value={setting.selectedModel}
                              onChange={(e) => handleModelChange(setting.id, e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-orange-400"
                            >
                              {config.models.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.name} - {m.description}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>~${cap.costPerMillionTokens.toFixed(2)}/M tokens</span>
                            <a
                              href={config.docsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-orange-500 hover:text-orange-600"
                            >
                              Get API key <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 mb-2 p-3 bg-slate-50 rounded-xl leading-relaxed">
                Optional integrations. Currently supports Google Drive for importing recordings directly from your cloud storage.
              </p>

              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#4285F4' }} />
                  <h4 className="font-semibold text-sm text-slate-900">Google Drive</h4>
                  {googleClientId.trim() && googleClientId.endsWith('.apps.googleusercontent.com') && (
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">Configured</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Paste your Google OAuth Client ID below to enable "Import from Google Drive" on the upload screen. 
                  The Client ID is stored only in this browser.
                </p>

                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">OAuth Client ID</label>
                  <input
                    type="text"
                    value={googleClientId}
                    onChange={(e) => { setGoogleClientId(e.target.value); setSaved(false); }}
                    placeholder="123456789-xxxxxxxxxx.apps.googleusercontent.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10"
                  />
                </div>

                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-900">How to get a Client ID</summary>
                  <ol className="mt-2 space-y-1.5 pl-4 list-decimal leading-relaxed">
                    <li>Go to <a className="text-orange-600 hover:underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">console.cloud.google.com/apis/credentials</a></li>
                    <li>Select or create a project</li>
                    <li>Enable "Google Drive API" under APIs & Services → Library</li>
                    <li>Configure the OAuth consent screen (External, add yourself as a test user)</li>
                    <li>Create Credentials → OAuth Client ID → Web application</li>
                    <li>Authorized JavaScript origins: <code className="bg-slate-100 px-1 rounded">https://resynth-six.vercel.app</code></li>
                    <li>Copy the Client ID and paste it above. Save.</li>
                  </ol>
                </details>
              </div>
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-slate-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-slate-900">{formatTokenCount(stats.totalTokens)}</p>
                  <p className="text-xs text-slate-500 mt-1">Total tokens</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-slate-900">{formatCost(stats.totalCost)}</p>
                  <p className="text-xs text-slate-500 mt-1">Total cost</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-slate-900">{stats.totalSessions}</p>
                  <p className="text-xs text-slate-500 mt-1">Sessions</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-700">By provider</h4>
                {Object.entries(stats.byProvider).map(([provider, data]) => (
                  <div key={provider} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: PROVIDER_CONFIGS[provider as ProviderID]?.color || '#888' }}
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {PROVIDER_CONFIGS[provider as ProviderID]?.name || provider}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-slate-900">{formatTokenCount(data.tokens)}</span>
                      <span className="text-xs text-slate-400 ml-2">{formatCost(data.cost)}</span>
                    </div>
                  </div>
                ))}

                {Object.keys(stats.byProvider).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">No usage data yet. Run an analysis to see stats.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 shrink-0">
          <button
            onClick={handleSave}
            disabled={saved}
            className={`w-full py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 ${
              saved
                ? 'bg-green-500'
                : 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20'
            }`}
          >
            {saved ? <><Check size={16} /> Saved</> : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
