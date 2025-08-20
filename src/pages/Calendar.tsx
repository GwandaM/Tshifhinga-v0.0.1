import React, { useEffect, useState, useMemo } from "react";
import { useTimer } from "@/features/tracker/TimerContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Clock, ChevronDown, ChevronUp, Edit, BarChart3, Grid, Plus } from "lucide-react";
import { SessionTimeline } from "@/components/ui/session-timeline";
import { EditSessionModal } from "@/components/ui/edit-session-modal";
import { SessionHistoryModal } from "@/components/ui/session-history-modal";
import { AddSessionModal } from "@/components/ui/add-session-modal";
import { TimelineView } from "@/components/ui/timeline-view";
import { cn } from "@/lib/utils";
import type { SessionRecord } from "@/features/tracker/TimerContext";

const CalendarPage: React.FC = () => {
  const { sessions, editSession, getSessionEditHistory, validateSessionEdit, addSession } = useTimer();
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  
  // Edit session modal state
  const [editingSession, setEditingSession] = useState<SessionRecord | null>(null);
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);
  
  // Add session modal state
  const [addingSession, setAddingSession] = useState<{
    date: Date;
    prefilledTime?: { start: string; end: string };
  } | null>(null);

  useEffect(() => {
    document.title = "Tshifhinga — Weekly Calendar";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Weekly calendar view of time tracking sessions.");
  }, []);

  // Get start of week (Monday)
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Get week days (Monday to Friday)
  const weekDays = useMemo(() => {
    const weekStart = getWeekStart(currentWeek);
    const days = [];
    for (let i = 0; i < 5; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentWeek]);

  const weekStart = weekDays[0];
  const weekEnd = weekDays[4];

  // Calculate daily data
  const dailyData = useMemo(() => {
    return weekDays.map(date => {
      const daySessions = sessions.filter(session => {
        const sessionDate = new Date(session.start);
        return sessionDate.toDateString() === date.toDateString();
      });
      
      const totalMs = daySessions.reduce((sum, session) => sum + (session.activeMs || 0), 0);
      const totalHours = totalMs / (1000 * 60 * 60);
      
      // Group by client for summary
      const clientGroups = daySessions.reduce((groups, session) => {
        const client = session.client || session.task?.client || 'Unknown Client';
        if (!groups[client]) {
          groups[client] = { count: 0, totalMs: 0 };
        }
        groups[client].count++;
        groups[client].totalMs += session.activeMs || 0;
        return groups;
      }, {} as Record<string, { count: number; totalMs: number }>);
      
      return {
        date,
        sessions: daySessions,
        totalHours,
        sessionCount: daySessions.length,
        clientGroups
      };
    });
  }, [weekDays, sessions]);

  // Calculate weekly totals
  const weeklyTotal = dailyData.reduce((sum, day) => sum + day.totalHours, 0);
  const weeklySessionCount = dailyData.reduce((sum, day) => sum + day.sessionCount, 0);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'prev' ? -7 : 7));
    setCurrentWeek(newWeek);
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(new Date());
  };

  const toggleDayExpanded = (dateString: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateString)) {
        newSet.delete(dateString);
      } else {
        newSet.add(dateString);
      }
      return newSet;
    });
  };

  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const getClientColor = (client: string): string => {
    let hash = 0;
    for (let i = 0; i < client.length; i++) {
      hash = client.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      "bg-blue-50 text-blue-900 border-blue-300",
      "bg-green-50 text-green-900 border-green-300", 
      "bg-purple-50 text-purple-900 border-purple-300",
      "bg-orange-50 text-orange-900 border-orange-300",
      "bg-pink-50 text-pink-900 border-pink-300",
      "bg-indigo-50 text-indigo-900 border-indigo-300",
      "bg-red-50 text-red-900 border-red-300",
      "bg-yellow-50 text-yellow-900 border-yellow-300",
      "bg-teal-50 text-teal-900 border-teal-300",
      "bg-cyan-50 text-cyan-900 border-cyan-300"
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Session editing handlers
  const handleEditSession = (session: SessionRecord) => {
    setEditingSession(session);
  };

  const handleSaveSession = async (updates: any, editReason: string) => {
    if (!editingSession) return;
    
    try {
      await editSession(editingSession.id, updates, editReason);
      setEditingSession(null);
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  const handleViewHistory = (sessionId: string) => {
    setHistorySessionId(sessionId);
  };

  const handleTimeAdjustment = async (sessionId: string, updates: { startTime: Date; endTime: Date }) => {
    try {
      await editSession(sessionId, {
        startTime: updates.startTime,
        endTime: updates.endTime,
      }, 'Timeline drag adjustment');
    } catch (error) {
      console.error('Failed to adjust session time:', error);
      throw error;
    }
  };

  const handleAddSession = (date: Date, prefilledTime?: { start: string; end: string }) => {
    setAddingSession({
      date,
      prefilledTime,
    });
  };

  const handleSaveNewSession = async (sessionData: {
    startTime: Date;
    endTime: Date;
    client: string;
    project: string;
    task: string;
    notes?: string;
  }) => {
    try {
      await addSession(sessionData);
      setAddingSession(null);
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  // Get sessions for selected date (for timeline view)
  const selectedDateSessions = useMemo(() => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    return sessions.filter(session => {
      const sessionDate = new Date(session.start);
      return sessionDate >= dayStart && sessionDate <= dayEnd;
    });
  }, [sessions, selectedDate]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header with Weekly Summary */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Weekly Calendar</h1>
            <p className="text-muted-foreground mt-1">
              Week of {weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })} - {weekEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Weekly Summary */}
            <div className="text-right">
              <div className="text-2xl font-bold">{formatHours(weeklyTotal)}</div>
              <div className="text-sm text-muted-foreground">{weeklySessionCount} sessions</div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('prev')}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToCurrentWeek}
                className="min-w-24"
              >
                This Week
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('next')}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'grid' | 'timeline')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
            <TabsTrigger value="grid" className="flex items-center gap-2">
              <Grid className="w-4 h-4" />
              Weekly Grid
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Daily Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grid">
            {/* Weekly grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {dailyData.map((dayData, index) => {
            const dateString = dayData.date.toISOString();
            const isExpanded = expandedDays.has(dateString);
            const isToday = dayData.date.toDateString() === new Date().toDateString();
            
            return (
              <Card key={index} className={cn(
                "flex flex-col transition-all duration-200",
                isToday && "ring-2 ring-primary/20"
              )}>
                {/* Day Header */}
                <CardHeader className="pb-2 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-center space-y-0.5 flex-1">
                      <div className={cn(
                        "text-xs font-semibold",
                        isToday && "text-primary"
                      )}>
                        {dayData.date.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div className={cn(
                        "text-xs text-muted-foreground",
                        isToday && "text-primary/70"
                      )}>
                        {dayData.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </CardTitle>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 opacity-60 hover:opacity-100"
                        onClick={() => handleAddSession(dayData.date)}
                        title="Add session"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </Button>
                      {dayData.sessionCount === 1 && dayData.sessions[0].end && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 opacity-60 hover:opacity-100"
                          onClick={() => handleEditSession(dayData.sessions[0])}
                          title="Edit session"
                        >
                          <Edit className="w-2.5 h-2.5" />
                        </Button>
                      )}
                      {dayData.sessionCount > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 opacity-60 hover:opacity-100"
                          onClick={() => {
                            setSelectedDate(dayData.date);
                            setViewMode('timeline');
                          }}
                          title="View in timeline"
                        >
                          <BarChart3 className="w-2.5 h-2.5" />
                        </Button>
                      )}
                      {dayData.sessionCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => toggleDayExpanded(dateString)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-2.5 h-2.5" />
                          ) : (
                            <ChevronDown className="w-2.5 h-2.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Daily Metrics */}
                  <div className="text-center pt-1">
                    <div className="text-sm font-bold">
                      {dayData.totalHours > 0 ? formatHours(dayData.totalHours) : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dayData.sessionCount === 0 ? "No sessions" : 
                       dayData.sessionCount === 1 ? "1 session" : 
                       `${dayData.sessionCount} sessions`}
                    </div>
                  </div>
                  
                  {/* Workload indicator */}
                  {dayData.totalHours > 0 && (
                    <div className="w-full bg-muted rounded-full h-1 mt-1.5">
                      <div 
                        className={cn(
                          "h-1 rounded-full transition-all",
                          dayData.totalHours >= 8 ? "bg-green-500" :
                          dayData.totalHours >= 6 ? "bg-yellow-500" :
                          dayData.totalHours >= 4 ? "bg-orange-500" : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(100, (dayData.totalHours / 8) * 100)}%` }}
                      />
                    </div>
                  )}
                </CardHeader>
                
                <CardContent className="flex-1 space-y-1 px-3 pb-3">
                  {dayData.sessionCount === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Clock className="w-4 h-4 text-muted-foreground/30 mb-1" />
                      <p className="text-xs text-muted-foreground">No sessions</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {/* Client Summary Pills */}
                      <div className="space-y-0.5">
                        {Object.entries(dayData.clientGroups).map(([client, data]) => (
                          <div 
                            key={client} 
                            className="flex items-center justify-between text-xs hover:bg-muted/50 rounded px-1 py-0.5 cursor-pointer transition-colors"
                            onClick={() => {
                              if (!isExpanded) {
                                toggleDayExpanded(dateString);
                              }
                            }}
                            title={`${data.count} session${data.count > 1 ? 's' : ''} • Click to ${isExpanded ? 'view' : 'expand'} details`}
                          >
                            <Badge variant="outline" className={cn("text-xs truncate max-w-20 px-1 py-0", getClientColor(client))}>
                              {client}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">
                                {formatHours(data.totalMs / (1000 * 60 * 60))}
                              </span>
                              <span className="text-xs text-muted-foreground/70">
                                ({data.count})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Expanded Session List */}
                      {isExpanded && (
                        <div className="mt-2 border-t pt-2 space-y-1">
                          {dayData.sessions
                            .sort((a, b) => a.start - b.start)
                            .map((session) => {
                              const startTime = new Date(session.start).toLocaleTimeString("en-US", { 
                                hour: "numeric", 
                                minute: "2-digit", 
                                hour12: false 
                              });
                              const endTime = session.end 
                                ? new Date(session.end).toLocaleTimeString("en-US", { 
                                    hour: "numeric", 
                                    minute: "2-digit", 
                                    hour12: false 
                                  })
                                : "ongoing";
                              const duration = formatHours(session.activeMs / (1000 * 60 * 60));
                              const client = session.client || session.task?.client || 'Unknown';
                              const project = session.project || session.task?.project || 'Unknown Project';
                              const taskName = session.task?.task || 'Unknown Task';
                              
                              const clientColorClasses = getClientColor(client);
                              
                              return (
                                <div key={session.id} className={cn(
                                  "text-xs space-y-0.5 p-2 rounded-md border group hover:shadow-sm transition-all cursor-pointer",
                                  clientColorClasses
                                )}>
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono opacity-70">
                                      {startTime}-{endTime}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium">{duration}</span>
                                      {session.end && ( // Only show edit for completed sessions
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditSession(session);
                                          }}
                                        >
                                          <Edit className="w-2.5 h-2.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <div 
                                    className="truncate font-medium cursor-pointer"
                                    onClick={() => session.end && handleEditSession(session)}
                                  >
                                    {project}
                                  </div>
                                  <div 
                                    className="truncate opacity-80 cursor-pointer"
                                    onClick={() => session.end && handleEditSession(session)}
                                  >
                                    {taskName}
                                  </div>
                                  {session.notes && (
                                    <div 
                                      className="truncate opacity-70 italic cursor-pointer"
                                      onClick={() => session.end && handleEditSession(session)}
                                    >
                                      {session.notes}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            {/* Date Selector for Timeline */}
            <div className="mb-6">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold">Select Date:</h3>
                <div className="flex items-center gap-2">
                  {weekDays.map((day) => (
                    <Button
                      key={day.toISOString()}
                      variant={selectedDate.toDateString() === day.toDateString() ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDate(day)}
                    >
                      {day.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline View */}
            <TimelineView
              date={selectedDate}
              sessions={selectedDateSessions}
              onSessionEdit={handleEditSession}
              onTimeAdjustment={handleTimeAdjustment}
              onAddSession={handleAddSession}
            />
          </TabsContent>
        </Tabs>

        {/* Edit Session Modal */}
        <EditSessionModal
          session={editingSession}
          open={!!editingSession}
          onClose={() => setEditingSession(null)}
          onSave={handleSaveSession}
          onViewHistory={handleViewHistory}
        />

        {/* Session History Modal */}
        <SessionHistoryModal
          sessionId={historySessionId}
          open={!!historySessionId}
          onClose={() => setHistorySessionId(null)}
          getSessionEditHistory={getSessionEditHistory}
        />

        {/* Add Session Modal */}
        <AddSessionModal
          open={!!addingSession}
          onClose={() => setAddingSession(null)}
          onSave={handleSaveNewSession}
          prefilledDate={addingSession?.date}
          prefilledTime={addingSession?.prefilledTime}
        />
      </div>
    </div>
  );
};

export default CalendarPage;
