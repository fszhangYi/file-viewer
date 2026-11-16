import { Suspense, lazy, type ReactNode } from 'react';
import { Spin } from 'antd';
import type { OpenedFile } from '../types';
import { MarkdownViewer } from './MarkdownViewer';
import { TextViewer } from './TextViewer';
import { ImageViewer } from './ImageViewer';
import { VideoViewer } from './VideoViewer';
import { ArchivePanel } from './ArchivePanel';
import { UnsupportedPanel } from './UnsupportedPanel';

const PdfViewer = lazy(() =>
  import('./PdfViewer').then((m) => ({ default: m.PdfViewer })),
);
const DocxViewer = lazy(() =>
  import('./DocxViewer').then((m) => ({ default: m.DocxViewer })),
);
const ExcelViewer = lazy(() =>
  import('./ExcelViewer').then((m) => ({ default: m.ExcelViewer })),
);
const CadViewer = lazy(() =>
  import('./CadViewer').then((m) => ({ default: m.CadViewer })),
);
const PointCloudViewer = lazy(() =>
  import('./PointCloudViewer').then((m) => ({ default: m.PointCloudViewer })),
);

interface Props {
  file: OpenedFile;
}

function LazyWrap({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="viewer-pane viewer-loading">
          <Spin tip="加载预览组件…" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function ViewerRouter({ file }: Props) {
  switch (file.kind) {
    case 'markdown':
      return <MarkdownViewer file={file} />;
    case 'text':
      return <TextViewer file={file} />;
    case 'image':
      return <ImageViewer file={file} />;
    case 'video':
      return <VideoViewer file={file} />;
    case 'pdf':
      return (
        <LazyWrap>
          <PdfViewer file={file} />
        </LazyWrap>
      );
    case 'docx':
      return (
        <LazyWrap>
          <DocxViewer file={file} />
        </LazyWrap>
      );
    case 'excel':
      return (
        <LazyWrap>
          <ExcelViewer file={file} />
        </LazyWrap>
      );
    case 'stl':
    case 'step':
      return (
        <LazyWrap>
          <CadViewer file={file} />
        </LazyWrap>
      );
    case 'pointcloud':
      return (
        <LazyWrap>
          <PointCloudViewer file={file} />
        </LazyWrap>
      );
    case 'archive':
      return <ArchivePanel file={file} />;
    default:
      return <UnsupportedPanel file={file} />;
  }
}
