import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorRetryProps {
  message?: string;
  onRetry: () => void;
}

export default function ErrorRetry({ message = "Something went wrong", onRetry }: ErrorRetryProps) {
  return (
    <div className="rounded-2xl bg-destructive/5 ring-1 ring-destructive/20 p-6 text-center space-y-3">
      <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
      <p className="text-sm font-medium text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </Button>
    </div>
  );
}
