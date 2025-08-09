import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { 
  Download, 
  FileText, 
  Database, 
  Calendar,
  Users,
  Loader2,
  CheckCircle
} from "lucide-react";
import { electronDB } from "@/lib/electron-database";
import type { SessionRecord } from "@/features/tracker/TimerContext";

interface ExportPanelProps {
  sessions: SessionRecord[];
  filteredSessions: SessionRecord[];
  dateRange: {
    label: string;
    from?: Date;
    to?: Date;
  };
  className?: string;
}

interface ExportState {
  loading: string | null;
  success: string | null;
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

function toHMS(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  sessions,
  filteredSessions,
  dateRange,
  className
}) => {
  const [exportState, setExportState] = useState<ExportState>({
    loading: null,
    success: null
  });

  const handleExport = async (type: string, action: () => Promise<void> | void) => {
    setExportState({ loading: type, success: null });
    try {
      await action();
      setExportState({ loading: null, success: type });
      setTimeout(() => setExportState({ loading: null, success: null }), 2000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportState({ loading: null, success: null });
    }
  };

  const exportCurrentViewCSV = () => {
    const header = [
      "Date",
      "Client", 
      "Project",
      "Task",
      "Start",
      "End",
      "Active HH:MM:SS",
      "Active Hours",
      "Billable",
      "Notes",
    ];
    const rows = filteredSessions.map((s) => [
      new Date(s.start).toISOString().slice(0, 10),
      s.task?.client || s.client || 'Unknown Client',
      s.task?.project || s.project || 'Unknown Project',
      s.task?.task || s.task || 'Unknown Task',
      new Date(s.start).toLocaleString(),
      s.end ? new Date(s.end).toLocaleString() : "",
      toHMS(s.activeMs),
      (s.activeMs / 3600000).toFixed(2),
      s.isBillable !== false ? "Yes" : "No",
      s.notes || "",
    ]);
    downloadCSV(`sessions-${dateRange.label.toLowerCase()}.csv`, [header, ...rows]);
  };

  const exportClientSummaryCSV = () => {
    const clientTotals = filteredSessions.reduce((acc, s) => {
      const client = s.task?.client || s.client || 'Unknown Client';
      acc[client] = (acc[client] || 0) + s.activeMs;
      return acc;
    }, {} as Record<string, number>);

    const header = ["Client", "Total Hours", "Total HH:MM:SS"];
    const rows = Object.entries(clientTotals).map(([client, ms]) => [
      client,
      (ms / 3600000).toFixed(2),
      toHMS(ms),
    ]);
    downloadCSV(`client-summary-${dateRange.label.toLowerCase()}.csv`, [header, ...rows]);
  };

  const exportAllDataCSV = async () => {
    const csvContent = await electronDB.exportToCSV();
    const success = await electronDB.saveFile(csvContent, 'all-sessions.csv', [
      { name: 'CSV files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]);
    if (!success) throw new Error('Export failed');
  };

  const exportAllDataJSON = async () => {
    const jsonContent = await electronDB.exportToJSON();
    const success = await electronDB.saveFile(jsonContent, 'all-sessions.json', [
      { name: 'JSON files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]);
    if (!success) throw new Error('Export failed');
  };

  const ExportButton: React.FC<{
    type: string;
    title: string;
    description: string;
    icon: React.ElementType;
    onClick: () => void;
    variant?: "default" | "outline";
  }> = ({ type, title, description, icon: Icon, onClick, variant = "outline" }) => {
    const isLoading = exportState.loading === type;
    const isSuccess = exportState.success === type;
    
    return (
      <Button
        variant={variant}
        onClick={() => handleExport(type, onClick)}
        disabled={isLoading}
        className="h-auto p-4 justify-start text-left"
      >
        <div className="flex items-center gap-3 w-full">
          <div className="shrink-0">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSuccess ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{title}</div>
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {description}
            </div>
          </div>
        </div>
      </Button>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export Data
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Export your time tracking data in various formats
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current View Export */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Current View</h4>
            <Badge variant="secondary" className="text-xs">
              {dateRange.label} • {filteredSessions.length} sessions
            </Badge>
          </div>
          <div className="grid gap-2">
            <ExportButton
              type="current-sessions"
              title="Sessions CSV"
              description={`Export ${filteredSessions.length} sessions from ${dateRange.label} period`}
              icon={FileText}
              onClick={exportCurrentViewCSV}
            />
            <ExportButton
              type="current-summary"
              title="Client Summary CSV" 
              description="Export client billing summary for current period"
              icon={Users}
              onClick={exportClientSummaryCSV}
            />
          </div>
        </div>

        <Separator />

        {/* All Data Export */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">All Data</h4>
            <Badge variant="outline" className="text-xs">
              {sessions.length} total sessions
            </Badge>
          </div>
          <div className="grid gap-2">
            <ExportButton
              type="all-csv"
              title="Complete Database (CSV)"
              description="Export all sessions with full details in CSV format"
              icon={Database}
              onClick={exportAllDataCSV}
            />
            <ExportButton
              type="all-json"
              title="Complete Database (JSON)"
              description="Export all sessions as structured JSON data"
              icon={Calendar}
              onClick={exportAllDataJSON}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};