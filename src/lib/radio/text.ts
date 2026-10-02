/**
 * 文本分块工具（isomorphic）。客户端在调用 TTS 前把长文本切成适合合成的块。
 */

/**
 * 将文本按最大长度切块，优先在句子结束处断开，其次在逗号处。
 * @param text 完整文本
 * @param maxChunkSize 单块最大字符数
 */
export function chunkText(text: string, maxChunkSize = 800): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChunkSize) return [trimmed];

  const chunks: string[] = [];
  let start = 0;

  while (start < trimmed.length) {
    let end = start + maxChunkSize;

    if (end >= trimmed.length) {
      chunks.push(trimmed.slice(start).trim());
      break;
    }

    const window = trimmed.slice(end - 20, end + 20);
    const sentenceEnd = window.search(/[.!?。！？]/);
    if (sentenceEnd !== -1) {
      end = end - 20 + sentenceEnd + 1;
    } else {
      const commaPos = window.search(/[,，、;；]/);
      if (commaPos !== -1) {
        end = end - 20 + commaPos + 1;
      }
    }

    const piece = trimmed.slice(start, end).trim();
    if (piece) chunks.push(piece);
    start = end;
  }

  return chunks;
}
