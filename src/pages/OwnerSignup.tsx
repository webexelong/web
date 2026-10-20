import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/apis';

interface PlanOption {
  code: 'basic' | 'premium' | 'pro';
  name: string;
  badge?: string;
  description: string;
  features: string[];
}

const PLAN_OPTIONS: PlanOption[] = [
  {
    code: 'basic',
    name: 'Gói Basic',
    description: 'Dành cho quán cà phê / quán nước quy mô nhỏ khởi đầu',
    features: ['1 chi nhánh', '5 nhân viên', '20 bàn', 'Menu & QR đặt món cơ bản']
  },
  {
    code: 'premium',
    name: 'Gói Premium',
    badge: 'Phổ biến nhất',
    description: 'Dành cho quán chuyên nghiệp cần quản trị kho & báo cáo chuyên sâu',
    features: ['5 chi nhánh', '20 nhân viên', '50 bàn', 'Quản lý kho nguyên liệu (BOM)', 'Phân tích doanh thu & AI']
  },
  {
    code: 'pro',
    name: 'Gói Pro',
    badge: 'VIP Chuỗi lớn',
    description: 'Dành cho chuỗi thương hiệu lớn cần quản lý tập trung toàn diện',
    features: ['10 chi nhánh', '50 nhân viên', '100 bàn', 'Quản trị chuỗi đa chi nhánh', 'Báo cáo tài chính tập trung', 'Full AI Sommelier']
  }
];

