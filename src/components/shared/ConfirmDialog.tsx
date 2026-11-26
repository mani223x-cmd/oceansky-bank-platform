"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

type Variant = "default" | "danger" | "success" | "warning";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  children?: ReactNode;
}) {
  const icons = {
    default: Info,
    danger: AlertTriangle,
    success: CheckCircle2,
    warning: AlertTriangle,
  };
  const colors = {
    default: "text-teal",
    danger: "text-destructive",
    success: "text-emerald-600",
    warning: "text-amber-500",
  };
  const Icon = icons[variant];
  const btnVariant =
    variant === "danger" ? "destructive" :
    variant === "success" ? "default" :
    "default";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Icon className={`size-6 ${colors[variant]}`} />
            </div>
            <div className="space-y-1">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>
        {children && <div className="py-2 text-sm">{children}</div>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{cancelLabel}</Button>
          <Button
            variant={btnVariant}
            onClick={async () => { await onConfirm(); }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
