import assert from "node:assert/strict";
import test from "node:test";
import { YouTube } from "../src/index.js";

const VIDEO_ID = "hlSTGypn1dQ";

const playerResponse = {
  playabilityStatus: { status: "OK" },
  videoDetails: { videoId: VIDEO_ID, title: "A transcript" },
  captions: {
    playerCaptionsTracklistRenderer: {
      captionTracks: [
        {
          baseUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}`,
          languageCode: "en",
          name: { simpleText: "English" },
        },
      ],
    },
  },
};

const timedTextResponse = {
  events: [
    {
      tStartMs: 0,
      dDurationMs: 1_000,
      segs: [{ utf8: "This is\nnot" }],
    },
    {
      tStartMs: 1_000,
      dDurationMs: 1_000,
      segs: [{ utf8: "  my   podcast." }],
    },
    {
      tStartMs: 2_000,
      dDurationMs: 1_000,
      segs: [{ utf8: ">> Dallas:\n Welcome   back." }],
    },
  ],
};

const makeYouTube = () =>
  new YouTube({
    generateSessionLocally: true,
    retrieveInnertubeConfig: false,
    retries: 0,
    fetch: async (input) => {
      const url = new URL(input);
      const payload = url.pathname.endsWith("/api/timedtext")
        ? timedTextResponse
        : playerResponse;
      return Response.json(payload);
    },
  });

test("non-segmented transcript is one normalized paragraph", async () => {
  const youtube = makeYouTube();

  try {
    const transcript = await youtube.transcript(VIDEO_ID);

    assert.equal(
      transcript.data,
      "This is not my podcast. Dallas: Welcome back.",
    );
    assert.equal(/\r|\n/.test(transcript.data), false);
  } finally {
    await youtube.close();
  }
});

test("segmented transcript retains its segment boundaries", async () => {
  const youtube = makeYouTube();

  try {
    const transcript = await youtube.transcript(VIDEO_ID, { segmented: true });

    assert.deepEqual(
      transcript.data.map(({ start, end, text }) => ({ start, end, text })),
      [
        { start: 0, end: 1, text: "This is not" },
        { start: 1, end: 2, text: "my podcast." },
        { start: 2, end: 3, text: "Dallas: Welcome back." },
      ],
    );
  } finally {
    await youtube.close();
  }
});
