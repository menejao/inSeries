import { Badge } from "@/components/ui/badge";
import { PosterBadge } from "@/components/media/poster-badge";
import { getTagBadgeVariant, getTagIcon } from "@/lib/catalog/tag-labels";

/**
 * Fase 5 (INSERIES-DASHBOARD-UX-AND-NAVIGATION-01) — `overlay` switches the wrapper from
 * `Badge` (low-opacity tint, correct on a solid card background) to `PosterBadge` (solid
 * fill, correct on top of a poster/backdrop image). Pass `overlay` whenever this renders
 * inside an absolutely-positioned poster overlay; omit it everywhere else (unchanged).
 */
export function CollectionTagBadge({ tag, className, overlay }: { tag: string; className?: string; overlay?: boolean }) {
  const Icon = getTagIcon(tag);
  const content = (
    <>
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {tag}
    </>
  );

  if (overlay) {
    return (
      <PosterBadge variant={getTagBadgeVariant(tag)} className={className}>
        {content}
      </PosterBadge>
    );
  }

  return (
    <Badge variant={getTagBadgeVariant(tag)} className={className}>
      {content}
    </Badge>
  );
}

/** Renders every tag for a series, or nothing if there are none — never an empty wrapper. */
export function CollectionTagList({ tags, limit, className, overlay }: { tags: string[]; limit?: number; className?: string; overlay?: boolean }) {
  if (!tags.length) return null;
  const visible = limit ? tags.slice(0, limit) : tags;

  return (
    <div className={className ?? "flex flex-wrap gap-1.5"}>
      {visible.map((tag) => (
        <CollectionTagBadge key={tag} tag={tag} overlay={overlay} />
      ))}
    </div>
  );
}
