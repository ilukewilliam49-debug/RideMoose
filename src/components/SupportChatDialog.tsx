import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

interface SupportChatDialogProps {
  rideId: string;
  trigger?: React.ReactNode;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;

const SupportChatDialog = ({ rideId, trigger }: SupportChatDialogProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting: Msg = {
        role: "assistant",
        content: "Hi there! 👋 I'm sorry to hear you're having trouble finding a driver for your delivery. I'm here to help — tell me more about the issue and I'll do my best to assist you.\n\nIf you'd prefer to speak with a human agent, you can escalate at any time using the button below.",
      };
      setMessages([greeting]);
    }
  }, [open, messages.length]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length > updatedMessages.length) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev.slice(0, updatedMessages.length), { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.filter((m) => m.role !== "assistant" || updatedMessages.indexOf(m) > 0),
          rideId,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to connect to support");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I'm having trouble connecting right now. Please try again in a moment. (${e.message})` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEscalate = async () => {
    setEscalating(true);
    try {
      const { data, error } = await supabase.functions.invoke("escalate-support", {
        body: { rideId, messages },
      });
      if (error) throw error;

      setEscalated(true);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "✅ **Your conversation has been escalated to our support team.** A human agent will review your case and get back to you within 24 hours. You can close this chat — we have all the details we need.",
        },
      ]);
      toast.success("Escalated to support team. We'll follow up within 24 hours.");
    } catch (e: any) {
      toast.error("Failed to escalate: " + (e.message || "Unknown error"));
    } finally {
      setEscalating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Contact Support
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Bot className="h-4 w-4 text-primary" /> Support Chat
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollRef as any}>
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
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
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0">
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
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-2 items-center text-muted-foreground">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border space-y-2">
          {!escalated && messages.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              disabled={escalating || isLoading}
              onClick={handleEscalate}
            >
              {escalating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              Escalate to Human Agent
            </Button>
          )}
          {escalated && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-center py-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Escalated — a human agent will follow up
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={escalated ? "Chat ended — agent will follow up" : "Type your message..."}
              className="flex-1 h-9 text-sm"
              disabled={isLoading || escalated}
            />
            <Button type="submit" size="sm" disabled={isLoading || !input.trim() || escalated}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupportChatDialog;
