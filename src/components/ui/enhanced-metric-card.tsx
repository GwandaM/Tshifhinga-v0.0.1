import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface MetricStatus {
  type: 'success' | 'warning' | 'critical' | 'neutral';
  message?: string;
}

interface MetricTrend {
  value: number;
  label: string;
  isPositive: boolean;
}

interface MetricTarget {
  current: number;
  target: number;
  unit?: string;
}

interface EnhancedMetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  description?: string;
  icon?: LucideIcon;
  trend?: MetricTrend;
  status?: MetricStatus;
  target?: MetricTarget;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export const EnhancedMetricCard: React.FC<EnhancedMetricCardProps> = ({
  title,
  value,
  subtitle,
  description,
  icon: Icon,
  trend,
  status,
  target,
  size = 'md',
  className,
  onClick
}) => {
  const getStatusColor = (type: MetricStatus['type']) => {
    switch (type) {
      case 'success': return 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20';
      case 'warning': return 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20';
      case 'critical': return 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20';
      default: return '';
    }
  };

  const getStatusIconColor = (type: MetricStatus['type']) => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-amber-600';
      case 'critical': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const valueSizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <Card 
      className={cn(
        "hover:shadow-lg transition-all duration-200 cursor-pointer",
        status && getStatusColor(status.type),
        className
      )}
      onClick={onClick}
    >
      <CardContent className={sizeClasses[size]}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {Icon && (
                <Icon className={cn(
                  "h-4 w-4",
                  status ? getStatusIconColor(status.type) : "text-muted-foreground"
                )} />
              )}
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
            </div>
            
            {trend && (
              <div className="flex items-center gap-1">
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  trend.isPositive ? "text-green-600" : "text-red-600"
                )}>
                  {trend.isPositive ? "+" : ""}{trend.value}%
                </span>
              </div>
            )}
          </div>

          {/* Main Value */}
          <div className="space-y-1">
            <p className={cn(
              "font-bold tracking-tight",
              valueSizeClasses[size]
            )}>
              {value}
            </p>
            {subtitle && (
              <p className="text-sm text-muted-foreground font-medium">{subtitle}</p>
            )}
          </div>

          {/* Progress/Target */}
          {target && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {target.current.toFixed(1)}{target.unit} / {target.target}{target.unit}
                </span>
              </div>
              <Progress 
                value={(target.current / target.target) * 100} 
                className="h-2"
              />
            </div>
          )}

          {/* Status Message */}
          {status?.message && (
            <div className="flex items-center gap-2">
              {status.type === 'warning' && <AlertTriangle className="h-3 w-3 text-amber-600" />}
              <span className={cn(
                "text-xs",
                getStatusIconColor(status.type)
              )}>
                {status.message}
              </span>
            </div>
          )}

          {/* Description */}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}

          {/* Trend Label */}
          {trend?.label && (
            <p className="text-xs text-muted-foreground">{trend.label}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};