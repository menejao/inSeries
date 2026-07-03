import { EmptyState } from "@/components/ui/empty-state";
import { AlertCircleIcon } from "@/components/ui/icons";

/** Fase 11: feature flag off -> pages show this instead of the engine's data. */
export function AchievementsUnavailable() {
  return <EmptyState icon={<AlertCircleIcon className="h-6 w-6" />} title="Conquistas indisponiveis" copy="A gamificacao esta desativada no momento." />;
}
