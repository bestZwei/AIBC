# 架构设计（ARCHITECTURE）· AIBC

版本：v3.0（MVP）｜ 栈：Next.js 15（App Router）+ React 19 + TypeScript（strict）

本文解释**为什么这样分层**、数据如何流动、以及安全与扩展的关键取舍。

---

## 1. 设计原则

1. **密钥只在服务端。** 前端只调用同源 `/api/*`，永远接触不到上游端点与密钥。
2. **供应商可插拔。** AI / TTS 各以一个接口 + 适配器 + 工厂实现，换供应商改 env 不改业务代码。
3. **大脑在客户端，服务端做薄代理。** 电台调度（决定下一段播什么）与上下文记忆放在浏览器；
   服务端保持无状态，利于缓存、易测、低延迟。多人同步收听才需要服务端调度，属 Stage 4。
4. **领域核心 isomorphic 且纯净。** `src/lib/radio/*` 是无副作用纯函数，客户端与服务端共用，可直接单测。
5. **单一事实来源。** 类型、频道配置、提示词字段统一一处定义（`prompts`，杜绝旧项目 `prompts`/`defaultPrompts` 打架）。

## 2. 分层总览

```
┌─────────────────────────────────────────────┐
│  浏览器（Client）                              │
│  components  ──▶  stores (zustand)            │
│   Player/Visualizer   useRadioStore = 电台大脑 │
│   StationList...      usePlayerStore = 传输态   │
│        │                    │                  │
│        │            lib/audio/engine (Web Audio)│
│        │            lib/radio/{scheduler,prompt}│
└────────┼────────────────────┼─────────────────┘
         │ fetch 同源 /api/*   │
┌────────▼────────────────────▼─────────────────┐
│  Next.js 服务端（Route Handlers）               │
│  app/api/{segment,tts,voices}/route.ts         │
│    Zod 校验 → 限流 → provider 调用 → 脱敏错误   │
│  server/providers/{ai,tts}  server/{env,cache} │
└────────────────────┬───────────────────────────┘
                     │ 仅此处持有密钥
              ┌──────▼───────┐
              │ 上游 AI / TTS │（OpenAI 兼容 / edge-tts 等）
              └──────────────┘
```

## 3. 目录与职责

| 路径                      | 职责                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/radio/`          | 领域核心：`types`（含 `SEGMENT_TYPES` 单一事实源）、`stations`（5 预设 seed）、`scheduler`（加权调度）、`prompt`（提示词 + 上下文记忆）、`titles`、`text`（分块）。纯函数、可单测。 |
| `src/lib/audio/engine.ts` | Web Audio 单例：解码队列、连续播放、suspend/resume 传输控制、AnalyserNode 频谱。                                                                                                    |
| `src/lib/api.ts`          | 前端同源 API 客户端 + 请求/响应契约类型。                                                                                                                                           |
| `src/stores/`             | `usePlayerStore`（isPlaying/volume/theme/currentMeta…）、`useRadioStore`（stationId/history/memory/pendingInput + 编排循环）。                                                      |
| `src/app/api/`            | 三个 Route Handler（见 §5）。                                                                                                                                                       |
| `src/server/`             | `env`（Zod 懒校验）、`providers/{ai,tts}`（接口+适配器+工厂）、`ratelimit`（令牌桶）、`cache`（LRU）、`errors`（脱敏 AppError）、`http`（IP/限流/错误映射）。                       |

## 4. 数据模型

```ts
SegmentType   // 由 SEGMENT_TYPES const 派生的联合类型
Segment       { type: SegmentType; weight: number }
Station       { id, name, description, icon, voice, systemPrompt, segments[], prompts }
PromptMap     = Partial<Record<SegmentType, string>>   // 支持 {stationName}/{userInput} 占位
SegmentMeta   { stationId, segmentType, title, text }  // 随音频在队列流转，供「正在播放」
ContextMemory { currentTopic, recentTopics[], continuityHints[] }
Voice         { shortName, friendlyName?, locale?, gender? }
```

## 5. API 契约（三个端点）

计划初稿是单个 `/api/segment`（文本+音频一起返回）。实现时拆成三个，各司其职、便于缓存与限流：

| 方法 路径           | 入参                                              | 出参                                              | 关键点                                                                                               |
| ------------------- | ------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| POST `/api/segment` | `{ stationId, segmentType, memory?, userInput? }` | `{ stationId, segmentType, title, text, memory }` | **提示词由服务端依据可信 `stationId` 构建**，客户端只表达「播哪类」，无法注入任意 system，防提示注入 |
| POST `/api/tts`     | `{ text, voice?, rate?, pitch? }`                 | 音频字节（`audio/mpeg`）                          | LRU 缓存 key=`sha256(text+voice+rate+pitch)`；text 上限 2000                                         |
| GET `/api/voices`   | —                                                 | `{ voices: Voice[] }`                             | 结果缓存 30 分钟                                                                                     |

三者共同防护：Zod 校验 → 令牌桶限流（按 IP）→ `AppError` 脱敏映射（≥500 落日志，响应只含 `{ error }`）。
**限流依赖 env，故置于入参/频道校验之后**，使 400/404 在缺配置时也能正确返回。

## 6. 端到端时序（一段连续播放）

```
用户点 ▶ 播放
  │  useRadioStore.start(): looping=true; engine.onDrained=pump; engine.play(); pump()
  ▼
