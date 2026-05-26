const { ChatGroq } = require("@langchain/groq");

const apiKeys = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY,
].filter(Boolean);

if (apiKeys.length === 0) {
  console.warn("⚠️ No GROQ API keys found in environment variables.");
}

const DEFAULT_MODEL_MAX_TOKENS = Number(
  process.env.GROQ_DEFAULT_MODEL_MAX_TOKENS || 8192
);
const MODEL_MAX_TOKENS = {
  "llama-3.1-8b-instant": 8192,
  "llama-3.3-70b-versatile": 8192,
  "openai/gpt-oss-20b": 8192,
  "openai/gpt-oss-120b": 8192,
};

const MAX_LLM_CACHE_SIZE = Number(process.env.GROQ_LLM_CACHE_MAX || 100);
const MAX_ATTEMPTS_PER_CONFIG = Math.max(
  1,
  Number(process.env.GROQ_MAX_ATTEMPTS_PER_CONFIG || 2)
);
const BASE_BACKOFF_MS = Number(process.env.GROQ_BACKOFF_BASE_MS || 800);
const RATE_LIMIT_COOLDOWN_MS = Number(
  process.env.GROQ_RATE_LIMIT_COOLDOWN_MS || 1500
);
const REQUEST_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 30000);

const invalidApiKeys = new Set();
const keyCooldowns = new Map();
let keyCursor = 0;

/**
 * -----------------------------------------
 * TOKEN LIMITS PER TASK
 * -----------------------------------------
 */
function getMaxTokens(taskType) {
  switch (taskType) {
    case "bullet-rewrite":
      return 4096;

    case "email":
      return 2048;

    case "resume-analysis":
      return 4096;

    case "career-advice":
      return 8192;

    case "interview-prep":
      return 8192;

    default:
      return 4096;
  }
}

function getClampedMaxTokens(taskType, model) {
  const desired = getMaxTokens(taskType);
  const modelLimit = MODEL_MAX_TOKENS[model] || DEFAULT_MODEL_MAX_TOKENS;
  return Math.min(desired, modelLimit);
}

/**
 * -----------------------------------------
 * MODEL ROUTING
 * -----------------------------------------
 */
function getModelForTask(taskType) {
  switch (taskType) {

    case "email":
      return "llama-3.1-8b-instant";

    case "resume-analysis":
      return "llama-3.3-70b-versatile";

    case "bullet-rewrite":
      return "llama-3.3-70b-versatile";

    case "career-advice":
      return "openai/gpt-oss-20b";

    case "interview-prep":
      return "openai/gpt-oss-20b";

    default:
      return "llama-3.1-8b-instant";
  }
}

/**
 * -----------------------------------------
 * FALLBACK MODEL ORDER
 * -----------------------------------------
 */
const fallbackModels = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
];

/**
 * -----------------------------------------
 * CACHE
 * -----------------------------------------
 */
const llmCache = new Map();

function cacheLlmInstance(cacheKey, instance) {
  if (llmCache.has(cacheKey)) {
    llmCache.delete(cacheKey);
  }
  llmCache.set(cacheKey, instance);
  if (llmCache.size > MAX_LLM_CACHE_SIZE) {
    const oldestKey = llmCache.keys().next().value;
    llmCache.delete(oldestKey);
  }
}

/**
 * -----------------------------------------
 * SLEEP HELPER
 * -----------------------------------------
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOrderedKeys() {
  const now = Date.now();
  const validKeys = apiKeys.filter((key) => !invalidApiKeys.has(key));
  if (validKeys.length === 0) return [];

  const activeKeys = validKeys.filter(
    (key) => (keyCooldowns.get(key) || 0) <= now
  );
  const keysToUse = activeKeys.length > 0 ? activeKeys : validKeys;

  const startIndex = keyCursor % keysToUse.length;
  keyCursor = (keyCursor + 1) % keysToUse.length;
  return [...keysToUse.slice(startIndex), ...keysToUse.slice(0, startIndex)];
}

function isRateLimitError(error) {
  const message = (error?.message || "").toLowerCase();
  const status =
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    error?.response?.statusCode;
  return (
    status === 429 ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("tpm")
  );
}

function isInvalidKeyError(error) {
  const message = (error?.message || "").toLowerCase();
  const status =
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    error?.response?.statusCode;
  return (
    status === 401 ||
    status === 403 ||
    message.includes("invalid api key") ||
    message.includes("incorrect api key") ||
    message.includes("authentication")
  );
}

function isRetryableError(error) {
  if (isRateLimitError(error)) return true;
  const message = (error?.message || "").toLowerCase();
  const status =
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    error?.response?.statusCode;
  if ([408, 409, 425, 500, 502, 503, 504].includes(status)) return true;
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("socket hang up") ||
    message.includes("econnreset") ||
    message.includes("overloaded")
  );
}

function getBackoffMs(attemptIndex) {
  const jitter = Math.floor(Math.random() * 250);
  return BASE_BACKOFF_MS * (2 ** attemptIndex) + jitter;
}

/**
 * -----------------------------------------
 * TEXT TRIMMER
 * -----------------------------------------
 */
