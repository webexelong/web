import { useStore } from '../src/store/useStore';

describe('guest QR session', () => {
  beforeEach(() => {
    useStore.getState().clearGuestSession();
    useStore.getState().clearCart();
  });

  it('keeps the scanned store and table without authentication', () => {
    useStore.getState().initGuestSession(42, 'table-7');
    const state = useStore.getState();

    expect(state.guestSession?.storeId).toBe(42);
    expect(state.guestSession?.tableId).toBe('table-7');
    expect(state.currentStoreId).toBe(42);
    expect(state.currentTable).toBe('table-7');
  });

  it('stores guest contact data for checkout', () => {
    useStore.getState().initGuestSession(42, 'table-7');
    useStore.getState().updateGuestInfo('Khách test', '0900000000');
    const guest = useStore.getState().guestSession;

    expect(guest).toMatchObject({ guestName: 'Khách test', guestPhone: '0900000000' });
  });
});
