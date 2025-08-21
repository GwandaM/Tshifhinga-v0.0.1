import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  DollarSign,
  Target,
  Zap,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Insight {
  id: string;
  type: 'recommendation' | 'alert' | 'achievement' | 'prediction';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

interface Prediction {
  metric: string;
  current: number;
  predicted: number;
  confidence: number;
  timeframe: string;
  unit: string;
}

interface InsightsPanelProps {
  insights: Insight[];
  predictions?: Prediction[];
  className?: string;
}

const InsightIcon = ({ type }: { type: Insight['type'] }) => {
  switch (type) {
    case 'recommendation':
      return <Lightbulb className="h-4 w-4 text-blue-600" />;
    case 'alert':
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case 'achievement':
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'prediction':
      return <Zap className="h-4 w-4 text-purple-600" />;
    default:
      return <Lightbulb className="h-4 w-4 text-muted-foreground" />;
  }
};

const getPriorityColor = (priority: Insight['priority']) => {
  switch (priority) {
    case 'high': return 'border-red-200 bg-red-50 dark:bg-red-950/20';
    case 'medium': return 'border-amber-200 bg-amber-50 dark:bg-amber-950/20';
    case 'low': return 'border-blue-200 bg-blue-50 dark:bg-blue-950/20';
  }
};

export const InsightsPanel: React.FC<InsightsPanelProps> = ({
  insights,
  predictions = [],
  className
}) => {
  // Sort insights by priority
  const sortedInsights = [...insights].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-blue-600" />
          Smart Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* High Priority Alerts */}
        {sortedInsights.filter(i => i.priority === 'high').map((insight) => (
          <Alert key={insight.id} className={getPriorityColor(insight.priority)}>
            <InsightIcon type={insight.type} />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium">{insight.title}</div>
                <div className="text-sm">{insight.message}</div>
                {insight.action && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={insight.action.onClick}
                    className="gap-2"
                  >
                    {insight.action.label}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        ))}

        {/* Predictions */}
        {predictions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Forecasts</h4>
            {predictions.map((prediction, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="font-medium text-sm">{prediction.metric}</div>
                  <div className="text-xs text-muted-foreground">
                    {prediction.timeframe} • {prediction.confidence}% confidence
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">
                    {prediction.predicted.toFixed(1)}{prediction.unit}
                  </div>
                  <div className={cn(
                    "text-xs",
                    prediction.predicted > prediction.current ? "text-green-600" : "text-red-600"
                  )}>
                    {prediction.predicted > prediction.current ? "+" : ""}
                    {((prediction.predicted - prediction.current) / prediction.current * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Other Insights */}
        <div className="space-y-2">
          {sortedInsights.filter(i => i.priority !== 'high').map((insight) => (
            <div 
              key={insight.id}
              className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <InsightIcon type={insight.type} />
              <div className="flex-1 space-y-1">
                <div className="text-sm font-medium">{insight.title}</div>
                <div className="text-xs text-muted-foreground">{insight.message}</div>
              </div>
              <Badge variant={insight.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                {insight.priority}
              </Badge>
            </div>
          ))}
        </div>

        {insights.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No insights available yet</p>
            <p className="text-xs">Track more time to get personalized recommendations</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};