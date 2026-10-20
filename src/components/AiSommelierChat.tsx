import { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  X, 
  RotateCcw, 
  ShoppingCart, 
  Check, 
  Coffee,
  SlidersHorizontal,
  Plus,
  Minus,
  Flame,
  Snowflake
} from 'lucide-react';
import { aiApi } from '../api/apis';
import { useStore } from '../store/useStore';
import type { 
  AiChatMessageDto, 
  AiRecommendedItemDto, 
  AiChatResponseDto 
} from '../types/apiTypes';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  suggestedItems?: AiRecommendedItemDto[];
  quickFollowUps?: string[];
  timestamp: Date;
}

interface AiSommelierChatProps {
  mode?: 'floating' | 'embedded';
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
  initialPrompt?: string;
}

const STARTER_PROMPTS = [
  '🌤️ Trời se lạnh, gợi ý món ấm áp & ngọt dịu nhé',
  '⚡ Món nào nhiều caffeine giúp tỉnh táo chạy deadline?',
  '🌿 Đồ uống thanh mát, ít ngọt, healthy',
  '🥐 Quán có món gì kết hợp ăn kèm bánh ngọt ngon?'
];

export default function AiSommelierChat({
  mode = 'floating',
  isOpen: controlledIsOpen,
  onClose,
  className = '',
  initialPrompt
}: AiSommelierChatProps) {
  const { cart, addToCart, currentStoreId, storeInfo } = useStore();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [addedItemIds, setAddedItemIds] = useState<Record<number, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick Customize Modal State (Option 1 + Option 2)
  const [customizingItem, setCustomizingItem] = useState<AiRecommendedItemDto | null>(null);
  const [selectedSize, setSelectedSize] = useState<'Medium' | 'Large'>('Medium');
  const [selectedSugar, setSelectedSugar] = useState<string>('100%');
  const [selectedIce, setSelectedIce] = useState<string>('100%');
  const [quantity, setQuantity] = useState<number>(1);
  const [customNote, setCustomNote] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const storeId = currentStoreId || storeInfo?.storeId || 0;
  const tenantId = storeInfo?.tenantId || 0;

  const defaultWelcomeMessage: ChatMessage = {
    id: 'welcome',
    role: 'model',
    content: 'Dạ xin chào quý khách! Tôi là AI Sommelier của WebCafe. Rất vinh hạnh được đồng hành và tư vấn hương vị ẩm thực cho bạn hôm nay. Hãy chia sẻ với tôi về sở thích, tâm trạng hoặc yêu cầu món ăn đặc biệt của bạn nhé!',
    quickFollowUps: [
      'Gợi ý thức uống đặc sắc hôm nay',
      'Món nào ít ngọt, thanh đạm?',
      'Đồ uống giải nhiệt buổi chiều'
    ],
    timestamp: new Date()
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('ai_sommelier_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
          }));
        }
      }
    } catch (e) {
      console.warn('Không thể đọc lịch sử chat từ localStorage:', e);
    }
    return [defaultWelcomeMessage];
  });

  // Tự động lưu lịch sử hội thoại vào localStorage
  useEffect(() => {
    try {
      if (messages && messages.length > 0) {
        localStorage.setItem('ai_sommelier_chat_history', JSON.stringify(messages));
      }
    } catch (e) {
      console.warn('Không thể lưu lịch sử chat vào localStorage:', e);
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  const handleToggle = () => {
    if (controlledIsOpen !== undefined && onClose) {
      onClose();
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  };

  const handleResetChat = () => {
    const initial = [
      {
        ...defaultWelcomeMessage,
        timestamp: new Date()
      }
    ];
    setMessages(initial);
    try {
      localStorage.removeItem('ai_sommelier_chat_history');
    } catch (e) {
      console.warn('Không thể xóa lịch sử chat:', e);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  };

  const handleOpenCustomize = (item: AiRecommendedItemDto) => {
    setCustomizingItem(item);
    setSelectedSize((item.suggestedSize === 'Large' ? 'Large' : 'Medium') as 'Medium' | 'Large');
    setSelectedSugar(item.suggestedSugarLevel || '100%');
    setSelectedIce(item.suggestedIceLevel || '100%');
    setQuantity(1);
    setCustomNote('');
  };

  const handleConfirmAddToCart = () => {
    if (!customizingItem) return;
    const isDrink = customizingItem.isDrink !== false;
    const sizeExtra = selectedSize === 'Large' ? 15000 : 0;
    
    addToCart({
      id: customizingItem.menuItemId.toString(),
      name: customizingItem.name,
      price: customizingItem.price,
      categoryId: customizingItem.categoryName || 'AI Gợi Ý',
      description: customizingItem.reason,
      image: customizingItem.imageUrl || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&q=80'
    }, {
      quantity,
      sizeName: selectedSize === 'Large' ? 'Lớn (L)' : 'Vừa (M)',
      sizeExtra,
      sugarLevel: isDrink ? selectedSugar : undefined,
      iceLevel: isDrink ? selectedIce : undefined,
      note: customNote.trim() || undefined
    });

    setAddedItemIds(prev => ({ ...prev, [customizingItem.menuItemId]: true }));
    const optionsText = isDrink ? ` (${selectedSize === 'Large' ? 'Size L' : 'Size M'}, ${selectedSugar} đường, ${selectedIce} đá)` : '';
    showToast(`Đã thêm "${customizingItem.name}"${optionsText} vào giỏ!`);

    setTimeout(() => {
      setAddedItemIds(prev => ({ ...prev, [customizingItem.menuItemId]: false }));
    }, 2000);

    setCustomizingItem(null);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      // Build history
      const historyPayload: AiChatMessageDto[] = messages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      // Cart items
      const cartItemIds = cart
        .map(c => parseInt(c.id, 10))
        .filter(id => !isNaN(id) && id > 0);

      const response: AiChatResponseDto = await aiApi.chatWithSommelier({
        storeId,
        tenantId,
        message: text,
        history: historyPayload,
        currentCartItemIds: cartItemIds
      });

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: response.reply,
        suggestedItems: response.suggestedItems || [],
        quickFollowUps: response.quickFollowUps || [],
        timestamp: new Date()
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (err) {
      console.error('Lỗi khi chat với AI Sommelier:', err);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: 'Xin lỗi quý khách, hệ thống đang bận một chút. Quý khách vui lòng gửi lại câu hỏi hoặc chọn một trong các gợi ý bên dưới nhé!',
          quickFollowUps: STARTER_PROMPTS.slice(0, 2),
          timestamp: new Date()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Chat window core content
  const renderChatContent = () => (
    <div className="flex flex-col h-full bg-[#FAF8F5] text-stone-800 relative">
      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border border-amber-500/30 animate-fade-in">
          <Check size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#2C2420] via-[#3E2D27] to-[#1E1715] text-amber-50 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between shadow-md border-b border-amber-900/40 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-white shadow-inner">
              <Bot size={18} className="drop-shadow" />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#2C2420] animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold tracking-wide text-white truncate">AI Sommelier</h3>
              <span className="text-[9px] sm:text-[10px] bg-amber-500/20 text-amber-300 font-semibold px-1.5 py-0.2 rounded border border-amber-400/30 flex items-center gap-0.5 shrink-0">
                <Sparkles size={9} /> 3.6 Flash
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-amber-200/70 truncate">
              <span>Trợ lý ẩm thực cao cấp</span>
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
          {mode === 'floating' && (
            <button
              onClick={handleToggle}
              className="p-1.5 sm:p-2 text-amber-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
              aria-label="Đóng khung chat"
            >
              <X size={18} />
              <span className="sm:hidden text-xs">Đóng</span>
            </button>
          )}
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3.5 text-xs sm:text-sm">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              <div className={`flex items-start gap-2 max-w-[94%] sm:max-w-[88%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isUser && (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-800 text-white shrink-0 flex items-center justify-center text-xs shadow-sm mt-0.5">
                    <Coffee size={13} />
                  </div>
                )}
                
                <div
                  className={`p-3 sm:p-3.5 rounded-2xl shadow-sm leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-amber-800 to-amber-900 text-white rounded-tr-none'
                      : 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.content.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
                </div>
              </div>

              {/* Suggested Dish Cards (Interactive) */}
              {!isUser && msg.suggestedItems && msg.suggestedItems.length > 0 && (
                <div className="w-full pl-0 sm:pl-8 pr-0 sm:pr-2 mt-2 space-y-2">
                  <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1 px-1">
                    <Sparkles size={12} className="text-amber-600 shrink-0" />
                    <span>Món Sommelier khuyên dùng:</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {msg.suggestedItems.map((item) => {
                      const isAdded = addedItemIds[item.menuItemId];
                      return (
                        <div
                          key={item.menuItemId}
                          onClick={() => handleOpenCustomize(item)}
                          className="bg-white rounded-2xl p-2.5 sm:p-3 border border-amber-200/80 shadow-xs hover:shadow-md transition-all flex items-center gap-2.5 sm:gap-3 group cursor-pointer hover:border-amber-400/80 active:scale-[0.99]"
                        >
                          <img
                            src={item.imageUrl || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200&q=80'}
                            alt={item.name}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0 group-hover:scale-105 transition-transform shadow-xs"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-bold text-stone-900 text-xs sm:text-sm truncate">
                                {item.name}
                              </span>
                              {item.badge && (
                                <span className="text-[9px] bg-amber-100 text-amber-900 font-semibold px-1.5 py-0.2 rounded-full shrink-0">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                              {item.reason}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-xs sm:text-sm font-black text-amber-800">
                                {item.price.toLocaleString('vi-VN')}đ
                              </span>
                              {/* AI Flavor Suggestion Badge */}
                              {item.isDrink !== false && (item.suggestedSugarLevel || item.suggestedIceLevel) && (
                                <span className="text-[9px] bg-amber-50 border border-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 shrink-0">
                                  <Sparkles size={9} className="text-amber-600" />
                                  <span>{item.suggestedSugarLevel || '100%'} đ • {item.suggestedIceLevel || '100%'} đá</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCustomize(item);
                            }}
                            disabled={isAdded}
                            className={`px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 shadow-sm cursor-pointer ${
                              isAdded
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-800 text-white active:scale-95'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check size={12} /> <span className="hidden xs:inline">Đã thêm</span>
                              </>
                            ) : (
                              <>
                                <SlidersHorizontal size={12} /> <span className="whitespace-nowrap">Tùy chọn</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Follow-up Question Chips */}
              {!isUser && msg.quickFollowUps && msg.quickFollowUps.length > 0 && (
                <div className="w-full pl-0 sm:pl-8 pr-0 sm:pr-2 mt-1.5 flex flex-wrap gap-1.5">
                  {msg.quickFollowUps.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      disabled={loading}
                      className="text-[11px] bg-stone-100 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 border border-stone-200 text-stone-700 px-2.5 py-1 rounded-full transition-all text-left flex items-center gap-1 active:scale-95 cursor-pointer"
                    >
                      <span>💬</span>
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-start gap-2 max-w-[90%] sm:max-w-[85%] animate-pulse">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-800 text-white shrink-0 flex items-center justify-center text-xs shadow-sm mt-0.5">
              <Bot size={13} />
            </div>
            <div className="bg-white border border-stone-200/80 p-2.5 sm:p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[11px] text-stone-500 font-medium">Sommelier đang lựa chọn hương vị...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Starter Prompts Bar (when only welcome message) */}
      {messages.length === 1 && !loading && (
        <div className="p-2.5 sm:p-3 border-t border-stone-200/60 bg-amber-50/40 shrink-0">
          <p className="text-[11px] font-semibold text-stone-500 mb-1.5 flex items-center gap-1">
            <Sparkles size={12} className="text-amber-600" />
            <span>Chủ đề gợi ý mở đầu câu chuyện:</span>
          </p>
          <div className="flex sm:grid sm:grid-cols-2 gap-1.5 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
            {STARTER_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(prompt)}
                className="whitespace-nowrap sm:whitespace-normal text-left text-xs bg-white hover:bg-amber-100/70 border border-stone-200 hover:border-amber-400/60 text-stone-700 px-3 py-2 sm:p-2 rounded-xl transition-all shadow-xs cursor-pointer shrink-0 sm:shrink"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar - Always pinned at bottom */}
      <div className="p-2.5 sm:p-3 bg-white border-t border-stone-200/80 shadow-lg shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Hỏi AI Sommelier (vị ngọt, thời tiết, món ăn kèm...)"
            disabled={loading}
            className="flex-1 bg-stone-100 hover:bg-stone-50 focus:bg-white text-stone-900 placeholder-stone-400 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-stone-200 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || loading}
            className="p-2.5 bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-800 hover:to-amber-950 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* Mini Customization Sheet (Native Mobile Bottom Sheet) */}
      {customizingItem && (
        <div className="absolute inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150">
          <div 
            onClick={() => setCustomizingItem(null)} 
            className="flex-1 cursor-pointer"
          />
          <div className="bg-[#FAF8F5] rounded-t-3xl p-4 sm:p-5 shadow-2xl border-t border-amber-300/80 space-y-3.5 max-h-[88%] overflow-y-auto animate-in slide-in-from-bottom-8 duration-200 text-stone-800 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto -mt-1 mb-2" />

            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-stone-200">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={customizingItem.imageUrl || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200&q=80'}
                  alt={customizingItem.name}
                  className="w-12 h-12 rounded-xl object-cover shadow-sm shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="font-bold text-stone-900 text-sm truncate">{customizingItem.name}</h4>
                  <span className="text-xs font-black text-amber-800">
                    {((customizingItem.price + (selectedSize === 'Large' ? 15000 : 0)) * quantity).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200 transition-colors cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* AI Recommendation Callout */}
            {customizingItem.isDrink !== false && (customizingItem.suggestedSugarLevel || customizingItem.suggestedIceLevel) && (
              <div className="bg-amber-100/80 border border-amber-300/80 rounded-xl p-2.5 flex items-start gap-2 text-xs text-amber-950">
                <Sparkles size={16} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Sommelier khuyên dùng: </span>
                  <span className="font-semibold">
                    {customizingItem.suggestedSugarLevel && `${customizingItem.suggestedSugarLevel} đường`}
                    {customizingItem.suggestedSugarLevel && customizingItem.suggestedIceLevel && ' • '}
                    {customizingItem.suggestedIceLevel && `${customizingItem.suggestedIceLevel} đá`}
                  </span>
                  <span className="text-[10px] text-amber-800/80 block mt-0.5">
                    ✓ Đã được tự động chọn sẵn theo khẩu vị của bạn!
                  </span>
                </div>
              </div>
            )}

            {/* Size Selection */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-800">Kích Cỡ (Size):</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Medium', 'Large'] as const).map(s => {
                  const isSelected = selectedSize === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between border cursor-pointer ${
                        isSelected
                          ? 'bg-amber-800 text-white border-amber-900 shadow-sm'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-amber-50/50'
                      }`}
                    >
                      <span>{s === 'Medium' ? 'Vừa (M)' : 'Lớn (L)'}</span>
                      <span className={isSelected ? 'text-amber-200 text-[11px]' : 'text-stone-400 text-[11px]'}>
                        {s === 'Large' ? '+15.000đ' : 'Tiêu chuẩn'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sugar & Ice for Drinks */}
            {customizingItem.isDrink !== false && (
              <>
                {/* Sugar Level */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-800">Lượng Đường:</label>
                    <span className="text-xs text-amber-800 font-bold">{selectedSugar}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {['0%', '30%', '50%', '70%', '100%'].map(sugar => {
                      const isSelected = selectedSugar === sugar;
                      const isAiPick = customizingItem.suggestedSugarLevel === sugar;
                      return (
                        <button
                          key={sugar}
                          type="button"
                          onClick={() => setSelectedSugar(sugar)}
                          className={`py-2.5 sm:py-2 min-h-[40px] rounded-xl text-xs font-bold transition-all relative border flex items-center justify-center cursor-pointer active:scale-95 ${
                            isSelected
                              ? 'bg-amber-800 text-white border-amber-900 shadow-xs'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-amber-50/50'
                          }`}
                        >
                          {sugar}
                          {isAiPick && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-1 ring-white" title="AI khuyên dùng" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ice Level */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-800">Lượng Đá / Nhiệt Độ:</label>
                    <span className="text-xs text-amber-800 font-bold">{selectedIce}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['Nóng', '0%', '50%', '100%'].map(ice => {
                      const isSelected = selectedIce === ice;
                      const isAiPick = customizingItem.suggestedIceLevel === ice;
                      const label = ice === 'Nóng' ? 'Nóng' : ice === '0%' ? 'K.Đá' : ice === '50%' ? '50% Đá' : '100% Đá';
                      return (
                        <button
                          key={ice}
                          type="button"
                          onClick={() => setSelectedIce(ice)}
                          className={`py-2.5 sm:py-2 min-h-[40px] rounded-xl text-xs font-bold transition-all relative border flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                            isSelected
                              ? 'bg-amber-800 text-white border-amber-900 shadow-xs'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-amber-50/50'
                          }`}
                        >
                          {ice === 'Nóng' && <Flame size={13} className={isSelected ? 'text-amber-200' : 'text-orange-500'} />}
                          {ice !== 'Nóng' && <Snowflake size={13} className={isSelected ? 'text-amber-200' : 'text-sky-500'} />}
                          <span>{label}</span>
                          {isAiPick && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-1 ring-white" title="AI khuyên dùng" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Quantity */}
            <div className="flex items-center justify-between pt-1">
              <label className="text-xs font-bold text-stone-800">Số Lượng:</label>
              <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-2 py-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => setQuantity(q => (q > 1 ? q - 1 : 1))}
                  className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-800 active:scale-90 transition-transform cursor-pointer"
                >
                  <Minus size={15} />
                </button>
                <span className="text-xs sm:text-sm font-black w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-amber-800 text-white hover:bg-amber-900 flex items-center justify-center active:scale-90 transition-transform cursor-pointer shadow-xs"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>

            {/* Note input */}
            <div>
              <input
                type="text"
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                placeholder="Ghi chú thêm cho quán (ví dụ: ít sữa, để đá riêng...)"
                className="w-full text-xs bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-600"
              />
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleConfirmAddToCart}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-800 hover:to-amber-950 text-white text-xs sm:text-sm font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingCart size={16} />
              <span>Thêm Vào Giỏ Hàng — {((customizingItem.price + (selectedSize === 'Large' ? 15000 : 0)) * quantity).toLocaleString('vi-VN')}đ</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // If embedded mode:
  if (mode === 'embedded') {
    return (
      <div className={`rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border border-stone-200/80 bg-white h-[calc(100dvh-170px)] sm:h-[650px] min-h-[440px] flex flex-col ${className}`}>
        {renderChatContent()}
      </div>
    );
  }

  // If floating mode:
  return (
    <>
      {/* Floating Toggle Button */}
      <div className="fixed bottom-20 md:bottom-8 right-3 sm:right-8 z-40">
        <button
          onClick={handleToggle}
          aria-label="Khung Chat với AI Sommelier"
          className="group relative flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full bg-gradient-to-r from-[#2C2420] via-[#3E2D27] to-[#1E1715] text-amber-100 shadow-2xl hover:shadow-amber-900/30 hover:-translate-y-0.5 transition-all duration-300 border border-amber-500/40 active:scale-95 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-stone-900 shadow-sm group-hover:rotate-12 transition-transform">
            <Sparkles size={16} className="text-stone-900" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-[10px] text-amber-300/80 uppercase tracking-wider font-bold">Chuyên gia ẩm thực</div>
            <div className="text-xs font-bold text-white flex items-center gap-1">
              Chat cùng AI Sommelier
            </div>
          </div>
          <span className="sm:hidden text-xs font-bold text-white pr-1">Hỏi AI Sommelier</span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#2C2420] animate-ping" />
        </button>
      </div>

      {/* Floating Modal / Fullscreen on mobile (z-[150] to always sit above MobileBottomNav) */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-8 z-[150] flex flex-col items-end justify-end">
          {/* Desktop Backdrop */}
          <div
            onClick={handleToggle}
            className="hidden sm:block fixed inset-0 bg-stone-900/40 backdrop-blur-xs -z-10 transition-opacity"
          />

          {/* Window: Full viewport on mobile, floating card on desktop */}
          <div className="w-full sm:w-[440px] h-[100dvh] sm:h-[640px] sm:max-h-[90vh] sm:rounded-3xl rounded-none overflow-hidden shadow-2xl border-0 sm:border sm:border-stone-300/60 bg-[#FAF8F5] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
            {renderChatContent()}
          </div>
        </div>
      )}
    </>
  );
}
