import type { TranscriptSegment } from "../../domain.js";
import { getArray, getNumber, getString, isObject } from "../json.js";

/**
 * Transcripts are read from the timed-text endpoint referenced by the player
 * response, not from Innertube's `/get_transcript`.
 *
 * `/get_transcript` now answers `FAILED_PRECONDITION` for anonymous sessions
 * regardless of context, while the `baseUrl` on each caption track still serves
 * the full transcript. The URLs are signed and short-lived, so they are fetched
 * immediately rather than cached.
 */

/** Rewrites a caption `baseUrl` to request the JSON transcript format. */
export const timedTextUrl = (baseUrl: string, translateTo?: string): URL => {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", "json3");
  if (translateTo !== undefined) url.searchParams.set("tlang", translateTo);
  return url;
};

const fromJson3 = (payload: unknown): ReadonlyArray<TranscriptSegment> =>
  getArray(payload, "events").flatMap((event) => {
    const segs = getArray(event, "segs");
    if (segs.length === 0) return [];

    const text = segs
      .map((seg) => getString(seg, "utf8") ?? "")
      .join("")
      .trim();

    if (text.length === 0) return [];

    const startMs = getNumber(event, "tStartMs") ?? 0;
    const durationMs = getNumber(event, "dDurationMs") ?? 0;

    return [
      {
        startMs,
        endMs: startMs + durationMs,
        startSeconds: startMs / 1_000,
        endSeconds: (startMs + durationMs) / 1_000,
        text,
      },
    ];
  });

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

const decodeXmlText = (value: string): string =>
  value
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&[a-z]+;|&#39;/gi, (entity) => XML_ENTITIES[entity] ?? entity)
    .trim();

/**
 * Parses the legacy `srv3`/XML transcript format.
 *
 * Some caption tracks ignore `fmt=json3` and answer with XML anyway, so both
 * formats have to be understood.
 */
const fromXml = (payload: string): ReadonlyArray<TranscriptSegment> => {
  const matches = payload.matchAll(
    /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g,
  );

  return Array.from(matches).flatMap((match) => {
    const text = decodeXmlText(match[3]);
    if (text.length === 0) return [];

    const startMs = Number(match[1]);
    const durationMs = match[2] === undefined ? 0 : Number(match[2]);

    return [
      {
        startMs,
        endMs: startMs + durationMs,
        startSeconds: startMs / 1_000,
        endSeconds: (startMs + durationMs) / 1_000,
        text,
      },
    ];
  });
};

/** Parses a timed-text response in whichever format it arrived. */
export const parseTimedText = (
  payload: string,
): ReadonlyArray<TranscriptSegment> => {
  const trimmed = payload.trimStart();

  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isObject(parsed)) return fromJson3(parsed);
    } catch {
      return [];
    }
  }

  return fromXml(payload);
};
