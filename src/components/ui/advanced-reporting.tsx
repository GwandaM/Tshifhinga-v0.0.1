import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  Download, 
  FileText, 
  Calendar, 
  TrendingUp, 
  Users, 
  DollarSign,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface TeamMemberPerformance {
  id: string;
  name: string;
  role: string;
  utilizationRate: number;
  targetUtilization: number;
  weeklyHours: number;
  billableHours: number;
  revenue: number;
  productivityScore: number;
  projectsActive: number;
  performance: 'excellent' | 'good' | 'needs-improvement';
}

interface CapacityForecast {
  week: string;
  availableCapacity: number;
  projectedDemand: number;
  utilizationForecast: number;
  recommendedAction: string;
}

interface AdvancedReportingProps {
  userRole: string;
  teamData?: TeamMemberPerformance[];
  capacityForecast?: CapacityForecast[];
  isLoadingTeamData?: boolean;
}

const PerformanceIcon = ({ performance }: { performance: TeamMemberPerformance['performance'] }) => {
  switch (performance) {
    case 'excellent':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'good':
      return <TrendingUp className="h-4 w-4 text-blue-600" />;
    case 'needs-improvement':
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  }
};

export const TeamPerformanceDashboard: React.FC<{
  teamData: TeamMemberPerformance[];
  isLoading?: boolean;
}> = ({ teamData, isLoading = false }) => {
  const [sortBy, setSortBy] = useState<keyof TeamMemberPerformance>('productivityScore');
  
  // Safely handle empty teamData
  const safeTeamData = teamData || [];
  
  const sortedTeam = useMemo(() => {
    return [...safeTeamData].sort((a, b) => {
      if (typeof a[sortBy] === 'number' && typeof b[sortBy] === 'number') {
        return (b[sortBy] as number) - (a[sortBy] as number);
      }
      return 0;
    });
  }, [safeTeamData, sortBy]);

  const teamStats = useMemo(() => ({
    avgUtilization: safeTeamData.length > 0 
      ? safeTeamData.reduce((sum, member) => sum + (member.utilizationRate || 0), 0) / safeTeamData.length 
      : 0,
    totalRevenue: safeTeamData.reduce((sum, member) => sum + (member.revenue || 0), 0),
    highPerformers: safeTeamData.filter(member => member.performance === 'excellent').length,
    needsAttention: safeTeamData.filter(member => member.performance === 'needs-improvement').length
  }), [safeTeamData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Performance Overview
          </div>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as keyof TeamMemberPerformance)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="productivityScore">Productivity Score</SelectItem>
              <SelectItem value="utilizationRate">Utilization Rate</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="billableHours">Billable Hours</SelectItem>
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading team performance data...</p>
          </div>
        ) : safeTeamData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No team data available</p>
            <p className="text-xs">Team members need to track time to appear here</p>
          </div>
        ) : (
          <>
            {/* Team Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{teamStats.avgUtilization.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Avg Utilization</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">R{teamStats.totalRevenue.toFixed(0)}</div>
            <div className="text-sm text-muted-foreground">Total Revenue</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{teamStats.highPerformers}</div>
            <div className="text-sm text-muted-foreground">High Performers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{teamStats.needsAttention}</div>
            <div className="text-sm text-muted-foreground">Needs Attention</div>
          </div>
        </div>

        {/* Team Member List */}
        <div className="space-y-3">
          {sortedTeam.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <PerformanceIcon performance={member.performance} />
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="text-sm text-muted-foreground">{member.role}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-sm font-medium">{(member.utilizationRate || 0).toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Utilization</div>
                </div>
                
                <div className="text-center">
                  <div className="text-sm font-medium">{member.productivityScore || 0}%</div>
                  <div className="text-xs text-muted-foreground">Productivity</div>
                </div>
                
                <div className="text-center">
                  <div className="text-sm font-medium">R{(member.revenue || 0).toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">Revenue</div>
                </div>
                
                <div className="text-center">
                  <div className="text-sm font-medium">{member.projectsActive || 0}</div>
                  <div className="text-xs text-muted-foreground">Projects</div>
                </div>
                
                <Badge variant={
                  member.performance === 'excellent' ? 'default' :
                  member.performance === 'good' ? 'secondary' : 'destructive'
                }>
                  {(member.performance || 'unknown').replace('-', ' ')}
                </Badge>
              </div>
            </div>
          ))}
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const CapacityPlanningChart: React.FC<{
  forecastData: CapacityForecast[];
}> = ({ forecastData }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Capacity Planning Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {forecastData.map((week, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">{week.week}</span>
                <div className="flex items-center gap-2">
                  {week.utilizationForecast > 100 ? (
                    <ArrowUpRight className="h-4 w-4 text-red-600" />
                  ) : week.utilizationForecast < 70 ? (
                    <ArrowDownRight className="h-4 w-4 text-blue-600" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  <span className="text-sm font-medium">
                    {week.utilizationForecast.toFixed(1)}% utilization
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Available: {week.availableCapacity}h</span>
                  <span>Demand: {week.projectedDemand}h</span>
                </div>
                <Progress 
                  value={(week.projectedDemand / week.availableCapacity) * 100} 
                  className="h-2"
                />
              </div>
              
              <div className="text-xs text-muted-foreground">
                💡 {week.recommendedAction}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const ReportExportPanel: React.FC = () => {
  const [exportFormat, setExportFormat] = useState('excel');
  const [dateRange, setDateRange] = useState('this-week');
  
  const handleExport = (reportType: string) => {
    // This would integrate with the actual export functionality
    console.log(`Exporting ${reportType} as ${exportFormat} for ${dateRange}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Advanced Reports & Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Export Format</label>
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="pdf">PDF Report</SelectItem>
                <SelectItem value="json">JSON Data</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium">Date Range</label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3">
          <Button 
            variant="outline" 
            className="justify-start gap-2"
            onClick={() => handleExport('financial')}
          >
            <DollarSign className="h-4 w-4" />
            Financial Performance Report
          </Button>
          
          <Button 
            variant="outline" 
            className="justify-start gap-2"
            onClick={() => handleExport('productivity')}
          >
            <TrendingUp className="h-4 w-4" />
            Productivity Analysis Report
          </Button>
          
          <Button 
            variant="outline" 
            className="justify-start gap-2"
            onClick={() => handleExport('client')}
          >
            <Users className="h-4 w-4" />
            Client Portfolio Analysis
          </Button>
          
          <Button 
            variant="outline" 
            className="justify-start gap-2"
            onClick={() => handleExport('time-tracking')}
          >
            <Clock className="h-4 w-4" />
            Detailed Time Tracking Log
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const AdvancedReporting: React.FC<AdvancedReportingProps> = ({
  userRole,
  teamData = [],
  capacityForecast = [],
  isLoadingTeamData = false
}) => {
  if (userRole !== 'admin' && userRole !== 'director') {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Advanced reporting features are available for admins and directors.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <TeamPerformanceDashboard teamData={teamData} isLoading={isLoadingTeamData} />
    </div>
  );
};