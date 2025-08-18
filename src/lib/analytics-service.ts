interface AnalyticsData {
  monthlyTrends?: any[];
  clientProfitability?: any[];
  teamPerformance?: any[];
  userDailyMetrics?: any[];
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private useOptimizedQueries = true;

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  async getMonthlyTrends(userId?: number, monthsBack: number = 6): Promise<any[]> {
    if (this.useOptimizedQueries && window.electronAPI?.database?.getMonthlyTrends) {
      try {
        return await window.electronAPI.database.getMonthlyTrends(userId, monthsBack);
      } catch (error) {
        console.warn('Optimized monthly trends query failed, falling back to legacy method:', error);
        this.useOptimizedQueries = false;
      }
    }

    // Fallback to original calculation method
    return this.calculateMonthlyTrendsLegacy(userId, monthsBack);
  }

  async getClientProfitability(userId?: number): Promise<any[]> {
    if (this.useOptimizedQueries && window.electronAPI?.database?.getClientProfitability) {
      try {
        return await window.electronAPI.database.getClientProfitability(userId);
      } catch (error) {
        console.warn('Optimized client profitability query failed, falling back to legacy method:', error);
        this.useOptimizedQueries = false;
      }
    }

    // Fallback to original calculation method
    return this.calculateClientProfitabilityLegacy(userId);
  }

  async getTeamPerformance(dateFrom?: Date, dateTo?: Date, team?: string, region?: string): Promise<any[]> {
    if (this.useOptimizedQueries && window.electronAPI?.database?.getTeamPerformance) {
      try {
        return await window.electronAPI.database.getTeamPerformance(dateFrom, dateTo, team, region);
      } catch (error) {
        console.warn('Optimized team performance query failed, falling back to legacy method:', error);
        this.useOptimizedQueries = false;
      }
    }

    // Fallback to original calculation method
    return this.calculateTeamPerformanceLegacy(dateFrom, dateTo, team, region);
  }

  async getUserDailyMetrics(userId?: number, dateFrom?: Date, dateTo?: Date): Promise<any[]> {
    if (this.useOptimizedQueries && window.electronAPI?.database?.getUserDailyMetrics) {
      try {
        return await window.electronAPI.database.getUserDailyMetrics(userId, dateFrom, dateTo);
      } catch (error) {
        console.warn('Optimized user daily metrics query failed, falling back to legacy method:', error);
        this.useOptimizedQueries = false;
      }
    }

    // Fallback to original calculation method
    return this.calculateUserDailyMetricsLegacy(userId, dateFrom, dateTo);
  }

  // Legacy calculation methods (original client-side calculations)
  private async calculateMonthlyTrendsLegacy(userId?: number, monthsBack: number = 6): Promise<any[]> {
    try {
      const sessions = userId 
        ? await window.electronAPI.database.getUserSessions(userId)
        : await window.electronAPI.database.getAllSessions();

      const now = new Date();
      const trends = [];

      for (let i = monthsBack - 1; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

        const monthSessions = sessions.filter(s => 
          s.start >= monthStart.getTime() && s.start <= monthEnd.getTime()
        );

        const totalHours = monthSessions.reduce((sum, s) => sum + s.activeMs, 0) / (1000 * 60 * 60);
        const billableHours = monthSessions.reduce((sum, s) => 
          sum + (s.isBillable !== false ? s.activeMs : 0), 0) / (1000 * 60 * 60);

        // Calculate revenue (simplified)
        const revenue = billableHours * 650; // Default rate

        trends.push({
          year: monthDate.getFullYear(),
          month: monthDate.getMonth() + 1,
          session_count: monthSessions.length,
          total_hours: totalHours,
          billable_hours: billableHours,
          revenue: revenue,
          avg_hourly_rate: billableHours > 0 ? revenue / billableHours : 650
        });
      }

      return trends;
    } catch (error) {
      console.error('Legacy monthly trends calculation failed:', error);
      return [];
    }
  }

  private async calculateClientProfitabilityLegacy(userId?: number): Promise<any[]> {
    try {
      const sessions = userId 
        ? await window.electronAPI.database.getUserSessions(userId)
        : await window.electronAPI.database.getAllSessions();

      const clientData: Record<string, any> = {};

      sessions.forEach(session => {
        const client = session.client || 'Unknown Client';
        const sessionHours = session.activeMs / (1000 * 60 * 60);
        const billableHours = session.isBillable !== false ? sessionHours : 0;
        const revenue = billableHours * 650; // Default rate
        const cost = revenue * 0.7; // Estimated cost

        if (!clientData[client]) {
          clientData[client] = {
            session_count: 0,
            total_hours: 0,
            billable_hours: 0,
            revenue: 0,
            estimated_cost: 0
          };
        }

        clientData[client].session_count++;
        clientData[client].total_hours += sessionHours;
        clientData[client].billable_hours += billableHours;
        clientData[client].revenue += revenue;
        clientData[client].estimated_cost += cost;
      });

      return Object.entries(clientData).map(([client, data]) => ({
        client,
        user_id: userId,
        ...data
      }));
    } catch (error) {
      console.error('Legacy client profitability calculation failed:', error);
      return [];
    }
  }

  private async calculateTeamPerformanceLegacy(dateFrom?: Date, dateTo?: Date, team?: string, region?: string): Promise<any[]> {
    try {
      // This would require user data which might not be available in legacy mode
      // Return empty array for now
      return [];
    } catch (error) {
      console.error('Legacy team performance calculation failed:', error);
      return [];
    }
  }

  private async calculateUserDailyMetricsLegacy(userId?: number, dateFrom?: Date, dateTo?: Date): Promise<any[]> {
    try {
      const sessions = userId 
        ? await window.electronAPI.database.getUserSessions(userId)
        : await window.electronAPI.database.getAllSessions();

      let filteredSessions = sessions;

      if (dateFrom && dateTo) {
        const fromMs = dateFrom.getTime();
        const toMs = dateTo.getTime();
        filteredSessions = sessions.filter(s => s.start >= fromMs && s.start <= toMs);
      }

      const dailyData: Record<string, any> = {};

      filteredSessions.forEach(session => {
        const date = new Date(session.start).toISOString().split('T')[0];
        const key = `${date}_${session.client}_${session.project}`;

        if (!dailyData[key]) {
          dailyData[key] = {
            user_id: session.userId,
            date,
            client: session.client,
            project: session.project,
            session_count: 0,
            total_hours: 0,
            billable_hours: 0,
            revenue: 0
          };
        }

        const sessionHours = session.activeMs / (1000 * 60 * 60);
        const billableHours = session.isBillable !== false ? sessionHours : 0;

        dailyData[key].session_count++;
        dailyData[key].total_hours += sessionHours;
        dailyData[key].billable_hours += billableHours;
        dailyData[key].revenue += billableHours * 650; // Default rate
      });

      return Object.values(dailyData);
    } catch (error) {
      console.error('Legacy user daily metrics calculation failed:', error);
      return [];
    }
  }

  // Utility method to refresh analytics summaries
  async refreshAnalyticsSummaries(): Promise<void> {
    if (window.electronAPI?.database?.populateAnalyticsSummaries) {
      try {
        await window.electronAPI.database.populateAnalyticsSummaries();
        console.log('Analytics summaries refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh analytics summaries:', error);
      }
    }
  }

  // Method to toggle between optimized and legacy mode
  setOptimizedQueries(enabled: boolean): void {
    this.useOptimizedQueries = enabled;
  }

  isUsingOptimizedQueries(): boolean {
    return this.useOptimizedQueries;
  }
}

export default AnalyticsService;