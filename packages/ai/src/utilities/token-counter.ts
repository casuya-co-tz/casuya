const AVERAGE_CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / AVERAGE_CHARS_PER_TOKEN);
}

export function estimateCost(tokenCount: number, costPer1KTokens: number): number {
  return (tokenCount / 1000) * costPer1KTokens;
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * AVERAGE_CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '...';
}

export function countMessages(messages: { content: string }[]): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
}

export function estimateChatTokens(messages: { role: string; content: string }[]): number {
  const overheadPerMessage = 4;
  const totalContent = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
  const totalOverhead = messages.length * overheadPerMessage;
  return totalContent + totalOverhead;
}
