import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import MobileBottomNav from '../../components/MobileBottomNav';
import { useStore } from '../../store/useStore';
import { Sparkles, RefreshCw, Bot, Coffee, Sun, Moon, Utensils, CheckCircle2, Zap, MessageSquare } from 'lucide-react';
import { aiApi } from '../../api/apis';
import type { AiRecommendationResponseDto, AiRecommendedItemDto, AiRecommendedComboDto } from '../../types/apiTypes';
import AiSommelierChat from '../../components/AiSommelierChat';

export default function AIRecommendations() {
  const { cart, addToCart, currentStoreId, storeInfo } = useStore();
  const [recommendationsData, setRecommendationsData] = useState<AiRecommendationResponseDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMood, setSelectedMood] = useState<string>('pairing');
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'suggestions'>('chat');

  const tenantId = storeInfo?.tenantId || 0;
  const storeId = currentStoreId || storeInfo?.storeId || 0;
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Lấy món gần nhất trong giỏ hàng làm điểm nhấn
  const lastCartItem = cart.length > 0 ? cart[cart.length - 1] : null;

  const moodOptions = [
    { id: 'pairing', label: 'Ghép Đôi Giỏ Hàng', icon: Utensils, desc: 'Món kèm chuẩn vị với giỏ hàng của bạn' },
    { id: 'morning', label: 'Năng Lượng Sáng', icon: Sun, desc: 'Tỉnh táo, sảng khoái bắt đầu ngày mới' },
    { id: 'afternoon', label: 'Thư Giãn Chiều', icon: Coffee, desc: 'Thanh mát, giải nhiệt & thư thái' },
    { id: 'evening', label: 'Tráng Miệng & Ngọt Ngào', icon: Moon, desc: 'Hương vị nuông chiều vị giác' },
  ];

  const fetchRecommendations = useCallback(async (mood: string) => {
    setLoading(true);
    try {
      const cartItemIds = cart
        .map(item => parseInt(item.id, 10))
        .filter(id => !isNaN(id) && id > 0);

      const response = await aiApi.getRecommendations({
        storeId,
        tenantId,
        currentCartItemIds: cartItemIds,
        occasion: mood,
        moodOrPreference: moodOptions.find(m => m.id === mood)?.desc || 'Gợi ý món ngon nhất'
      });

      setRecommendationsData(response);
    } catch (err) {
      console.error('Lỗi khi tải gợi ý AI:', err);
    } finally {
      setLoading(false);
    }
  }, [storeId, tenantId, cart]);

  useEffect(() => {
    fetchRecommendations(selectedMood);
  }, [selectedMood, fetchRecommendations]);

  const showToast = (message: string) => {
    setAddedToast(message);
    setTimeout(() => {
      setAddedToast(null);
    }, 2500);
  };

  const handleAddItem = (item: AiRecommendedItemDto) => {
    addToCart({
      id: item.menuItemId.toString(),
      name: item.name,
      price: item.price,
      categoryId: item.categoryName || 'AI Gợi Ý',
      description: item.reason,
      image: item.imageUrl || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&q=80'
    });
    showToast(`Đã thêm "${item.name}" vào giỏ hàng!`);
  };

  const handleAddCombo = (combo: AiRecommendedComboDto) => {
    combo.items.forEach(item => {
      addToCart({
        id: item.menuItemId.toString(),
        name: item.name,
        price: item.price,
        categoryId: 'Combo AI',
        description: combo.title,
        image: item.imageUrl || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&q=80'
      });
    });
    showToast(`Đã thêm combo "${combo.title}" vào giỏ hàng!`);
  };

  return (
    <div className="bg-[#FAF8F5] text-[#2C2420] font-sans overflow-x-hidden min-h-[calc(100vh-70px)] pb-24 md:pb-12">
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed top-20 right-4 z-50 bg-[#1E293B] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <CheckCircle2 className="text-emerald-400" size={20} />
          <span className="font-medium text-sm">{addedToast}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 pt-2.5 pb-4 space-y-3 sm:space-y-6">
        {/* Mode Navigation Tabs */}
        <div className="py-0.5">
          <div className="flex items-center justify-center p-1.5 bg-stone-200/90 rounded-2xl max-w-lg mx-auto shadow-xs border border-stone-300/40">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-amber-700 to-amber-900 text-white shadow-md'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-300/40'
              }`}
            >
              <MessageSquare size={16} />
              <span>Chat Cùng AI</span>
              <span className="text-[10px] bg-amber-400 text-stone-950 px-1.5 py-0.2 rounded-full font-black animate-pulse">
                MỚI
              </span>
            </button>
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'suggestions'
                  ? 'bg-white text-stone-900 shadow-md'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-300/40'
              }`}
            >
              <Sparkles size={16} className="text-amber-600" />
              <span>Gợi Ý Theo Dịp</span>
            </button>
          </div>
        </div>

        {/* Banner: Hero Section with AI Status (Shown when on suggestions tab, or as compact banner on desktop) */}
        {activeTab === 'suggestions' ? (
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D1B13] via-[#42291E] to-[#1F120C] text-white p-5 sm:p-6 md:p-10 shadow-xl border border-amber-900/40">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold backdrop-blur-md">
                  <Bot size={14} className="animate-spin" style={{ animationDuration: '6s' }} />
                  <span>Powered by {recommendationsData?.modelUsed || 'Google Gemini AI'}</span>
                  {recommendationsData?.isAiGenerated ? (
                    <span className="bg-emerald-500/80 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Realtime AI</span>
                  ) : (
                    <span className="bg-amber-500/80 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Smart Analysis</span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
                  {recommendationsData?.headline || 'Trợ Lý AI Sommelier Ẩm Thực'}
                </h1>

                <p className="text-amber-100/80 text-xs sm:text-sm md:text-base leading-relaxed">
                  {recommendationsData?.chefNote || 'Đang phân tích khẩu vị và giỏ hàng của bạn để đề xuất những món ngon và cặp đôi hương vị hài hòa nhất.'}
                </p>
              </div>

              {/* Cart Highlight Badge if items in cart */}
              {lastCartItem && (
                <div className="w-full md:w-auto bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 flex-shrink-0">
                  <img
                    src={lastCartItem.image || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200'}
                    alt={lastCartItem.name}
                    className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-xl border border-white/20 shadow-md"
                  />
                  <div>
                    <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-amber-300 font-bold block">Đang Có Trong Giỏ</span>
                    <p className="font-bold text-white text-xs sm:text-sm line-clamp-1">{lastCartItem.name}</p>
                    <p className="text-amber-200 text-xs font-medium">{lastCartItem.price.toLocaleString('vi-VN')}đ</p>
                  </div>
                </div>
              )}
            </div>

            {/* Mood / Occasion Selector */}
            <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-amber-200/90 flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-400" />
                  Chọn tâm trạng / thời điểm:
                </span>
                <button
                  onClick={() => fetchRecommendations(selectedMood)}
                  disabled={loading}
                  className="text-xs text-amber-300 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  <span className="hidden xs:inline">Làm mới gợi ý</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {moodOptions.map(m => {
                  const IconComponent = m.icon;
                  const isSelected = selectedMood === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMood(m.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all text-xs font-medium ${
                        isSelected
                          ? 'bg-amber-500 text-stone-900 font-bold shadow-lg shadow-amber-500/20 scale-[1.02]'
                          : 'bg-white/10 hover:bg-white/15 text-stone-200 border border-white/5'
                      }`}
                    >
                      <IconComponent size={16} className={isSelected ? 'text-stone-900' : 'text-amber-300'} />
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : (
          /* Sleek Mini Header for Chat Tab */
          <div className="hidden sm:flex items-center justify-between bg-gradient-to-r from-[#2D1B13] to-[#42291E] rounded-2xl px-6 py-4 text-white shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                <Bot size={22} />
              </div>
              <div>
                <h1 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Trò Chuyện Cùng AI Sommelier Ẩm Thực</span>
                  <span className="text-[10px] bg-emerald-500/80 text-white px-2 py-0.5 rounded-full font-bold">Realtime AI</span>
                </h1>
                <p className="text-xs text-amber-100/70">
                  Hỏi tự do theo sở thích, tâm trạng, chế độ ăn hoặc yêu cầu món ăn kèm đặc biệt.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' ? (
          /* Khung Chat Trực Tiếp với AI Sommelier */
          <div className="max-w-4xl mx-auto">
            <AiSommelierChat mode="embedded" />
          </div>
        ) : (
          /* Gợi Ý Theo Thực Đơn Cố Định */
          <>
        {/* AI Recommendations Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                <Sparkles size={18} />
              </div>
              <h2 className="text-xl font-bold text-stone-900">Món Được AI Đề Xuất Riêng Cho Bạn</h2>
            </div>
            <span className="text-xs text-stone-500">
              {recommendationsData?.recommendations?.length || 0} món tuyển chọn
            </span>
          </div>

          {loading ? (
            /* Skeleton Loading */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200/60 animate-pulse space-y-3">
                  <div className="h-44 bg-stone-200 rounded-xl"></div>
                  <div className="h-5 bg-stone-200 rounded w-3/4"></div>
                  <div className="h-14 bg-stone-100 rounded-lg"></div>
                  <div className="h-10 bg-stone-200 rounded-full"></div>
                </div>
              ))}
            </div>
          ) : recommendationsData?.recommendations && recommendationsData.recommendations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {recommendationsData.recommendations.map(item => (
                <div
                  key={item.menuItemId}
                  className="group bg-white rounded-2xl p-4 shadow-[0_2px_15px_rgba(45,27,19,0.06)] hover:shadow-[0_8px_25px_rgba(45,27,19,0.12)] transition-all duration-300 border border-stone-200/70 hover:border-amber-500/30 flex flex-col justify-between"
                >
                  <div>
                    {/* Item Image & Badge */}
                    <div className="relative h-44 mb-3.5 rounded-xl overflow-hidden bg-stone-100">
                      <img
                        src={item.imageUrl || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500'}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e: any) => {
                          e.target.src = 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500';
                        }}
                      />
                      <div className="absolute top-2 left-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                        <Sparkles size={11} />
                        {item.badge || 'AI Gợi Ý'}
                      </div>
                      <div className="absolute bottom-2 right-2 bg-stone-900/85 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-lg text-xs font-extrabold shadow">
                        {item.price.toLocaleString('vi-VN')}đ
                      </div>
                    </div>

                    {/* Item Info */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                        {item.categoryName || 'Món Ngon'}
                      </span>
                      {item.confidenceScore && (
                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                          {Math.round(item.confidenceScore * 100)}% Match
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-stone-900 text-base mb-2 group-hover:text-amber-800 transition-colors line-clamp-1">
                      {item.name}
                    </h3>

                    {/* AI Reason */}
                    <div className="bg-amber-50/70 border border-amber-200/50 rounded-xl p-2.5 mb-3 space-y-1">
                      <p className="text-xs text-amber-950/90 leading-relaxed italic">
                        "{item.reason}"
                      </p>
                      {item.pairingTip && (
                        <p className="text-[11px] text-amber-800 font-medium flex items-center gap-1">
                          <span className="font-bold">Mẹo:</span> {item.pairingTip}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    onClick={() => handleAddItem(item)}
                    className="w-full py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm hover:shadow-md"
                  >
                    <span className="text-base leading-none">+</span>
                    Thêm vào Giỏ
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center border border-stone-200 text-stone-500">
              <Bot size={36} className="mx-auto text-stone-400 mb-2" />
              <p className="font-medium">Chưa có gợi ý món nào phù hợp.</p>
              <button
                onClick={() => fetchRecommendations(selectedMood)}
                className="mt-3 px-4 py-2 bg-amber-800 text-white text-xs font-bold rounded-xl"
              >
                Thử lại
              </button>
            </div>
          )}
        </section>

        {/* Recommended Bundles & Combos */}
        {recommendationsData?.combos && recommendationsData.combos.length > 0 && (
          <section className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <span className="text-amber-700 font-bold tracking-wider text-xs uppercase block">Ưu Đãi Tuyển Chọn</span>
                <h2 className="text-xl font-bold text-stone-900">Gói Combo Tiết Kiệm Do AI Thiết Kế</h2>
              </div>
              <p className="text-stone-500 text-xs max-w-md">
                Sự kết hợp hoàn hảo giữa các món ngon với mức giá ưu đãi đặc biệt.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {recommendationsData.combos.map((combo, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(45,27,19,0.06)] border border-amber-900/10 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-rose-500 to-amber-500 text-white text-xs font-extrabold px-4 py-1 rounded-bl-2xl shadow-sm">
                    Tiết kiệm {combo.discountPercent}%
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold mb-1.5">
                        {combo.tag || 'Combo Đặc Biệt'}
                      </span>
                      <h3 className="text-lg font-extrabold text-stone-900">{combo.title}</h3>
                      <p className="text-stone-600 text-xs mt-1">{combo.description}</p>
                    </div>

                    {/* Combo Item Thumbnails */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200/60">
                      {combo.items.map((cItem, iIdx) => (
                        <div key={iIdx} className="flex items-center gap-2">
                          <img
                            src={cItem.imageUrl || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200'}
                            alt={cItem.name}
                            className="w-11 h-11 object-cover rounded-lg border border-stone-200"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-stone-800 truncate">{cItem.name}</p>
                            <p className="text-[11px] text-stone-500">{cItem.price.toLocaleString('vi-VN')}đ</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Price and CTA */}
                  <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-stone-400 line-through block">
                        {combo.originalPrice.toLocaleString('vi-VN')}đ
                      </span>
                      <span className="text-lg font-black text-amber-800">
                        {combo.discountedPrice.toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    <button
                      onClick={() => handleAddCombo(combo)}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-800 hover:to-amber-950 text-white text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <Sparkles size={14} />
                      Thêm Cả Combo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
          </>
        )}

        {/* Bottom CTA Actions */}
        <section className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-stone-900 text-sm md:text-base">Đã chọn xong món yêu thích?</h4>
            <p className="text-xs text-stone-500">Giỏ hàng của bạn đang có {cartCount} món. Kiểm tra lại và hoàn tất đơn hàng.</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              to="/"
              className="flex-1 sm:flex-none text-center px-5 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-colors"
            >
              Thực Đơn Đầy Đủ
            </Link>
            <Link
              to="/cart"
              className="flex-1 sm:flex-none text-center px-6 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5"
            >
              Xem Giỏ Hàng
              <span className="text-sm">→</span>
            </Link>
          </div>
        </section>
      </main>

      <MobileBottomNav />
    </div>
  );
}
