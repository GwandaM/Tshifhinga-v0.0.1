import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Clock, RefreshCw, Users, Search } from 'lucide-react';
import { electronDB } from '@/lib/electron-database';
import { DateRangeControls, type DateRange, type Preset } from '@/features/tracker/components/DateRangeControls';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: number;
}

interface SessionRecord {
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
  userId?: number;
}

interface UserSession extends SessionRecord {
  username?: string;
}

const formatDuration = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString();
};

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};

export function ActivityMonitoring() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [preset, setPreset] = useState<Preset>('week');
  const [range, setRange] = useState<DateRange>({});

  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
  const startOfWeek = (d = new Date()) => { const x = new Date(d); const day = (x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x; };
  const startOfMonth = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x; };

  const { from, to } = useMemo(() => {
    if (preset === 'today') {
      const n = new Date();
      return { from: startOfDay(n), to: endOfDay(n) };
    }
    if (preset === 'week') {
      const s = startOfWeek(new Date());
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      return { from: s, to: endOfDay(e) };
    }
    if (preset === 'month') {
      const s = startOfMonth(new Date());
      const e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
      return { from: s, to: endOfDay(e) };
    }
    const f = range.from ? startOfDay(range.from) : undefined;
    const t = range.to ? endOfDay(range.to) : range.from ? endOfDay(range.from) : undefined;
    return { from: f, to: t };
  }, [preset, range]);

  // Check if user has admin permissions
  if (!hasPermission('view_all_sessions')) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-gray-600 mt-2">You don't have permission to view this page.</p>
      </div>
    );
  }

  // Load users on component mount
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const userData = await window.electronAPI.auth.getAllUsers();
        setUsers(userData);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadUsers();
  }, []);

  const refreshSessions = useCallback(async () => {
    if (!from || !to) return;
    setIsLoading(true);
    try {
      let sessionData: SessionRecord[] = await electronDB.getSessionsByDateRange(from!, to!);

      if (selectedUserId !== 'all') {
        const targetId = parseInt(selectedUserId, 10);
        sessionData = sessionData.filter(session => session.userId === targetId);
      }

      // Enhance sessions with username
      const enhancedSessions: UserSession[] = sessionData.map(session => {
        const user = users.find(u => u.id === session.userId);
        return {
          ...session,
          username: user?.username || 'Unknown User'
        };
      });

      setSessions(enhancedSessions);
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('Error refreshing sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserId, users, from, to]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Filter sessions based on search query
  const filteredSessions = sessions.filter(session => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      session.client.toLowerCase().includes(searchLower) ||
      session.project.toLowerCase().includes(searchLower) ||
      session.task.toLowerCase().includes(searchLower) ||
      (session.username && session.username.toLowerCase().includes(searchLower)) ||
      (session.notes && session.notes.toLowerCase().includes(searchLower))
    );
  });

  // Calculate statistics
  const totalSessions = filteredSessions.length;
  const totalActiveTime = filteredSessions.reduce((sum, session) => sum + session.activeMs, 0);
  const uniqueUsers = new Set(filteredSessions.map(s => s.userId)).size;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activity Monitoring</h1>
          <p className="text-gray-600 mt-2">Monitor user activity and session tracking</p>
        </div>
        <div className="flex items-center space-x-4">
          {lastRefresh && (
            <span className="text-sm text-gray-500">
              Last updated: {formatTime(lastRefresh)}
            </span>
          )}
          <Button 
            onClick={refreshSessions} 
            disabled={isLoading || !from || !to}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      <DateRangeControls
        preset={preset}
        range={range}
        onPresetChange={setPreset}
        onRangeChange={setRange}
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              Sessions tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(totalActiveTime)}</div>
            <p className="text-xs text-muted-foreground">
              Total active time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">
              Users with sessions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search sessions by client, project, task, user, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Select user" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id.toString()}>
                {user.username} ({user.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Sessions ({filteredSessions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading sessions...</span>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No sessions found</p>
              <Button onClick={refreshSessions} className="mt-4" variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Sessions
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {session.username || 'Unknown User'}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {formatDate(session.createdAt)} at {formatTime(session.start)}
                        </span>
                        {session.isBillable && (
                          <Badge variant="default" className="text-xs">
                            Billable
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        {session.client} → {session.project} → {session.task}
                      </div>
                      {session.notes && (
                        <div className="text-sm text-gray-600 mb-2">
                          {session.notes}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-blue-600">
                        {formatDuration(session.activeMs)}
                      </div>
                      {session.pausedMs > 0 && (
                        <div className="text-xs text-gray-500">
                          {formatDuration(session.pausedMs)} paused
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ActivityMonitoring;
