import type { SessionRecord } from "@/features/tracker/TimerContext";
import { electronDB } from "@/lib/electron-database";

interface User {
  id: string | number;
  name?: string;
  surname?: string;
  username?: string;
  billableRate?: number;
  discountPercentage?: number;
  targetUtilization?: number;
  role?: string;
  team?: string;
  jobLevel?: string;
  isActive?: boolean;
}

interface AnalyticsData {
  sessions: SessionRecord[];
  user: User;
}

interface KPIMetrics {
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
  productivityScore: number;
  profitMargin: number;
  avgSessionLength: number;
  sessionsToday: number;
  topClient: string;
  clientConcentrationRisk: number;
}

interface Insight {
  id: string;
  type: 'recommendation' | 'alert' | 'achievement' | 'prediction';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface Prediction {
  metric: string;
  current: number;
  predicted: number;
  confidence: number;
  timeframe: string;
  unit: string;
}

interface ClientAnalytics {
  name: string;
  totalHours: number;
  billableHours: number;
  revenue: number;
  percentage: number;
  profitability: number;
  trend: number;
  riskScore: number;
}

interface TeamMemberPerformance {
  id: string | number;
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
  reliabilityRate?: number;
}

export class AnalyticsEngine {
  private data: AnalyticsData;

  constructor(data: AnalyticsData) {
    this.data = data;
  }

  // Date helpers
  private startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  private endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
  private startOfWeek = (d = new Date()) => { 
    const x = new Date(d); 
    const day = (x.getDay() + 6) % 7; 
    x.setHours(0,0,0,0); 
    x.setDate(x.getDate() - day); 
    return x; 
  };

  calculateKPIs(): KPIMetrics {
    const now = new Date();
    const todayStart = this.startOfDay(now);
    const todayEnd = this.endOfDay(now);
    const weekStart = this.startOfWeek(now);
    
    // Filter sessions
    const todaySessions = this.data.sessions.filter(s => 
      s.start >= todayStart.getTime() && s.start <= todayEnd.getTime()
    );
    
    const weekSessions = this.data.sessions.filter(s => 
      s.start >= weekStart.getTime() && s.start <= todayEnd.getTime()
    );

    // Basic time calculations
    const todayTime = todaySessions.reduce((sum, s) => sum + s.activeMs, 0);
    const todayBillable = todaySessions.reduce((sum, s) => 
      sum + (s.isBillable !== false ? s.activeMs : 0), 0
    );
    
    const weekTime = weekSessions.reduce((sum, s) => sum + s.activeMs, 0);
    const weekBillable = weekSessions.reduce((sum, s) => 
      sum + (s.isBillable !== false ? s.activeMs : 0), 0
    );

    // Revenue calculations
    const billableHoursToday = todayBillable / (1000 * 60 * 60);
    const billableHoursWeek = weekBillable / (1000 * 60 * 60);
    const userRate = this.data.user.billableRate || 0;
    const discount = (this.data.user.discountPercentage || 0) / 100;
    const netRate = userRate * (1 - discount);
    
    const todayRevenue = billableHoursToday * netRate;
    const weekRevenue = billableHoursWeek * netRate;
    
    // Revenue per hour
    const todayRevenuePerHour = billableHoursToday > 0 ? todayRevenue / billableHoursToday : 0;
    const weekRevenuePerHour = billableHoursWeek > 0 ? weekRevenue / billableHoursWeek : 0;

    // Utilization rate
    const workingHoursPerWeek = 40;
    const actualHours = weekTime / (1000 * 60 * 60);
    const utilizationRate = Math.min((actualHours / workingHoursPerWeek) * 100, 100);
    const targetUtilization = this.data.user.targetUtilization || 80;

    // Productivity score (enhanced calculation)
    const avgSessionLength = todaySessions.length > 0 ? todayTime / todaySessions.length : 0;
    const sessionQuality = avgSessionLength > 0 ? Math.min(avgSessionLength / (30 * 60 * 1000), 1) : 0;
    const billableRatio = todayTime > 0 ? todayBillable / todayTime : 0;
    const productivityScore = Math.round(
      (utilizationRate / 100 * 0.4 + sessionQuality * 0.3 + billableRatio * 0.3) * 100
    );

    // Profit margin (simplified - assumes 30% cost base)
    const profitMargin = 70; // This would be calculated from actual cost data

    // Client analysis
    const clientTotals = todaySessions.reduce((acc, s) => {
      const client = s.task?.client || s.client || 'Unknown';
      acc[client] = (acc[client] || 0) + s.activeMs;
      return acc;
    }, {} as Record<string, number>);
    
    const topClient = Object.entries(clientTotals)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'No data';

    // Client concentration risk
    const totalTime = Object.values(clientTotals).reduce((sum, time) => sum + time, 0);
    const topClientTime = Math.max(...Object.values(clientTotals), 0);
    const clientConcentrationRisk = totalTime > 0 ? (topClientTime / totalTime) * 100 : 0;

    return {
      todayTime,
      todayBillable,
      todayRevenue,
      todayRevenuePerHour,
      weekTime,
      weekBillable,
      weekRevenue,
      weekRevenuePerHour,
      utilizationRate,
      targetUtilization,
      productivityScore,
      profitMargin,
      avgSessionLength,
      sessionsToday: todaySessions.length,
      topClient,
      clientConcentrationRisk
    };
  }

