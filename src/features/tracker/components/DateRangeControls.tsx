import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type Preset = "today" | "week" | "month" | "custom";
export interface DateRange { from?: Date; to?: Date }

interface Props {
  preset: Preset;
  range: DateRange;
  onPresetChange: (p: Preset) => void;
  onRangeChange: (r: DateRange) => void;
}

export const DateRangeControls: React.FC<Props> = ({ preset, range, onPresetChange, onRangeChange }) => {
  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-md border bg-background p-1">
        {(["today", "week", "month", "custom"] as Preset[]).map((p) => (
          <Button
            key={p}
            variant={preset === p ? "secondary" : "ghost"}
            size="sm"
            className={cn("capitalize", preset === p && "shadow-sm")}
            onClick={() => onPresetChange(p)}
          >
            {p}
          </Button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            {range.from && range.to
              ? `${range.from.toLocaleDateString()} → ${range.to.toLocaleDateString()}`
              : "Pick range"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={range as any}
            onSelect={(r: any) => onRangeChange(r ?? {})}
            numberOfMonths={2}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
