import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { recordAdminAudit } from "@/lib/admin/audit";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { describeMediaStorageConfig } from "@/packages/social-automation/src/config";
import { getImageHostingService } from "@/packages/social-automation/src/media-hosting";
import { maskText } from "@/packages/social-automation/src/publisher/utils/mask";

/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — health check da hospedagem publica de midia.
 *
 * GET  -> checagem NAO destrutiva: confere configuracao + acesso de leitura ao prefixo. Nada e
 *         enviado, nada e apagado. Seguro de chamar a qualquer momento.
 * POST -> teste destrutivo EXPLICITO (`{"write": true}`): envia um PNG 1x1 sob `<prefixo>_health/`
 *         e o apaga em seguida. So acontece quando um admin pede.
 *
 * O JSON de resposta nunca carrega o token nem qualquer URL assinada: `describeMediaStorageConfig()`
 * devolve apenas booleanos/contagens, e `HostingHealth.error` ja sai mascarado do pacote.
 */
async function readHealth(write: boolean) {
  const config = describeMediaStorageConfig();
  const health = await getImageHostingService().health(write ? { write: true } : {});

  return {
    ok: health.configured && health.reachable,
    storage: {
      configured: config.configured,
      provider: config.provider,
      prefix: config.prefix,
      retentionHours: config.retentionHours,
      maxBytes: config.maxBytes,
      hasToken: config.hasToken,
      tokenEnvVar: config.tokenEnvVar,
      warning: config.warning
    },
    health: {
      reachable: health.reachable,
      objectCount: health.objectCount,
      writeTested: health.writeTested,
      // Ja mascarado no pacote (maskText) — nunca contem token.
      error: health.error,
      checkedAt: health.checkedAt.toISOString()
    }
  };
}

async function getHandler(request: Request) {
  const admin = await getAdminApiUser("admin.social");
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rateLimit = checkRateLimit("admin", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    // Somente leitura: nenhuma auditoria, pelo mesmo criterio da rota de preview (GET nao audita).
    return NextResponse.json(await readHealth(false));
  } catch (error) {
    return NextResponse.json({ error: "health_check_failed", message: maskText(error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

async function postHandler(request: Request) {
  const admin = await getAdminApiUser("admin.social");
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rateLimit = checkRateLimit("sync", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { write?: unknown };
  const write = body?.write === true;

  try {
    const result = await readHealth(write);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_MEDIA_STORAGE_HEALTH",
      entity: "SocialMediaStorage",
      entityId: null,
      metadata: {
        write,
        provider: result.storage.provider,
        configured: result.storage.configured,
        reachable: result.health.reachable,
        writeTested: result.health.writeTested,
        objectCount: result.health.objectCount
      },
      result: result.ok ? "SUCCESS" : "FAILURE"
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = maskText(error instanceof Error ? error.message : String(error));

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_MEDIA_STORAGE_HEALTH",
      entity: "SocialMediaStorage",
      entityId: null,
      metadata: { write, error: message },
      result: "FAILURE"
    });

    return NextResponse.json({ error: "health_check_failed", message }, { status: 500 });
  }
}

export const GET = withApiObservability("admin.social.media-storage.health", getHandler);
export const POST = withApiObservability("admin.social.media-storage.health.test", postHandler);
