import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useTimer } from "@/features/tracker/TimerContext";
import { useAuth } from "@/contexts/AuthContext";
import { EnhancedMetricCard } from "@/components/ui/enhanced-metric-card";
import { InsightsPanel } from "@/components/ui/insights-panel";
import { ProductivityTrendChart, ClientDistributionChart, UtilizationHeatmap } from "@/components/ui/interactive-charts";
import { AdvancedReporting } from "@/components/ui/advanced-reporting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Target, 
  Users, 
  Calendar,
  Activity,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Zap,
  PieChart,
  BarChart3,
  LineChart,
  Download,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangeControls, type DateRange, type Preset } from "@/features/tracker/components/DateRangeControls";
import { ClientBreakdownChart } from "@/components/ui/client-breakdown-chart";
import { ProjectBreakdownChart } from "@/components/ui/project-breakdown-chart";
import { ExportPanel } from "@/components/ui/export-panel";
import { MetricCard } from "@/components/ui/metric-card";
import { RecentSessionsTable } from "@/components/ui/recent-sessions-table";
import { ResponsiveContainer, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Bar, LineChart as RechartsLineChart, Line } from 'recharts';
import { AnalyticsEngine } from "@/lib/analytics-engine";
import type { SessionRecord } from "@/features/tracker/TimerContext";

interface DashboardMetrics {
  todayTime: number;
  todayBillable: number;
  todayRevenue: number;
  todayRevenuePerHour: number;
  weekTime: number;
  weekBillable: number;
  weekRevenue: number;
  weekRevenuePerHour: number;
  utilizationRate: number;
  targetUtilization: number;
  avgSessionLength: number;
  sessionsToday: number;
  topClient: string;
  productivityScore: number;
  profitMargin: number;
  clientConcentrationRisk: number;
}

interface TrendData {
  date: string;
  hours: number;
  billableHours: number;
  sessions: number;
  revenue: number;
  productivity: number;
}

interface ClientData {
  name: string;
  hours: number;
  revenue: number;
  percentage: number;
  color: string;
}

interface HeatmapData {
  date: string;
  day: string;
  hours: number;
  target: number;
}

interface FilteredMetrics {
  totalTime: string;
  billableTime: string;
  nonBillableTime: string;
  sessionCount: string;
  clientCount: string;
  avgSession: string;
  periodLabel: string;
  billablePercentage: number;
}

interface HourlyData {
  hour: string;
  sessions: number;
  totalTime: number;
  billableTime: number;
}

interface ReportsTrendData {
  date: string;
  totalHours: number;
  billableHours: number;
  efficiency: number;
}

interface ComparisonData {
  timeChange: number;
  billableChange: number;
  isImproved: boolean;
}

