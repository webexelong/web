import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ROLE_HOME: Record<string, string> = {
  SystemAdmin: '/system-admin',
  Owner: '/admin',
  TenantOwner: '/admin',
  Staff: '/staff/orders',
  Customer: '/',
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  // Chưa đăng nhập -> redirect về login
  if (!isAuthenticated || !user) {
    const requestedPath = window.location.pathname;
    const loginPath = requestedPath.startsWith('/system-admin')
      ? '/system-admin/login'
      : '/login';
    return <Navigate to={loginPath} replace />;
  }

  // Kiểm tra role nếu có yêu cầu
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to={ROLE_HOME[user.role] ?? '/'} replace />;
    }
  }

  return <>{children}</>;
}
