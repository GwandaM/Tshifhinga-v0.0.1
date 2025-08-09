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

  async insertSession(session: SessionRecord): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('Not running in Electron environment');
    }
    return await window.electronAPI.database.insertSession(session);
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
}

// Export singleton instance
export const electronDB = new ElectronDatabaseService();
export default electronDB;