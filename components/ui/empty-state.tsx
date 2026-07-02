import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  copy,
  cta
}: {
  title: string;
  copy: string;
  cta?: string;
}) {
  return (
    <Card className="text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{copy}</p>
      {cta ? <Button className="mt-4">{cta}</Button> : null}
    </Card>
  );
}
