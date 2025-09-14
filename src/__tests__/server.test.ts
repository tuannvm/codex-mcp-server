import { CodexMcpServer } from '../server';

describe('CodexMcpServer', () => {
  it('should instantiate with config', () => {
    const config = { name: 'test', version: '1.0.0' };
    const server = new CodexMcpServer(config);
    expect(server).toBeInstanceOf(CodexMcpServer);
  });

  // Add more tests for server methods if possible (mock dependencies)
});
