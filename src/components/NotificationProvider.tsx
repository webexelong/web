import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type Notice = { title?: string; message: string; tone: 'success' | 'error' | 'warning' | 'info' };
type Confirmation = Notice & { confirmText?: string; cancelText?: string; onConfirm: () => void | Promise<void> };
type NotificationContextValue = {
  toast: (message: string, tone?: Notice['tone']) => void;
  alert: (message: string, tone?: Notice['tone'], title?: string) => void;
  confirm: (request: Confirmation) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotification() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotification phải được dùng bên trong NotificationProvider.');
  return value;
}

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toastNotice, setToastNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [alertNotice, setAlertNotice] = useState<Notice | null>(null);

  const toast = useCallback((message: string, tone: Notice['tone'] = 'success') => {
    setToastNotice({ message, tone });
    window.setTimeout(() => setToastNotice(null), 3500);
  }, []);

  const alert = useCallback((message: string, tone: Notice['tone'] = 'error', title?: string) => {
    setAlertNotice({ message, tone, title });
  }, []);

  const confirm = useCallback((request: Confirmation) => {
    setConfirmation(request);
  }, []);

  const Icon = ({ tone }: { tone: Notice['tone'] }) => {
    if (tone === 'success') return <CheckCircle2 className="w-5 h-5 shrink-0" />;
    if (tone === 'warning') return <AlertTriangle className="w-5 h-5 shrink-0" />;
    if (tone === 'info') return <Info className="w-5 h-5 shrink-0" />;
    return <AlertTriangle className="w-5 h-5 shrink-0" />;
  };

  const runConfirm = async () => {
    if (!confirmation) return;
    const current = confirmation;
    setConfirmation(null);
    await current.onConfirm();
  };

  const getToastColors = (tone: Notice['tone']) => {
    switch (tone) {
      case 'success':
        return 'bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-400/30 shadow-emerald-950/30';
      case 'error':
        return 'bg-red-600 dark:bg-red-700 text-white border-red-400/30 shadow-red-950/30';
      case 'warning':
        return 'bg-amber-600 dark:bg-amber-700 text-white border-amber-400/30 shadow-amber-950/30';
      case 'info':
        return 'bg-sky-600 dark:bg-sky-700 text-white border-sky-400/30 shadow-sky-950/30';
      default:
        return 'bg-stone-800 text-white border-stone-600';
    }
  };

  return (
    <NotificationContext.Provider value={{ toast, alert, confirm }}>
      {children}

      {/* PROMINENT TOP-CENTER TOAST (Auto-dismisses in 3.5s) */}
      {toastNotice && (
        <div
          role="alert"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[250] flex max-w-md w-[92%] sm:w-auto items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md border animate-in fade-in slide-in-from-top-6 duration-300 select-none"
          style={{
            animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border shadow-lg ${getToastColors(toastNotice.tone)}`}>
            <Icon tone={toastNotice.tone} />
            <span className="text-sm font-bold flex-1 leading-snug">{toastNotice.message}</span>
            <button
              onClick={() => setToastNotice(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition"
              aria-label="Đóng thông báo"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ALERT DIALOG */}
      {alertNotice && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-surface dark:bg-[#1E1714] border border-outline-variant/30 dark:border-white/10 p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className={alertNotice.tone === 'success' ? 'text-emerald-500' : 'text-red-500'}>
                <Icon tone={alertNotice.tone} />
              </span>
              <div className="flex-1">
                <h3 className="text-base font-bold text-on-surface dark:text-[#F8F4EE]">
                  {alertNotice.title || (alertNotice.tone === 'success' ? 'Thành công' : 'Không thể thực hiện')}
                </h3>
                <p className="mt-2 whitespace-pre-line text-xs sm:text-sm leading-relaxed text-on-surface-variant dark:text-[#A4968C]">
                  {alertNotice.message}
                </p>
              </div>
              <button
                onClick={() => setAlertNotice(null)}
                className="text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-container dark:hover:bg-white/10 p-1.5 rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>
            <button
              onClick={() => setAlertNotice(null)}
              className="mt-6 w-full rounded-xl bg-primary hover:bg-primary-container px-4 py-3 font-bold text-xs sm:text-sm text-white shadow-md transition active:scale-98"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG */}
      {confirmation && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-surface dark:bg-[#1E1714] border border-outline-variant/30 dark:border-white/10 p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="text-amber-500">
                <Icon tone="warning" />
              </span>
              <div className="flex-1">
                <h3 className="text-base font-bold text-on-surface dark:text-[#F8F4EE]">
                  {confirmation.title || 'Xác nhận thao tác'}
                </h3>
                <p className="mt-2 whitespace-pre-line text-xs sm:text-sm leading-relaxed text-on-surface-variant dark:text-[#A4968C]">
                  {confirmation.message}
                </p>
              </div>
              <button
                onClick={() => setConfirmation(null)}
                className="text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-container dark:hover:bg-white/10 p-1.5 rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmation(null)}
                className="rounded-xl border border-outline-variant/30 dark:border-white/10 px-4 py-2.5 font-bold text-xs sm:text-sm text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-container dark:hover:bg-white/5 transition"
              >
                {confirmation.cancelText || 'Hủy'}
              </button>
              <button
                onClick={runConfirm}
                className="rounded-xl bg-red-600 hover:bg-red-700 px-5 py-2.5 font-bold text-xs sm:text-sm text-white shadow-md transition active:scale-95"
              >
                {confirmation.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}
