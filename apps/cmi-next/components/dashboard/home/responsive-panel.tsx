"use client";

// A slide-out that's a side panel on desktop and a bottom sheet on a phone:
// CMI's SidePanel (expandable, remembered width) and Drawer. Echo's
// ResponsivePanel, built on CMI's own pieces.
import * as React from "react";
import { SidePanel } from "@/components/ui/side-panel";
import { Drawer } from "@/components/ui/drawer";

function useIsPhone() {
  const [phone, setPhone] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

export function ResponsivePanel({ open, onOpenChange, title, description, footer, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; footer?: React.ReactNode; children: React.ReactNode;
}) {
  const phone = useIsPhone();
  if (phone) {
    return (
      <Drawer open={open} onClose={() => onOpenChange(false)} title={title} description={description}>
        <div className="max-h-[75vh] space-y-4 overflow-y-auto pb-2">{children}</div>
        {footer ? <div className="mt-3 border-t border-border pt-3">{footer}</div> : null}
      </Drawer>
    );
  }
  if (!open) return null;
  return (
    <SidePanel title={title} subtitle={description} onClose={() => onOpenChange(false)} wide footer={footer}>
      <div className="space-y-4">{children}</div>
    </SidePanel>
  );
}
