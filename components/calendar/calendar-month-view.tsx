"use client";

import { useMemo, useState } from "react";
import { EpisodeCalendarCard } from "@/components/calendar/episode-calendar-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from "@/components/ui/icons";
import { isSameDay } from "@/lib/calendar/dates";
import { cn } from "@/lib/utils";
import type { CalendarEpisode } from "@/lib/calendar/queries";
import type { CalendarEpisodeStatus } from "@/lib/calendar/personal-sections";

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function buildMonthGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function episodeStatusFor(episode: CalendarEpisode, now: Date): CalendarEpisodeStatus {
  if (episode.watched) return "assistido";
  if (isSameDay(episode.airedAt, now)) return "hoje";
  if (episode.airedAt < now) return "atrasado";
  return "em-breve";
}

/**
 * Fase 14 (INSERIES-CATALOG-SERIES-EXPERIENCE-01... ver INSERIES-CALENDAR-EXPERIENCE-01) —
 * modo alternativo de visualizacao, complementar a lista cronologica (nunca a substitui - o
 * toggle Lista/Mes vive em `PersonalCalendarBody`, com Lista como padrao). Constroi a grade a
 * partir dos mesmos episodios ja buscados pela lista, sem nenhuma query nova.
 */
export function CalendarMonthView({ episodes }: { episodes: CalendarEpisode[] }) {
  const now = useMemo(() => new Date(), []);
  const [monthDate, setMonthDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const days = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const episodesByDay = useMemo(() => {
    const map = new Map<string, CalendarEpisode[]>();
    for (const episode of episodes) {
      const key = episode.airedAt.toDateString();
      const list = map.get(key) ?? [];
      list.push(episode);
      map.set(key, list);
    }
    return map;
  }, [episodes]);

  const selectedDayEpisodes = selectedDay ? (episodesByDay.get(selectedDay.toDateString()) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold text-ink">
          {MONTH_LABELS[monthDate.getMonth()]} {monthDate.getFullYear()}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition hover:border-border-strong hover:text-ink"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Proximo mes"
            onClick={() => setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition hover:border-border-strong hover:text-ink"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-subtle">
        {WEEKDAY_LABELS.map((label, index) => (
          <div key={`${label}-${index}`}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inCurrentMonth = day.getMonth() === monthDate.getMonth();
          const dayEpisodes = episodesByDay.get(day.toDateString()) ?? [];
          const isToday = isSameDay(day, now);
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={!dayEpisodes.length}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={cn(
                "flex min-h-16 flex-col items-center gap-1 rounded-xl border p-1.5 text-sm transition",
                inCurrentMonth ? "border-border bg-surface" : "border-transparent bg-transparent text-subtle/50",
                isToday && "border-primary",
                isSelected && "bg-primary/10",
                !dayEpisodes.length && "cursor-default"
              )}
            >
              <span className={cn("font-medium", inCurrentMonth ? "text-ink" : "text-subtle/60")}>{day.getDate()}</span>
              {dayEpisodes.length ? (
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold",
                    episodeStatusFor(dayEpisodes[0], now) === "atrasado" ? "bg-danger/20 text-danger-text" : "bg-primary/20 text-primary-text"
                  )}
                >
                  {dayEpisodes.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selectedDay ? (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">
              {selectedDay.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedDay(null)}>
              Fechar
            </Button>
          </div>
          {selectedDayEpisodes.length ? (
            <div className="space-y-3">
              {selectedDayEpisodes.map((episode) => (
                <EpisodeCalendarCard key={episode.id} episode={episode} authenticated status={episodeStatusFor(episode, now)} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<CalendarIcon className="h-5 w-5" />} title="Nada neste dia" copy="Sem episodios nesta data." />
          )}
        </div>
      ) : null}
    </div>
  );
}
