import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MailX, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    const validate = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
        const data = await res.json();
        if (data.valid === false && data.reason === "already_unsubscribed") setStatus("already");
        else if (data.valid) setStatus("valid");
        else setStatus("invalid");
      } catch { setStatus("error"); }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (data?.success) setStatus("done");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch { setStatus("error"); }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />}
        {status === "valid" && (
          <>
            <MailX className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-2xl font-bold">Unsubscribe</h1>
            <p className="text-muted-foreground">Are you sure you want to unsubscribe from PickYou emails?</p>
            <Button onClick={handleUnsubscribe} disabled={submitting} className="w-full">
              {submitting ? "Processing..." : "Confirm Unsubscribe"}
            </Button>
          </>
        )}
        {status === "done" && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold">Unsubscribed</h1>
            <p className="text-muted-foreground">You've been successfully unsubscribed from our emails.</p>
          </>
        )}
        {status === "already" && (
          <>
            <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-2xl font-bold">Already Unsubscribed</h1>
            <p className="text-muted-foreground">This email address has already been unsubscribed.</p>
          </>
        )}
        {(status === "invalid" || status === "error") && (
          <>
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold">Invalid Link</h1>
            <p className="text-muted-foreground">This unsubscribe link is invalid or has expired.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
