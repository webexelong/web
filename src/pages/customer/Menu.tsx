import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useEffect, useState } from 'react';
import MobileBottomNav from '../../components/MobileBottomNav';
import Pagination from '../../components/Pagination';
import DeferredAiSommelierChat from '../../components/DeferredAiSommelierChat';
import { resolveDisplayUrl } from '../../components/ImageCropUpload';

const DEFAULT_CATEGORIES = [
  { id: 'Cà Phê Pha Máy', name: 'Cà Phê Pha Máy', icon: 'coffee' },
  { id: 'Sinh Tố & Trà Sữa', name: 'Sinh Tố & Trà Sữa', icon: 'bubble_chart' },
  { id: 'Trà & Trái Cây', name: 'Trà & Trái Cây', icon: 'energy_savings_leaf' },
  { id: 'Bánh Ngọt', name: 'Bánh Ngọt', icon: 'bakery_dining' }
];

const getOptimizedImageUrl = (imageUrl: string, width = 320) => {
  if (!imageUrl) return '';
  const resolved = resolveDisplayUrl(imageUrl);
  try {
    const url = new URL(resolved);
    if (url.hostname === 'images.unsplash.com') {
      url.searchParams.set('w', String(width));
      url.searchParams.set('q', '70');
      url.searchParams.set('auto', 'format');
      return url.toString();
    }
    if (url.hostname.includes('googleusercontent.com')) {
      const cleanUrl = resolved.replace(/=[wsphck0-9-]+$/i, '');
      return `${cleanUrl}=w${width}-rw`;
    }
    return resolved;
  } catch {
    return resolved;
  }
};

const getResponsiveImageSources = (imageUrl: string) => {
  if (!imageUrl) return undefined;
  const resolved = resolveDisplayUrl(imageUrl);
  try {
    const url = new URL(resolved);
    if (url.hostname === 'images.unsplash.com') {
      return [160, 240, 360, 480, 640].map(width => {
        const sizedUrl = new URL(url);
        sizedUrl.searchParams.set('w', String(width));
        sizedUrl.searchParams.set('q', '70');
        sizedUrl.searchParams.set('auto', 'format');
        return `${sizedUrl.toString()} ${width}w`;
      }).join(', ');
    }
    if (url.hostname.includes('googleusercontent.com')) {
      const cleanUrl = resolved.replace(/=[wsphck0-9-]+$/i, '');
      return [160, 240, 320, 480, 640].map(width => `${cleanUrl}=w${width}-rw ${width}w`).join(', ');
    }
    return undefined;
  } catch {
    return undefined;
  }
};