function trimText(text, maxChars = 6000) {
  if (!text) return "";

  return text.length > maxChars
    ? text.slice(0, maxChars)
    : text;
}

/**
 * -----------------------------------------
 * CREATE / CACHE LLM INSTANCE
 * -----------------------------------------
 */
function getLLM(apiKey, model, temperature, taskType) {
  const cacheKey = `${apiKey}-${model}-${temperature}-${taskType}`;

  if (llmCache.has(cacheKey)) {
    const cached = llmCache.get(cacheKey);
    llmCache.delete(cacheKey);
    llmCache.set(cacheKey, cached);
    return cached;
  }

  const instance = new ChatGroq({
    apiKey,
    model,
    temperature,
    maxTokens: getClampedMaxTokens(taskType, model),
    maxRetries: 0,
    timeout: REQUEST_TIMEOUT_MS,
  });
  cacheLlmInstance(cacheKey, instance);

  return instance;
}

/**
 * -----------------------------------------
 * MAIN INVOKER
 * -----------------------------------------
 */
async function invokeGroq(
  messages,
  taskType = "default",
  temperature = 0.7
) {
  if (apiKeys.length === 0) {
    throw new Error("No GROQ API keys configured.");
  }

  const primaryModel = getModelForTask(taskType);

  const configsToTry = [];
  const orderedKeys = getOrderedKeys();

  if (orderedKeys.length === 0) {
    throw new Error("All GROQ API keys are invalid or cooling down.");
  }

  /**
   * Try primary model on all keys first
   */
  for (const key of orderedKeys) {
    configsToTry.push({
      apiKey: key,
      model: primaryModel,
    });
  }

  /**
   * Then fallback models
   */
  for (const model of fallbackModels) {
    if (model === primaryModel) continue;

    for (const key of orderedKeys) {
      configsToTry.push({
        apiKey: key,
        model,
      });
    }
  }

  /**
   * Start attempts
   */
  for (const config of configsToTry) {
    if (invalidApiKeys.has(config.apiKey)) continue;
    if ((keyCooldowns.get(config.apiKey) || 0) > Date.now()) continue;

    const keySuffix = (config.apiKey || "").slice(-4);

    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_CONFIG; attempt += 1) {
      try {
        console.log(
          `🧠 [${taskType}] Trying Groq model: ${config.model} (key: ...${keySuffix})`
        );

        const llm = getLLM(
          config.apiKey,
          config.model,
          temperature,
          taskType
        );

        const response = await llm.invoke(messages);

        /**
         * Empty response guard
         */
        if (!response?.content || response.content.trim() === "") {
          throw new Error(`Model ${config.model} returned empty content`);
        }

        return response;

      } catch (err) {
        if (isInvalidKeyError(err)) {
          invalidApiKeys.add(config.apiKey);
          console.log(`❌ Invalid API key ending in ...${keySuffix}`);
          break;
        }

        if (isRateLimitError(err)) {
          keyCooldowns.set(
            config.apiKey,
            Date.now() + RATE_LIMIT_COOLDOWN_MS
          );
          console.log(`⏳ Temporary rate limit on key ...${keySuffix}`);
        }

        if (isRetryableError(err) && attempt < MAX_ATTEMPTS_PER_CONFIG - 1) {
          await sleep(getBackoffMs(attempt));
          continue;
        }

        console.log({
          model: config.model,
          key: keySuffix,
          error: err?.message || String(err),
        });
        break;
      }
    }
  }

  throw new Error("All Groq models and keys exhausted");
}

module.exports = {
  invokeGroq,
  getModelForTask,
  trimText,
};
