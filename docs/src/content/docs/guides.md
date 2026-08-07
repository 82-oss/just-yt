---
title: Handling errors
label: Errors
description: Recognize expected failures, respond to tagged errors, and keep one unavailable resource from hiding successful work.
group: Core Concepts
order: 4
---

A request can fail even when your code is correct. A video may be deleted, a
caption track may not exist, the network may time out, or YouTube may change an
undocumented response. Good error handling tells these situations apart.

## Start with one try and catch

JavaScript sends a rejected Promise to `catch`:

```ts
try {
  const transcript = await yt.transcript(videoId);
  console.log(transcript.data);
} catch (error) {
  console.error('Could not read the transcript', error);
}
```

That is enough for a small script. An application often needs a more specific
response, so `just-yt` exports tagged error classes.

## Match the errors you can handle

```ts
import {
  ExtractionError,
  NetworkError,
  NotFoundError,
  UnavailableError,
} from 'just-yt';

try {
  return await yt.transcript(videoId, { language: 'en' });
} catch (error) {
  if (error instanceof NotFoundError) {
    return null;
  }

  if (error instanceof UnavailableError) {
    console.warn(error.status, error.reason);
    return null;
  }

  if (error instanceof NetworkError) {
    console.error('Network request failed:', error.url);
  }

  if (error instanceof ExtractionError) {
    console.error('Response changed near:', error.path);
  }

  throw error;
}
```

Only return a fallback when it makes sense for your program. The final
`throw error` preserves failures this function does not know how to handle.

## What the tags mean

| Error | Meaning | A common response |
| --- | --- | --- |
| `NotFoundError` | The requested ID or transcript track was not found. | Show “not found” or skip the item. |
| `UnavailableError` | A video exists but YouTube will not serve it to this anonymous client. | Show the supplied reason when appropriate. |
| `NetworkError` | A request could not reach YouTube or its body could not be read. | Retry later or report temporary failure. |
| `InnertubeError` | YouTube returned a non-success HTTP status. | Log the endpoint and status. |
| `ExtractionError` | The response shape did not match what this SDK understands. | Report it as possible parser drift. |
| `SessionError` | The shared session could not be established. | Check configuration and upstream access. |

## Bulk methods capture item failures

`videos()`, `channels()`, and `transcripts()` return one result for every input.
One bad target does not reject or cancel the rest:

```ts
const results = await yt.videos(videoIds);

for (const result of results) {
  if (result.ok) {
    console.log(result.value.title);
  } else {
    console.warn(result.target, result.error._tag);
  }
}
```

The overall call can still reject when shared infrastructure, such as session
creation, cannot run. This is the difference between “one item failed” and
“the job could not start.”
