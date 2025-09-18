// Database service for Electron renderer process
// Uses IPC to communicate with the main process SQLite database

export interface SessionRecord {
  id: string;
  client: string;
  project: string;
  task: string;
  start: number;
  end?: number;
  activeMs: number;
  pausedMs: number;
  notes?: string;
  createdAt: number;
  isBillable?: boolean;
}

class ElectronDatabaseService {
  private isElectron(): boolean {
    return !!(window as any).electronAPI;
  }

  async init(): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    // Database is initialized in main process, nothing to do here
  }

  async getAllSessions(): Promise<SessionRecord[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.getAllSessions();
  }

  async getUserSessions(userId: number): Promise<SessionRecord[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.getUserSessions(userId);
  }

  async insertSession(session: SessionRecord): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.insertSession(session);
  }

  async addSession(session: SessionRecord): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.addSession(session);
  }

  async updateSession(id: string, updates: { 
    client?: string; 
    project?: string; 
    task?: string; 
    notes?: string;
    activeMs?: number;
    pausedMs?: number;
    end?: number;
  }): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.updateSession(id, updates);
  }

  async deleteSession(id: string): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.deleteSession(id);
  }

  async getSessionsByDateRange(startDate: Date, endDate: Date): Promise<SessionRecord[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.getSessionsByDateRange(
      startDate.getTime(), 
      endDate.getTime()
    );
  }

  async getClientSummary(): Promise<Record<string, number>> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.getClientSummary();
  }

  // Migration method to import from localStorage
  async migrateFromLocalStorage(): Promise<void> {
    if (!this.isElectron()) {
      return; // Skip migration if not in Electron
    }

    try {
      const oldData = localStorage.getItem('tt_sessions_v1');
      if (!oldData) return;

      const oldSessions = JSON.parse(oldData);
      if (!Array.isArray(oldSessions)) return;

      await window.electronAPI.database.migrateFromLocalStorage(oldSessions);
      
      console.log(`Migrated ${oldSessions.length} sessions from localStorage to SQLite`);
      
      // Optionally remove old localStorage data after successful migration
      localStorage.removeItem('tt_sessions_v1');
    } catch (error) {
      console.error('Failed to migrate from localStorage:', error);
    }
  }

  // Export methods
  async exportToCSV(): Promise<string> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.exportToCSV();
  }

  async exportToJSON(): Promise<string> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.exportToJSON();
  }

  async getHierarchy(): Promise<any[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.getHierarchy();
  }

  async insertClient(name: string): Promise<number> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.insertClient(name);
  }

  async insertProject(name: string, clientId: number): Promise<number> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.insertProject(name, clientId);
  }

  async insertTask(name: string, projectId: number): Promise<number> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.insertTask(name, projectId);
  }

  async migrateHierarchyFromLocalStorage(data: any[]): Promise<void> {
    if (!this.isElectron()) {
      return; // Skip migration if not in Electron
    }
    return await window.electronAPI.database.migrateHierarchyFromLocalStorage(data);
  }

  async saveFile(content: string, filename: string, filters?: any): Promise<boolean> {
    if (!this.isElectron()) {
      // Fallback for web - create download link
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    }

    const result = await window.electronAPI.showSaveDialog({
      defaultPath: filename,
      filters: filters || [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      const writeResult = await window.electronAPI.writeFile(result.filePath, content);
      return writeResult.success;
    }
    return false;
  }

  // Analytics aggregation methods
  async getUserDailyMetrics(userId?: number, dateFrom?: Date, dateTo?: Date): Promise<any[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.getUserDailyMetrics(userId, dateFrom, dateTo);
  }

  async getClientProfitability(userId?: number): Promise<any[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.getClientProfitability(userId);
  }

  async getTeamPerformance(dateFrom?: Date, dateTo?: Date, team?: string, region?: string): Promise<any[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.getTeamPerformance(dateFrom, dateTo, team, region);
  }

  async getMonthlyTrends(userId?: number, monthsBack: number = 6): Promise<any[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.getMonthlyTrends(userId, monthsBack);
  }

  async populateAnalyticsSummaries(): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.populateAnalyticsSummaries();
  }

  // Session editing methods
  async editSession(sessionId: string, userId: number, updates: {
    startTime?: number;
    endTime?: number;
    client?: string;
    project?: string;
    task?: string;
    notes?: string;
  }, editReason: string): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.editSession(sessionId, userId, updates, editReason);
  }

  async getSessionEditHistory(sessionId: string): Promise<any[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.getSessionEditHistory(sessionId);
  }

  async validateSessionEdit(sessionId: string, updates: {
    startTime?: number;
    endTime?: number;
  }, userId: number): Promise<{ isValid: boolean; errors: string[] }> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.validateSessionEdit(sessionId, updates, userId);
  }

  async getUserReliabilityRate(userId: number, weekStart: Date): Promise<number> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.getUserReliabilityRate(userId, weekStart);
  }

  async getAllUserReliabilityMetrics(): Promise<any[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.getAllUserReliabilityMetrics();
  }

  async updateUserReliabilityMetrics(userId: number): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.updateUserReliabilityMetrics(userId);
  }

  // Enhanced permission methods for Phase 1
  async getUserProjectPermissionDetails(userId: number): Promise<any[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.permissions.getUserProjectDetails(userId);
  }

  async setUserProjectPermission(
    userId: number,
    projectId: number,
    permissionLevel: 'view' | 'track_time' | 'edit' | 'admin',
    grantedBy?: number
  ): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.permissions.setUserProjectPermission(userId, projectId, permissionLevel, grantedBy);
  }

  async hasUserProjectPermission(
    userId: number,
    projectId: number,
    requiredLevel: 'view' | 'track_time' | 'edit' | 'admin' = 'view'
  ): Promise<boolean> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.permissions.hasUserProjectPermission(userId, projectId, requiredLevel);
  }

  async getAllUserProjectPermissions(): Promise<any[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.permissions.getAllUserProjectPermissions();
  }

  async bulkSetUserProjectPermissions(
    assignments: Array<{
      userId: number;
      projectId: number;
      permissionLevel: 'view' | 'track_time' | 'edit' | 'admin';
    }>,
    grantedBy?: number
  ): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.permissions.bulkSetPermissions(assignments, grantedBy);
  }

  async removeUserProjectPermission(userId: number, projectId: number): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.permissions.removeUserProjectPermission(userId, projectId);
  }

  // Permission Template methods
  async createPermissionTemplate(
    name: string,
    description: string,
    templateData: Array<{ projectId: number; permissionLevel: 'view' | 'track_time' | 'edit' | 'admin' }>,
    createdBy?: number
  ): Promise<number> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.templates.createPermissionTemplate(name, description, templateData, createdBy);
  }

  async getAllPermissionTemplates(): Promise<any[]> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.templates.getAllPermissionTemplates();
  }

  async applyPermissionTemplate(templateId: number, userIds: number[], grantedBy?: number): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.templates.applyPermissionTemplate(templateId, userIds, grantedBy);
  }

  async deletePermissionTemplate(id: number): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.templates.deletePermissionTemplate(id);
  }
}

// Export singleton instance
export const electronDB = new ElectronDatabaseService();
export default electronDB;