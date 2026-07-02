import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";

type EpisodeSeed = {
  number: number;
  title: string;
  overview: string;
  runtimeMinutes: number;
  airedAt: string;
};

type SeasonSeed = {
  number: number;
  title: string;
  airYear: number;
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
  seasons: SeasonSeed[];
};

function buildEpisodes(seasonNumber: number): EpisodeSeed[] {
  return Array.from({ length: 5 }, (_, index) => {
    const number = index + 1;
    return {
      number,
      title: `Temporada ${seasonNumber} Episodio ${number}`,
      overview: `Sinopse local de teste para o episodio ${number} da temporada ${seasonNumber}.`,
      runtimeMinutes: 42,
      airedAt: `20${20 + seasonNumber}-0${number}-15`
    };
  });
}

function relativeDate(offsetDays: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

function buildRelativeEpisodes(seasonNumber: number, offsets: number[]): EpisodeSeed[] {
  return offsets.map((offsetDays, index) => {
    const number = index + 1;
    return {
      number,
      title: `Temporada ${seasonNumber} Episodio ${number}`,
      overview: `Episodio de calendario de teste (offset ${offsetDays} dia(s) a partir de hoje).`,
      runtimeMinutes: 42,
      airedAt: relativeDate(offsetDays)
    };
  });
}

const seriesSeeds: SeriesSeed[] = [
  {
    slug: "serie-teste-um",
    title: "Serie Teste Um",
    originalTitle: "Test Series One",
    overview: "Serie fixa de desenvolvimento usada para validar persistencia sem depender do TMDb.",
    posterUrl: "",
    backdropUrl: "",
    firstAirYear: 2021,
    language: "pt-BR",
    network: "inSeries Dev",
    genres: ["Drama", "Teste"],
    status: "RETURNING",
    popularityScore: 90,
    seasons: [
      { number: 1, title: "Temporada 1", airYear: 2021, episodes: buildEpisodes(1) },
      { number: 2, title: "Temporada 2", airYear: 2022, episodes: buildEpisodes(2) },
      { number: 3, title: "Temporada 3", airYear: new Date().getFullYear(), episodes: buildRelativeEpisodes(3, [0, 3, 20]) },
      { number: 4, title: "Temporada 4", airYear: new Date().getFullYear() + 1, episodes: [] }
    ]
  },
  {
    slug: "serie-teste-dois",
    title: "Serie Teste Dois",
    originalTitle: "Test Series Two",
    overview: "Segunda serie fixa de desenvolvimento, usada para validar catalogo e progresso.",
    posterUrl: "",
    backdropUrl: "",
    firstAirYear: 2019,
    language: "pt-BR",
    network: "inSeries Dev",
    genres: ["Comedia", "Teste"],
    status: "ENDED",
    popularityScore: 75,
    seasons: [
      { number: 1, title: "Temporada 1", airYear: 2019, episodes: buildEpisodes(1) },
      { number: 2, title: "Temporada 2", airYear: 2020, episodes: buildEpisodes(2) }
    ]
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
      popularityScore: seed.popularityScore
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
      popularityScore: seed.popularityScore
    }
  });

  for (const season of seed.seasons) {
    const seasonRow = await prisma.season.upsert({
      where: { seriesId_number: { seriesId: series.id, number: season.number } },
      update: {
        title: season.title,
        airYear: season.airYear,
        episodeCount: season.episodes.length
      },
      create: {
        seriesId: series.id,
        number: season.number,
        title: season.title,
        airYear: season.airYear,
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
          airedAt: new Date(episode.airedAt)
        },
        create: {
          seasonId: seasonRow.id,
          number: episode.number,
          title: episode.title,
          overview: episode.overview,
          runtimeMinutes: episode.runtimeMinutes,
          airedAt: new Date(episode.airedAt)
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

  console.log(
    "Seed dev concluido: 2 series com pelo menos 2 temporadas e 5 episodios cada; Serie Teste Um inclui ainda temporada com episodios de hoje/semana/futuro e uma temporada futura anunciada sem episodios, para validar o calendario."
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
