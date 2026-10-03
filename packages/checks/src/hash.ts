const HEX = 16;

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(HEX).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, HEX));
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);

  return toHex(new Uint8Array(digest));
}
