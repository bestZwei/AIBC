# AIBC · 个人 AI 电台

> AI Broadcast Center —— 一个**电台化**的个人 AI 音频流：连续、被动、可插话。
> 选一个频道，点播放，AI 主播就为你不间断地播，你随时能插话，它会接着回应。

这不是又一个「问答式语音助手」。AIBC 的护城河是**电台体验本身**：你不需要一直说话、不需要盯着屏幕，
内容像广播一样一段接一段地流，你只在想插话时插一句。MVP 已跑通「选台 → 生成文本 → 合成语音 → 连续播放 → 插话回应」的完整闭环。

---

## 产品定位（一句话）

**人人都有一个 24 小时不关机的个人 AI 电台。** 北极星指标：单次连续收听时长、用户自建频道数。
详见 [docs/PRD.md](docs/PRD.md)。

## 当前状态

MVP（Stage 1）已完成并通过验证：

- 5 个预设频道（新闻 / 故事 / 科普 / 闲聊 / 访谈），加权调度 + 上下文记忆
- 服务端**平台代理 + 供应商适配层**：AI/TTS 可插拔，密钥只在服务端，绝不下发前端
- 前端 Web Audio 队列连续播放、实时文本、频谱可视化、ON AIR、音量、深浅主题、听众插话
- 领域核心 + 服务端 + 组件共 **35 个 Vitest 用例**；`lint / typecheck / test / build` 全绿；GitHub Actions CI

尚未做（有意留到后续阶段）：频道创建 UI、账号与云同步、频道市场、社交、声音克隆、多人同步收听。见 [docs/ROADMAP.md](docs/ROADMAP.md)。

## 快速开始

前置：**Node 20+** 与 **pnpm**（`corepack enable` 即可按 `packageManager` 锁定版本）。

```bash
pnpm install
cp .env.example .env.local   # 填入你的 AI / TTS 供应商配置
pnpm dev                     # http://localhost:3000
```

打开页面 → 左侧选一个频道 → 点 ▶ 播放。首段会有几秒延迟（生成文本 + 合成语音），之后连续播放。
在底部「插话」框输入问题，下一段会优先回应。

> ⚠️ **需要你自己的 AI Key**：`AI_API_KEY` 无默认值、必填。默认 `AI_BASE_URL` 指向 Google AI Studio 的
> OpenAI 兼容端点（已验证可用）；换供应商只改 `.env.local`，**无需改代码**。
> TTS（edge-tts 风格端点）开箱可用；AI 文本若返回 `502`，见下方变量表调整即可。

## 环境变量

所有配置**只在服务端**读取（`src/server/env.ts` 经 Zod 校验），模板见 [`.env.example`](.env.example)：

| 变量                                            | 作用                                                                           | 默认                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------- |
| `AI_PROVIDER`                                   | 协议适配器：`openai-compatible` / `gemini-native`（详见 ARCHITECTURE 第 8 节） | `openai-compatible`                     |
| `AI_BASE_URL`                                   | AI 基础地址（拼接规则随适配器而变）                                            | Google AI Studio OpenAI 兼容端点        |
| `AI_API_KEY`                                    | AI 密钥（**必填，无默认**）                                                    | —                                       |
| `AI_MODEL` / `AI_MAX_TOKENS` / `AI_TEMPERATURE` | 生成参数                                                                       | `gemini-flash-lite-latest` / 1000 / 0.7 |
| `TTS_PROVIDER`                                  | TTS 适配器 id                                                                  | `edge-tts`                              |
| `TTS_BASE_URL`                                  | TTS 基础地址（自动拼 `/tts`、`/voices`）                                       | LibreTTS Edge-TTS 接口                  |
| `TTS_DEFAULT_VOICE`                             | 缺省语音                                                                       | `zh-CN-XiaoxiaoNeural`                  |
| `API_RATE_LIMIT_PER_MIN`                        | 每 IP 每分钟请求上限                                                           | 30                                      |

`.env*` 已在 `.gitignore` 中忽略，仅 `.env.example` 入库。**旧原型里硬编码的密钥视为已泄露、已作废，本项目不复用。**

## 常用脚本

```bash
pnpm dev          # 开发（Turbopack）
pnpm build        # 生产构建
pnpm start        # 运行构建产物
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest 单次运行
pnpm format:check # Prettier 校验
```

提交时 `husky` + `lint-staged` 会自动 `eslint --fix` 与 `prettier --write`。

## API（同源，前端只碰这些）

| 方法 | 路径           | 说明                                                                                                   |
| ---- | -------------- | ------------------------------------------------------------------------------------------------------ |
| POST | `/api/segment` | 按 `stationId + segmentType + memory(+userInput)` 生成一段**文本**；提示词由服务端依据可信频道配置构建 |
| POST | `/api/tts`     | 文本 → **音频字节**（LRU 缓存，按 text+voice 哈希）                                                    |
| GET  | `/api/voices`  | 可用语音列表（缓存）                                                                                   |

三个端点都做：Zod 入参校验、令牌桶限流、**错误脱敏**（只回 `{ error }`，不含上游响应/密钥/堆栈）。

## 架构一览

分层：`领域核心（isomorphic）` ← `服务端代理层` → `API 路由` → `前端 stores + Web Audio`。
电台「大脑」（调度 + 上下文）在客户端，服务端保持无状态薄代理。
完整设计、数据流与安全考量见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

```
src/
├─ app/            # App Router：页面 + /api/{segment,tts,voices}
├─ components/     # Player / StationList / Visualizer / Interaction / StatusBar / ...
├─ stores/         # zustand：usePlayerStore（传输态）· useRadioStore（电台大脑+编排）
├─ lib/
│  ├─ radio/       # 领域核心：types/stations/scheduler/prompt/titles/text（可单测）
│  ├─ audio/       # Web Audio 引擎：连续队列 + AnalyserNode
│  └─ api.ts       # 同源 API 客户端与契约类型
└─ server/         # 代理层：env(Zod) · providers/{ai,tts} · ratelimit · cache · errors
```

## 文档

- [产品需求 PRD](docs/PRD.md)
- [架构设计 ARCHITECTURE](docs/ARCHITECTURE.md)
- [路线图 ROADMAP](docs/ROADMAP.md)

## 许可

Private，暂不公开许可。
