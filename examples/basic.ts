import { createClient } from "../src/index.js";

const main = async (): Promise<void> => {
  const yt = await createClient();

  const video = await yt.getVideo("https://www.youtube.com/watch?v=jNQXAC9IVRw");
  console.log(`${video.title} — ${video.channel.name}`);
  console.log(
    `${video.viewCount?.toLocaleString()} views, ${video.likeCount?.toLocaleString()} likes`,
  );

  const results = await yt.searchAll("effect ts", { type: "video", limit: 5 });
  for (const result of results) {
    console.log(`[${result.type}] ${result.title}`);
  }

  const channel = await yt.getChannel("@veritasium");
  console.log(`${channel.title} — ${channel.subscriberCountText ?? "?"}`);

  const transcript = await yt.getTranscript("jNQXAC9IVRw");
  console.log(`${transcript.segments.length} transcript segments`);
  console.log(transcript.text.slice(0, 200));

  await yt.close();
};

void main();