  generateInsights(): Insight[] {
    const kpis = this.calculateKPIs();
    const insights: Insight[] = [];

    // Utilization alerts
    if (kpis.utilizationRate < kpis.targetUtilization - 10) {
      insights.push({
        id: 'low-utilization',
        type: 'alert',
        priority: 'high',
        title: 'Low Utilization Alert',
        message: `You're ${(kpis.targetUtilization - kpis.utilizationRate).toFixed(1)}% below your target utilization. Consider scheduling additional billable work.`,
        action: {
          label: 'View Available Projects',
          onClick: () => console.log('Navigate to projects')
        }
      });
    }

    // Client concentration risk
    if (kpis.clientConcentrationRisk > 60) {
      insights.push({
        id: 'client-concentration',
        type: 'alert',
        priority: 'medium',
        title: 'Client Concentration Risk',
        message: `${kpis.clientConcentrationRisk.toFixed(1)}% of your time is with one client. Consider diversifying your portfolio.`,
        action: {
          label: 'View Client Analysis',
          onClick: () => console.log('Navigate to client analytics')
        }
      });
    }

    // Productivity recommendations
    if (kpis.avgSessionLength < 30 * 60 * 1000) { // Less than 30 minutes
      insights.push({
        id: 'short-sessions',
        type: 'recommendation',
        priority: 'medium',
        title: 'Session Length Optimization',
        message: 'Your average session is quite short. Try batching similar tasks for longer focus periods.',
      });
    }

    // Revenue opportunities
    if (kpis.todayRevenuePerHour > 0 && kpis.weekRevenuePerHour > kpis.todayRevenuePerHour * 1.2) {
      insights.push({
        id: 'revenue-opportunity',
        type: 'recommendation',
        priority: 'low',
        title: 'Revenue Optimization',
        message: 'Your current projects show strong revenue potential. Consider similar high-value work.',
      });
    }

    // Achievements
    if (kpis.utilizationRate >= kpis.targetUtilization) {
      insights.push({
        id: 'target-achieved',
        type: 'achievement',
        priority: 'low',
        title: 'Utilization Target Met!',
        message: `Excellent work! You've achieved ${kpis.utilizationRate.toFixed(1)}% utilization this week.`,
      });
    }

    return insights;
  }

