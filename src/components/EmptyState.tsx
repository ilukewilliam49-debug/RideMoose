import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
      <Icon className="h-7 w-7 text-muted-foreground/40" />
    </div>
    <h3 className="text-base font-semibold mb-1">{title}</h3>
    {description && (
      <p className="text-sm text-muted-foreground max-w-[260px]">{description}</p>
    )}
    {actionLabel && onAction && (
      <Button
        variant="outline"
        size="sm"
        className="mt-4 rounded-full"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    )}
  </div>
);

export default EmptyState;
