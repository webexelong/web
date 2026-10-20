import { useState, useEffect, useMemo } from 'react';
import { inventoryApi, menuApi } from '../../api/apis';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/authStore';
import InventoryAiChat from '../../components/inventory/InventoryAiChat';
import { useNotification } from '../../components/NotificationProvider';
import type {
  IngredientDto,
  InventoryStockDto,
  InventoryTransactionDto,
  MenuItemRecipeDto,
  LowStockAlertDto,
  MenuItemDto,
  CategoryDto
} from '../../types/apiTypes';

export default function InventoryManagement() {
  const { confirm } = useNotification();
  const { currentStoreId } = useStore();
  const { user } = useAuthStore();
  // Đảm bảo lấy đúng mã cửa hàng và tenant của chủ quán đang đăng nhập
  const storeId = user?.storeId || currentStoreId;
  const tenantId = user?.tenantId;

  // Active Tab: 'stock' | 'recipes' | 'audit'
  const [activeTab, setActiveTab] = useState<'stock' | 'recipes' | 'audit'>('stock');

  // Core Data States
  const [stocks, setStocks] = useState<InventoryStockDto[]>([]);
  const [ingredients, setIngredients] = useState<IngredientDto[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlertDto[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransactionDto[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  // Selected for Recipes Tab
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItemDto | null>(null);
  const [currentRecipes, setCurrentRecipes] = useState<MenuItemRecipeDto[]>([]);
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<number | 'all'>('all');

  // Loading & Notification
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters for Stock Tab
  const [stockSearch, setStockSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'safe' | 'low' | 'out'>('all');

  // Filters for Transactions Tab
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all');
  const [txIngredientFilter, setTxIngredientFilter] = useState<string>('all');

  // Modal States
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientDto | null>(null);
  const [ingredientForm, setIngredientForm] = useState<{
    name: string;
    unit: string;
    minimumStock: string | number;
    initialStock: string | number;
    description: string;
    isActive: boolean;
  }>({
    name: '',
    unit: 'g',
    minimumStock: '',
    initialStock: '',
    description: '',
    isActive: true
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const [importForm, setImportForm] = useState<{
    ingredientId: number;
    quantity: string | number;
    note: string;
  }>({
    ingredientId: 0,
    quantity: '',
    note: ''
  });

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState<{
    ingredientId: number;
    newQuantity: string | number;
    note: string;
  }>({
    ingredientId: 0,
    newQuantity: '',
    note: ''
  });

  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [recipeForm, setRecipeForm] = useState<{
    ingredientId: number;
    sizeId: number | null;
    quantityRequired: string | number;
  }>({
    ingredientId: 0,
    sizeId: null as number | null,
    quantityRequired: ''
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch initial data
  const loadInventoryData = async () => {
    try {
      setIsLoading(true);
      const [stocksData, ingredientsData, alertsData] = await Promise.all([
        inventoryApi.getStocks(storeId),
        inventoryApi.getIngredients(tenantId, storeId),
        inventoryApi.getLowStockAlerts(storeId)
      ]);
      setStocks(stocksData || []);
      setIngredients(ingredientsData || []);
      setAlerts(alertsData || []);
    } catch (err: any) {
      console.error('Error loading inventory data:', err);
      if (err.response?.status === 401) {
        showToast('error', 'Bạn cần đăng nhập để xem dữ liệu kho. Đang chuyển đến trang Đăng nhập...');
        setTimeout(() => {
          window.location.href = '/login?redirect=/admin/inventory';
        }, 1500);
      } else {
        showToast('error', err.response?.data?.message || 'Không thể tải dữ liệu kho. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load menu for recipes
  const loadMenuData = async () => {
    try {
      const storeMenu = await menuApi.getStoreMenu(storeId);
      if (storeMenu) {
        setMenuItems(storeMenu.menuItems || []);
        setCategories(storeMenu.categories || []);
        if (storeMenu.menuItems && storeMenu.menuItems.length > 0 && !selectedMenuItem) {
          setSelectedMenuItem(storeMenu.menuItems[0]);
        }
      }
    } catch (err: any) {
      console.error('Error loading menu:', err);
    }
  };

  // Load transactions
  const loadTransactions = async () => {
    try {
      const txData = await inventoryApi.getTransactions(storeId);
      setTransactions(txData || []);
    } catch (err: any) {
      console.error('Error loading transactions:', err);
    }
  };

  // Load recipes for selected item
  const loadItemRecipes = async (itemId: number) => {
    try {
      const recipes = await inventoryApi.getMenuItemRecipes(itemId);
      setCurrentRecipes(recipes || []);
    } catch (err: any) {
      console.error('Error loading recipes for item:', err);
    }
  };

  useEffect(() => {
    loadInventoryData();
    loadMenuData();
    loadTransactions();
  }, [storeId]);

  useEffect(() => {
    if (selectedMenuItem) {
      loadItemRecipes(selectedMenuItem.menuItemId);
    }
  }, [selectedMenuItem]);

  // Derived KPI Stats
  const kpi = useMemo(() => {
    const total = stocks.length;
    const outOfStock = stocks.filter(s => s.currentQuantity <= 0).length;
    const lowStock = stocks.filter(s => s.isLowStock && s.currentQuantity > 0).length;
    const healthy = total - outOfStock - lowStock;
    return { total, healthy, lowStock, outOfStock };
  }, [stocks]);

  // Filtered Stock Items
  const filteredStocks = useMemo(() => {
    return stocks.filter(item => {
      const matchesSearch = item.ingredientName.toLowerCase().includes(stockSearch.toLowerCase());
      if (!matchesSearch) return false;

      if (stockStatusFilter === 'safe') return !item.isLowStock && item.currentQuantity > 0;
      if (stockStatusFilter === 'low') return item.isLowStock && item.currentQuantity > 0;
      if (stockStatusFilter === 'out') return item.currentQuantity <= 0;
      return true;
    });
  }, [stocks, stockSearch, stockStatusFilter]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (txTypeFilter !== 'all' && tx.type !== txTypeFilter) return false;
      if (txIngredientFilter !== 'all' && tx.ingredientName !== txIngredientFilter) return false;
      return true;
    });
  }, [transactions, txTypeFilter, txIngredientFilter]);

  // Filtered Recipes by Size
  const filteredRecipes = useMemo(() => {
    if (selectedSizeFilter === 'all') return currentRecipes;
    return currentRecipes.filter(r => r.sizeId === selectedSizeFilter);
  }, [currentRecipes, selectedSizeFilter]);

  // Handlers for Ingredients
  const handleOpenCreateIngredient = () => {
    setEditingIngredient(null);
    setIngredientForm({
      name: '',
      unit: 'g',
      minimumStock: '',
      initialStock: '',
      description: '',
      isActive: true
    });
    setShowIngredientModal(true);
  };

  const handleOpenEditIngredient = (stock: InventoryStockDto) => {
    const ing = ingredients.find(i => i.ingredientId === stock.ingredientId);
    if (ing) {
      setEditingIngredient(ing);
      setIngredientForm({
        name: ing.name,
        unit: ing.unit,
        minimumStock: ing.minimumStock.toString(),
        initialStock: '',
        description: ing.description || '',
        isActive: ing.isActive
      });
      setShowIngredientModal(true);
    }
  };

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    const minStock = ingredientForm.minimumStock === '' ? 0 : parseFloat(ingredientForm.minimumStock.toString());
    const initStock = ingredientForm.initialStock === '' ? 0 : parseFloat(ingredientForm.initialStock.toString());

    if (isNaN(minStock) || minStock < 0) {
      showToast('error', 'Định mức tồn tối thiểu không hợp lệ.');
      return;
    }

    try {
      if (editingIngredient) {
        await inventoryApi.updateIngredient(editingIngredient.ingredientId, {
          name: ingredientForm.name,
          unit: ingredientForm.unit,
          minimumStock: minStock,
          description: ingredientForm.description,
          isActive: ingredientForm.isActive
        });
        showToast('success', `Đã cập nhật nguyên liệu "${ingredientForm.name}".`);
      } else {
        if (!tenantId || !storeId) {
          showToast('error', 'Tài khoản chưa được gán tenant/cửa hàng.');
          return;
        }
        await inventoryApi.createIngredient({
          tenantId,
          storeId,
          name: ingredientForm.name,
          unit: ingredientForm.unit,
          minimumStock: minStock,
          initialStock: initStock,
          description: ingredientForm.description
        });
        showToast('success', `Đã thêm mới nguyên liệu "${ingredientForm.name}".`);
      }
      setShowIngredientModal(false);
      loadInventoryData();
      loadTransactions();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Có lỗi xảy ra khi lưu nguyên liệu.');
    }
  };

  const handleDeleteIngredient = async (id: number, name: string) => {
    confirm({ tone: 'warning', title: 'Xóa nguyên liệu?', message: `Bạn có chắc chắn muốn xóa nguyên liệu "${name}"? Thao tác này không thể hoàn tác.`, confirmText: 'Xóa nguyên liệu', onConfirm: async () => {
    try {
      await inventoryApi.deleteIngredient(id);
      showToast('success', `Đã xóa nguyên liệu "${name}".`);
      loadInventoryData();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Không thể xóa nguyên liệu đã có công thức hoặc giao dịch.');
    }
    }});
  };

  // Handlers for Quick Stock-In
  const handleOpenImport = (ingredientId?: number) => {
    const targetId = ingredientId || (stocks[0]?.ingredientId ?? 0);
    setImportForm({
      ingredientId: targetId,
      quantity: '',
      note: 'Nhập hàng định kỳ từ NCC'
    });
    setShowImportModal(true);
  };

  const handleSaveImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(importForm.quantity.toString());
    if (!importForm.ingredientId || isNaN(qty) || qty <= 0) {
      showToast('error', 'Vui lòng chọn nguyên liệu và số lượng nhập lớn hơn 0.');
      return;
    }
    try {
      await inventoryApi.importStock({
        storeId,
        ingredientId: Number(importForm.ingredientId),
        quantity: qty,
        note: importForm.note
      });
      showToast('success', 'Nhập kho thành công!');
      setShowImportModal(false);
      loadInventoryData();
      loadTransactions();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Lỗi khi nhập kho.');
    }
  };

  // Handlers for Stock Adjustment / Audit
  const handleOpenAdjust = (stock?: InventoryStockDto) => {
    const target = stock || stocks[0];
    if (target) {
      setAdjustForm({
        ingredientId: target.ingredientId,
        newQuantity: target.currentQuantity.toString(),
        note: 'Kiểm kê định kỳ cuối ngày'
      });
      setShowAdjustModal(true);
    }
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const newQty = parseFloat(adjustForm.newQuantity.toString());
    if (isNaN(newQty) || newQty < 0) {
      showToast('error', 'Vui lòng nhập số lượng kiểm kê hợp lệ (>= 0).');
      return;
    }
    try {
      await inventoryApi.adjustStock({
        storeId,
        ingredientId: Number(adjustForm.ingredientId),
        newQuantity: newQty,
        note: adjustForm.note
      });
      showToast('success', 'Đã cập nhật số lượng kiểm kê thực tế.');
      setShowAdjustModal(false);
      loadInventoryData();
      loadTransactions();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Lỗi khi điều chỉnh tồn kho.');
    }
  };

  // Handlers for Recipe
  const handleOpenAddRecipe = () => {
    if (!selectedMenuItem) return;
    setRecipeForm({
      ingredientId: stocks[0]?.ingredientId || 0,
      sizeId: null, // Mặc định áp dụng cho tất cả các size / Mặc định
      quantityRequired: ''
    });
    setShowAddRecipeModal(true);
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const reqQty = parseFloat(recipeForm.quantityRequired.toString());
    if (!selectedMenuItem || !recipeForm.ingredientId || isNaN(reqQty) || reqQty <= 0) {
      showToast('error', 'Vui lòng nhập định lượng hợp lệ lớn hơn 0.');
      return;
    }
    try {
      await inventoryApi.upsertRecipe({
        menuItemId: selectedMenuItem.menuItemId,
        ingredientId: Number(recipeForm.ingredientId),
        sizeId: recipeForm.sizeId ? Number(recipeForm.sizeId) : null,
        quantityRequired: reqQty
      });
      showToast('success', 'Đã lưu định lượng nguyên liệu cho món.');
      setShowAddRecipeModal(false);
      loadItemRecipes(selectedMenuItem.menuItemId);
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Lỗi khi lưu định lượng.');
    }
  };

  const handleDeleteRecipe = async (recipeId: number, ingName: string) => {
    confirm({ tone: 'warning', title: 'Gỡ nguyên liệu khỏi công thức?', message: `Xóa định lượng "${ingName}" khỏi món này?`, confirmText: 'Gỡ nguyên liệu', onConfirm: async () => {
    try {
      await inventoryApi.deleteRecipe(recipeId);
      showToast('success', 'Đã gỡ nguyên liệu khỏi công thức món.');
      if (selectedMenuItem) {
        loadItemRecipes(selectedMenuItem.menuItemId);
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Lỗi khi gỡ định lượng.');
    }
    }});
  };

  return (
    <div className="pt-24 pb-16 px-4 md:px-gutter w-full max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl transition-all ${notification.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
            }`}
        >
          <span className="material-symbols-outlined text-xl">
            {notification.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="text-sm font-semibold">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-80">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Header & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-2xl">inventory_2</span>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">
                Quản Lý Kho & Định Lượng FnB
              </h1>
              <p className="text-sm text-on-surface-variant">
                Hệ thống 4 module: Tồn kho thực tế, Định lượng (BOM), Tự động trừ kho & Cảnh báo hao hụt
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleOpenImport()}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-xl font-semibold shadow-md hover:bg-primary/90 active:scale-95 transition-all text-sm"
          >
            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
            Nhập Kho Nhanh
          </button>
          <button
            onClick={() => handleOpenAdjust()}
            className="flex items-center gap-2 bg-surface-container-high text-on-surface hover:bg-secondary-container/40 px-4 py-2.5 rounded-xl font-semibold border border-outline-variant/30 active:scale-95 transition-all text-sm"
          >
            <span className="material-symbols-outlined text-lg">tune</span>
            Kiểm Kê Kho
          </button>
          <button
            onClick={handleOpenCreateIngredient}
            className="flex items-center gap-2 bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 px-4 py-2.5 rounded-xl font-semibold active:scale-95 transition-all text-sm"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Nguyên Liệu Mới
          </button>
        </div>
      </div>

      {/* Top Bento Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Items */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Tổng Nguyên Liệu</p>
            <p className="text-2xl md:text-3xl font-extrabold text-on-surface mt-1">{kpi.total}</p>
            <p className="text-xs text-on-surface-variant/70 mt-0.5">Mặt hàng đang quản lý</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">category</span>
          </div>
        </div>

        {/* Healthy Stock */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Tồn Kho An Toàn</p>
            <p className="text-2xl md:text-3xl font-extrabold text-emerald-700 mt-1">{kpi.healthy}</p>
            <p className="text-xs text-emerald-600/70 mt-0.5">Đạt trên mức tối thiểu</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">check_circle</span>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between transition-all ${kpi.lowStock > 0
            ? 'bg-amber-50/70 border-amber-300 text-amber-900'
            : 'bg-surface-container-lowest border-outline-variant/20'
          }`}>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Sắp Hết Hàng</p>
              {kpi.lowStock > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
            <p className="text-2xl md:text-3xl font-extrabold text-amber-700 mt-1">{kpi.lowStock}</p>
            <p className="text-xs text-amber-800/70 mt-0.5">Dưới ngưỡng an toàn</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
        </div>

        {/* Out of Stock */}
        <div className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between transition-all ${kpi.outOfStock > 0
            ? 'bg-rose-50/80 border-rose-300 text-rose-900'
            : 'bg-surface-container-lowest border-outline-variant/20'
          }`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Đã Cạn Kho</p>
            <p className="text-2xl md:text-3xl font-extrabold text-rose-700 mt-1">{kpi.outOfStock}</p>
            <p className="text-xs text-rose-800/70 mt-0.5">Cần nhập gấp để bán</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">error</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-outline-variant/20 gap-2 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${activeTab === 'stock'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
        >
          <span className="material-symbols-outlined text-lg">shelves</span>
          Module 1 & 3: Tồn Kho & Nhập Xuất
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-surface-container-high font-bold">
            {stocks.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${activeTab === 'recipes'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
        >
          <span className="material-symbols-outlined text-lg">receipt_long</span>
          Module 2: Công Thức Định Lượng (BOM)
        </button>

        <button
          onClick={() => {
            setActiveTab('audit');
            loadTransactions();
          }}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${activeTab === 'audit'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
        >
          <span className="material-symbols-outlined text-lg">history</span>
          Module 4: Cảnh Báo & Biến Động
          {alerts.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-rose-500 text-white font-bold animate-pulse">
              {alerts.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: STOCK & INGREDIENTS (Module 1 & 3) */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          {/* Controls: Search & Filter Chips */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
                search
              </span>
              <input
                type="text"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Tìm kiếm nguyên liệu (cà phê, sữa, trà, ly...)..."
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setStockStatusFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${stockStatusFilter === 'all'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                  }`}
              >
                Tất cả ({stocks.length})
              </button>
              <button
                onClick={() => setStockStatusFilter('safe')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${stockStatusFilter === 'safe'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
              >
                An toàn ({kpi.healthy})
              </button>
              <button
                onClick={() => setStockStatusFilter('low')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${stockStatusFilter === 'low'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
              >
                Sắp hết ({kpi.lowStock})
              </button>
              <button
                onClick={() => setStockStatusFilter('out')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${stockStatusFilter === 'out'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
              >
                Hết hàng ({kpi.outOfStock})
              </button>
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left border-collapse">
                <thead className="bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  <tr>
                    <th className="px-5 py-4">Nguyên Liệu</th>
                    <th className="px-5 py-4">Đơn Vị</th>
                    <th className="px-5 py-4">Tồn Hiện Tại</th>
                    <th className="px-5 py-4">Mức Tối Thiểu</th>
                    <th className="px-5 py-4">Mức Độ Tồn Kho</th>
                    <th className="px-5 py-4">Trạng Thái</th>
                    <th className="px-5 py-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-sm">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-on-surface-variant">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
                        <p className="mt-2 text-xs">Đang tải dữ liệu kho...</p>
                      </td>
                    </tr>
                  ) : filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-on-surface-variant">
                        <span className="material-symbols-outlined text-4xl opacity-40">inventory</span>
                        <p className="mt-2 font-medium">Không tìm thấy nguyên liệu nào phù hợp.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.map((item) => {
                      const percent = item.minimumStock > 0
                        ? Math.min(100, Math.round((item.currentQuantity / (item.minimumStock * 2)) * 100))
                        : 100;

                      const isOut = item.currentQuantity <= 0;
                      const isLow = item.isLowStock && !isOut;

                      return (
                        <tr key={item.stockId} className="hover:bg-surface-container/40 transition-colors">
                          <td className="px-5 py-4 font-semibold text-on-surface">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${isOut ? 'bg-rose-100 text-rose-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-secondary-container/60 text-primary'
                                }`}>
                                {item.ingredientName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-on-surface">{item.ingredientName}</p>
                                <p className="text-xs text-on-surface-variant/70">Mã NL: #{item.ingredientId}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant font-mono text-xs font-semibold">
                              {item.unit}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className={`text-base font-bold ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-on-surface'
                              }`}>
                              {item.currentQuantity.toLocaleString('vi-VN')}
                            </span>
                            <span className="text-xs text-on-surface-variant ml-1">{item.unit}</span>
                          </td>

                          <td className="px-5 py-4 text-on-surface-variant font-medium">
                            {item.minimumStock.toLocaleString('vi-VN')} {item.unit}
                          </td>

                          <td className="px-5 py-4 min-w-[160px]">
                            <div className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                style={{ width: `${Math.max(5, percent)}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-on-surface-variant/80 mt-1 block">
                              {isOut ? '0%' : `${item.currentQuantity.toLocaleString('vi-VN')} / ${item.minimumStock} min`}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                Hết hàng
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                                Sắp hết
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                Đủ dùng
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenImport(item.ingredientId)}
                                title="Nhập thêm"
                                className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-all"
                              >
                                <span className="material-symbols-outlined text-lg">add_box</span>
                              </button>
                              <button
                                onClick={() => handleOpenAdjust(item)}
                                title="Kiểm kê điều chỉnh"
                                className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-lg transition-all"
                              >
                                <span className="material-symbols-outlined text-lg">tune</span>
                              </button>
                              <button
                                onClick={() => handleOpenEditIngredient(item)}
                                title="Sửa thông tin"
                                className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-lg transition-all"
                              >
                                <span className="material-symbols-outlined text-lg">edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteIngredient(item.ingredientId, item.ingredientName)}
                                title="Xóa nguyên liệu"
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECIPES / BOM (Module 2) */}
      {activeTab === 'recipes' && (
        <div className="space-y-6">
          {/* Automatic Deduction Explanation Banner */}
          <div className="bg-gradient-to-r from-primary/10 via-secondary-container/30 to-surface-container-lowest p-5 rounded-2xl border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-2xl mt-0.5">auto_mode</span>
              <div>
                <h3 className="font-bold text-primary text-base">Cơ chế Trừ Kho Tự Động (Auto-Deduction)</h3>
                <p className="text-xs text-on-surface-variant mt-0.5 max-w-2xl">
                  Khi khách hàng hoặc nhân viên thanh toán đơn hàng thành công, hệ thống tự động tra cứu công thức theo Size và trừ chính xác số lượng nguyên liệu trong kho. Nếu không định nghĩa theo Size, công thức mặc định sẽ được áp dụng.
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenAddRecipe}
              disabled={!selectedMenuItem}
              className="flex items-center justify-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-xl text-sm font-semibold shadow hover:bg-primary/90 active:scale-95 disabled:opacity-50 whitespace-nowrap transition-all"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Thêm Thành Phần Định Lượng
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Menu Item Selector */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 shadow-sm">
                <h4 className="font-bold text-sm text-on-surface mb-3 flex items-center justify-between">
                  <span>Chọn Món Để Cài Công Thức</span>
                  <span className="text-xs text-primary font-normal">{menuItems.length} món</span>
                </h4>

                <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                  {menuItems.map((item) => {
                    const isSelected = selectedMenuItem?.menuItemId === item.menuItemId;
                    return (
                      <div
                        key={item.menuItemId}
                        onClick={() => setSelectedMenuItem(item)}
                        className={`p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 border ${isSelected
                            ? 'bg-primary/10 border-primary text-primary shadow-sm'
                            : 'bg-surface-container-low/50 border-transparent hover:bg-surface-container text-on-surface'
                          }`}
                      >
                        <img
                          src={item.imageUrl || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=100'}
                          alt={item.name}
                          className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{item.name}</p>
                          <p className="text-xs text-on-surface-variant truncate">
                            {item.categoryName} • {item.basePrice.toLocaleString('vi-VN')}đ
                          </p>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-primary text-lg">chevron_right</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Recipe Details for Selected Item */}
            <div className="lg:col-span-8 space-y-4">
              {selectedMenuItem ? (
                <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-sm">
                  {/* Item Title & Size Filter Chips */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-outline-variant/10">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-primary">Công Thức Định Lượng (BOM)</span>
                      <h2 className="text-xl font-extrabold text-on-surface mt-0.5">{selectedMenuItem.name}</h2>
                      <p className="text-xs text-on-surface-variant">
                        Mã món: #{selectedMenuItem.menuItemId} • Danh mục: {selectedMenuItem.categoryName}
                      </p>
                    </div>

                    {/* Size Selector / Filter */}
                    <div className="flex items-center gap-1.5 bg-surface-container p-1 rounded-xl">
                      <button
                        onClick={() => setSelectedSizeFilter('all')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedSizeFilter === 'all'
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                      >
                        Tất cả size
                      </button>
                      {selectedMenuItem.sizes && selectedMenuItem.sizes.map((s) => (
                        <button
                          key={s.sizeId}
                          onClick={() => setSelectedSizeFilter(s.sizeId)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedSizeFilter === s.sizeId
                              ? 'bg-primary text-on-primary shadow-sm'
                              : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                          Size {s.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recipe Ingredients Table */}
                  <div className="mt-5">
                    {filteredRecipes.length === 0 ? (
                      <div className="text-center py-12 bg-surface-container-low/40 rounded-2xl border border-dashed border-outline-variant/40">
                        <span className="material-symbols-outlined text-4xl text-on-surface-variant/50">science</span>
                        <p className="font-semibold text-on-surface mt-2">Chưa có công thức định lượng cho món này</p>
                        <p className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto">
                          Hãy thêm các nguyên liệu như cà phê hạt, sữa, siro, ly, ống hút để hệ thống tự động trừ kho khi xuất đơn.
                        </p>
                        <button
                          onClick={handleOpenAddRecipe}
                          className="mt-4 inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-xl text-xs font-bold shadow hover:bg-primary/90 transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                          Thêm Nguyên Liệu Đầu Tiên
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-left border-collapse">
                          <thead className="bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                            <tr>
                              <th className="px-4 py-3 rounded-l-xl">Thành Phần Nguyên Liệu</th>
                              <th className="px-4 py-3">Áp Dụng Size</th>
                              <th className="px-4 py-3">Định Lượng Tiêu Hao</th>
                              <th className="px-4 py-3">Tồn Kho Hiện Tại</th>
                              <th className="px-4 py-3">Khả Năng Phục Vụ</th>
                              <th className="px-4 py-3 rounded-r-xl text-right">Xóa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/10 text-sm">
                            {filteredRecipes.map((r) => {
                              const stock = stocks.find(s => s.ingredientId === r.ingredientId);
                              const currentQty = stock?.currentQuantity ?? 0;
                              const cupsPossible = r.quantityRequired > 0 ? Math.floor(currentQty / r.quantityRequired) : 0;

                              return (
                                <tr key={r.recipeId} className="hover:bg-surface-container/30 transition-colors">
                                  <td className="px-4 py-3.5 font-semibold text-on-surface">
                                    <div className="flex items-center gap-2.5">
                                      <span className="w-7 h-7 rounded-lg bg-secondary-container/60 text-primary flex items-center justify-center text-xs font-bold">
                                        {r.ingredientName.charAt(0)}
                                      </span>
                                      <span>{r.ingredientName}</span>
                                    </div>
                                  </td>

                                  <td className="px-4 py-3.5">
                                    <span className="px-2.5 py-1 rounded-md bg-surface-container text-xs font-semibold text-on-surface-variant">
                                      {r.sizeName ? `Size ${r.sizeName}` : 'Mặc định / Mọi size'}
                                    </span>
                                  </td>

                                  <td className="px-4 py-3.5">
                                    <span className="font-extrabold text-primary text-base">
                                      {r.quantityRequired}
                                    </span>
                                    <span className="text-xs text-on-surface-variant ml-1">{r.unit} / ly</span>
                                  </td>

                                  <td className="px-4 py-3.5 text-on-surface-variant font-medium">
                                    {currentQty.toLocaleString('vi-VN')} {r.unit}
                                  </td>

                                  <td className="px-4 py-3.5">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${cupsPossible <= 0
                                        ? 'bg-rose-100 text-rose-700'
                                        : cupsPossible < 10
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-emerald-100 text-emerald-700'
                                      }`}>
                                      {cupsPossible <= 0 ? 'Hết hàng' : `Đủ làm ~${cupsPossible} ly`}
                                    </span>
                                  </td>

                                  <td className="px-4 py-3.5 text-right">
                                    <button
                                      onClick={() => handleDeleteRecipe(r.recipeId, r.ingredientName)}
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                      title="Xóa thành phần"
                                    >
                                      <span className="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-surface-container-lowest p-12 text-center rounded-2xl border border-outline-variant/20 text-on-surface-variant">
                  <span className="material-symbols-outlined text-5xl opacity-40">touch_app</span>
                  <p className="mt-2 font-medium">Chọn một món ăn bên trái để cấu hình định lượng nguyên liệu.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT & ALERTS (Module 4) */}
      {activeTab === 'audit' && (
        <div className="space-y-8">
          {/* Section 1: Low Stock Alert Center */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-2xl">crisis_alert</span>
                <h2 className="text-lg font-bold text-on-surface">Trung Tâm Cảnh Báo Thiếu Hụt Tồn Kho</h2>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-rose-100 text-rose-700 font-bold">
                {alerts.length} Mặt Hàng Cần Nhập
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-emerald-600">verified</span>
                <div>
                  <p className="font-bold text-sm">Tuyệt vời! Kho hàng đang trong trạng thái an toàn.</p>
                  <p className="text-xs text-emerald-700 mt-0.5">Không có nguyên liệu nào bị tụt xuống dưới mức tồn tối thiểu.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alerts.map((al) => (
                  <div
                    key={al.stockId}
                    className="p-4 rounded-2xl border border-rose-200 bg-rose-50/60 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="font-bold text-rose-900 text-base">{al.ingredientName}</h4>
                        <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-200 text-rose-800 uppercase">
                          Thiếu {al.deficit.toLocaleString('vi-VN')} {al.unit}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-rose-900/80">
                        <div className="flex justify-between">
                          <span>Tồn hiện tại:</span>
                          <span className="font-bold text-rose-700">{al.currentQuantity.toLocaleString('vi-VN')} {al.unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Mức tối thiểu:</span>
                          <span className="font-bold">{al.minimumStock.toLocaleString('vi-VN')} {al.unit}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenImport(al.ingredientId)}
                      className="mt-4 w-full flex items-center justify-center gap-1.5 bg-rose-600 text-white py-2 rounded-xl text-xs font-bold shadow hover:bg-rose-700 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                      Nhập Hàng Ngay ({al.deficit.toLocaleString('vi-VN')} {al.unit})
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Transaction Audit Logs */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">history_edu</span>
                  Nhật Ký Biến Động Kho (Audit Log)
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Ghi lại mọi biến động từ Bán hàng tự động trừ, Nhập kho NCC, đến Kiểm kê điều chỉnh
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                  className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">Mọi loại biến động</option>
                  <option value="deduction">Đơn hàng (Trừ tự động)</option>
                  <option value="import">Nhập kho (+)</option>
                  <option value="adjustment">Điều chỉnh kiểm kê (±)</option>
                  <option value="export">Xuất kho (-)</option>
                </select>

                <select
                  value={txIngredientFilter}
                  onChange={(e) => setTxIngredientFilter(e.target.value)}
                  className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">Tất cả nguyên liệu</option>
                  {ingredients.map(ing => (
                    <option key={ing.ingredientId} value={ing.name}>{ing.name}</option>
                  ))}
                </select>

                <button
                  onClick={loadTransactions}
                  className="p-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
                  title="Làm mới"
                >
                  <span className="material-symbols-outlined text-lg">refresh</span>
                </button>
              </div>
            </div>

            {/* Audit Log Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left border-collapse">
                <thead className="bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  <tr>
                    <th className="px-4 py-3 rounded-l-xl">Thời Gian</th>
                    <th className="px-4 py-3">Loại Biến Động</th>
                    <th className="px-4 py-3">Nguyên Liệu</th>
                    <th className="px-4 py-3">Số Lượng</th>
                    <th className="px-4 py-3">Tồn Trước ➔ Sau</th>
                    <th className="px-4 py-3">Mã Đơn / Thực Hiện</th>
                    <th className="px-4 py-3 rounded-r-xl">Ghi Chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-sm">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-on-surface-variant">
                        <span className="material-symbols-outlined text-3xl opacity-40">receipt_long</span>
                        <p className="mt-1 text-xs">Chưa có giao dịch biến động nào.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const isDeduction = tx.type === 'deduction' || tx.type === 'export';
                      const isImport = tx.type === 'import';

                      return (
                        <tr key={tx.transactionId} className="hover:bg-surface-container/30 transition-colors">
                          <td className="px-4 py-3 text-xs text-on-surface-variant font-mono">
                            {new Date(tx.createdAt).toLocaleString('vi-VN')}
                          </td>

                          <td className="px-4 py-3">
                            {isImport ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                + Nhập kho
                              </span>
                            ) : isDeduction ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                                - Trừ đơn hàng
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                                ± Kiểm kê
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 font-semibold text-on-surface">
                            {tx.ingredientName}
                          </td>

                          <td className="px-4 py-3 font-bold font-mono">
                            <span className={isImport ? 'text-emerald-600' : isDeduction ? 'text-rose-600' : 'text-purple-600'}>
                              {isImport ? `+${tx.quantity}` : isDeduction ? `-${tx.quantity}` : tx.quantity}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-xs font-mono text-on-surface-variant">
                            <span>{tx.quantityBefore.toLocaleString('vi-VN')}</span>
                            <span className="mx-1.5 opacity-50">➔</span>
                            <span className="font-bold text-on-surface">{tx.quantityAfter.toLocaleString('vi-VN')}</span>
                          </td>

                          <td className="px-4 py-3 text-xs">
                            {tx.orderCode ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-bold">
                                {tx.orderCode}
                              </span>
                            ) : tx.staffName ? (
                              <span className="text-on-surface-variant">{tx.staffName}</span>
                            ) : (
                              <span className="text-on-surface-variant/60">Hệ thống</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-xs text-on-surface-variant max-w-xs truncate">
                            {tx.note || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD/EDIT INGREDIENT */}
      {showIngredientModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl p-6 shadow-2xl border border-outline-variant/30 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10">
              <h3 className="text-lg font-bold text-primary">
                {editingIngredient ? 'Chỉnh Sửa Nguyên Liệu' : 'Thêm Nguyên Liệu Mới'}
              </h3>
              <button onClick={() => setShowIngredientModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveIngredient} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Tên nguyên liệu *</label>
                <input
                  type="text"
                  required
                  value={ingredientForm.name}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                  placeholder="Ví dụ: Cà phê Robusta Đắk Lắk"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">Đơn vị tính *</label>
                  <select
                    value={ingredientForm.unit}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="g">g (Gram)</option>
                    <option value="kg">kg (Kilogram)</option>
                    <option value="ml">ml (Mililit)</option>
                    <option value="lít">lít (Lít)</option>
                    <option value="lon">lon</option>
                    <option value="hộp">hộp</option>
                    <option value="gói">gói</option>
                    <option value="cái">cái (Ly/Ống hút)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">Tồn tối thiểu (Min) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="Ví dụ: 100 hoặc 0.5"
                    value={ingredientForm.minimumStock}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, minimumStock: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {!editingIngredient && (
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">Tồn kho ban đầu</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Ví dụ: 500 hoặc 2.5"
                    value={ingredientForm.initialStock}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, initialStock: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="text-[11px] text-on-surface-variant/70 mt-1">Số lượng nguyên liệu có sẵn hiện tại khi tạo mới</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Mô tả / Ghi chú</label>
                <textarea
                  rows={2}
                  value={ingredientForm.description}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, description: e.target.value })}
                  placeholder="Ghi chú nhà cung cấp, hạn dùng, quy cách đóng gói..."
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/10">
                <button
                  type="button"
                  onClick={() => setShowIngredientModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-primary text-on-primary shadow hover:bg-primary/90"
                >
                  Lưu Nguyên Liệu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK IMPORT (STOCK-IN) */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl p-6 shadow-2xl border border-outline-variant/30 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10">
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">add_shopping_cart</span>
                Nhập Kho Nhanh
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveImport} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Chọn nguyên liệu nhập *</label>
                <select
                  value={importForm.ingredientId}
                  onChange={(e) => setImportForm({ ...importForm, ingredientId: Number(e.target.value) })}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {stocks.map(s => (
                    <option key={s.ingredientId} value={s.ingredientId}>
                      {s.ingredientName} (Hiện có: {s.currentQuantity} {s.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Số lượng nhập thêm *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    placeholder="Ví dụ: 5 hoặc 0.5"
                    value={importForm.quantity}
                    onChange={(e) => setImportForm({ ...importForm, quantity: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-primary"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">
                    {stocks.find(s => s.ingredientId === importForm.ingredientId)?.unit || ''}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Ghi chú nhập kho</label>
                <input
                  type="text"
                  value={importForm.note}
                  onChange={(e) => setImportForm({ ...importForm, note: e.target.value })}
                  placeholder="Ví dụ: Nhập theo hóa đơn #NCC-2026, NCC Trung Nguyên"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/10">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-primary text-on-primary shadow hover:bg-primary/90"
                >
                  Xác Nhận Nhập Kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: AUDIT ADJUSTMENT */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl p-6 shadow-2xl border border-outline-variant/30 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10">
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">tune</span>
                Kiểm Kê / Điều Chỉnh Tồn Kho
              </h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Nguyên liệu kiểm kê *</label>
                <select
                  value={adjustForm.ingredientId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const stock = stocks.find(s => s.ingredientId === id);
                    setAdjustForm({
                      ...adjustForm,
                      ingredientId: id,
                      newQuantity: stock ? stock.currentQuantity.toString() : ''
                    });
                  }}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {stocks.map(s => (
                    <option key={s.ingredientId} value={s.ingredientId}>
                      {s.ingredientName} (Sổ sách: {s.currentQuantity} {s.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Số lượng thực tế đếm được *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="Nhập số lượng kiểm đếm thực tế"
                    value={adjustForm.newQuantity}
                    onChange={(e) => setAdjustForm({ ...adjustForm, newQuantity: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-purple-700"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">
                    {stocks.find(s => s.ingredientId === adjustForm.ingredientId)?.unit || ''}
                  </span>
                </div>
                {(() => {
                  const s = stocks.find(i => i.ingredientId === adjustForm.ingredientId);
                  if (s) {
                    const parsedVal = adjustForm.newQuantity === '' ? 0 : parseFloat(adjustForm.newQuantity.toString());
                    const diff = Number((parsedVal - s.currentQuantity).toFixed(4));
                    return (
                      <p className={`text-xs mt-1 font-semibold ${diff < 0 ? 'text-rose-600' : diff > 0 ? 'text-emerald-600' : 'text-on-surface-variant'}`}>
                        Chênh lệch so với sổ sách: {diff > 0 ? `+${diff}` : diff} {s.unit} ({diff < 0 ? 'Hao hụt/Mất mát' : diff > 0 ? 'Dư thực tế' : 'Khớp hoàn toàn'})
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Lý do điều chỉnh *</label>
                <input
                  type="text"
                  required
                  value={adjustForm.note}
                  onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
                  placeholder="Ví dụ: Kiểm kê định kỳ, hao hụt pha chế, đổ vỡ..."
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/10">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-primary text-on-primary shadow hover:bg-primary/90"
                >
                  Cập Nhật Kiểm Kê
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD RECIPE INGREDIENT */}
      {showAddRecipeModal && selectedMenuItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl p-6 shadow-2xl border border-outline-variant/30 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10">
              <div>
                <h3 className="text-lg font-bold text-primary">Thêm Định Lượng Nguyên Liệu</h3>
                <p className="text-xs text-on-surface-variant">Cho món: {selectedMenuItem.name}</p>
              </div>
              <button onClick={() => setShowAddRecipeModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Nguyên liệu sử dụng *</label>
                <select
                  value={recipeForm.ingredientId}
                  onChange={(e) => setRecipeForm({ ...recipeForm, ingredientId: Number(e.target.value) })}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {stocks.map(s => (
                    <option key={s.ingredientId} value={s.ingredientId}>
                      {s.ingredientName} ({s.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Áp dụng cho Size</label>
                <select
                  value={recipeForm.sizeId ?? ''}
                  onChange={(e) => setRecipeForm({ ...recipeForm, sizeId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Tất cả các size / Mặc định</option>
                  {selectedMenuItem.sizes && selectedMenuItem.sizes.map(s => (
                    <option key={s.sizeId} value={s.sizeId}>
                      Size {s.name} (+{s.extraPrice.toLocaleString('vi-VN')}đ)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  Định lượng cần cho 1 phần *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    placeholder="Ví dụ: 0.02 (nếu là kg) hoặc 20 (nếu là g)"
                    value={recipeForm.quantityRequired}
                    onChange={(e) => setRecipeForm({ ...recipeForm, quantityRequired: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">
                    {stocks.find(s => s.ingredientId === recipeForm.ingredientId)?.unit || 'g'}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant/70 mt-1">
                  Mỗi khi món này được bán và thanh toán, kho sẽ tự trừ lượng này. (Hỗ trợ số lẻ như 0.02 kg, 0.05 lít, 15 g...)
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/10">
                <button
                  type="button"
                  onClick={() => setShowAddRecipeModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-primary text-on-primary shadow hover:bg-primary/90"
                >
                  Lưu Vào Công Thức
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating AI Inventory Chatbot */}
      <InventoryAiChat storeId={storeId} lowStockCount={alerts.length} />
    </div>
  );
}
