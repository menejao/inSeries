import Link from "next/link";

/**
 * Fase 8/9 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — os dois contadores sociais, sempre
 * clicaveis, sempre nesse formato compacto ("128 seguindo · 94 seguidores"), nunca como cards
 * grandes de estatistica — usado tanto no cabecalho do Feed quanto no cabecalho do Perfil.
 */
export function SocialCounters({
  username,
  following,
  followers
}: {
  username: string;
  following: number;
  followers: number;
}) {
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
      <Link href={`/profile/${username}/following`} className="font-semibold text-ink hover:underline" aria-label={`Abrir lista de ${following} pessoas seguidas`}>
        {following} seguindo
      </Link>
      <span aria-hidden="true">·</span>
      <Link href={`/profile/${username}/followers`} className="font-semibold text-ink hover:underline" aria-label={`Abrir lista de ${followers} seguidores`}>
        {followers} seguidor{followers === 1 ? "" : "es"}
      </Link>
    </p>
  );
}
