"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/lib/utils";

export type ProfileReviewTile = {
  id: string;
  rating: number;
  body: string;
  updatedAt: Date;
  series: { slug: string; title: string };
};

const PREVIEW_COUNT = 4;

function ReviewCard({ review }: { review: ProfileReviewTile }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <Link href={`/series/${review.series.slug}`} className="font-semibold text-ink hover:text-primary-text">
          {review.series.title}
        </Link>
        <Badge variant="warning">{review.rating}/5</Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted">{review.body}</p>
      <p className="mt-2 text-xs text-subtle">{formatRelativeDate(review.updatedAt)}</p>
    </Card>
  );
}

/** INSERIES-PROFILE-REDESIGN-01 — "3 ou 4 reviews recentes... Ver todas." Sem secao vazia: some por completo quando nao ha reviews. */
export function ProfileReviewsPreview({ reviews }: { reviews: ProfileReviewTile[] }) {
  const [open, setOpen] = useState(false);
  if (!reviews.length) return null;

  const preview = reviews.slice(0, PREVIEW_COUNT);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Reviews</h2>
        {reviews.length > PREVIEW_COUNT ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Ver todas
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {preview.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Reviews" size="lg">
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      </Dialog>
    </section>
  );
}
