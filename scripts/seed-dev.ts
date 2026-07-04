import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { seedInitialSystemSettings } from "@/lib/system-settings/service";

type EpisodeSeed = {
  number: number;
  title: string;
  overview: string;
  runtimeMinutes: number;
  airedAt: string;
  stillUrl?: string;
};

type SeasonSeed = {
  number: number;
  title: string;
  airYear: number;
  posterUrl?: string;
  episodes: EpisodeSeed[];
};

type SeriesSeed = {
  slug: string;
  title: string;
  originalTitle: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  firstAirYear: number;
  language: string;
  network: string;
  genres: string[];
  status: "RETURNING" | "ENDED" | "CANCELED" | "IN_PRODUCTION" | "PILOT";
  popularityScore: number;
  voteAverage: number | null;
  seasons: SeasonSeed[];
};

function buildEpisodes(seasonNumber: number, stillUrl?: string): EpisodeSeed[] {
  return Array.from({ length: 5 }, (_, index) => {
    const number = index + 1;
    return {
      number,
      title: `Temporada ${seasonNumber} Episodio ${number}`,
      overview: `Sinopse local de teste para o episodio ${number} da temporada ${seasonNumber}.`,
      runtimeMinutes: 42,
      airedAt: `20${20 + seasonNumber}-0${number}-15`,
      stillUrl
    };
  });
}

