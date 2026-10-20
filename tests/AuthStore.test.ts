import { useAuthStore } from '../src/store/authStore';

describe('authentication and loyalty access state', () => {
  beforeEach(() => useAuthStore.getState().logout());

  it('keeps guests unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('only reports loyalty-capable roles as authenticated users', () => {
    useAuthStore.getState().setAuth({
      token: 'customer-token',
      user: { username: 'customer', fullName: 'Customer', role: 'Customer', tenantId: 1 },
    });
    expect(useAuthStore.getState().hasRole(['Customer'])).toBe(true);
    expect(useAuthStore.getState().hasRole(['Owner'])).toBe(false);
  });
});
