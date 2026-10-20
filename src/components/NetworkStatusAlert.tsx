import { useState, useEffect } from 'react';

export default function NetworkStatusAlert() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowAlert(true);
      // Auto-hide success message after 3 seconds
      setTimeout(() => setShowAlert(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowAlert(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Show initial state if offline
    if (!navigator.onLine) {
      setShowAlert(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showAlert) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-300 ${
        showAlert ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div
        className={`px-4 py-3 flex items-center justify-center gap-2 text-white font-bold text-sm shadow-lg ${
          isOnline
            ? 'bg-green-600 dark:bg-green-700'
            : 'bg-red-600 dark:bg-red-700 animate-pulse'
        }`}
      >
        <span className="material-symbols-outlined text-xl">
          {isOnline ? 'wifi' : 'wifi_off'}
        </span>
        <span>
          {isOnline
            ? '✓ Đã kết nối lại Internet'
            : '⚠️ Không có kết nối mạng - Vui lòng kiểm tra kết nối'}
        </span>
        {!isOnline && (
          <button
            onClick={() => window.location.reload()}
            className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs transition-colors"
          >
            Thử lại
          </button>
        )}
        {isOnline && (
          <button
            onClick={() => setShowAlert(false)}
            className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>
    </div>
  );
}
