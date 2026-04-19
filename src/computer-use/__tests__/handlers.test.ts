import { ComputerUseToolHandler } from '../handlers.js';
import { CU_TOOLS } from '../types.js';

describe('ComputerUseToolHandler', () => {
  let handler: ComputerUseToolHandler;

  beforeEach(() => {
    handler = new ComputerUseToolHandler();
  });

  describe('cu_status', () => {
    test('should return status JSON without connecting to binary', async () => {
      const result = await handler.execute(CU_TOOLS.STATUS, {});
      // Status should always work — no binary needed.
      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('connected');
      expect(parsed).toHaveProperty('binary');
      expect(parsed).toHaveProperty('error');
    });
  });

  describe('validation', () => {
    test('should reject unknown tool name', async () => {
      await expect(
        handler.execute('cu_nonexistent', {})
      ).rejects.toThrow('Unknown computer-use tool');
    });

    test('should reject invalid click args (no app)', async () => {
      await expect(
        handler.execute(CU_TOOLS.CLICK, {})
      ).rejects.toThrow();
    });

    test('should reject invalid get_app_state args (empty app)', async () => {
      await expect(
        handler.execute(CU_TOOLS.GET_APP_STATE, { app: '' })
      ).rejects.toThrow();
    });

    test('should reject invalid drag args (missing coordinates)', async () => {
      await expect(
        handler.execute(CU_TOOLS.DRAG, { app: 'Safari' })
      ).rejects.toThrow();
    });
  });
});
