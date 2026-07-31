import { ptBR } from "./pt-BR";
import { contentEngineConfig } from "../../config";

export type ContentEngineDictionary = typeof ptBR;

/** Indexed-by-language dictionary lookup. Only pt-BR exists today (config.language defaults to it); adding a new language means adding a sibling file and a case here — no engine-logic changes. */
const dictionaries: Record<string, ContentEngineDictionary> = {
  "pt-BR": ptBR
};

export function getDictionary(language: string = contentEngineConfig.language): ContentEngineDictionary {
  return dictionaries[language] ?? ptBR;
}

export { ptBR };
