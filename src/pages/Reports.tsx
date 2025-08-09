import React, { useState, useMemo } from "react";
import { useTimer } from "@/features/tracker/TimerContext";
import { DateRangeControls, type DateRange, type Preset } from "@/features/tracker/components/DateRangeControls";
import { MetricCard } from "@/components/ui/metric-card";
import { ClientBreakdownChart } from "@/components/ui/client-breakdown-chart";
import { ExportPanel } from "@/components/ui/export-panel";
import { RecentSessionsTable } from "@/components/ui/recent-sessions-table";
import { Clock, Calendar, Users, TrendingUp, DollarSign, AlertCircle } from "lucide-react";
import type { SessionRecord } from "@/features/tracker/TimerContext";

function Reports() {
  const { sessions } = useTimer();

  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
  const startOfWeek = (d = new Date()) => { const x = new Date(d); const day = (x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x; };
  const startOfMonth = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x; };

  const [preset, setPreset] = useState<Preset>("today");
  const [range, setRange] = useState<DateRange>({});

  const { from, to } = useMemo(() => {
    if (preset === "today") {
      const n = new Date(); return { from: startOfDay(n), to: endOfDay(n) };
    }
    if (preset === "week") {
      const s = startOfWeek(new Date()); const e = new Date(s); e.setDate(s.getDate()+6); return { from: s, to: endOfDay(e) };
    }
    if (preset === "month") {
      const s = startOfMonth(new Date()); const e = new Date(s.getFullYear(), s.getMonth()+1, 0); return { from: s, to: endOfDay(e) };
    }
    const f = range.from ? startOfDay(range.from) : undefined;
    const t = range.to ? endOfDay(range.to) : range.from ? endOfDay(range.from) : undefined;
    return { from: f, to: t };
  }, [preset, range]);

  const filtered = useMemo(() => {
    if (!from || !to) return [] as SessionRecord[];
    const fromMs = from.getTime(); const toMs = to.getTime();
    return sessions.filter((s) => s.start >= fromMs && s.start <= toMs);
  }, [sessions, from, to]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalTime = filtered.reduce((sum, s) => sum + s.activeMs, 0);
    const billableTime = filtered.reduce((sum, s) => sum + (s.isBillable !== false ? s.activeMs : 0), 0);
    const nonBillableTime = totalTime - billableTime;
    const sessionCount = filtered.length;
    
    // Get unique clients
    const clientCount = new Set(
      filtered.map(s => s.task?.client || s.client || 'Unknown Client')
    ).size;

    // Format duration
    const formatDuration = (ms: number): string => {
      const totalMinutes = Math.floor(ms / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    };

    // Get preset label for context
    const getPresetLabel = () => {
      switch (preset) {
        case "today": return "Today";
        case "week": return "This Week"; 
        case "month": return "This Month";
        case "custom": return "Selected Period";
        default: return "Selected Period";
      }
    };

    return {
      totalTime: formatDuration(totalTime),
      billableTime: formatDuration(billableTime),
      nonBillableTime: formatDuration(nonBillableTime),
      sessionCount: sessionCount.toString(),
      clientCount: clientCount.toString(),
      avgSession: sessionCount > 0 ? formatDuration(totalTime / sessionCount) : "0m",
      periodLabel: getPresetLabel(),
      billablePercentage: totalTime > 0 ? Math.round((billableTime / totalTime) * 100) : 0
    };
  }, [filtered, preset]);

  const dateRangeInfo = useMemo(() => {
    return {
      label: metrics.periodLabel,
      from,
      to
    };
  }, [metrics.periodLabel, from, to]);

  return (
    <div className="min-h-screen bg-background flex items-start justify-center">
      <div className="w-full max-w-7xl mx-auto py-8 px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Reports & Analytics</h1>
          <p className="text-muted-foreground">Analyze your time tracking data and export reports</p>
        </div>

        {/* Date Range Controls */}
        <div className="mb-8">
          <DateRangeControls 
            preset={preset} 
            range={range} 
            onPresetChange={setPreset} 
            onRangeChange={(r) => { setPreset("custom"); setRange(r); }} 
          />
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-6 mb-8">
          <MetricCard
            title="Total Time"
            value={metrics.totalTime}
            description={metrics.periodLabel}
            icon={Clock}
          />
          <MetricCard
            title="Billable Time"
            value={metrics.billableTime}
            description={`${metrics.billablePercentage}% of total time`}
            icon={DollarSign}
          />
          <MetricCard
            title="Non-Billable"
            value={metrics.nonBillableTime}
            description={`${100 - metrics.billablePercentage}% of total time`}
            icon={AlertCircle}
          />
          <MetricCard
            title="Sessions"
            value={metrics.sessionCount}
            description={`${metrics.periodLabel.toLowerCase()} sessions`}
            icon={Calendar}
          />
          <MetricCard
            title="Clients"
            value={metrics.clientCount}
            description="Active clients"
            icon={Users}
          />
          <MetricCard
            title="Avg Session"
            value={metrics.avgSession}
            description="Per session average"
            icon={TrendingUp}
          />
        </div>

        {/* Charts and Export Panel */}
        <div className="grid gap-6 lg:grid-cols-5 mb-8">
          <div className="lg:col-span-3">
            <ClientBreakdownChart sessions={filtered} />
          </div>
          <div className="lg:col-span-2">
            <ExportPanel 
              sessions={sessions}
              filteredSessions={filtered}
              dateRange={dateRangeInfo}
            />
          </div>
        </div>

        {/* Recent Sessions Table */}
        <div>
          <RecentSessionsTable 
            sessions={filtered}
            title={`Sessions for ${metrics.periodLabel}`}
            maxSessions={20}
            showDate={preset !== "today"}
          />
        </div>
      </div>
    </div>
  );
}

export default Reports;