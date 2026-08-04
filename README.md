# just-yt

A type-safe TypeScript SDK for extracting public data from YouTube without requiring an official YouTube Data API key.

## Status

Early development. The public API and extraction capabilities are still being designed.

## Planned API

```ts
import { Client } from "just-yt";

const youtube = new Client();

const video = await youtube.video("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
const transcript = await youtube.transcript(video.id);
```

Planned capabilities include video metadata, search, transcripts, captions, channels, playlists, and typed extraction errors.

## Development

```bash
pnpm install
pnpm typecheck
pnpm build
```

## License

MIT
