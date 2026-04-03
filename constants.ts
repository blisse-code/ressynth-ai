export const MAX_FILE_SIZE_MB = 750;

export const APP_VERSION = '2.0.0';

export const FILE_SIZE_WARNING = `Maximum file size: 750MB. For best results, compress your recording before uploading using HandBrake (free) or FFmpeg. Use H.264 codec with CRF 18-23 for visually lossless quality at significantly smaller file sizes.`;

export const SUPPORTED_FORMATS = {
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'],
};