function Dashboard() {
  const { sessions, refreshSessions } = useTimer();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  const [preset, setPreset] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedClientForDrilldown, setSelectedClientForDrilldown] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'trends'>('overview');
  const [chartViewMode, setChartViewMode] = useState<'client' | 'project'>('client');
  
  // Date helpers
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
  const startOfWeek = (d = new Date()) => { 
    const x = new Date(d); 
    const day = (x.getDay() + 6) % 7; 
    x.setHours(0,0,0,0); 
    x.setDate(x.getDate() - day); 
    return x; 
  };
  const startOfMonth = (d = new Date()) => {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0,0,0,0);
    return x;
  };

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
  }, []); // Remove refreshSessions dependency to prevent infinite loop

  // Initial refresh on mount
  useEffect(() => {
    handleManualRefresh();
  }, [handleManualRefresh]);

  // Handle client selection for drilldown
  const handleClientClick = useCallback((clientName: string) => {
    if (selectedClientForDrilldown === clientName) {
      setSelectedClientForDrilldown(null);
    } else {
      setSelectedClientForDrilldown(clientName);
    }
  }, [selectedClientForDrilldown]);

  // Filter sessions based on user permissions
  const userSessions = useMemo(() => {
    if (user?.role === 'admin' || user?.role === 'director') {
      return sessions; // Admins see all sessions
    }
    // For regular users, show sessions that belong to them OR have no userId (legacy sessions)
    return sessions.filter(s => s.userId === user?.id || s.userId == null);
  }, [sessions, user]);

  // Analytics Engine
  const analyticsEngine = useMemo(() => {
    return new AnalyticsEngine({
      sessions: userSessions,
      user: user || { id: '', role: 'user' }
    });
  }, [userSessions, user]);

  // Calculate metrics using analytics engine
  const metrics = useMemo((): DashboardMetrics => {
    return analyticsEngine.calculateKPIs();
  }, [analyticsEngine]);

  // Generate insights and predictions
  const insights = useMemo(() => {
    return analyticsEngine.generateInsights();
  }, [analyticsEngine]);

  const predictions = useMemo(() => {
    return analyticsEngine.generatePredictions();
  }, [analyticsEngine]);

  // Client analytics
  const clientAnalytics = useMemo(() => {
    return analyticsEngine.analyzeClients();
  }, [analyticsEngine]);

  // Reports filtering date range logic
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

  // Filtered sessions for reports tab
  const filteredSessions = useMemo(() => {
    let userSessions = sessions;
    
    // Filter by user permissions
    if (user?.role !== 'admin' && user?.role !== 'director') {
      userSessions = sessions.filter(s => s.userId === user?.id || s.userId == null);
    }
    
    // Filter by date range
    if (!from || !to) return userSessions;
    const fromMs = from.getTime(); 
    const toMs = to.getTime();
    let filtered = userSessions.filter((s) => s.start >= fromMs && s.start <= toMs);
    
    // Filter by client
    if (selectedClient !== "all") {
      filtered = filtered.filter(s => 
        (s.task?.client || s.client || 'Unknown Client') === selectedClient
      );
    }
    
    // Filter by project  
    if (selectedProject !== "all") {
      filtered = filtered.filter(s => 
        (s.task?.project || s.project || 'Unknown Project') === selectedProject
      );
    }
    
    return filtered;
  }, [sessions, user, from, to, selectedClient, selectedProject]);

  // Calculate filtered metrics for reports
  const filteredMetrics = useMemo((): FilteredMetrics => {
    const totalTime = filteredSessions.reduce((sum, s) => sum + s.activeMs, 0);
    const billableTime = filteredSessions.reduce((sum, s) => sum + (s.isBillable !== false ? s.activeMs : 0), 0);
    const nonBillableTime = totalTime - billableTime;
    const sessionCount = filteredSessions.length;
    
    const clientCount = new Set(
      filteredSessions.map(s => s.task?.client || s.client || 'Unknown Client')
    ).size;

    const formatDuration = (ms: number): string => {
      const totalMinutes = Math.floor(ms / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    };

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
  }, [filteredSessions, preset]);

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

  // Hourly productivity data for reports
  const hourlyData = useMemo((): HourlyData[] => {
    const hourlyMap: Record<string, { sessions: number; totalTime: number; billableTime: number }> = {};
    
    for (let hour = 0; hour < 24; hour++) {
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      hourlyMap[hourKey] = { sessions: 0, totalTime: 0, billableTime: 0 };
    }
    
    filteredSessions.forEach(session => {
      const hour = new Date(session.start).getHours();
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      
      hourlyMap[hourKey].sessions += 1;
      hourlyMap[hourKey].totalTime += session.activeMs / (1000 * 60 * 60);
      
      if (session.isBillable !== false) {
        hourlyMap[hourKey].billableTime += session.activeMs / (1000 * 60 * 60);
      }
    });
    
    return Object.entries(hourlyMap).map(([hour, data]) => ({
      hour,
      ...data
    }));
  }, [filteredSessions]);

  // Daily trend data for reports
  const reportsTrendData = useMemo((): ReportsTrendData[] => {
    if (!from || !to) return [];
    
    const data: ReportsTrendData[] = [];
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const maxDays = Math.min(daysDiff, 30);
    
    for (let i = 0; i < maxDays; i++) {
      const date = new Date(from);
      date.setDate(date.getDate() + i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const daySessions = filteredSessions.filter(s => 
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
  }, [filteredSessions, from, to]);

  // Period comparison data
  const comparisonData = useMemo((): ComparisonData | null => {
    if (!from || !to) return null;
    
    const periodLength = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodLength);
    const prevTo = new Date(to.getTime() - periodLength);
    
    const prevSessions = sessions.filter(s => {
      if (user?.role !== 'admin' && user?.role !== 'director') {
        if (s.userId !== user?.id && s.userId != null) {
          return false;
        }
      }
      return s.start >= prevFrom.getTime() && s.start <= prevTo.getTime();
    });
    
    const currentTotal = filteredSessions.reduce((sum, s) => sum + s.activeMs, 0);
    const prevTotal = prevSessions.reduce((sum, s) => sum + s.activeMs, 0);
    
    const currentBillable = filteredSessions.reduce((sum, s) => sum + (s.isBillable !== false ? s.activeMs : 0), 0);
    const prevBillable = prevSessions.reduce((sum, s) => sum + (s.isBillable !== false ? s.activeMs : 0), 0);
    
    const timeChange = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;
    const billableChange = prevBillable > 0 ? ((currentBillable - prevBillable) / prevBillable) * 100 : 0;
    
    return {
      timeChange,
      billableChange,
      isImproved: timeChange > 0 && billableChange > 0
    };
  }, [filteredSessions, sessions, user, from, to]);

  const dateRangeInfo = useMemo(() => {
    return {
      label: filteredMetrics.periodLabel,
      from,
      to
    };
  }, [filteredMetrics.periodLabel, from, to]);

  // Real team data for admin/director users
  const [teamData, setTeamData] = useState<any[]>([]);
  const [isLoadingTeamData, setIsLoadingTeamData] = useState(false);

  // Load team performance data
  useEffect(() => {
    const loadTeamData = async () => {
      if (user?.role !== 'admin' && user?.role !== 'director') return;
      
      setIsLoadingTeamData(true);
      try {
        const teamPerformance = await AnalyticsEngine.calculateTeamPerformance(sessions);
        setTeamData(teamPerformance);
      } catch (error) {
        console.error('Error loading team data:', error);
      } finally {
        setIsLoadingTeamData(false);
      }
    };

    loadTeamData();
  }, [user?.role, sessions]);


  // Generate enhanced trend data for the last 7 days
  const trendData = useMemo((): TrendData[] => {
    const data: TrendData[] = [];
    const now = new Date();
    const userRate = user?.billableRate || 0;
    const discount = (user?.discountPercentage || 0) / 100;
    const netRate = userRate * (1 - discount);
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const daySessions = userSessions.filter(s => 
        s.start >= dayStart.getTime() && s.start <= dayEnd.getTime()
      );
      
      const totalMs = daySessions.reduce((sum, s) => sum + s.activeMs, 0);
      const billableMs = daySessions.reduce((sum, s) => 
        sum + (s.isBillable !== false ? s.activeMs : 0), 0
      );
      
      const hours = totalMs / (1000 * 60 * 60);
      const billableHours = billableMs / (1000 * 60 * 60);
      const revenue = billableHours * netRate;
      
      // Calculate daily productivity score
      const avgSessionLength = daySessions.length > 0 ? totalMs / daySessions.length : 0;
      const sessionQuality = avgSessionLength > 0 ? Math.min(avgSessionLength / (30 * 60 * 1000), 1) : 0;
      const billableRatio = totalMs > 0 ? billableMs / totalMs : 0;
      const productivity = Math.round((sessionQuality * 0.5 + billableRatio * 0.5) * 100);
      
      data.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        hours,
        billableHours,
        sessions: daySessions.length,
        revenue,
        productivity
      });
    }
    
    return data;
  }, [userSessions, user]);

  // Client distribution data
  const clientData = useMemo((): ClientData[] => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    return clientAnalytics.slice(0, 6).map((client, index) => ({
      name: client.name,
      hours: client.totalHours,
      revenue: client.revenue,
      percentage: client.percentage,
      color: colors[index % colors.length]
    }));
  }, [clientAnalytics]);

  // Project distribution data
  const projectData = useMemo((): ClientData[] => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    const projectTotals = userSessions.reduce((acc, session) => {
      if (session.isBillable !== false) {
        const project = session.task?.project || session.project || 'Unknown Project';
        acc[project] = (acc[project] || 0) + session.activeMs;
      }
      return acc;
    }, {} as Record<string, number>);

    const totalTime = Object.values(projectTotals).reduce((sum, ms) => sum + ms, 0);
    const userRate = user?.billableRate || 0;
    const discount = (user?.discountPercentage || 0) / 100;
    const netRate = userRate * (1 - discount);

    return Object.entries(projectTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([project, ms], index) => ({
        name: project,
        hours: ms / (1000 * 60 * 60),
        revenue: (ms / (1000 * 60 * 60)) * netRate,
        percentage: totalTime > 0 ? (ms / totalTime) * 100 : 0,
        color: colors[index % colors.length]
      }));
  }, [userSessions, user]);

  // Heatmap data
  const heatmapData = useMemo((): HeatmapData[] => {
    const data: HeatmapData[] = [];
    const now = new Date();
    const target = 8; // 8 hours per day target
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const daySessions = userSessions.filter(s => 
        s.start >= dayStart.getTime() && s.start <= dayEnd.getTime()
      );
      
      const totalMs = daySessions.reduce((sum, s) => sum + s.activeMs, 0);
      const hours = totalMs / (1000 * 60 * 60);
      
      data.push({
        date: date.toLocaleDateString(),
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        hours,
        target
      });
    }
    
    return data;
  }, [userSessions]);

  // Format helpers
  const formatDuration = (ms: number): string => {
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center">
      <div className="w-full max-w-7xl mx-auto py-8 px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                Analytics & Reports
              </h1>
              <p className="text-muted-foreground">
                Comprehensive time tracking analytics, insights, and reporting
              </p>
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

        {/* Unified Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <LineChart className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <PieChart className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="exports" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Enhanced Dashboard */}
          <TabsContent value="overview" className="space-y-8 mt-8">
            {/* Weekly Utilization Heatmap */}
            <UtilizationHeatmap data={heatmapData} />

            {/* Secondary KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <EnhancedMetricCard
                title="Today's Billable"
                value={formatDuration(metrics.todayBillable)}
                description={`${Math.round((metrics.todayBillable / Math.max(metrics.todayTime, 1)) * 100)}% of total`}
                icon={Clock}
                trend={{
                  value: 8,
                  label: 'vs yesterday',
                  isPositive: true
                }}
              />
              
              <EnhancedMetricCard
                title="Sessions Today"
                value={metrics.sessionsToday.toString()}
                description={`Avg: ${formatDuration(metrics.avgSessionLength)}`}
                icon={Activity}
              />
              
              <EnhancedMetricCard
                title="Revenue/Hour"
                value={formatCurrency(metrics.todayRevenuePerHour)}
                description="Today's earning rate"
                icon={TrendingUp}
                status={{
                  type: metrics.todayRevenuePerHour > metrics.weekRevenuePerHour ? 'success' : 'neutral'
                }}
              />
              
              <EnhancedMetricCard
                title="Week Total"
                value={formatDuration(metrics.weekTime)}
                description="All tracked time"
                icon={Calendar}
              />
            </div>

            {/* Insights and Key Charts */}
            <div className="grid gap-6">
              <InsightsPanel 
                insights={insights}
                predictions={predictions}
              />
            </div>

            {/* Team Performance for Admins */}
            {(user?.role === 'admin' || user?.role === 'director') && (
              <AdvancedReporting 
                userRole={user.role}
                teamData={teamData}
                isLoadingTeamData={isLoadingTeamData}
              />
            )}
          </TabsContent>

          {/* Analytics Tab - Interactive Charts */}
          <TabsContent value="analytics" className="space-y-8 mt-8">
            {/* Chart View Toggle */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Distribution Analysis</h3>
              <div className="flex rounded-md border">
                <Button
                  variant={chartViewMode === "client" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartViewMode("client")}
                  className="rounded-r-none"
                >
                  By Client
                </Button>
                <Button
                  variant={chartViewMode === "project" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartViewMode("project")}
                  className="rounded-l-none"
                >
                  By Project
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ProductivityTrendChart 
                data={trendData}
                targets={{
                  dailyHours: 8,
                  weeklyRevenue: metrics.weekRevenue * 1.2,
                  productivity: 75
                }}
              />
              
              <ClientDistributionChart 
                data={chartViewMode === 'client' ? clientData : projectData}
                title={chartViewMode === 'client' ? 'Client Distribution' : 'Project Distribution'}
                subtitle={chartViewMode === 'client' ? 'Billable time by client' : 'Billable time by project'}
              />
            </div>
          </TabsContent>

          {/* Reports Tab - Detailed Analysis */}
          <TabsContent value="reports" className="space-y-8 mt-8">
            {/* Date Range Controls */}
            <DateRangeControls 
              preset={preset} 
              range={range} 
              onPresetChange={setPreset} 
              onRangeChange={(r) => { setPreset("custom"); setRange(r); }} 
            />

            {/* Advanced Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select 
                  value={selectedClient} 
                  onChange={(e) => {
                    setSelectedClient(e.target.value);
                    setSelectedProject("all");
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-6">
              <MetricCard
                title="Total Time"
                value={filteredMetrics.totalTime}
                description={filteredMetrics.periodLabel}
                icon={Clock}
                trend={comparisonData ? {
                  value: Math.round(comparisonData.timeChange),
                  label: "vs previous period",
                  isPositive: comparisonData.timeChange > 0
                } : undefined}
              />
              <MetricCard
                title="Billable Time"
                value={filteredMetrics.billableTime}
                description={`${filteredMetrics.billablePercentage}% of total time`}
                icon={DollarSign}
                trend={comparisonData ? {
                  value: Math.round(comparisonData.billableChange),
                  label: "vs previous period",
                  isPositive: comparisonData.billableChange > 0
                } : undefined}
              />
              <MetricCard
                title="Non-Billable"
                value={filteredMetrics.nonBillableTime}
                description={`${100 - filteredMetrics.billablePercentage}% of total time`}
                icon={AlertCircle}
              />
              <MetricCard
                title="Sessions"
                value={filteredMetrics.sessionCount}
                description={`${filteredMetrics.periodLabel.toLowerCase()} sessions`}
                icon={Calendar}
              />
              <MetricCard
                title="Clients"
                value={filteredMetrics.clientCount}
                description="Active clients"
                icon={Users}
              />
              <MetricCard
                title="Avg Session"
                value={filteredMetrics.avgSession}
                description="Per session average"
                icon={TrendingUp}
              />
            </div>

            {/* View Mode Content */}
            {viewMode === "overview" && (
              <div className="grid gap-6 lg:grid-cols-2">
                <ClientBreakdownChart 
                  sessions={filteredSessions} 
                  onClientClick={handleClientClick}
                  selectedClient={selectedClientForDrilldown}
                />
                <ProjectBreakdownChart 
                  sessions={filteredSessions}
                  selectedClient={selectedClientForDrilldown}
                />
              </div>
            )}

            {viewMode === "detailed" && (
              <div className="grid gap-6 lg:grid-cols-2">
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
                        <RechartsLineChart data={hourlyData}>
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
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {viewMode === "trends" && (
              <div className="grid gap-6">
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
                        <RechartsLineChart data={reportsTrendData}>
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
                        </RechartsLineChart>
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

            {/* Recent Sessions Table */}
            <RecentSessionsTable 
              sessions={filteredSessions}
              title={`Sessions for ${filteredMetrics.periodLabel}`}
              maxSessions={20}
              showDate={preset !== "today"}
            />
          </TabsContent>

          {/* Export Tab - Data Export & Management */}
          <TabsContent value="exports" className="space-y-8 mt-8">
            <ExportPanel 
              sessions={sessions}
              filteredSessions={filteredSessions}
              dateRange={dateRangeInfo}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Dashboard;