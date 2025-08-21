import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTimer } from "@/features/tracker/TimerContext";
import type { SessionRecord, TaskRef } from "@/features/tracker/TimerContext";
import { HierarchySelector } from "@/features/tracker/components/HierarchySelector";
import { TimerDisplay } from "@/features/tracker/components/TimerDisplay";
import { IdleDialog } from "@/features/tracker/components/IdleDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateRangeControls, type DateRange, type Preset } from "@/features/tracker/components/DateRangeControls";

function useSEO() {
  useEffect(() => {
    document.title = "Task Time Tracker — Session-based Time Tracking";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Track time by client, project, and task with smart idle detection and session-based timers.");
  }, []);
}

function TodayPanel({ sessions, totalMs }: { sessions: SessionRecord[]; totalMs: number }) {
  const { updateSession } = useTimer();
  const [editing, setEditing] = useState<SessionRecord | null>(null);
  const toHMS = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const [form, setForm] = useState<{ client: string; project: string; task: string; notes: string }>({
    client: "",
    project: "",
    task: "",
    notes: "",
  });

  const openEdit = (s: SessionRecord) => {
    setEditing(s);
    setForm({ client: s.task.client, project: s.task.project, task: s.task.task, notes: s.notes ?? "" });
  };

  const onSave = () => {
    if (!editing) return;
    const nextTask: TaskRef = { client: form.client.trim(), project: form.project.trim(), task: form.task.trim() };
    updateSession(editing.id, { task: nextTask, notes: form.notes });
    setEditing(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selected Range</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">Total active: {toHMS(totalMs)}</div>
        <ul className="mt-3 space-y-2">
          {sessions.length === 0 && (
            <li className="text-sm text-muted-foreground">No sessions in this range.</li>
          )}
          {sessions.map((s) => (
            <li key={s.id} className="text-sm flex items-center justify-between gap-3">
              <div>
                <span className="text-muted-foreground">[{new Date(s.start).toLocaleTimeString()}] </span>
                {s.task.client} / {s.task.project} / {s.task.task} — {toHMS(s.activeMs)}
              </div>
              <Button size="sm" variant="outline" onClick={() => openEdit(s)} aria-label="Edit session">
                Edit
              </Button>
            </li>
          ))}
        </ul>

        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Session</DialogTitle>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="client">Client</Label>
                  <Input id="client" value={form.client} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="project">Project</Label>
                  <Input id="project" value={form.project} onChange={(e) => setForm((f) => ({ ...f, project: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="task">Task</Label>
                  <Input id="task" value={form.task} onChange={(e) => setForm((f) => ({ ...f, task: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Add session notes" />
              </div>
              <div className="text-xs text-muted-foreground">Time is locked (read-only): {toHMS(editing?.activeMs ?? 0)}</div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={onSave}>Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function Content() {
  useSEO();
  const { task, setTask, notes, setNotes, idleDialog, handleIdleChoice, sessions } = useTimer();

  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
  const startOfWeek = (d = new Date()) => { const x = new Date(d); const day = (x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x; };
  const startOfMonth = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x; };

  const [preset, setPreset] = useState<Preset>("today");
  const [range, setRange] = useState<DateRange>({});

  const { from, to } = useMemo(() => {
    if (preset === "today") {
      const n = new Date(); return { from: startOfDay(n), to: endOfDay(n) };
    }
    if (preset === "week") {
      const s = startOfWeek(new Date()); const e = new Date(s); e.setDate(s.getDate()+6); return { from: s, to: endOfDay(e) };
    }
    if (preset === "month") {
      const s = startOfMonth(new Date()); const e = new Date(s.getFullYear(), s.getMonth()+1, 0); return { from: s, to: endOfDay(e) };
    }
    const f = range.from ? startOfDay(range.from) : undefined;
    const t = range.to ? endOfDay(range.to) : range.from ? endOfDay(range.from) : undefined;
    return { from: f, to: t };
  }, [preset, range]);

  const filtered = useMemo(() => {
    if (!from || !to) return [] as SessionRecord[];
    const fromMs = from.getTime(); const toMs = to.getTime();
    return sessions.filter((s) => s.start >= fromMs && s.start <= toMs);
  }, [sessions, from, to]);

  const totalMs = useMemo(() => filtered.reduce((sum, s) => sum + s.activeMs, 0), [filtered]);

  return (
    <>
      <main className="w-full min-h-screen flex items-center justify-center">
        <section className="w-full max-w-3xl flex flex-col items-center text-center gap-6 py-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Session-based Time Tracking</h1>

          <TimerDisplay className="w-full" />

          <Card className="w-full">
            <CardHeader>
              <CardTitle>Choose work</CardTitle>
            </CardHeader>
            <CardContent>
              <HierarchySelector value={task} onChange={setTask} />
              <div className="mt-4 space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What are you working on?" />
              </div>
            </CardContent>
          </Card>

          <div className="w-full">
            <DateRangeControls preset={preset} range={range} onPresetChange={setPreset} onRangeChange={(r) => { setPreset("custom"); setRange(r); }} />
          </div>

          <div className="w-full">
            <TodayPanel sessions={filtered} totalMs={totalMs} />
          </div>
        </section>

        <IdleDialog open={idleDialog.open} idleMs={idleDialog.idleMs} onClose={handleIdleChoice} />
        
        {/* Test button for idle dialog - development only */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 right-4">
            <button 
              onClick={() => {
                console.log('[Debug] Testing idle dialog manually');
                (window as any).debugTestIdleDialog?.();
              }}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs"
            >
              Test Idle Dialog
            </button>
          </div>
        )}
        
      </main>
    </>
  );
}

const Index = () => (
  <div className="w-full bg-background">
    <Content />
  </div>
);

export default Index;
