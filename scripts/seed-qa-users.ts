/**
 * DEV/QA ONLY — never wired into build/deploy/startup (no package.json script points here on
 * purpose). Seeds two fixed, throwaway local accounts (MODERATOR/USER) so a human or agent can
 * manually verify role-gated access to /admin/social without touching real user data. Credentials
 * are fictitious dev-only values (same pattern as scripts/seed-admin.ts's hardcoded
 * "admin12345") — never real secrets, never meant to exist outside a local/dev database.
 *
 * Run manually only: `npx tsx scripts/seed-qa-users.ts`. Refuses to run when NODE_ENV=production.
 */
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("seed-qa-users: recusado — NODE_ENV=production. Este script e so para ambiente local/dev.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword("qa12345678");

  const moderator = await prisma.user.upsert({
    where: { email: "moderator-qa@inseries.dev" },
    update: { role: "MODERATOR" },
    create: { name: "QA Moderator", username: "qa_moderator", email: "moderator-qa@inseries.dev", passwordHash, role: "MODERATOR" }
  });

  const user = await prisma.user.upsert({
    where: { email: "user-qa@inseries.dev" },
    update: { role: "USER" },
    create: { name: "QA User", username: "qa_user", email: "user-qa@inseries.dev", passwordHash, role: "USER" }
  });

  console.log(`moderator: ${moderator.email} / qa12345678`);
  console.log(`user: ${user.email} / qa12345678`);
}

main().finally(() => prisma.$disconnect());
