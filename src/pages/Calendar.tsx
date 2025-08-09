import React, { useEffect, useState } from "react";
import { useTimer } from "@/features/tracker/TimerContext";
import { DatePicker } from "@/components/ui/date-picker";
import { SessionTimeline } from "@/components/ui/session-timeline";

const CalendarPage: React.FC = () => {
  const { sessions } = useTimer();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    document.title = "Tshifhinga — Calendar View";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Timeline view of time tracking sessions by day.");
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-start justify-center">
      <div className="w-full max-w-4xl mx-auto py-8 px-8">
        {/* Header with date picker */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
            <p className="text-muted-foreground mt-1">View your work sessions by day</p>
          </div>
          <DatePicker
            date={selectedDate}
            onDateChange={(date) => date && setSelectedDate(date)}
            placeholder="Select date"
            className="w-auto"
          />
        </div>

        {/* Timeline */}
        <SessionTimeline 
          sessions={sessions} 
          selectedDate={selectedDate}
          className="bg-background"
        />
      </div>
    </div>
  );
};

export default CalendarPage;
