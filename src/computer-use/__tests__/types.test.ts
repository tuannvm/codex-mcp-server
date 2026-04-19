import {
  CU_TOOLS,
  BINARY_TOOLS,
  CU_TO_BINARY,
  CU_SCHEMAS,
  ListAppsSchema,
  GetAppStateSchema,
  ClickSchema,
  DragSchema,
  PerformSecondaryActionSchema,
  SetValueSchema,
  ScrollSchema,
  PressKeySchema,
  TypeTextSchema,
  CuStatusSchema,
} from '../types.js';

describe('Computer Use Types', () => {
  test('CU_TOOLS should have all 10 tools', () => {
    const values = Object.values(CU_TOOLS);
    expect(values).toHaveLength(10);
    expect(values).toContain('cu_list_apps');
    expect(values).toContain('cu_get_app_state');
    expect(values).toContain('cu_click');
    expect(values).toContain('cu_perform_secondary_action');
    expect(values).toContain('cu_set_value');
    expect(values).toContain('cu_scroll');
    expect(values).toContain('cu_drag');
    expect(values).toContain('cu_press_key');
    expect(values).toContain('cu_type_text');
    expect(values).toContain('cu_status');
  });

  test('BINARY_TOOLS should have 9 tools (no status)', () => {
    expect(Object.keys(BINARY_TOOLS)).toHaveLength(9);
  });

  test('CU_TO_BINARY should map all CU_TOOLS except status', () => {
    for (const [, binaryName] of Object.entries(CU_TO_BINARY)) {
      expect(binaryName).toBeDefined();
      expect(Object.values(BINARY_TOOLS) as unknown[]).toContain(binaryName);
    }
    // status should NOT be in the map (it's handled locally).
    expect(CU_TO_BINARY[CU_TOOLS.STATUS]).toBeUndefined();
  });

  test('CU_SCHEMAS should have a schema for every CU tool', () => {
    for (const key of Object.values(CU_TOOLS)) {
      expect(CU_SCHEMAS[key]).toBeDefined();
    }
  });

  describe('Zod schemas', () => {
    test('ListAppsSchema accepts empty object', () => {
      expect(ListAppsSchema.parse({})).toEqual({});
    });

    test('GetAppStateSchema requires app', () => {
      expect(GetAppStateSchema.parse({ app: 'Safari' })).toEqual({ app: 'Safari' });
      expect(() => GetAppStateSchema.parse({})).toThrow();
      expect(() => GetAppStateSchema.parse({ app: '' })).toThrow();
    });

    test('ClickSchema requires app, optional fields', () => {
      expect(ClickSchema.parse({ app: 'Safari' })).toEqual({ app: 'Safari' });
      expect(
        ClickSchema.parse({ app: 'Safari', element_index: '5', x: 100, y: 200 })
      ).toEqual({ app: 'Safari', element_index: '5', x: 100, y: 200 });
    });

    test('DragSchema requires app and all coordinates', () => {
      expect(DragSchema.parse({ app: 'Safari', from_x: 0, from_y: 0, to_x: 100, to_y: 100 })).toEqual({
        app: 'Safari',
        from_x: 0,
        from_y: 0,
        to_x: 100,
        to_y: 100,
      });
      expect(() => DragSchema.parse({ app: 'Safari' })).toThrow();
    });

    test('PerformSecondaryActionSchema requires app, element_index, action', () => {
      expect(
        PerformSecondaryActionSchema.parse({ app: 'Safari', element_index: '3', action: 'toggle' })
      ).toEqual({ app: 'Safari', element_index: '3', action: 'toggle' });
      expect(() => PerformSecondaryActionSchema.parse({ app: 'Safari' })).toThrow();
    });

    test('SetValueSchema requires app, element_index, value', () => {
      expect(
        SetValueSchema.parse({ app: 'Safari', element_index: '1', value: 'hello' })
      ).toEqual({ app: 'Safari', element_index: '1', value: 'hello' });
    });

    test('ScrollSchema requires app, element_index, direction', () => {
      expect(
        ScrollSchema.parse({ app: 'Safari', element_index: '0', direction: 'down' })
      ).toEqual({ app: 'Safari', element_index: '0', direction: 'down' });
      expect(ScrollSchema.parse({ app: 'Safari', element_index: '0', direction: 'down', pages: 3 })).toEqual({
        app: 'Safari',
        element_index: '0',
        direction: 'down',
        pages: 3,
      });
    });

    test('PressKeySchema requires app and key', () => {
      expect(PressKeySchema.parse({ app: 'Terminal', key: 'Return' })).toEqual({
        app: 'Terminal',
        key: 'Return',
      });
    });

    test('TypeTextSchema requires app and text', () => {
      expect(TypeTextSchema.parse({ app: 'TextEdit', text: 'hello world' })).toEqual({
        app: 'TextEdit',
        text: 'hello world',
      });
    });

    test('CuStatusSchema accepts empty object', () => {
      expect(CuStatusSchema.parse({})).toEqual({});
    });
  });
});
