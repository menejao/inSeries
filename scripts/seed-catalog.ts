import { getTmdbCredentials } from "@/lib/config";
import { canUseDatabase } from "@/lib/db/health";
import { importPopularSeriesToCatalog } from "@/lib/catalog/repository";

async function main() {
  const credentials = getTmdbCredentials();

  if (!credentials.isConfigured) {
    console.log("Seed ignorado: configure TMDB_API_KEY ou TMDB_ACCESS_TOKEN para importar catalogo real.");
    return;
  }

  if (!(await canUseDatabase())) {
    console.log("Seed ignorado: banco indisponivel. Verifique DATABASE_URL e schema aplicado.");
    return;
  }

  await importPopularSeriesToCatalog(1);
  console.log("Seed de catalogo concluido.");
}

main().catch((error) => {
  console.error("Falha no seed de catalogo.");
  console.error(error);
  process.exitCode = 1;
});
