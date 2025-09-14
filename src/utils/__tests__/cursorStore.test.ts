import { CursorStore } from '../cursorStore';

describe('CursorStore', () => {
  it('should set and get cursor', () => {
    const store = new CursorStore();
    store.set('session1', 'cursor1');
    expect(store.get('session1')).toBe('cursor1');
  });

  it('should return undefined for unknown session', () => {
    const store = new CursorStore();
    expect(store.get('unknown')).toBeUndefined();
  });

  it('should clear all cursors', () => {
    const store = new CursorStore();
    store.set('session1', 'cursor1');
    store.clear();
    expect(store.get('session1')).toBeUndefined();
  });
});
