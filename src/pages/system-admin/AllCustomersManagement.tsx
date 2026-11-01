import { useState, useEffect } from 'react';
import { systemAdminApi } from '../../api/apis';
import type { CustomerListItemDto, TenantDetailDto } from '../../types/apiTypes';
import Pagination from '../../components/Pagination';

export default function AllCustomersManagement() {
  const [customers, setCustomers] = useState<CustomerListItemDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [tenants, setTenants] = useState<TenantDetailDto[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Load tenants for dropdown filter
  useEffect(() => {
    systemAdminApi.getTenants().then(setTenants).catch(() => setTenants([]));
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await systemAdminApi.getCustomers({
        search: debouncedSearch || undefined,
        tenantId: selectedTenantId !== 'all' ? selectedTenantId : undefined,
        page: currentPage,
        pageSize
      });
      if (res) {
        setCustomers(res.items);
        setTotalCount(res.totalCount);
      }
    } catch {
      setCustomers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, [currentPage, debouncedSearch, selectedTenantId]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline-lg text-headline-lg text-primary">
              Khách Hàng Toàn Sàn
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
              {totalCount} khách đăng ký
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Tổng hợp dữ liệu thành viên, điểm tích lũy và tương tác của khách hàng trên toàn bộ các quán cafe đối tác.
          </p>
        </div>

        <button
          onClick={loadCustomers}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high hover:bg-secondary-container/40 text-on-surface-variant hover:text-primary text-xs font-bold border border-outline-variant/30 transition self-start sm:self-auto active:scale-95"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          <span>Làm mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-surface-container-lowest border border-primary/5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Tìm theo SĐT, tên khách, tên quán..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant/20 rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Tenant Filter Dropdown */}
          <div className="w-full sm:w-64">
            <select
              value={selectedTenantId}
              onChange={(e) => {
                setSelectedTenantId(e.target.value === 'all' ? 'all' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/20 rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold"
            >
              <option value="all">Tất cả các quán ({tenants.length})</option>
              {tenants.map(t => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.name} ({t.customerCount ?? 0} khách)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs font-bold text-on-surface-variant">
          Tổng cộng: <strong className="text-primary">{totalCount}</strong> người dùng
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/20 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-low/50 text-on-surface-variant font-bold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-5">Quán Cafe</th>
                <th className="py-4 px-4">Khách Hàng</th>
                <th className="py-4 px-4">Số Điện Thoại</th>
                <th className="py-4 px-4">Điểm Tích Lũy</th>
                <th className="py-4 px-4">Lượt Ghé Quán</th>
                <th className="py-4 px-4">Tổng Chi Tiêu</th>
                <th className="py-4 px-5 text-right">Ngày Đăng Ký</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-2" />
                    <p>Đang tải danh sách khách hàng...</p>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">person_off</span>
                    <p>Không tìm thấy khách hàng nào phù hợp.</p>
                  </td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr key={c.customerId} className="hover:bg-surface-container-low/40 transition">
                    {/* Quán Cafe */}
                    <td className="py-4 px-5">
                      <div className="font-bold text-on-surface">{c.tenantName || 'N/A'}</div>
                      <div className="text-[10px] text-on-surface-variant">Mã quán: #{c.tenantId}</div>
                    </td>

                    {/* Khách hàng */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                          {c.name ? c.name.charAt(0).toUpperCase() : c.phone.slice(-2)}
                        </div>
                        <div>
                          <div className="font-bold text-on-surface">{c.name || 'Khách vãng lai'}</div>
                          <div className="text-[10px] text-on-surface-variant">ID: #{c.customerId}</div>
                        </div>
                      </div>
                    </td>

                    {/* SĐT */}
                    <td className="py-4 px-4 font-mono font-bold text-on-surface">
                      <a
                        href={`https://zalo.me/${c.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                        title="Bấm để nhắn Zalo"
                      >
                        {c.phone}
                      </a>
                    </td>

                    {/* Điểm tích lũy */}
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
                        <span className="material-symbols-outlined text-xs text-amber-700">stars</span>
                        <span>{new Intl.NumberFormat('vi-VN').format(c.totalPoints)} điểm</span>
                      </span>
                    </td>

                    {/* Lượt ghé */}
                    <td className="py-4 px-4 text-on-surface">
                      <span className="font-bold">{c.visitCount}</span> lần
                      {c.lastVisitAt && (
                        <div className="text-[10px] text-on-surface-variant">
                          Gần nhất: {new Date(c.lastVisitAt).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </td>

                    {/* Tổng chi tiêu */}
                    <td className="py-4 px-4 font-bold text-primary">
                      {new Intl.NumberFormat('vi-VN').format(c.totalSpent)}đ
                    </td>

                    {/* Ngày Đăng Ký */}
                    <td className="py-4 px-5 text-right text-on-surface-variant text-[11px]">
                      {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-outline-variant/10 flex justify-between items-center">
            <span className="text-xs text-on-surface-variant">
              Hiển thị {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} trong {totalCount} khách hàng
            </span>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

