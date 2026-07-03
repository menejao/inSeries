import { EmptyState } from "@/components/ui/empty-state";
import { AlertCircleIcon } from "@/components/ui/icons";

/** Fase 10: feature flag off -> pages show this instead of any generated data. */
export function RecapUnavailable() {
  return <EmptyState icon={<AlertCircleIcon className="h-6 w-6" />} title="Recap indisponivel" copy="O recap esta desativado no momento." />;
}
