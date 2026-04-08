import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Send, MessageCircle, Image, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface RideChatSheetProps {
  rideId: string;
  otherPartyName?: string;
  trigger?: React.ReactNode;
}

interface Message {
  id: string;
  ride_id: string;
  sender_profile_id: string;
  message: string;
  image_url: string | null;
  audio_url: string | null;
  location_lat: number | null;
  location_lng: number | null;
  read_at: string | null;
  created_at: string;
}

export default function RideChatSheet({ rideId, otherPartyName, trigger }: RideChatSheetProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["ride-messages", rideId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ride_messages")
        .select("*")
        .eq("ride_id", rideId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Message[];
    },
    enabled: open && !!rideId,
    refetchInterval: open ? 3000 : false,
  });

  // Unread count for badge
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["ride-messages-unread", rideId, profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0;
      const { count, error } = await supabase
        .from("ride_messages")
        .select("*", { count: "exact", head: true })
        .eq("ride_id", rideId)
        .neq("sender_profile_id", profile.id)
        .is("read_at", null);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!rideId && !!profile?.id,
    refetchInterval: 10000,
  });

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Mark messages as read when opening
  useEffect(() => {
    if (!open || !profile?.id || !rideId) return;
    const markRead = async () => {
      await supabase
        .from("ride_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("ride_id", rideId)
        .neq("sender_profile_id", profile.id)
        .is("read_at", null);
      queryClient.invalidateQueries({ queryKey: ["ride-messages-unread", rideId] });
    };
    markRead();
  }, [open, messages.length, profile?.id, rideId, queryClient]);

  // Real-time subscription
  useEffect(() => {
    if (!open || !rideId) return;
    const channel = supabase
      .channel(`ride-chat-${rideId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ride_messages", filter: `ride_id=eq.${rideId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["ride-messages", rideId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, rideId, queryClient]);

  const sendMessage = async (msg: string, imageUrl?: string, locLat?: number, locLng?: number) => {
    if (!profile?.id || !msg.trim() && !imageUrl) return;
    setSending(true);
    try {
      const { error } = await supabase.from("ride_messages").insert({
        ride_id: rideId,
        sender_profile_id: profile.id,
        message: msg.trim() || (imageUrl ? "📷 Photo" : locLat ? "📍 Location" : ""),
        image_url: imageUrl || null,
        location_lat: locLat || null,
        location_lng: locLng || null,
      });
      if (error) throw error;
      setText("");
      queryClient.invalidateQueries({ queryKey: ["ride-messages", rideId] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      const ext = file.name.split(".").pop();
      const path = `${rideId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("chat-images").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(path);
      await sendMessage("📷 Photo", urlData.publicUrl);
    } catch (err: any) {
      toast.error("Failed to upload image");
    }
  };

  const shareLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => sendMessage("📍 My location", undefined, pos.coords.latitude, pos.coords.longitude),
      () => toast.error("Could not get location")
    );
  };

  const quickReplies = ["On my way!", "I'm here", "5 minutes away", "Running late", "Thanks!"];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5 relative">
            <MessageCircle className="h-4 w-4" />
            Chat
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle className="text-base">
            Chat with {otherPartyName || "your ride"}
          </SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No messages yet. Say hello! 👋
            </p>
          )}
          {messages.map((msg) => {
            const isMine = msg.sender_profile_id === profile?.id;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-foreground rounded-bl-md"
                }`}>
                  {msg.image_url && (
                    <img src={msg.image_url} alt="" className="rounded-lg max-h-48 mb-1 cursor-pointer" onClick={() => window.open(msg.image_url!, "_blank")} />
                  )}
                  {msg.location_lat && msg.location_lng && (
                    <a
                      href={`https://www.google.com/maps?q=${msg.location_lat},${msg.location_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 underline text-xs mb-1"
                    >
                      <MapPin className="h-3 w-3" /> View on map
                    </a>
                  )}
                  <p>{msg.message}</p>
                  <p className={`text-[10px] mt-0.5 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {format(new Date(msg.created_at), "h:mm a")}
                    {isMine && msg.read_at && " ✓✓"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick replies */}
        <div className="px-4 pb-1 flex gap-1.5 overflow-x-auto">
          {quickReplies.map((qr) => (
            <button
              key={qr}
              onClick={() => sendMessage(qr)}
              className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium hover:bg-accent transition-colors"
            >
              {qr}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div className="flex items-center gap-2 px-4 py-3 border-t">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
          <button onClick={() => fileRef.current?.click()} className="shrink-0 p-2 rounded-full hover:bg-secondary transition-colors">
            <Image className="h-5 w-5 text-muted-foreground" />
          </button>
          <button onClick={shareLocation} className="shrink-0 p-2 rounded-full hover:bg-secondary transition-colors">
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(text); } }}
            placeholder="Type a message..."
            className="flex-1 rounded-full bg-secondary border-0"
          />
          <Button
            size="icon"
            className="shrink-0 rounded-full h-10 w-10"
            disabled={sending || !text.trim()}
            onClick={() => sendMessage(text)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
