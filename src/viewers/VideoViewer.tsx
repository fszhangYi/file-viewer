import { useEffect, useMemo, useState } from 'react';
import type { OpenedFile } from '../types';
import { bufferToObjectUrl } from './utils';

interface Props {
  file: OpenedFile;
}

const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
};

export function VideoViewer({ file }: Props) {
  const url = useMemo(
    () =>
      bufferToObjectUrl(
        file.buffer,
        file.mimeType || MIME[file.extension] || 'video/mp4',
      ),
    [file.buffer, file.extension, file.mimeType],
  );
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    setAlive(true);
    return () => {
      URL.revokeObjectURL(url);
      setAlive(false);
    };
  }, [url]);

  if (!alive) return null;

  return (
    <div className="viewer-pane video-viewer">
      <video
        key={file.id}
        src={url}
        controls
        playsInline
        preload="metadata"
      >
        当前浏览器无法播放此视频。
      </video>
    </div>
  );
}
