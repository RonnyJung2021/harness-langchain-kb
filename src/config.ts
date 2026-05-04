import "dotenv/config";

/** 方舟 OpenAI 兼容接口默认 Base URL（北京区域）。 */
export const DEFAULT_ARK_BASE_URL =
  "https://ark.cn-beijing.volces.com/api/v3";

export type ArkConfig = {
  readonly apiKey: string;
  readonly baseURL: string;
  readonly chatModel: string;
  readonly embedModel: string;
};

function requireNonEmptyEnv(name: string): string {
  const raw = process.env[name];
  if (raw === undefined) {
    throw new Error(
      `缺少环境变量 ${name}：请在仓库根目录复制 .env.example 为 .env，并填写方舟控制台「API 接入」中的对应值。`,
    );
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new Error(
      `环境变量 ${name} 不能为空：请在 .env 中为该项填写非空字符串。`,
    );
  }
  return trimmed;
}

function resolveBaseURL(): string {
  const raw = process.env.ARK_BASE_URL;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_ARK_BASE_URL;
  }
  return raw.trim();
}

let cached: ArkConfig | null = null;

/**
 * 读取方舟（OpenAI 兼容）相关配置：API Key、Base URL、对话与向量模型 ID。
 * 首次调用时校验必填项；结果会缓存。
 */
export function getArkConfig(): ArkConfig {
  if (cached) {
    return cached;
  }
  cached = Object.freeze({
    apiKey: requireNonEmptyEnv("ARK_API_KEY"),
    baseURL: resolveBaseURL(),
    chatModel: requireNonEmptyEnv("ARK_CHAT_MODEL"),
    embedModel: requireNonEmptyEnv("ARK_EMBED_MODEL"),
  });
  return cached;
}
