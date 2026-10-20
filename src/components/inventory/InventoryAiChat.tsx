import { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  X, 
  RotateCcw, 
  Package, 
  TrendingUp, 
  AlertTriangle,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { inventoryApi } from '../../api/apis';
import { useNotification } from '../NotificationProvider';
import type { 
  InventoryAiChatRequestDto, 
  InventoryAiChatResponseDto,
  AiChatMessageDto 
} from '../../types/apiTypes';

interface InventoryChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  responseDto?: InventoryAiChatResponseDto;
  quickFollowUps?: string[];
  timestamp: string;
}

interface InventoryAiChatProps {
  storeId?: number;
  lowStockCount?: number;
}

const DEFAULT_STARTER_PROMPTS = [
  '⚠️ Nguyên liệu nào đang sắp hết cần nhập gấp?',
  '🔥 Món nào bán chạy nhất trong 30 ngày qua?',
  '📈 Nếu doanh số tăng 20%, cần nhập thêm bao nhiêu nguyên liệu?',
  '📦 Đề xuất danh sách và số lượng nhập kho tuần tới'
];

export default function InventoryAiChat({ storeId = 0, lowStockCount = 0 }: InventoryAiChatProps) {
  const { confirm } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [isAiConnected, setIsAiConnected] = useState<boolean>(true);
  const [aiModelLabel, setAiModelLabel] = useState<string>('3.5 Flash');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const storageKey = `inventory_ai_chat_history_store_${storeId}`;

  const defaultWelcomeMessage: InventoryChatMessage = {
    id: 'welcome',
    role: 'model',
    content: 'Xin chào Quản lý! Tôi là Trợ lý AI Quản lý Kho của WebCafe. Tôi được kết nối trực tiếp với dữ liệu tồn kho và đơn hàng của quán để hỗ trợ bạn tính toán số lượng nhập hàng tối ưu, tránh thiếu hụt nguyên liệu cho các món bán chạy.',
    quickFollowUps: DEFAULT_STARTER_PROMPTS,
    timestamp: new Date().toISOString()
  };

  const [messages, setMessages] = useState<InventoryChatMessage[]>(() => {
    try {
      if (storeId > 0) {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Không thể đọc lịch sử chat kho từ localStorage:', e);
    }
    return [defaultWelcomeMessage];
  });

  // Tải lại lịch sử khi storeId thay đổi
  useEffect(() => {
    if (storeId <= 0) return;
    try {
      const saved = localStorage.getItem(`inventory_ai_chat_history_store_${storeId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setMessages([defaultWelcomeMessage]);
  }, [storeId]);

  // Lưu lịch sử khi messages thay đổi
  useEffect(() => {
    if (storeId <= 0) return;
    try {
      localStorage.setItem(`inventory_ai_chat_history_store_${storeId}`, JSON.stringify(messages));
    } catch (e) {
      console.warn('Không thể lưu lịch sử chat kho:', e);
    }
  }, [messages, storeId]);

  // Cuộn xuống cuối
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // Focus input khi mở
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const handleResetChat = () => {
    confirm({ tone: 'warning', title: 'Xóa lịch sử trò chuyện?', message: 'Bạn có chắc muốn xóa lịch sử cuộc trò chuyện AI kho này?', confirmText: 'Xóa lịch sử', onConfirm: async () => {
      const resetList = [defaultWelcomeMessage];
      setMessages(resetList);
      setErrorMessage(null);
      if (storeId > 0) {
        localStorage.removeItem(`inventory_ai_chat_history_store_${storeId}`);
      }
    }});
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    if (!storeId || storeId <= 0) {
      setErrorMessage('Vui lòng chọn cửa hàng để AI có thể phân tích dữ liệu kho.');
      return;
    }

    setErrorMessage(null);
    setLastFailedMessage(null);

    const userMsg: InventoryChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      // Chuẩn bị lịch sử hội thoại gửi lên Backend
      const historyDto: AiChatMessageDto[] = messages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const requestDto: InventoryAiChatRequestDto = {
        storeId,
        message: text,
        periodDays: 30,
        history: historyDto
      };

      const res = await inventoryApi.chatWithAi(requestDto);

      if (res) {
        setIsAiConnected(res.isAiGenerated);
        setAiModelLabel(res.isAiGenerated ? '3.5 Flash' : 'Thống Kê');
        const botMsg: InventoryChatMessage = {
          id: `model-${Date.now()}`,
          role: 'model',
          content: res.reply || 'Đã phân tích xong dữ liệu kho của cửa hàng.',
          responseDto: res,
          quickFollowUps: res.quickFollowUps?.length ? res.quickFollowUps : DEFAULT_STARTER_PROMPTS.slice(0, 3),
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error('Không nhận được dữ liệu phản hồi từ máy chủ.');
      }
    } catch (err: any) {
      console.error('Lỗi khi chat cùng Trợ lý kho AI:', err);
      setIsAiConnected(false);
      setAiModelLabel('Mất kết nối');
      setLastFailedMessage(text);
      if (err?.response?.status === 401) {
        setErrorMessage('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      } else if (err?.response?.status === 403) {
        setErrorMessage('Tài khoản của bạn không có quyền quản lý cửa hàng này.');
      } else if (err?.message?.includes('timeout') || err?.code === 'ECONNABORTED') {
        setErrorMessage('Kết nối quá hạn (timeout). Trợ lý AI đang xử lý khối lượng lớn dữ liệu, vui lòng thử lại.');
      } else {
        setErrorMessage(err?.response?.data?.message || err?.message || 'Không thể kết nối với Trợ lý kho AI lúc này.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Nút bấm nổi Floating Action Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
          {lowStockCount > 0 && (
            <div className="mb-2 flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-lg animate-bounce">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{lowStockCount} nguyên liệu sắp hết</span>
            </div>
          )}
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-amber-600 to-amber-700 px-5 py-3.5 text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:from-amber-700 hover:to-amber-800 focus:outline-none focus:ring-4 focus:ring-amber-300"
            title="Mở Trợ Lý Nhập Kho AI"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-white shadow-inner">
                <Bot className="h-5 w-5 transition-transform group-hover:rotate-12" />
              </div>
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-amber-700 ${
                  isAiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
                title={isAiConnected ? 'AI Trực Tuyến' : 'Chế độ Dự Phòng'}
              />
            </div>
            <span className="font-semibold text-sm tracking-wide">Trợ lý Kho AI</span>
            <span className="text-[10px] bg-amber-500/25 text-amber-200 font-bold px-1.5 py-0.5 rounded border border-amber-300/30 flex items-center gap-0.5">
              <Sparkles size={9} /> {aiModelLabel}
            </span>
          </button>
        </div>
      )}

      {/* Hộp thoại Chat Floating Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[620px] w-[95vw] max-w-[460px] flex-col overflow-hidden rounded-3xl border border-outline-variant/40 bg-surface shadow-2xl backdrop-blur-xl transition-all duration-300">
          {/* Header - Thiết kế chuẩn theo phong cách AI Sommelier */}
          <div className="bg-gradient-to-r from-[#2C2420] via-[#3E2D27] to-[#1E1715] text-amber-50 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between shadow-md border-b border-amber-900/40 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-white shadow-inner">
                  <Bot size={18} className="drop-shadow" />
                </div>
                {/* Biểu tượng trạng thái kết nối nhấp nháy xanh lá */}
                <span
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#2C2420] ${
                    isAiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                  }`}
                  title={isAiConnected ? 'Đã kết nối AI Gemini' : 'Chế độ dự phòng'}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold tracking-wide text-white truncate">Trợ Lý Kho AI</h3>
                  <span className="text-[9px] sm:text-[10px] bg-amber-500/20 text-amber-300 font-semibold px-1.5 py-0.5 rounded border border-amber-400/30 flex items-center gap-0.5 shrink-0">
                    <Sparkles size={9} /> {aiModelLabel}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-amber-200/70 truncate">
                  <span>Trợ lý chuỗi cung ứng & kho {storeId > 0 ? `· #${storeId}` : ''}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleResetChat}
                title="Làm mới cuộc trò chuyện"
                className="p-1.5 sm:p-2 text-stone-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Đóng khung chat"
                className="p-1.5 sm:p-2 text-amber-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                aria-label="Đóng khung chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body: Danh sách tin nhắn */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-lowest/50">
            {messages.map(msg => {
              const isUser = msg.role === 'user';
              const isAi = msg.responseDto?.isAiGenerated ?? false;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      isUser
                        ? 'bg-amber-600 text-white rounded-tr-none'
                        : 'bg-white border border-outline-variant/30 text-on-surface rounded-tl-none'
                    }`}
                  >
                    {/* Badge nguồn phân tích */}
                    {!isUser && msg.id !== 'welcome' && (
                      <div className="mb-2 flex items-center justify-between gap-2 border-b border-outline-variant/20 pb-1.5 text-[11px]">
                        <span className="font-medium text-on-surface-variant flex items-center gap-1">
                          <Bot className="h-3 w-3 text-amber-600" />
                          Trợ lý kho
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isAi
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          {isAi ? 'AI Gemini phân tích' : 'Thống kê tự động'}
                        </span>
                      </div>
                    )}

                    {/* Nội dung tin nhắn */}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                    {/* Thông tin món bán chạy */}
                    {!isUser && msg.responseDto?.topSellingItems && msg.responseDto.topSellingItems.length > 0 && (
                      <div className="mt-3 rounded-xl bg-amber-50/70 p-2.5 border border-amber-200/50">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 mb-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                          <span>Món bán chạy 30 ngày qua:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.responseDto.topSellingItems.map(item => (
                            <span
                              key={item.menuItemId}
                              className="inline-flex items-center rounded-lg bg-white px-2 py-1 text-xs font-medium text-amber-950 border border-amber-200/60 shadow-2xs"
                            >
                              {item.menuItemName}
                              <strong className="ml-1 text-amber-700 font-bold">({item.soldQuantity} phần)</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Danh sách đề xuất nhập nguyên liệu */}
                    {!isUser && msg.responseDto?.recommendations && msg.responseDto.recommendations.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant">
                          <Package className="h-3.5 w-3.5 text-amber-600" />
                          <span>Đề xuất nhập nguyên liệu:</span>
                        </div>
                        <div className="grid gap-2">
                          {msg.responseDto.recommendations.map((rec, idx) => {
                            const isCritical = rec.priority?.toLowerCase() === 'critical';
                            const isHigh = rec.priority?.toLowerCase() === 'high';

                            return (
                              <div
                                key={`${rec.ingredientName}-${idx}`}
                                className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-2.5 transition-all hover:border-amber-400"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-xs text-on-surface">
                                    {rec.ingredientName}
                                  </span>
                                  <span
                                    className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                                      isCritical
                                        ? 'bg-red-100 text-red-700 border border-red-200'
                                        : isHigh
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    }`}
                                  >
                                    + {rec.suggestedQuantity} {rec.unit}
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] text-on-surface-variant leading-snug">
                                  {rec.reason}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Thời gian */}
                  <span className="mt-1 px-1 text-[10px] text-outline">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {/* Gợi ý câu hỏi tiếp theo (chỉ hiện ở tin nhắn bot cuối cùng) */}
                  {!isUser && msg.quickFollowUps && msg.quickFollowUps.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 max-w-[92%]">
                      {msg.quickFollowUps.map((prompt, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleSendMessage(prompt)}
                          disabled={loading}
                          className="rounded-full border border-amber-300/80 bg-amber-50/70 px-3 py-1 text-xs text-amber-900 transition-all hover:bg-amber-100 hover:border-amber-400 active:scale-95 disabled:opacity-50 text-left"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading indicator */}
            {loading && (
              <div className="flex items-center gap-2 rounded-2xl bg-white border border-outline-variant/30 p-3 max-w-[80%] text-xs text-on-surface-variant shadow-sm">
                <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
                <span>AI đang phân tích đơn hàng và tính toán định lượng kho...</span>
              </div>
            )}

            {/* Error Message Box */}
            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 shadow-sm flex items-start justify-between gap-2">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
                {lastFailedMessage && (
                  <button
                    onClick={() => handleSendMessage(lastFailedMessage)}
                    className="shrink-0 rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                  >
                    Thử lại
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <div className="border-t border-outline-variant/30 bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={loading}
                placeholder="Hỏi AI: Cần nhập thêm gì tuần này?..."
                className="flex-1 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-60"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={loading || !inputMessage.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md transition-all hover:from-amber-700 hover:to-amber-800 active:scale-95 disabled:opacity-40 disabled:hover:from-amber-600"
                title="Gửi câu hỏi"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-outline">
              Đề xuất từ AI mang tính tham khảo dựa trên tồn kho thực tế và doanh số.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
