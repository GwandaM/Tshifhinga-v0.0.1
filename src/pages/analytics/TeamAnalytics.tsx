import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useTimer } from "@/features/tracker/TimerContext";
import { useAuth } from "@/contexts/AuthContext";
import { DateRangeControls, type DateRange, type Preset } from "@/features/tracker/components/DateRangeControls";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, 
  TrendingUp, 
  Clock, 
  Target,
  Award,
  Activity,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Filter,
  RefreshCw
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter
} from "recharts";
import type { SessionRecord } from "@/features/tracker/TimerContext";

interface TeamMember {
  id: number;
  username: string;
  name?: string;
  team?: string;
  region?: string;
  jobLevel?: string;
  billableRate?: number;
  targetUtilization?: number;
  sessions: SessionRecord[];
  metrics: {
    totalHours: number;
    billableHours: number;
    revenue: number;
    utilizationRate: number;
    avgSessionLength: number;
    sessionsCount: number;
    productivityScore: number;
  };
}

interface TeamMetrics {
  totalMembers: number;
  activeMembers: number;
  totalHours: number;
  totalRevenue: number;
  avgUtilization: number;
  topPerformers: TeamMember[];
  utilizationDistribution: Array<{ range: string; count: number }>;
  teamComparison: Array<{ team: string; avgUtilization: number; revenue: number; members: number }>;
  regionComparison: Array<{ region: string; avgUtilization: number; revenue: number; members: number }>;
}

