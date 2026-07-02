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
  voteAverage: number | null;
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

const nextYear = new Date().getFullYear() + 1;

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
    voteAverage: 8.5,
    seasons: [
      { number: 1, title: "Temporada 1", airYear: 2021, episodes: buildEpisodes(1) },
      { number: 2, title: "Temporada 2", airYear: 2022, episodes: buildEpisodes(2) },
      { number: 3, title: "Temporada 3", airYear: new Date().getFullYear(), episodes: buildRelativeEpisodes(3, [0, 3, 20]) },
      { number: 4, title: "Temporada 4", airYear: nextYear, episodes: [] }
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
    voteAverage: 6.0,
    seasons: [
      { number: 1, title: "Temporada 1", airYear: 2019, episodes: buildEpisodes(1) },
      { number: 2, title: "Temporada 2", airYear: 2020, episodes: buildEpisodes(2) }
    ]
  },
  {
    slug: "serie-teste-tres",
    title: "Serie Teste Tres",
    originalTitle: "Test Series Three",
    overview: "Terceira serie fixa de desenvolvimento, cancelada apos uma temporada, usada para variar status/genero/ano nos filtros.",
    posterUrl: "",
    backdropUrl: "",
    firstAirYear: 2016,
    language: "pt-BR",
    network: "inSeries Dev",
    genres: ["Mystery", "Teste"],
    status: "CANCELED",
    popularityScore: 60,
    voteAverage: 4.2,
    seasons: [{ number: 1, title: "Temporada 1", airYear: 2016, episodes: buildEpisodes(1) }]
  },
  {
    slug: "serie-teste-quatro",
    title: "Serie Teste Quatro",
    originalTitle: "Test Series Four",
    overview: "Quarta serie fixa de desenvolvimento, ainda em producao, sem episodios lancados nem nota ainda.",
    posterUrl: "",
    backdropUrl: "",
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
    posterUrl: "",
    backdropUrl: "",
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
