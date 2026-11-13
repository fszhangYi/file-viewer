import { useEffect, useMemo, useState } from 'react';
import type { OpenedFile } from '../types';
import { bufferToObjectUrl } from './utils';

interface Props {
  file: OpenedFile;
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
};

export function ImageViewer({ file }: Props) {
  const url = useMemo(
    () => bufferToObjectUrl(file.buffer, MIME[file.extension] || 'application/octet-stream'),
    [file.buffer, file.extension],
  );
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    setRevoked(false);
    return () => {
      URL.revokeObjectURL(url);
      setRevoked(true);
    };
  }, [url]);

  if (revoked) return null;

  return (
    <div className="viewer-pane image-viewer">
      <img src={url} alt={file.name} />
    </div>
  );
}
