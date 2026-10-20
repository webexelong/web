import { useState, useEffect } from 'react';
import { systemAdminApi } from '../../api/apis';
import type { TenantDetailDto, CreateTenantDto } from '../../types/apiTypes';
import Pagination from '../../components/Pagination';
import { useNotification } from '../../components/NotificationProvider';

export default function TenantManagement() {
  const { confirm } = useNotification();
  const [tenants, setTenants] = useState<TenantDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 7;

  // Floating Action Menu state (calculated fixed coords to prevent table overflow clipping)
  const [activeMenuTenant, setActiveMenuTenant] = useState<TenantDetailDto | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; right: number } | null>(null);

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailTenant, setDetailTenant] = useState<TenantDetailDto | null>(null);
  const [planTenant, setPlanTenant] = useState<TenantDetailDto | null>(null);
  const [confirmLockTenant, setConfirmLockTenant] = useState<TenantDetailDto | null>(null);

  // Submitting States
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form for New Tenant
  const [createForm, setCreateForm] = useState<CreateTenantDto>({
    name: '',
    slug: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    ownerPassword: '',
    plan: 'basic',
    maxStores: 1,
    initialStoreName: '',
    initialStoreAddress: '',
    initialStorePhone: ''
  });

  // Form for Plan Change
  const [editPlan, setEditPlan] = useState<string>('basic');
  const [editMaxStores, setEditMaxStores] = useState<number>(1);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await systemAdminApi.getTenants();
      setTenants(data || []);
    } catch (err) {
      console.error('Lỗi tải danh sách đối tác:', err);
      showToast('error', 'Không thể tải danh sách quán cafe đối tác.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  // Reset pagination when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open floating menu with precise window coordinates so table overflow can never clip it
  const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement>, tenant: TenantDetailDto) => {
    e.stopPropagation();
    if (activeMenuTenant?.tenantId === tenant.tenantId) {
      setActiveMenuTenant(null);
      setMenuCoords(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < menuHeight;

    setMenuCoords({
      top: openUpwards ? rect.top - menuHeight - 6 : rect.bottom + 6,
      right: Math.max(16, window.innerWidth - rect.right)
    });
    setActiveMenuTenant(tenant);
  };

  // Close dropdown on outside click or scroll
  useEffect(() => {
    const handleOutside = () => {
      setActiveMenuTenant(null);
      setMenuCoords(null);
    };
    window.addEventListener('click', handleOutside);
    window.addEventListener('scroll', handleOutside, true);
    return () => {
      window.removeEventListener('click', handleOutside);
      window.removeEventListener('scroll', handleOutside, true);
    };
  }, []);

  // Handler: Execute Toggle Status after confirmation
  const handleConfirmToggleStatus = async () => {
    if (!confirmLockTenant) return;
    setSubmitting(true);
    try {
      await systemAdminApi.toggleTenantStatus(confirmLockTenant.tenantId);
      showToast('success', `Đã ${confirmLockTenant.isActive ? 'tạm khóa' : 'mở khóa'} quán '${confirmLockTenant.name}' thành công!`);
      setConfirmLockTenant(null);
      await loadTenants();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi đổi trạng thái.';
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTrialTenant = (tenant: TenantDetailDto) => {
    confirm({
      tone: 'error',
      title: 'Xóa vĩnh viễn quán dùng thử?',
      message: `Toàn bộ dữ liệu của quán “${tenant.name}” sẽ bị xóa và không thể khôi phục. Chỉ dùng cho quán test đang dùng thử 14 ngày.`,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        setSubmitting(true);
        try {
          await systemAdminApi.deleteTrialTenant(tenant.tenantId);
          setActiveMenuTenant(null);
          setMenuCoords(null);
          showToast('success', `Đã xóa quán test “${tenant.name}”.`);
          await loadTenants();
        } catch (err: any) {
          showToast('error', err.response?.data?.message || 'Không thể xóa quán dùng thử.');
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  // Handler: Execute Plan Change
  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planTenant) return;
    setSubmitting(true);
    try {
      await systemAdminApi.updateTenantPlan(planTenant.tenantId, {
        plan: editPlan,
        maxStores: Number(editMaxStores) || 1
      });
      showToast('success', `Đã cập nhật gói dịch vụ cho quán '${planTenant.name}' thành công!`);
      setPlanTenant(null);
      await loadTenants();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Lỗi khi cập nhật gói dịch vụ.';
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handler: Create Tenant
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await systemAdminApi.createTenant({
        ...createForm,
        initialStoreName: createForm.initialStoreName || `${createForm.name} - Chi Nhánh 1`,
        initialStorePhone: createForm.initialStorePhone || createForm.ownerPhone
      });
      showToast('success', `Tạo quán cafe đối tác '${createForm.name}' và cấp tài khoản chủ quán thành công!`);
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        slug: '',
        ownerName: '',
        ownerEmail: '',
        ownerPhone: '',
        ownerPassword: '',
        plan: 'basic',
        maxStores: 1,
        initialStoreName: '',
        initialStoreAddress: '',
        initialStorePhone: ''
      });
      await loadTenants();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lỗi tạo quán mới. Vui lòng kiểm tra lại thông tin.';
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtering
  const filteredTenants = tenants.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ownerPhone.includes(searchTerm);

    const matchStatus = statusFilter === 'all' 
      ? true 
      : statusFilter === 'active' ? t.isActive : !t.isActive;

    return matchSearch && matchStatus;
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredTenants.length / pageSize);
  const paginatedTenants = filteredTenants.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold backdrop-blur-md animate-in slide-in-from-top-3 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40' 
            : 'bg-rose-950/90 text-rose-200 border-rose-500/40'
        }`}>
          <span className="material-symbols-outlined text-lg">
            {toastMessage.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary">
            Quán Cafe Đối Tác
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Quản lý danh sách thương hiệu FnB, cấu hình gói cước và kiểm soát quyền truy cập hệ thống.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-sm shadow-sm transition active:scale-95 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          <span>Thêm Quán Mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-surface-container-lowest border border-primary/5 shadow-xs">
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Tìm theo tên quán, chủ quán, SĐT, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant/20 rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Tất cả ({tenants.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Đang hoạt động ({tenants.filter(t => t.isActive).length})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              statusFilter === 'inactive'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Tạm khóa ({tenants.filter(t => !t.isActive).length})
          </button>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="rounded-[2.5rem] bg-surface-container-lowest border border-primary/5 overflow-hidden shadow-[0_4px_20px_rgba(85,55,34,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low border-b border-outline-variant/15 text-on-surface-variant uppercase tracking-wider font-bold">
              <tr>
                <th className="py-4 px-4">Thương Hiệu / Quán</th>
                <th className="py-4 px-4">Chủ Sở Hữu</th>
                <th className="py-4 px-4">Gói SaaS</th>
                <th className="py-4 px-4">Quy Mô</th>
                <th className="py-4 px-4">Ngày Tham Gia</th>
                <th className="py-4 px-4">Trạng Thái</th>
                <th className="py-4 px-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {paginatedTenants.map(tenant => (
                <tr key={tenant.tenantId} className="hover:bg-surface-container/50 transition">
                  {/* Brand info */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl overflow-hidden bg-surface-container border border-outline-variant/20 shrink-0">
                        <img 
                          src={tenant.logoUrl || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=120&q=80'} 
                          alt={tenant.name}
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div>
                        <div className="font-bold text-on-surface text-sm">{tenant.name}</div>
                        <div className="text-[11px] text-on-surface-variant font-mono">slug: {tenant.slug}</div>
                      </div>
                    </div>
                  </td>

                  {/* Owner info - CLICKABLE LINKS */}
                  <td className="py-4 px-4">
                    <div className="font-bold text-on-surface">{tenant.ownerName}</div>
                    {/* Clickable Email */}
                    <div className="text-[11px] mt-0.5">
                      <a 
                        href={`mailto:${tenant.ownerEmail}`} 
                        className="text-primary hover:underline flex items-center gap-1 transition"
                        title="Bấm để gửi email hỗ trợ"
                      >
                        <span className="material-symbols-outlined text-xs">mail</span>
                        <span>{tenant.ownerEmail}</span>
                      </a>
                    </div>
                    {/* Clickable Phone */}
                    <div className="text-[11px] mt-0.5">
                      <a 
                        href={`tel:${tenant.ownerPhone}`} 
                        className="text-on-surface-variant hover:text-primary hover:underline flex items-center gap-1 font-mono transition"
                        title="Bấm để gọi điện hỗ trợ"
                      >
                        <span className="material-symbols-outlined text-xs">call</span>
                        <span>{tenant.ownerPhone}</span>
                      </a>
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="py-4 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      tenant.plan === 'premium' || tenant.plan === 'enterprise'
                        ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                        : tenant.plan === 'pro'
                        ? 'bg-secondary-container text-on-secondary-container border border-primary/20'
                        : 'bg-surface-container text-on-surface-variant border border-outline-variant/30'
                    }`}>
                      {tenant.plan || 'basic'}
                    </span>
                  </td>

                  {/* Size: Stores & Tables */}
                  <td className="py-4 px-4">
                    <div className="font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-sm">store</span>
                      <span>{tenant.storeCount} điểm bán</span>
                    </div>
                    <div className="text-[11px] text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                      <span className="material-symbols-outlined text-xs">table_restaurant</span>
                      <span>{tenant.tableCount} bàn QR</span>
                    </div>
                  </td>

                  {/* Created At */}
                  <td className="py-4 px-4 text-on-surface-variant">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">calendar_today</span>
                      <span>{new Date(tenant.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      tenant.isActive 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tenant.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      {tenant.isActive ? 'Hoạt động' : 'Tạm khóa'}
                    </span>
                  </td>

                  {/* Actions: Quick Action Icons + 3-dots Menu */}
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* Quick Action: View Details */}
                      <button
                        type="button"
                        onClick={() => setDetailTenant(tenant)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-secondary-container/30 transition active:scale-95"
                        title="Xem chi tiết quán & cấu hình QR"
                      >
                        <span className="material-symbols-outlined text-lg">visibility</span>
                      </button>

                      {/* Quick Action: Change Plan */}
                      <button
                        type="button"
                        onClick={() => {
                          setPlanTenant(tenant);
                          setEditPlan(tenant.plan || 'basic');
                          setEditMaxStores(tenant.maxStores || 1);
                        }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-secondary-container/30 transition active:scale-95"
                        title="Đổi gói dịch vụ SaaS"
                      >
                        <span className="material-symbols-outlined text-lg">tune</span>
                      </button>

                      {/* Quick Action: Lock / Unlock with safe Confirmation */}
                      <button
                        type="button"
                        onClick={() => setConfirmLockTenant(tenant)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-95 ${
                          tenant.isActive
                            ? 'text-rose-400 hover:bg-rose-500/15'
                            : 'text-emerald-400 hover:bg-emerald-500/15'
                        }`}
                        title={tenant.isActive ? 'Tạm khóa quán này' : 'Mở khóa quán này'}
                      >
                        <span className="material-symbols-outlined text-lg">
                          {tenant.isActive ? 'lock' : 'lock_open'}
                        </span>
                      </button>

                      {/* 3-dots Menu Button */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenMenu(e, tenant)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-95 ${
                          activeMenuTenant?.tenantId === tenant.tenantId
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                        }`}
                        title="Tùy chọn thao tác khác"
                      >
                        <span className="material-symbols-outlined text-lg">more_vert</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedTenants.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant text-sm">
                    Không tìm thấy quán cafe nào khớp với tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-outline-variant/10">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredTenants.length}
            pageSize={pageSize}
            itemName="quán cafe"
          />
        </div>
      </div>

      {/* ================= MODAL 1: VIEW DETAILS & QR CONFIG ================= */}
      {detailTenant && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface rounded-3xl border border-outline-variant/30 max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 text-on-surface">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <div className="flex items-center gap-3">
                <img 
                  src={detailTenant.logoUrl || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=100&q=80'} 
                  alt={detailTenant.name}
                  className="w-12 h-12 rounded-2xl object-cover border border-outline-variant/20" 
                />
                <div>
                  <h3 className="text-lg font-black text-primary">{detailTenant.name}</h3>
                  <p className="text-xs text-on-surface-variant font-mono">ID: {detailTenant.tenantId} • slug: {detailTenant.slug}</p>
                </div>
              </div>
              <button 
                onClick={() => setDetailTenant(null)}
                className="p-2 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-variant transition"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Content info */}
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 space-y-2">
                <div className="font-bold text-primary uppercase tracking-wider text-[10px]">Chủ Quán & Liên Hệ</div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-on-surface-variant block text-[10px]">Họ và Tên</span>
                    <strong className="text-on-surface text-sm">{detailTenant.ownerName}</strong>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block text-[10px]">Số Điện Thoại</span>
                    <a href={`tel:${detailTenant.ownerPhone}`} className="text-primary hover:underline font-mono font-bold">
                      {detailTenant.ownerPhone}
                    </a>
                  </div>
                  <div className="col-span-2">
                    <span className="text-on-surface-variant block text-[10px]">Email Đăng Nhập</span>
                    <a href={`mailto:${detailTenant.ownerEmail}`} className="text-primary hover:underline font-bold">
                      {detailTenant.ownerEmail}
                    </a>
                  </div>
                </div>
              </div>

              {/* QR Code & Ordering URL configuration */}
              <div className="p-4 rounded-2xl bg-secondary-container/20 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">qr_code</span>
                    Định Dạng Link Mã QR Bàn
                  </span>
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                    Hoạt động
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Mã QR tại các bàn của quán này trỏ trực tiếp vào luồng gọi món tự phục vụ:
                </p>
                <div className="flex items-center gap-2 bg-surface-container-lowest p-2.5 rounded-xl border border-outline-variant/30 font-mono text-[11px] text-primary">
                  <span className="truncate flex-1">
                    {window.location.origin}/qr?tenant={detailTenant.slug}&store=1&table=T01
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/qr?tenant=${detailTenant.slug}&store=1&table=T01`);
                      showToast('success', 'Đã sao chép link QR gọi món mẫu!');
                    }}
                    className="p-1 text-on-surface-variant hover:text-primary transition"
                    title="Sao chép link QR mẫu"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                  </button>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center">
                  <span className="text-[10px] text-on-surface-variant block">Điểm Bán</span>
                  <strong className="text-base text-on-surface font-bold">{detailTenant.storeCount}</strong>
                </div>
                <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center">
                  <span className="text-[10px] text-on-surface-variant block">Bàn Gắn QR</span>
                  <strong className="text-base text-on-surface font-bold">{detailTenant.tableCount}</strong>
                </div>
                <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center">
                  <span className="text-[10px] text-on-surface-variant block">Tổng Đơn Hàng</span>
                  <strong className="text-base text-primary font-bold">{detailTenant.orderCount}</strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setDetailTenant(null)}
                className="px-5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: CHANGE SUBSCRIPTION PLAN ================= */}
      {planTenant && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface rounded-3xl border border-outline-variant/30 max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 text-on-surface">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <div>
                <h3 className="text-lg font-black text-primary">Nâng Cấp / Đổi Gói Dịch Vụ</h3>
                <p className="text-xs text-on-surface-variant">{planTenant.name}</p>
              </div>
              <button 
                onClick={() => setPlanTenant(null)}
                className="p-2 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-variant transition"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdatePlan} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-on-surface mb-2">Chọn Gói Dịch Vụ SaaS</label>
                <div className="space-y-2">
                  <label className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition ${
                    editPlan === 'basic' ? 'bg-secondary-container/40 border-primary' : 'bg-surface-container-low border-outline-variant/20'
                  }`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="planRadio" 
                        checked={editPlan === 'basic'} 
                        onChange={() => setEditPlan('basic')} 
                        className="text-primary"
                      />
                      <div>
                        <strong className="block text-on-surface">Starter (Cơ bản)</strong>
                        <span className="text-[11px] text-on-surface-variant">1 Quán - 10 Bàn QR</span>
                      </div>
                    </div>
                    <span className="font-bold text-primary">239k/th</span>
                  </label>

                  <label className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition ${
                    editPlan === 'pro' ? 'bg-secondary-container/40 border-primary' : 'bg-surface-container-low border-outline-variant/20'
                  }`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="planRadio" 
                        checked={editPlan === 'pro'} 
                        onChange={() => setEditPlan('pro')} 
                        className="text-primary"
                      />
                      <div>
                        <strong className="block text-on-surface">Pro (Phổ thông)</strong>
                        <span className="text-[11px] text-on-surface-variant">3 Chi nhánh - Không giới hạn bàn</span>
                      </div>
                    </div>
                    <span className="font-bold text-primary">1.299tr/th</span>
                  </label>

                  <label className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition ${
                    editPlan === 'premium' || editPlan === 'enterprise' ? 'bg-secondary-container/40 border-primary' : 'bg-surface-container-low border-outline-variant/20'
                  }`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="planRadio" 
                        checked={editPlan === 'premium' || editPlan === 'enterprise'} 
                        onChange={() => setEditPlan('premium')} 
                        className="text-primary"
                      />
                      <div>
                        <strong className="block text-on-surface">Enterprise (Chuỗi Lớn)</strong>
                        <span className="text-[11px] text-on-surface-variant">Không giới hạn điểm bán & BOM</span>
                      </div>
                    </div>
                    <span className="font-bold text-primary">1.999tr/th</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-on-surface mb-1">Số Chi Nhánh Tối Đa Được Phép Tạo</label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={editMaxStores}
                  onChange={(e) => setEditMaxStores(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setPlanTenant(null)}
                  className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container font-bold transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-bold transition shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {submitting ? 'Đang Lưu...' : 'Cập Nhật Gói'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: CONFIRMATION DIALOG (DESTRUCTIVE ACTION) ================= */}
      {confirmLockTenant && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface rounded-3xl border border-outline-variant/30 max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-4 text-on-surface">
            <div className="flex items-center gap-3 text-rose-400">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                confirmLockTenant.isActive ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                <span className="material-symbols-outlined text-2xl">
                  {confirmLockTenant.isActive ? 'warning' : 'lock_open'}
                </span>
              </div>
              <div>
                <h3 className="text-base font-black text-on-surface">
                  {confirmLockTenant.isActive ? 'Xác Nhận Tạm Khóa Quán?' : 'Xác Nhận Mở Khóa Quán?'}
                </h3>
                <p className="text-xs text-on-surface-variant">{confirmLockTenant.name}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface-variant leading-relaxed">
              {confirmLockTenant.isActive ? (
                <>
                  <strong className="text-rose-400 block mb-1">Cảnh báo hành động gián đoạn:</strong>
                  Khi tạm khóa, toàn bộ các bàn quét mã QR của quán <strong>"{confirmLockTenant.name}"</strong> sẽ ngừng nhận đơn gọi món của khách hàng, và tài khoản của chủ quán sẽ không thể đăng nhập cho đến khi được mở lại.
                </>
              ) : (
                <>
                  Hệ thống sẽ kích hoạt lại toàn bộ mã QR bàn và tài khoản của chủ quán <strong>"{confirmLockTenant.name}"</strong>. Quán có thể tiếp tục nhận đơn gọi món ngay lập tức.
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmLockTenant(null)}
                className="px-4 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container font-bold text-xs transition"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmToggleStatus}
                className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs transition shadow-sm active:scale-95 disabled:opacity-50 ${
                  confirmLockTenant.isActive 
                    ? 'bg-rose-600 hover:bg-rose-700' 
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {submitting ? 'Đang Thực Hiện...' : confirmLockTenant.isActive ? 'Đồng Ý Khóa Quán' : 'Đồng Ý Mở Khóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: CREATE NEW TENANT ================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface rounded-3xl border border-outline-variant/30 max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl space-y-5 text-on-surface">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <div>
                <h3 className="text-lg font-black text-primary">Thêm Quán Cafe Đối Tác Mới</h3>
                <p className="text-xs text-on-surface-variant">Tạo thương hiệu và tự động cấp tài khoản đăng nhập cho Chủ Quán</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-variant transition"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-on-surface mb-1">Tên Quán Cafe / Thương Hiệu *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Highland Coffee"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-on-surface mb-1">Gói Dịch Vụ SaaS *</label>
                  <select
                    value={createForm.plan}
                    onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="basic">Gói Basic (239.000đ/tháng)</option>
                    <option value="premium">Gói Premium (1.299.000đ/tháng)</option>
                    <option value="pro">Gói Pro (1.999.000đ/tháng)</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-outline-variant/15 pt-3">
                <div className="font-bold text-primary text-xs uppercase tracking-wider mb-2">Thông Tin Chủ Quán (Owner)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-on-surface mb-1">Họ và Tên Chủ Quán *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      value={createForm.ownerName}
                      onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-on-surface mb-1">Số Điện Thoại *</label>
                    <input
                      type="tel"
                      required
                      placeholder="0912345678"
                      value={createForm.ownerPhone}
                      onChange={(e) => setCreateForm({ ...createForm, ownerPhone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-on-surface mb-1">Email Đăng Nhập *</label>
                    <input
                      type="email"
                      required
                      placeholder="owner@brand.vn"
                      value={createForm.ownerEmail}
                      onChange={(e) => setCreateForm({ ...createForm, ownerEmail: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-on-surface mb-1">Mật Khẩu Khởi Tạo *</label>
                    <input
                      type="password"
                      required
                      placeholder="Tối thiểu 6 ký tự"
                      value={createForm.ownerPassword}
                      onChange={(e) => setCreateForm({ ...createForm, ownerPassword: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-outline-variant/15 pt-3">
                <div className="font-bold text-primary text-xs uppercase tracking-wider mb-2">Chi Nhánh Đầu Tiên</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-on-surface mb-1">Tên Chi Nhánh</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Chi Nhánh Quận 1"
                      value={createForm.initialStoreName}
                      onChange={(e) => setCreateForm({ ...createForm, initialStoreName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-on-surface mb-1">Địa Chỉ</label>
                    <input
                      type="text"
                      placeholder="Số 10 Lê Lợi, Q.1, TP.HCM"
                      value={createForm.initialStoreAddress}
                      onChange={(e) => setCreateForm({ ...createForm, initialStoreAddress: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-outline-variant/15 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container font-bold transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold transition shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {submitting ? 'Đang Khởi Tạo...' : 'Tạo Quán Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= FLOATING ACTION MENU (FIXED POSITION - NEVER CLIPPED) ================= */}
      {activeMenuTenant && menuCoords && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => { setActiveMenuTenant(null); setMenuCoords(null); }} 
          />
          <div 
            style={{ top: `${menuCoords.top}px`, right: `${menuCoords.right}px` }}
            className="fixed w-52 rounded-2xl bg-surface-container-high border border-outline-variant/30 shadow-[0_12px_40px_rgba(0,0,0,0.6)] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header info */}
            <div className="px-3.5 py-1.5 border-b border-outline-variant/15 text-[10px] text-on-surface-variant font-bold truncate">
              {activeMenuTenant.name}
            </div>

            {/* 1. View Details */}
            <button
              type="button"
              onClick={() => {
                setDetailTenant(activeMenuTenant);
                setActiveMenuTenant(null);
                setMenuCoords(null);
              }}
              className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-on-surface hover:bg-secondary-container/40 hover:text-primary flex items-center gap-2.5 transition"
            >
              <span className="material-symbols-outlined text-base">visibility</span>
              <span>Xem Chi Tiết Quán</span>
            </button>

            {/* 2. Change Plan */}
            <button
              type="button"
              onClick={() => {
                setPlanTenant(activeMenuTenant);
                setEditPlan(activeMenuTenant.plan || 'basic');
                setEditMaxStores(activeMenuTenant.maxStores || 1);
                setActiveMenuTenant(null);
                setMenuCoords(null);
              }}
              className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-on-surface hover:bg-secondary-container/40 hover:text-primary flex items-center gap-2.5 transition"
            >
              <span className="material-symbols-outlined text-base">tune</span>
              <span>Đổi Gói Dịch Vụ</span>
            </button>

            <div className="h-px bg-outline-variant/20 my-1" />

            {/* 3. Lock / Unlock */}
            <button
              type="button"
              onClick={() => {
                setConfirmLockTenant(activeMenuTenant);
                setActiveMenuTenant(null);
                setMenuCoords(null);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold flex items-center gap-2.5 transition ${
                activeMenuTenant.isActive 
                  ? 'text-rose-400 hover:bg-rose-500/15' 
                  : 'text-emerald-400 hover:bg-emerald-500/15'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {activeMenuTenant.isActive ? 'lock' : 'lock_open'}
              </span>
              <span>{activeMenuTenant.isActive ? 'Tạm Khóa Quán' : 'Mở Khóa Quán'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleDeleteTrialTenant(activeMenuTenant)}
              className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2.5 transition"
            >
              <span className="material-symbols-outlined text-base">delete_forever</span>
              <span>Xóa quán dùng thử</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
