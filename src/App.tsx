import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

const CustomerLayout = lazy(() => import('./layouts/CustomerLayout'));
const Menu = lazy(() => import('./pages/customer/Menu'));

const StaffLayout = lazy(() => import('./layouts/StaffLayout'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const SystemAdminLayout = lazy(() => import('./layouts/SystemAdminLayout'));

const Login = lazy(() => import('./pages/Login'));
const DemoLanding = lazy(() => import('./pages/DemoLanding'));
const DemoBackoffice = lazy(() => import('./pages/DemoBackoffice'));
const OwnerSignup = lazy(() => import('./pages/OwnerSignup'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ProductDetail = lazy(() => import('./pages/customer/ProductDetail'));
const AIRecommendations = lazy(() => import('./pages/customer/AIRecommendations'));
const Cart = lazy(() => import('./pages/customer/Cart'));
const OrderSuccess = lazy(() => import('./pages/customer/OrderSuccess'));
const OrderTracking = lazy(() => import('./pages/customer/OrderTracking'));
const QRLanding = lazy(() => import('./pages/customer/QRLanding'));
const Profile = lazy(() => import('./pages/customer/Profile'));
const OrderHistory = lazy(() => import('./pages/customer/OrderHistory'));

const StaffOrderDashboard = lazy(() => import('./pages/staff/StaffOrderDashboard'));
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'));
const NewOrder = lazy(() => import('./pages/staff/NewOrder'));
const StaffLogin = lazy(() => import('./pages/staff/StaffLogin'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const MenuManagement = lazy(() => import('./pages/admin/MenuManagement'));
const InventoryManagement = lazy(() => import('./pages/admin/InventoryManagement'));
const TableManagement = lazy(() => import('./pages/admin/TableManagement'));
const StaffManagement = lazy(() => import('./pages/admin/StaffManagement'));
const PaymentSettings = lazy(() => import('./pages/admin/PaymentSettings'));
const SubscriptionManagement = lazy(() => import('./pages/admin/SubscriptionManagement'));
const VoucherManagement = lazy(() => import('./pages/admin/VoucherManagement'));

const SystemAdminDashboard = lazy(() => import('./pages/system-admin/SystemAdminDashboard'));
const TenantManagement = lazy(() => import('./pages/system-admin/TenantManagement'));
const SaaSPlansSettings = lazy(() => import('./pages/system-admin/SaaSPlansSettings'));
import AnalyticsTracker from './components/AnalyticsTracker';
import SubscriptionFeatureGate from './components/SubscriptionFeatureGate';
import ProtectedRoute from './components/ProtectedRoute';
import NotificationProvider from './components/NotificationProvider';
import NetworkStatusBanner from './components/NetworkStatusBanner';

function App() {
  return (
    <NotificationProvider><Router>
      <NetworkStatusBanner />
      <AnalyticsTracker />
      <Suspense fallback={<div className="min-h-screen bg-background p-6 text-on-surface" role="status">Đang tải trang...</div>}>
        <Routes>
        {/* Auth Route */}
        <Route path="/login" element={<Login />} />
        <Route path="/system-admin/login" element={<Login />} />
        <Route path="/landingpage" element={<LandingPage />} />
        <Route path="/demo" element={<DemoLanding />} />
        <Route path="/demo/backoffice" element={<Navigate to="/demo/owner/dashboard" replace />} />
        <Route path="/demo/owner" element={<Navigate to="/demo/owner/dashboard" replace />} />
        <Route path="/demo/owner/:page" element={<DemoBackoffice />} />
        <Route path="/demo/staff" element={<Navigate to="/demo/staff/orders" replace />} />
        <Route path="/demo/staff/:page" element={<DemoBackoffice />} />
        <Route path="/signup" element={<OwnerSignup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/staff/login" element={<StaffLogin />} />

        {/* QR Code Landing - Outside CustomerLayout for custom styling */}
        <Route path="/qr" element={<QRLanding />} />
        <Route path="/qr/:qrToken" element={<QRLanding />} />
        <Route path="/table/:storeId/:tableId" element={<QRLanding />} />

        {/* Customer Routes - Wrapped in CustomerLayout */}
        <Route element={<CustomerLayout />}>
          <Route path="/" element={<Menu />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/ai-suggest" element={<AIRecommendations />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/tracking" element={<OrderTracking />} />
          <Route path="/profile" element={(
            <ProtectedRoute allowedRoles={['Customer']}>
              <Profile />
            </ProtectedRoute>
          )} />
          <Route path="/history" element={<OrderHistory />} />
        </Route>

        {/* Staff Routes - Wrapped in StaffLayout */}
        <Route path="/staff" element={(
          <ProtectedRoute allowedRoles={['Staff', 'Owner', 'TenantOwner']}>
            <StaffLayout />
          </ProtectedRoute>
        )}>
          <Route index element={<Navigate to="orders" replace />} />
          <Route path="orders" element={<StaffOrderDashboard />} />
          <Route path="dashboard" element={<StaffDashboard />} />
          <Route path="new-order" element={<NewOrder />} />
        </Route>

        {/* Store Owner / Store Admin Routes - Wrapped in AdminLayout */}
        <Route path="/admin" element={(
          <ProtectedRoute allowedRoles={['Owner', 'TenantOwner']}>
            <AdminLayout />
          </ProtectedRoute>
        )}>
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<StaffOrderDashboard />} />
          <Route path="analytics" element={<SubscriptionFeatureGate feature="advanced_analytics" requiredPlan="Premium"><Analytics /></SubscriptionFeatureGate>} />
          <Route path="menu" element={<MenuManagement />} />
          <Route path="vouchers" element={<VoucherManagement />} />
          <Route path="inventory" element={<SubscriptionFeatureGate feature="inventory" requiredPlan="Premium"><InventoryManagement /></SubscriptionFeatureGate>} />
          <Route path="tables" element={<TableManagement />} />
          <Route path="staff" element={<StaffManagement />} />
          <Route path="settings" element={<PaymentSettings />} />
          <Route path="subscription" element={<SubscriptionManagement />} />
          <Route path="payments" element={<Navigate to="/admin/settings" replace />} />
        </Route>

        {/* Super Admin Platform Routes - Wrapped in SystemAdminLayout */}
        <Route path="/system-admin" element={(
          <ProtectedRoute allowedRoles={['SystemAdmin']}>
            <SystemAdminLayout />
          </ProtectedRoute>
        )}>
          <Route index element={<SystemAdminDashboard />} />
          <Route path="tenants" element={<TenantManagement />} />
          <Route path="plans" element={<SaaSPlansSettings />} />
        </Route>
        </Routes>
      </Suspense>
    </Router></NotificationProvider>
  );
}

export default App;
