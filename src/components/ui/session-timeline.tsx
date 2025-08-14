import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, User, Briefcase, CheckSquare } from "lucide-react";
import type { SessionRecord } from "@/features/tracker/TimerContext";

interface SessionTimelineProps {
  sessions: SessionRecord[];
  selectedDate: Date;
  className?: string;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getClientColor(client: string): string {
  // Simple hash-based color assignment
  let hash = 0;
  for (let i = 0; i < client.length; i++) {
    hash = client.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    "bg-blue-100 text-blue-800 border-blue-200",
    "bg-green-100 text-green-800 border-green-200", 
    "bg-purple-100 text-purple-800 border-purple-200",
    "bg-orange-100 text-orange-800 border-orange-200",
    "bg-pink-100 text-pink-800 border-pink-200",
    "bg-indigo-100 text-indigo-800 border-indigo-200"
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

const SessionTimelineItem: React.FC<{ session: SessionRecord; isFirst: boolean; isLast: boolean }> = ({ 
  session, 
  isFirst, 
  isLast 
}) => {
  const startTime = formatTime(session.start);
  const endTime = session.end ? formatTime(session.end) : "ongoing";
  const duration = formatDuration(session.activeMs);
  
  // Safely extract task information
  const client = session.task?.client || session.client || 'Unknown Client';
  const project = session.task?.project || session.project || 'Unknown Project';
  const task = session.task?.task || 'Unknown Task';
  const clientColor = getClientColor(client);

  return (
    <div className="relative">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-border" />
      )}
      
      {/* Timeline dot */}
      <div className="absolute left-3 top-4 w-2 h-2 bg-primary rounded-full border-2 border-background shadow-sm" />
      
      {/* Session card */}
      <div className="ml-8 pb-6">
        <Card className="hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-xs", clientColor)}>
                  <User className="w-3 h-3 mr-1" />
                  {client}
                </Badge>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm font-medium">{duration}</span>
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <Clock className="w-3 h-3 mr-1" />
                {startTime} - {endTime}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium text-sm">{project}</span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm">{task}</span>
              </div>
              
              {session.notes && (
                <div className="mt-3 p-2 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">{session.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  sessions,
  selectedDate,
  className
}) => {
  // Filter sessions for selected date
  const dateStart = new Date(selectedDate);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(selectedDate);
  dateEnd.setHours(23, 59, 59, 999);
  
  const filteredSessions = sessions
    .filter(session => {
      const sessionDate = new Date(session.start);
      return sessionDate >= dateStart && sessionDate <= dateEnd;
    })
    .sort((a, b) => a.start - b.start);

  const totalDuration = filteredSessions.reduce((sum, session) => sum + session.activeMs, 0);

  if (filteredSessions.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        <Clock className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">No sessions found</h3>
        <p className="text-sm text-muted-foreground mt-1">
          No work sessions recorded for {selectedDate.toLocaleDateString()}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with total time */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <div>
          <h2 className="text-xl font-semibold">
            Sessions on {selectedDate.toLocaleDateString("en-US", { 
              weekday: "long", 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            })}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{formatDuration(totalDuration)}</div>
          <p className="text-sm text-muted-foreground">Total time</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {filteredSessions.map((session, index) => (
          <SessionTimelineItem
            key={session.id}
            session={session}
            isFirst={index === 0}
            isLast={index === filteredSessions.length - 1}
          />
        ))}
      </div>
    </div>
  );
};