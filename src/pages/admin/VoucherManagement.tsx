import React, { useState, useEffect, useMemo } from 'react';
import { voucherApi } from '../../api/apis';
import type { VoucherAdminDto, CreateVoucherDto } from '../../types/apiTypes';
import { useNotification } from '../../components/NotificationProvider';

export default function VoucherManagement() {
  const { toast, confirm } = useNotification();
  const [vouchers, setVouchers] = useState<VoucherAdminDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<VoucherAdminDto | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CreateVoucherDto>({
    code: '',
    title: '',
    description: '',
    discountType: 'percent',
    discountValue: 10,
    maxDiscount: 30000,
    minOrderAmount: 0,
    maxUsageTotal: null,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
    storeId: null,
  });

  // Load vouchers
  const loadVouchers = async () => {
    try {
      setLoading(true);
      const data = await voucherApi.getAll();
      setVouchers(data);
    } catch (err: any) {
      toast(err.response?.data?.message || 'Không thể tải danh sách voucher.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVouchers();
  }, []);

  // Filter vouchers
  const filteredVouchers = useMemo(() => {
    const now = new Date();
    return vouchers.filter((v) => {
      // Search match
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        v.code.toLowerCase().includes(query) ||
        v.title.toLowerCase().includes(query) ||
        (v.description && v.description.toLowerCase().includes(query));

      if (!matchSearch) return false;

      // Status match
      const endDate = new Date(v.endDate);
      const isExpired = endDate < now;

      if (statusFilter === 'active') return v.isActive && !isExpired;
      if (statusFilter === 'inactive') return !v.isActive && !isExpired;
      if (statusFilter === 'expired') return isExpired;

      return true;
    });
  }, [vouchers, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const now = new Date();
    const total = vouchers.length;
    const active = vouchers.filter((v) => v.isActive && new Date(v.endDate) >= now).length;
    const totalUsed = vouchers.reduce((sum, v) => sum + v.usedCount, 0);
    const expired = vouchers.filter((v) => new Date(v.endDate) < now).length;
    return { total, active, totalUsed, expired };
  }, [vouchers]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingVoucher(null);
    setFormData({
      code: '',
      title: '',
      description: '',
      discountType: 'percent',
      discountValue: 15,
      maxDiscount: 30000,
      minOrderAmount: 50000,
      maxUsageTotal: 100,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      storeId: null,
    });
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (v: VoucherAdminDto) => {
    setEditingVoucher(v);
    setFormData({
      code: v.code,
      title: v.title,
      description: v.description || '',
      discountType: v.discountType,
      discountValue: v.discountValue,
      maxDiscount: v.maxDiscount || null,
      minOrderAmount: v.minOrderAmount,
      maxUsageTotal: v.maxUsageTotal,
      startDate: v.startDate.split('T')[0],
      endDate: v.endDate.split('T')[0],
      isActive: v.isActive,
      storeId: v.storeId || null,
    });
    setIsModalOpen(true);
  };

  // Submit Create or Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      toast('Vui lòng nhập mã voucher.', 'warning');
      return;
    }
    if (!formData.title.trim()) {
      toast('Vui lòng nhập tên chương trình voucher.', 'warning');
      return;
    }
    if (formData.discountValue <= 0) {
      toast('Giá trị giảm giá phải lớn hơn 0.', 'warning');
      return;
    }

    try {
      setIsSaving(true);
      if (editingVoucher) {
        await voucherApi.update(editingVoucher.voucherId, formData);
        toast(`Cập nhật mã ${formData.code.toUpperCase()} thành công!`, 'success');
      } else {
        await voucherApi.create(formData);
        toast(`Tạo mã ${formData.code.toUpperCase()} thành công!`, 'success');
      }
      setIsModalOpen(false);
      loadVouchers();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Có lỗi xảy ra khi lưu mã giảm giá.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active status
  const handleToggle = async (v: VoucherAdminDto) => {
    try {
      const res = await voucherApi.toggle(v.voucherId);
      setVouchers((prev) =>
        prev.map((item) =>
          item.voucherId === v.voucherId ? { ...item, isActive: res.isActive } : item
        )
      );
      toast(
        res.isActive ? `Đã kích hoạt mã ${v.code}` : `Đã tạm dừng mã ${v.code}`,
        res.isActive ? 'success' : 'info'
      );
    } catch (err: any) {
      toast(err.response?.data?.message || 'Không thể đổi trạng thái voucher.', 'error');
    }
  };

  // Delete voucher
  const handleDelete = (v: VoucherAdminDto) => {
    confirm({
      tone: 'warning',
      title: `Xóa mã ${v.code}?`,
      message: `Bạn có chắc muốn xóa vĩnh viễn mã giảm giá "${v.title}"? Khách hàng sẽ không thể sử dụng mã này nữa.`,
      confirmText: 'Xóa voucher',
      onConfirm: async () => {
        try {
          await voucherApi.delete(v.voucherId);
          setVouchers((prev) => prev.filter((item) => item.voucherId !== v.voucherId));
          toast(`Đã xóa thành công mã ${v.code}!`, 'success');
        } catch (err: any) {
          toast(err.response?.data?.message || 'Xóa voucher thất bại.', 'error');
        }
      },
    });
  };

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast(`Đã sao chép mã: ${code}`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline-md font-black tracking-tight text-on-surface dark:text-[#F8F4EE] flex items-center gap-2.5">
            <span className="material-symbols-outlined text-3xl text-primary dark:text-[#E8B98A]">
              local_offer
            </span>
            <span>Quản Lý Mã Giảm Giá</span>
          </h1>
          <p className="font-body-sm text-on-surface-variant dark:text-[#A4968C] mt-1">
            Thiết lập các chương trình khuyến mãi, ưu đãi phần trăm hoặc giảm tiền trực tiếp cho khách hàng.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-container text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          <span>Tạo Mã Mới</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface dark:bg-[#1E1714] border border-outline-variant/30 dark:border-white/10 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant dark:text-[#A4968C] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tổng mã ưu đãi</span>
            <span className="material-symbols-outlined text-primary text-xl">loyalty</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-on-surface dark:text-[#F8F4EE] font-headline">
            {stats.total}
          </p>
        </div>

        <div className="bg-surface dark:bg-[#1E1714] border border-outline-variant/30 dark:border-white/10 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant dark:text-[#A4968C] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Đang hoạt động</span>
            <span className="material-symbols-outlined text-emerald-500 text-xl">check_circle</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-headline">
            {stats.active}
          </p>
        </div>

        <div className="bg-surface dark:bg-[#1E1714] border border-outline-variant/30 dark:border-white/10 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant dark:text-[#A4968C] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Lượt đã áp dụng</span>
            <span className="material-symbols-outlined text-amber-500 text-xl">shopping_cart_checkout</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-headline">
            {stats.totalUsed}
          </p>
        </div>

        <div className="bg-surface dark:bg-[#1E1714] border border-outline-variant/30 dark:border-white/10 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant dark:text-[#A4968C] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Đã hết hạn</span>
            <span className="material-symbols-outlined text-stone-400 text-xl">history_toggle_off</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-stone-500 dark:text-stone-400 font-headline">
            {stats.expired}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface dark:bg-[#1E1714] border border-outline-variant/30 dark:border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Tìm theo mã voucher hoặc tên chương trình..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low dark:bg-[#241C18] border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs sm:text-sm text-on-surface dark:text-[#F8F4EE] placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'active', label: 'Đang chạy' },
            { id: 'inactive', label: 'Tạm dừng' },
            { id: 'expired', label: 'Hết hạn' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container dark:bg-white/5 text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-container-high dark:hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-surface dark:bg-[#1E1714] border border-outline-variant/30 dark:border-white/10 rounded-3xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 text-center text-on-surface-variant dark:text-[#A4968C]">
            <span className="material-symbols-outlined text-4xl animate-spin mb-2">sync</span>
            <p className="text-sm font-bold">Đang tải danh sách voucher...</p>
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="py-20 text-center px-4">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-3">
              confirmation_number
            </span>
            <h4 className="text-base font-bold text-on-surface dark:text-[#F8F4EE]">
              Chưa có mã giảm giá nào
            </h4>
            <p className="text-xs text-on-surface-variant dark:text-[#A4968C] mt-1 max-w-sm mx-auto">
              Tạo mã giảm giá để thu hút khách hàng mới và tăng doanh số cho quán cafe của bạn.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-md"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Tạo mã đầu tiên</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/20 dark:border-white/10 bg-surface-container-lowest dark:bg-[#140F0D] text-[11px] font-black uppercase tracking-wider text-on-surface-variant dark:text-[#A4968C]">
                  <th className="px-6 py-3.5">Mã Voucher</th>
                  <th className="px-6 py-3.5">Chương Trình</th>
                  <th className="px-6 py-3.5">Mức Giảm</th>
                  <th className="px-6 py-3.5">Đơn Tối Thiểu</th>
                  <th className="px-6 py-3.5">Lượt Dùng</th>
                  <th className="px-6 py-3.5">Thời Hạn</th>
                  <th className="px-6 py-3.5 text-center">Trạng Thái</th>
                  <th className="px-6 py-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15 dark:divide-white/5 text-xs">
                {filteredVouchers.map((v) => {
                  const now = new Date();
                  const isExpired = new Date(v.endDate) < now;
                  const isUpcoming = new Date(v.startDate) > now;

                  return (
                    <tr
                      key={v.voucherId}
                      className="hover:bg-surface-container-low/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Code Pill */}
                      <td className="px-6 py-4 font-mono font-bold whitespace-nowrap">
                        <button
                          onClick={() => handleCopyCode(v.code)}
                          title="Bấm để sao chép mã"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-[#E8B98A] border border-primary/20 hover:border-primary transition group"
                        >
                          <span className="text-xs font-black tracking-wider">{v.code}</span>
                          <span className="material-symbols-outlined text-xs opacity-60 group-hover:opacity-100">
                            content_copy
                          </span>
                        </button>
                      </td>

                      {/* Title & Description */}
                      <td className="px-6 py-4 max-w-xs">
                        <p className="font-bold text-on-surface dark:text-[#F8F4EE] line-clamp-1">
                          {v.title}
                        </p>
                        {v.description && (
                          <p className="text-[11px] text-on-surface-variant dark:text-[#A4968C] line-clamp-1 mt-0.5">
                            {v.description}
                          </p>
                        )}
                        <span className="inline-block mt-1 text-[10px] text-on-surface-variant/80 bg-surface-container dark:bg-white/5 px-2 py-0.5 rounded-md">
                          {v.storeName || 'Tất cả chi nhánh'}
                        </span>
                      </td>

                      {/* Discount Value */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {v.discountType === 'percent' ? (
                          <div>
                            <span className="font-black text-primary dark:text-[#E8B98A] text-sm">
                              Giảm {v.discountValue}%
                            </span>
                            {v.maxDiscount && (
                              <p className="text-[10px] text-on-surface-variant dark:text-[#A4968C]">
                                Tối đa {v.maxDiscount.toLocaleString('vi-VN')}đ
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="font-black text-primary dark:text-[#E8B98A] text-sm">
                            Giảm {v.discountValue.toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </td>

                      {/* Min Order */}
                      <td className="px-6 py-4 whitespace-nowrap text-on-surface dark:text-[#F8F4EE] font-semibold">
                        {v.minOrderAmount > 0
                          ? `${v.minOrderAmount.toLocaleString('vi-VN')}đ`
                          : 'Không giới hạn'}
                      </td>

                      {/* Usage Progress */}
                      <td className="px-6 py-4 whitespace-nowrap min-w-[120px]">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className="text-on-surface dark:text-[#F8F4EE]">{v.usedCount}</span>
                          <span className="text-on-surface-variant dark:text-[#A4968C]">
                            {v.maxUsageTotal ? `/ ${v.maxUsageTotal}` : '(Vô hạn)'}
                          </span>
                        </div>
                        {v.maxUsageTotal && (
                          <div className="w-full h-1.5 bg-surface-container-high dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (v.usedCount / v.maxUsageTotal) * 100)}%`,
                              }}
                            />
                          </div>
                        )}
                      </td>

                      {/* Date Range */}
                      <td className="px-6 py-4 whitespace-nowrap text-[11px] text-on-surface-variant dark:text-[#A4968C]">
                        <p>
                          Từ: {new Date(v.startDate).toLocaleDateString('vi-VN')}
                        </p>
                        <p>
                          Đến: {new Date(v.endDate).toLocaleDateString('vi-VN')}
                        </p>
                      </td>

                      {/* Status Toggle Switch */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {isExpired ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                            Hết hạn
                          </span>
                        ) : isUpcoming ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
                            Sắp diễn ra
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggle(v)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              v.isActive ? 'bg-emerald-600' : 'bg-stone-300 dark:bg-stone-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                v.isActive ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(v)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-[#E8B98A] hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white border border-primary/25 transition-all text-xs font-bold shadow-xs active:scale-95"
                            title="Sửa voucher"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(v)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white border border-red-200 dark:border-red-900/40 transition-all text-xs font-bold shadow-xs active:scale-95"
                            title="Xóa voucher"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            <span>Xóa</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT VOUCHER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-surface dark:bg-[#1E1714] border border-outline-variant/30 dark:border-white/10 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary dark:text-[#E8B98A] text-2xl">
                  {editingVoucher ? 'edit_note' : 'add_circle'}
                </span>
                <h3 className="font-title-md font-black text-on-surface dark:text-[#F8F4EE]">
                  {editingVoucher ? 'Chỉnh Sửa Mã Giảm Giá' : 'Tạo Mã Giảm Giá Mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-container dark:hover:bg-white/10 rounded-xl transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              {/* Code & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface dark:text-[#F8F4EE] mb-1">
                    Mã Voucher *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: BANMOI20"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '') })
                    }
                    className="w-full px-3.5 py-2.5 bg-surface-container-low dark:bg-[#241C18] border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs sm:text-sm font-mono font-bold uppercase text-on-surface dark:text-[#F8F4EE] focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface dark:text-[#F8F4EE] mb-1">
                    Tên chương trình *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Giảm 20% Chào Bạn Mới"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container-low dark:bg-[#241C18] border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs sm:text-sm text-on-surface dark:text-[#F8F4EE] focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-on-surface dark:text-[#F8F4EE] mb-1">
                  Mô tả ưu đãi
                </label>
                <textarea
                  rows={2}
                  placeholder="VD: Áp dụng cho tất cả đồ uống cà phê và trà trái cây..."
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-surface-container-low dark:bg-[#241C18] border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs sm:text-sm text-on-surface dark:text-[#F8F4EE] focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Discount Type Selector */}
              <div>
                <label className="block text-xs font-bold text-on-surface dark:text-[#F8F4EE] mb-1.5">
                  Hình thức giảm giá *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discountType: 'percent' })}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold border transition ${
                      formData.discountType === 'percent'
                        ? 'border-primary bg-primary/10 text-primary dark:text-[#E8B98A]'
                        : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">percent</span>
                    <span>Theo phần trăm (%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discountType: 'fixed', maxDiscount: null })}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold border transition ${
                      formData.discountType === 'fixed'
                        ? 'border-primary bg-primary/10 text-primary dark:text-[#E8B98A]'
                        : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">payments</span>
                    <span>Số tiền cố định (VNĐ)</span>
                  </button>
                </div>
              </div>

              {/* Discount Value & Max Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface dark:text-[#F8F4EE] mb-1">
                    {formData.discountType === 'percent' ? 'Mức giảm (%) *' : 'Số tiền giảm (VNĐ) *'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={formData.discountType === 'percent' ? 100 : 10000000}
                    value={formData.discountValue}
                    onChange={(e) =>
                      setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2.5 bg-surface-container-low dark:bg-[#241C18] border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs sm:text-sm font-bold text-on-surface dark:text-[#F8F4EE] focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {formData.discountType === 'percent' ? (
                  <div>
                    <label className="block text-xs font-bold text-on-surface dark:text-[#F8F4EE] mb-1">
                      Giảm tối đa (VNĐ)
                    </label>
                    <input
                      type="number"
                      placeholder="Không giới hạn"
                      value={formData.maxDiscount || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxDiscount: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-surface-container-low dark:bg-[#241C18] border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs sm:text-sm text-on-surface dark:text-[#F8F4EE] focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-on-surface dark:text-[#F8F4EE] mb-1">
                      Giới hạn lượt dùng tổng
                    </label>
                    <input
                      type="number"
                      placeholder="Để trống nếu vô hạn"
                      value={formData.maxUsageTotal || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxUsageTotal: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-surface-container-low dark:bg-[#241C18] border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs sm:text-sm text-on-surface dark:text-[#F8F4EE] focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}
              </div>

              {/* Min Order & Max Usage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface dark:text-[#F8F4EE] mb-1">
                    Đơn hàng tối thiểu (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={formData.minOrderAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, minOrderAmount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2.5 bg-surface-container-low dark:bg-[#241C18] border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs sm:text-sm text-on-surface dark:text-[#F8F4EE] focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {formData.discountType === 'percent' && (
                  <div>
                    <label className="block text-xs font-bold text-on-surface dark:text-[#F8F4EE] mb-1">
                      Giới hạn lượt dùng tổng
                    </label>
                    <input
                      type="number"
                      placeholder="Để trống nếu vô hạn"
                      value={formData.maxUsageTotal || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxUsageTotal: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-surface-container-low dark:bg-[#241C18] border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs sm:text-sm text-on-surface dark:text-[#F8F4EE] focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface dark:text-[#F8F4EE] mb-1">
                    Ngày bắt đầu *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container-low dark:bg-[#241C18] border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs sm:text-sm text-on-surface dark:text-[#F8F4EE] focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface dark:text-[#F8F4EE] mb-1">
                    Ngày kết thúc *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container-low dark:bg-[#241C18] border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs sm:text-sm text-on-surface dark:text-[#F8F4EE] focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Is Active Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary rounded border-outline-variant/50 focus:ring-primary"
                />
                <label
                  htmlFor="isActiveToggle"
                  className="text-xs font-bold text-on-surface dark:text-[#F8F4EE] cursor-pointer"
                >
                  Kích hoạt mã ngay sau khi lưu
                </label>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs font-bold text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-container dark:hover:bg-white/5 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>{editingVoucher ? 'Lưu Thay Đổi' : 'Tạo Voucher'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

