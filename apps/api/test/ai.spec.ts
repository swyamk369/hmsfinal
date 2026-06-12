import { AiService } from '../src/ai/ai.service';
import type { RequestContext } from '../src/common/types';

describe('AiService', () => {
  const originalGoogleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalGoogleKey;
    process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  it('returns a chat-protocol fallback when no AI provider key is configured', async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const svc = new AiService({} as any, {} as any);
    const res = await svc.handleChatStream({ userId: 'u1' } as RequestContext, [
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] } as any,
    ]);

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain('GOOGLE_GENERATIVE_AI_API_KEY');
  });
});
