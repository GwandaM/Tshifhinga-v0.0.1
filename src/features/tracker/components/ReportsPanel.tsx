import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTimer } from "@/features/tracker/TimerContext";
import { electronDB } from "@/lib/electron-database";
import type { SessionRecord } from "@/features/tracker/TimerContext";

function toHMS(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function downloadCSV(filename: string, rows: string[][]) {
  const escape = (v: string) => '"' + v.replace(/"/g, '""') + '"';
  const csv = rows.map((r) => r.map((c) => escape(c)).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const ReportsPanel: React.FC<{ sessions: SessionRecord[] }> = ({ sessions }) => {
  const total = useMemo(() => sessions.reduce((sum, s) => sum + s.activeMs, 0), [sessions]);
  const byClient = useMemo(() =>
    sessions.reduce<Record<string, number>>((acc, s) => {
      const client = s.task?.client || s.client || 'Unknown Client';
      acc[client] = (acc[client] ?? 0) + s.activeMs;
      return acc;
    }, {}), [sessions]
  );

  const exportSessionsCSV = () => {
    const header = [
      "Date",
      "Client",
      "Project",
      "Task",
      "Start",
      "End",
      "Active HH:MM:SS",
      "Active Hours",
      "Notes",
    ];
    const rows = sessions.map((s) => [
      new Date(s.start).toISOString().slice(0, 10),
      s.task?.client || s.client || 'Unknown Client',
      s.task?.project || s.project || 'Unknown Project',
      s.task?.task || s.task || 'Unknown Task',
      new Date(s.start).toLocaleString(),
      s.end ? new Date(s.end).toLocaleString() : "",
      toHMS(s.activeMs),
      (s.activeMs / 3600000).toFixed(2),
      s.notes ?? "",
    ]);
    downloadCSV("sessions.csv", [header, ...rows]);
  };

  const exportClientSummaryCSV = () => {
    const header = ["Client", "Total Hours", "Total HH:MM:SS"];
    const rows = Object.entries(byClient).map(([client, ms]) => [
      client,
      (ms / 3600000).toFixed(2),
      toHMS(ms),
    ]);
    downloadCSV("client_summary.csv", [header, ...rows]);
  };

  const exportAllDataAsCSV = async () => {
    try {
      const csvContent = await electronDB.exportToCSV();
      const success = await electronDB.saveFile(csvContent, 'time-tracking-export.csv', [
        { name: 'CSV files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]);
      if (success) {
        console.log('CSV export successful');
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  };

  const exportAllDataAsJSON = async () => {
    try {
      const jsonContent = await electronDB.exportToJSON();
      const success = await electronDB.saveFile(jsonContent, 'time-tracking-export.json', [
        { name: 'JSON files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]);
      if (success) {
        console.log('JSON export successful');
      }
    } catch (error) {
      console.error('Error exporting JSON:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reports</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Selected range total: <span className="font-medium text-foreground">{toHMS(total)}</span>
          </div>
          <div>
            <div className="text-sm mb-2">Client billing summary:</div>
            <ul className="space-y-1">
              {Object.keys(byClient).length === 0 && (
                <li className="text-sm text-muted-foreground">No data in range.</li>
              )}
              {Object.entries(byClient).map(([client, ms]) => (
                <li key={client} className="text-sm flex justify-between">
                  <span>{client}</span>
                  <span>{toHMS(ms)} ({(ms / 3600000).toFixed(2)}h)</span>
                </li>)
              )}
            </ul>
          </div>
          <div className="space-y-3 pt-4">
            <div className="text-sm font-medium">Export current view:</div>
            <div className="flex gap-2">
              <Button onClick={exportSessionsCSV} variant="secondary" size="sm">Sessions CSV</Button>
              <Button onClick={exportClientSummaryCSV} variant="secondary" size="sm">Client summary CSV</Button>
            </div>
            
            <div className="text-sm font-medium">Export all data:</div>
            <div className="flex gap-2">
              <Button onClick={exportAllDataAsCSV} variant="outline" size="sm">All data as CSV</Button>
              <Button onClick={exportAllDataAsJSON} variant="outline" size="sm">All data as JSON</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
