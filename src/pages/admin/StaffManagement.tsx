import { useEffect, useMemo, useState } from 'react';
import { meApi, staffApi } from '../../api/apis';
import { useAuthStore } from '../../store/authStore';
import { useStore } from '../../store/useStore';
import type { CreateStaffRequest, StaffDto, UpdateStaffRequest } from '../../types/apiTypes';
import { useNotification } from '../../components/NotificationProvider';

type FormState = {
  storeId: number;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

const emptyForm: FormState = { storeId: 0, username: '', fullName: '', email: '', phone: '', password: '' };

function getApiError(error: any): { message: string; fields: Record<string, string> } {
  const payload = error?.response?.data;
  const status = error?.response?.status;
  const fields: Record<string, string> = {};
  if (payload?.errors && typeof payload.errors === 'object') {
    Object.entries(payload.errors).forEach(([key, value]) => {
      const first = Array.isArray(value) ? value[0] : value;
      fields[key.toLowerCase()] = String(first);
    });
  }
  const statusMessage = status === 404
    ? 'Backend hiện tại chưa có chức năng quản lý nhân viên. Vui lòng cập nhật và khởi động lại backend mới nhất.'
    : status === 401
      ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      : status === 403
        ? 'Bạn không có quyền quản lý nhân viên hoặc gói hiện tại đã đạt giới hạn.'
        : status === 409
          ? 'Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.'
          : status === 429
            ? 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.'
            : status >= 500
              ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.'
              : null;
  return {
    message: statusMessage || payload?.message || error?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.',
    fields,
  };
}

export default function StaffManagement() {
  const { confirm } = useNotification();
  const user = useAuthStore(state => state.user);
  const currentStoreId = useStore(state => state.currentStoreId);
  const [stores, setStores] = useState<Array<{ storeId: number; name: string }>>([]);
  const [selectedStoreId, setSelectedStoreId] = useState(currentStoreId || user?.storeId || 0);
  const [staffMembers, setStaffMembers] = useState<StaffDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadStaff = async (storeId = selectedStoreId) => {
    if (!storeId) {
      setStaffMembers([]);
      setPageError('Chưa có cửa hàng để tải danh sách nhân viên.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setPageError('');
      setStaffMembers(await staffApi.list(storeId));
    } catch (error) {
      setPageError(getApiError(error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    meApi.getStores()
      .then(items => {
        const activeStores = (items ?? []).filter(store => store.isActive);
        setStores(activeStores);
        const initial = selectedStoreId || currentStoreId || user?.storeId || activeStores[0]?.storeId || 0;
        setSelectedStoreId(initial);
        if (initial) void loadStaff(initial);
        else setLoading(false);
      })
      .catch(error => {
        setPageError(getApiError(error).message);
        setLoading(false);
      });
    // Initial load intentionally uses the selected store at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedStoreId && stores.length > 0) void loadStaff(selectedStoreId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

  const visibleStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staffMembers.filter(staff => {
      const matchesSearch = !query || staff.fullName.toLowerCase().includes(query) || staff.username.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? staff.isActive : !staff.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [staffMembers, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, storeId: selectedStoreId });
    setFormError('');
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEdit = (staff: StaffDto) => {
    setEditing(staff);
    setForm({ storeId: staff.storeId, username: staff.username, fullName: staff.fullName, email: staff.email ?? '', phone: staff.phone ?? '', password: '' });
    setFormError('');
    setFieldErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setFieldErrors({});
    try {
      if (!form.storeId) throw new Error('Vui lòng chọn cửa hàng.');
      if (editing) {
        const payload: UpdateStaffRequest = { storeId: form.storeId, fullName: form.fullName.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined, password: form.password || undefined };
        await staffApi.update(editing.staffId, payload);
      } else {
        const payload: CreateStaffRequest = { storeId: form.storeId, username: form.username.trim(), fullName: form.fullName.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined, password: form.password };
        await staffApi.create(payload);
      }
      setFormOpen(false);
      setEditing(null);
      setSelectedStoreId(form.storeId);
      await loadStaff(form.storeId);
    } catch (error: any) {
      const parsed = getApiError(error);
      setFormError(parsed.message);
      setFieldErrors(parsed.fields);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (staff: StaffDto) => {
    const action = staff.isActive ? 'khóa' : 'mở khóa';
    confirm({ tone: 'warning', title: `${action.charAt(0).toUpperCase()}${action.slice(1)} tài khoản?`, message: `Bạn có chắc muốn ${action} tài khoản ${staff.username}?`, confirmText: action.charAt(0).toUpperCase() + action.slice(1), onConfirm: async () => {
    try {
      setPageError('');
      await staffApi.updateStatus(staff.staffId, !staff.isActive);
      await loadStaff(selectedStoreId);
    } catch (error) {
      setPageError(getApiError(error).message);
    }
    }});
  };

  const removeStaff = async (staff: StaffDto) => {
    confirm({ tone: 'warning', title: 'Vô hiệu hóa tài khoản?', message: `Tài khoản ${staff.username} sẽ bị vô hiệu hóa. Bạn có chắc không?`, confirmText: 'Vô hiệu hóa', onConfirm: async () => {
    try {
      setPageError('');
      await staffApi.remove(staff.staffId);
      await loadStaff(selectedStoreId);
    } catch (error) {
      setPageError(getApiError(error).message);
    }
    }});
  };

  const inputClass = (field: string) => `mt-1 w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#5A4030]/20 ${fieldErrors[field] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`;
  const errorFor = (field: string) => fieldErrors[field] && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors[field]}</p>;

  return (
    <div className="flex-1 overflow-y-auto bg-background px-4 pb-8 pt-24 md:px-8">
      <section className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-black text-primary">Nhân viên</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Tạo tài khoản nhân viên để nhận đơn và thanh toán tại quầy.</p>
        </div>
        <button type="button" onClick={openCreate} disabled={!selectedStoreId} className="rounded-xl bg-primary px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">+ Thêm nhân viên</button>
      </section>

      {pageError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{pageError}</div>}

      <section className="mb-5 grid gap-3 rounded-2xl border border-outline-variant/30 bg-white p-4 md:grid-cols-[1fr_220px_220px]">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc tên đăng nhập" className="rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20" />
        <select value={selectedStoreId} onChange={event => setSelectedStoreId(Number(event.target.value))} className="rounded-xl border border-gray-300 px-3 py-2.5">
          <option value={0}>Chọn cửa hàng</option>
          {stores.map(store => <option key={store.storeId} value={store.storeId}>{store.name}</option>)}
        </select>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-gray-300 px-3 py-2.5">
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Đã khóa</option>
        </select>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-outline-variant/30 bg-white p-4"><p className="text-xs text-on-surface-variant">Tổng nhân viên</p><p className="mt-1 text-2xl font-black text-primary">{staffMembers.length}</p></div>
        <div className="rounded-2xl border border-outline-variant/30 bg-white p-4"><p className="text-xs text-on-surface-variant">Đang hoạt động</p><p className="mt-1 text-2xl font-black text-emerald-700">{staffMembers.filter(staff => staff.isActive).length}</p></div>
        <div className="col-span-2 rounded-2xl border border-outline-variant/30 bg-white p-4 md:col-span-1"><p className="text-xs text-on-surface-variant">Vai trò</p><p className="mt-1 text-2xl font-black text-primary">Staff</p></div>
      </section>

      {loading ? <div className="rounded-2xl bg-white p-8 text-center text-on-surface-variant">Đang tải danh sách nhân viên...</div> : visibleStaff.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-on-surface-variant">{staffMembers.length === 0 ? 'Cửa hàng chưa có nhân viên. Hãy thêm tài khoản đầu tiên.' : 'Không tìm thấy nhân viên phù hợp.'}</div> : <section className="space-y-3">
        {visibleStaff.map(staff => <article key={staff.staffId} className={`flex flex-col justify-between gap-4 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center ${staff.isActive ? 'border-outline-variant/30' : 'border-red-200 bg-red-50/40'}`}>
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-black text-white">{staff.fullName.charAt(0).toUpperCase()}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-on-surface">{staff.fullName}</h3><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${staff.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{staff.isActive ? 'Đang hoạt động' : 'Đã khóa'}</span></div><p className="text-sm text-on-surface-variant">@{staff.username} · Staff</p><p className="text-xs text-on-surface-variant">{staff.email || 'Chưa có email'} {staff.phone ? `· ${staff.phone}` : ''}</p></div></div>
          <div className="flex flex-wrap gap-2 sm:justify-end"><button type="button" onClick={() => openEdit(staff)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold">Sửa</button><button type="button" onClick={() => void toggleStatus(staff)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold">{staff.isActive ? 'Khóa' : 'Mở khóa'}</button><button type="button" onClick={() => void removeStaff(staff)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Vô hiệu hóa</button></div>
        </article>)}
      </section>}

      {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-black text-primary">{editing ? 'Sửa nhân viên' : 'Thêm nhân viên'}</h3><p className="mt-1 text-sm text-on-surface-variant">Tài khoản mới luôn được gán vai trò Staff.</p></div><button type="button" onClick={closeForm} className="text-2xl text-gray-500" aria-label="Đóng">×</button></div>
        {formError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{formError}</div>}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">Cửa hàng<select required value={form.storeId} onChange={event => setForm({ ...form, storeId: Number(event.target.value) })} className={inputClass('storeid')}><option value={0}>Chọn cửa hàng</option>{stores.map(store => <option key={store.storeId} value={store.storeId}>{store.name}</option>)}</select>{errorFor('storeid')}</label>
          {!editing && <label className="block text-sm font-semibold">Tên đăng nhập<input required minLength={3} maxLength={50} value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} className={inputClass('username')} placeholder="staff_quan1" />{errorFor('username')}</label>}
          <label className="block text-sm font-semibold">Họ tên<input required minLength={2} maxLength={100} value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} className={inputClass('fullname')} placeholder="Nguyễn Văn A" />{errorFor('fullname')}</label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Email (không bắt buộc)<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className={inputClass('email')} placeholder="staff@quan.com" />{errorFor('email')}</label><label className="block text-sm font-semibold">Số điện thoại<input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className={inputClass('phone')} placeholder="0912345678" />{errorFor('phone')}</label></div>
          <label className="block text-sm font-semibold">Mật khẩu {editing && <span className="font-normal text-xs text-gray-500">(để trống nếu không đổi)</span>}<input required={!editing} minLength={8} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} type="password" className={inputClass('password')} placeholder="Ít nhất 8 ký tự, gồm số và ký tự đặc biệt" />{errorFor('password')}</label>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={closeForm} disabled={saving} className="rounded-xl border border-gray-300 px-4 py-2.5 font-semibold">Hủy</button><button type="submit" disabled={saving} className="rounded-xl bg-primary px-5 py-2.5 font-bold text-white disabled:opacity-50">{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo nhân viên'}</button></div>
        </form>
      </div></div>}
    </div>
  );
}
