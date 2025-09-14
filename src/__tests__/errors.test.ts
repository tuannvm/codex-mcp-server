import { CommandExecutionError } from '../errors';

describe('CommandExecutionError', () => {
  it('should set properties correctly', () => {
    const err = new CommandExecutionError('ls', 'fail', new Error('fail'));
    expect(err.command).toBe('ls');
    expect(err.message).toBe('Command execution failed for "ls": fail');
    expect(err.cause).toBeInstanceOf(Error);
  });
});
