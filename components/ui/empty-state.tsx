import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { InboxIcon } from "@/components/ui/icons";

export function EmptyState({
  title,
  copy,
  icon,
  action
}: {
  title: string;
  copy: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center animate-fade-in">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-strong text-subtle">
        {icon ?? <InboxIcon className="h-6 w-6" />}
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-ink">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted">{copy}</p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </Card>
  );
}
