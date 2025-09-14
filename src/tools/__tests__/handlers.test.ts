import * as handlers from '../handlers';
import { TOOLS } from '../../types';

describe('Tool Handlers', () => {
  it('should have handler classes', () => {
    expect(typeof handlers.CodexToolHandler).toBe('function');
    expect(typeof handlers.PingToolHandler).toBe('function');
    expect(typeof handlers.HelpToolHandler).toBe('function');
  });

  it('should instantiate handlers', () => {
    expect(new handlers.CodexToolHandler()).toBeInstanceOf(handlers.CodexToolHandler);
    expect(new handlers.PingToolHandler()).toBeInstanceOf(handlers.PingToolHandler);
    expect(new handlers.HelpToolHandler()).toBeInstanceOf(handlers.HelpToolHandler);
  });

  it('should have toolHandlers object', () => {
    expect(typeof handlers.toolHandlers).toBe('object');
    expect(Object.keys(handlers.toolHandlers)).toEqual(
      expect.arrayContaining([TOOLS.CODEX, TOOLS.PING, TOOLS.HELP])
    );
  });

  // Add more tests for execute methods if possible (mock dependencies)
});
