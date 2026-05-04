import { OpenAIEmbeddings } from "@langchain/openai";
import type { ArkConfig } from "../config.js";

/** 使用方舟 OpenAI 兼容 Embedding 端点构造 {@link OpenAIEmbeddings}。 */
export function createArkOpenAIEmbeddings(config: ArkConfig) {
  return new OpenAIEmbeddings({
    model: config.embedModel,
    apiKey: config.apiKey,
    configuration: { baseURL: config.baseURL },
  });
}