function TeamAnalytics() {
  const { sessions, refreshSessions } = useTimer();
  const { user, users } = useAuth();
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
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");

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

  // Filter sessions by date range
  const filteredSessions = useMemo(() => {
    if (!from || !to) return sessions;
    const fromMs = from.getTime();
    const toMs = to.getTime();
    return sessions.filter((s) => s.start >= fromMs && s.start <= toMs);
  }, [sessions, from, to]);

  // Calculate team member metrics
  const teamMembers = useMemo((): TeamMember[] => {
    if (!users) return [];
    
    return users
      .filter(u => u.isActive)
      .map(user => {
        const userSessions = filteredSessions.filter(s => s.userId === user.id);
        
        const totalMs = userSessions.reduce((sum, s) => sum + s.activeMs, 0);
        const billableMs = userSessions.reduce((sum, s) => 
          sum + (s.isBillable !== false ? s.activeMs : 0), 0
        );
        
        const totalHours = totalMs / (1000 * 60 * 60);
        const billableHours = billableMs / (1000 * 60 * 60);
        
        const workingHours = 40; // Standard work week
        const utilizationRate = Math.min((totalHours / workingHours) * 100, 100);
        
        const rate = user.billableRate || 650;
        const discount = (user.discountPercentage || 0) / 100;
        const revenue = billableHours * rate * (1 - discount);
        
        const avgSessionLength = userSessions.length > 0 ? totalMs / userSessions.length : 0;
        const sessionQuality = avgSessionLength > 0 ? Math.min(avgSessionLength / (30 * 60 * 1000), 1) : 0;
        const productivityScore = Math.round((utilizationRate / 100 * 0.7 + sessionQuality * 0.3) * 100);

        return {
          id: user.id,
          username: user.username,
          name: user.name,
          team: user.team,
          region: user.region,
          jobLevel: user.jobLevel,
          billableRate: user.billableRate,
          targetUtilization: user.targetUtilization,
          sessions: userSessions,
          metrics: {
            totalHours,
            billableHours,
            revenue,
            utilizationRate,
            avgSessionLength,
            sessionsCount: userSessions.length,
            productivityScore
          }
        };
      })
      .filter(member => 
        (selectedTeam === "all" || member.team === selectedTeam) &&
        (selectedRegion === "all" || member.region === selectedRegion)
      );
  }, [users, filteredSessions, selectedTeam, selectedRegion]);

  // Calculate overall team metrics
  const teamMetrics = useMemo((): TeamMetrics => {
    const activeMembers = teamMembers.filter(m => m.metrics.totalHours > 0);
    const totalHours = teamMembers.reduce((sum, m) => sum + m.metrics.totalHours, 0);
    const totalRevenue = teamMembers.reduce((sum, m) => sum + m.metrics.revenue, 0);
    const avgUtilization = activeMembers.length > 0 
      ? activeMembers.reduce((sum, m) => sum + m.metrics.utilizationRate, 0) / activeMembers.length 
      : 0;

    const topPerformers = [...teamMembers]
      .sort((a, b) => b.metrics.productivityScore - a.metrics.productivityScore)
      .slice(0, 5);

    // Utilization distribution
    const utilizationRanges = [
      { range: "0-25%", count: 0 },
      { range: "25-50%", count: 0 },
      { range: "50-75%", count: 0 },
      { range: "75-100%", count: 0 },
      { range: "100%+", count: 0 }
    ];

    teamMembers.forEach(member => {
      const util = member.metrics.utilizationRate;
      if (util < 25) utilizationRanges[0].count++;
      else if (util < 50) utilizationRanges[1].count++;
      else if (util < 75) utilizationRanges[2].count++;
      else if (util < 100) utilizationRanges[3].count++;
      else utilizationRanges[4].count++;
    });

    // Team comparison
    const teamGroups = teamMembers.reduce((acc, member) => {
      const team = member.team || 'Unassigned';
      if (!acc[team]) {
        acc[team] = { members: [], totalRevenue: 0, totalUtilization: 0 };
      }
      acc[team].members.push(member);
      acc[team].totalRevenue += member.metrics.revenue;
      acc[team].totalUtilization += member.metrics.utilizationRate;
      return acc;
    }, {} as Record<string, { members: TeamMember[]; totalRevenue: number; totalUtilization: number }>);

    const teamComparison = Object.entries(teamGroups).map(([team, data]) => ({
      team,
      avgUtilization: data.members.length > 0 ? data.totalUtilization / data.members.length : 0,
      revenue: data.totalRevenue,
      members: data.members.length
    }));

    // Region comparison
    const regionGroups = teamMembers.reduce((acc, member) => {
      const region = member.region || 'Unassigned';
      if (!acc[region]) {
        acc[region] = { members: [], totalRevenue: 0, totalUtilization: 0 };
      }
      acc[region].members.push(member);
      acc[region].totalRevenue += member.metrics.revenue;
      acc[region].totalUtilization += member.metrics.utilizationRate;
      return acc;
    }, {} as Record<string, { members: TeamMember[]; totalRevenue: number; totalUtilization: number }>);

    const regionComparison = Object.entries(regionGroups).map(([region, data]) => ({
      region,
      avgUtilization: data.members.length > 0 ? data.totalUtilization / data.members.length : 0,
      revenue: data.totalRevenue,
      members: data.members.length
    }));

    return {
      totalMembers: teamMembers.length,
      activeMembers: activeMembers.length,
      totalHours,
      totalRevenue,
      avgUtilization,
      topPerformers,
      utilizationDistribution: utilizationRanges,
      teamComparison,
      regionComparison
    };
  }, [teamMembers]);

  // Get unique teams and regions for filters
  const availableTeams = useMemo(() => {
    if (!users) return [];
    const teams = [...new Set(users.map(u => u.team).filter(Boolean))];
    return teams.sort();
  }, [users]);

  const availableRegions = useMemo(() => {
    if (!users) return [];
    const regions = [...new Set(users.map(u => u.region).filter(Boolean))];
    return regions.sort();
  }, [users]);

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

  const getInitials = (name?: string, username?: string): string => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return username?.slice(0, 2).toUpperCase() || 'UN';
  };

  // Check permissions
  if (user?.role !== 'admin' && user?.role !== 'director') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">
            You need admin or director permissions to view team analytics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center">
      <div className="w-full max-w-7xl mx-auto py-8 px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Team Analytics</h1>
              <p className="text-muted-foreground">Team performance, utilization, and capacity analysis</p>
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

        {/* Filters */}
        <div className="flex gap-4 mb-8">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select 
              value={selectedTeam} 
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="all">All Teams</option>
              {availableTeams.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={selectedRegion} 
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="all">All Regions</option>
              {availableRegions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Key Team Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <MetricCard
            title="Team Members"
            value={teamMetrics.totalMembers.toString()}
            description={`${teamMetrics.activeMembers} active`}
            icon={Users}
          />
          <MetricCard
            title="Total Hours"
            value={formatHours(teamMetrics.totalHours)}
            description="Team total"
            icon={Clock}
          />
          <MetricCard
            title="Team Revenue"
            value={formatCurrency(teamMetrics.totalRevenue)}
            description="Combined earnings"
            icon={TrendingUp}
          />
          <MetricCard
            title="Avg Utilization"
            value={`${teamMetrics.avgUtilization.toFixed(1)}%`}
            description="Team average"
            icon={Target}
          />
        </div>

        {/* Team Comparisons */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Team Performance Comparison</CardTitle>
              <p className="text-sm text-muted-foreground">
                Average utilization and revenue by team
              </p>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer>
                  <BarChart data={teamMetrics.teamComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="team" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="avgUtilization" fill="#3b82f6" name="Avg Utilization %" />
                    <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue (ZAR)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regional Performance</CardTitle>
              <p className="text-sm text-muted-foreground">
                Performance comparison across regions
              </p>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer>
                  <BarChart data={teamMetrics.regionComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="region" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="avgUtilization" fill="#8b5cf6" name="Avg Utilization %" />
                    <Bar yAxisId="right" dataKey="revenue" fill="#f59e0b" name="Revenue (ZAR)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Utilization Distribution */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Utilization Distribution</CardTitle>
            <p className="text-sm text-muted-foreground">
              Distribution of team members across utilization ranges
            </p>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: '200px' }}>
              <ResponsiveContainer>
                <BarChart data={teamMetrics.utilizationDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top Performers
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Highest productivity scores based on utilization and session quality
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamMetrics.topPerformers.map((member, index) => (
                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{getInitials(member.name, member.username)}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div>
                      <h4 className="font-medium">{member.name || member.username}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {member.team && <Badge variant="outline">{member.team}</Badge>}
                        {member.region && <Badge variant="secondary">{member.region}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <div className="font-medium">{formatHours(member.metrics.totalHours)}</div>
                        <div className="text-muted-foreground">Hours</div>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{member.metrics.utilizationRate.toFixed(1)}%</div>
                        <div className="text-muted-foreground">Utilization</div>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{formatCurrency(member.metrics.revenue)}</div>
                        <div className="text-muted-foreground">Revenue</div>
                      </div>
                      <Badge 
                        variant={member.metrics.productivityScore >= 80 ? "default" : "secondary"}
                        className={member.metrics.productivityScore >= 80 ? "bg-green-100 text-green-800" : ""}
                      >
                        {member.metrics.productivityScore}% Score
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Team Member List */}
        <Card>
          <CardHeader>
            <CardTitle>Team Member Details</CardTitle>
            <p className="text-sm text-muted-foreground">
              Comprehensive view of all team member performance metrics
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Member</th>
                    <th className="text-left p-2">Team</th>
                    <th className="text-left p-2">Region</th>
                    <th className="text-right p-2">Hours</th>
                    <th className="text-right p-2">Utilization</th>
                    <th className="text-right p-2">Revenue</th>
                    <th className="text-right p-2">Sessions</th>
                    <th className="text-right p-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers
                    .sort((a, b) => b.metrics.totalHours - a.metrics.totalHours)
                    .map((member) => (
                    <tr key={member.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(member.name, member.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{member.name || member.username}</div>
                            <div className="text-xs text-muted-foreground">{member.jobLevel}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        {member.team ? (
                          <Badge variant="outline">{member.team}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-2">
                        {member.region ? (
                          <Badge variant="secondary">{member.region}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-right p-2 font-medium">
                        {formatHours(member.metrics.totalHours)}
                      </td>
                      <td className="text-right p-2">
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={member.metrics.utilizationRate} 
                            max={member.targetUtilization || 80}
                            className="w-16 h-2"
                          />
                          <span className="text-sm">
                            {member.metrics.utilizationRate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="text-right p-2 font-medium">
                        {formatCurrency(member.metrics.revenue)}
                      </td>
                      <td className="text-right p-2">
                        {member.metrics.sessionsCount}
                      </td>
                      <td className="text-right p-2">
                        <Badge 
                          variant={member.metrics.productivityScore >= 80 ? "default" : "secondary"}
                          className={member.metrics.productivityScore >= 80 ? "bg-green-100 text-green-800" : ""}
                        >
                          {member.metrics.productivityScore}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default TeamAnalytics;