import { prisma } from "@/lib/db/prisma";

export type PollWithResults = {
  id: string;
  question: string;
  options: string[];
  totalVotes: number;
  votesByOption: number[];
  myVoteIndex: number | null;
};

/** INSERIES-SUPPORTER-SYSTEM-01 — "area para enquetes destinadas aos Apoiadores". Vote counts are computed live (groupBy), never denormalized onto the poll row. */
export async function listActivePolls(userId: string): Promise<PollWithResults[]> {
  const polls = await prisma.supporterPoll.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } });
  if (!polls.length) return [];

  const votes = await prisma.supporterPollVote.groupBy({
    by: ["pollId", "optionIndex"],
    where: { pollId: { in: polls.map((poll) => poll.id) } },
    _count: { _all: true }
  });
  const myVotes = await prisma.supporterPollVote.findMany({
    where: { userId, pollId: { in: polls.map((poll) => poll.id) } },
    select: { pollId: true, optionIndex: true }
  });
  const myVoteByPoll = new Map(myVotes.map((vote) => [vote.pollId, vote.optionIndex]));

  return polls.map((poll) => {
    const options = Array.isArray(poll.options) ? (poll.options as unknown[]).map(String) : [];
    const votesByOption = options.map(
      (_, index) => votes.find((v) => v.pollId === poll.id && v.optionIndex === index)?._count._all ?? 0
    );
    return {
      id: poll.id,
      question: poll.question,
      options,
      totalVotes: votesByOption.reduce((sum, count) => sum + count, 0),
      votesByOption,
      myVoteIndex: myVoteByPoll.get(poll.id) ?? null
    };
  });
}

export async function voteOnPoll(userId: string, pollId: string, optionIndex: number) {
  const poll = await prisma.supporterPoll.findUnique({ where: { id: pollId } });
  if (!poll || !poll.active) return { ok: false as const, error: "poll_not_found" as const };

  const options = Array.isArray(poll.options) ? poll.options : [];
  if (optionIndex < 0 || optionIndex >= options.length) return { ok: false as const, error: "invalid_option" as const };

  await prisma.supporterPollVote.upsert({
    where: { pollId_userId: { pollId, userId } },
    create: { pollId, userId, optionIndex },
    update: { optionIndex }
  });

  return { ok: true as const };
}
