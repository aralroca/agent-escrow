const HEX = 16;

export function toHex(bytes: ArrayLike<number>): string {
  return Array.from(bytes, (byte) => byte.toString(HEX).padStart(2, '0')).join('');
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return toHex(await sha256(bytes));
}
