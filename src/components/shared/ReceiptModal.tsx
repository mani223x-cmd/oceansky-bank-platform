"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface ReceiptData {
  reference: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  fee?: number;
  totalDebit?: number;
  counterparty?: string;
  counterpartyAccount?: string;
  counterpartyBank?: string;
  status: "success" | "pending" | "failed";
  meta?: Array<{ label: string; value: ReactNode }>;
}

export function ReceiptModal({
  open,
  onClose,
  title = "Transaction Receipt",
  data,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  data: ReceiptData | null;
}) {
  if (!data) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Save or print this receipt for your records.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 py-2">
            <div className={cn(
              "size-12 grid place-items-center rounded-full text-white font-bold",
              data.status === "success" ? "bg-emerald-600" : data.status === "pending" ? "bg-amber-500" : "bg-destructive"
            )}>
              {data.status === "success" ? "✓" : data.status === "pending" ? "!" : "✕"}
            </div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
            <p className="font-medium capitalize">{data.status}</p>
          </div>

          <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm">
            <Row label="Reference" value={data.reference} />
            <Row label="Date" value={data.date} />
            <Row label="Description" value={data.description} />
            {data.counterparty && <Row label="Beneficiary" value={data.counterparty} />}
            {data.counterpartyAccount && <Row label="Account" value={data.counterpartyAccount} />}
            {data.counterpartyBank && <Row label="Bank" value={data.counterpartyBank} />}
            {data.meta?.map((m) => <Row key={m.label} label={m.label} value={m.value} />)}
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{new Intl.NumberFormat("en-NG", { style: "currency", currency: data.currency }).format(data.amount)}</span>
            </div>
            {data.fee !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span>{new Intl.NumberFormat("en-NG", { style: "currency", currency: data.currency }).format(data.fee)}</span>
              </div>
            )}
            {data.totalDebit !== undefined && (
              <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
                <span>Total Debit</span>
                <span>{new Intl.NumberFormat("en-NG", { style: "currency", currency: data.currency }).format(data.totalDebit)}</span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium truncate max-w-[60%]">{value}</span>
    </div>
  );
}
