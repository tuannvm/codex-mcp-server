import { saveChunk, peekChunk, advanceChunk } from '../cursorStore';

describe('cursorStore integration', () => {
  it('should save and peek a chunk', () => {
    const id = saveChunk('abcdef');
    expect(typeof id).toBe('string');
    expect(peekChunk(id)).toBe('abcdef');
  });

  it('should advance and eventually delete chunk', () => {
    const id = saveChunk('abcdef');
    advanceChunk(id, 3);
    expect(peekChunk(id)).toBe('def');
    advanceChunk(id, 3);
    expect(peekChunk(id)).toBeUndefined();
  });

  it('should do nothing if advancing unknown cursor', () => {
    expect(() => advanceChunk('notarealid', 2)).not.toThrow();
  });
});
