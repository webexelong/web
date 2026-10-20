import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useStore } from '../../store/useStore';
import { paymentApi } from '../../api/apis';
import type { StorePaymentConfigDto, TestPaymentConfigResultDto } from '../../types/apiTypes';
import { ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Key, Landmark, ExternalLink, Eye, EyeOff, Save } from 'lucide-react';

export default function PaymentSettings() {
  const { user } = useAuthStore();
  const { currentStoreId } = useStore();
  const effectiveStoreId = user?.storeId || currentStoreId;

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);

  const [config, setConfig] = useState<StorePaymentConfigDto | null>(null);
  const [clientId, setClientId] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [checksumKey, setChecksumKey] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [bankName, setBankName] = useState<string>('MB');
  const [bankAccountName, setBankAccountName] = useState<string>('');

  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [showChecksumKey, setShowChecksumKey] = useState<boolean>(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<TestPaymentConfigResultDto | null>(null);

  // Fetch store payment config
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await paymentApi.getStorePaymentConfig(effectiveStoreId);
      if (res) {
        setConfig(res);
        setClientId(res.payOSClientId || '');
        setApiKey(res.maskedApiKey || '');
        setChecksumKey(res.maskedChecksumKey || '');
        setBankAccount(res.bankAccount || '');
        setBankName(res.bankName || 'MB');
        setBankAccountName(res.bankAccountName || '');
      }
    } catch (err: any) {
      console.error('Lỗi khi tải cấu hình thanh toán:', err);
      setMessage({ type: 'error', text: 'Không thể tải thông tin cấu hình thanh toán của quán.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [effectiveStoreId]);

  // Test PayOS connection
  const handleTestConnection = async () => {
    if (!clientId.trim() || !apiKey.trim() || !checksumKey.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập đầy đủ Client ID, API Key và Checksum Key trước khi kiểm tra.' });
      return;
    }

    if (apiKey.startsWith('***') || checksumKey.startsWith('***')) {
      setMessage({ type: 'error', text: 'Vui lòng nhập lại API Key và Checksum Key gốc (không dùng chuỗi đã ẩn) để chạy test.' });
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      setMessage(null);
      const res = await paymentApi.testStorePaymentConfig({
        clientId: clientId.trim(),
        apiKey: apiKey.trim(),
        checksumKey: checksumKey.trim()
      });
      setTestResult(res);
      if (res.isValid) {
        setMessage({ type: 'success', text: res.message });
      } else {
        setMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      console.error('Lỗi kiểm tra kết nối PayOS:', err);
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Không thể kết nối đến máy chủ PayOS.' });
    } finally {
      setTesting(false);
    }
  };

  // Save payment config
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await paymentApi.updateStorePaymentConfig(effectiveStoreId, {
        payOSClientId: clientId.trim() || undefined,
        payOSApiKey: apiKey.trim() || undefined,
        payOSChecksumKey: checksumKey.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
        bankName: bankName.trim() || undefined,
        bankAccountName: bankAccountName.trim() || undefined
      });

      if (res) {
        setConfig(res);
        setApiKey(res.maskedApiKey || '');
        setChecksumKey(res.maskedChecksumKey || '');
        setMessage({ type: 'success', text: 'Đã lưu cấu hình cổng thanh toán quán thành công! Tiền khách chuyển khoản sẽ đổ thẳng về tài khoản của bạn.' });
      }
    } catch (err: any) {
      console.error('Lỗi lưu cấu hình:', err);
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Có lỗi xảy ra khi lưu cấu hình.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-on-surface-variant font-medium">Đang tải cấu hình cổng thanh toán...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 pb-12 font-body-md text-on-surface">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl">payments</span>
            Cấu Hình Cổng Thanh Toán PayOS (Quán {config?.storeName || `Chi nhánh #${effectiveStoreId}`})
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Thiết lập tài khoản PayOS & Ngân hàng để tiền khách quét QR chuyển khoản trực tiếp vào tài khoản của quán.
          </p>
        </div>

        <a
          href="https://payos.vn"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-xl text-xs font-bold shadow-sm hover:bg-secondary/90 transition-all self-start md:self-auto"
        >
          <span>Mở Cổng PayOS.vn</span>
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Status Banner */}
      <div className={`p-4 rounded-2xl border flex items-start gap-3.5 shadow-sm transition-all ${
        config?.hasCustomPayOS 
          ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
          : 'bg-amber-50 border-amber-300 text-amber-900'
      }`}>
        {config?.hasCustomPayOS ? (
          <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
        )}
        <div className="text-xs space-y-1">
          <div className="font-bold text-sm">
            {config?.hasCustomPayOS 
              ? '✅ Quán đang sử dụng Cổng thanh toán PayOS riêng' 
              : '⚠️ Quán đang sử dụng Cổng thanh toán mặc định của WebCafe'}
          </div>
          <p className="opacity-90">
            {config?.hasCustomPayOS
              ? 'Mọi giao dịch khách hàng quét mã QR tại bàn của quán sẽ được chuyển trực tiếp vào tài khoản ngân hàng được cấu hình bên dưới.'
              : 'Hiện tại quán chưa điền bộ 3 khóa PayOS riêng. Hãy đăng ký tài khoản miễn phí tại PayOS.vn và điền thông tin bên dưới để tiền về thẳng tài khoản của quán bạn!'}
          </p>
        </div>
      </div>

      {/* Notifications Message */}
      {message && (
        <div className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-2 animate-in fade-in ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid: Form Left / Guide Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Container (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-6">
            
            {/* Section 1: PayOS Credentials */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary font-bold text-base border-b border-outline-variant/20 pb-2">
                <Key className="w-5 h-5 text-primary" />
                <span>1. Bộ 3 Khóa Kết Nối PayOS (Bắt buộc)</span>
              </div>

              {/* Client ID */}
              <div>
                <label className="text-xs font-bold text-on-surface block mb-1.5">
                  Client ID <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: 62dbf2d9-15ec-4581-8178-..."
                  className="w-full px-4 py-2.5 bg-surface border border-outline-variant/40 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                />
              </div>

              {/* API Key */}
              <div>
                <label className="text-xs font-bold text-on-surface block mb-1.5">
                  API Key <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="VD: 57b8fbce-2c8c-4a30-802c-..."
                    className="w-full px-4 py-2.5 pr-10 bg-surface border border-outline-variant/40 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Checksum Key */}
              <div>
                <label className="text-xs font-bold text-on-surface block mb-1.5">
                  Checksum Key <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showChecksumKey ? 'text' : 'password'}
                    placeholder="VD: c33b9347d4e56598379c67677bf1884..."
                    className="w-full px-4 py-2.5 pr-10 bg-surface border border-outline-variant/40 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={checksumKey}
                    onChange={(e) => setChecksumKey(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowChecksumKey(!showChecksumKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                  >
                    {showChecksumKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Bank Details */}
            <div className="space-y-4 pt-4 border-t border-outline-variant/20">
              <div className="flex items-center gap-2 text-primary font-bold text-base border-b border-outline-variant/20 pb-2">
                <Landmark className="w-5 h-5 text-primary" />
                <span>2. Thông Tin Ngân Hàng Hiển Thị Trên QR (Tùy chọn)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bank Name */}
                <div>
                  <label className="text-xs font-bold text-on-surface block mb-1.5">Ngân hàng</label>
                  <select
                    className="w-full px-4 py-2.5 bg-surface border border-outline-variant/40 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  >
                    <option value="MB">MB Bank (Quân Đội)</option>
                    <option value="VCB">Vietcombank</option>
                    <option value="TCB">Techcombank</option>
                    <option value="VPB">VPBank</option>
                    <option value="ACB">ACB</option>
                    <option value="BIDV">BIDV</option>
                    <option value="CTG">VietinBank</option>
                    <option value="TPB">TPBank</option>
                  </select>
                </div>

                {/* Account Number */}
                <div>
                  <label className="text-xs font-bold text-on-surface block mb-1.5">Số tài khoản nhận tiền</label>
                  <input
                    type="text"
                    placeholder="VD: 09012345678"
                    className="w-full px-4 py-2.5 bg-surface border border-outline-variant/40 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                  />
                </div>
              </div>

              {/* Account Holder Name */}
              <div>
                <label className="text-xs font-bold text-on-surface block mb-1.5">Tên chủ tài khoản (In hoa không dấu)</label>
                <input
                  type="text"
                  placeholder="VD: NGUYEN VAN A"
                  className="w-full px-4 py-2.5 bg-surface border border-outline-variant/40 rounded-xl text-sm uppercase font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                />
              </div>
            </div>

            {/* Test Result Box */}
            {testResult && (
              <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                testResult.isValid ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'
              }`}>
                <div className="font-bold text-sm flex items-center gap-1.5">
                  {testResult.isValid ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-red-600" />}
                  <span>{testResult.isValid ? 'Kết nối thành công!' : 'Kết nối thất bại'}</span>
                </div>
                <p>{testResult.message}</p>
                {testResult.accountName && (
                  <p className="font-medium text-emerald-800">
                    Chủ tài khoản PayOS xác nhận: <strong>{testResult.accountName}</strong> ({testResult.accountNumber})
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="py-3 px-5 bg-surface-container-high text-on-surface font-bold text-xs rounded-xl hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={15} className={testing ? 'animate-spin' : ''} />
                <span>{testing ? 'Đang kiểm tra kết nối...' : 'Kiểm Tra Kết Nối PayOS'}</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 px-6 bg-primary text-white font-bold text-xs rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={15} />
                <span>{saving ? 'Đang lưu cấu hình...' : 'Lưu Cấu Hình Cổng Thanh Toán'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Guide & FAQs */}
        <div className="space-y-6">
          {/* Guide Card */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4">
            <h3 className="font-headline-md text-label-md font-bold text-primary flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="material-symbols-outlined text-lg">help</span>
              3 Bước Lấy Key PayOS Miễn Phí
            </h3>

            <ol className="text-xs text-on-surface-variant space-y-3 list-decimal list-inside leading-relaxed">
              <li>
                <strong className="text-on-surface">Đăng ký tài khoản:</strong> Truy cập{' '}
                <a href="https://payos.vn" target="_blank" rel="noopener noreferrer" className="text-primary underline font-bold">
                  payos.vn
                </a>{' '}
                và đăng nhập bằng Email hoặc Google.
              </li>
              <li>
                <strong className="text-on-surface">Tạo Kênh thanh toán:</strong> Vào mục <em>Kênh thanh toán</em> → Tạo mới kênh (ví dụ đặt tên: <em>WebCafe Quán Của Tôi</em>) và liên kết tài khoản ngân hàng nhận tiền.
              </li>
              <li>
                <strong className="text-on-surface">Copy 3 mã khóa:</strong> Copy <em>Client ID</em>, <em>API Key</em>, và <em>Checksum Key</em> dán vào form bên trái, sau đó bấm <strong>"Lưu Cấu Hình"</strong>.
              </li>
            </ol>

            <div className="bg-surface p-3.5 rounded-xl border border-outline-variant/30 text-[11px] text-on-surface-variant space-y-1">
              <p className="font-bold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">bolt</span>
                Lợi ích của PayOS:
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Tiền vào thẳng ngân hàng 100% không qua trung gian.</li>
                <li>Khách quét mã xong quán nhận báo thành công ngay 3s.</li>
                <li>Hoàn toàn miễn phí duy trì.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
