import { executeCommand, executeCommandStreamed } from '../command';
import { CommandResult } from '../../types';

describe('executeCommand', () => {
  it('should resolve with stdout and stderr', async () => {
    // This test assumes a harmless command available on all systems
    const result: CommandResult = await executeCommand('echo', ['hello']);
    expect(result.stdout).toContain('hello');
    expect(result.stderr).toBe('');
  });

  it('should throw on invalid command', async () => {
    await expect(executeCommand('nonexistent-cmd')).rejects.toThrow();
  });
});

describe('executeCommandStreamed', () => {
  it('should resolve with stdout and stderr', async () => {
    const result: CommandResult = await executeCommandStreamed('echo', ['streamed']);
    expect(result.stdout).toContain('streamed');
    expect(result.stderr).toBe('');
  });

  it('should throw on invalid command', async () => {
    await expect(executeCommandStreamed('nonexistent-cmd')).rejects.toThrow();
  });
});
