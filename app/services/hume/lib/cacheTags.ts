/**
 * Cache tag for a fetched Hume chat transcript.
 *
 * fetchChatMessages was the only `"use cache"` function in the repo with no
 * cacheTag at all, so its entries had no invalidation handle. That matters
 * because the interview page is navigated to the moment the voice socket
 * closes - if Hume has not yet flushed the tail of the chat, the truncated
 * transcript is what gets cached, displayed, AND fed to feedback generation,
 * and the resulting feedback is written to the database permanently.
 */
export function getHumeChatTag(humeChatId: string) {
  return `hume-chat-${humeChatId}` as const;
}
