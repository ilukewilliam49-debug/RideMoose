import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Bot,
  User,
  Send,
  AlertTriangle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ConversationRow {
  id: string;
  ride_id: string | null;
  user_id: string;
  messages: { role: string; content: string }[];
  status: string;
  created_at: string;
  resolved_at: string | null;
  admin_notes: string | null;
}

const statusConfig: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", icon: AlertTriangle, variant: "destructive" },
  in_progress: { label: "In Progress", icon: Clock, variant: "default" },
  resolved: { label: "Resolved", icon: CheckCircle2, variant: "secondary" },
};

const AdminSupport = () => {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["admin-support-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_conversations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch user names
      const userIds = [...new Set((data || []).map((c: any) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const profileMap = new Map(profiles?.map((p: any) => [p.id, p.full_name]) || []);

      return (data || []).map((c: any) => ({
        ...c,
        messages: Array.isArray(c.messages) ? c.messages : [],
        user_name: profileMap.get(c.user_id) || "Unknown User",
      }));
    },
    refetchInterval: 15000,
  });

  const filtered = conversations?.filter(
    (c: any) => statusFilter === "all" || c.status === statusFilter
  ) || [];

  const selected = conversations?.find((c: any) => c.id === selectedId) as (ConversationRow & { user_name: string }) | undefined;

  const updateStatus = async (id: string, newStatus: string) => {
    setSaving(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "resolved") updateData.resolved_at = new Date().toISOString();
      const { error } = await supabase
        .from("support_conversations")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
      toast.success(`Status updated to ${statusConfig[newStatus]?.label || newStatus}`);
      queryClient.invalidateQueries({ queryKey: ["admin-support-conversations"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("support_conversations")
        .update({ admin_notes: adminNotes })
        .eq("id", id);
      if (error) throw error;
      toast.success("Notes saved");
      queryClient.invalidateQueries({ queryKey: ["admin-support-conversations"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setSelectedId(null)}>
          <ArrowLeft className="h-4 w-4" /> Back to list
        </Button>

        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{selected.user_name}</h2>
          <StatusBadge status={selected.status} />
          {selected.ride_id && (
            <span className="text-xs text-muted-foreground font-mono">
              Ride: {selected.ride_id.slice(0, 8)}…
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(selected.created_at).toLocaleString()}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
          {/* Chat transcript */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-3">
                <div className="space-y-3">
                  {selected.messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role !== "user" && (
                        <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                      <div
                        className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {msg.role !== "user" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Actions panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Update Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(["open", "in_progress", "resolved"] as const).map((s) => {
                  const cfg = statusConfig[s];
                  const Icon = cfg.icon;
                  return (
                    <Button
                      key={s}
                      variant={selected.status === s ? "default" : "outline"}
                      size="sm"
                      className="w-full justify-start gap-2"
                      disabled={saving || selected.status === s}
                      onClick={() => updateStatus(selected.id, s)}
                    >
                      <Icon className="h-3.5 w-3.5" /> {cfg.label}
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Admin Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes about this case..."
                  className="min-h-[100px] text-sm"
                />
                <Button
                  size="sm"
                  className="w-full gap-1"
                  disabled={saving}
                  onClick={() => saveNotes(selected.id)}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Save Notes
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> Support Conversations
        </h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No support conversations found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((conv: any) => {
            const userMsgCount = conv.messages.filter((m: any) => m.role === "user").length;
            const lastMsg = conv.messages[conv.messages.length - 1];
            return (
              <Card
                key={conv.id}
                className="cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => {
                  setSelectedId(conv.id);
                  setAdminNotes(conv.admin_notes || "");
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">{conv.user_name}</p>
                        <StatusBadge status={conv.status} />
                        {conv.ride_id && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Ride: {conv.ride_id.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="text-xs text-muted-foreground truncate">
                          {lastMsg.role === "user" ? "Customer: " : "AI: "}
                          {lastMsg.content.slice(0, 100)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(conv.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {userMsgCount} message{userMsgCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = statusConfig[status] || statusConfig.open;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1 text-[10px] px-1.5 py-0">
      <Icon className="h-2.5 w-2.5" /> {cfg.label}
    </Badge>
  );
};

export default AdminSupport;
