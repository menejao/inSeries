/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — byte-level validation.
 *
 * `contentType` and file extensions are ATTACKER/BUG controlled metadata. Everything here reads the
 * actual buffer: the 8-byte PNG signature, then the IHDR chunk for the real pixel dimensions. No new
 * dependency is needed — a PNG's first chunk is always IHDR at a fixed offset.
 *
 *   0..8    89 50 4E 47 0D 0A 1A 0A   signature
 *   8..12   00 00 00 0D               IHDR length (13)
 *   12..16  49 48 44 52               "IHDR"
 *   16..20  width  (uint32 BE)
 *   20..24  height (uint32 BE)
 *
 * Every failure names exactly which check failed. Nothing is ever silently accepted or coerced.
 */
import { createHash } from "node:crypto";
import { mediaStorageConfig, type MediaStorageConfig } from "../config";
import { MediaHostingError, PNG_CONTENT_TYPE, type MediaAsset, type MediaFormat } from "./types";

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Signature + IHDR length + "IHDR" + width + height. Below this there is nothing to read. */
const MIN_PNG_HEADER_BYTES = 24;

/** Instagram's supported square/portrait canvases — the Template Engine renders exactly these. */
export const EXPECTED_DIMENSIONS: Record<MediaFormat, { width: number; height: number }> = {
  feed: { width: 1080, height: 1080 },
  carousel: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 }
};

export interface PngDimensions {
  width: number;
  height: number;
}

/** sha256 hex of the exact bytes. The identity of an asset. */
export function computeChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function hasPngSignature(buffer: Buffer): boolean {
  return buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

/** Reads IHDR. Assumes the signature was already checked. */
export function readPngDimensions(buffer: Buffer): PngDimensions {
  if (buffer.length < MIN_PNG_HEADER_BYTES) {
    throw new MediaHostingError("validation", `PNG truncado: ${buffer.length} bytes, o cabecalho IHDR exige ao menos ${MIN_PNG_HEADER_BYTES}.`);
  }
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new MediaHostingError("validation", "PNG invalido: o primeiro chunk nao e IHDR — o arquivo nao e um PNG bem formado.");
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export interface ValidatedAsset {
  checksum: string;
  size: number;
  dimensions: PngDimensions;
  contentType: string;
}

/**
 * The single gate every byte passes through before an upload. Order matters: cheapest and most
 * specific first, so the error message points at the real problem.
 */
export function validateAsset(asset: MediaAsset, config: MediaStorageConfig = mediaStorageConfig): ValidatedAsset {
  const { buffer } = asset;

  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new MediaHostingError("validation", `Asset da publicacao "${asset.publicationId}" nao trouxe um Buffer.`);
  }
  if (buffer.length === 0) {
    throw new MediaHostingError("validation", `Asset da publicacao "${asset.publicationId}" esta vazio (0 bytes) — nada foi enviado.`);
  }
  // Declared type is checked too, but only as a cheap early signal: the byte signature below is
  // what actually decides, and a lying contentType must never pass.
  const declared = (asset.contentType ?? PNG_CONTENT_TYPE).toLowerCase();
  if (declared !== PNG_CONTENT_TYPE) {
    throw new MediaHostingError("validation", `contentType "${declared}" nao e suportado — apenas ${PNG_CONTENT_TYPE}.`);
  }
  if (!hasPngSignature(buffer)) {
    throw new MediaHostingError(
      "validation",
      `Assinatura de bytes invalida: os 8 primeiros bytes nao sao a assinatura PNG (recebido ${buffer
        .subarray(0, Math.min(8, buffer.length))
        .toString("hex")}). O contentType declarado foi ignorado de proposito.`
    );
  }
  if (buffer.length > config.maxBytes) {
    throw new MediaHostingError(
      "validation",
      `Arquivo com ${buffer.length} bytes excede o limite de ${config.maxBytes} bytes (SOCIAL_MEDIA_MAX_BYTES).`
    );
  }

  const dimensions = readPngDimensions(buffer);
  const expected = EXPECTED_DIMENSIONS[asset.format];
  if (!expected) {
    throw new MediaHostingError("validation", `Formato "${asset.format}" desconhecido — sem dimensoes esperadas para validar.`);
  }
  if (dimensions.width !== expected.width || dimensions.height !== expected.height) {
    throw new MediaHostingError(
      "validation",
      `Dimensoes ${dimensions.width}x${dimensions.height} nao batem com o formato "${asset.format}" (esperado ${expected.width}x${expected.height}).`
    );
  }

  return { checksum: computeChecksum(buffer), size: buffer.length, dimensions, contentType: PNG_CONTENT_TYPE };
}
