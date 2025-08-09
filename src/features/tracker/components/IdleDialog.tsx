import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HierarchySelector } from "./HierarchySelector";
import type { TaskRef } from "../TimerContext";

function minutes(ms: number) {
  return Math.round(ms / 60000);
}

export const IdleDialog: React.FC<{
  open: boolean;
  idleMs: number;
  onClose: (choice: "continue" | "break" | "switch" | "meeting" | "admin", nextTask?: TaskRef) => void;
}> = ({ open, idleMs, onClose }) => {
  const [nextTask, setNextTask] = useState<TaskRef | undefined>(undefined);

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Idle time detected</DialogTitle>
          <DialogDescription>
            No activity for {minutes(idleMs)} minutes. How should we handle this time?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => onClose("continue")}>Continue current task</Button>
            <Button variant="secondary" onClick={() => onClose("break")}>Mark as break/lunch</Button>
            <Button variant="secondary" onClick={() => onClose("meeting")}>Mark as meeting</Button>
            <Button variant="outline" onClick={() => onClose("admin")}>Admin/Non-billable</Button>
          </div>
          <div className="pt-2">
            <p className="text-sm text-muted-foreground mb-2">Or switch to a different task:</p>
            <HierarchySelector value={nextTask} onChange={setNextTask} />
            <div className="pt-3">
              <Button variant="default" disabled={!nextTask} onClick={() => nextTask && onClose("switch", nextTask)}>
                Switch task and continue
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose("break")}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
