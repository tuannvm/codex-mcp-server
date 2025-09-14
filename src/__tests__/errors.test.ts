import {
  CommandExecutionError,
  ToolExecutionError,
  ValidationError,
  handleError,
} from '../errors';

describe('Error classes and helpers', () => {
  it('CommandExecutionError sets properties', () => {
    const err = new CommandExecutionError('ls', 'fail', new Error('fail'));
    expect(err.command).toBe('ls');
    expect(err.message).toBe('Command execution failed for "ls": fail');
    expect(err.cause).toBeInstanceOf(Error);
  });

  it('ToolExecutionError formats message', () => {
    const err = new ToolExecutionError('codex', 'boom', new Error('x'));
    expect(err.toolName).toBe('codex');
    expect(err.message).toBe('Failed to execute tool "codex": boom');
    expect(err.cause).toBeInstanceOf(Error);
  });

  it('ValidationError formats message', () => {
    const err = new ValidationError('codex', 'nope');
    expect(err.toolName).toBe('codex');
    expect(err.message).toBe('Validation failed for tool "codex": nope');
  });

  it('handleError with Error instance', () => {
    const msg = handleError(new Error('x'), 'ctx');
    expect(msg).toBe('Error in ctx: x');
  });

  it('handleError with non-Error', () => {
    const msg = handleError('not-an-error' as any, 'ctx');
    expect(msg).toBe('Error in ctx: not-an-error');
  });
});