export default function Menu() {
  const [searchParams] = useSearchParams();
  const storeIdParam = searchParams.get('storeId') ? parseInt(searchParams.get('storeId')!) : null;
  const tableParam = searchParams.get('table') || null;

  const { 
    menuItems, 
    categories, 
    fetchMenu, 
    setStoreId, 
    setTable, 
    addToCart, 
    activeOrder
  } = useStore();

  const [activeCategory, setActiveCategory] = useState<string>('Cà Phê Pha Máy');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;

  // Stock status per branch
  const [stockStatus, setStockStatus] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    // Load guest session from localStorage if exists
    const savedSession = localStorage.getItem('guestSession');
    let sessionStoreId: number | null = null;
    let sessionTable: string | null = null;
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        const parsedStoreId = Number(session.storeId);
        if (Number.isInteger(parsedStoreId) && parsedStoreId > 0) {
          sessionStoreId = parsedStoreId;
          sessionTable = String(session.tableNumber || session.tableId || '');
        } else {
          localStorage.removeItem('guestSession');
        }
      } catch {
        localStorage.removeItem('guestSession');
      }
    }

    const targetStoreId = sessionStoreId || storeIdParam || 1;
    if (targetStoreId) {
      setStoreId(targetStoreId);
      const currentMenu = useStore.getState();
      if (currentMenu.storeInfo?.storeId !== targetStoreId || currentMenu.menuItems.length === 0) {
        fetchMenu(targetStoreId);
      }
    }
    const targetTable = sessionTable || tableParam;
    if (targetTable) setTable(targetTable);

    const loadStock = () => {
      const saved = targetStoreId ? localStorage.getItem(`webcafe_stock_store_${targetStoreId}`) : null;
      try {
        setStockStatus(saved ? JSON.parse(saved) : {});
      } catch {
        setStockStatus({});
      }
    };

    loadStock();
    window.addEventListener('storage', loadStock);
    return () => window.removeEventListener('storage', loadStock);
  }, [storeIdParam, tableParam, fetchMenu, setStoreId, setTable]);

  // Filter out Quà Lưu Niệm
  const displayCategories = (categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES)
    .filter(c => !c.name.toLowerCase().includes('quà') && !c.name.toLowerCase().includes('lưu niệm'));
  const firstCategoryName = displayCategories[0]?.name || displayCategories[0]?.id;

  useEffect(() => {
    if (firstCategoryName && (!activeCategory || activeCategory === 'Cà Phê Pha Máy')) {
      setActiveCategory(firstCategoryName);
    }
  }, [firstCategoryName, activeCategory]);

  // Reset page when category or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery]);

  // Filter items matching activeCategory or search
  const activeItems = menuItems
    .filter(m => !m.categoryName?.toLowerCase().includes('quà') && !m.categoryName?.toLowerCase().includes('lưu niệm'))
    .filter(item => {
      const itemCat = (item.categoryName || item.categoryId || '').toLowerCase();
      const activeCat = activeCategory.toLowerCase();
      const matchCat = activeCategory === 'Tất Cả' || itemCat.includes(activeCat) || activeCat.includes(itemCat);
      const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    })
    // Featured items are shown first while preserving the configured menu order.
    .sort((a, b) => Number(Boolean(b.rawDto?.isFeatured)) - Number(Boolean(a.rawDto?.isFeatured)) || (a.rawDto?.sortOrder ?? 0) - (b.rawDto?.sortOrder ?? 0));

  const totalPages = Math.ceil(activeItems.length / PAGE_SIZE);
  const paginatedItems = activeItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleAddToCart = (id: string, name: string, price: number, image: string) => {
    const isOutOfStock = stockStatus[id] === false;
    if (isOutOfStock) return;

    const fullItem = menuItems.find(i => i.id === id) || {
      id,
      name,
      price,
      image,
      categoryId: activeCategory,
      description: '',
    };

    // Gán size mặc định nếu món có danh sách sizes
    const defaultSize = fullItem.rawDto?.sizes && fullItem.rawDto.sizes.length > 0 
      ? fullItem.rawDto.sizes[0] 
      : undefined;

    addToCart(fullItem, { 
      quantity: 1,
      sizeId: defaultSize?.sizeId,
      sizeName: defaultSize?.name,
      sizeExtra: defaultSize?.extraPrice || 0
    });
  };

  return (
    <div className="font-body-md text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed bg-background">
      {/* Main Container */}
      <div className="flex max-w-7xl mx-auto px-4 sm:px-container-margin py-4 sm:py-stack-md gap-stack-lg">
        {/* Desktop Sidebar (Categories) */}
        <aside className="hidden lg:flex flex-col w-64 gap-stack-md shrink-0 sticky top-20 self-start">
          <div className="bg-surface-container-low dark:bg-[#1C1613] p-4 rounded-2xl border border-outline-variant/10 dark:border-white/5">
            <h2 className="font-headline-md text-xs uppercase tracking-wider text-on-surface-variant dark:text-[#A4968C] font-bold mb-3 px-2">Danh Mục Món</h2>
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => setActiveCategory('Tất Cả')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  activeCategory === 'Tất Cả' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-container-highest/60 dark:hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-lg">apps</span>
                <span>Tất Cả Món ({menuItems.length})</span>
              </button>
              {displayCategories.map(c => {
                const catName = c.name || c.id;
                return (
                  <button 
                    key={catName}
                    onClick={() => setActiveCategory(catName)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                      activeCategory === catName ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-container-highest/60 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{c.icon || 'local_cafe'}</span>
                    <span>{catName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Menu Content Area */}
        <main className="flex-1 flex flex-col gap-4 sm:gap-stack-md min-w-0 pb-24 md:pb-12">
          {/* Header Search & Horizontal Category Scroller for Mobile */}
          <section className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
              <input 
                className="w-full bg-white dark:bg-[#231C18] border border-outline-variant/20 dark:border-white/10 rounded-full pl-10 pr-4 py-2 text-xs sm:text-sm text-on-surface dark:text-[#F3EDE6] placeholder:text-on-surface-variant/60 dark:placeholder:text-[#7E7067] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-xs" 
                placeholder="Tìm món đồ uống yêu thích..." 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar w-full md:w-auto">
              <button 
                onClick={() => setActiveCategory('Tất Cả')}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  activeCategory === 'Tất Cả' ? 'bg-primary text-on-primary shadow-xs' : 'bg-white dark:bg-[#231C18] border border-primary/10 dark:border-white/10 text-on-surface-variant dark:text-[#A4968C] hover:bg-primary/5 dark:hover:bg-white/5'
                }`}
              >
                Tất Cả
              </button>
              {displayCategories.map(c => {
                const catName = c.name || c.id;
                return (
                  <button 
                    key={catName}
                    onClick={() => setActiveCategory(catName)}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${
                      activeCategory === catName ? 'bg-primary text-on-primary shadow-xs' : 'bg-white dark:bg-[#231C18] border border-primary/10 dark:border-white/10 text-on-surface-variant dark:text-[#A4968C] hover:bg-primary/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {catName}
                  </button>
                );
              })}
            </div>
          </section>

          {/* AI Sommelier Spotlight Banner */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#281E19] via-[#3D2C24] to-[#1E1715] p-4 sm:p-5 text-white shadow-md border border-amber-500/25 group transition-all hover:border-amber-500/40">
            {/* Glowing Orb Accents */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-primary/20 rounded-full blur-xl pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 flex items-center justify-center text-stone-950 shadow-md shrink-0 group-hover:rotate-6 transition-transform">
                  <span className="material-symbols-outlined text-2xl font-bold">auto_awesome</span>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Chuyên Gia Ẩm Thực AI Sommelier
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight">
                    Hôm nay bạn muốn thưởng thức món gì?
                  </h3>
                  <p className="text-xs text-stone-300 mt-0.5">
                    Tư vấn món theo tâm trạng, độ ngọt, mức đá và gợi ý kết hợp đồ uống thông minh.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <Link
                  to="/ai-suggest"
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <span>Hỏi AI Sommelier</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </Link>
              </div>
            </div>
          </section>

          {/* Dynamic Menu Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-stack-lg">
            {paginatedItems.length === 0 ? (
              <div className="col-span-full py-16 text-center text-on-surface-variant font-medium bg-white dark:bg-[#211A16] rounded-2xl border border-outline-variant/10 dark:border-white/5 p-6">
                Không tìm thấy món nào trong danh mục này.
              </div>
            ) : (
              paginatedItems.map((item, index) => {
                const isOutOfStock = stockStatus[item.id.toString()] === false;

                return (
                  <div 
                    key={item.id} 
                    className={`group bg-white dark:bg-[#211A16] rounded-xl sm:rounded-2xl overflow-hidden border border-primary/5 dark:border-white/5 shadow-xs transition-all duration-300 flex flex-row sm:flex-col relative ${
                      isOutOfStock ? 'opacity-70 grayscale-[0.25] hover:shadow-xs' : 'hover:shadow-lg'
                    }`}
                  >
                    {/* Out of stock badge */}
                    {isOutOfStock && (
                      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20 px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-red-600 text-white font-black text-[8px] sm:text-[10px] uppercase rounded-md sm:rounded-lg shadow-md flex items-center gap-1 animate-pulse">
                        <span className="material-symbols-outlined text-xs">block</span>
                        TẠM HẾT MÓN
                      </div>
                    )}
                    {!isOutOfStock && item.rawDto?.isFeatured && (
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-amber-400 text-stone-950 font-black text-[8px] sm:text-[10px] uppercase rounded-md sm:rounded-lg shadow-md flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        Nổi bật
                      </div>
                    )}

                    <Link to={`/product/${item.id}`} className="relative m-2 h-24 w-24 shrink-0 overflow-hidden rounded-xl block bg-surface-container-low dark:bg-[#181310] sm:m-0 sm:h-64 sm:w-auto sm:rounded-none">
                      <img
                        src={getOptimizedImageUrl(item.image, 320)}
                        srcSet={getResponsiveImageSources(item.image)}
                        sizes="(max-width: 639px) 96px, (max-width: 1279px) 50vw, 33vw"
                        alt={item.name}
                        width={500}
                        height={500}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        fetchPriority={index === 0 ? 'high' : 'auto'}
                        decoding={index === 0 ? 'sync' : 'async'}
                        className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute bottom-1.5 right-1.5 sm:bottom-3 sm:right-3 px-1.5 sm:px-3 py-0.5 sm:py-1 bg-primary text-on-primary rounded-md sm:rounded-lg font-bold text-[10px] sm:text-label-md shadow-md">
                          {item.price.toLocaleString('vi-VN')}đ
                      </div>
                      {!isOutOfStock && (
                        <div className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3 px-1.5 sm:px-2 py-0.5 bg-white/95 dark:bg-[#181310]/85 dark:border dark:border-white/10 backdrop-blur-md shadow-xs rounded-md flex items-center gap-0.5 sm:gap-1">
                          <span className="material-symbols-outlined text-amber-500 text-[10px] sm:text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          <span className="text-[9px] sm:text-xs font-bold text-on-surface dark:text-[#F3EDE6]">{item.rating || 4.8}</span>
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0 p-2 sm:p-stack-md flex-1 flex flex-col">
                      <Link to={`/product/${item.id}`} className="block group-hover:opacity-80 transition-opacity">
                        <h3 className={`text-sm sm:text-lg font-bold mb-0.5 sm:mb-1 line-clamp-1 ${isOutOfStock ? 'text-on-surface/80 line-through' : 'text-on-surface'}`}>
                          {item.name}
                        </h3>
                        <p className="hidden sm:block text-xs sm:text-sm text-on-surface-variant line-clamp-2 mb-4 leading-relaxed">
                            {item.description || 'Hương vị hảo hạng được pha chế tươi ngon mỗi ngày.'}
                        </p>
                      </Link>
                      <div className="flex items-center justify-between gap-2 mt-auto pt-1.5 sm:pt-2 border-t border-surface-variant/40 dark:border-white/5">
                        {isOutOfStock ? (
                          <span className="px-2 sm:px-3.5 py-1 sm:py-1.5 bg-red-50 text-red-600 rounded-full text-[10px] sm:text-xs font-bold border border-red-200">
                            Tạm Hết Món
                          </span>
                        ) : (
                          <Link to={`/product/${item.id}`} className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 border-[1.5px] border-primary dark:border-amber-600/50 text-primary dark:text-amber-200 rounded-full text-[10px] sm:text-xs font-bold hover:bg-primary/5 dark:hover:bg-amber-500/10 transition-colors">
                            Tùy Chỉnh
                          </Link>
                        )}

                        <button 
                          disabled={isOutOfStock}
                          onClick={() => handleAddToCart(item.id.toString(), item.name, item.price, item.image)}
                          aria-label={`Thêm ${item.name} vào giỏ hàng`}
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
                            isOutOfStock 
                            ? 'bg-gray-200 dark:bg-stone-800 text-gray-400 cursor-not-allowed' 
                            : 'bg-primary dark:bg-[#8C4F27] text-on-primary hover:bg-primary-container dark:hover:bg-[#9E5A2D] active:scale-90 shadow-sm'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base sm:text-xl">
                            {isOutOfStock ? 'block' : 'add'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* Pagination Controls for Customer Menu */}
          <div className="bg-white dark:bg-[#211A16] rounded-2xl p-2 border border-outline-variant/15 dark:border-white/5 shadow-2xs mt-2">
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={(p) => {
                setCurrentPage(p);
                window.scrollTo({ top: 120, behavior: 'smooth' });
              }} 
              totalItems={activeItems.length} 
              pageSize={PAGE_SIZE} 
              itemName="món đồ uống"
            />
          </div>

          {/* Active Order Status Card */}
          {activeOrder && (
            <section className="mt-4 p-4 sm:p-stack-md bg-secondary-container/30 dark:bg-amber-500/10 border border-primary/20 dark:border-amber-500/30 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 sm:w-12 h-10 sm:h-12 bg-primary rounded-full flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white text-lg sm:text-xl animate-pulse">coffee</span>
                </div>
                <div>
                  <p className="text-[10px] sm:text-label-sm text-primary uppercase tracking-wider font-bold">
                    {activeOrder.status === 'pending' ? 'Chờ Xác Nhận' : activeOrder.status === 'preparing' ? 'Đang Chuẩn Bị' : 'Món Đã Sẵn Sàng'}
                  </p>
                  <h4 className="text-xs sm:text-label-md font-bold text-on-surface line-clamp-1">
                    Đơn #{activeOrder.orderCode} ({activeOrder.items?.length || 1} món)
                  </h4>
                </div>
              </div>
              <Link to={`/tracking?code=${activeOrder.orderCode}`} className="text-primary text-xs sm:text-label-md hover:underline font-bold whitespace-nowrap ml-2">
                Chi Tiết ➔
              </Link>
            </section>
          )}

        </main>
      </div>

      {/* Floating AI Sommelier Chat Widget */}
      <DeferredAiSommelierChat />
      
      <MobileBottomNav />

    </div>
  );
}
