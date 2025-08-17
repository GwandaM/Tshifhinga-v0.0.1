import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useTimer } from "@/features/tracker/TimerContext";
import { useAuth } from "@/contexts/AuthContext";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Target, 
  Users, 
  Calendar,
  Activity,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import type { SessionRecord } from "@/features/tracker/TimerContext";

interface DashboardMetrics {
  todayTime: number;
  todayBillable: number;
  weekTime: number;
  weekBillable: number;
  weekRevenue: number;
  utilizationRate: number;
  targetUtilization: number;
  avgSessionLength: number;
  sessionsToday: number;
  topClient: string;
  productivityScore: number;
}

interface TrendData {
  date: string;
  hours: number;
  billableHours: number;
  sessions: number;
}

function Dashboard() {
  const { sessions, refreshSessions } = useTimer();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
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

  // Filter sessions based on user permissions
  const userSessions = useMemo(() => {
    if (user?.role === 'admin' || user?.role === 'director') {
      return sessions; // Admins see all sessions
    }
    // For regular users, show sessions that belong to them OR have no userId (legacy sessions)
    return sessions.filter(s => s.userId === user?.id || s.userId == null);
  }, [sessions, user]);

  // Calculate metrics
  const metrics = useMemo((): DashboardMetrics => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now);
    
    // Today's sessions
    const todaySessions = userSessions.filter(s => 
      s.start >= todayStart.getTime() && s.start <= todayEnd.getTime()
    );
    
    // This week's sessions
    const weekSessions = userSessions.filter(s => 
      s.start >= weekStart.getTime() && s.start <= todayEnd.getTime()
    );

    const todayTime = todaySessions.reduce((sum, s) => sum + s.activeMs, 0);
    const todayBillable = todaySessions.reduce((sum, s) => 
      sum + (s.isBillable !== false ? s.activeMs : 0), 0
    );
    
    const weekTime = weekSessions.reduce((sum, s) => sum + s.activeMs, 0);
    const weekBillable = weekSessions.reduce((sum, s) => 
      sum + (s.isBillable !== false ? s.activeMs : 0), 0
    );

    // Calculate revenue (if user has billable rate)
    const billableHours = weekBillable / (1000 * 60 * 60);
    const userRate = user?.billableRate || 0;
    const discount = (user?.discountPercentage || 0) / 100;
    const weekRevenue = billableHours * userRate * (1 - discount);

    // Utilization rate
    const workingHoursPerWeek = 40; // Standard work week
    const actualHours = weekTime / (1000 * 60 * 60);
    const utilizationRate = Math.min((actualHours / workingHoursPerWeek) * 100, 100);
    const targetUtilization = user?.targetUtilization || 80;

    // Average session length
    const avgSessionLength = todaySessions.length > 0 
      ? todayTime / todaySessions.length 
      : 0;

    // Top client
    const clientTotals = todaySessions.reduce((acc, s) => {
      const client = s.task?.client || s.client || 'Unknown';
      acc[client] = (acc[client] || 0) + s.activeMs;
      return acc;
    }, {} as Record<string, number>);
    
    const topClient = Object.entries(clientTotals)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'No data';

    // Productivity score (combination of utilization and session quality)
    const sessionQuality = avgSessionLength > 0 ? Math.min(avgSessionLength / (30 * 60 * 1000), 1) : 0;
    const productivityScore = Math.round((utilizationRate / 100 * 0.7 + sessionQuality * 0.3) * 100);

    return {
      todayTime,
      todayBillable,
      weekTime,
      weekBillable,
      weekRevenue,
      utilizationRate,
      targetUtilization,
      avgSessionLength,
      sessionsToday: todaySessions.length,
      topClient,
      productivityScore
    };
  }, [userSessions, user]);

  // Generate trend data for the last 7 days
  const trendData = useMemo((): TrendData[] => {
    const data: TrendData[] = [];
    const now = new Date();
    
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
      
      data.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        hours: totalMs / (1000 * 60 * 60),
        billableHours: billableMs / (1000 * 60 * 60),
        sessions: daySessions.length
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
                Welcome back, {user?.name || user?.username || 'User'}!
              </h1>
              <p className="text-muted-foreground">
                Here's your productivity overview for today and this week
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

        {/* Key Metrics Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <MetricCard
            title="Today's Time"
            value={formatDuration(metrics.todayTime)}
            description={`${metrics.sessionsToday} sessions`}
            icon={Clock}
          />
          <MetricCard
            title="Today's Billable"
            value={formatDuration(metrics.todayBillable)}
            description={`${Math.round((metrics.todayBillable / Math.max(metrics.todayTime, 1)) * 100)}% of total`}
            icon={DollarSign}
          />
          <MetricCard
            title="Week Revenue"
            value={formatCurrency(metrics.weekRevenue)}
            description="Estimated earnings"
            icon={TrendingUp}
          />
          <MetricCard
            title="Productivity Score"
            value={`${metrics.productivityScore}%`}
            description="Overall efficiency"
            icon={Activity}
          />
        </div>

        {/* Progress & Goals */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Weekly Utilization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Current: {metrics.utilizationRate.toFixed(1)}%
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Target: {metrics.targetUtilization}%
                  </span>
                </div>
                <Progress 
                  value={metrics.utilizationRate} 
                  max={metrics.targetUtilization}
                  className="h-3"
                />
                <div className="flex items-center gap-2">
                  {metrics.utilizationRate >= metrics.targetUtilization ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Target achieved!</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm text-orange-600">
                        {(metrics.targetUtilization - metrics.utilizationRate).toFixed(1)}% below target
                      </span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Session</span>
                  <Badge variant="secondary">
                    {formatDuration(metrics.avgSessionLength)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Top Client Today</span>
                  <Badge variant="outline">{metrics.topClient}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Week Total</span>
                  <Badge variant="secondary">
                    {formatDuration(metrics.weekTime)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend Charts */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>7-Day Time Trend</CardTitle>
              <p className="text-sm text-muted-foreground">
                Daily time tracking over the past week
              </p>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: '200px' }}>
                <ResponsiveContainer>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)}h`, '']} />
                    <Line 
                      type="monotone" 
                      dataKey="hours" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Total Hours"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="billableHours" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Billable Hours"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Sessions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Number of work sessions per day
              </p>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: '200px' }}>
                <ResponsiveContainer>
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sessions" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Navigate to detailed analytics and reports
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <a 
                href="/reports" 
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div>
                    <h3 className="font-medium">Detailed Reports</h3>
                    <p className="text-sm text-muted-foreground">
                      Time tracking analysis & exports
                    </p>
                  </div>
                </div>
              </a>
              
              <a 
                href="/analytics/financial" 
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <div>
                    <h3 className="font-medium">Financial Analytics</h3>
                    <p className="text-sm text-muted-foreground">
                      Revenue & profitability analysis
                    </p>
                  </div>
                </div>
              </a>
              
              {(user?.role === 'admin' || user?.role === 'director') && (
                <a 
                  href="/analytics/team" 
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-purple-600" />
                    <div>
                      <h3 className="font-medium">Team Analytics</h3>
                      <p className="text-sm text-muted-foreground">
                        Team performance & capacity
                      </p>
                    </div>
                  </div>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;