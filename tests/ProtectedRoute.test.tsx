import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '../src/store/authStore';
import ProtectedRoute from '../src/components/ProtectedRoute';

function renderRoute(path = '/admin') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login-page</div>} />
        <Route path="/admin" element={<div>admin-page</div>} />
        <Route path="/staff/orders" element={<div>staff-page</div>} />
        <Route path="*" element={<ProtectedRoute allowedRoles={['Owner']}><div>protected-page</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => useAuthStore.getState().logout());

  it('redirects anonymous users to login', () => {
    renderRoute('/protected');
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('allows an authorized owner to access protected content', () => {
    useAuthStore.getState().setAuth({
      token: 'test-token',
      user: { username: 'owner', fullName: 'Owner', role: 'Owner', tenantId: 1 },
    });
    renderRoute('/protected');
    expect(screen.getByText('protected-page')).toBeInTheDocument();
  });

  it('redirects a staff user to the staff home', () => {
    useAuthStore.getState().setAuth({
      token: 'test-token',
      user: { username: 'staff', fullName: 'Staff', role: 'Staff', tenantId: 1, storeId: 2 },
    });
    renderRoute('/protected');
    expect(screen.getByText('staff-page')).toBeInTheDocument();
  });
});
