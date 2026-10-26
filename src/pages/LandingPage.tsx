import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown, ArrowRight, BarChart3, Bell, Check, CheckCircle2, ChevronDown,
  Coffee, CreditCard, Menu, PackageCheck, QrCode, ShieldCheck, ShoppingBag,
  Sparkles, Store, TrendingUp, Users, Wallet, X,
} from 'lucide-react';
import './LandingPage.css';

const features = [
  { icon: Coffee, title: 'Màn hình pha chế theo thời gian thực', text: 'Đơn xếp theo thứ tự, ghi rõ tuỳ chỉnh. Barista cập nhật trạng thái chỉ với một chạm.' },
  { icon: Sparkles, title: 'AI gợi ý combo', text: 'Gợi ý món đi kèm và nâng size đúng lúc để tăng giá trị đơn hàng.' },
  { icon: QrCode, title: 'Gọi món bằng QR', text: 'Khách xem thực đơn, tuỳ chỉnh món và đặt ngay trên điện thoại, không cần cài ứng dụng.' },
  { icon: Bell, title: 'Theo dõi đơn hàng', text: 'Khách biết đơn đang chờ, đang pha hay đã sẵn sàng mà không cần hỏi lại quầy.' },
  { icon: PackageCheck, title: 'Theo dõi nguyên liệu', text: 'Theo dõi tồn kho và nhận biết nguyên liệu cần chú ý theo hoạt động bán hàng.' },
  { icon: BarChart3, title: 'Bảng điều hành chủ quán', text: 'Xem doanh thu, món bán chạy, giờ cao điểm, bàn và ca nhân viên tại một nơi.' },
];

const faqs = [
  { q: 'Quán có cần mua thêm máy không?', a: 'Không. Khách dùng điện thoại của họ; nhân viên có thể dùng máy tính hoặc máy tính bảng sẵn có. Hãy kiểm tra khả năng tương thích máy in với thiết bị hiện tại của quán trước khi triển khai.' },
  { q: 'Mất mạng thì sao?', a: 'Các chức năng cần máy chủ như nhận đơn và đồng bộ trạng thái cần có kết nối Internet. Quán nên giữ quy trình nhận đơn dự phòng tại quầy khi mạng gián đoạn.' },
  { q: 'Nhân viên cần bao lâu để làm quen?', a: 'Giao diện được thiết kế theo các bước nhận đơn, pha chế và hoàn tất. Thời gian làm quen phụ thuộc quy trình và thiết bị của từng quán.' },
  { q: 'Dùng thử xong có bị tự động tính phí không?', a: 'Bạn đăng ký dùng thử 14 ngày. Xem thông tin gói và điều khoản trên trang đăng ký trước khi chọn gói trả phí.' },
];

const formatPrice = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

