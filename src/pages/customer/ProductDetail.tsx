import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import MobileBottomNav from '../../components/MobileBottomNav';
import { trackViewItem } from '../../utils/analytics';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { menuItems, addToCart, currentStoreId } = useStore();
  
  // Find item dynamically from store
  const item = menuItems.find(i => i.id === id || i.id === `hc-${id}`) || menuItems[0] || {
    id: '5',
    name: 'Caramel Cloud Macchiato',
    description: 'Lớp bọt sữa lạnh mềm mịn phủ trên lớp espresso cùng hương vani và xốt caramel.',
    price: 57500,
    categoryId: 'Cà Phê Pha Máy',
    categoryName: 'Cà Phê Pha Máy',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAb7dmU9p5ws6yiGWFQpEh-Vjo0PCA4sYcpCjINzCM3Te0tnsc9ffhxbMqhXwS7_UeEMCLtBftnxvaW-r--YOlDyGw_cqWmfbTrTi9x04jt5jvNm1zWxdQmgdxk0COUycCP_X3lzDPhldmC8jF2emQxsl_LjSU_wRlGYcAvL9KlYEpvc75GxsLaJyeJWoZdR3CyjB-3uLAfxuL5A33XycLc9p5gssh1z_k2p2uFU0nfU_ylV5jeljNf'
  };

  const [stockStatus, setStockStatus] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    const loadStock = () => {
      const saved = localStorage.getItem(`webcafe_stock_store_${currentStoreId}`);
      setStockStatus(saved ? JSON.parse(saved) : {});
    };
    loadStock();
    window.addEventListener('storage', loadStock);
    return () => window.removeEventListener('storage', loadStock);
  }, [currentStoreId]);

  useEffect(() => {
    if (item?.name) {
      try {
        trackViewItem({
          id: item.id,
          name: item.name,
          price: item.price,
          category: item.categoryName || item.categoryId,
        });
      } catch {
        // Ignore if GA not initialized
      }
    }
  }, [item?.id]);

  const isOutOfStock = stockStatus[item.id.toString()] === false;

  // Dynamic Sizes purely from API (Data-Driven, no fake sizes)
  const availableSizes = useMemo(() => {
    if (item.rawDto?.sizes && item.rawDto.sizes.length > 0) {
      return item.rawDto.sizes.map((s: any) => ({
        sizeId: s.sizeId,
        name: s.name,
        extraPrice: s.extraPrice || 0
      }));
    }
    return [];
  }, [item]);

  const [selectedSize, setSelectedSize] = useState<any>(availableSizes[0] || null);

  // Update selected size when item changes
  useEffect(() => {
    if (availableSizes.length > 0) {
      setSelectedSize(availableSizes[0]);
    } else {
      setSelectedSize(null);
    }
  }, [availableSizes]);

  const [quantity, setQuantity] = useState(1);
  const [sugar, setSugar] = useState(100);
  const [ice, setIce] = useState(100);
  const [notes, setNotes] = useState('');
  const [isAdded, setIsAdded] = useState(false);

  const handleIncrement = () => setQuantity(q => q + 1);
  const handleDecrement = () => setQuantity(q => (q > 1 ? q - 1 : 1));

  const sizeExtra = selectedSize?.extraPrice || 0;
  const currentPrice = item.price + sizeExtra;
  const totalPrice = currentPrice * quantity;

  const handleAddToCart = () => {
    if (isOutOfStock) return;

    addToCart(item, {
      quantity,
      sizeId: selectedSize?.sizeId,
      sizeName: selectedSize?.name,
      sizeExtra: selectedSize?.extraPrice || 0,
      sugarLevel: `${sugar}%`,
      iceLevel: `${ice}%`,
      note: notes,
    });
    
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
      navigate('/cart');
    }, 800);
  };

  return (
    <div className="font-body-md text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed min-h-screen bg-background animate-in fade-in duration-300">
      {/* Top Header */}
      <nav className="w-full sticky top-0 z-40 bg-surface/95 dark:bg-surface-dim backdrop-blur-md border-b border-outline-variant/10 shadow-xs">
        <div className="flex justify-between items-center px-4 sm:px-container-margin py-3.5 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)} 
              className="p-1.5 sm:p-2 rounded-full hover:bg-surface-variant text-primary flex items-center justify-center transition-colors"
              aria-label="Quay lại"
            >
              <span className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
            </button>
            <h2 className="text-base sm:text-xl font-bold text-primary truncate max-w-[200px] sm:max-w-md">
              {item.name}
            </h2>
          </div>
        </div>
      </nav>

      {/* Main Content Layout */}
      <main className="max-w-6xl mx-auto px-4 sm:px-container-margin py-4 sm:py-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 pb-28 md:pb-12">
        {/* Left Column: Product Visual */}
        <section className="w-full">
          <div className="relative aspect-4/3 sm:aspect-square w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-surface-container-low border border-primary/10 shadow-sm">
            <img 
              src={item.image} 
              alt={item.name} 
              className={`w-full h-full object-cover transition-transform duration-500 hover:scale-105 ${isOutOfStock ? 'grayscale-[0.4] opacity-80' : ''}`}
            />
            {isOutOfStock ? (
              <div className="absolute top-4 left-4 z-10 px-3 py-1.5 bg-red-600 text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center gap-1.5 animate-pulse">
                <span className="material-symbols-outlined text-sm">block</span>
                TẠM HẾT MÓN TẠI QUÁN
              </div>
            ) : (
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 px-2.5 py-1 bg-white/95 backdrop-blur-md shadow-xs rounded-lg flex items-center gap-1">
                <span className="material-symbols-outlined text-amber-500 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="text-xs sm:text-sm font-bold text-on-surface">{item.rating || 4.8}</span>
              </div>
            )}
            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 px-3.5 py-1.5 bg-primary text-on-primary rounded-xl font-bold text-sm sm:text-base shadow-md">
              {item.price.toLocaleString('vi-VN')}đ
            </div>
          </div>
        </section>

        {/* Right Column: Customization Details */}
        <section className="space-y-5 w-full">
          {/* Header Info */}
          <div className="space-y-2">
            <nav className="flex text-on-surface-variant font-label-sm text-xs gap-1.5 items-center flex-wrap">
              <Link to="/" className="hover:text-primary font-semibold">Thực Đơn</Link>
              <span>/</span>
              <span className="hover:text-primary font-semibold">{item.categoryName || item.categoryId || 'Đồ Uống'}</span>
              <span>/</span>
              <span className="text-primary font-bold">{item.name}</span>
            </nav>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-background">{item.name}</h1>
            <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
              {item.description}
            </p>
            <div className="pt-1">
              <span className="text-xl sm:text-2xl text-primary font-extrabold">{item.price.toLocaleString('vi-VN')}đ</span>
            </div>
          </div>

          {/* Out of Stock Alert Banner */}
          {isOutOfStock && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs sm:text-sm font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              Món này hiện đang tạm hết tại Chi nhánh #{currentStoreId}. Quý khách vui lòng chọn món khác nhé!
            </div>
          )}

          {/* Customization Options */}
          <div className={`space-y-5 bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-outline-variant/15 ${isOutOfStock ? 'opacity-60 pointer-events-none' : ''}`}>
            {/* Size Selector (Only shown if item has sizes configured) */}
            {availableSizes.length > 0 && selectedSize && (
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-bold text-on-background block">Chọn Kích Cỡ</label>
                <div className="grid grid-cols-2 gap-3">
                  {availableSizes.map((s) => (
                    <button 
                      key={s.sizeId}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border-2 transition-all active:scale-[0.98] ${
                        selectedSize?.sizeId === s.sizeId 
                          ? 'border-primary bg-secondary-container/20 text-primary font-bold shadow-xs' 
                          : 'border-outline-variant/30 text-on-surface-variant hover:border-primary'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-xs sm:text-sm">
                        <span className="material-symbols-outlined text-lg">coffee</span> {s.name}
                      </span>
                      <span className="text-xs font-semibold">
                        {s.extraPrice > 0 ? `+${s.extraPrice.toLocaleString('vi-VN')}đ` : '+0đ'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sliders for Sugar and Ice */}
            <div className="space-y-4 pt-1">
              {/* Sugar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs sm:text-sm font-bold text-on-background">Lượng Đường</label>
                  <span className="text-primary font-bold text-xs sm:text-sm">{sugar}%</span>
                </div>
                <input 
                  className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary" 
                  max="100" min="0" step="25" type="range" value={sugar} onChange={(e) => setSugar(Number(e.target.value))} 
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold px-1 uppercase tracking-wider">
                  <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                </div>
              </div>
              
              {/* Ice */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs sm:text-sm font-bold text-on-background">Lượng Đá</label>
                  <span className="text-primary font-bold text-xs sm:text-sm">{ice}%</span>
                </div>
                <input 
                  className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary" 
                  max="100" min="0" step="25" type="range" value={ice} onChange={(e) => setIce(Number(e.target.value))} 
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold px-1 uppercase tracking-wider">
                  <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                </div>
              </div>
            </div>

            {/* Special Instructions */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs sm:text-sm font-bold text-on-background">Ghi Chú Đặc Biệt</label>
              <textarea 
                className="w-full bg-surface border border-outline-variant/30 rounded-xl p-3 text-xs sm:text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none min-h-[80px] sm:min-h-[100px] resize-none transition-all" 
                placeholder="VD: Ít đá, thêm trân châu, không quá ngọt..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center pt-3 border-t border-outline-variant/15">
            {/* Quantity Selector */}
            <div className={`flex items-center justify-between w-full sm:w-auto bg-surface-variant/40 p-1 rounded-2xl border border-outline-variant/20 ${isOutOfStock ? 'opacity-50 pointer-events-none' : ''}`}>
              <button 
                onClick={handleDecrement} 
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white shadow-xs hover:bg-primary hover:text-white transition-colors text-primary"
              >
                <span className="material-symbols-outlined text-base font-bold">remove</span>
              </button>
              <span className="w-14 text-center font-bold text-lg text-primary">{quantity}</span>
              <button 
                onClick={handleIncrement} 
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white shadow-xs hover:bg-primary hover:text-white transition-colors text-primary"
              >
                <span className="material-symbols-outlined text-base font-bold">add</span>
              </button>
            </div>

            {/* Add to Cart */}
            <button 
              disabled={isOutOfStock}
              onClick={handleAddToCart} 
              className={`w-full sm:flex-grow py-3.5 sm:py-4 px-6 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                isOutOfStock
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : isAdded 
                  ? 'bg-green-600 text-white shadow-green-600/20' 
                  : 'bg-primary text-white hover:bg-primary-container shadow-md shadow-primary/20 active:scale-95'
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {isOutOfStock ? 'block' : isAdded ? 'check_circle' : 'shopping_bag'}
              </span>
              {isOutOfStock ? 'Món Này Đang Tạm Hết' : isAdded ? 'Đã Thêm Vào Giỏ!' : `Thêm vào Giỏ • ${totalPrice.toLocaleString('vi-VN')}đ`}
            </button>
          </div>
        </section>
      </main>
      
      <MobileBottomNav />
    </div>
  );
}
