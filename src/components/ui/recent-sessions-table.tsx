import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Clock, User, Briefcase, CheckSquare, Calendar, DollarSign } from "lucide-react";
import type { SessionRecord } from "@/features/tracker/TimerContext";

interface RecentSessionsTableProps {
  sessions: SessionRecord[];
  title?: string;
  maxSessions?: number;
  showDate?: boolean;
  className?: string;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  }
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

export const RecentSessionsTable: React.FC<RecentSessionsTableProps> = ({
  sessions,
  title = "Recent Sessions",
  maxSessions = 10,
  showDate = true,
  className
}) => {
  const sortedSessions = [...sessions]
    .sort((a, b) => b.start - a.start)
    .slice(0, maxSessions);

  if (sortedSessions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No sessions found</p>
            <p className="text-sm">Start tracking time to see recent sessions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {sortedSessions.length} of {sessions.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {showDate && (
                  <TableHead className="w-20">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Date
                    </div>
                  </TableHead>
                )}
                <TableHead className="w-16">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Time
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Client
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    Project
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <CheckSquare className="w-3 h-3" />
                    Task
                  </div>
                </TableHead>
                <TableHead className="w-16">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Bill
                  </div>
                </TableHead>
                <TableHead className="w-20 text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSessions.map((session) => {
                const client = session.task?.client || session.client || 'Unknown Client';
                const project = session.task?.project || session.project || 'Unknown Project';
                const task = session.task?.task || session.task || 'Unknown Task';
                const clientColor = getClientColor(client);
                
                return (
                  <TableRow key={session.id} className="hover:bg-muted/50">
                    {showDate && (
                      <TableCell className="font-medium text-xs">
                        {formatDate(session.start)}
                      </TableCell>
                    )}
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTime(session.start)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", clientColor)}>
                        {client}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {project}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {task}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={session.isBillable !== false ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {session.isBillable !== false ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatDuration(session.activeMs)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        {sessions.length > maxSessions && (
          <div className="px-6 py-3 border-t">
            <Button variant="ghost" size="sm" className="w-full">
              View all {sessions.length} sessions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};