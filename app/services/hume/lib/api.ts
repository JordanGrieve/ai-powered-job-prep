import { env } from "@/app/data/env/server";
import { Hume, HumeClient } from "hume";
import { cacheLife, cacheTag } from "next/cache";
import { getHumeChatTag } from "./cacheTags";

type ReturnChatEvent = Hume.empathicVoice.ReturnChatEvent;

// A single interview is a bounded conversation, but this drains an
// auto-paginating iterator with no ceiling. Cap it so a runaway or hostile
// chat cannot build an unbounded Gemini prompt (and bill for it).
const MAX_CHAT_EVENTS = 2000;

export async function fetchChatMessages(humeChatId: string) {
  "use cache";
  cacheTag(getHumeChatTag(humeChatId));
  // Short-lived: a transcript fetched during the post-disconnect race may be
  // incomplete, and this is also explicitly revalidated before feedback runs.
  cacheLife("minutes");

  const client = new HumeClient({ apiKey: env.HUME_API_KEY });
  const allChatEvents: ReturnChatEvent[] = [];
  const chatEventsIterator = await client.empathicVoice.chats.listChatEvents(
    humeChatId,
    { pageNumber: 0, pageSize: 100 },
  );

  for await (const chatEvent of chatEventsIterator) {
    allChatEvents.push(chatEvent);
    if (allChatEvents.length >= MAX_CHAT_EVENTS) break;
  }

  return allChatEvents;
}
