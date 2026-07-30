"use client";

import { useState, useTransition } from "react";
import { HeartIcon } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SeriesFavoriteButton({
  seriesId,
  initialFavorite,
  authenticated
}: {
  seriesId: string;
  initialFavorite: boolean;
  authenticated: boolean;
}) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isPending, startTransition] = useTransition();

  if (!authenticated) {
    return (
      <button disabled className={buttonVariants({ variant: "secondary", size: "md" })}>
        <HeartIcon className="h-4 w-4" />
        Favoritar
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      aria-pressed={isFavorite}
      onClick={() => {
        startTransition(async () => {
          await fetch(`/api/series/${seriesId}/favorite`, { method: "POST" });
          setIsFavorite((prev) => !prev);
        });
      }}
      className={cn(
        buttonVariants({ variant: "secondary", size: "md" }),
        isFavorite && "border-error/50 bg-error/10 text-error-text hover:bg-error/15"
      )}
    >
      <HeartIcon className={cn("h-4 w-4", isFavorite && "fill-current")} />
      {isFavorite ? "Favoritado" : "Favoritar"}
    </button>
  );
}
