import React, { useRef, useState } from 'react';
import { Upload, FileAudio, FileVideo, AlertCircle, Info, Cloud, X, Loader2 } from 'lucide-react';
import { MAX_FILE_SIZE_MB, FILE_SIZE_WARNING } from '../constants';

declare global {
  interface Window {
    google?: any;
  }
}

interface UploadSectionProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  hasModels: boolean;
  onOpenSettings: () => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ 
  onFileSelected, isLoading, hasModels, onOpenSettings 
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null | File[]) => {
    if (!files || files.length === 0) return;
    const file = files instanceof FileList ? files[0] : files[0];
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      setError(`File is ${fileSizeMB.toFixed(0)}MB, exceeding the ${MAX_FILE_SIZE_MB}MB limit. Compress first.`);
      return;
    }
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      setError('Please upload a valid video (MP4, WebM) or audio (MP3, WAV) file.');
      return;
    }
    if (!hasModels) {
      setError('No AI models configured. Add at least one API key in Settings first.');
      return;
    }
    setError(null);
    onFileSelected(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const fetchDriveFiles = async (token: string, searchQuery: string = "") => {
    setIsLoadingDrive(true); setIsDriveModalOpen(true); setError(null);
    try {
      let query = "trashed = false and (mimeType contains 'video/' or mimeType contains 'audio/')";
      if (searchQuery) query += ` and name contains '${searchQuery.replace(/'/g, "\\'")}'`;
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size)&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error("Failed to fetch files from Google Drive");
      const data = await response.json();
      setDriveFiles(data.files || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch files from Google Drive");
      setIsDriveModalOpen(false);
    } finally { setIsLoadingDrive(false); }
  };

  const handleDriveFileSelect = async (file: any) => {
    if (!driveToken) return;
    setIsDriveModalOpen(false); setIsDownloading(true); setError(null);
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      if (!response.ok) throw new Error("Failed to download file from Google Drive");
      const blob = await response.blob();
      const downloadedFile = new File([blob], file.name, { type: file.mimeType });
      handleFiles([downloadedFile]);
    } catch (err: any) {
      setError(err.message || "Failed to download file from Google Drive");
    } finally { setIsDownloading(false); }
  };

  const handleDriveUpload = () => {
    if (!window.google) {
      setError("Google Identity Services not loaded. Please refresh and try again.");
      return;
    }
    const clientId = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      setError("Google Drive requires VITE_GOOGLE_CLIENT_ID in your environment. See README for setup.");
      return;
    }
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response: any) => {
          if (response.error) { setError("Google Drive auth failed: " + response.error); return; }
          setDriveToken(response.access_token);
          fetchDriveFiles(response.access_token);
        },
      });
      client.requestAccessToken();
    } catch (err: any) { setError("Failed to initialize Google Auth: " + err.message); }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-4 px-4">
      {!hasModels && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">No AI models configured</p>
            <p className="mt-1">Add at least one API key to start analyzing recordings.</p>
            <button onClick={onOpenSettings} className="mt-2 px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors">Open Settings</button>
          </div>
        </div>
      )}

      <div
        className={`relative flex flex-col items-center justify-center w-full min-h-[18rem] py-6 rounded-2xl border-2 border-dashed transition-all duration-300 bg-white shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] ${dragActive ? "border-orange-500 bg-orange-50/50 scale-[1.01]" : "border-slate-200 hover:border-orange-300 hover:shadow-md"} ${isLoading || isDownloading ? "opacity-50 pointer-events-none" : hasModels ? "cursor-pointer" : "opacity-60"}`}
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
        onClick={() => hasModels && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" className="hidden" accept="video/*,audio/*" onChange={(e) => handleFiles(e.target.files)} disabled={isLoading || isDownloading || !hasModels} />
        <div className="flex flex-col items-center text-center p-6 space-y-4">
          <div className={`p-4 rounded-xl transition-colors ${dragActive ? "bg-orange-100 text-orange-600" : "bg-slate-50 text-orange-500"}`}>
            <Upload size={32} strokeWidth={2} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900">Upload Session Recording</h3>
            <p className="text-slate-500 text-sm font-medium">Drag and drop or click to browse</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
            <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100"><FileVideo size={12} className="text-purple-500" /> MP4, WebM</span>
            <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100"><FileAudio size={12} className="text-pink-500" /> MP3, WAV</span>
            <span className="text-slate-400">Max {MAX_FILE_SIZE_MB}MB</span>
          </div>
        </div>
        {dragActive && (
          <div className="absolute inset-0 rounded-2xl bg-orange-500/5 flex items-center justify-center">
            <p className="text-lg font-bold text-orange-600 bg-white/90 px-5 py-2 rounded-xl shadow-sm">Drop to analyze</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-center">
        <button type="button" onClick={(e) => { e.stopPropagation(); handleDriveUpload(); }} disabled={isLoading || isDownloading || !hasModels}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 hover:shadow-md transition-all text-slate-700 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          <Cloud size={18} className="text-blue-500" />
          {isDownloading ? "Downloading from Drive..." : "Import from Google Drive"}
        </button>
      </div>

      <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-2">
        <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">{FILE_SIZE_WARNING}</p>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2.5 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 text-sm">
          <AlertCircle size={16} className="shrink-0" /><span className="font-medium">{error}</span>
        </div>
      )}

      {isDriveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Cloud className="text-blue-500" size={20} /> Select from Google Drive</h3>
              <button type="button" onClick={() => setIsDriveModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50">
              <div className="mb-4">
                <input type="text" placeholder="Search files across all drives..." className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  onChange={(e) => { if (driveToken) fetchDriveFiles(driveToken, e.target.value); }} />
              </div>
              {isLoadingDrive ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500"><Loader2 size={32} className="animate-spin mb-4 text-blue-500" /><p className="text-sm">Loading your files...</p></div>
              ) : driveFiles.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm"><p>No video or audio files found in your Google Drive.</p></div>
              ) : (
                <div className="grid gap-2">
                  {driveFiles.map((file: any) => (
                    <button key={file.id} type="button" onClick={() => handleDriveFileSelect(file)}
                      className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all text-left group">
                      <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                        {file.mimeType.startsWith('video/') ? <FileVideo size={20} className="text-purple-500" /> : <FileAudio size={20} className="text-pink-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-700 truncate">{file.name}</p>
                        {file.size && <p className="text-xs text-slate-400">{(parseInt(file.size) / (1024 * 1024)).toFixed(2)} MB</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
