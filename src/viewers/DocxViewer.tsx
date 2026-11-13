import { useEffect, useRef, useState } from 'react';
import { Spin, Alert } from 'antd';
import { renderAsync } from 'docx-preview';
import type { OpenedFile } from '../types';

interface Props {
  file: OpenedFile;
}

export function DocxViewer({ file }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = '';
    setLoading(true);
    setError(null);

    renderAsync(file.buffer, host, undefined, {
      className: 'docx-preview-body',
      inWrapper: true,
      ignoreWidth: false,
      breakPages: true,
    })
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoading(false);
          setError(err instanceof Error ? err.message : 'DOCX 渲染失败');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file.id, file.buffer]);

  return (
    <div className="viewer-pane docx-viewer">
      {loading && (
        <div className="viewer-loading">
          <Spin tip="渲染 DOCX…" />
        </div>
      )}
      {error && <Alert type="error" message={error} showIcon />}
      <div ref={hostRef} className="docx-host" />
    </div>
  );
}
