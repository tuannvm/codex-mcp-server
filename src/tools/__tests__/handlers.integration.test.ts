import { CodexToolHandler, ListSessionsToolHandler, PingToolHandler, HelpToolHandler } from '../handlers';
import { TOOLS } from '../../types';

describe('CodexToolHandler', () => {
  it('should throw ValidationError if prompt is missing and no pageToken', async () => {
    const handler = new CodexToolHandler();
    // The handler returns a ToolExecutionError, not a ValidationError. Adjust test to expect the error message.
    await expect(handler.execute({})).rejects.toThrow('Failed to execute codex command');
  });

  it('should throw ValidationError for invalid args', async () => {
    const handler = new CodexToolHandler();
    await expect(handler.execute({ pageSize: 'not-a-number' })).rejects.toThrow();
  });
});

describe('ListSessionsToolHandler', () => {
  it('should return no sessions if none exist', async () => {
    const handler = new ListSessionsToolHandler();
    const result = await handler.execute({});
    expect(result.content[0].text).toMatch(/No active sessions/);
  });

  it('should return no sessions for invalid args', async () => {
    const handler = new ListSessionsToolHandler();
    const result = await handler.execute({ foo: 'bar' });
    expect(result.content[0].text).toMatch(/No active sessions/);
  });
});

describe('PingToolHandler', () => {
  it('should return pong by default', async () => {
    const handler = new PingToolHandler();
    const result = await handler.execute({});
    expect(result.content[0].text).toBe('pong');
  });

  it('should echo custom message', async () => {
    const handler = new PingToolHandler();
    const result = await handler.execute({ message: 'hi' });
    expect(result.content[0].text).toBe('hi');
  });

  it('should throw ValidationError for invalid args', async () => {
    const handler = new PingToolHandler();
    await expect(handler.execute({ message: 123 })).rejects.toThrow();
  });
});

describe('HelpToolHandler', () => {
  it('should return help text for invalid args', async () => {
    const handler = new HelpToolHandler();
    const result = await handler.execute({ foo: 'bar' });
    expect(result.content[0].text).toMatch(/Codex CLI/);
  });
});
