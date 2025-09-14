import { makeRunId, buildPromptWithSentinels, stripEchoesAndMarkers } from '../promptSanitizer';

describe('promptSanitizer integration', () => {
  it('should generate a unique runId', () => {
    const id1 = makeRunId();
    const id2 = makeRunId();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
  });

  it('should build prompt with sentinels', () => {
    const runId = 'test';
    const prompt = buildPromptWithSentinels(runId, 'context', 'user prompt');
    expect(prompt).toContain('<<CTX:test:START>>');
    expect(prompt).toContain('<<USR:test:START>>');
    expect(prompt).toContain('<<ANS:test:START>>');
  });

  it('should strip echoes and markers', () => {
    const runId = 'test';
    const stitched = 'context';
    const raw = `<<CTX:test:START>>context<<CTX:test:END>>\n<<USR:test:START>>user prompt<<USR:test:END>>\n<<ANS:test:START>>answer text`;
    const result = stripEchoesAndMarkers(runId, stitched, raw);
    expect(result).toBe('answer text');
  });
});
