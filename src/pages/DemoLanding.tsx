import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Coffee, ExternalLink, Loader2, ShieldCheck, Store } from 'lucide-react';
import { demoApi } from '../api/apis';

type DemoInfo = Awaited<ReturnType<typeof demoApi.getInfo>>;

export default function DemoLanding() {
  const navigate = useNavigate();
  const [info, setInfo] = useState<DemoInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    demoApi.getInfo()
      .then((data) => active && setInfo(data))
      .catch((err: any) => {
        if (active) setError(err.response?.data?.message || 'Không thể mở khu demo lúc này.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-[#F6F1E7] px-4 py-8 text-[#4f3828] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#69452f] text-white shadow-sm">
                <Coffee size={22} />
              </span>
              <span className="text-xl font-bold tracking-tight">AI-SMARTSERVE</span>
            </div>
            <p className="mt-2 text-sm text-[#806d60]">Khu trải nghiệm sản phẩm công khai</p>
          </div>
          <button onClick={() => navigate('/login')} className="rounded-xl border border-[#d9c9bb] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#fffaf6]">
            Đăng nhập hệ thống
          </button>
        </header>

        <section className="rounded-3xl bg-[#69452f] p-6 text-white shadow-xl sm:p-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#f7d9a6]">Demo an toàn</p>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">Thử trọn luồng gọi món tại một quán mẫu</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#f4e7dc]">Bạn có thể xem thực đơn, thêm món vào giỏ và theo dõi đơn như khách thật. Dữ liệu demo được tách khỏi toàn bộ quán đang sử dụng hệ thống.</p>
        </section>

        {loading && (
          <div className="mt-8 flex items-center justify-center rounded-2xl bg-white p-10 text-[#806d60]"><Loader2 className="mr-2 animate-spin" size={20} /> Đang chuẩn bị khu demo...</div>
        )}

        {error && !loading && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
        )}

        {info && !loading && (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <article className="rounded-2xl border border-[#eadfd6] bg-white p-6 shadow-sm">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff3df] text-[#a36a25]"><Coffee size={22} /></div>
              <h2 className="text-xl font-bold">Trải nghiệm với vai trò khách</h2>
              <p className="mt-2 min-h-14 text-sm leading-6 text-[#806d60]">Mở quán mẫu, xem các món demo, đặt món bằng phiên khách tạm thời và theo dõi trạng thái đơn.</p>
              <button onClick={() => navigate(`/qr/${info.qrToken}`)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#69452f] px-4 py-3 font-semibold text-white hover:bg-[#553724]">
                Mở thực đơn demo <ArrowRight size={18} />
              </button>
            </article>

            <article className="rounded-2xl border border-[#eadfd6] bg-white p-6 shadow-sm">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f3eee9] text-[#69452f]"><Store size={22} /></div>
              <h2 className="text-xl font-bold">Khu Chủ quán & Nhân viên</h2>
              <p className="mt-2 min-h-14 text-sm leading-6 text-[#806d60]">Xem thử bảng điều khiển vận hành, thực đơn và khu tiếp nhận đơn của quán {info.storeName}.</p>
              <div className="mt-6 flex items-center gap-2 rounded-xl bg-[#faf7f4] p-3 text-sm text-[#6e5a4b]"><ShieldCheck size={18} className="text-emerald-600" /> Dữ liệu demo được cô lập</div>
              <button onClick={() => navigate('/demo/owner/dashboard')} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#d9c9bb] px-4 py-3 font-semibold text-[#69452f] hover:bg-[#fffaf6]">
                Mở khu quản lý demo <ExternalLink size={17} />
              </button>
            </article>
          </div>
        )}
      </div>
    </main>
  );
}
