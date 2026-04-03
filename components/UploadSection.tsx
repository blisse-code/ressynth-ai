import React, { useRef, useState } from 'react';
import { Upload, FileAudio, FileVideo, AlertCircle, Info } from 'lucide-react';
import { MAX_FILE_SIZE_MB, FILE_SIZE_WARNING } from '../constants';

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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const fileSizeMB = file.size / (1024 * 1024);

    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      setError(`File is ${fileSizeMB.toFixed(0)}MB, exceeding the ${MAX_FILE_SIZE_MB}MB limit. Please compress your file first (see tips below).`);
      return;
    }

    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      setError('Please upload a valid video (MP4, WebM) or audio (MP3, WAV) file.');
      return;
    }

    if (!hasModels) {
      setError('No AI models configured. Please add at least one API key in Settings first.');
      return;
    }

    setError(null);
    onFileSelected(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-4 px-4">
      {!hasModels && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">No AI models configured</p>
            <p className="mt-1">Add at least one API key to start analyzing recordings.</p>
            <button 
              onClick={onOpenSettings}
              className="mt-2 px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors"
            >
              Open Settings
            </button>
          </div>
        </div>
      )}

      <div 
        className={`
          relative flex flex-col items-center justify-center w-full min-h-[18rem] py-6
          rounded-2xl border-2 border-dashed transition-all duration-300 bg-white
          shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)]
          ${dragActive ? "border-orange-500 bg-orange-50/50 scale-[1.01]" : "border-slate-200 hover:border-orange-300 hover:shadow-md"}
          ${isLoading ? "opacity-50 pointer-events-none" : hasModels ? "cursor-pointer" : "opacity-60"}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => hasModels && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="video/*,audio/*"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={isLoading || !hasModels}
        />
        
        <div className="flex flex-col items-center text-center p-6 space-y-4">
          <div className={`p-4 rounded-xl transition-colors ${
            dragActive ? "bg-orange-100 text-orange-600" : "bg-slate-50 text-orange-500"
          }`}>
            <Upload size={32} strokeWidth={2} />
          </div>
          
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900">Upload Session Recording</h3>
            <p className="text-slate-500 text-sm font-medium">Drag and drop or click to browse</p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
            <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
              <FileVideo size={12} className="text-purple-500" /> MP4, WebM
            </span>
            <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
              <FileAudio size={12} className="text-pink-500" /> MP3, WAV
            </span>
            <span className="text-slate-400">Max {MAX_FILE_SIZE_MB}MB</span>
          </div>
        </div>

        {dragActive && (
          <div className="absolute inset-0 rounded-2xl bg-orange-500/5 flex items-center justify-center">
            <p className="text-lg font-bold text-orange-600 bg-white/90 px-5 py-2 rounded-xl shadow-sm">
              Drop to analyze
            </p>
          </div>
        )}
      </div>

      {/* Compression tip */}
      <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-2">
        <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          {FILE_SIZE_WARNING}
        </p>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2.5 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}
    </div>
  );
};
