"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import type { PollWithResults } from "@/lib/supporters/polls";

/** INSERIES-SUPPORTER-SYSTEM-01 — "area para enquetes". Vote once, see live results (bars), change vote by clicking another option. */
export function PollCard({ poll }: { poll: PollWithResults }) {
  const [myVoteIndex, setMyVoteIndex] = useState(poll.myVoteIndex);
  const [votesByOption, setVotesByOption] = useState(poll.votesByOption);
  const [pending, setPending] = useState(false);
  const totalVotes = votesByOption.reduce((sum, count) => sum + count, 0);

  async function vote(optionIndex: number) {
    if (pending || optionIndex === myVoteIndex) return;
    setPending(true);
    try {
      const response = await fetch(`/api/support/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIndex })
      });
      if (!response.ok) return;

      setVotesByOption((current) => {
        const next = [...current];
        if (myVoteIndex !== null) next[myVoteIndex] = Math.max(0, next[myVoteIndex] - 1);
        next[optionIndex] += 1;
        return next;
      });
      setMyVoteIndex(optionIndex);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="space-y-3">
      <p className="font-semibold text-ink">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map((option, index) => {
          const count = votesByOption[index] ?? 0;
          const percentage = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
          const isMine = myVoteIndex === index;
          return (
            <button
              key={option}
              type="button"
              onClick={() => vote(index)}
              disabled={pending}
              className={`relative w-full overflow-hidden rounded-2xl border p-3 text-left text-sm transition ${
                isMine ? "border-primary" : "border-border hover:border-border-strong"
              }`}
            >
              <div className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${percentage}%` }} aria-hidden="true" />
              <div className="relative flex items-center justify-between gap-2">
                <span className={isMine ? "font-semibold text-primary-text" : "text-ink"}>{option}</span>
                <span className="text-xs text-muted">{percentage}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-subtle">{totalVotes} voto(s)</p>
    </Card>
  );
}
