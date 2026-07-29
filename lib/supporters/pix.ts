/**
 * INSERIES-SUPPORTER-SYSTEM-01 — builds a PIX "BR Code" (the standard EMV-based payload every
 * Brazilian bank app reads for "Copia e Cola" / QR code payments), per the Banco Central spec.
 * Pure string building + a CRC16-CCITT checksum — no external PIX SDK, no network call, no
 * dependency. Every field is TLV-encoded: 2-digit id + 2-digit length + value.
 */
function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC16-CCITT (polynomial 0x1021, initial value 0xFFFF) — the exact variant the PIX spec requires. */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Strips accents/diacritics and anything outside the PIX spec's allowed alphanumeric+space charset, since merchant name/city must be plain ASCII. */
function sanitize(value: string, maxLength: number): string {
  const ascii = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .trim();
  return ascii.slice(0, maxLength);
}

export type PixPayloadInput = {
  pixKey: string;
  receiverName: string;
  receiverCity: string;
  /** In BRL, e.g. 10.5 — omit for a payer-entered amount (not used today, every suggested value is fixed, but the field supports it). */
  amount?: number;
  /** Reference id shown back to the payer's bank app and used to reconcile the contribution — SupporterContribution.pixTxId, max 25 chars, alphanumeric. */
  txId: string;
};

export function buildPixPayload(input: PixPayloadInput): string {
  const merchantAccountInfo = tlv("00", "br.gov.bcb.pix") + tlv("01", input.pixKey);
  const additionalData = tlv("05", input.txId.slice(0, 25) || "***");

  const fields = [
    tlv("00", "01"), // Payload Format Indicator
    tlv("26", merchantAccountInfo), // Merchant Account Information — PIX
    tlv("52", "0000"), // Merchant Category Code
    tlv("53", "986"), // Transaction Currency — BRL
    ...(input.amount ? [tlv("54", input.amount.toFixed(2))] : []),
    tlv("58", "BR"), // Country Code
    tlv("59", sanitize(input.receiverName, 25) || "INSERIES"), // Merchant Name
    tlv("60", sanitize(input.receiverCity, 15) || "SAO PAULO"), // Merchant City
    tlv("62", additionalData) // Additional Data Field Template
  ].join("");

  const withCrcPlaceholder = `${fields}6304`;
  return `${withCrcPlaceholder}${crc16(withCrcPlaceholder)}`;
}

/** A short, unique, alphanumeric reference id for a new contribution — becomes SupporterContribution.pixTxId and the PIX payload's txid. */
export function generatePixTxId(): string {
  return `INS${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
