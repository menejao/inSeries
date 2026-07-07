import { Badge } from "@/components/ui/badge";
import { getTagBadgeVariant, getTagIcon } from "@/lib/catalog/tag-labels";

/** Fase 4 — one Collection Tag, with its own color+icon identity (lib/catalog/tag-labels.ts). */
export function CollectionTagBadge({ tag, className }: { tag: string; className?: string }) {
  const Icon = getTagIcon(tag);
  return (
    <Badge variant={getTagBadgeVariant(tag)} className={className}>
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {tag}
    </Badge>
  );
}

/** Renders every tag for a series, or nothing if there are none — never an empty wrapper. */
export function CollectionTagList({ tags, limit, className }: { tags: string[]; limit?: number; className?: string }) {
  if (!tags.length) return null;
  const visible = limit ? tags.slice(0, limit) : tags;

  return (
    <div className={className ?? "flex flex-wrap gap-1.5"}>
      {visible.map((tag) => (
        <CollectionTagBadge key={tag} tag={tag} />
      ))}
    </div>
  );
}
