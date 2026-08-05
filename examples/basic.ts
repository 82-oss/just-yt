import { YouTube } from "../src/index.js";

const main = async (): Promise<void> => {
  const yt = new YouTube();

  const video = await yt.video("https://www.youtube.com/watch?v=jNQXAC9IVRw");
  console.log(`${video.title} — ${video.channel.name}`);
  console.log(
    `${video.viewCount?.toLocaleString()} views, ${video.likeCount?.toLocaleString()} likes`,
  );

  const search = await yt.search("effect ts", { type: "video", limit: 5 });
  for (const result of search.results) {
    console.log(`[${result.type}] ${result.title}`);
  }

  const channel = await yt.channel("@veritasium");
  console.log(`${channel.title} — ${channel.subscriberCountText ?? "?"}`);

  const transcript = await yt.transcript("youtu.be/jNQXAC9IVRw");
  console.log(`${transcript.segments.length} transcript segments`);
  console.log(transcript.text.slice(0, 200));

  await yt.close();
};

void main();
