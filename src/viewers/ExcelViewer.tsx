import { useMemo, useState } from 'react';
import { Table, Tabs, Alert } from 'antd';
import * as XLSX from 'xlsx';
import type { OpenedFile } from '../types';
import { bufferToText } from './utils';

interface Props {
  file: OpenedFile;
}

type SheetData = {
  name: string;
  columns: { title: string; dataIndex: string; key: string; ellipsis: boolean }[];
  rows: Record<string, string>[];
};

function parseWorkbook(file: OpenedFile): SheetData[] {
  if (file.extension === 'csv') {
    const text = bufferToText(file.buffer);
    const wb = XLSX.read(text, { type: 'string' });
    return wb.SheetNames.map((name) => sheetToData(wb.Sheets[name], name));
  }
  const wb = XLSX.read(file.buffer, { type: 'array' });
  return wb.SheetNames.map((name) => sheetToData(wb.Sheets[name], name));
}

function sheetToData(sheet: XLSX.WorkSheet, name: string): SheetData {
  const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: '',
  }) as (string | number | boolean | null)[][];

  if (!aoa.length) {
    return { name, columns: [], rows: [] };
  }

  const header = aoa[0].map((cell, i) => {
    const title = String(cell ?? `列${i + 1}`) || `列${i + 1}`;
    return {
      title,
      dataIndex: `c${i}`,
      key: `c${i}`,
      ellipsis: true,
    };
  });

  const rows = aoa.slice(1).map((row, rIdx) => {
    const record: Record<string, string> = { key: String(rIdx) };
    header.forEach((col, i) => {
      record[col.dataIndex] = String(row[i] ?? '');
    });
    return record;
  });

  return { name, columns: header, rows };
}

export function ExcelViewer({ file }: Props) {
  const sheets = useMemo(() => {
    try {
      return parseWorkbook(file);
    } catch (err) {
      return { error: err instanceof Error ? err.message : '解析失败' } as const;
    }
  }, [file]);

  const [active, setActive] = useState(0);

  if ('error' in sheets) {
    return <Alert type="error" message={sheets.error} showIcon />;
  }

  if (!sheets.length) {
    return <Alert type="info" message="工作簿为空" showIcon />;
  }

  const current = sheets[Math.min(active, sheets.length - 1)];

  return (
    <div className="viewer-pane excel-viewer">
      {sheets.length > 1 && (
        <Tabs
          size="small"
          activeKey={String(active)}
          onChange={(k) => setActive(Number(k))}
          items={sheets.map((s, i) => ({ key: String(i), label: s.name }))}
        />
      )}
      <Table
        size="small"
        bordered
        pagination={{ pageSize: 50, showSizeChanger: true }}
        columns={current.columns}
        dataSource={current.rows}
        scroll={{ x: true, y: 'calc(100vh - 220px)' }}
      />
    </div>
  );
}
