import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export interface DocumentSpec {
  type: string;
  label: string;
  optional?: boolean;
  helper: string;
  tips: string[];
}

type DocStatus = "missing" | "uploading" | "pending" | "approved" | "rejected";

interface DocumentUploadCardProps {
  doc: DocumentSpec;
  status: DocStatus;
  previewUrl?: string | null;
  reviewerNotes?: string | null;
  uploadProgress?: number;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED = "image/jpeg,image/png,image/webp,application/pdf";

const validate = (file: File): string | null => {
  if (file.size > MAX_FILE_BYTES) return "File is too large (max 10 MB).";
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isImg = /^image\/(jpeg|png|webp)$/.test(file.type);
  if (!isPdf && !isImg) {
    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
      return "HEIC photos aren't supported. Please upload JPG or PNG.";
    }
    return "Only JPG, PNG, WEBP, or PDF files are allowed.";
  }
  return null;
};

export const DocumentUploadCard = ({
  doc,
  status,
  previewUrl,
  reviewerNotes,
  uploadProgress,
  onUpload,
  disabled,
}: DocumentUploadCardProps) => {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);

  const handleFile = async (file: File) => {
    const error = validate(file);
    if (error) {
      toast.error(error);
      return;
    }
    if (file.type.startsWith("image/")) {
      setLocalPreview(URL.createObjectURL(file));
    } else {
      setLocalPreview(null);
    }
    await onUpload(file);
  };

  const isBusy = status === "uploading";
  const isDone = status === "approved" || status === "pending";
  const isRejected = status === "rejected";

  const previewSrc = localPreview || previewUrl || null;
  const isPdfPreview = previewSrc && /\.pdf(\?|$)/i.test(previewSrc);

  const StatusBadge = () => {
    if (status === "approved")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-500">
          <CheckCircle2 className="h-3.5 w-3.5" /> Approved
        </span>
      );
    if (status === "pending")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
        </span>
      );
    if (status === "rejected")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
          <XCircle className="h-3.5 w-3.5" /> Rejected — please re-upload
        </span>
      );
    if (status === "uploading")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
        </span>
      );
    if (doc.optional)
      return <span className="text-xs text-muted-foreground">Optional</span>;
    return <span className="text-xs text-muted-foreground">Required</span>;
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isRejected
          ? "border-destructive/50 bg-destructive/5"
          : isDone
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-secondary/40"
      }`}
    >
      <input
        ref={galleryRef}
        type="file"
        className="hidden"
        accept={ACCEPTED}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
        disabled={disabled || isBusy}
      />
      <input
        ref={cameraRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
        disabled={disabled || isBusy}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{doc.label}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{doc.helper}</p>
          <div className="mt-1.5">
            <StatusBadge />
          </div>
        </div>

      </div>

      {/* Tips — collapsed by default */}
      {!isDone && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setTipsOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={tipsOpen}
          >
            {tipsOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {tipsOpen ? "Hide tips" : "See tips"}
          </button>
          {tipsOpen && (
            <ul className="mt-2 space-y-1">
              {doc.tips.map((tip) => (
                <li
                  key={tip}
                  className="text-[11px] text-muted-foreground flex items-start gap-1.5"
                >
                  <span className="text-primary mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Rejection notes */}
      {isRejected && reviewerNotes && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{reviewerNotes}</span>
        </div>
      )}

      {/* Progress bar */}
      {isBusy && typeof uploadProgress === "number" && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.max(5, uploadProgress)}%` }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {!isDone && !isRejected && (
          <>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => cameraRef.current?.click()}
              disabled={disabled || isBusy}
              className="flex-1 sm:flex-none"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Camera className="h-4 w-4 mr-1.5" />
              )}
              Take Photo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => galleryRef.current?.click()}
              disabled={disabled || isBusy}
              className="flex-1 sm:flex-none"
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Upload File
            </Button>
          </>
        )}

        {(isDone || isRejected) && (
          <>
            {previewSrc && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                asChild
              >
                <a href={previewSrc} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4 mr-1.5" />
                  View
                </a>
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant={isRejected ? "default" : "outline"}
              onClick={() => galleryRef.current?.click()}
              disabled={disabled || isBusy}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1.5" />
              )}
              {isRejected ? "Re-upload" : "Replace"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentUploadCard;
