import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Truck, CheckCircle, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const NotificationBell = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const unreadCount = notifications?.filter((n: any) => !n.read).length || 0;

  // Realtime subscription
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["notifications", profile.id] });
        const n = payload.new as any;
        if (n?.title) {
          toast(n.title, {
            description: n.body,
            duration: 6000,
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, queryClient]);

  const markAsRead = async (notifId: string) => {
    await supabase
      .from("notifications")
      .update({ read: true } as any)
      .eq("id", notifId);
    queryClient.invalidateQueries({ queryKey: ["notifications", profile?.id] });
  };

  const markAllRead = async () => {
    if (!profile?.id) return;
    await supabase
      .from("notifications")
      .update({ read: true } as any)
      .eq("user_id", profile.id)
      .eq("read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications", profile?.id] });
  };

  const handleClick = (notif: any) => {
    markAsRead(notif.id);
    if (notif.type === "large_delivery_bid" && notif.ride_id) {
      if (profile?.role === "driver") {
        navigate("/driver/dispatch");
      }
    } else if (notif.type === "verification_approved") {
      navigate("/driver");
    } else if (notif.type === "verification_rejected") {
      navigate("/driver/onboarding");
    }
    setOpen(false);
  };

  const iconForType = (type: string) => {
    if (type === "large_delivery_bid") return <Truck className="h-4 w-4 text-primary shrink-0" />;
    if (type === "verification_approved") return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
    if (type === "verification_rejected") return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    return <Bell className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {(!notifications || notifications.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-3 py-2.5 flex gap-2.5 items-start hover:bg-accent/50 transition-colors ${!n.read ? "bg-accent/20" : ""}`}
                >
                  {iconForType(n.type)}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? "font-medium" : ""}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
