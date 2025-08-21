import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine
} from "recharts";
import { Calendar, TrendingUp, Users, DollarSign } from "lucide-react";

interface TrendData {
  date: string;
  hours: number;
  billableHours: number;
  sessions: number;
  revenue: number;
  productivity: number;
}

interface ClientData {
  name: string;
  hours: number;
  revenue: number;
  percentage: number;
  color: string;
}

interface InteractiveChartsProps {
  trendData: TrendData[];
  clientData: ClientData[];
  targets?: {
    dailyHours?: number;
    weeklyRevenue?: number;
    productivity?: number;
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
            {entry.dataKey === 'revenue' && ' ZAR'}
            {entry.dataKey.includes('Hours') && 'h'}
            {entry.dataKey === 'productivity' && '%'}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const ProductivityTrendChart: React.FC<{
  data: TrendData[];
  targets?: InteractiveChartsProps['targets'];
}> = ({ data, targets }) => {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['hours', 'productivity']);
  
  const metrics = [
    { key: 'hours', name: 'Total Hours', color: '#3b82f6' },
    { key: 'billableHours', name: 'Billable Hours', color: '#10b981' },
    { key: 'revenue', name: 'Revenue (ZAR)', color: '#f59e0b' },
    { key: 'productivity', name: 'Productivity %', color: '#8b5cf6' },
  ];

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance Trends
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {metrics.map(metric => (
            <Button
              key={metric.key}
              variant={selectedMetrics.includes(metric.key) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleMetric(metric.key)}
              className="text-xs"
            >
              <div 
                className="w-2 h-2 rounded-full mr-2" 
                style={{ backgroundColor: metric.color }}
              />
              {metric.name}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: '300px' }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Target Lines */}
              {targets?.dailyHours && selectedMetrics.includes('hours') && (
                <ReferenceLine 
                  y={targets.dailyHours} 
                  stroke="#10b981" 
                  strokeDasharray="5 5" 
                  label="Daily Target" 
                />
              )}
              
              {selectedMetrics.map(metric => {
                const metricConfig = metrics.find(m => m.key === metric);
                return metricConfig ? (
                  <Line
                    key={metric}
                    type="monotone"
                    dataKey={metric}
                    stroke={metricConfig.color}
                    strokeWidth={2}
                    name={metricConfig.name}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ) : null;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export const ClientDistributionChart: React.FC<{
  data: ClientData[];
  title?: string;
  subtitle?: string;
}> = ({ data, title = "Client Distribution", subtitle = "Revenue and time breakdown by client" }) => {
  const [viewType, setViewType] = useState<'pie' | 'bar'>('pie');
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {title}
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewType === 'pie' ? "default" : "outline"}
              size="sm"
              onClick={() => setViewType('pie')}
            >
              Pie
            </Button>
            <Button
              variant={viewType === 'bar' ? "default" : "outline"}
              size="sm"
              onClick={() => setViewType('bar')}
            >
              Bar
            </Button>
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: '300px' }}>
          <ResponsiveContainer>
            {viewType === 'pie' ? (
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="hours"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="hours" fill="#3b82f6" name="Hours" />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        
        {/* Client Stats */}
        <div className="mt-4 space-y-2">
          {data.map((client, index) => (
            <div key={client.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm font-medium">{client.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="secondary">{client.hours.toFixed(1)}h</Badge>
                <Badge variant="outline">R{client.revenue.toFixed(0)}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const UtilizationHeatmap: React.FC<{
  data: Array<{
    date: string;
    day: string;
    hours: number;
    target: number;
  }>;
}> = ({ data }) => {
  const getIntensityColor = (hours: number, target: number) => {
    const ratio = hours / target;
    if (ratio >= 1) return 'bg-green-500';
    if (ratio >= 0.8) return 'bg-green-400';
    if (ratio >= 0.6) return 'bg-yellow-400';
    if (ratio >= 0.4) return 'bg-orange-400';
    if (ratio > 0) return 'bg-red-400';
    return 'bg-gray-200 dark:bg-gray-700';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Weekly Utilization Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {data.map((day, index) => (
            <div key={index} className="text-center">
              <div className="text-xs font-medium mb-1">{day.day}</div>
              <div 
                className={`
                  h-12 w-full rounded-md flex items-center justify-center text-white text-xs font-bold
                  ${getIntensityColor(day.hours, day.target)}
                `}
                title={`${day.date}: ${day.hours.toFixed(1)}h / ${day.target}h`}
              >
                {day.hours.toFixed(1)}h
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Less productive</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="w-3 h-3 bg-red-400 rounded"></div>
            <div className="w-3 h-3 bg-orange-400 rounded"></div>
            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
            <div className="w-3 h-3 bg-green-400 rounded"></div>
            <div className="w-3 h-3 bg-green-500 rounded"></div>
          </div>
          <span>More productive</span>
        </div>
      </CardContent>
    </Card>
  );
};