import { executeCommand, executeCommandStreamed } from '../command';
import { CommandExecutionError } from '../../errors';

describe('executeCommand integration', () => {
  it('should resolve for a valid command', async () => {
    const result = await executeCommand('echo', ['integration']);
    expect(result.stdout).toContain('integration');
  });

  it('should reject for an invalid command', async () => {
    await expect(executeCommand('notarealcommand')).rejects.toBeInstanceOf(CommandExecutionError);
  });
});

describe('executeCommandStreamed integration', () => {
  it('should resolve for a valid command', async () => {
    const result = await executeCommandStreamed('echo', ['streamed']);
    expect(result.stdout).toContain('streamed');
  });

  it('should reject for an invalid command', async () => {
    await expect(executeCommandStreamed('notarealcommand')).rejects.toBeInstanceOf(CommandExecutionError);
  });

  it('should call onChunk for streamed output', async () => {
    const chunks: string[] = [];
    await executeCommandStreamed('echo', ['chunked'], (chunk) => {
      chunks.push(chunk);
    });
    expect(chunks.join('')).toContain('chunked');
  });
});
