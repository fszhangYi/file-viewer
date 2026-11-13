import { useMemo } from 'react';
import { Breadcrumb, Empty, List, Spin, Typography } from 'antd';
import {
  FileOutlined,
  FolderOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import type { DirEntry } from '../api';
import { formatBytes } from '../types';

interface Props {
  rootDir: string;
  cwd: string;
  entries: DirEntry[];
  loading?: boolean;
  selectedPath?: string | null;
  onOpenParent: () => void;
  onOpenDir: (entry: DirEntry) => void;
  onOpenFile: (entry: DirEntry) => void;
  onNavigateCwd: (cwd: string) => void;
}

export function FileBrowser({
  rootDir,
  cwd,
  entries,
  loading,
  selectedPath,
  onOpenParent,
  onOpenDir,
  onOpenFile,
  onNavigateCwd,
}: Props) {
  const crumbs = useMemo(() => {
    const parts = cwd ? cwd.split('/').filter(Boolean) : [];
    const items = [
      {
        title: (
          <button type="button" className="crumb-btn" onClick={() => onNavigateCwd('')}>
            根目录
          </button>
        ),
      },
    ];
    parts.forEach((part, idx) => {
      const target = parts.slice(0, idx + 1).join('/');
      items.push({
        title: (
          <button type="button" className="crumb-btn" onClick={() => onNavigateCwd(target)}>
            {part}
          </button>
        ),
      });
    });
    return items;
  }, [cwd, onNavigateCwd]);

  const rootLabel = useMemo(() => {
    const base = rootDir.replace(/\\/g, '/');
    const segs = base.split('/').filter(Boolean);
    return segs[segs.length - 1] || rootDir;
  }, [rootDir]);

  return (
    <div className="file-browser">
      <div className="file-browser-head">
        <Typography.Text strong ellipsis={{ tooltip: rootDir }}>
          {rootLabel}
        </Typography.Text>
        <Typography.Paragraph type="secondary" className="file-browser-root" ellipsis={{ tooltip: rootDir }}>
          {rootDir}
        </Typography.Paragraph>
        <Breadcrumb items={crumbs} className="file-browser-crumbs" />
      </div>
      {loading ? (
        <div className="file-browser-loading">
          <Spin size="small" />
        </div>
      ) : (
        <List
          className="file-browser-list"
          size="small"
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="空目录" /> }}
          dataSource={[
            ...(cwd
              ? [
                  {
                    name: '..',
                    type: 'dir' as const,
                    size: 0,
                    mtimeMs: 0,
                    relPath: '__parent__',
                  },
                ]
              : []),
            ...entries,
          ]}
          renderItem={(item) => {
            const isParent = item.relPath === '__parent__';
            const selected = !isParent && item.relPath === selectedPath;
            return (
              <List.Item
                className={`file-browser-item${selected ? ' is-selected' : ''}`}
                onDoubleClick={() => {
                  if (isParent) onOpenParent();
                  else if (item.type === 'dir') onOpenDir(item);
                  else onOpenFile(item);
                }}
              >
                <div className="file-browser-row">
                  <span className="file-browser-icon">
                    {isParent ? (
                      <ArrowUpOutlined />
                    ) : item.type === 'dir' ? (
                      <FolderOutlined />
                    ) : (
                      <FileOutlined />
                    )}
                  </span>
                  <span className="file-browser-name" title={item.name}>
                    {item.name}
                  </span>
                  {!isParent && item.type === 'file' && (
                    <span className="file-browser-meta">{formatBytes(item.size)}</span>
                  )}
                </div>
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );
}
