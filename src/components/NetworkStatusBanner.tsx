import React, { useState, useEffect } from 'react';

/**
 * Hook to monitor online/offline network status across the app
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * NetworkStatusBanner: Floating banner informing users when connection drops or recovers
 */
export default function NetworkStatusBanner() {
  const isOnline = useNetworkStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowRestored(false);
    } else if (wasOffline) {
      // Just reconnected
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
        setWasOffline(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Offline Warning Banner
  if (!isOnline) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-amber-600 via-red-600 to-amber-700 text-white px-4 py-2.5 shadow-xl flex items-center justify-center gap-2.5 text-xs sm:text-sm font-bold animate-in slide-in-from-top duration-300"
      >
        <span className="material-symbols-outlined text-lg animate-pulse">wifi_off</span>
        <span>
          Mất kết nối Internet! Món ăn trong giỏ hàng vẫn được lưu an toàn. Vui lòng kiểm tra lại kết nối Wifi/4G.
        </span>
      </div>
    );
  }

  // Connection Restored Banner
  if (showRestored) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 shadow-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold animate-in slide-in-from-top duration-300"
      >
        <span className="material-symbols-outlined text-lg">wifi</span>
        <span>Đã khôi phục kết nối Internet thành công!</span>
      </div>
    );
  }

  return null;
}

