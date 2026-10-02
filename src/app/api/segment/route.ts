import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  buildSegmentPrompt,
  buildSystemPrompt,
  createMemory,
  updateMemory,
} from '@/lib/radio/prompt';
import { getStationById } from '@/lib/radio/stations';
import { segmentTitle } from '@/lib/radio/titles';
import { SEGMENT_TYPES } from '@/lib/radio/types';
import type { ContextMemory } from '@/lib/radio/types';
import { AppError } from '@/server/errors';
import { checkRateLimit, toErrorResponse } from '@/server/http';
import { getAiProvider } from '@/server/providers/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MemorySchema = z.object({
  currentTopic: z.string().nullable().default(null),
  recentTopics: z.array(z.string()).max(20).default([]),
  continuityHints: z.array(z.string()).max(20).default([]),
});

const SegmentRequest = z.object({
  stationId: z.string().min(1),
  segmentType: z.enum(SEGMENT_TYPES),
  memory: MemorySchema.optional(),
  userInput: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req);
  if (!limited.allowed) return limited.response;

  try {
    const body: unknown = await req.json();
    const parsed = SegmentRequest.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid request body');
    }
    const { stationId, segmentType, userInput } = parsed.data;

    const station = getStationById(stationId);
    if (!station) {
      throw new AppError(404, `Unknown station "${stationId}"`);
    }

    const memory: ContextMemory = parsed.data.memory ?? createMemory();
    const system = buildSystemPrompt(station);
    const prompt = buildSegmentPrompt(station, segmentType, memory, userInput);

    const text = await getAiProvider().generateText({ system, prompt });
    const nextMemory = updateMemory(memory, segmentType, text);

    return NextResponse.json(
      {
        stationId,
        segmentType,
        title: segmentTitle(segmentType),
        text,
        memory: nextMemory,
      },
      { headers: { 'X-RateLimit-Remaining': String(limited.remaining) } },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