export default function OwnerSignup() {
  const [params] = useSearchParams();
  const requestedPlan = params.get('plan')?.toLowerCase();
  const initialPlan = requestedPlan === 'premium' || requestedPlan === 'pro' ? requestedPlan : 'basic';
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium' | 'pro'>(initialPlan);
  const [form, setForm] = useState({ email: '', password: '', storeName: '', phone: '' });
  const [done, setDone] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const clearFieldError = (fieldName: string) => {
    if (fieldErrors[fieldName.toLowerCase()]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[fieldName.toLowerCase()];
        return next;
      });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      const payload = {
        email: form.email.trim(),
        password: form.password,
        storeName: form.storeName.trim(),
        phone: form.phone.trim() || undefined,
        plan: selectedPlan
      };

      const result = await authApi.signupOwner(payload);
      setVerificationUrl(result?.verificationUrl ?? null);
      setEmailSent(Boolean(result?.emailSent));
      setDone(true);
    } catch (err: any) {
      const apiData = err?.response?.data;
      const extractedFieldErrors: Record<string, string> = {};
      let generalMessage = '';

      if (apiData?.errors && typeof apiData.errors === 'object') {
        Object.entries(apiData.errors).forEach(([field, msgs]) => {
          const key = field.toLowerCase();
          const firstMsg = Array.isArray(msgs) ? msgs[0] : String(msgs);
          extractedFieldErrors[key] = firstMsg;
        });
      }

      if (apiData?.message) {
        generalMessage = apiData.message;
      } else if (Object.keys(extractedFieldErrors).length > 0) {
        generalMessage = 'Vui lòng kiểm tra và sửa các thông tin chưa hợp lệ bên dưới.';
      } else if (err?.message) {
        generalMessage = err.message;
      } else {
        generalMessage = 'Không thể tạo quán. Vui lòng kiểm tra lại thông tin kết nối và thử lại.';
      }

      setFieldErrors(extractedFieldErrors);
      setError(generalMessage);
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await authApi.signupOwner({
        email: form.email.trim(),
        password: form.password,
        storeName: form.storeName.trim(),
        phone: form.phone.trim() || undefined,
        plan: selectedPlan
      });
      setVerificationUrl(result?.verificationUrl ?? null);
      setEmailSent(Boolean(result?.emailSent));
      if (!result?.emailSent) setError('Quán đã được lưu nhưng email vẫn chưa gửi được. Kiểm tra cấu hình SMTP của backend rồi thử gửi lại.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không thể gửi lại email xác minh. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return <main className="min-h-screen bg-[#F6F1E7] px-4 py-10 text-[#3f2d22]">
    <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#5A4030]">AI-SMARTSERVE</p>
      <h1 className="mt-3 text-3xl font-bold">Tạo quán dùng thử 14 ngày</h1>
      {done ? <div className="mt-6 space-y-4">
        <div className={`rounded-2xl p-4 ${emailSent ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-950'}`}>
          {emailSent ? <>Quán đã được tạo thành công với gói <strong>{selectedPlan.toUpperCase()}</strong> (dùng thử 14 ngày). Email xác minh đã gửi đến <strong>{form.email}</strong>. Hãy xác minh trước khi đăng nhập.</> : <>Quán đã được tạo và lưu với gói <strong>{selectedPlan.toUpperCase()}</strong> (dùng thử 14 ngày), nhưng hệ thống chưa gửi được email xác minh đến <strong>{form.email}</strong>. Quán chỉ đăng nhập được sau khi xác minh email.</>}
        </div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
        {verificationUrl && <a className="block break-all rounded-xl bg-amber-50 p-3 text-sm text-amber-900 underline" href={verificationUrl}>Mở liên kết xác minh local</a>}
        {!emailSent && <button type="button" disabled={loading} onClick={resendVerification} className="w-full rounded-xl border border-[#5A4030] px-4 py-3 font-bold text-[#5A4030] disabled:opacity-50">{loading ? 'Đang gửi lại...' : 'Gửi lại email xác minh'}</button>}
        <Link className="inline-block font-semibold text-[#5A4030] underline" to="/login">Đã xác minh? Đăng nhập</Link>
      </div> : <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-sm font-semibold">
          Tên quán <span className="text-red-500">*</span>
          <input
            required
            minLength={2}
            maxLength={100}
            value={form.storeName}
            onChange={e => {
              setForm({ ...form, storeName: e.target.value });
              clearFieldError('storeName');
            }}
            className={`mt-1 w-full rounded-xl border p-3 ${fieldErrors.storename ? 'border-red-500 bg-red-50/40' : 'border-gray-300 focus:border-[#5A4030]'}`}
            placeholder="Ví dụ: Cà Phê Muối Sài Gòn"
          />
          {fieldErrors.storename && <span className="mt-1 text-xs font-semibold text-red-600 block">{fieldErrors.storename}</span>}
        </label>

        <label className="block text-sm font-semibold">
          Email đăng nhập <span className="text-red-500">*</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={e => {
              setForm({ ...form, email: e.target.value });
              clearFieldError('email');
            }}
            className={`mt-1 w-full rounded-xl border p-3 ${fieldErrors.email ? 'border-red-500 bg-red-50/40' : 'border-gray-300 focus:border-[#5A4030]'}`}
            placeholder="Ví dụ: owner@quan.com"
          />
          {fieldErrors.email && <span className="mt-1 text-xs font-semibold text-red-600 block">{fieldErrors.email}</span>}
        </label>

        <label className="block text-sm font-semibold">
          Mật khẩu <span className="text-red-500">*</span> <span className="font-normal text-xs text-gray-500">(Tối thiểu 8 ký tự, gồm số và ký tự đặc biệt)</span>
          <input
            required
            minLength={8}
            pattern="^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$"
            title="Mật khẩu cần ít nhất 8 ký tự, gồm ít nhất một số và một ký tự đặc biệt."
            type="password"
            value={form.password}
            onChange={e => {
              setForm({ ...form, password: e.target.value });
              clearFieldError('password');
            }}
            className={`mt-1 w-full rounded-xl border p-3 ${fieldErrors.password ? 'border-red-500 bg-red-50/40' : 'border-gray-300 focus:border-[#5A4030]'}`}
            placeholder="••••••••"
          />
          {fieldErrors.password && <span className="mt-1 text-xs font-semibold text-red-600 block">{fieldErrors.password}</span>}
        </label>

        <label className="block text-sm font-semibold">
          Số điện thoại <span className="font-normal text-gray-500">(Không bắt buộc)</span>
          <input
            value={form.phone}
            onChange={e => {
              setForm({ ...form, phone: e.target.value });
              clearFieldError('phone');
            }}
            className={`mt-1 w-full rounded-xl border p-3 ${fieldErrors.phone ? 'border-red-500 bg-red-50/40' : 'border-gray-300 focus:border-[#5A4030]'}`}
            placeholder="Ví dụ: 0912345678 (Có thể bỏ trống)"
          />
          {fieldErrors.phone && <span className="mt-1 text-xs font-semibold text-red-600 block">{fieldErrors.phone}</span>}
        </label>

        {/* 3-tier Plan Selection Section */}
        <div className="pt-2">
          <label className="block text-sm font-semibold mb-2 text-[#3f2d22]">
            Chọn gói trải nghiệm dùng thử 14 ngày <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2.5">
            {PLAN_OPTIONS.map(p => {
              const isSelected = selectedPlan === p.code;
              return (
                <div
                  key={p.code}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPlan(p.code)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelectedPlan(p.code); }}
                  className={`cursor-pointer rounded-2xl border-2 p-3.5 transition-all text-left relative ${
                    isSelected
                      ? 'border-[#5A4030] bg-[#FAF6F0] shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-[#5A4030] bg-[#5A4030]' : 'border-gray-300 bg-white'
                      }`}>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="font-bold text-base text-[#3f2d22]">{p.name}</span>
                    </div>
                    {p.badge && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        p.code === 'premium' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-600 pl-7">{p.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                    {p.features.map((feat, idx) => (
                      <span key={idx} className="text-[11px] bg-white border border-gray-200 rounded-md px-2 py-0.5 text-gray-600">
                        ✓ {feat}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-700 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <span>⚠️</span> {error}
            </p>
            {Object.keys(fieldErrors).length > 0 && (
              <ul className="list-disc list-inside text-xs text-red-600 pl-1 pt-1 space-y-0.5">
                {Object.entries(fieldErrors).map(([key, msg]) => (
                  <li key={key}><strong>{key === 'storename' ? 'Tên quán' : key === 'email' ? 'Email' : key === 'password' ? 'Mật khẩu' : key === 'phone' ? 'Số điện thoại' : key}:</strong> {msg}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button disabled={loading} className="w-full rounded-xl bg-[#5A4030] px-4 py-3 font-bold text-white hover:bg-[#4a3427] transition disabled:opacity-50">
          {loading ? 'Đang tạo quán...' : 'Tạo quán miễn phí'}
        </button>

        <p className="text-center text-sm">Đã có tài khoản? <Link className="font-semibold underline text-[#5A4030]" to="/login">Đăng nhập</Link></p>
      </form>}
    </div>
  </main>;
}

