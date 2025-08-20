// Session validation utility functions

export interface SessionUpdateData {
  startTime?: Date;
  endTime?: Date;
  client?: string;
  project?: string;
  task?: string;
  notes?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class SessionValidator {
  static validateTimeRange(startTime: Date, endTime?: Date): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (endTime && startTime >= endTime) {
      errors.push('Start time must be before end time');
    }

    if (endTime && endTime > new Date()) {
      errors.push('End time cannot be in the future');
    }

    if (startTime > new Date()) {
      errors.push('Start time cannot be in the future');
    }

    const duration = endTime ? endTime.getTime() - startTime.getTime() : 0;
    
    if (duration > 24 * 60 * 60 * 1000) {
      errors.push('Session duration cannot exceed 24 hours');
    }

    if (duration < 60 * 1000 && duration > 0) {
      errors.push('Session duration must be at least 1 minute');
    }

    if (duration > 12 * 60 * 60 * 1000) {
      warnings.push('Session duration exceeds 12 hours - please verify this is correct');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateSessionDetails(updates: SessionUpdateData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (updates.client !== undefined && !updates.client.trim()) {
      errors.push('Client name cannot be empty');
    }

    if (updates.project !== undefined && !updates.project.trim()) {
      errors.push('Project name cannot be empty');
    }

    if (updates.task !== undefined && !updates.task.trim()) {
      errors.push('Task name cannot be empty');
    }

    if (updates.notes !== undefined && updates.notes.length > 1000) {
      warnings.push('Notes are quite long - consider summarizing');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateDailyLimits(
    newSessionStart: Date,
    newSessionEnd: Date | undefined,
    existingSessions: Array<{ start: number; end?: number; activeMs: number }>,
    excludeSessionId?: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Get sessions for the same day
    const sessionDate = new Date(newSessionStart);
    sessionDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(sessionDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const sameDaySessions = existingSessions.filter(session => {
      const sessionStart = new Date(session.start);
      return sessionStart >= sessionDate && sessionStart < nextDay;
    });

    // Calculate total time for the day including the new session
    const newSessionDuration = newSessionEnd 
      ? newSessionEnd.getTime() - newSessionStart.getTime()
      : 0;
    
    const totalDayMs = sameDaySessions.reduce((total, session) => {
      return total + session.activeMs;
    }, 0) + newSessionDuration;

    const totalDayHours = totalDayMs / (1000 * 60 * 60);

    if (totalDayHours > 16) {
      errors.push('Total daily time would exceed 16 hours');
    } else if (totalDayHours > 12) {
      warnings.push('Total daily time would exceed 12 hours');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) {
      return `${minutes}m`;
    } else if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  }

  static calculateReliabilityImpact(
    originalMs: number,
    newMs: number,
    weeklyTrackedMs: number,
    weeklyTotalMs: number
  ): { newReliabilityRate: number; change: number } {
    const adjustedTrackedMs = weeklyTrackedMs - originalMs;
    const adjustedTotalMs = weeklyTotalMs - originalMs + newMs;
    
    const newReliabilityRate = adjustedTotalMs > 0 
      ? adjustedTrackedMs / adjustedTotalMs 
      : 1.0;
    
    const currentRate = weeklyTotalMs > 0 
      ? weeklyTrackedMs / weeklyTotalMs 
      : 1.0;
    
    return {
      newReliabilityRate,
      change: newReliabilityRate - currentRate
    };
  }
}

export default SessionValidator;