function relativeDate(offsetDays: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

function buildRelativeEpisodes(seasonNumber: number, offsets: number[], stillUrl?: string): EpisodeSeed[] {
  return offsets.map((offsetDays, index) => {
    const number = index + 1;
    return {
      number,
      title: `Temporada ${seasonNumber} Episodio ${number}`,
      overview: `Episodio de calendario de teste (offset ${offsetDays} dia(s) a partir de hoje).`,
      runtimeMinutes: 42,
      airedAt: relativeDate(offsetDays),
      stillUrl
    };
  });
}

const nextYear = new Date().getFullYear() + 1;

/**
 * Fase 10 (INSERIES-CINEMATIC-EXPERIENCE-FOUNDATION-01) — posters/backdrops/stills reais do
 * TMDb exigem acesso de rede que este sandbox nao possui (ver README, secao "Estrategia visual").
 * Estes SVGs gerados localmente (scripts/generate-dev-media.mjs, publicos em /dev-media) substituem
 * as fotos reais so no dataset de desenvolvimento, para que Hero/carrosseis/cards tenham imagem de
 * verdade para renderizar. Em producao, lib/tmdb/lib/catalog/normalize.ts preenchem os mesmos campos
 * (posterUrl/backdropUrl/stillUrl) com fotos reais via sync — nenhum componente sabe a diferenca.
 */
const DEV_MEDIA = "/dev-media";

const seriesSeeds: SeriesSeed[] = [
  {
    slug: "serie-teste-um",
    title: "Serie Teste Um",
    originalTitle: "Test Series One",
    overview: "Serie fixa de desenvolvimento usada para validar persistencia sem depender do TMDb.",
    posterUrl: `${DEV_MEDIA}/serie-teste-um-poster.svg`,
    backdropUrl: `${DEV_MEDIA}/serie-teste-um-backdrop.svg`,
    firstAirYear: 2021,
    language: "pt-BR",
    network: "inSeries Dev",
    genres: ["Drama", "Teste"],
    status: "RETURNING",
    popularityScore: 90,
    voteAverage: 8.5,
    seasons: [
      {
        number: 1,
        title: "Temporada 1",
        airYear: 2021,
        posterUrl: `${DEV_MEDIA}/serie-teste-um-poster.svg`,
        episodes: buildEpisodes(1, `${DEV_MEDIA}/serie-teste-um-s1-still.svg`)
      },
      {
        number: 2,
        title: "Temporada 2",
        airYear: 2022,
        posterUrl: `${DEV_MEDIA}/serie-teste-um-poster.svg`,
        episodes: buildEpisodes(2, `${DEV_MEDIA}/serie-teste-um-s2-still.svg`)
      },
      {
        number: 3,
        title: "Temporada 3",
        airYear: new Date().getFullYear(),
        posterUrl: `${DEV_MEDIA}/serie-teste-um-poster.svg`,
        episodes: buildRelativeEpisodes(3, [0, 3, 20], `${DEV_MEDIA}/serie-teste-um-s3-still.svg`)
      },
      { number: 4, title: "Temporada 4", airYear: nextYear, posterUrl: `${DEV_MEDIA}/serie-teste-um-poster.svg`, episodes: [] }
    ]
  },
  {
    slug: "serie-teste-dois",
    title: "Serie Teste Dois",
    originalTitle: "Test Series Two",
    overview: "Segunda serie fixa de desenvolvimento, usada para validar catalogo e progresso.",
    posterUrl: `${DEV_MEDIA}/serie-teste-dois-poster.svg`,
    backdropUrl: `${DEV_MEDIA}/serie-teste-dois-backdrop.svg`,
    firstAirYear: 2019,
    language: "pt-BR",
    network: "inSeries Dev",
    genres: ["Comedia", "Teste"],
    status: "ENDED",
    popularityScore: 75,
    voteAverage: 6.0,
    seasons: [
      {
        number: 1,
        title: "Temporada 1",
        airYear: 2019,
        posterUrl: `${DEV_MEDIA}/serie-teste-dois-poster.svg`,
        episodes: buildEpisodes(1, `${DEV_MEDIA}/serie-teste-dois-s1-still.svg`)
      },
      {
        number: 2,
        title: "Temporada 2",
        airYear: 2020,
        posterUrl: `${DEV_MEDIA}/serie-teste-dois-poster.svg`,
        episodes: buildEpisodes(2, `${DEV_MEDIA}/serie-teste-dois-s2-still.svg`)
      }
    ]
  },
  {
    slug: "serie-teste-tres",
    title: "Serie Teste Tres",
    originalTitle: "Test Series Three",
    overview: "Terceira serie fixa de desenvolvimento, cancelada apos uma temporada, usada para variar status/genero/ano nos filtros.",
    posterUrl: `${DEV_MEDIA}/serie-teste-tres-poster.svg`,
    backdropUrl: `${DEV_MEDIA}/serie-teste-tres-backdrop.svg`,
    firstAirYear: 2016,
    language: "pt-BR",
    network: "inSeries Dev",
    genres: ["Mystery", "Teste"],
    status: "CANCELED",
    popularityScore: 60,
    voteAverage: 4.2,
    seasons: [
      {
        number: 1,
        title: "Temporada 1",
        airYear: 2016,
        posterUrl: `${DEV_MEDIA}/serie-teste-tres-poster.svg`,
        episodes: buildEpisodes(1, `${DEV_MEDIA}/serie-teste-tres-s1-still.svg`)
      }
    ]
  },
  {
    slug: "serie-teste-quatro",
    title: "Serie Teste Quatro",
    originalTitle: "Test Series Four",
    overview: "Quarta serie fixa de desenvolvimento, ainda em producao, sem episodios lancados nem nota ainda.",
    posterUrl: `${DEV_MEDIA}/serie-teste-quatro-poster.svg`,
    backdropUrl: `${DEV_MEDIA}/serie-teste-quatro-backdrop.svg`,
    firstAirYear: nextYear,
    language: "pt-BR",
    network: "inSeries Dev",
    genres: ["Sci-Fi", "Teste"],
    status: "IN_PRODUCTION",
    popularityScore: 40,
    voteAverage: null,
    seasons: []
  },
  {
    slug: "serie-teste-cinco",
    title: "Serie Teste Cinco",
    originalTitle: "Test Series Five",
    overview: "Quinta serie fixa de desenvolvimento, piloto anunciado, usada para validar series futuras nos filtros.",
    posterUrl: `${DEV_MEDIA}/serie-teste-cinco-poster.svg`,
    backdropUrl: `${DEV_MEDIA}/serie-teste-cinco-backdrop.svg`,
    firstAirYear: nextYear,
    language: "pt-BR",
    network: "inSeries Dev",
    genres: ["Action & Adventure", "Teste"],
    status: "PILOT",
    popularityScore: 20,
    voteAverage: 7.8,
    seasons: []
  }
];

async function seedSeries(seed: SeriesSeed) {
  const series = await prisma.series.upsert({
    where: { slug: seed.slug },
    update: {
      title: seed.title,
      originalTitle: seed.originalTitle,
      overview: seed.overview,
      posterUrl: seed.posterUrl || null,
      backdropUrl: seed.backdropUrl || null,
      firstAirYear: seed.firstAirYear,
      language: seed.language,
      network: seed.network,
      genres: seed.genres,
      status: seed.status,
      popularityScore: seed.popularityScore,
      voteAverage: seed.voteAverage
    },
    create: {
      slug: seed.slug,
      title: seed.title,
      originalTitle: seed.originalTitle,
      overview: seed.overview,
      posterUrl: seed.posterUrl || null,
      backdropUrl: seed.backdropUrl || null,
      firstAirYear: seed.firstAirYear,
      language: seed.language,
      network: seed.network,
      genres: seed.genres,
      status: seed.status,
      popularityScore: seed.popularityScore,
      voteAverage: seed.voteAverage
    }
  });

  for (const season of seed.seasons) {
    const seasonRow = await prisma.season.upsert({
      where: { seriesId_number: { seriesId: series.id, number: season.number } },
      update: {
        title: season.title,
        airYear: season.airYear,
        posterUrl: season.posterUrl || null,
        episodeCount: season.episodes.length
      },
      create: {
        seriesId: series.id,
        number: season.number,
        title: season.title,
        airYear: season.airYear,
        posterUrl: season.posterUrl || null,
        episodeCount: season.episodes.length
      }
    });

    for (const episode of season.episodes) {
      await prisma.episode.upsert({
        where: { seasonId_number: { seasonId: seasonRow.id, number: episode.number } },
        update: {
          title: episode.title,
          overview: episode.overview,
          runtimeMinutes: episode.runtimeMinutes,
          airedAt: new Date(episode.airedAt),
          stillUrl: episode.stillUrl || null
        },
        create: {
          seasonId: seasonRow.id,
          number: episode.number,
          title: episode.title,
          overview: episode.overview,
          runtimeMinutes: episode.runtimeMinutes,
          airedAt: new Date(episode.airedAt),
          stillUrl: episode.stillUrl || null
        }
      });
    }
  }

  return series;
}

async function main() {
  if (!(await canUseDatabase())) {
    console.error("Seed dev abortado: banco indisponivel. Verifique DATABASE_URL e rode as migrations.");
    process.exitCode = 1;
    return;
  }

  for (const seed of seriesSeeds) {
    const series = await seedSeries(seed);
    console.log(`Serie seedada: ${series.title} (${series.id})`);
  }

  await seedInitialSystemSettings();
  console.log("Configuracoes iniciais do sistema (SystemSetting) seedadas.");

  console.log(
    "Seed dev concluido: 5 series cobrindo os 5 status do catalogo (RETURNING, ENDED, CANCELED, IN_PRODUCTION, PILOT), anos de 2016 a " +
      `${nextYear}, generos variados, popularidade e nota (voteAverage) diferentes entre si, para exercitar filtros e ordenacao de descoberta. ` +
      "Serie Teste Um mantem pelo menos 2 temporadas e 5 episodios, alem de episodios de hoje/semana/futuro e uma temporada futura sem episodios, para validar o calendario."
  );
}

main()
  .catch((error) => {
    console.error("Falha no seed dev.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
