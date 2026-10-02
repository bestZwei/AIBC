/**
 * AI 文本生成供应商适配接口。新增供应商（OpenAI/Azure/...）只需实现本接口并在工厂注册。
 */
export interface GenerateTextOptions {
  /** 系统提示词。 */
  system: string;
  /** 用户提示词。 */
  prompt: string;
  /** 覆盖默认模型。 */
  model?: string;
  /** 覆盖默认最大 token。 */
  maxTokens?: number;
  /** 覆盖默认温度。 */
  temperature?: number;
  signal?: AbortSignal;
}

export interface AiProvider {
  readonly id: string;
  /** 生成一段文本，返回去除首尾空白的纯文本。 */
  generateText(options: GenerateTextOptions): Promise<string>;
}
