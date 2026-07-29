"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type ProfileListTile = { id: string; title: string; itemCount: number };

const PREVIEW_COUNT = 4;

function ListCard({ list }: { list: ProfileListTile }) {
  return (
    <Link href={`/lists/${list.id}`}>
      <Card interactive padding="sm">
        <p className="font-semibold text-ink">{list.title}</p>
        <p className="mt-1 text-sm text-muted">{list.itemCount} series</p>
      </Card>
    </Link>
  );
}

/** INSERIES-PROFILE-REDESIGN-01 — "ate 4 listas... Ver todas." Nunca renderiza se nao houver listas publicas (sem "Nenhuma lista"). */
export function ProfileListsPreview({ lists }: { lists: ProfileListTile[] }) {
  const [open, setOpen] = useState(false);
  if (!lists.length) return null;

  const preview = lists.slice(0, PREVIEW_COUNT);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Listas</h2>
        {lists.length > PREVIEW_COUNT ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Ver todas
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {preview.map((list) => (
          <ListCard key={list.id} list={list} />
        ))}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Listas" size="lg">
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      </Dialog>
    </section>
  );
}
