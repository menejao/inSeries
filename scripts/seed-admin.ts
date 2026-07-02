import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { hashPassword } from "@/lib/auth/password";

const ADMIN_EMAIL = "admin@inseries.dev";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin12345";

async function main() {
  if (!(await canUseDatabase())) {
    console.error("Seed admin abortado: banco indisponivel. Verifique DATABASE_URL e rode as migrations.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "ADMIN" },
    create: {
      name: "Admin inSeries",
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN"
    }
  });

  console.log(`Admin seedado: ${admin.email} (role=${admin.role}). Senha de desenvolvimento: ${ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Falha no seed admin.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