function ProductPreview() {
  return (
    <div className="landing-preview" aria-label="Minh hoạ bảng điều hành AI-SMARTSERVE">
      <div className="preview-top"><div className="preview-brand"><span><Coffee size={16} /></span> AI-SMARTSERVE</div><span className="preview-live"><i /> Đang mở ca</span><div className="preview-avatar">L</div></div>
      <div className="preview-body">
        <div className="preview-heading"><div><small>TỔNG QUAN HÔM NAY</small><h3>Chào buổi sáng, chủ quán</h3></div><span className="preview-date">Hôm nay <ChevronDown size={13} /></span></div>
        <div className="preview-metrics">
          <div><span><Wallet size={15} /></span><small>Doanh thu</small><strong>4.850.000đ</strong><em>↑ 12,8%</em></div>
          <div><span><ShoppingBag size={15} /></span><small>Đơn hàng</small><strong>128</strong><em>Trong hôm nay</em></div>
          <div><span><Users size={15} /></span><small>Bàn đang phục vụ</small><strong>6 <small>/ 12</small></strong><em>50% công suất</em></div>
        </div>
        <div className="preview-lower">
          <div className="preview-chart"><div className="preview-chart-head"><strong>Doanh thu trong tuần</strong><small>7 ngày gần nhất</small></div><div className="chart-bars" aria-hidden="true">{[35, 54, 46, 73, 58, 92, 76].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><div className="chart-labels"><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span></div></div>
          <div className="preview-orders"><div className="preview-chart-head"><strong>Đơn cần xử lý</strong><small className="orders-count">3 đơn</small></div><div className="preview-order"><span className="order-icon"><Coffee size={14} /></span><span><b>#DH1024</b><small>Cà phê sữa × 2</small></span><em>Đang pha</em></div><div className="preview-order"><span className="order-icon amber"><Coffee size={14} /></span><span><b>#DH1023</b><small>Trà đào cam sả × 1</small></span><em className="ready">Chờ nhận</em></div></div>
        </div>
      </div>
      <div className="preview-float"><span><Sparkles size={16} /></span><div><b>Gợi ý từ AI</b><small>Trà đào bán tốt vào 15:00</small></div><ArrowRight size={15} /></div>
    </div>
  );
}

export default function LandingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const title = 'AI-SMARTSERVE | Vận hành quán cà phê thông minh';
    const description = 'AI-SMARTSERVE giúp quán cà phê quản lý thực đơn, đơn hàng, pha chế và hoạt động kinh doanh. Trải nghiệm dùng thử 14 ngày.';
    const canonicalUrl = 'https://www.ai-smartserve.io.vn/landingpage';
    const descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const openGraphTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    const openGraphDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    const openGraphUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    const canonicalTag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    document.title = title;
    if (descriptionTag) descriptionTag.content = description;
    if (openGraphTitle) openGraphTitle.content = title;
    if (openGraphDescription) openGraphDescription.content = description;
    if (openGraphUrl) openGraphUrl.content = canonicalUrl;
    if (canonicalTag) canonicalTag.href = canonicalUrl;

    return () => {
      document.title = 'AI-SMARTSERVE | Thực đơn quán cà phê';
      if (descriptionTag) descriptionTag.content = 'Khám phá thực đơn AI-SMARTSERVE, chọn đồ uống yêu thích và đặt món trực tuyến tại quán cà phê.';
      if (openGraphTitle) openGraphTitle.content = 'AI-SMARTSERVE | Thực đơn quán cà phê';
      if (openGraphDescription) openGraphDescription.content = 'Khám phá thực đơn, chọn món và đặt đồ uống trực tuyến.';
      if (openGraphUrl) openGraphUrl.content = 'https://www.ai-smartserve.io.vn/';
      if (canonicalTag) canonicalTag.href = 'https://www.ai-smartserve.io.vn/';
    };
  }, []);

  const price = (monthly: number, discount: number) => formatPrice(annual ? Math.round(monthly * (1 - discount)) : monthly);

  return (
    <main className="landing-page" id="dau-trang">
      <header className="landing-header">
        <div className="landing-nav-wrap">
          <a className="landing-logo" href="#dau-trang" aria-label="AI-SMARTSERVE, về đầu trang"><span><Coffee size={22} /></span><b>AI-SMARTSERVE</b></a>
          <button className="landing-mobile-toggle" aria-label={mobileNavOpen ? 'Đóng menu' : 'Mở menu'} onClick={() => setMobileNavOpen(!mobileNavOpen)}>{mobileNavOpen ? <X /> : <Menu />}</button>
          <nav className={mobileNavOpen ? 'landing-nav is-open' : 'landing-nav'} aria-label="Điều hướng chính">
            <a href="#tinh-nang" onClick={() => setMobileNavOpen(false)}>Tính năng</a><a href="#cach-hoat-dong" onClick={() => setMobileNavOpen(false)}>Cách hoạt động</a><a href="#bang-gia" onClick={() => setMobileNavOpen(false)}>Bảng giá</a><a href="#cau-hoi" onClick={() => setMobileNavOpen(false)}>Câu hỏi</a>
            <Link className="landing-nav-demo" to="/demo">Xem demo <ArrowRight size={15} /></Link>
            <Link className="landing-nav-login" to="/login">Đăng nhập</Link>
            <Link className="landing-button landing-button-small" to="/signup">Dùng thử 14 ngày</Link>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={15} /> VẬN HÀNH QUÁN CÀ PHÊ THÔNG MINH</div>
            <h1>Khách tự gọi món bằng QR.<br /><span>Quán hiểu rõ mình đang lời ở đâu.</span></h1>
            <p>Khách quét mã, chọn món và theo dõi đơn trên điện thoại. Chủ quán quản lý hoạt động, xem báo cáo và nhận gợi ý phù hợp trên cùng một nền tảng.</p>
            <div className="hero-actions"><Link className="landing-button" to="/signup">Đăng ký dùng thử 14 ngày <ArrowRight size={18} /></Link><a className="landing-button-ghost" href="#tinh-nang">Khám phá giao diện <ArrowDown size={17} /></a></div>
            <div className="hero-assurances"><span><CheckCircle2 size={16} /> Không cần mua máy mới</span><span><CheckCircle2 size={16} /> Có khu demo trải nghiệm</span></div>
          </div>
          <div className="hero-visual"><div className="hero-glow" /><ProductPreview /><div className="hero-note"><span className="note-check"><Check size={16} /></span><span><b>Đơn hàng được đồng bộ</b><small>Khách đặt · Nhân viên nhận · Barista pha</small></span></div><div className="hero-scroll-cue"><span>Cuộn để khám phá</span><ArrowDown size={14} /></div></div>
        </div>
      </section>

      <section className="landing-proof" aria-label="Khảo sát người dùng">
        <div className="landing-container proof-inner"><div className="proof-intro"><span className="proof-mark">✳</span><p>Thiết kế từ nhu cầu thực tế<br /><b>của chủ quán cà phê</b></p></div><div className="proof-stat"><strong>8/9</strong><span>chủ quán được hỏi<br />muốn dùng thử</span></div><div className="proof-stat"><strong>5/6</strong><span>chủ quán tin gợi ý AI<br />sau khi xem demo</span></div><div className="proof-stat"><strong>3/6</strong><span>ước tính giảm hơn 60%<br />công việc thủ công</span></div><p className="proof-caption">Khảo sát nhóm nhỏ của dự án trong năm 2026; kết quả mang tính tham khảo.</p></div>
      </section>

      <section className="landing-section pain-section">
        <div className="landing-container"><div className="section-heading"><span className="section-kicker">NHỮNG ĐIỂM NGHẼN QUEN THUỘC</span><h2>Giờ cao điểm, quán của bạn<br />có gặp những tình huống này?</h2><p>AI-SMARTSERVE gom các bước gọi món, pha chế và theo dõi hoạt động vào một luồng rõ ràng.</p></div>
          <div className="pain-grid"><article className="pain-card"><div className="pain-time">07:30 <span>GIỜ MỞ CỬA</span></div><div className="pain-icon"><Users /></div><h3>Đơn dồn ở quầy</h3><p>Khách phải chờ gọi món, nhân viên khó xử lý nhiều yêu cầu cùng lúc.</p><div className="pain-line"><i style={{ width: '82%' }} /></div><small>Thời gian chờ dễ tăng vào giờ cao điểm</small></article><article className="pain-card"><div className="pain-time">12:15 <span>GIỜ ĂN TRƯA</span></div><div className="pain-icon"><Coffee /></div><h3>Dễ nhầm tuỳ chỉnh</h3><p>Ít đường, đổi sữa, thêm shot — ghi nhận thiếu một chi tiết có thể phải pha lại.</p><div className="pain-line"><i style={{ width: '64%' }} /></div><small>Nhiều ghi chú cần được chuyển chính xác</small></article><article className="pain-card"><div className="pain-time">23:10 <span>CUỐI NGÀY</span></div><div className="pain-icon"><BarChart3 /></div><h3>Khó biết món nào hiệu quả</h3><p>Báo cáo tổng doanh thu chưa luôn cho biết nên tập trung vào món hay khung giờ nào.</p><div className="pain-line"><i style={{ width: '72%' }} /></div><small>Dữ liệu vận hành cần dễ đọc và có ích</small></article></div>
        </div>
      </section>

      <section className="landing-section how-section" id="cach-hoat-dong"><div className="landing-container"><div className="section-heading"><span className="section-kicker">BẮT ĐẦU ĐƠN GIẢN</span><h2>Ba bước, tận dụng thiết bị sẵn có</h2><p>Khách dùng điện thoại của họ. Nhân viên làm việc trên thiết bị quán đang có.</p></div><div className="steps-grid"><article className="step-card"><span className="step-number">01</span><div className="step-icon"><QrCode /></div><h3>Khách quét và gọi món</h3><p>Khách quét QR tại bàn hoặc quầy, xem thực đơn, tuỳ chỉnh món và gửi đơn.</p><span className="step-tag">Thực đơn số · QR riêng</span></article><div className="step-connector"><ArrowRight /></div><article className="step-card"><span className="step-number">02</span><div className="step-icon"><Coffee /></div><h3>Nhân viên tiếp nhận và pha</h3><p>Đơn hiển thị trên màn hình làm việc để nhân viên nhận, pha chế và cập nhật trạng thái.</p><span className="step-tag">Hàng đợi theo trạng thái</span></article><div className="step-connector"><ArrowRight /></div><article className="step-card"><span className="step-number">03</span><div className="step-icon"><TrendingUp /></div><h3>Chủ quán xem hoạt động</h3><p>Theo dõi báo cáo, sản phẩm và những điểm cần chú ý trong quá trình vận hành.</p><span className="step-tag">Báo cáo · Gợi ý AI</span></article></div></div></section>

      <section className="landing-section features-section" id="tinh-nang"><div className="landing-container"><div className="section-heading section-heading-row"><div><span className="section-kicker">MỘT NỀN TẢNG CHO CẢ QUÁN</span><h2>Từ lúc khách chọn món<br />đến khi chủ quán xem báo cáo</h2></div><p>Các khu vực được thiết kế theo vai trò của khách hàng, nhân viên và chủ quán.</p></div><div className="features-grid">{features.map(({ icon: Icon, title, text }, index) => <article className="feature-card" key={title}><div className={`feature-icon feature-icon-${index + 1}`}><Icon size={22} /></div><span className="feature-index">0{index + 1}</span><h3>{title}</h3><p>{text}</p><span className="feature-rule" /></article>)}</div><div className="feature-payment"><div className="payment-icon"><CreditCard /></div><div><h3>Hỗ trợ luồng thanh toán không tiền mặt</h3><p>Phương thức thanh toán thực tế phụ thuộc cấu hình của quán và môi trường triển khai.</p></div><ShieldCheck size={23} className="payment-shield" /></div></div></section>

      <section className="landing-section audience-section"><div className="landing-container audience-layout"><div className="section-heading"><span className="section-kicker">THIẾT KẾ CHO QUÁN CÀ PHÊ</span><h2>Phù hợp với cách quán của bạn vận hành</h2><p>Bắt đầu từ quy mô hiện tại và lựa chọn gói theo nhu cầu thực tế.</p><Link className="text-link" to="/signup">Tìm hiểu gói dùng thử <ArrowRight size={16} /></Link></div><div className="audience-cards"><article><span className="audience-icon"><Store /></span><h3>Quán độc lập</h3><p>Quản lý thực đơn, đơn hàng và bàn trong hoạt động hằng ngày.</p><small>01 · MỘT ĐIỂM BÁN</small></article><article><span className="audience-icon"><Coffee /></span><h3>Kiosk và mang đi</h3><p>Cho phép khách xem món và gửi đơn qua điện thoại.</p><small>02 · PHỤC VỤ NHANH</small></article><article><span className="audience-icon"><Users /></span><h3>Chuỗi quán nhỏ</h3><p>Quản lý nhiều điểm bán theo giới hạn của gói dịch vụ.</p><small>03 · NHIỀU CHI NHÁNH</small></article></div></div></section>

      <section className="landing-section pricing-section" id="bang-gia"><div className="landing-container"><div className="section-heading"><span className="section-kicker">GÓI DỊCH VỤ</span><h2>Dùng thử trước, chọn gói theo quy mô</h2><p>Dùng thử 14 ngày để trải nghiệm trước khi lựa chọn gói.</p><div className="billing-toggle"><button className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>Theo tháng</button><button className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>Theo năm <span>Tiết kiệm</span></button></div></div><div className="pricing-grid">
            <article className="price-card"><span className="price-plan">BASIC</span><h3>{price(239000, .15)}<small> / tháng</small></h3>{annual && <p className="price-note">Thanh toán theo năm, đã áp dụng ưu đãi</p>}<p className="price-description">Dành cho quán nhỏ mới bắt đầu số hoá.</p><ul><li><Check /> Gọi món QR và thực đơn số</li><li><Check /> Thanh toán VietQR*</li><li><Check /> Báo cáo bán hàng cơ bản</li><li><Check /> Hỗ trợ qua Zalo</li></ul><Link to="/signup?plan=basic" className="price-button">Chọn Basic <ArrowRight size={16} /></Link></article>
            <article className="price-card price-card-featured"><span className="popular-label">PHỔ BIẾN</span><span className="price-plan">PREMIUM</span><h3>{price(1299000, .2)}<small> / tháng</small></h3>{annual && <p className="price-note">Thanh toán theo năm, đã áp dụng ưu đãi</p>}<p className="price-description">Cho quán cần thêm công cụ phân tích và quản lý.</p><ul><li><Check /> Tất cả tính năng Basic</li><li><Check /> AI gợi ý combo</li><li><Check /> Theo dõi nguyên liệu</li><li><Check /> Phân tích nâng cao</li></ul><Link to="/signup?plan=premium" className="price-button">Chọn Premium <ArrowRight size={16} /></Link></article>
            <article className="price-card"><span className="price-plan">PRO</span><h3>{price(1999000, .2)}<small> / tháng</small></h3>{annual && <p className="price-note">Thanh toán theo năm, đã áp dụng ưu đãi</p>}<p className="price-description">Cho thương hiệu cần quản lý nhiều điểm bán.</p><ul><li><Check /> Tất cả tính năng Premium</li><li><Check /> Hỗ trợ nhiều chi nhánh</li><li><Check /> Phân quyền nhân viên</li><li><Check /> Báo cáo tập trung</li></ul><Link to="/signup?plan=pro" className="price-button">Chọn Pro <ArrowRight size={16} /></Link></article>
          </div><p className="pricing-footnote">*Tính năng và phương thức thanh toán phụ thuộc cấu hình triển khai. Vui lòng xem chi tiết gói trước khi đăng ký.</p></div></section>

      <section className="landing-section compare-section"><div className="landing-container compare-layout"><div className="section-heading"><span className="section-kicker">GIÁ TRỊ TRONG VẬN HÀNH</span><h2>Công cụ quản lý cho công việc của quán</h2><p>Nền tảng tập trung các luồng gọi món, tiếp nhận đơn, theo dõi hoạt động và báo cáo.</p><Link className="landing-button" to="/demo">Xem giao diện demo <ArrowRight size={17} /></Link></div><div className="compare-card"><div className="compare-row compare-head"><span>TÍNH NĂNG</span><span>AI-SMARTSERVE</span></div>{['Gọi món bằng QR', 'Bán hàng tại quầy', 'Quản lý thực đơn', 'Theo dõi đơn pha chế', 'Báo cáo hoạt động', 'Gợi ý và phân tích AI'].map((item, index) => <div className="compare-row" key={item}><span>{item}</span><span className={index === 5 ? 'compare-premium' : ''}>{index === 5 ? 'Theo gói dịch vụ' : <><CheckCircle2 size={17} /> Có</>}</span></div>)}</div></div></section>

      <section className="landing-section faq-section" id="cau-hoi"><div className="landing-container faq-layout"><div className="section-heading"><span className="section-kicker">CÂU HỎI THƯỜNG GẶP</span><h2>Trước khi bắt đầu dùng thử</h2><p>Xem nhanh một số câu hỏi về thiết bị, quy trình và gói dịch vụ.</p><a className="text-link" href="https://zalo.me/0968013005" target="_blank" rel="noreferrer">Hỏi thêm qua Zalo <ArrowRight size={16} /></a></div><div className="faq-list">{faqs.map((faq, index) => <article className={`faq-item ${openFaq === index ? 'is-open' : ''}`} key={faq.q}><button aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{faq.q}</span><ChevronDown size={19} /></button>{openFaq === index && <p>{faq.a}</p>}</article>)}</div></div></section>

      <section className="landing-final-cta" id="dang-ky"><div className="landing-container final-cta-card"><div className="final-cta-orb"><Coffee size={25} /></div><span className="section-kicker">BẮT ĐẦU TRẢI NGHIỆM</span><h2>Đưa hoạt động của quán<br />vào một luồng rõ ràng hơn</h2><p>Tạo tài khoản dùng thử 14 ngày và khám phá các khu vực dành cho chủ quán, nhân viên và khách hàng.</p><div className="hero-actions"><Link className="landing-button landing-button-light" to="/signup">Đăng ký dùng thử <ArrowRight size={18} /></Link><Link className="landing-button-ghost cta-demo" to="/demo">Xem demo trước</Link></div><small className="cta-assurance"><ShieldCheck size={15} /> Không yêu cầu thông tin thanh toán để bắt đầu đăng ký</small></div></section>

      <footer className="landing-footer"><div className="landing-container footer-main"><div className="footer-brand"><a className="landing-logo" href="#dau-trang"><span><Coffee size={21} /></span><b>AI-SMARTSERVE</b></a><p>Nền tảng hỗ trợ vận hành quán cà phê với QR, quy trình phục vụ và công cụ phân tích.</p></div><div className="footer-links"><b>SẢN PHẨM</b><a href="#tinh-nang">Tính năng</a><a href="#cach-hoat-dong">Cách hoạt động</a><a href="#bang-gia">Bảng giá</a><Link to="/demo">Khu demo</Link></div><div className="footer-links"><b>TÀI KHOẢN</b><Link to="/signup">Dùng thử 14 ngày</Link><Link to="/login">Đăng nhập</Link><Link to="/menu">Thực đơn khách</Link></div><div className="footer-links"><b>LIÊN HỆ</b><a href="mailto:tungphan30012005@gmail.com">tungphan30012005@gmail.com</a><a href="https://zalo.me/0968013005" target="_blank" rel="noreferrer">Zalo: 0968 013 005</a><span>Hà Nội, Việt Nam</span></div></div><div className="landing-container footer-bottom"><span>© {new Date().getFullYear()} AI-SMARTSERVE</span><span>Dự án khởi nghiệp · FPT University</span></div></footer>
    </main>
  );
}
