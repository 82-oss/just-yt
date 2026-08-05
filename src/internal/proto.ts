/**
 * A minimal protobuf writer/reader.
 *
 * Innertube takes a handful of parameters as base64-encoded protobuf messages
 * (visitor data, search filters, transcript params). Those messages are small and
 * fixed, so we encode them by hand rather than taking a protobuf runtime
 * dependency.
 */

const WIRE_VARINT = 0;
const WIRE_LENGTH_DELIMITED = 2;

type WireType = typeof WIRE_VARINT | typeof WIRE_LENGTH_DELIMITED;

export class ProtoWriter {
  readonly #bytes: number[] = [];

  #tag(field: number, wire: WireType): this {
    return this.#varint((field << 3) | wire);
  }

  #varint(value: number): this {
    let remaining = value >>> 0;
    while (remaining > 0x7f) {
      this.#bytes.push((remaining & 0x7f) | 0x80);
      remaining >>>= 7;
    }
    this.#bytes.push(remaining);
    return this;
  }

  int32(field: number, value: number | undefined): this {
    if (value === undefined) return this;
    return this.#tag(field, WIRE_VARINT).#varint(value);
  }

  bool(field: number, value: boolean | undefined): this {
    if (value === undefined || value === false) return this;
    return this.int32(field, 1);
  }

  bytes(field: number, value: Uint8Array): this {
    this.#tag(field, WIRE_LENGTH_DELIMITED).#varint(value.length);
    for (const byte of value) this.#bytes.push(byte);
    return this;
  }

  string(field: number, value: string | undefined): this {
    if (value === undefined) return this;
    return this.bytes(field, new TextEncoder().encode(value));
  }

  /** Writes a nested message. The nested message is skipped if it is empty. */
  message(field: number, build: (writer: ProtoWriter) => void): this {
    const nested = new ProtoWriter();
    build(nested);
    const encoded = nested.finish();
    if (encoded.length === 0) return this;
    return this.bytes(field, encoded);
  }

  finish(): Uint8Array {
    return new Uint8Array(this.#bytes);
  }
}

export type ProtoField =
  | { readonly wire: typeof WIRE_VARINT; readonly value: number }
  | { readonly wire: typeof WIRE_LENGTH_DELIMITED; readonly value: Uint8Array };

/**
 * Reads a message into a field-number map. Only the wire types we emit are
 * understood; anything else aborts the read and returns what was parsed so far,
 * since callers only ever look up one or two known fields.
 */
export const readMessage = (
  bytes: Uint8Array,
): ReadonlyMap<number, ProtoField> => {
  const fields = new Map<number, ProtoField>();
  let offset = 0;

  const readVarint = (): number | null => {
    let result = 0;
    let shift = 0;
    while (offset < bytes.length) {
      const byte = bytes[offset++];
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result >>> 0;
      shift += 7;
      if (shift > 28) return null;
    }
    return null;
  };

  while (offset < bytes.length) {
    const tag = readVarint();
    if (tag === null) break;

    const field = tag >>> 3;
    const wire = tag & 0x07;

    if (wire === WIRE_VARINT) {
      const value = readVarint();
      if (value === null) break;
      fields.set(field, { wire: WIRE_VARINT, value });
    } else if (wire === WIRE_LENGTH_DELIMITED) {
      const length = readVarint();
      if (length === null || offset + length > bytes.length) break;
      fields.set(field, {
        wire: WIRE_LENGTH_DELIMITED,
        value: bytes.subarray(offset, offset + length),
      });
      offset += length;
    } else {
      break;
    }
  }

  return fields;
};

export const u8ToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const base64ToU8 = (base64: string): Uint8Array => {
  const standard = base64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = standard.padEnd(
    standard.length + ((4 - (standard.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const u8ToBase64Url = (bytes: Uint8Array): string =>
  u8ToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_");
