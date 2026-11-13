import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Layout,
  Space,
  Typography,
  theme,
  message,
} from 'antd';
import {
  DownloadOutlined,
  FolderOpenOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import type { OpenedFile } from './types';
import { LARGE_FILE_WARN_BYTES, formatBytes } from './types';
import {
  capabilities,
  downloadFile,
  openFiles,
  pickDirectory,
  toOpenedFile,
} from './platform';
import { fetchFileBuffer, fetchList, fetchState, type DirEntry } from './api';
import { FileBrowser } from './components/FileBrowser';
import { ViewerRouter } from './viewers/ViewerRouter';

const { Header, Sider, Content } = Layout;
const NARROW_MQ = '(max-width: 768px)';

export default function App() {
  const { token } = theme.useToken();
  const [rootDir, setRootDir] = useState('');
  const [cwd, setCwd] = useState('');
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [file, setFile] = useState<OpenedFile | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(NARROW_MQ).matches : false,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(NARROW_MQ);
    const onChange = () => {
      const next = mq.matches;
      setNarrow(next);
      if (next) setCollapsed(true);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const refreshList = useCallback(async (nextCwd: string) => {
    setListLoading(true);
    try {
      const listing = await fetchList(nextCwd);
      setRootDir(listing.rootDir);
      setCwd(listing.cwd);
      setEntries(listing.entries);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '读取目录失败');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const state = await fetchState();
        setRootDir(state.rootDir);
      } catch {
        /* list will surface error */
      }
      await refreshList('');
    })();
  }, [refreshList]);

  useEffect(() => {
    if (!window.fileViewer?.onRootChanged) return undefined;
    return window.fileViewer.onRootChanged((state) => {
      setRootDir(state.rootDir);
      setFile(null);
      setSelectedPath(null);
      void refreshList('');
      message.success(`已切换目录：${state.rootDir}`);
    });
  }, [refreshList]);

  const openEntryFile = useCallback(async (entry: DirEntry) => {
    setPreviewLoading(true);
    setSelectedPath(entry.relPath);
    try {
      const payload = await fetchFileBuffer(entry.relPath);
      if (payload.size > LARGE_FILE_WARN_BYTES) {
        message.warning(`文件较大（${formatBytes(payload.size)}），预览可能较慢`);
      }
      setFile(
        toOpenedFile({
          name: payload.name,
          size: payload.size,
          lastModified: payload.lastModified,
          mimeType: payload.mimeType,
          path: entry.relPath,
          buffer: payload.buffer,
        }),
      );
      if (window.matchMedia(NARROW_MQ).matches) setCollapsed(true);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '打开文件失败');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleOpenParent = useCallback(() => {
    if (!cwd) return;
    const parent = cwd.includes('/') ? cwd.split('/').slice(0, -1).join('/') : '';
    setFile(null);
    setSelectedPath(null);
    void refreshList(parent);
  }, [cwd, refreshList]);

  const handleOpenDir = useCallback(
    (entry: DirEntry) => {
      setFile(null);
      setSelectedPath(null);
      void refreshList(entry.relPath);
    },
    [refreshList],
  );

  const handleNavigateCwd = useCallback(
    (next: string) => {
      setFile(null);
      setSelectedPath(null);
      void refreshList(next);
    },
    [refreshList],
  );

  const handlePickDir = useCallback(async () => {
    setBusy(true);
    try {
      const next = await pickDirectory();
      if (!next) return;
      // IPC already updates server + emits; refresh as fallback
      setFile(null);
      setSelectedPath(null);
      await refreshList('');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '选择目录失败');
    } finally {
      setBusy(false);
    }
  }, [refreshList]);

  const handleOpenExtraFile = useCallback(async () => {
    setBusy(true);
    try {
      const opened = await openFiles();
      if (opened[0]) {
        if (opened[0].size > LARGE_FILE_WARN_BYTES) {
          message.warning(`文件较大（${formatBytes(opened[0].size)}），预览可能较慢`);
        }
        setFile(opened[0]);
        setSelectedPath(null);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '打开文件失败');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!file) return;
    downloadFile(file.name, file.buffer, file.mimeType);
  }, [file]);

  const kindLabel = useMemo(() => {
    if (!file) return '—';
    const map: Record<string, string> = {
      stl: 'STL',
      step: 'STEP',
      markdown: 'Markdown',
      docx: 'Word',
      pdf: 'PDF',
      excel: 'Excel',
      image: '图片',
      video: '视频',
      text: '文本',
      archive: '压缩包',
      unsupported: '未支持',
    };
    return map[file.kind] ?? file.kind;
  }, [file]);

  const siderOpen = !collapsed;

  return (
    <Layout className={`app-shell${narrow ? ' is-narrow' : ''}`} style={{ minHeight: 0 }}>
      <Header className="app-header" style={{ background: token.colorBgContainer, flexShrink: 0 }}>
        <div className="app-brand">
          <Typography.Title level={4} className="app-title">
            File Viewer
          </Typography.Title>
          <Typography.Text type="secondary" className="app-badge">
            {capabilities.isElectronShell ? 'Desktop' : 'Web'}
          </Typography.Text>
        </div>
        <Space className="app-actions" size="small" wrap>
          {capabilities.canPickDir && (
            <Button
              type="primary"
              icon={<FolderOpenOutlined />}
              loading={busy}
              onClick={() => void handlePickDir()}
            >
              <span className="btn-label">选择目录</span>
            </Button>
          )}
          <Button icon={<FolderOpenOutlined />} loading={busy} onClick={() => void handleOpenExtraFile()}>
            <span className="btn-label">打开文件</span>
          </Button>
          {capabilities.canDownload && (
            <Button icon={<DownloadOutlined />} disabled={!file} onClick={handleDownload}>
              <span className="btn-label">下载</span>
            </Button>
          )}
          <Button
            type="text"
            aria-label={siderOpen ? '收起文件列表' : '展开文件列表'}
            icon={siderOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={() => setCollapsed((c) => !c)}
          />
        </Space>
      </Header>
      <Layout className="app-body">
        <Sider
          width={300}
          collapsible
          collapsed={collapsed}
          trigger={null}
          collapsedWidth={0}
          theme="light"
          className={`app-sider app-sider-left${siderOpen ? ' is-open' : ''}`}
        >
          <FileBrowser
            rootDir={rootDir || '…'}
            cwd={cwd}
            entries={entries}
            loading={listLoading}
            selectedPath={selectedPath}
            onOpenParent={handleOpenParent}
            onOpenDir={handleOpenDir}
            onOpenFile={(e) => void openEntryFile(e)}
            onNavigateCwd={handleNavigateCwd}
          />
        </Sider>
        {narrow && siderOpen && (
          <button
            type="button"
            className="sider-mask"
            aria-label="关闭文件列表"
            onClick={() => setCollapsed(true)}
          />
        )}
        <Content className="app-content">
          {previewLoading ? (
            <div className="viewer-pane viewer-loading">
              <Typography.Text type="secondary">加载预览…</Typography.Text>
            </div>
          ) : file ? (
            <>
              <div className="preview-meta">
                <Typography.Text strong>{file.name}</Typography.Text>
                <Typography.Text type="secondary">
                  {kindLabel} · {formatBytes(file.size)}
                </Typography.Text>
              </div>
              <ViewerRouter file={file} />
            </>
          ) : (
            <div className="drop-wrap">
              <Empty
                description={
                  rootDir
                    ? '双击左侧文件预览；双击文件夹进入该层'
                    : '等待服务端目录…'
                }
              />
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