  generatePredictions(): Prediction[] {
    const kpis = this.calculateKPIs();
    const predictions: Prediction[] = [];

    // Weekly revenue prediction based on current pace
    const daysWorkedThisWeek = Math.min(new Date().getDay() || 7, 5); // Weekdays only
    const remainingDays = 5 - daysWorkedThisWeek;
    const dailyAverageRevenue = kpis.weekRevenue / Math.max(daysWorkedThisWeek, 1);
    const predictedWeeklyRevenue = kpis.weekRevenue + (dailyAverageRevenue * remainingDays);

    predictions.push({
      metric: 'Weekly Revenue',
      current: kpis.weekRevenue,
      predicted: predictedWeeklyRevenue,
      confidence: Math.min(85 + (daysWorkedThisWeek * 3), 95),
      timeframe: 'End of week',
      unit: ' ZAR'
    });

    // Monthly utilization prediction
    const weekOfMonth = Math.ceil(new Date().getDate() / 7);
    const predictedMonthlyUtilization = kpis.utilizationRate * (4 / weekOfMonth);

    predictions.push({
      metric: 'Monthly Utilization',
      current: kpis.utilizationRate,
      predicted: Math.min(predictedMonthlyUtilization, 100),
      confidence: 75,
      timeframe: 'End of month',
      unit: '%'
    });

    return predictions;
  }

  analyzeClients(): ClientAnalytics[] {
    const weekStart = this.startOfWeek(new Date());
    const weekEnd = this.endOfDay(new Date());
    
    const weekSessions = this.data.sessions.filter(s => 
      s.start >= weekStart.getTime() && s.start <= weekEnd.getTime()
    );

    const clientGroups = weekSessions.reduce((acc, session) => {
      const clientName = session.task?.client || session.client || 'Unknown';
      if (!acc[clientName]) {
        acc[clientName] = {
          sessions: [],
          totalMs: 0,
          billableMs: 0
        };
      }
      acc[clientName].sessions.push(session);
      acc[clientName].totalMs += session.activeMs;
      acc[clientName].billableMs += session.isBillable !== false ? session.activeMs : 0;
      return acc;
    }, {} as Record<string, { sessions: SessionRecord[], totalMs: number, billableMs: number }>);

    const userRate = this.data.user.billableRate || 0;
    const discount = (this.data.user.discountPercentage || 0) / 100;
    const netRate = userRate * (1 - discount);

    const totalTime = Object.values(clientGroups).reduce((sum, client) => sum + client.totalMs, 0);

    return Object.entries(clientGroups).map(([name, data]) => {
      const hours = data.totalMs / (1000 * 60 * 60);
      const billableHours = data.billableMs / (1000 * 60 * 60);
      const revenue = billableHours * netRate;
      const percentage = totalTime > 0 ? (data.totalMs / totalTime) * 100 : 0;
      
      return {
        name,
        totalHours: hours,
        billableHours,
        revenue,
        percentage,
        profitability: billableHours > 0 ? (revenue / billableHours) : 0,
        trend: 0, // Would calculate from historical data
        riskScore: percentage > 50 ? 'high' : percentage > 30 ? 'medium' : 'low'
      } as ClientAnalytics;
    }).sort((a, b) => b.totalHours - a.totalHours);
  }

  getOptimalWorkingHours(): { start: number; end: number; productivity: number }[] {
    // Analyze productivity by hour of day
    const hourlyData: Record<number, { totalMs: number, sessions: number }> = {};
    
    this.data.sessions.forEach(session => {
      const hour = new Date(session.start).getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = { totalMs: 0, sessions: 0 };
      }
      hourlyData[hour].totalMs += session.activeMs;
      hourlyData[hour].sessions += 1;
    });

    return Object.entries(hourlyData)
      .map(([hour, data]) => ({
        start: parseInt(hour),
        end: parseInt(hour) + 1,
        productivity: data.sessions > 0 ? data.totalMs / data.sessions : 0
      }))
      .sort((a, b) => b.productivity - a.productivity)
      .slice(0, 5); // Top 5 productive hours
  }

