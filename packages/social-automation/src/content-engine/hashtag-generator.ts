import { isHashtagSetRepeated, type RecentContentWindow } from "./repetition-guard";

function slugifyTag(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

/** series name + genres + content type + always #inSeries. Avoids reusing the exact same daily set when a non-repeating variant is available. */
export function generateHashtags(window: RecentContentWindow, options: { seriesTitles: string[]; genres: string[]; contentType: string }): string[] {
  const base = new Set<string>();
  base.add("inSeries");

  for (const title of options.seriesTitles) {
    const tag = slugifyTag(title);
    if (tag) base.add(tag);
  }

  for (const genre of options.genres.slice(0, 3)) {
    const tag = slugifyTag(genre);
    if (tag) base.add(tag);
  }

  const typeTag = slugifyTag(options.contentType);
  if (typeTag) base.add(typeTag);

  base.add("series");
  base.add("streaming");

  let hashtags = Array.from(base).map((tag) => `#${tag}`);

  // Avoid an identical daily set: if this exact combination was already used in the window,
  // rotate in one extra generic variant tag so the set differs while staying on-topic.
  if (isHashtagSetRepeated(window, hashtags)) {
    hashtags = [...hashtags, "#recomendacao"];
  }

  return hashtags;
}
