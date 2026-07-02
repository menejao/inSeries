import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { mockProfile } from "@/lib/catalog/mock-data";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar label={mockProfile.avatarUrl} className="h-20 w-20 text-lg" />
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="section-title">{mockProfile.name}</h1>
            <Badge>@{username}</Badge>
          </div>
          <p className="section-copy">{mockProfile.bio}</p>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {[
          ["Seguidores", mockProfile.followers],
          ["Seguindo", mockProfile.following],
          ["Series publicas", mockProfile.publicSeriesCount],
          ["Listas", mockProfile.listsCount],
          ["Reviews", mockProfile.reviewsCount]
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <p className="text-sm text-slate-300">{label}</p>
            <p className="mt-2 text-3xl font-black text-ink">{value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
