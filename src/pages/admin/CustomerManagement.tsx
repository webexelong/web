import { useState, useEffect } from 'react';
import { meApi } from '../../api/apis';
import type { CustomerListItemDto } from '../../types/apiTypes';
import Pagination from '../../components/Pagination';

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<CustomerListItemDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Debounce search input
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
      const res = await meApi.getCustomers({
        search: debouncedSearch || undefined,
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
  }, [currentPage, debouncedSearch]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const totalPointsAll = customers.reduce((acc, c) => acc + c.totalPoints, 0);

  return (
    <div className="pt-24 px-4 sm:px-6 md:px-8 w-full max-w-[1600px] mx-auto pb-16 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-on-surface">Quản Lý Khách Hàng</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
              {totalCount} thành viên
            </span>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            Danh sách khách hàng thành viên đã đăng ký tại quán và thông tin điểm thưởng tích lũy.
          </p>
        </div>

        <button
          onClick={loadCustomers}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold border border-outline-variant/30 transition self-start sm:self-auto active:scale-95"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          <span>Làm mới</span>
        </button>
      </div>

      {/* Mini Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-white border border-outline-variant/20 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">group</span>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-medium">Tổng thành viên quán</p>
            <p className="text-xl font-black text-on-surface mt-0.5">{totalCount} khách</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-outline-variant/20 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">loyalty</span>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-medium">Điểm tích lũy trang này</p>
            <p className="text-xl font-black text-amber-800 mt-0.5">
              {new Intl.NumberFormat('vi-VN').format(totalPointsAll)} điểm
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-outline-variant/20 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">receipt_long</span>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-medium">Lượt khách ghé lại</p>
            <p className="text-xl font-black text-emerald-800 mt-0.5">
              {customers.reduce((acc, c) => acc + c.visitCount, 0)} lượt
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-outline-variant/20 shadow-xs mb-6">
        <div className="relative w-full sm:w-96">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Tìm theo số điện thoại, tên khách..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-3xl bg-white border border-outline-variant/20 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/50 text-on-surface-variant font-bold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-5">Khách Hàng</th>
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
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-2" />
                    <p>Đang tải danh sách khách hàng...</p>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">person_off</span>
                    <p>Chưa có khách hàng thành viên nào{debouncedSearch ? ' phù hợp với tìm kiếm' : ''}.</p>
                  </td>
                </tr>
              ) : (
                customers.map((c, idx) => (
                  <tr key={c.customerId} className="hover:bg-surface-container-low/30 transition">
                    {/* Tên khách */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                          {c.name ? c.name.charAt(0).toUpperCase() : c.phone.slice(-2)}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface text-sm">
                            {c.name || 'Khách hàng'}
                          </p>
                          <p className="text-[10px] text-on-surface-variant">Mã ID: #{c.customerId}</p>
                        </div>
                      </div>
                    </td>

                    {/* SĐT */}
                    <td className="py-4 px-4 font-mono font-bold text-on-surface">
                      {c.phone}
                    </td>

                    {/* Điểm tích lũy */}
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
                        <span className="material-symbols-outlined text-sm text-amber-700">stars</span>
                        <span>{new Intl.NumberFormat('vi-VN').format(c.totalPoints)} điểm</span>
                      </span>
                    </td>

                    {/* Lượt ghé */}
                    <td className="py-4 px-4 text-on-surface">
                      <span className="font-bold">{c.visitCount}</span> lần
                      {c.lastVisitAt && (
                        <p className="text-[10px] text-on-surface-variant mt-0.5">
                          Gần nhất: {new Date(c.lastVisitAt).toLocaleDateString('vi-VN')}
                        </p>
                      )}
                    </td>

                    {/* Tổng chi tiêu */}
                    <td className="py-4 px-4 font-bold text-primary">
                      {new Intl.NumberFormat('vi-VN').format(c.totalSpent)}đ
                    </td>

                    {/* Ngày đăng ký */}
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

