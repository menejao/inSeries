import type { Series, UserProfile } from "@/lib/types";

export const mockSeries: Series[] = [
  {
    id: "ruptura",
    slug: "ruptura",
    title: "Ruptura",
    originalTitle: "Severance",
    year: 2022,
    status: "Returning",
    overview: "Funcionarios dividem memorias entre vida pessoal e trabalho. Controle racha quando segredos vazam.",
    genres: ["Sci-Fi", "Thriller"],
    language: "EN",
    platform: "Apple TV+",
    popularity: "Alta",
    posterUrl: "https://image.tmdb.org/t/p/w500/6qYVd137TL3n6tC9D1dV5M5QJ9k.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/original/2meX1nMdScFOoV4370rqHWKmXhY.jpg",
    userState: "WATCHING",
    seasons: [
      {
        id: "ruptura-s1",
        number: 1,
        title: "Temporada 1",
        year: 2022,
        episodeCount: 9,
        posterUrl: "https://image.tmdb.org/t/p/w500/6qYVd137TL3n6tC9D1dV5M5QJ9k.jpg",
        episodes: [
          {
            id: "ruptura-s1e1",
            number: 1,
            title: "Boas noticias sobre inferno",
            overview: "Mark recebe nova colega e rotina de Lumon balanca.",
            runtimeMinutes: 57,
            airedOn: "2022-02-18",
            watched: true
          },
          {
            id: "ruptura-s1e2",
            number: 2,
            title: "Meia alca",
            overview: "Helly resiste enquanto equipe tenta conter crise.",
            runtimeMinutes: 46,
            airedOn: "2022-02-18",
            watched: true
          },
          {
            id: "ruptura-s1e3",
            number: 3,
            title: "Em perpetuidade",
            overview: "Segredos corporativos aparecem no subterraneo.",
            runtimeMinutes: 56,
            airedOn: "2022-02-25",
            watched: false
          }
        ]
      }
    ]
  },
  {
    id: "the-bear",
    slug: "the-bear",
    title: "The Bear",
    originalTitle: "The Bear",
    year: 2022,
    status: "Returning",
    overview: "Chef premiado tenta salvar restaurante familiar em caos constante.",
    genres: ["Drama", "Comedy"],
    language: "EN",
    platform: "Disney+",
    popularity: "Alta",
    posterUrl: "https://image.tmdb.org/t/p/w500/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/original/wAU8L9WQzP4V9dYf0J2mVwG0Q5w.jpg",
    userState: "WANT_TO_WATCH",
    seasons: [
      {
        id: "the-bear-s1",
        number: 1,
        title: "Temporada 1",
        year: 2022,
        episodeCount: 8,
        posterUrl: "https://image.tmdb.org/t/p/w500/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg",
        episodes: []
      }
    ]
  },
  {
    id: "dark",
    slug: "dark",
    title: "Dark",
    originalTitle: "Dark",
    year: 2017,
    status: "Ended",
    overview: "Desaparecimentos em cidade pequena revelam rede temporal de familias.",
    genres: ["Mystery", "Drama"],
    language: "DE",
    platform: "Netflix",
    popularity: "Media",
    posterUrl: "https://image.tmdb.org/t/p/w500/5Lo5JTWd6hJPd3eCw0UXL1bD6pJ.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/original/3lBDg3i6nn5R7ttT0uc2R0f9Zb9.jpg",
    userState: "COMPLETED",
    seasons: []
  }
];

export const mockProfile: UserProfile = {
  name: "Joao Benedito",
  username: "jbenedito",
  bio: "Series first. Reviews curtas, listas longas, paranoia por cliffhanger.",
  avatarUrl: "JB",
  followers: 128,
  following: 94,
  publicSeriesCount: 63,
  listsCount: 12,
  reviewsCount: 24
};
