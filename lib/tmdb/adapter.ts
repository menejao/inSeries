import { TmdbConfigurationError } from "@/lib/tmdb/service";
import { listCatalogSeries } from "@/lib/catalog/repository";
import { searchExternalSeries } from "@/lib/catalog/repository";

export type CatalogProvider = {
  listSeries: (query?: string) => Promise<Awaited<ReturnType<typeof listCatalogSeries>>>;
  searchExternal: (query: string) => Promise<Awaited<ReturnType<typeof searchExternalSeries>>>;
};

export class TmdbCatalogAdapter implements CatalogProvider {
  async listSeries(query?: string) {
    return listCatalogSeries(query);
  }

  async searchExternal(query: string) {
    try {
      return await searchExternalSeries(query);
    } catch (error) {
      if (error instanceof TmdbConfigurationError) {
        return [];
      }

      throw error;
    }
  }
}

export const catalogProvider = new TmdbCatalogAdapter();
