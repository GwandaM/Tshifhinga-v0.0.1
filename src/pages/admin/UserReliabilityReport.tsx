import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  AlertTriangle, 
  Download,
  Filter,
  Calendar,
  BarChart3,
  Clock
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { ReliabilityCalculator } from "@/lib/reliability-calculator";
import { cn } from "@/lib/utils";
import { electronDB } from "@/lib/electron-database";

interface ReliabilityMetrics {
  id: number;
  user_id: number;
  username: string;
  name: string;
  surname: string;
  team: string;
  region: string;
  week_start_date: string;
  total_tracked_ms: number;
  total_edited_ms: number;
  reliability_rate: number;
  session_count: number;
  edited_session_count: number;
  created_at: number;
  updated_at: number;
}

export const UserReliabilityReport: React.FC = () => {
  const [metrics, setMetrics] = useState<ReliabilityMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    team: "",
    region: "",
    reliability: "",
    weeks: 12,
  });

  useEffect(() => {
    document.title = "User Reliability Report — Tshifhinga";
    loadReliabilityMetrics();
  }, []);

  const loadReliabilityMetrics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await electronDB.getAllUserReliabilityMetrics();
      setMetrics(data);
    } catch (err) {
      setError("Failed to load reliability metrics");
      console.error("Error loading reliability metrics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Process data for analysis
  const processedData = useMemo(() => {
    // Get unique users and their latest metrics
    const userMetrics = new Map<number, ReliabilityMetrics[]>();
    
    metrics.forEach(metric => {
      if (!userMetrics.has(metric.user_id)) {
        userMetrics.set(metric.user_id, []);
      }
      userMetrics.get(metric.user_id)!.push(metric);
    });

    // Calculate aggregated metrics for each user
    const userSummaries = Array.from(userMetrics.entries()).map(([userId, userMetricsList]) => {
      const sortedMetrics = userMetricsList.sort((a, b) => 
        new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime()
      );
      
      const latestMetric = sortedMetrics[0];
      const recentMetrics = sortedMetrics.slice(0, filters.weeks);
      
      const totalTrackedMs = recentMetrics.reduce((sum, m) => sum + m.total_tracked_ms, 0);
      const totalEditedMs = recentMetrics.reduce((sum, m) => sum + Math.abs(m.total_edited_ms), 0);
      const totalCurrentMs = totalTrackedMs + totalEditedMs;
      const avgReliabilityRate = totalCurrentMs > 0 ? totalTrackedMs / totalCurrentMs : 1.0;
      
      const totalSessions = recentMetrics.reduce((sum, m) => sum + m.session_count, 0);
      const totalEditedSessions = recentMetrics.reduce((sum, m) => sum + m.edited_session_count, 0);
      const editFrequency = totalSessions > 0 ? totalEditedSessions / totalSessions : 0;

      // Calculate trend (comparing latest 4 weeks vs previous 4 weeks)
      const latest4Weeks = recentMetrics.slice(0, 4);
      const previous4Weeks = recentMetrics.slice(4, 8);
      
      const latestAvg = latest4Weeks.length > 0 
        ? latest4Weeks.reduce((sum, m) => sum + m.reliability_rate, 0) / latest4Weeks.length 
        : 0;
      const previousAvg = previous4Weeks.length > 0 
        ? previous4Weeks.reduce((sum, m) => sum + m.reliability_rate, 0) / previous4Weeks.length 
        : latestAvg;
      
      const trend = latestAvg - previousAvg;

      return {
        ...latestMetric,
        avgReliabilityRate,
        totalTrackedMs,
        totalEditedMs,
        totalCurrentMs,
        totalSessions,
        totalEditedSessions,
        editFrequency,
        trend,
        weeklyMetrics: recentMetrics,
      };
    });

    return userSummaries;
  }, [metrics, filters.weeks]);

  // Apply filters
  const filteredData = useMemo(() => {
    return processedData.filter(user => {
      if (filters.search && !user.username.toLowerCase().includes(filters.search.toLowerCase()) &&
          !user.name?.toLowerCase().includes(filters.search.toLowerCase()) &&
          !user.surname?.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      
      if (filters.team && user.team !== filters.team) {
        return false;
      }
      
      if (filters.region && user.region !== filters.region) {
        return false;
      }
      
      if (filters.reliability) {
        const rate = user.avgReliabilityRate;
        switch (filters.reliability) {
          case 'excellent':
            if (rate < 0.95) return false;
            break;
          case 'good':
            if (rate < 0.85 || rate >= 0.95) return false;
            break;
          case 'fair':
            if (rate < 0.70 || rate >= 0.85) return false;
            break;
          case 'poor':
            if (rate >= 0.70) return false;
            break;
        }
      }
      
      return true;
    });
  }, [processedData, filters]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        totalUsers: 0,
        avgReliability: 0,
        excellentCount: 0,
        goodCount: 0,
        fairCount: 0,
        poorCount: 0,
      };
    }

    const totalReliability = filteredData.reduce((sum, user) => sum + user.avgReliabilityRate, 0);
    const avgReliability = totalReliability / filteredData.length;

    const excellentCount = filteredData.filter(u => u.avgReliabilityRate >= 0.95).length;
    const goodCount = filteredData.filter(u => u.avgReliabilityRate >= 0.85 && u.avgReliabilityRate < 0.95).length;
    const fairCount = filteredData.filter(u => u.avgReliabilityRate >= 0.70 && u.avgReliabilityRate < 0.85).length;
    const poorCount = filteredData.filter(u => u.avgReliabilityRate < 0.70).length;

    return {
      totalUsers: filteredData.length,
      avgReliability,
      excellentCount,
      goodCount,
      fairCount,
      poorCount,
    };
  }, [filteredData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (filteredData.length === 0) return [];

    // Get all unique weeks from the data
    const weeks = new Set<string>();
    filteredData.forEach(user => {
      user.weeklyMetrics.forEach(metric => {
        weeks.add(metric.week_start_date);
      });
    });

    return Array.from(weeks)
      .sort()
      .slice(-filters.weeks)
      .map(week => {
        const weekData = filteredData.map(user => {
          const metric = user.weeklyMetrics.find(m => m.week_start_date === week);
          return metric ? metric.reliability_rate : null;
        }).filter(rate => rate !== null);

        const avgRate = weekData.length > 0 
          ? weekData.reduce((sum, rate) => sum + rate!, 0) / weekData.length 
          : 0;

        return {
          week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          reliability: avgRate,
          userCount: weekData.length,
        };
      });
  }, [filteredData, filters.weeks]);

  const getReliabilityBadge = (rate: number) => {
    const category = ReliabilityCalculator.getReliabilityCategory(rate);
    const colorClass = {
      excellent: 'bg-green-100 text-green-800 border-green-300',
      good: 'bg-blue-100 text-blue-800 border-blue-300',
      fair: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      poor: 'bg-red-100 text-red-800 border-red-300',
    }[category.category];

    return (
      <Badge variant="outline" className={colorClass}>
        {ReliabilityCalculator.formatReliabilityRate(rate)}
      </Badge>
    );
  };

  const exportReport = async () => {
    try {
      const csvData = [
        ['Username', 'Name', 'Team', 'Region', 'Reliability Rate', 'Total Hours', 'Edited Hours', 'Sessions', 'Edited Sessions', 'Edit Frequency'].join(','),
        ...filteredData.map(user => [
          user.username,
          `${user.name || ''} ${user.surname || ''}`.trim(),
          user.team || '',
          user.region || '',
          ReliabilityCalculator.formatReliabilityRate(user.avgReliabilityRate),
          (user.totalCurrentMs / (1000 * 60 * 60)).toFixed(1),
          (user.totalEditedMs / (1000 * 60 * 60)).toFixed(1),
          user.totalSessions,
          user.totalEditedSessions,
          (user.editFrequency * 100).toFixed(1) + '%'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reliability-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="w-full max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Clock className="w-8 h-8 animate-spin mr-3" />
            Loading reliability metrics...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Reliability Report</h1>
            <p className="text-muted-foreground mt-1">
              Track time tracking accuracy and editing patterns across users
            </p>
          </div>
          <Button onClick={exportReport} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input
                placeholder="Search users..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
              <Select value={filters.team} onValueChange={(value) => setFilters(prev => ({ ...prev, team: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Teams</SelectItem>
                  <SelectItem value="LIFE">Life</SelectItem>
                  <SelectItem value="NON_LIFE">Non-Life</SelectItem>
                  <SelectItem value="ACCOUNTING">Accounting</SelectItem>
                  <SelectItem value="ADVISORY">Advisory</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.region} onValueChange={(value) => setFilters(prev => ({ ...prev, region: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Regions</SelectItem>
                  <SelectItem value="CPT">Cape Town</SelectItem>
                  <SelectItem value="JHB">Johannesburg</SelectItem>
                  <SelectItem value="KEN">Kenya</SelectItem>
                  <SelectItem value="UK">United Kingdom</SelectItem>
                  <SelectItem value="NAM">Namibia</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.reliability} onValueChange={(value) => setFilters(prev => ({ ...prev, reliability: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Reliability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Reliability</SelectItem>
                  <SelectItem value="excellent">Excellent (95%+)</SelectItem>
                  <SelectItem value="good">Good (85-94%)</SelectItem>
                  <SelectItem value="fair">Fair (70-84%)</SelectItem>
                  <SelectItem value="poor">Poor (<70%)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.weeks.toString()} onValueChange={(value) => setFilters(prev => ({ ...prev, weeks: parseInt(value) }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">Last 4 weeks</SelectItem>
                  <SelectItem value="8">Last 8 weeks</SelectItem>
                  <SelectItem value="12">Last 12 weeks</SelectItem>
                  <SelectItem value="24">Last 24 weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{summaryStats.totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Reliability</p>
                  <p className="text-2xl font-bold">{ReliabilityCalculator.formatReliabilityRate(summaryStats.avgReliability)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Excellent</p>
                <div className="flex items-center gap-2">
                  <Progress value={(summaryStats.excellentCount / summaryStats.totalUsers) * 100} className="flex-1" />
                  <span className="text-sm font-medium">{summaryStats.excellentCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Good</p>
                <div className="flex items-center gap-2">
                  <Progress value={(summaryStats.goodCount / summaryStats.totalUsers) * 100} className="flex-1" />
                  <span className="text-sm font-medium">{summaryStats.goodCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Need Improvement</p>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={((summaryStats.fairCount + summaryStats.poorCount) / summaryStats.totalUsers) * 100} 
                    className="flex-1" 
                  />
                  <span className="text-sm font-medium">{summaryStats.fairCount + summaryStats.poorCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Reliability Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis 
                    domain={[0.5, 1]}
                    tickFormatter={(value) => `${Math.round(value * 100)}%`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${Math.round(value * 100)}%`, 'Avg Reliability']}
                    labelFormatter={(label) => `Week of ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="reliability" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Reliability</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Edited Hours</TableHead>
                  <TableHead>Edit Frequency</TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData
                  .sort((a, b) => b.avgReliabilityRate - a.avgReliabilityRate)
                  .map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.name} {user.surname}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{user.team}</div>
                        <div className="text-xs text-muted-foreground">{user.region}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getReliabilityBadge(user.avgReliabilityRate)}
                    </TableCell>
                    <TableCell>
                      {(user.totalCurrentMs / (1000 * 60 * 60)).toFixed(1)}h
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        user.totalEditedMs > 0 ? "text-orange-600" : "text-muted-foreground"
                      )}>
                        {(user.totalEditedMs / (1000 * 60 * 60)).toFixed(1)}h
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        user.editFrequency > 0.3 ? "text-red-600" : 
                        user.editFrequency > 0.1 ? "text-orange-600" : "text-green-600"
                      )}>
                        {(user.editFrequency * 100).toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {user.trend > 0.02 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : user.trend < -0.02 ? (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                        <span className={cn(
                          "text-sm",
                          user.trend > 0.02 ? "text-green-600" : 
                          user.trend < -0.02 ? "text-red-600" : "text-muted-foreground"
                        )}>
                          {user.trend > 0 ? "+" : ""}{(user.trend * 100).toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserReliabilityReport;