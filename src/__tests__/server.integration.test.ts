import { CodexMcpServer } from '../server';
import { toolHandlers } from '../tools/handlers';
import { TOOLS } from '../types';

describe('CodexMcpServer', () => {
  let server: CodexMcpServer;
  const config = { name: 'test-server', version: '1.0.0' };

  beforeEach(() => {
    server = new CodexMcpServer(config);
  });

  it('should instantiate with config', () => {
    expect(server).toBeInstanceOf(CodexMcpServer);
  });

  it('should validate tool names correctly', () => {
    // @ts-expect-error: access private method for test
    expect(server.isValidToolName(TOOLS.CODEX)).toBe(true);
    // @ts-expect-error: access private method for test
    expect(server.isValidToolName('not-a-tool')).toBe(false);
  });

  // More integration tests would require mocking SDK Server/Transport
});
