import { toolDefinitions } from '../definitions';
import { TOOLS } from '../../types';

describe('tool definitions smoke', () => {
  it('has all tools declared', () => {
    const names = toolDefinitions.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        TOOLS.CODEX,
        TOOLS.PING,
        TOOLS.HELP,
        TOOLS.LIST_SESSIONS,
      ])
    );
  });

  it('codex prompt is optional to allow pageToken-only', () => {
    const codex = toolDefinitions.find((t) => t.name === TOOLS.CODEX)!;
    expect(codex.inputSchema.required).toEqual([]);
  });
});
