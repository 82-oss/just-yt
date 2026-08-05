import {
  ProtoWriter,
  base64ToU8,
  readMessage,
  u8ToBase64,
  u8ToBase64Url,
} from "./proto.js";

/**
 * Encoders for the protobuf-shaped parameters Innertube expects.
 *
 * Field numbers mirror YouTube's own definitions; they are stable in practice
 * but are the first thing to check if filters silently stop applying.
 */

/** `message VisitorData { string id = 1; int32 timestamp = 5; }` */
export const encodeVisitorData = (id: string, timestampSeconds: number): string => {
  const bytes = new ProtoWriter()
    .string(1, id)
    .int32(5, timestampSeconds)
    .finish();
  return encodeURIComponent(u8ToBase64Url(bytes));
};

/** Recovers the 11-character visitor id from an encoded visitor data string. */
export const decodeVisitorId = (visitorData: string): string | undefined => {
  try {
    const fields = readMessage(base64ToU8(decodeURIComponent(visitorData)));
    const id = fields.get(1);
    if (id === undefined || id.wire !== 2) return undefined;
    return new TextDecoder().decode(id.value);
  } catch {
    return undefined;
  }
};

export type SearchType = "video" | "channel" | "playlist" | "movie" | "short";
export type UploadDate = "any" | "hour" | "today" | "week" | "month" | "year";
export type Duration = "any" | "short" | "medium" | "long";
export type SortBy = "relevance" | "rating" | "upload_date" | "view_count";

export type SearchFeature =
  | "hd"
  | "subtitles"
  | "creative_commons"
  | "3d"
  | "live"
  | "purchased"
  | "4k"
  | "360"
  | "location"
  | "hdr"
  | "vr180";

export interface SearchFilters {
  readonly type?: SearchType;
  readonly uploadDate?: UploadDate;
  readonly duration?: Duration;
  readonly sortBy?: SortBy;
  readonly features?: ReadonlyArray<SearchFeature>;
}

const SEARCH_TYPES: Record<SearchType, number> = {
  video: 1,
  channel: 2,
  playlist: 3,
  movie: 4,
  short: 9,
};

const UPLOAD_DATES: Record<Exclude<UploadDate, "any">, number> = {
  hour: 1,
  today: 2,
  week: 3,
  month: 4,
  year: 5,
};

const DURATIONS: Record<Exclude<Duration, "any">, number> = {
  short: 1,
  long: 2,
  medium: 3,
};

const SORT_BY: Record<Exclude<SortBy, "relevance">, number> = {
  rating: 1,
  upload_date: 2,
  view_count: 3,
};

/** Feature flags live on the `Filters` sub-message under these field numbers. */
const FEATURE_FIELDS: Record<SearchFeature, number> = {
  hd: 4,
  subtitles: 5,
  creative_commons: 6,
  "3d": 7,
  live: 8,
  purchased: 9,
  "4k": 14,
  "360": 15,
  location: 23,
  hdr: 25,
  vr180: 26,
};

/**
 * Encodes the `params` value for `/search`.
 *
 * Returns `undefined` when no filter is active, which lets the caller omit the
 * field entirely — sending an empty params string changes YouTube's ranking.
 */
export const encodeSearchFilters = (
  filters: SearchFilters,
): string | undefined => {
  const writer = new ProtoWriter();

  if (filters.sortBy !== undefined && filters.sortBy !== "relevance") {
    writer.int32(1, SORT_BY[filters.sortBy]);
  }

  writer.message(2, (sub) => {
    if (filters.uploadDate !== undefined && filters.uploadDate !== "any") {
      sub.int32(1, UPLOAD_DATES[filters.uploadDate]);
    }
    if (filters.type !== undefined) {
      sub.int32(2, SEARCH_TYPES[filters.type]);
    }
    if (filters.duration !== undefined && filters.duration !== "any") {
      sub.int32(3, DURATIONS[filters.duration]);
    }
    for (const feature of filters.features ?? []) {
      sub.bool(FEATURE_FIELDS[feature], true);
    }
  });

  const bytes = writer.finish();
  if (bytes.length === 0) return undefined;

  return encodeURIComponent(u8ToBase64(bytes));
};

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export const generateRandomString = (length: number): string => {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return result;
};

/** Builds a fresh, locally-generated visitor data string. */
export const generateVisitorData = (): string =>
  encodeVisitorData(generateRandomString(11), Math.floor(Date.now() / 1000));
