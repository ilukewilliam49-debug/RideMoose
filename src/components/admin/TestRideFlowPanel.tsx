import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FlaskConical, Play, CheckCircle2, XCircle, Loader2,
  Clock, ChevronDown, ChevronUp,
} from "lucide-react";

interface StepResult {
  step: string;
  status: "ok" | "failed" | "skipped";
  duration_ms: number;
  details?: Record<string, unknown>;
}

interface FlowResult {
  result: string;
  steps: StepResult[];
  total_ms: number;
}

const stepLabels: Record<string, string> = {
  "0_find_profiles": "Find test profiles",
  "0b_set_driver_online": "Set driver online",
  "1_create_ride": "Create ride",
  "2_accept_ride": "Accept ride",
  "3_start_ride": "Start ride",
  "4_complete_ride": "Complete ride",
  "5_verify_audit_trail": "Verify audit trail",
  "6_verify_notifications": "Verify notifications",
  "7_cleanup": "Cleanup",
};

export default function TestRideFlowPanel() {
  const [expanded, setExpanded] = useState(false);

  const { mutate, data, isPending, reset } = useMutation<FlowResult>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("test-ride-flow", {
        body: { skip_cleanup: false },
      });
      if (error) throw error;
      return data as FlowResult;
    },
  });

  const passed = data?.result?.includes("PASSED");
  const statusIcon = isPending
    ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    : passed === true
    ? <CheckCircle2 className="h-5 w-5 text-green-500" />
    : passed === false
    ? <XCircle className="h-5 w-5 text-destructive" />
    : <FlaskConical className="h-5 w-5 text-muted-foreground" />;

  return (
    <div className="rounded-3xl border border-border/50 bg-card/70 p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {statusIcon}
          <div>
            <h2 className="text-lg font-semibold">Ride lifecycle test</h2>
            <p className="text-sm text-muted-foreground">
              Simulate a full ride from request → complete and verify audit logs.
            </p>
          </div>
        </div>
        <Button
          onClick={() => { reset(); mutate(); }}
          disabled={isPending}
          size="sm"
          className="gap-2"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {isPending ? "Running…" : "Run test"}
        </Button>
      </div>

      {data && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={passed ? "default" : "destructive"} className="text-xs">
              {data.result}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {(data.total_ms / 1000).toFixed(1)}s
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {expanded ? "Hide" : "Show"} steps
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {/* Step details */}
          {expanded && (
            <div className="rounded-xl border bg-muted/30 divide-y divide-border text-sm">
              {data.steps.map((step) => {
                const label = stepLabels[step.step] || step.step;
                return (
                  <div key={step.step} className="flex items-center gap-3 px-4 py-2.5">
                    {step.status === "ok" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : step.status === "skipped" ? (
                      <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span className="flex-1 font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {step.duration_ms}ms
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
