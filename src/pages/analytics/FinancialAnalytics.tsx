import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useTimer } from "@/features/tracker/TimerContext";
import { useAuth } from "@/contexts/AuthContext";
import { DateRangeControls, type DateRange, type Preset } from "@/features/tracker/components/DateRangeControls";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  Target,
  Clock,
  Users,
  PieChart,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from "recharts";
import type { SessionRecord } from "@/features/tracker/TimerContext";

interface FinancialMetrics {
  totalRevenue: number;
  billableHours: number;
  averageRate: number;
  utilizationRate: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  topClients: Array<{ name: string; revenue: number; hours: number }>;
  monthlyTrend: Array<{ month: string; revenue: number; hours: number; rate: number }>;
}

interface ClientProfitability {
  name: string;
  revenue: number;
  hours: number;
  rate: number;
  profit: number;
  margin: number;
  color: string;
}

const COLORS = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#84cc16", "#f97316"
];

function FinancialAnalytics() {
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
  const startOfMonth = (d = new Date()) => { 
    const x = new Date(d.getFullYear(), d.getMonth(), 1); 
    x.setHours(0,0,0,0); 
    return x; 
  };

  const [preset, setPreset] = useState<Preset>("month");
  const [range, setRange] = useState<DateRange>({});

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

  const { from, to } = useMemo(() => {
    if (preset === "today") {
      const n = new Date(); 
      return { from: startOfDay(n), to: endOfDay(n) };
    }
    if (preset === "week") {
      const s = startOfWeek(new Date()); 
      const e = new Date(s); 
      e.setDate(s.getDate() + 6); 
      return { from: s, to: endOfDay(e) };
    }
    if (preset === "month") {
      const s = startOfMonth(new Date()); 
      const e = new Date(s.getFullYear(), s.getMonth() + 1, 0); 
      return { from: s, to: endOfDay(e) };
    }
    const f = range.from ? startOfDay(range.from) : undefined;
    const t = range.to ? endOfDay(range.to) : range.from ? endOfDay(range.from) : undefined;
    return { from: f, to: t };
  }, [preset, range]);

  // Filter sessions based on user permissions and date range
  const filteredSessions = useMemo(() => {
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
    return userSessions.filter((s) => s.start >= fromMs && s.start <= toMs);
  }, [sessions, user, from, to]);

  // Calculate financial metrics
  const metrics = useMemo((): FinancialMetrics => {
    const billableSessions = filteredSessions.filter(s => s.isBillable !== false);
    
    const billableHours = billableSessions.reduce((sum, s) => sum + s.activeMs, 0) / (1000 * 60 * 60);
    const totalHours = filteredSessions.reduce((sum, s) => sum + s.activeMs, 0) / (1000 * 60 * 60);
    
    // Calculate revenue by user or use default rates
    let totalRevenue = 0;
    const clientRevenues: Record<string, { revenue: number; hours: number }> = {};
    
    billableSessions.forEach(session => {
      const sessionHours = session.activeMs / (1000 * 60 * 60);
      let rate = user?.billableRate || 650; // Default rate if no user rate
      
      // Apply discount if applicable
      const discount = (user?.discountPercentage || 0) / 100;
      const effectiveRate = rate * (1 - discount);
      
      const sessionRevenue = sessionHours * effectiveRate;
      totalRevenue += sessionRevenue;
      
      const client = session.task?.client || session.client || 'Unknown Client';
      if (!clientRevenues[client]) {
        clientRevenues[client] = { revenue: 0, hours: 0 };
      }
      clientRevenues[client].revenue += sessionRevenue;
      clientRevenues[client].hours += sessionHours;
    });

    const averageRate = billableHours > 0 ? totalRevenue / billableHours : 0;
    const utilizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
    
    // Estimate total cost (simplified - could be enhanced with actual cost data)
    const estimatedCostRate = averageRate * 0.7; // Assume 70% of revenue is cost
    const totalCost = billableHours * estimatedCostRate;
    const profit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    // Top clients by revenue
    const topClients = Object.entries(clientRevenues)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Monthly trend (last 6 months)
    const monthlyTrend: Array<{ month: string; revenue: number; hours: number; rate: number }> = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      
      const monthSessions = billableSessions.filter(s => 
        s.start >= monthStart.getTime() && s.start <= monthEnd.getTime()
      );
      
      const monthHours = monthSessions.reduce((sum, s) => sum + s.activeMs, 0) / (1000 * 60 * 60);
      let monthRevenue = 0;
      
      monthSessions.forEach(session => {
        const sessionHours = session.activeMs / (1000 * 60 * 60);
        const rate = user?.billableRate || 650;
        const discount = (user?.discountPercentage || 0) / 100;
        monthRevenue += sessionHours * rate * (1 - discount);
      });
      
      const monthRate = monthHours > 0 ? monthRevenue / monthHours : 0;
      
      monthlyTrend.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
        revenue: monthRevenue,
        hours: monthHours,
        rate: monthRate
      });
    }

    return {
      totalRevenue,
      billableHours,
      averageRate,
      utilizationRate,
      totalCost,
      profit,
      profitMargin,
      topClients,
      monthlyTrend
    };
  }, [filteredSessions, user]);

  // Client profitability analysis
  const clientProfitability = useMemo((): ClientProfitability[] => {
    const billableSessions = filteredSessions.filter(s => s.isBillable !== false);
    const clientData: Record<string, { revenue: number; hours: number; cost: number }> = {};
    
    billableSessions.forEach(session => {
      const client = session.task?.client || session.client || 'Unknown Client';
      const sessionHours = session.activeMs / (1000 * 60 * 60);
      const rate = user?.billableRate || 650;
      const discount = (user?.discountPercentage || 0) / 100;
      const revenue = sessionHours * rate * (1 - discount);
      const cost = revenue * 0.7; // Simplified cost calculation
      
      if (!clientData[client]) {
        clientData[client] = { revenue: 0, hours: 0, cost: 0 };
      }
      clientData[client].revenue += revenue;
      clientData[client].hours += sessionHours;
      clientData[client].cost += cost;
    });

    return Object.entries(clientData)
      .map(([name, data], index) => ({
        name,
        revenue: data.revenue,
        hours: data.hours,
        rate: data.hours > 0 ? data.revenue / data.hours : 0,
        profit: data.revenue - data.cost,
        margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSessions, user]);

  // Format helpers
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatHours = (hours: number): string => {
    return `${hours.toFixed(1)}h`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-md">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'revenue' && `Revenue: ${formatCurrency(entry.value)}`}
              {entry.dataKey === 'hours' && `Hours: ${formatHours(entry.value)}`}
              {entry.dataKey === 'rate' && `Rate: ${formatCurrency(entry.value)}/h`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center">
      <div className="w-full max-w-7xl mx-auto py-8 px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Financial Analytics</h1>
              <p className="text-muted-foreground">Revenue analysis, profitability, and financial insights</p>
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

        {/* Key Financial Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(metrics.totalRevenue)}
            description={`${formatHours(metrics.billableHours)} billable`}
            icon={DollarSign}
          />
          <MetricCard
            title="Average Rate"
            value={`${formatCurrency(metrics.averageRate)}/h`}
            description="Effective hourly rate"
            icon={Calculator}
          />
          <MetricCard
            title="Profit"
            value={formatCurrency(metrics.profit)}
            description={`${metrics.profitMargin.toFixed(1)}% margin`}
            icon={metrics.profit >= 0 ? TrendingUp : TrendingDown}
          />
          <MetricCard
            title="Utilization"
            value={`${metrics.utilizationRate.toFixed(1)}%`}
            description="Billable vs total time"
            icon={Target}
          />
        </div>

        {/* Revenue Trends */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>6-Month Revenue Trend</CardTitle>
              <p className="text-sm text-muted-foreground">
                Monthly revenue and billable hours over time
              </p>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer>
                  <LineChart data={metrics.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" opacity={0.3} />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="rate" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Hourly Rate"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Revenue Distribution</CardTitle>
              <p className="text-sm text-muted-foreground">
                Revenue breakdown by top clients
              </p>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer>
                  <RechartsPieChart>
                    <Pie
                      data={clientProfitability.slice(0, 6)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="revenue"
                      nameKey="name"
                    >
                      {clientProfitability.slice(0, 6).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client Profitability Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Client Profitability Analysis</CardTitle>
            <p className="text-sm text-muted-foreground">
              Detailed profitability breakdown by client
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Client</th>
                    <th className="text-right p-2">Revenue</th>
                    <th className="text-right p-2">Hours</th>
                    <th className="text-right p-2">Rate</th>
                    <th className="text-right p-2">Profit</th>
                    <th className="text-right p-2">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {clientProfitability.map((client, index) => (
                    <tr key={client.name} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: client.color }}
                          />
                          {client.name}
                        </div>
                      </td>
                      <td className="text-right p-2 font-medium">
                        {formatCurrency(client.revenue)}
                      </td>
                      <td className="text-right p-2">
                        {formatHours(client.hours)}
                      </td>
                      <td className="text-right p-2">
                        {formatCurrency(client.rate)}/h
                      </td>
                      <td className="text-right p-2">
                        <span className={client.profit >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(client.profit)}
                        </span>
                      </td>
                      <td className="text-right p-2">
                        <Badge 
                          variant={client.margin >= 20 ? "default" : "secondary"}
                          className={client.margin >= 20 ? "bg-green-100 text-green-800" : ""}
                        >
                          {client.margin.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Financial Health Indicators */}
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Revenue Goals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Monthly Target</span>
                  <span className="font-medium">{formatCurrency(50000)}</span>
                </div>
                <Progress 
                  value={(metrics.totalRevenue / 50000) * 100} 
                  className="h-3"
                />
                <div className="text-sm text-muted-foreground">
                  {((metrics.totalRevenue / 50000) * 100).toFixed(1)}% of monthly goal
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Efficiency Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Revenue per hour</span>
                  <span className="font-medium">{formatCurrency(metrics.averageRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Billable hours</span>
                  <span className="font-medium">{formatHours(metrics.billableHours)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Utilization rate</span>
                  <Badge variant={metrics.utilizationRate >= 75 ? "default" : "secondary"}>
                    {metrics.utilizationRate.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.topClients.slice(0, 3).map((client, index) => (
                  <div key={client.name} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground truncate">
                      {client.name}
                    </span>
                    <span className="font-medium">{formatCurrency(client.revenue)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default FinancialAnalytics;