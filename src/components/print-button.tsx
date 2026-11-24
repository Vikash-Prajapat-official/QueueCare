"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button size="lg" className="print:hidden" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
