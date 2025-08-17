import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useTimer } from "@/features/tracker/TimerContext";
import { useAuth } from "@/contexts/AuthContext";
import { DateRangeControls, type DateRange, type Preset } from "@/features/tracker/components/DateRangeControls";
import { MetricCard } from "@/components/ui/metric-card";
import { ClientBreakdownChart } from "@/components/ui/client-breakdown-chart";
import { ProjectBreakdownChart } from "@/components/ui/project-breakdown-chart";
import { ExportPanel } from "@/components/ui/export-panel";
import { RecentSessionsTable } from "@/components/ui/recent-sessions-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, Users, TrendingUp, DollarSign, AlertCircle, Filter, BarChart3, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import type { SessionRecord } from "@/features/tracker/TimerContext";

interface HourlyData {
  hour: string;
  sessions: number;
  totalTime: number;
  billableTime: number;
}

interface TrendData {
  date: string;
  totalHours: number;
  billableHours: number;
  efficiency: number;
}

function Reports() {
  const { sessions, refreshSessions } = useTimer();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
  const startOfWeek = (d = new Date()) => { const x = new Date(d); const day = (x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x; };
  const startOfMonth = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x; };

  const [preset, setPreset] = useState<Preset>("today");
  const [range, setRange] = useState<DateRange>({});
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"overview" | "detailed" | "trends">("overview");
  const [selectedClientForDrilldown, setSelectedClientForDrilldown] = useState<string | null>(null);

  // Manual refresh function
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshSessions();
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error refreshing sessions:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshSessions]);

  // Automatic refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await refreshSessions();
        setLastRefresh(new Date());
      } catch (error) {
        console.error('Error auto-refreshing sessions:', error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [refreshSessions]);

  // Initial refresh on mount
  useEffect(() => {
    handleManualRefresh();
  }, [handleManualRefresh]);

  // Handle client selection for drilldown
  const handleClientClick = useCallback((clientName: string) => {
    if (selectedClientForDrilldown === clientName) {
      // Deselect if clicking the same client
      setSelectedClientForDrilldown(null);
    } else {
      setSelectedClientForDrilldown(clientName);
    }
  }, [selectedClientForDrilldown]);

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
    let userSessions = sessions;
    
    // Filter by user permissions
    if (user?.role !== 'admin' && user?.role !== 'director') {
      // For regular users, show sessions that belong to them OR have no userId (legacy sessions)
      userSessions = sessions.filter(s => s.userId === user?.id || s.userId == null);
    }
    
    // Filter by date range
    if (!from || !to) return userSessions;
    const fromMs = from.getTime(); 
    const toMs = to.getTime();
    let filteredSessions = userSessions.filter((s) => s.start >= fromMs && s.start <= toMs);
    
    // Filter by client
    if (selectedClient !== "all") {
      filteredSessions = filteredSessions.filter(s => 
        (s.task?.client || s.client || 'Unknown Client') === selectedClient
      );
    }
    
    // Filter by project  
    if (selectedProject !== "all") {
      filteredSessions = filteredSessions.filter(s => 
        (s.task?.project || s.project || 'Unknown Project') === selectedProject
      );
    }
    
    return filteredSessions;
  }, [sessions, user, from, to, selectedClient, selectedProject]);

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

  // Available clients and projects for filtering
  const availableClients = useMemo(() => {
    const clients = [...new Set(sessions.map(s => s.task?.client || s.client || 'Unknown Client'))];
    return clients.sort();
  }, [sessions]);

  const availableProjects = useMemo(() => {
    const projectsForClient = selectedClient === "all" 
      ? sessions 
      : sessions.filter(s => (s.task?.client || s.client || 'Unknown Client') === selectedClient);
    const projects = [...new Set(projectsForClient.map(s => s.task?.project || s.project || 'Unknown Project'))];
    return projects.sort();
  }, [sessions, selectedClient]);

  // Hourly productivity data
  const hourlyData = useMemo((): HourlyData[] => {
    const hourlyMap: Record<string, { sessions: number; totalTime: number; billableTime: number }> = {};
    
    // Initialize all hours
    for (let hour = 0; hour < 24; hour++) {
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      hourlyMap[hourKey] = { sessions: 0, totalTime: 0, billableTime: 0 };
    }
    
    filtered.forEach(session => {
      const hour = new Date(session.start).getHours();
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      
      hourlyMap[hourKey].sessions += 1;
      hourlyMap[hourKey].totalTime += session.activeMs / (1000 * 60 * 60); // Convert to hours
      
      if (session.isBillable !== false) {
        hourlyMap[hourKey].billableTime += session.activeMs / (1000 * 60 * 60);
      }
    });
    
    return Object.entries(hourlyMap).map(([hour, data]) => ({
      hour,
      ...data
    }));
  }, [filtered]);

  // Daily trend data for the selected period
  const trendData = useMemo((): TrendData[] => {
    if (!from || !to) return [];
    
    const data: TrendData[] = [];
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const maxDays = Math.min(daysDiff, 30); // Limit to 30 days for performance
    
    for (let i = 0; i < maxDays; i++) {
      const date = new Date(from);
      date.setDate(date.getDate() + i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const daySessions = filtered.filter(s => 
        s.start >= dayStart.getTime() && s.start <= dayEnd.getTime()
      );
      
      const totalMs = daySessions.reduce((sum, s) => sum + s.activeMs, 0);
      const billableMs = daySessions.reduce((sum, s) => 
        sum + (s.isBillable !== false ? s.activeMs : 0), 0
      );
      
      const totalHours = totalMs / (1000 * 60 * 60);
      const billableHours = billableMs / (1000 * 60 * 60);
      const efficiency = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        totalHours,
        billableHours,
        efficiency
      });
    }
    
    return data;
  }, [filtered, from, to]);

  // Period comparison data
  const comparisonData = useMemo(() => {
    if (!from || !to) return null;
    
    // Calculate previous period
    const periodLength = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodLength);
    const prevTo = new Date(to.getTime() - periodLength);
    
    const prevSessions = sessions.filter(s => {
      // Apply same user filtering logic as main sessions
      if (user?.role !== 'admin' && user?.role !== 'director') {
        if (s.userId !== user?.id && s.userId != null) {
          return false;
        }
      }
      return s.start >= prevFrom.getTime() && s.start <= prevTo.getTime();
    });
    
    const currentTotal = filtered.reduce((sum, s) => sum + s.activeMs, 0);
    const prevTotal = prevSessions.reduce((sum, s) => sum + s.activeMs, 0);
    
    const currentBillable = filtered.reduce((sum, s) => sum + (s.isBillable !== false ? s.activeMs : 0), 0);
    const prevBillable = prevSessions.reduce((sum, s) => sum + (s.isBillable !== false ? s.activeMs : 0), 0);
    
    const timeChange = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;
    const billableChange = prevBillable > 0 ? ((currentBillable - prevBillable) / prevBillable) * 100 : 0;
    
    return {
      timeChange,
      billableChange,
      isImproved: timeChange > 0 && billableChange > 0
    };
  }, [filtered, sessions, user, from, to]);

  return (
    <div className="min-h-screen bg-background flex items-start justify-center">
      <div className="w-full max-w-7xl mx-auto py-8 px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Reports & Analytics</h1>
              <p className="text-muted-foreground">Analyze your time tracking data and export reports</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
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

        {/* Advanced Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select 
              value={selectedClient} 
              onChange={(e) => {
                setSelectedClient(e.target.value);
                setSelectedProject("all"); // Reset project filter
              }}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="all">All Clients</option>
              {availableClients.map(client => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <select 
              value={selectedProject} 
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm"
              disabled={selectedClient === "all"}
            >
              <option value="all">All Projects</option>
              {availableProjects.map(project => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex rounded-md border">
              <Button
                variant={viewMode === "overview" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("overview")}
                className="rounded-r-none"
              >
                Overview
              </Button>
              <Button
                variant={viewMode === "detailed" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("detailed")}
                className="rounded-none border-x-0"
              >
                Detailed
              </Button>
              <Button
                variant={viewMode === "trends" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("trends")}
                className="rounded-l-none"
              >
                Trends
              </Button>
            </div>
          </div>
        </div>

        {/* Metrics Cards with Trends */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-6 mb-8">
          <MetricCard
            title="Total Time"
            value={metrics.totalTime}
            description={metrics.periodLabel}
            icon={Clock}
            trend={comparisonData ? {
              value: Math.round(comparisonData.timeChange),
              label: "vs previous period",
              isPositive: comparisonData.timeChange > 0
            } : undefined}
          />
          <MetricCard
            title="Billable Time"
            value={metrics.billableTime}
            description={`${metrics.billablePercentage}% of total time`}
            icon={DollarSign}
            trend={comparisonData ? {
              value: Math.round(comparisonData.billableChange),
              label: "vs previous period",
              isPositive: comparisonData.billableChange > 0
            } : undefined}
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

        {/* View Mode Content */}
        {viewMode === "overview" && (
          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            <ClientBreakdownChart 
              sessions={filtered} 
              onClientClick={handleClientClick}
              selectedClient={selectedClientForDrilldown}
            />
            <ProjectBreakdownChart 
              sessions={filtered}
              selectedClient={selectedClientForDrilldown}
            />
          </div>
        )}

        {viewMode === "detailed" && (
          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Hourly Productivity</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Activity distribution throughout the day
                </p>
              </CardHeader>
              <CardContent>
                <div style={{ width: '100%', height: '300px' }}>
                  <ResponsiveContainer>
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="totalTime" fill="#3b82f6" name="Total Hours" />
                      <Bar dataKey="billableTime" fill="#10b981" name="Billable Hours" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Session Analysis</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Session count and productivity by hour
                </p>
              </CardHeader>
              <CardContent>
                <div style={{ width: '100%', height: '300px' }}>
                  <ResponsiveContainer>
                    <LineChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="sessions" 
                        stroke="#8b5cf6" 
                        strokeWidth={2}
                        name="Sessions"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {viewMode === "trends" && (
          <div className="grid gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Time Tracking Trends</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Daily progression of total and billable hours
                </p>
              </CardHeader>
              <CardContent>
                <div style={{ width: '100%', height: '400px' }}>
                  <ResponsiveContainer>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="totalHours" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        name="Total Hours"
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="billableHours" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        name="Billable Hours"
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="efficiency" 
                        stroke="#f59e0b" 
                        strokeWidth={2}
                        name="Efficiency %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {comparisonData && (
              <Card>
                <CardHeader>
                  <CardTitle>Period Comparison</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Performance vs previous period
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Total Time Change</h4>
                        <p className="text-sm text-muted-foreground">vs previous period</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {comparisonData.timeChange > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <Badge 
                          variant={comparisonData.timeChange > 0 ? "default" : "secondary"}
                          className={comparisonData.timeChange > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                        >
                          {comparisonData.timeChange > 0 ? "+" : ""}{comparisonData.timeChange.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Billable Time Change</h4>
                        <p className="text-sm text-muted-foreground">vs previous period</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {comparisonData.billableChange > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <Badge 
                          variant={comparisonData.billableChange > 0 ? "default" : "secondary"}
                          className={comparisonData.billableChange > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                        >
                          {comparisonData.billableChange > 0 ? "+" : ""}{comparisonData.billableChange.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Export Panel (always visible) */}
        <div className="mb-8">
          <ExportPanel 
            sessions={sessions}
            filteredSessions={filtered}
            dateRange={dateRangeInfo}
          />
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