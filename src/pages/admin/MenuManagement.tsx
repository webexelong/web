import { useState, useEffect } from 'react';
import { apiClient } from '../../api/apiClient';
import Pagination from '../../components/Pagination';
import { useNotification } from '../../components/NotificationProvider';

interface Category {
  categoryId: number;
  name: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

interface MenuItemSize {
  sizeId?: number;
  name?: string;
  sizeName?: string;
  extraPrice: number;
}

interface MenuItem {
  menuItemId: number;
  tenantId: number;
  categoryId: number;
  name: string;
  description?: string;
  basePrice: number;
  imageUrl?: string;
  rating: number;
  isFeatured: boolean;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  sizes?: Array<{ sizeId: number; name: string; extraPrice: number }>;
}

export default function MenuManagement() {
  const { confirm } = useNotification();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [error, setError] = useState('');
  
  const PAGE_SIZE = 8;

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    basePrice: 0,
    categoryId: 0,
    imageUrl: '',
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    customSizes: [] as Array<{ sizeId?: number; sizeName: string; extraPrice: number }>,
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    icon: '',
    sortOrder: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [itemsRes, catsRes] = await Promise.all([
        apiClient.get('/menu/items'),
        apiClient.get('/menu/categories'),
      ]);

      setMenuItems(itemsRes.data.data || []);
      setCategories(catsRes.data.data || []);
    } catch (err: any) {
      console.error('Load menu failed:', err);
      setError(err.response?.data?.message || 'Không thể tải dữ liệu thực đơn');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = activeCategory 
    ? menuItems.filter(item => item.categoryId === activeCategory)
    : menuItems;

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const paginatedItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const payload = {
        ...formData,
        customSizes: formData.customSizes
          .filter(s => s.sizeName.trim().length > 0)
          .map(s => ({
            sizeId: s.sizeId,
            sizeName: s.sizeName.trim(),
            extraPrice: Number(s.extraPrice) || 0,
          })),
      };
      await apiClient.post('/menu/items', payload);
      setShowAddModal(false);
      loadData();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Thêm món thất bại');
    }
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    
    try {
      setError('');
      const payload = {
        ...formData,
        customSizes: formData.customSizes
          .filter(s => s.sizeName.trim().length > 0)
          .map(s => ({
            sizeId: s.sizeId,
            sizeName: s.sizeName.trim(),
            extraPrice: Number(s.extraPrice) || 0,
          })),
      };
      await apiClient.put(`/menu/items/${editingItem.menuItemId}`, payload);
      setShowEditModal(false);
      setEditingItem(null);
      loadData();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Cập nhật món thất bại');
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    confirm({ tone: 'warning', title: 'Xóa món?', message: 'Bạn có chắc muốn xóa món này? Thao tác này không thể hoàn tác.', confirmText: 'Xóa món', onConfirm: async () => {
    try {
      setError('');
      await apiClient.delete(`/menu/items/${itemId}`);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Xóa món thất bại');
    }
    }});
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await apiClient.post('/menu/categories', categoryForm);
      setShowCategoryModal(false);
      loadData();
      setCategoryForm({ name: '', icon: '', sortOrder: 0 });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Thêm danh mục thất bại');
    }
  };

  const handleAddSizeOption = () => {
    setFormData(prev => ({
      ...prev,
      customSizes: [...prev.customSizes, { sizeName: '', extraPrice: 0 }],
    }));
  };

  const handleApplyPresetSizes = (preset: 'ml' | 'sml') => {
    if (preset === 'ml') {
      setFormData(prev => ({
        ...prev,
        customSizes: [
          { sizeName: 'Medium', extraPrice: 0 },
          { sizeName: 'Large', extraPrice: 15000 },
        ],
      }));
    } else if (preset === 'sml') {
      setFormData(prev => ({
        ...prev,
        customSizes: [
          { sizeName: 'Nhỏ (S)', extraPrice: 0 },
          { sizeName: 'Vừa (M)', extraPrice: 10000 },
          { sizeName: 'Lớn (L)', extraPrice: 15000 },
        ],
      }));
    }
  };

  const handleUpdateSizeOption = (index: number, field: 'sizeName' | 'extraPrice', value: any) => {
    setFormData(prev => {
      const updated = [...prev.customSizes];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, customSizes: updated };
    });
  };

  const handleRemoveSizeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      customSizes: prev.customSizes.filter((_, i) => i !== index),
    }));
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      basePrice: item.basePrice,
      categoryId: item.categoryId,
      imageUrl: item.imageUrl || '',
      isAvailable: item.isAvailable,
      isFeatured: item.isFeatured,
      sortOrder: item.sortOrder,
      customSizes: (item.sizes || []).map(s => ({
        sizeId: s.sizeId,
        sizeName: s.name,
        extraPrice: s.extraPrice,
      })),
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      basePrice: 0,
      categoryId: 0,
      imageUrl: '',
      isAvailable: true,
      isFeatured: false,
      sortOrder: 0,
      customSizes: [],
    });
  };

  const renderSizeOptionsSection = () => (
    <div className="border border-outline-variant/50 rounded-2xl p-4 bg-surface-container-low/40">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <label className="block text-sm font-bold text-on-surface">
            Tùy chọn Kích cỡ & Upsize
          </label>
          <p className="text-xs text-on-surface-variant">
            Thiết lập các cỡ (Medium, Large...) và tiền phụ thu khi khách chọn upsize. Để trống nếu món không có size.
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-on-surface-variant font-medium">Mẫu nhanh:</span>
          <button
            type="button"
            onClick={() => handleApplyPresetSizes('ml')}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-secondary-container/60 hover:bg-secondary-container text-secondary transition-colors"
          >
            M (+0đ) / L (+15k)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPresetSizes('sml')}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-secondary-container/60 hover:bg-secondary-container text-secondary transition-colors"
          >
            S / M / L
          </button>
        </div>
      </div>

      {formData.customSizes.length === 0 ? (
        <div className="text-center py-4 border border-dashed border-outline-variant/60 rounded-xl bg-surface-container-lowest text-xs text-on-surface-variant">
          Món này hiện chưa có kích cỡ riêng (bán theo giá gốc).
          <div className="mt-2">
            <button
              type="button"
              onClick={handleAddSizeOption}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary/20 text-xs transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Thêm kích cỡ đầu tiên
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {formData.customSizes.map((size, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/30">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Tên kích cỡ (VD: Vừa, Lớn, Size L)"
                  value={size.sizeName}
                  onChange={(e) => handleUpdateSizeOption(idx, 'sizeName', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-outline-variant/50 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
                  required
                />
              </div>
              <div className="w-36 flex items-center gap-1">
                <span className="text-xs text-on-surface-variant whitespace-nowrap">+</span>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  step="1000"
                  value={size.extraPrice}
                  onChange={(e) => handleUpdateSizeOption(idx, 'extraPrice', Number(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-sm border border-outline-variant/50 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
                />
                <span className="text-xs text-on-surface-variant">đ</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveSizeOption(idx)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Xóa kích cỡ này"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          ))}

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={handleAddSizeOption}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Thêm kích cỡ khác
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, customSizes: [] }))}
              className="text-xs text-on-surface-variant hover:text-red-600 transition-colors"
            >
              Xóa tất cả kích cỡ
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="pt-24 pb-12 px-gutter">
        <div className="w-full max-w-[1600px] mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Đang tải thực đơn...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-12 px-gutter animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-stack-lg gap-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary">Quản Lý Thực Đơn</h2>
            <p className="text-on-surface-variant font-body-md">
              Quản lý {menuItems.length} món ăn trong {categories.length} danh mục
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowCategoryModal(true)}
              className="flex items-center justify-center gap-2 bg-surface-container text-primary px-6 py-3 rounded-full font-label-md shadow-md hover:bg-surface-container-high transition-all active:scale-95"
            >
              <span className="material-symbols-outlined">category</span>
              Danh Mục
            </button>
            <button 
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="flex items-center justify-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-label-md shadow-md hover:bg-primary-container transition-all active:scale-95"
            >
              <span className="material-symbols-outlined">add</span>
              Thêm Món Mới
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">❌ {error}</p>
          </div>
        )}

        {/* Categories Chips */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-stack-md pb-2">
          <button 
            onClick={() => {
              setActiveCategory(null);
              setCurrentPage(1);
            }}
            className={`px-5 py-2 rounded-full font-label-md whitespace-nowrap transition-colors ${
              activeCategory === null
                ? 'bg-secondary-container text-on-secondary-container border border-primary/20 font-bold' 
                : 'bg-surface-container text-on-surface-variant hover:bg-secondary-container/50'
            }`}
          >
            Tất Cả ({menuItems.length})
          </button>
          {categories.map(cat => (
            <button 
              key={cat.categoryId}
              onClick={() => {
                setActiveCategory(cat.categoryId);
                setCurrentPage(1);
              }}
              className={`px-5 py-2 rounded-full font-label-md whitespace-nowrap transition-colors ${
                activeCategory === cat.categoryId
                  ? 'bg-secondary-container text-on-secondary-container border border-primary/20 font-bold' 
                  : 'bg-surface-container text-on-surface-variant hover:bg-secondary-container/50'
              }`}
            >
              {cat.icon && <span className="material-symbols-outlined align-middle mr-1 text-base">{cat.icon}</span>}
              {cat.name} ({menuItems.filter(i => i.categoryId === cat.categoryId).length})
            </button>
          ))}
        </div>

        {/* Menu Table */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_rgba(85,55,34,0.06)] border border-outline-variant/30 overflow-hidden flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left border-collapse">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-6 py-4 font-label-md text-on-surface-variant uppercase tracking-wider text-xs">Món</th>
                  <th className="px-6 py-4 font-label-md text-on-surface-variant uppercase tracking-wider text-xs">Danh Mục</th>
                  <th className="px-6 py-4 font-label-md text-on-surface-variant uppercase tracking-wider text-xs">Giá</th>
                  <th className="px-6 py-4 font-label-md text-on-surface-variant uppercase tracking-wider text-xs">Trạng Thái</th>
                  <th className="px-6 py-4 font-label-md text-on-surface-variant uppercase tracking-wider text-xs text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">
                      Chưa có món nào. Hãy thêm món mới!
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map(item => {
                    const category = categories.find(c => c.categoryId === item.categoryId);
                    
                    return (
                      <tr key={item.menuItemId} className="hover:bg-surface-container transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img 
                              className="w-12 h-12 rounded-xl object-cover" 
                              src={item.imageUrl || 'https://via.placeholder.com/100'} 
                              alt={item.name} 
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-label-md text-on-surface font-bold">{item.name}</p>
                                {item.isFeatured && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"><span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>Nổi bật</span>}
                              </div>
                              <p className="text-xs text-on-surface-variant line-clamp-1">
                                {item.description || 'Không có mô tả'}
                              </p>
                              {item.sizes && item.sizes.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {item.sizes.map((s, idx) => (
                                    <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-secondary-container/50 text-secondary border border-secondary/20 font-medium">
                                      {s.name}: +{s.extraPrice.toLocaleString('vi-VN')}đ
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full bg-secondary-container/40 text-secondary text-xs font-semibold">
                            {category?.name || 'Chưa phân loại'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-label-md text-primary font-bold">
                          {item.basePrice.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.isAvailable 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {item.isAvailable ? 'Đang Bán' : 'Hết Hàng'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => openEditModal(item)}
                            className="text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all text-xs font-bold active:scale-95 mr-2"
                          >
                            Sửa
                          </button>
                          <button 
                            onClick={() => handleDeleteItem(item.menuItemId)}
                            className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all text-xs font-bold active:scale-95"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredItems.length > 0 && (
            <div className="px-4 py-2 bg-surface-container-low border-t border-outline-variant/20">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => setCurrentPage(p)}
                totalItems={filteredItems.length}
                pageSize={PAGE_SIZE}
                itemName="món"
              />
            </div>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-primary">Thêm Món Mới</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên món *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Cà phê sữa đá"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Mô tả về món ăn"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="35000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục *</label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value={0}>Chọn danh mục</option>
                    {categories.map(cat => (
                      <option key={cat.categoryId} value={cat.categoryId}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL hình ảnh</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              {renderSizeOptionsSection()}

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isAvailable}
                    onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Đang bán</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Món nổi bật</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-container transition-colors"
                >
                  Thêm Món
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-primary">Sửa Món</h3>
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên món *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục *</label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {categories.map(cat => (
                      <option key={cat.categoryId} value={cat.categoryId}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL hình ảnh</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {renderSizeOptionsSection()}

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isAvailable}
                    onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Đang bán</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Món nổi bật</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                  }}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-container transition-colors"
                >
                  Cập Nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-primary">Thêm Danh Mục</h3>
              <button 
                onClick={() => setShowCategoryModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên danh mục *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Cà phê"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
                <input
                  type="text"
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="☕"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thứ tự sắp xếp</label>
                <input
                  type="number"
                  value={categoryForm.sortOrder}
                  onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-container transition-colors"
                >
                  Thêm Danh Mục
                </button>
              </div>
            </form>

            {/* Existing Categories */}
            {categories.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium text-gray-700 mb-3">Danh mục hiện tại:</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {categories.map(cat => (
                    <div key={cat.categoryId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">
                        <span className="material-symbols-outlined align-middle mr-1 text-base">{cat.icon || 'category'}</span>{cat.name}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        cat.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
