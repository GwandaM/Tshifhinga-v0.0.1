// Reliability calculation utilities for session editing tracking

export interface ReliabilityMetrics {
  totalTrackedMs: number;
  totalEditedMs: number;
  totalCurrentMs: number;
  reliabilityRate: number;
  sessionCount: number;
  editedSessionCount: number;
  averageEditSize: number;
  editFrequency: number;
}

export interface WeeklyReliabilityData {
  weekStart: Date;
  weekEnd: Date;
  metrics: ReliabilityMetrics;
  dailyBreakdown: DailyReliabilityData[];
}

export interface DailyReliabilityData {
  date: Date;
  trackedMs: number;
  editedMs: number;
  currentMs: number;
  sessionCount: number;
  editedSessionCount: number;
}

export class ReliabilityCalculator {
  /**
   * Calculate reliability rate: (tracked_time / total_time) * 100
   */
  static calculateReliabilityRate(trackedMs: number, totalMs: number): number {
    if (totalMs === 0) return 1.0; // 100% reliable if no time logged
    return Math.max(0, Math.min(1, trackedMs / totalMs));
  }

  /**
   * Get the start of the week (Monday) for a given date
   */
  static getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Get the end of the week (Sunday) for a given date
   */
  static getWeekEnd(date: Date): Date {
    const weekStart = ReliabilityCalculator.getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
  }

  /**
   * Calculate comprehensive reliability metrics for a set of sessions
   */
  static calculateMetrics(sessions: Array<{
    id: string;
    start: number;
    activeMs: number;
    originalActiveMs?: number;
    editCount?: number;
  }>): ReliabilityMetrics {
    const totalCurrentMs = sessions.reduce((sum, s) => sum + s.activeMs, 0);
    const totalTrackedMs = sessions.reduce((sum, s) => sum + (s.originalActiveMs || s.activeMs), 0);
    const totalEditedMs = totalCurrentMs - totalTrackedMs;
    
    const editedSessions = sessions.filter(s => (s.editCount || 0) > 0);
    const editedSessionCount = editedSessions.length;
    const sessionCount = sessions.length;
    
    const averageEditSize = editedSessionCount > 0 
      ? Math.abs(totalEditedMs) / editedSessionCount 
      : 0;
    
    const editFrequency = sessionCount > 0 
      ? editedSessionCount / sessionCount 
      : 0;

    const reliabilityRate = ReliabilityCalculator.calculateReliabilityRate(
      totalTrackedMs, 
      totalCurrentMs
    );

    return {
      totalTrackedMs,
      totalEditedMs,
      totalCurrentMs,
      reliabilityRate,
      sessionCount,
      editedSessionCount,
      averageEditSize,
      editFrequency
    };
  }

  /**
   * Calculate weekly reliability data with daily breakdown
   */
  static calculateWeeklyReliability(
    sessions: Array<{
      id: string;
      start: number;
      activeMs: number;
      originalActiveMs?: number;
      editCount?: number;
    }>,
    weekStart: Date
  ): WeeklyReliabilityData {
    const weekEnd = ReliabilityCalculator.getWeekEnd(weekStart);
    
    // Filter sessions for the week
    const weekSessions = sessions.filter(session => {
      const sessionDate = new Date(session.start);
      return sessionDate >= weekStart && sessionDate <= weekEnd;
    });

    // Calculate overall weekly metrics
    const metrics = ReliabilityCalculator.calculateMetrics(weekSessions);

    // Calculate daily breakdown
    const dailyBreakdown: DailyReliabilityData[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const daySessions = weekSessions.filter(session => {
        const sessionDate = new Date(session.start);
        return sessionDate >= dayStart && sessionDate <= dayEnd;
      });

      const dayMetrics = ReliabilityCalculator.calculateMetrics(daySessions);
      
      dailyBreakdown.push({
        date,
        trackedMs: dayMetrics.totalTrackedMs,
        editedMs: dayMetrics.totalEditedMs,
        currentMs: dayMetrics.totalCurrentMs,
        sessionCount: dayMetrics.sessionCount,
        editedSessionCount: dayMetrics.editedSessionCount
      });
    }

    return {
      weekStart,
      weekEnd,
      metrics,
      dailyBreakdown
    };
  }

  /**
   * Categorize reliability rate into performance bands
   */
  static getReliabilityCategory(rate: number): {
    category: 'excellent' | 'good' | 'fair' | 'poor';
    color: string;
    description: string;
  } {
    if (rate >= 0.95) {
      return {
        category: 'excellent',
        color: 'green',
        description: 'Excellent time tracking accuracy'
      };
    } else if (rate >= 0.85) {
      return {
        category: 'good',
        color: 'blue',
        description: 'Good time tracking accuracy'
      };
    } else if (rate >= 0.70) {
      return {
        category: 'fair',
        color: 'yellow',
        description: 'Fair time tracking accuracy'
      };
    } else {
      return {
        category: 'poor',
        color: 'red',
        description: 'Poor time tracking accuracy'
      };
    }
  }

  /**
   * Format time duration in human readable format
   */
  static formatDuration(ms: number): string {
    const hours = Math.floor(Math.abs(ms) / (1000 * 60 * 60));
    const minutes = Math.floor((Math.abs(ms) % (1000 * 60 * 60)) / (1000 * 60));
    
    const sign = ms < 0 ? '-' : '';
    
    if (hours === 0) {
      return `${sign}${minutes}m`;
    } else if (minutes === 0) {
      return `${sign}${hours}h`;
    } else {
      return `${sign}${hours}h ${minutes}m`;
    }
  }

  /**
   * Format reliability rate as percentage
   */
  static formatReliabilityRate(rate: number): string {
    return `${Math.round(rate * 100)}%`;
  }

  /**
   * Calculate the impact of a potential edit on reliability
   */
  static calculateEditImpact(
    currentReliabilityRate: number,
    totalCurrentMs: number,
    totalTrackedMs: number,
    originalSessionMs: number,
    newSessionMs: number
  ): {
    newReliabilityRate: number;
    change: number;
    changePercent: number;
  } {
    // Calculate new totals after the edit
    const newTotalCurrentMs = totalCurrentMs - originalSessionMs + newSessionMs;
    const newTotalTrackedMs = totalTrackedMs; // Tracked time doesn't change
    
    const newReliabilityRate = ReliabilityCalculator.calculateReliabilityRate(
      newTotalTrackedMs,
      newTotalCurrentMs
    );
    
    const change = newReliabilityRate - currentReliabilityRate;
    const changePercent = change * 100;

    return {
      newReliabilityRate,
      change,
      changePercent
    };
  }

  /**
   * Generate reliability trend data for charting
   */
  static generateTrendData(
    weeklyData: WeeklyReliabilityData[],
    weeks: number = 12
  ): Array<{
    week: string;
    reliabilityRate: number;
    totalHours: number;
    editedHours: number;
  }> {
    return weeklyData
      .slice(-weeks)
      .map(week => ({
        week: week.weekStart.toISOString().split('T')[0],
        reliabilityRate: week.metrics.reliabilityRate,
        totalHours: week.metrics.totalCurrentMs / (1000 * 60 * 60),
        editedHours: Math.abs(week.metrics.totalEditedMs) / (1000 * 60 * 60)
      }));
  }
}

export default ReliabilityCalculator;