  // Static method to calculate team performance from all users and sessions
  static async calculateTeamPerformance(allSessions: SessionRecord[]): Promise<TeamMemberPerformance[]> {
    try {
      // Get all users from database
      const allUsers = await window.electronAPI?.auth?.getAllUsers() || [];
      
      if (!allUsers.length) {
        return [];
      }

      const weekStart = AnalyticsEngine.getStartOfWeek(new Date());
      const weekEnd = AnalyticsEngine.getEndOfDay(new Date());

      // Filter sessions for this week
      const weekSessions = allSessions.filter(s => 
        s.start >= weekStart.getTime() && s.start <= weekEnd.getTime()
      );

      const teamPerformance: TeamMemberPerformance[] = [];

      for (const user of allUsers) {
        // Get user's sessions for the week
        const userSessions = weekSessions.filter(s => s.userId === user.id);
        
        if (userSessions.length === 0 && !user.isActive) {
          continue; // Skip inactive users with no sessions
        }

        // Calculate metrics
        const totalMs = userSessions.reduce((sum, s) => sum + s.activeMs, 0);
        const billableMs = userSessions.reduce((sum, s) => 
          sum + (s.isBillable !== false ? s.activeMs : 0), 0
        );
        
        const weeklyHours = totalMs / (1000 * 60 * 60);
        const billableHours = billableMs / (1000 * 60 * 60);
        
        // Calculate revenue
        const userRate = user.billableRate || 0;
        const discount = (user.discountPercentage || 0) / 100;
        const netRate = userRate * (1 - discount);
        const revenue = billableHours * netRate;
        
        // Utilization rate (assuming 40 hour work week)
        const workingHoursPerWeek = 40;
        const utilizationRate = Math.min((weeklyHours / workingHoursPerWeek) * 100, 100);
        const targetUtilization = user.targetUtilization || 80;
        
        // Productivity score
        const avgSessionLength = userSessions.length > 0 ? totalMs / userSessions.length : 0;
        const sessionQuality = avgSessionLength > 0 ? Math.min(avgSessionLength / (30 * 60 * 1000), 1) : 0;
        const billableRatio = totalMs > 0 ? billableMs / totalMs : 0;
        const productivityScore = Math.round(
          (utilizationRate / 100 * 0.4 + sessionQuality * 0.3 + billableRatio * 0.3) * 100
        );

        // Count active projects (unique client/project combinations)
        const projects = new Set(userSessions.map(s => `${s.client}-${s.project}`));
        const projectsActive = projects.size;

        // Determine performance level
        let performance: 'excellent' | 'good' | 'needs-improvement';
        if (utilizationRate >= targetUtilization && productivityScore >= 80) {
          performance = 'excellent';
        } else if (utilizationRate >= targetUtilization * 0.8 && productivityScore >= 65) {
          performance = 'good';
        } else {
          performance = 'needs-improvement';
        }

        // Get reliability rate if available
        let reliabilityRate: number | undefined;
        try {
          reliabilityRate = await electronDB.getUserReliabilityRate(user.id, weekStart);
        } catch (error) {
          console.warn('Could not fetch reliability rate for user', user.id);
        }

        const displayName = user.name && user.surname 
          ? `${user.name} ${user.surname}`
          : user.name || user.username || `User ${user.id}`;

        teamPerformance.push({
          id: user.id,
          name: displayName,
          role: user.jobLevel || user.role || 'Team Member',
          utilizationRate,
          targetUtilization,
          weeklyHours,
          billableHours,
          revenue,
          productivityScore,
          projectsActive,
          performance,
          reliabilityRate
        });
      }

      // Sort by productivity score descending
      return teamPerformance.sort((a, b) => b.productivityScore - a.productivityScore);
    } catch (error) {
      console.error('Error calculating team performance:', error);
      return [];
    }
  }

  // Helper methods
  private static getStartOfWeek(d = new Date()) { 
    const x = new Date(d); 
    const day = (x.getDay() + 6) % 7; 
    x.setHours(0,0,0,0); 
    x.setDate(x.getDate() - day); 
    return x; 
  }

  private static getEndOfDay(d: Date) { 
    const x = new Date(d); 
    x.setHours(23,59,59,999); 
    return x; 
  }
}