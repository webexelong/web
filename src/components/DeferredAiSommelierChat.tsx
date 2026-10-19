import { lazy, Suspense, useState } from 'react';
import { Sparkles } from 'lucide-react';

const AiSommelierChat = lazy(() => import('./AiSommelierChat'));

export default function DeferredAiSommelierChat() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <div className="fixed bottom-20 md:bottom-8 right-3 sm:right-8 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Khung Chat với AI Sommelier"
          className="group relative flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full bg-gradient-to-r from-[#2C2420] via-[#3E2D27] to-[#1E1715] text-amber-100 shadow-2xl hover:shadow-amber-900/30 hover:-translate-y-0.5 transition-all duration-300 border border-amber-500/40 active:scale-95 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-stone-900 shadow-sm group-hover:rotate-12 transition-transform">
            <Sparkles size={16} className="text-stone-900" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-[10px] text-amber-300/80 uppercase tracking-wider font-bold">Chuyên gia ẩm thực</div>
            <div className="text-xs font-bold text-white">Chat cùng AI Sommelier</div>
          </div>
          <span className="sm:hidden text-xs font-bold text-white pr-1">Hỏi AI Sommelier</span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#2C2420] animate-ping" />
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="fixed bottom-20 md:bottom-8 right-3 sm:right-8 z-40 rounded-full bg-[#2C2420] px-4 py-3 text-xs font-bold text-white" role="status">Đang mở AI Sommelier...</div>}>
      <AiSommelierChat mode="floating" isOpen onClose={() => setIsOpen(false)} />
    </Suspense>
  );
}