pump(): while(looping && bufferedCount<3) generateOne()
  │
  ├─ scheduler.decideNextSegmentType(station, history, {hasPendingUserInput})
  ├─ POST /api/segment {stationId, segmentType, memory, userInput}
  │     服务端: 校验→限流→buildSystemPrompt+buildSegmentPrompt→AiProvider.generateText→updateMemory
  │     ◀── { text, title, memory }
  ├─ 更新 history/memory、清 pendingUserInput
  ├─ chunkText(text, 400) 逐块:
  │     POST /api/tts {chunk, voice} ──▶ 音频字节(命中缓存则 SKIP 上游)
  │     engine.decode(arrayBuffer) → enqueue(buffer, SegmentMeta)
  │        └ 引擎正在播放则立即续播下一段；否则等待 play()
  └─ 循环直到缓冲≥阈值
一段播完 → engine.onClipStart 更新 currentMeta → 用户看到实时文本/频谱跳动
队列将空 → engine.onDrained 再触发 pump（预取，实现「不断流」）
用户插话 → useRadioStore.submitInteraction 设 pendingUserInput → 下一段类型=userInteraction 优先回应
```

## 7. 客户端状态与引擎协作

- `audioEngine` 是音频唯一事实源；`EngineBridge` 用**单一订阅**把引擎传输态镜像进 `usePlayerStore`，避免多处订阅导致的状态漂移（旧项目双重初始化的教训）。
- `useRadioStore` 负责编排（网络 + 解码 + 入队），`usePlayerStore` 负责展示与主题；职责正交。
- 主题：class -based 深浅色（`.dark` 在 `<html>`），`layout.tsx` 内联脚本首屏前应用，杜绝 FOUC；持久化到 `localStorage`。

## 8. 供应商适配层（如何加新供应商）

```
providers/ai/types.ts             interface AiProvider { id; generateText(opts): Promise<string> }
providers/ai/openai-compatible.ts // 任何 OpenAI 兼容端点：POST {base}/chat/completions + Bearer
providers/ai/gemini-native.ts     // Google 原生：POST {base}/models/{model}:generateContent + x-goog-api-key
providers/ai/index.ts             // registry Map + getAiProvider()（按 env.AI_PROVIDER，单例）
```

`AI_PROVIDER` 选的是**协议**，供应商本身由 `AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL` 决定，所以同一个 Key 可以走两种协议；`gemini-native` 会忽略 `AI_BASE_URL` 末尾的 `/openai`，切换只改一个变量。

加新供应商（Azure/Anthropic/…）：**新增一个实现 `AiProvider` 的类**（解析它自己的响应结构，统一 `trim()` 后返回纯文本）→ 在 `index.ts` registry 注册一行 → 设 `AI_PROVIDER=<新 id>`。业务与前端零改动。TTS 同构（`TtsProvider`：`synthesize` + `listVoices`）。

## 9. 安全考量

- **密钥边界**：`process.env` 仅服务端读取；`getEnv()` 懒校验，缺 `AI_API_KEY` 只在建 provider 时抛错，且信息不含值。
- **提示注入面收敛**：`segmentType` 必须是 `SEGMENT_TYPES` 枚举、`stationId` 必须命中预设；system 由服务端拼装，用户自由文本仅进入 `{userInput}` 槽并有 500 字上限。
- **错误脱敏**：不回显上游响应体/密钥/堆栈；5xx 详情只进服务端日志。
- **限流**：单实例内存令牌桶，防滥用打到上游产生费用。
- **旧密钥作废**：原型里硬编码的 `sk-411zwei5202` 视为已泄露，本项目不复用。

## 10. 已知限制与演进

- **单实例内存态**（限流/缓存/provider 单例）：多实例需替换为共享存储（Redis）；接口已隔离，替换成本低。
- **客户端大脑**：切换设备/清会话则历史丢失；多人同步收听要求把 scheduler 移到服务端并引入会话态存储（Stage 4）。
- **无持久化/账号**：UGC 频道、收藏、跨设备同步待数据库与账号体系（Stage 2–3）。
- **音频透传**：适配器假定上游返回浏览器可解码的 mp3/wav；若供应商格式受限，需在适配器内转码。
