import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Megaphone, Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Audience = "drivers" | "riders" | "all";

export default function BroadcastNotificationPanel() {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<Audience>("drivers");
  const [heading, setHeading] = useState("");
  const [message, setMessage] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "send-push-notification",
        {
          body: {
            mode: "broadcast",
            audience,
            heading: heading.trim(),
            message: message.trim(),
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Broadcast sent to ${data.total_profiles} user${data.total_profiles !== 1 ? "s" : ""} (${data.sent} push delivered)`
      );
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send broadcast");
    },
  });

  const resetForm = () => {
    setHeading("");
    setMessage("");
    setAudience("drivers");
    setConfirmStep(false);
    setOpen(false);
  };

  const audienceLabel: Record<Audience, string> = {
    drivers: "All Drivers",
    riders: "All Riders",
    all: "All Users",
  };

  const canSend = heading.trim().length > 0 && message.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmStep(false); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Megaphone className="h-4 w-4" />
          Broadcast
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Send Broadcast Notification
          </DialogTitle>
          <DialogDescription>
            Send a push notification and in-app message to all users in the selected audience.
          </DialogDescription>
        </DialogHeader>

        {!confirmStep ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="audience">Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drivers">All Drivers</SelectItem>
                  <SelectItem value="riders">All Riders</SelectItem>
                  <SelectItem value="all">All Users (Drivers + Riders)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="heading">Title</Label>
              <Input
                id="heading"
                placeholder="e.g. Scheduled Maintenance"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="e.g. The app will undergo maintenance tonight from 2-4 AM..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {message.length}/500
              </p>
            </div>

            <DialogFooter>
              <Button
                disabled={!canSend}
                onClick={() => setConfirmStep(true)}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Review &amp; Send
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Audience</span>
                <span className="font-medium">{audienceLabel[audience]}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Title</span>
                <span className="font-medium truncate max-w-[200px]">{heading}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Message</span>
                <p className="mt-1 text-foreground">{message}</p>
              </div>
            </div>

            <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
              ⚠ This will send to all {audienceLabel[audience].toLowerCase()}. This action cannot be undone.
            </p>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setConfirmStep(false)}
                disabled={broadcastMutation.isPending}
              >
                Back
              </Button>
              <Button
                variant="default"
                onClick={() => broadcastMutation.mutate()}
                disabled={broadcastMutation.isPending}
                className="gap-2"
              >
                {broadcastMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirm &amp; Send
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
