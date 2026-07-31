import { recordHistory } from "../history";
import type { SocialContent } from "@prisma/client";

export interface MediaResult {
  mediaRef: string | null;
}

/** Extension point for a future real media generator (image/video render service, AI art, etc). */
export interface MediaGenerator {
  generate(content: SocialContent): Promise<MediaResult>;
}

/** Always returns a no-op placeholder reference — no real media is ever produced. */
export class PlaceholderMediaGenerator implements MediaGenerator {
  async generate(content: SocialContent): Promise<MediaResult> {
    const mediaRef = `placeholder://social-automation/${content.id}`;

    await recordHistory({
      action: "MEDIA_GENERATED",
      contentId: content.id,
      detail: { mediaRef, kind: "placeholder" }
    });

    return { mediaRef };
  }
}
