import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { SessionRecord } from "@/features/tracker/TimerContext";

interface ProjectBreakdownChartProps {
  sessions: SessionRecord[];
  selectedClient: string | null;
  className?: string;
}

interface ChartData {
  name: string;
  value: number;
  hours: string;
  color: string;
}

// Color palette for projects
const COLORS = [
  "#8b5cf6", // purple
  "#f59e0b", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#ef4444", // red
  "#3b82f6", // blue
  "#10b981", // green
  "#f97316", // orange-500
];

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getProjectColor(projectName: string, index: number): string {
  return COLORS[index % COLORS.length];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg p-3 shadow-md">
        <p className="font-medium">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          {data.hours} ({data.value.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

export const ProjectBreakdownChart: React.FC<ProjectBreakdownChartProps> = ({
  sessions,
  selectedClient,
  className
}) => {
  // Filter sessions for the selected client and calculate project breakdown
  const clientSessions = selectedClient 
    ? sessions.filter(session => {
        const client = session.task?.client || session.client || 'Unknown Client';
        return client === selectedClient && session.isBillable !== false;
      })
    : [];

  const projectTotals = clientSessions.reduce((acc, session) => {
    const project = session.task?.project || session.project || 'Unknown Project';
    acc[project] = (acc[project] || 0) + session.activeMs;
    return acc;
  }, {} as Record<string, number>);

  const totalTime = Object.values(projectTotals).reduce((sum, ms) => sum + ms, 0);
  
  const chartData: ChartData[] = Object.entries(projectTotals)
    .sort(([, a], [, b]) => b - a) // Sort by time desc
    .map(([project, ms], index) => ({
      name: project,
      value: totalTime > 0 ? (ms / totalTime) * 100 : 0,
      hours: formatDuration(ms),
      color: getProjectColor(project, index)
    }));

  if (!selectedClient) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Project Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <p>Select a client from the chart</p>
            <p className="text-sm">to see project breakdown</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Project Breakdown - {selectedClient}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <p>No billable projects found</p>
            <p className="text-sm">for {selectedClient}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Project Breakdown - {selectedClient}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Billable time across {chartData.length} project{chartData.length !== 1 ? 's' : ''}
        </p>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: '280px' }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                formatter={(value, entry: any) => (
                  <span className="text-sm">
                    {value} ({entry.payload.hours})
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};