import { EmptyState } from "@/components/ui/empty-state";
import { UserRow } from "@/components/social/user-row";
import { SocialSearchBar } from "@/components/social/social-search-bar";
import { UserIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/lib/auth/server";
import { searchUsers, suggestUsersByAffinity, getPopularUsers } from "@/lib/social/affinity";
import { getFollowState } from "@/lib/social/follow";

/**
 * Fase 15 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — pagina dedicada a descoberta de pessoas,
 * separada do Catalogo/Recomendacoes de series/Feed Global. Busca por nome/@username sempre
 * disponivel; sugestoes por afinidade e usuarios ativos so aparecem sem termo de busca (a
 * busca substitui os blocos, nao soma a eles — evita repeticao).
 */
export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const viewer = await getCurrentUser();

  if (q) {
    const results = await searchUsers(viewer?.id ?? null, q);
    const withState = await Promise.all(
      results.map(async (user) => ({ ...user, followState: await getFollowState(viewer?.id ?? null, user.id) }))
    );

    return (
      <div className="space-y-6">
        <Header />
        <SocialSearchBar label="Buscar por nome ou @username" placeholder="Buscar por nome ou @username" />
        {withState.length ? (
          <div className="space-y-2">
            {withState.map((user) => (
              <UserRow key={user.id} user={user} followState={user.followState} authenticated={Boolean(viewer)} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<UserIcon className="h-6 w-6" />} title="Nenhum usuario encontrado" copy="Tente buscar por outro nome ou username." />
        )}
      </div>
    );
  }

  const [suggestions, popular] = await Promise.all([
    viewer ? suggestUsersByAffinity(viewer.id) : Promise.resolve([]),
    getPopularUsers(viewer?.id ?? null)
  ]);
  const suggestionsWithState = await Promise.all(
    suggestions.map(async (user) => ({ ...user, followState: await getFollowState(viewer?.id ?? null, user.id) }))
  );
  const popularWithState = await Promise.all(
    popular
      .filter((user) => !suggestions.some((suggested) => suggested.id === user.id))
      .map(async (user) => ({ ...user, followState: await getFollowState(viewer?.id ?? null, user.id) }))
  );

  return (
    <div className="space-y-8">
      <Header />
      <SocialSearchBar label="Buscar por nome ou @username" placeholder="Buscar por nome ou @username" />

      {suggestionsWithState.length ? (
        <section className="space-y-3">
          <h2 className="section-title text-lg">Usuarios com gostos parecidos</h2>
          <div className="space-y-2">
            {suggestionsWithState.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                followState={user.followState}
                authenticated={Boolean(viewer)}
                mutualSeriesCount={user.commonSeriesCount}
                affinityScore={user.affinityScore}
              />
            ))}
          </div>
        </section>
      ) : null}

      {popularWithState.length ? (
        <section className="space-y-3">
          <h2 className="section-title text-lg">Usuarios ativos</h2>
          <div className="space-y-2">
            {popularWithState.map((user) => (
              <UserRow key={user.id} user={user} followState={user.followState} authenticated={Boolean(viewer)} />
            ))}
          </div>
        </section>
      ) : null}

      {!suggestionsWithState.length && !popularWithState.length ? (
        <EmptyState
          icon={<UserIcon className="h-6 w-6" />}
          title="Nenhuma sugestao por enquanto"
          copy="Acompanhe algumas series e avalie-as para receber sugestoes de pessoas com gostos parecidos."
        />
      ) : null}
    </div>
  );
}

function Header() {
  return (
    <div>
      <p className="eyebrow">Rede social</p>
      <h1 className="section-title">Explorar pessoas</h1>
      <p className="section-copy">Encontre usuarios com gostos parecidos e acompanhe o que estao assistindo.</p>
    </div>
  );
}
