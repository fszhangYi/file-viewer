export type ViewerKind =
  | 'stl'
  | 'step'
  | 'pointcloud'
  | 'markdown'
  | 'docx'
  | 'pdf'
  | 'excel'
  | 'image'
  | 'video'
  | 'text'
  | 'archive'
  | 'unsupported';

export interface OpenedFile {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  mimeType?: string;
  /** Absolute path when opened from Electron */
  path?: string;
  buffer: ArrayBuffer;
  kind: ViewerKind;
  extension: string;
}

export const ARCHIVE_EXTS = new Set([
  'zip',
  'tar',
  'gz',
  'tgz',
  '7z',
  'rar',
  'bz2',
  'xz',
]);

export const IMAGE_EXTS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
]);

export const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v']);

export const TEXT_EXTS = new Set([
  'txt',
  'json',
  'xml',
  'yaml',
  'yml',
  'log',
  'csv',
  'ts',
  'tsx',
  'js',
  'jsx',
  'css',
  'html',
  'htm',
  'sh',
  'bash',
  'zsh',
  'fish',
  'bat',
  'cmd',
  'ps1',
  'py',
  'rb',
  'go',
  'rs',
  'c',
  'cc',
  'cpp',
  'h',
  'hpp',
  'java',
  'kt',
  'swift',
  'sql',
  'toml',
  'ini',
  'cfg',
  'conf',
  'env',
  'gitignore',
  'dockerfile',
  'makefile',
  'cmake',
]);

export const LARGE_FILE_WARN_BYTES = 100 * 1024 * 1024;

export function getExtension(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.tar.gz')) return 'tar.gz';
  const idx = lower.lastIndexOf('.');
  return idx >= 0 ? lower.slice(idx + 1) : '';
}

export const POINTCLOUD_EXTS = new Set(['npz', 'npy', 'ply', 'pcd', 'xyz']);

export function detectKind(name: string): ViewerKind {
  const ext = getExtension(name);
  if (ext === 'stl') return 'stl';
  if (ext === 'stp' || ext === 'step') return 'step';
  if (POINTCLOUD_EXTS.has(ext)) return 'pointcloud';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'docx') return 'docx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'excel';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (
    ARCHIVE_EXTS.has(ext) ||
    ext === 'tar.gz' ||
    name.toLowerCase().endsWith('.tar.gz')
  ) {
    return 'archive';
  }
  if (TEXT_EXTS.has(ext)) return 'text';
  return 'unsupported';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
