import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { UserRow } from "@/components/social/user-row";
import { SocialSearchBar } from "@/components/social/social-search-bar";
import { UserIcon, ChevronLeftIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/lib/auth/server";
import { getProfileByUsername } from "@/lib/social/profile";
import { listFollowers } from "@/lib/social/followers";

/** Fase 11 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — lista de quem segue o perfil, com busca. */
export default async function FollowersPage({
  params,
  searchParams
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { username } = await params;
  const { q } = await searchParams;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const viewer = await getCurrentUser();
  const rows = await listFollowers(profile.id, viewer?.id ?? null, q);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href={`/profile/${username}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ChevronLeftIcon className="h-4 w-4" /> Voltar ao perfil
        </Link>
        <h1 className="section-title">Seguidores</h1>
        <p className="section-copy">Pessoas que acompanham @{username}.</p>
      </div>

      <SocialSearchBar label="Buscar seguidores" placeholder="Buscar por nome ou @username" />

      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <UserRow
              key={row.id}
              user={row}
              followState={row.followState}
              authenticated={Boolean(viewer)}
              followsViewer={row.followsViewer}
              mutualSeriesCount={row.mutualSeriesCount}
            />
          ))}
        </div>
      ) : q ? (
        <EmptyState icon={<UserIcon className="h-6 w-6" />} title="Nenhum usuario encontrado" copy="Tente buscar por outro nome ou username." />
      ) : (
        <EmptyState
          icon={<UserIcon className="h-6 w-6" />}
          title={viewer?.id === profile.id ? "Voce ainda nao possui seguidores" : "Ainda nao possui seguidores"}
          copy={
            viewer?.id === profile.id
              ? "Complete seu perfil, publique avaliacoes e compartilhe suas listas para ser encontrado por outras pessoas."
              : ""
          }
        />
      )}
    </div>
  );
}
