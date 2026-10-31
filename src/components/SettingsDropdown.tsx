import { useState, useRef, useEffect } from 'react';
import { useThemeStore, type ThemeMode } from '../store/themeStore';
import { notificationService } from '../services/notificationService';

interface SettingsDropdownProps {
  isStaff?: boolean;
}

export default function SettingsDropdown({ isStaff = false }: SettingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useThemeStore();
  const [soundEnabled, setSoundEnabled] = useState(notificationService.isNotificationEnabled());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSoundToggle = () => {
    const newState = notificationService.toggle();
    setSoundEnabled(newState);
    if (newState) {
      notificationService.playNewOrderSound();
    }
  };

  const handleTestSound = () => {
    notificationService.playNewOrderSound();
  };

  const themeOptions: { mode: ThemeMode; label: string; icon: string; desc: string }[] = [
    { mode: 'light', label: 'Sáng', icon: 'light_mode', desc: 'Tone sáng thanh lịch' },
    { mode: 'dark', label: 'Tối', icon: 'dark_mode', desc: 'Tone cà phê ấm dịu mắt' },
    { mode: 'system', label: 'Hệ thống', icon: 'desktop_windows', desc: 'Tự động theo thiết bị' },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Gear Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high dark:hover:bg-white/10 transition-colors text-on-surface-variant dark:text-[#F3EDE6] border border-outline-variant/30 dark:border-white/10"
        aria-label="Cài đặt giao diện"
        aria-expanded={isOpen}
      >
        <span className={`material-symbols-outlined text-lg sm:text-xl transition-transform duration-300 ${isOpen ? 'rotate-90 text-primary dark:text-amber-400' : ''}`}>
          settings
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-[#1E1714] border border-outline-variant/30 dark:border-white/10 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-outline-variant/20 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary dark:text-amber-400 text-lg">tune</span>
              <span className="text-sm font-bold text-on-surface dark:text-[#F3EDE6]">Cài Đặt Ứng Dụng</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-on-surface-variant dark:text-stone-400 hover:text-on-surface p-1 rounded-lg"
              aria-label="Đóng"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          {/* Theme Mode Section */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-on-surface-variant dark:text-[#A4968C] uppercase tracking-wider block">
              Giao Diện
            </span>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((opt) => {
                const isActive = theme === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => setTheme(opt.mode)}
                    className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl text-xs font-semibold transition-all border ${
                      isActive
                        ? 'bg-primary/10 dark:bg-amber-500/20 text-primary dark:text-amber-300 border-primary/40 dark:border-amber-500/40 shadow-xs'
                        : 'bg-surface-container-low dark:bg-[#251D19] text-on-surface-variant dark:text-[#A4968C] border-outline-variant/20 dark:border-white/5 hover:bg-surface-container-high dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
                      {opt.icon}
                    </span>
                    <span className="text-[11px] leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-on-surface-variant/80 dark:text-[#A4968C] pt-1">
              {theme === 'system' 
                ? 'Đang tự động đồng bộ theo chế độ sáng/tối của thiết bị.' 
                : theme === 'dark' 
                  ? 'Chế độ tối Warm Espresso dịu mắt cho ban đêm.' 
                  : 'Chế độ sáng thanh lịch cho ban ngày.'}
            </p>
          </div>

          {/* Staff Sound Notifications (Only for Staff role) */}
          {isStaff && (
            <div className="mt-4 pt-3 border-t border-outline-variant/20 dark:border-white/10 space-y-2.5">
              <span className="text-xs font-bold text-on-surface-variant dark:text-[#A4968C] uppercase tracking-wider block">
                Âm Thanh Đơn Mới
              </span>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low dark:bg-[#251D19] border border-outline-variant/15 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-primary dark:text-amber-400">
                    {soundEnabled ? 'volume_up' : 'volume_off'}
                  </span>
                  <span className="text-xs font-bold text-on-surface dark:text-[#F3EDE6]">
                    Chuông báo đơn
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSoundToggle}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                    soundEnabled ? 'bg-primary dark:bg-amber-600' : 'bg-gray-300 dark:bg-stone-700'
                  }`}
                  role="switch"
                  aria-checked={soundEnabled}
                  aria-label="Bật tắt âm thanh đơn mới"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out mt-0.5 ${
                      soundEnabled ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {soundEnabled && (
                <button
                  type="button"
                  onClick={handleTestSound}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-surface-container dark:bg-[#2C221D] hover:bg-surface-container-high dark:hover:bg-white/10 text-xs text-primary dark:text-amber-300 font-bold transition-all"
                >
                  <span className="material-symbols-outlined text-sm">notifications_active</span>
                  <span>Nghe thử chuông</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
