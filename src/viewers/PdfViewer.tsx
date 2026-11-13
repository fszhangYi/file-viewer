import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Alert, Button, Space, Spin } from 'antd';
import type { OpenedFile } from '../types';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface Props {
  file: OpenedFile;
}

function pageWidthFor(containerWidth: number): number {
  const gutter = 24;
  return Math.max(240, Math.min(900, Math.floor(containerWidth - gutter)));
}

export function PdfViewer({ file }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(() =>
    pageWidthFor(typeof window !== 'undefined' ? window.innerWidth : 900),
  );

  useEffect(() => {
    const url = URL.createObjectURL(
      new Blob([file.buffer], { type: file.mimeType || 'application/pdf' }),
    );
    setObjectUrl(url);
    setPage(1);
    setPages(0);
    setLoading(true);
    setError(null);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file.id, file.buffer, file.mimeType]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const update = () => setPageWidth(pageWidthFor(el.clientWidth || window.innerWidth));
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [objectUrl]);

  return (
    <div className="viewer-pane pdf-viewer">
      <div className="viewer-toolbar">
        <Space wrap size="small">
          <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </Button>
          <span>
            {page} / {pages || '—'}
          </span>
          <Button
            size="small"
            disabled={!pages || page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </Space>
      </div>
      <div className="pdf-page-wrap" ref={wrapRef}>
        {loading && (
          <div className="viewer-loading">
            <Spin tip="加载 PDF…" />
          </div>
        )}
        {error && <Alert type="error" showIcon message={error} style={{ margin: 12 }} />}
        {objectUrl && (
          <Document
            key={file.id}
            file={objectUrl}
            loading={null}
            onLoadSuccess={({ numPages }) => {
              setPages(numPages);
              setLoading(false);
              setError(null);
            }}
            onLoadError={(err) => {
              setLoading(false);
              setError(err?.message || 'PDF 加载失败');
            }}
          >
            <Page pageNumber={page} width={pageWidth} />
          </Document>
        )}
      </div>
    </div>
  );
}
