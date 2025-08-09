import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { SessionRecord } from "@/features/tracker/TimerContext";

interface ClientBreakdownChartProps {
  sessions: SessionRecord[];
  className?: string;
}

interface ChartData {
  name: string;
  value: number;
  hours: string;
  color: string;
}

// Color palette for clients
const COLORS = [
  "#3b82f6", // blue
  "#10b981", // green  
  "#8b5cf6", // purple
  "#f59e0b", // orange
  "#ef4444", // red
  "#06b6d4", // cyan
  "#84cc16", // lime
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

function getClientColor(clientName: string, index: number): string {
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

export const ClientBreakdownChart: React.FC<ClientBreakdownChartProps> = ({
  sessions,
  className
}) => {
  // Calculate client breakdown (billable time only)
  const clientTotals = sessions.reduce((acc, session) => {
    // Only count billable time for client breakdown
    if (session.isBillable !== false) {
      const client = session.task?.client || session.client || 'Unknown Client';
      acc[client] = (acc[client] || 0) + session.activeMs;
    }
    return acc;
  }, {} as Record<string, number>);

  const totalTime = Object.values(clientTotals).reduce((sum, ms) => sum + ms, 0);
  
  const chartData: ChartData[] = Object.entries(clientTotals)
    .sort(([, a], [, b]) => b - a) // Sort by time desc
    .map(([client, ms], index) => ({
      name: client,
      value: totalTime > 0 ? (ms / totalTime) * 100 : 0,
      hours: formatDuration(ms),
      color: getClientColor(client, index)
    }));

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Client Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <p>No data available</p>
            <p className="text-sm">Start tracking time to see client breakdown</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Client Breakdown (Billable Only)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Billable time distribution across {chartData.length} client{chartData.length !== 1 ? 's' : ''}
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