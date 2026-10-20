import { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type Notice = { title?: string; message: string; tone: 'success' | 'error' | 'warning' | 'info' };
type Confirmation = Notice & { confirmText?: string; cancelText?: string; onConfirm: () => void | Promise<void> };
type NotificationContextValue = { toast: (message: string, tone?: Notice['tone']) => void; alert: (message: string, tone?: Notice['tone'], title?: string) => void; confirm: (request: Confirmation) => void };
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
  const toast = useCallback((message: string, tone: Notice['tone'] = 'success') => { setToastNotice({ message, tone }); window.setTimeout(() => setToastNotice(null), 3200); }, []);
  const alert = useCallback((message: string, tone: Notice['tone'] = 'error', title?: string) => setAlertNotice({ message, tone, title }), []);
  const confirm = useCallback((request: Confirmation) => setConfirmation(request), []);
  const Icon = ({ tone }: { tone: Notice['tone'] }) => tone === 'success' ? <CheckCircle2 /> : tone === 'warning' ? <AlertTriangle /> : tone === 'info' ? <Info /> : <AlertTriangle />;
  const runConfirm = async () => { if (!confirmation) return; const current = confirmation; setConfirmation(null); await current.onConfirm(); };
  return <NotificationContext.Provider value={{ toast, alert, confirm }}>{children}
    {toastNotice && <div className={`fixed right-5 top-5 z-[100] flex max-w-sm items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold shadow-2xl ${toastNotice.tone === 'success' ? 'border-emerald-200 text-emerald-800' : 'border-red-200 text-red-800'}`}><Icon tone={toastNotice.tone} /><span>{toastNotice.message}</span><button onClick={() => setToastNotice(null)}><X size={16} /></button></div>}
    {alertNotice && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-3xl bg-[#F6F1E7] p-6 shadow-2xl"><div className="flex items-start gap-3"><span className="text-red-700"><Icon tone={alertNotice.tone} /></span><div className="flex-1"><h3 className="text-lg font-bold text-[#4f3828]">{alertNotice.title || (alertNotice.tone === 'success' ? 'Thành công' : 'Không thể thực hiện')}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#6f5b4d]">{alertNotice.message}</p></div><button onClick={() => setAlertNotice(null)} className="text-[#806d60]"><X /></button></div><button onClick={() => setAlertNotice(null)} className="mt-6 w-full rounded-xl bg-[#69452f] px-4 py-3 font-bold text-white">Đã hiểu</button></div></div>}
    {confirmation && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-3xl bg-[#F6F1E7] p-6 shadow-2xl"><div className="flex items-start gap-3"><span className="text-amber-700"><Icon tone="warning" /></span><div className="flex-1"><h3 className="text-lg font-bold text-[#4f3828]">{confirmation.title || 'Xác nhận thao tác'}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#6f5b4d]">{confirmation.message}</p></div><button onClick={() => setConfirmation(null)} className="text-[#806d60]"><X /></button></div><div className="mt-6 flex justify-end gap-3"><button onClick={() => setConfirmation(null)} className="rounded-xl border border-[#d8c8bb] px-4 py-3 font-semibold text-[#6f5b4d]">{confirmation.cancelText || 'Hủy'}</button><button onClick={runConfirm} className="rounded-xl bg-red-700 px-4 py-3 font-bold text-white">{confirmation.confirmText || 'Xác nhận'}</button></div></div></div>}
  </NotificationContext.Provider>;
}
