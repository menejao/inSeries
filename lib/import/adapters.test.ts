import { describe, expect, it } from "vitest";
import { parseCsv, detectSeparator, csvSafeCell } from "@/lib/import/csv-parse";
import { parseTvTime, parseImdb, parseLetterboxd, parseInSeriesJson, parseGenericCsv, detectAndParse } from "@/lib/import/adapters";
import { normalizeRating } from "@/lib/import/types";
import { groupItems } from "@/lib/import/matching";

describe("csv-parse", () => {
  it("parses quoted fields with commas and newlines", () => {
    const csv = parseCsv('title,note\n"Breaking, Bad","line1\nline2"\nDark,simple');
    expect(csv.headers).toEqual(["title", "note"]);
    expect(csv.rows[0]).toEqual(["Breaking, Bad", "line1\nline2"]);
    expect(csv.rows[1]).toEqual(["Dark", "simple"]);
  });

  it("detects semicolon separator", () => {
    expect(detectSeparator("a;b;c")).toBe(";");
    expect(detectSeparator("a\tb\tc")).toBe("\t");
    expect(detectSeparator("a,b,c")).toBe(",");
  });

  it("strips BOM", () => {
    const csv = parseCsv("﻿title\nDark");
    expect(csv.headers).toEqual(["title"]);
  });

  it("neutralizes CSV injection on export", () => {
    expect(csvSafeCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
    expect(csvSafeCell("normal")).toBe("normal");
  });
});

describe("normalizeRating", () => {
  it("converts 10-scale to 5-scale", () => {
    expect(normalizeRating(8, "10")).toBe(4);
    expect(normalizeRating(10, "10")).toBe(5);
    expect(normalizeRating(1, "10")).toBe(1);
  });
  it("converts 100-scale and clamps", () => {
    expect(normalizeRating(90, "100")).toBe(5);
    expect(normalizeRating(0, "100")).toBe(1);
  });
});

describe("TV Time adapter", () => {
  const sample = "tv_show_name,episode_season_number,episode_number,created_at\nDark,1,1,2023-05-10\nDark,1,2,2023-05-11\n";

  it("identifies and parses episodes", () => {
    const manifest = parseTvTime(sample, "seen_episode.csv");
    expect(manifest).not.toBeNull();
    expect(manifest!.source).toBe("tvtime");
    expect(manifest!.items).toHaveLength(2);
    expect(manifest!.items[0]).toMatchObject({ mediaType: "episode", title: "Dark", seasonNumber: 1, episodeNumber: 1, watched: true });
    expect(manifest!.items[0].watchedAt).toContain("2023-05-10");
  });

  it("rejects unrelated CSVs", () => {
    expect(parseTvTime("a,b,c\n1,2,3", "x.csv")).toBeNull();
  });
});

describe("IMDb adapter", () => {
  const ratings =
    'Const,Your Rating,Date Rated,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors\ntt0475784,9,2023-01-15,Westworld,url,TV Series,8.5,60,2016,Sci-Fi,500000,2016-10-02,\ntt1375666,8,2023-01-16,Inception,url,Movie,8.8,148,2010,Sci-Fi,2000000,2010-07-16,\n';

  it("parses series ratings and ignores movies with warning", () => {
    const manifest = parseImdb(ratings, "ratings.csv");
    expect(manifest).not.toBeNull();
    expect(manifest!.items).toHaveLength(1);
    expect(manifest!.items[0]).toMatchObject({ mediaType: "series", imdbId: "tt0475784", title: "Westworld", year: 2016, rating: 5, originalRating: 9 });
    expect(manifest!.warnings[0]).toContain("filme");
  });

  it("treats rating-less export as watchlist", () => {
    const watchlist = "Const,Created,Title,Title Type,Year\ntt0475784,2023-01-01,Westworld,TV Series,2016\n";
    const manifest = parseImdb(watchlist, "watchlist.csv");
    expect(manifest!.items[0]).toMatchObject({ watchlist: true, status: "WANT_TO_WATCH" });
  });
});

describe("Letterboxd adapter", () => {
  it("ignores all movie rows with a friendly warning", () => {
    const sample = "Date,Name,Year,Letterboxd URI\n2023-01-01,Inception,2010,https://boxd.it/abc\n";
    const manifest = parseLetterboxd(sample, "watched.csv");
    expect(manifest).not.toBeNull();
    expect(manifest!.items).toHaveLength(0);
    expect(manifest!.warnings[0]).toContain("apenas series");
  });
});

describe("inSeries JSON adapter", () => {
  it("parses the official backup format", () => {
    const backup = JSON.stringify({
      schema_version: 1,
      series: [{ tmdbId: "1396", title: "Breaking Bad", year: 2008, status: "COMPLETED", rating: 5 }],
      episodes: [{ tmdbId: "1396", seasonNumber: 1, episodeNumber: 1, watchedAt: "2020-01-01" }],
      lists: [{ title: "Favoritas", items: [{ tmdbId: "1396", title: "Breaking Bad" }] }]
    });
    const manifest = parseInSeriesJson(backup, "backup.json");
    expect(manifest).not.toBeNull();
    expect(manifest!.items).toHaveLength(3);
    expect(manifest!.items[0]).toMatchObject({ mediaType: "series", tmdbId: "1396", status: "COMPLETED", rating: 5 });
    expect(manifest!.items[1]).toMatchObject({ mediaType: "episode", seasonNumber: 1, episodeNumber: 1, watched: true });
    expect(manifest!.items[2]).toMatchObject({ listName: "Favoritas" });
  });

  it("rejects newer schema versions with a clear error", () => {
    const manifest = parseInSeriesJson(JSON.stringify({ schema_version: 99 }), "backup.json");
    expect(manifest!.errors[0]).toContain("versao 99");
  });

  it("returns null for arbitrary JSON", () => {
    expect(parseInSeriesJson('{"foo": 1}', "x.json")).toBeNull();
  });
});

describe("generic CSV adapter", () => {
  it("maps portuguese column aliases", () => {
    const sample = "Titulo,Ano,Temporada,Episodio,Data assistida,Nota,Status\nDark,2017,1,1,2023-05-10,9,Concluida\n";
    const manifest = parseGenericCsv(sample, "meu.csv");
    expect(manifest).not.toBeNull();
    expect(manifest!.items[0]).toMatchObject({
      mediaType: "episode",
      title: "Dark",
      year: 2017,
      seasonNumber: 1,
      episodeNumber: 1,
      rating: 5,
      status: "COMPLETED"
    });
  });

  it("treats rows without season/episode as series-level", () => {
    const sample = "Titulo,Status\nDark,Assistindo\n";
    const manifest = parseGenericCsv(sample, "meu.csv");
    expect(manifest!.items[0]).toMatchObject({ mediaType: "series", status: "WATCHING" });
  });
});

describe("detectAndParse", () => {
  it("prefers the selected source but falls back on detection", () => {
    const tvtime = "tv_show_name,episode_season_number,episode_number\nDark,1,1\n";
    expect(detectAndParse(tvtime, "x.csv", "tvtime").source).toBe("tvtime");
    expect(detectAndParse(tvtime, "x.csv").source).toBe("tvtime");
  });

  it("returns a friendly error for unrecognized content", () => {
    const result = detectAndParse("random text without structure", "x.txt");
    expect(result.items).toHaveLength(0);
    expect(result.errors[0]).toContain("reconhecer o formato");
  });
});

describe("groupItems (dedup dentro do arquivo)", () => {
  it("groups episodes by series and dedupes repeated S/E", () => {
    const manifest = detectAndParse(
      "tv_show_name,episode_season_number,episode_number,created_at\nDark,1,1,2023-05-10\nDark,1,1,2023-05-12\nDark,1,2,2023-05-11\n",
      "x.csv"
    );
    const groups = groupItems(manifest);
    expect(groups).toHaveLength(1);
    expect(groups[0].episodes).toHaveLength(2);
    // Mantem a data mais antiga do episodio duplicado
    expect(groups[0].episodes.find((episode) => episode.episodeNumber === 1)?.watchedAt).toContain("2023-05-10");
  });

  it("merges rating/status/list into the same series group", () => {
    const manifest = {
      source: "csv",
      fileName: "x",
      warnings: [],
      errors: [],
      items: [
        { mediaType: "series" as const, title: "Dark", rating: 5 },
        { mediaType: "series" as const, title: "Dark", status: "COMPLETED" as const },
        { mediaType: "series" as const, title: "Dark", listName: "Top" },
        { mediaType: "episode" as const, title: "Dark", seasonNumber: 1, episodeNumber: 1, watched: true }
      ]
    };
    const groups = groupItems(manifest);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ rating: 5, status: "COMPLETED", listNames: ["Top"] });
    expect(groups[0].episodes).toHaveLength(1);
  });
});
