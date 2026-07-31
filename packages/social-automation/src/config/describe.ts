import { socialAutomationConfig, contentEngineConfig } from "./index";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — the current configuration paired with the environment variable
 * that controls each value, for the READ-ONLY Configuracoes screen.
 *
 * Why read-only: config/index.ts parses process.env once, through zod, at module load. There is no
 * settings repository in this package and no persistence layer behind these values, so making the
 * screen editable would mean inventing a whole runtime-settings system — new business logic, which
 * this ticket forbids. The screen therefore shows the live values plus the env var to change, and
 * the only mutable setting is the pause flag in settings/index.ts (backed by SystemSetting).
 */

export interface ConfigEntry {
  label: string;
  value: string;
  envVar: string | null;
  note?: string;
}

export interface ConfigGroup {
  title: string;
  entries: ConfigEntry[];
}

const yesNo = (value: boolean) => (value ? "Sim" : "Nao");

export function describeConfig(): ConfigGroup[] {
  return [
    {
      title: "Execucao",
      entries: [
        { label: "Ambiente", value: socialAutomationConfig.environment, envVar: "SOCIAL_AUTOMATION_ENVIRONMENT" },
        { label: "Modo", value: socialAutomationConfig.mode, envVar: "SOCIAL_AUTOMATION_MODE", note: "Somente \"manual\" e executavel hoje." },
        { label: "Nivel de log", value: socialAutomationConfig.logLevel, envVar: "SOCIAL_AUTOMATION_LOG_LEVEL" },
        {
          label: "Publicacao real permitida",
          value: yesNo(socialAutomationConfig.environment === "production"),
          envVar: null,
          note: "Derivado do ambiente — so \"production\" permitiria uma chamada real."
        }
      ]
    },
    {
      title: "Agenda",
      entries: [
        { label: "Horarios", value: socialAutomationConfig.scheduleTimes.join(", "), envVar: "SOCIAL_AUTOMATION_SCHEDULE_TIMES" },
        { label: "Posts por dia (agenda)", value: String(socialAutomationConfig.dailyPostCount), envVar: "SOCIAL_AUTOMATION_DAILY_POST_COUNT" },
        { label: "Posts por dia (content-engine)", value: String(contentEngineConfig.postsPerDay), envVar: "SOCIAL_AUTOMATION_POSTS_PER_DAY" },
        { label: "Redes habilitadas", value: socialAutomationConfig.enabledNetworks.join(", "), envVar: "SOCIAL_AUTOMATION_ENABLED_NETWORKS" }
      ]
    },
    {
      title: "Calendario editorial",
      entries: Object.entries(contentEngineConfig.editorialCalendar).map(([day, format]) => ({
        label: day,
        value: format,
        envVar: "SOCIAL_AUTOMATION_EDITORIAL_CALENDAR"
      }))
    },
    {
      title: "Criterios editoriais",
      entries: [
        { label: "Intervalo anti-repeticao (dias)", value: String(contentEngineConfig.repetitionIntervalDays), envVar: "SOCIAL_AUTOMATION_REPETITION_INTERVAL_DAYS" },
        { label: "Nota minima", value: String(contentEngineConfig.minRating), envVar: "SOCIAL_AUTOMATION_MIN_RATING" },
        { label: "Votos minimos", value: String(contentEngineConfig.minVotes), envVar: "SOCIAL_AUTOMATION_MIN_VOTES" },
        { label: "Popularidade minima", value: String(contentEngineConfig.minPopularity), envVar: "SOCIAL_AUTOMATION_MIN_POPULARITY" },
        { label: "Idade maxima em trending (anos)", value: String(contentEngineConfig.trendingMaxAgeYears), envVar: "SOCIAL_AUTOMATION_TRENDING_MAX_AGE_YEARS" },
        { label: "Recomendacoes por post", value: String(contentEngineConfig.recommendationsPerPost), envVar: "SOCIAL_AUTOMATION_RECOMMENDATIONS_PER_POST" },
        { label: "Tamanho maximo da legenda", value: String(contentEngineConfig.captionMaxLength), envVar: "SOCIAL_AUTOMATION_CAPTION_MAX_LENGTH" },
        { label: "Idioma", value: contentEngineConfig.language, envVar: "SOCIAL_AUTOMATION_LANGUAGE" },
        { label: "Regiao", value: contentEngineConfig.region, envVar: "SOCIAL_AUTOMATION_REGION" },
        {
          label: "Aprovacao obrigatoria",
          value: yesNo(contentEngineConfig.requireApproval),
          envVar: null,
          note: "Fixo em \"Sim\" — nao existe caminho de auto-publicacao neste pacote."
        }
      ]
    }
  ];
}
