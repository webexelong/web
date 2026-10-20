import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Dynamic Base URL: Tự động nhận diện hostname (localhost hoặc IP mạng LAN/Hotspot)
const getApiHost = () => {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
};

const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(getApiHost());
// In production, default to same-origin HTTPS behind the reverse proxy. Local
// development continues to use the ASP.NET Core development port.
const defaultBackendOrigin = isLocalDevelopment
  ? `http://${getApiHost()}:5277`
  : window.location.origin;
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${defaultBackendOrigin}/api`;
export const HUB_URL = import.meta.env.VITE_HUB_URL || `${defaultBackendOrigin}/hubs/orders`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Tự động gắn Bearer Token nếu có (NHƯNG không bắt buộc)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  // Chỉ gắn token nếu có, không throw error nếu không có
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Guest requests sẽ không có Authorization header → Backend cho phép
  return config;
});

// Response Interceptor: Xử lý format lỗi chung và kiểm tra kết nối Backend
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Kiểm tra nếu Backend chưa bật hoặc không kết nối được
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      console.error(' Backend chưa khởi động hoặc không kết nối được tại:', API_BASE_URL);
      return Promise.reject(new Error('Không thể kết nối đến Backend. Vui lòng kiểm tra Backend đang chạy tại ' + API_BASE_URL));
    }

    // Xử lý lỗi 401 Unauthorized
    if (error.response?.status === 401) {
      console.warn('Phiên đăng nhập đã hết hạn hoặc không hợp lệ.');

      // Đồng bộ dọn sạch toàn bộ trạng thái auth
      try {
        useAuthStore.getState().logout();
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('auth-storage');
      }

      // Chỉ chuyển hướng về trang /login nếu đang ở các trang quản trị/nhân viên
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const isAdminOrStaffPath = path.startsWith('/admin') || path.startsWith('/staff') || path.startsWith('/system-admin');
        if (isAdminOrStaffPath && !path.includes('/login')) {
          const loginPath = path.startsWith('/system-admin') ? '/system-admin/login' : '/login';
          window.location.href = `${loginPath}?redirect=${encodeURIComponent(path)}`;
        }
      }
    }

    // Xử lý lỗi 403 Forbidden
    if (error.response?.status === 403) {
      console.warn(' Không có quyền truy cập.');
    }

    const message = error.response?.data?.message || error.message || 'Đã có lỗi xảy ra';
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message,
      fullResponse: error.response?.data, // Log full response để debug
    });

    // GIỮ NGUYÊN error object thay vì tạo Error mới
    // Điều này giúp component truy cập được err.response.data.errors
    return Promise.reject(error);
  }
);
