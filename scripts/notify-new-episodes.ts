import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { generateNewEpisodeAvailableNotifications } from "@/lib/notifications/episode-availability";

async function main() {
  if (!(await canUseDatabase())) {
    console.error("Abortado: banco indisponivel. Verifique DATABASE_URL e rode as migrations.");
    process.exitCode = 1;
    return;
  }

  const created = await generateNewEpisodeAvailableNotifications();
  console.log(`Notificacoes de novos episodios geradas: ${created}.`);
}

main()
  .catch((error) => {
    console.error("Falha ao gerar notificacoes de episodios disponiveis.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
