import { useState, useEffect } from 'react';
import { systemAdminApi } from '../../api/apis';
import type { SubscriptionUpgradeRequestDto } from '../../types/apiTypes';
import Pagination from '../../components/Pagination';

export default function UpgradeRequestsManagement() {
  const [requests, setRequests] = useState<SubscriptionUpgradeRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals
  const [selectedApproveRequest, setSelectedApproveRequest] = useState<SubscriptionUpgradeRequestDto | null>(null);
  const [selectedRejectRequest, setSelectedRejectRequest] = useState<SubscriptionUpgradeRequestDto | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await systemAdminApi.getSubscriptionRequests();
      setRequests(data);
    } catch {
      showToast('error', 'Không thể tải danh sách yêu cầu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const handleApprove = async () => {
    if (!selectedApproveRequest) return;
    try {
      setSubmitting(true);
      await systemAdminApi.approveSubscriptionRequest(selectedApproveRequest.requestId, adminNote);
      showToast('success', `Đã duyệt và kích hoạt gói ${selectedApproveRequest.requestedPlanCode.toUpperCase()} cho quán ${selectedApproveRequest.tenantName}!`);
      setSelectedApproveRequest(null);
      setAdminNote('');
      void loadRequests();
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Không thể duyệt yêu cầu lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRejectRequest) return;
    try {
      setSubmitting(true);
      await systemAdminApi.rejectSubscriptionRequest(selectedRejectRequest.requestId, rejectReason || 'Quản trị viên từ chối.');
      showToast('success', 'Đã từ chối yêu cầu đổi gói.');
      setSelectedRejectRequest(null);
      setRejectReason('');
      void loadRequests();
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Không thể từ chối yêu cầu lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRequests = requests.filter(item => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term ||
      item.tenantName.toLowerCase().includes(term) ||
      item.ownerName.toLowerCase().includes(term) ||
      item.ownerPhone.toLowerCase().includes(term) ||
      item.ownerEmail.toLowerCase().includes(term) ||
      item.requestedPlanCode.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const getPlanBadgeClass = (code: string) => {
    switch (code?.toLowerCase()) {
      case 'pro':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'premium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'basic':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'free':
      default:
        return 'bg-stone-100 text-stone-800 border-stone-200';
    }
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
          <div className="flex items-center gap-3">
            <h1 className="font-headline-lg text-headline-lg text-primary">
              Yêu Cầu Nâng Cấp Gói
            </h1>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                {pendingCount} chờ duyệt
              </span>
            )}
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Quản trị các yêu cầu nâng cấp, hạ cấp và thanh toán thủ công qua Zalo/Chuyển khoản từ chủ quán đối tác.
          </p>
        </div>

        <button
          onClick={loadRequests}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high hover:bg-secondary-container/40 text-on-surface-variant hover:text-primary text-xs font-bold border border-outline-variant/30 transition self-start sm:self-auto active:scale-95"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          <span>Làm mới</span>
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
            placeholder="Tìm theo tên quán, chủ quán, SĐT, gói..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant/20 rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'Tất cả', count: requests.length },
            { id: 'pending', label: 'Chờ duyệt', count: requests.filter(r => r.status === 'pending').length },
            { id: 'approved', label: 'Đã duyệt', count: requests.filter(r => r.status === 'approved').length },
            { id: 'rejected', label: 'Đã từ chối', count: requests.filter(r => r.status === 'rejected').length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id as any); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/20 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-low/50 text-on-surface-variant font-bold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-5">Quán Cafe</th>
                <th className="py-4 px-4">Chủ Quán & Liên Hệ</th>
                <th className="py-4 px-4">Gói Yêu Cầu</th>
                <th className="py-4 px-4">Thời Gian</th>
                <th className="py-4 px-4">Ghi Chú</th>
                <th className="py-4 px-4">Trạng Thái</th>
                <th className="py-4 px-5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-2" />
                    <p>Đang tải danh sách yêu cầu...</p>
                  </td>
                </tr>
              ) : paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">inbox</span>
                    <p>Không có yêu cầu nâng cấp nào phù hợp.</p>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map(req => {
                  return (
                    <tr key={req.requestId} className="hover:bg-surface-container-low/40 transition">
                      {/* Quán Cafe */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-sm text-on-surface">{req.tenantName}</div>
                        <div className="text-[11px] text-on-surface-variant">ID: #{req.tenantId}</div>
                      </td>

                      {/* Chủ quán & Liên hệ */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-on-surface">{req.ownerName}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <a
                            href={`https://zalo.me/${req.ownerPhone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] border border-blue-200 transition"
                            title="Bấm để nhắn tin Zalo"
                          >
                            <span className="material-symbols-outlined text-xs">chat</span>
                            <span>{req.ownerPhone}</span>
                          </a>
                        </div>
                        <div className="text-[10px] text-on-surface-variant mt-0.5">{req.ownerEmail}</div>
                      </td>

                      {/* Gói Yêu Cầu */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${getPlanBadgeClass(req.currentPlanCode)}`}>
                            {req.currentPlanCode}
                          </span>
                          <span className="material-symbols-outlined text-xs text-on-surface-variant">arrow_forward</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${getPlanBadgeClass(req.requestedPlanCode)}`}>
                            {req.requestedPlanCode}
                          </span>
                        </div>
                        <div className="font-black text-primary text-xs mt-1">
                          {new Intl.NumberFormat('vi-VN').format(req.monthlyPrice)}đ/tháng
                        </div>
                      </td>

                      {/* Thời Gian */}
                      <td className="py-4 px-4 text-on-surface-variant text-[11px]">
                        <div>{new Date(req.createdAt).toLocaleDateString('vi-VN')}</div>
                        <div className="text-[10px] opacity-75">{new Date(req.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>

                      {/* Ghi chú */}
                      <td className="py-4 px-4 max-w-[200px]">
                        {req.note ? (
                          <div className="text-[11px] text-on-surface-variant line-clamp-2" title={req.note}>
                            "{req.note}"
                          </div>
                        ) : (
                          <span className="text-[11px] text-stone-400 italic">Không có</span>
                        )}
                        {req.adminNote && (
                          <div className="mt-1 text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Admin: {req.adminNote}
                          </div>
                        )}
                      </td>

                      {/* Trạng Thái */}
                      <td className="py-4 px-4">
                        {req.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                            <span>Chờ duyệt</span>
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="material-symbols-outlined text-xs">check</span>
                            <span>Đã duyệt</span>
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-300">
                            <span className="material-symbols-outlined text-xs">close</span>
                            <span>Từ chối</span>
                          </span>
                        )}
                      </td>

                      {/* Thao Tác */}
                      <td className="py-4 px-5 text-right">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedApproveRequest(req);
                                setAdminNote('');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-xs transition active:scale-95 shadow-xs flex items-center gap-1"
                              title="Duyệt và kích hoạt gói ngay cho quán"
                            >
                              <span className="material-symbols-outlined text-sm">done_all</span>
                              <span>Duyệt</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRejectRequest(req);
                                setRejectReason('');
                              }}
                              className="px-2.5 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 font-bold text-xs transition active:scale-95 flex items-center gap-1"
                              title="Từ chối yêu cầu đổi gói"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                              <span>Từ chối</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-on-surface-variant opacity-60">
                            {req.processedAt ? `${new Date(req.processedAt).toLocaleDateString('vi-VN')}` : 'Đã xong'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-outline-variant/10 flex justify-between items-center">
            <span className="text-xs text-on-surface-variant">
              Hiển thị {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredRequests.length)} trong {filteredRequests.length} yêu cầu
            </span>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Modal Duyệt Yêu Cầu */}
      {selectedApproveRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">workspace_premium</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-on-surface">Xác Nhận Kích Hoạt Gói</h3>
                <p className="text-xs text-on-surface-variant">Xác nhận quán đã thanh toán để nâng cấp gói.</p>
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-2xl bg-surface-container-low text-xs mb-4">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Quán cafe:</span>
                <strong className="text-on-surface">{selectedApproveRequest.tenantName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Chủ quán:</span>
                <span className="text-on-surface">{selectedApproveRequest.ownerName} ({selectedApproveRequest.ownerPhone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Gói kích hoạt:</span>
                <strong className="text-primary uppercase font-black">{selectedApproveRequest.requestedPlanCode}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Giá niêm yết:</span>
                <span className="font-bold text-on-surface">{new Intl.NumberFormat('vi-VN').format(selectedApproveRequest.monthlyPrice)} đ/tháng</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-on-surface mb-1">Ghi chú duyệt (Tùy chọn):</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="VD: Đã nhận chuyển khoản VietQR ngày 01/11, ưu đãi giảm 10%..."
                className="w-full p-3 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none h-20"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedApproveRequest(null)}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-60 flex items-center gap-1.5"
              >
                {submitting ? 'Đang kích hoạt...' : 'Kích Hoạt Gói Ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Từ Chối Yêu Cầu */}
      {selectedRejectRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">cancel</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-on-surface">Từ Chối Yêu Cầu Đổi Gói</h3>
                <p className="text-xs text-on-surface-variant">Quán sẽ giữ nguyên gói cước hiện tại.</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-on-surface mb-1">Lý do từ chối:</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="VD: Không liên hệ được qua Zalo/SĐT, chủ quán muốn hủy yêu cầu..."
                className="w-full p-3 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none h-24"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedRejectRequest(null)}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-60"
              >
                {submitting ? 'Đang xử lý...' : 'Xác Nhận Từ Chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

