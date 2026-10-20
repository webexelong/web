/**
 * PrintService - Công cụ in ấn chuyên nghiệp chuẩn POS (KiotViet / iPOS style)
 * Hỗ trợ in hóa đơn nhiệt K80/K58, phiếu bếp và tem mã QR dán bàn (đơn lẻ / khổ A4).
 */

export interface StorePrintInfo {
  storeName: string;
  brandName?: string;
  address?: string;
  phone?: string;
  wifiName?: string;
  wifiPassword?: string;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  totalPrice: number;
  sizeName?: string;
  sugarLevel?: string;
  iceLevel?: string;
  toppings?: string[];
  note?: string;
}

export interface ReceiptData {
  orderCode: string;
  tableNumber: string;
  customerName?: string;
  staffName?: string;
  createdAt: string;
  items: ReceiptItem[];
  subTotal: number;
  discountAmount?: number;
  voucherCode?: string;
  pointsDiscount?: number;
  totalAmount: number;
  paymentMethod?: string; // 'cash' | 'payos' | 'transfer'
  paymentStatus?: string; // 'paid' | 'pending'
  note?: string;
  storeInfo: StorePrintInfo;
  paperSize?: 'k80' | 'k58';
  qrVerificationUrl?: string;
}

export interface KitchenTicketData {
  orderCode: string;
  tableNumber: string;
  staffName?: string;
  createdAt: string;
  items: ReceiptItem[];
  note?: string;
  storeInfo: StorePrintInfo;
  paperSize?: 'k80' | 'k58';
}

export interface TableQrPrintItem {
  tableNumber: string;
  capacity?: number;
  qrDataUrl: string;
  menuUrl: string;
}

/**
 * Thực hiện in thông qua Iframe ẩn để không ảnh hưởng đến giao diện hiện tại
 */
export function printHtml(htmlContent: string, documentTitle = 'In Phiếu'): Promise<void> {
  return new Promise((resolve) => {
    // Xóa iframe in cũ nếu có
    const oldIframe = document.getElementById('pos-print-iframe');
    if (oldIframe) {
      oldIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'pos-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      console.error('Không thể khởi tạo iframe in.');
      resolve();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${documentTitle}</title>
          <style>
            @page {
              margin: 0;
              size: auto;
            }
            body {
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `);
    doc.close();

    // Chờ tài nguyên tải xong (đặc biệt là hình ảnh QR) rồi in
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
        resolve();
      }, 1000);
    }, 300);
  });
}

/**
 * Tạo HTML Hóa Đơn Thanh Toán Chuẩn POS (K80 / K58)
 */
export function generateReceiptHtml(data: ReceiptData): string {
  const isK58 = data.paperSize === 'k58';
  const width = isK58 ? '54mm' : '76mm';
  const fontSize = isK58 ? '11px' : '12px';
  const headerFontSize = isK58 ? '15px' : '17px';
  const tableFontSize = isK58 ? '10px' : '11px';

  const formatMoney = (amount: number) => amount.toLocaleString('vi-VN') + 'đ';
  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const isTakeaway = data.tableNumber.toLowerCase().includes('mang') || data.tableNumber.toLowerCase().includes('takeaway');

  return `
    <div style="
      width: ${width};
      margin: 0 auto;
      padding: 3mm 1mm;
      font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
      font-size: ${fontSize};
      color: #000;
      line-height: 1.35;
      background: #fff;
    ">
      <!-- Header Quán -->
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-size: ${headerFontSize}; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">
          ${data.storeInfo.brandName || data.storeInfo.storeName}
        </div>
        ${data.storeInfo.brandName && data.storeInfo.storeName !== data.storeInfo.brandName ? `
          <div style="font-size: 11px; font-weight: bold; margin-top: 1px;">
            ${data.storeInfo.storeName}
          </div>
        ` : ''}
        ${data.storeInfo.address ? `
          <div style="font-size: 10px; margin-top: 2px;">
            Đ/c: ${data.storeInfo.address}
          </div>
        ` : ''}
        ${data.storeInfo.phone ? `
          <div style="font-size: 10px;">
            Hotline: ${data.storeInfo.phone}
          </div>
        ` : ''}
        ${data.storeInfo.wifiName ? `
          <div style="font-size: 10px; font-style: italic; margin-top: 1px;">
            Wifi: ${data.storeInfo.wifiName} ${data.storeInfo.wifiPassword ? `| Pass: ${data.storeInfo.wifiPassword}` : ''}
          </div>
        ` : ''}
      </div>

      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

      <!-- Tiêu đề Hóa đơn & Bàn -->
      <div style="text-align: center; margin: 4px 0;">
        <div style="font-size: 14px; font-weight: 900; text-transform: uppercase;">
          ${data.paymentStatus === 'paid' ? 'HÓA ĐƠN THANH TOÁN' : 'PHIẾU TẠM TÍNH'}
        </div>
        <div style="
          display: inline-block;
          margin-top: 3px;
          padding: 2px 8px;
          border: 1.5px solid #000;
          font-weight: 900;
          font-size: 13px;
          text-transform: uppercase;
        ">
          ${isTakeaway ? 'MANG VỀ' : `VỊ TRÍ: ${data.tableNumber.toUpperCase().includes('BÀN') ? data.tableNumber.toUpperCase() : 'BÀN ' + data.tableNumber}`}
        </div>
      </div>

      <!-- Thông tin đơn hàng -->
      <div style="font-size: 10px; margin: 6px 0 4px 0; line-height: 1.4;">
        <div style="display: flex; justify-content: space-between;">
          <span>Mã đơn: <strong>${data.orderCode}</strong></span>
          <span>Thu ngân: ${data.staffName || 'Admin'}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Thời gian: ${formatDateTime(data.createdAt)}</span>
          ${data.customerName ? `<span>Khách: ${data.customerName}</span>` : ''}
        </div>
      </div>

      <div style="border-top: 1px solid #000; margin: 4px 0;"></div>

      <!-- Bảng danh sách món -->
      <table style="width: 100%; border-collapse: collapse; font-size: ${tableFontSize}; margin: 4px 0;">
        <thead>
          <tr style="border-bottom: 1px dashed #000; font-weight: bold; text-align: left;">
            <th style="padding: 2px 0;">Món</th>
            <th style="padding: 2px 0; text-align: center; width: 22px;">SL</th>
            <th style="padding: 2px 0; text-align: right; width: 45px;">Đ.Giá</th>
            <th style="padding: 2px 0; text-align: right; width: 50px;">T.Tiền</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map(item => `
            <tr style="vertical-align: top;">
              <td style="padding: 3px 0 1px 0;">
                <div style="font-weight: bold;">${item.name}</div>
                ${item.sizeName ? `<div style="font-size: 9px; color: #333;">Size: ${item.sizeName}</div>` : ''}
                ${(item.sugarLevel || item.iceLevel) ? `
                  <div style="font-size: 9px; color: #555;">
                    ${item.iceLevel ? `Đá: ${item.iceLevel}` : ''} ${item.sugarLevel ? `· Đường: ${item.sugarLevel}` : ''}
                  </div>
                ` : ''}
                ${item.toppings && item.toppings.length > 0 ? `
                  <div style="font-size: 9px; color: #555;">+ ${item.toppings.join(', ')}</div>
                ` : ''}
                ${item.note ? `
                  <div style="font-size: 9px; font-style: italic;">* ${item.note}</div>
                ` : ''}
              </td>
              <td style="padding: 3px 0; text-align: center; font-weight: bold;">
                ${item.quantity}
              </td>
              <td style="padding: 3px 0; text-align: right;">
                ${formatMoney(item.price)}
              </td>
              <td style="padding: 3px 0; text-align: right; font-weight: bold;">
                ${formatMoney(item.totalPrice)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>

      <!-- Tổng kết thanh toán -->
      <div style="font-size: 11px; margin: 4px 0;">
        <div style="display: flex; justify-content: space-between; padding: 1.5px 0;">
          <span>Tổng tiền món:</span>
          <span>${formatMoney(data.subTotal)}</span>
        </div>

        ${data.discountAmount && data.discountAmount > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 1.5px 0;">
            <span>Giảm giá voucher ${data.voucherCode ? `(${data.voucherCode})` : ''}:</span>
            <span>-${formatMoney(data.discountAmount)}</span>
          </div>
        ` : ''}

        ${data.pointsDiscount && data.pointsDiscount > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 1.5px 0;">
            <span>Trừ điểm tích lũy:</span>
            <span>-${formatMoney(data.pointsDiscount)}</span>
          </div>
        ` : ''}

        <div style="
          display: flex;
          justify-content: space-between;
          padding: 4px 0 2px 0;
          margin-top: 2px;
          border-top: 1.5px solid #000;
          font-size: 13px;
          font-weight: 900;
        ">
          <span>TỔNG CỘNG:</span>
          <span>${formatMoney(data.totalAmount)}</span>
        </div>

        <div style="display: flex; justify-content: space-between; padding: 1.5px 0; font-size: 10px; color: #333;">
          <span>Phương thức:</span>
          <span style="font-weight: bold; text-transform: uppercase;">
            ${data.paymentMethod === 'cash' ? 'Tiền mặt' : data.paymentMethod === 'payos' ? 'Quét QR PayOS' : 'Chuyển khoản'}
          </span>
        </div>

        <div style="display: flex; justify-content: space-between; padding: 1.5px 0; font-size: 10px;">
          <span>Trạng thái:</span>
          <span style="font-weight: bold; ${data.paymentStatus === 'paid' ? 'color: #000;' : 'color: #d97706;'}">
            ${data.paymentStatus === 'paid' ? '✔ ĐÃ THANH TOÁN' : '⏳ CHỜ THANH TOÁN'}
          </span>
        </div>
      </div>

      ${data.note ? `
        <div style="border-top: 1px dashed #000; padding: 3px 0; margin-top: 3px; font-size: 10px;">
          <strong>Ghi chú:</strong> ${data.note}
        </div>
      ` : ''}

      <div style="border-top: 1px dashed #000; margin: 8px 0 6px 0;"></div>

      <!-- Footer Lời Cảm Ơn -->
      <div style="text-align: center; font-size: 10px; margin-top: 4px;">
        <div style="font-weight: bold;">CẢM ƠN QUÝ KHÁCH & HẸN GẶP LẠI!</div>
        <div style="font-size: 9px; color: #666; margin-top: 2px;">
          Powered by AI-SMARTSERVE POS
        </div>
      </div>
    </div>
  `;
}

/**
 * Tạo HTML Phiếu Chế Biến / Pha Chế Cho Bếp & Barista (Kitchen Ticket)
 */
export function generateKitchenTicketHtml(data: KitchenTicketData): string {
  const isK58 = data.paperSize === 'k58';
  const width = isK58 ? '54mm' : '76mm';
  const fontSize = isK58 ? '11px' : '12px';

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const isTakeaway = data.tableNumber.toLowerCase().includes('mang') || data.tableNumber.toLowerCase().includes('takeaway');

  return `
    <div style="
      width: ${width};
      margin: 0 auto;
      padding: 3mm 1mm;
      font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
      font-size: ${fontSize};
      color: #000;
      line-height: 1.35;
      background: #fff;
    ">
      <!-- Header Phiếu Bếp -->
      <div style="text-align: center; margin-bottom: 6px;">
        <div style="font-size: 16px; font-weight: 900; text-transform: uppercase;">
          *** PHIẾU PHA CHẾ / BẾP ***
        </div>
        <div style="
          display: inline-block;
          margin-top: 4px;
          padding: 3px 10px;
          background: #000;
          color: #fff;
          font-weight: 900;
          font-size: 15px;
          text-transform: uppercase;
          border-radius: 3px;
        ">
          ${isTakeaway ? 'MANG VỀ' : (data.tableNumber.toUpperCase().includes('BÀN') ? data.tableNumber.toUpperCase() : 'BÀN ' + data.tableNumber)}
        </div>
      </div>

      <div style="font-size: 10px; display: flex; justify-content: space-between; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 6px;">
        <span>Mã: <strong>${data.orderCode}</strong></span>
        <span>Giờ: <strong>${formatDateTime(data.createdAt)}</strong></span>
      </div>

      <!-- Danh sách món pha chế -->
      <div style="margin: 6px 0;">
        ${data.items.map((item, idx) => `
          <div style="border-bottom: 1px solid #000; padding: 5px 0;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-size: 14px; font-weight: 900;">
                [ ${item.quantity}x ] ${item.name}
              </span>
              ${item.sizeName ? `
                <span style="font-size: 12px; font-weight: bold; background: #eee; padding: 1px 4px; border: 1px solid #333;">
                  ${item.sizeName}
                </span>
              ` : ''}
            </div>

            <!-- Tùy chọn đường, đá, topping -->
            ${(item.sugarLevel || item.iceLevel) ? `
              <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">
                🧊 Đá: ${item.iceLevel || '100%'} · 🍯 Đường: ${item.sugarLevel || '100%'}
              </div>
            ` : ''}

            ${item.toppings && item.toppings.length > 0 ? `
              <div style="font-size: 11px; margin-top: 1.5px; font-weight: bold;">
                + Topping: ${item.toppings.join(', ')}
              </div>
            ` : ''}

            ${item.note ? `
              <div style="font-size: 11px; font-weight: 900; color: #000; margin-top: 2px; padding: 1px 3px; background: #f3f3f3;">
                👉 Ghi chú: ${item.note}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      ${data.note ? `
        <div style="border: 1.5px solid #000; padding: 4px; margin-top: 6px; font-size: 11px; font-weight: bold;">
          LƯU Ý CHUNG ĐƠN: ${data.note}
        </div>
      ` : ''}

      <div style="text-align: center; font-size: 10px; margin-top: 8px; border-top: 1px dashed #000; padding-top: 4px;">
        Vui lòng kiểm tra kỹ trước khi ra món!
      </div>
    </div>
  `;
}

/**
 * Tạo HTML Tem Mã QR Dán Bàn Đơn Lẻ (Khổ Standee A6 hoặc Tem 8x10cm)
 */
export function generateTableQrStickerHtml(table: TableQrPrintItem, storeInfo: StorePrintInfo): string {
  const tableTitle = table.tableNumber.toUpperCase().includes('BÀN') 
    ? table.tableNumber.toUpperCase() 
    : `BÀN ${table.tableNumber}`;

  return `
    <div style="
      width: 90mm;
      min-height: 120mm;
      margin: 0 auto;
      padding: 6mm;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      text-align: center;
      color: #1a1a1a;
      background: #fff;
      border: 2px solid #6f4e37;
      border-radius: 12px;
    ">
      <!-- Thương hiệu -->
      <div style="margin-bottom: 4px;">
        <div style="font-size: 15px; font-weight: 900; text-transform: uppercase; color: #6f4e37; letter-spacing: 0.5px;">
          ${storeInfo.brandName || storeInfo.storeName}
        </div>
        ${storeInfo.brandName && storeInfo.storeName !== storeInfo.brandName ? `
          <div style="font-size: 11px; color: #666; font-weight: 600;">
            ${storeInfo.storeName}
          </div>
        ` : ''}
      </div>

      <!-- Số Bàn Nổi Bật -->
      <div style="
        margin: 6px auto;
        padding: 4px 16px;
        background: #6f4e37;
        color: #fff;
        font-size: 20px;
        font-weight: 900;
        border-radius: 8px;
        display: inline-block;
        letter-spacing: 1px;
      ">
        ${tableTitle}
      </div>

      <!-- Mã QR Code Sắc Nét -->
      <div style="
        margin: 6px auto;
        padding: 8px;
        background: #fff;
        border: 1.5px solid #e8d2c0;
        border-radius: 10px;
        display: inline-block;
      ">
        <img src="${table.qrDataUrl}" alt="${tableTitle}" style="width: 58mm; height: 58mm; display: block; margin: 0 auto;" />
      </div>

      <!-- Hướng dẫn khách hàng -->
      <div style="margin: 6px 0;">
        <div style="font-size: 13px; font-weight: 900; color: #6f4e37; text-transform: uppercase;">
          QUÉT MÃ ĐỂ GỌI MÓN
        </div>
        <div style="font-size: 10px; color: #4b5563; margin-top: 2px; line-height: 1.4;">
          1. Mở Camera điện thoại quét mã<br>
          2. Xem menu & chọn món yêu thích<br>
          3. Nhân viên sẽ mang món đến bàn
        </div>
      </div>

      <!-- Thông tin Wifi quán -->
      ${storeInfo.wifiName ? `
        <div style="
          margin-top: 8px;
          padding: 4px 8px;
          background: #fbf7f3;
          border: 1px dashed #d7b59b;
          border-radius: 6px;
          font-size: 10px;
          color: #6f4e37;
        ">
          📶 <strong>Wifi:</strong> ${storeInfo.wifiName} ${storeInfo.wifiPassword ? `· <strong>Pass:</strong> ${storeInfo.wifiPassword}` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Tạo HTML In Toàn Bộ Mã QR Bàn Của Quán (Khổ Giấy A4 - Batch Print Sheet)
 * Mỗi trang A4 chứa lưới 4 hoặc 6 thẻ bàn có đường viền cắt (cutting guide)
 */
export function generateBatchTableQrA4Html(tables: TableQrPrintItem[], storeInfo: StorePrintInfo): string {
  return `
    <style>
      @page {
        size: A4 portrait;
        margin: 8mm;
      }
      .a4-page {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);
        gap: 6mm;
        width: 100%;
        height: 275mm;
        box-sizing: border-box;
        page-break-after: always;
      }
      .table-card {
        border: 1.5px dashed #6f4e37;
        border-radius: 10mm;
        padding: 5mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        text-align: center;
        background: #fff;
      }
    </style>

    ${(() => {
      const itemsPerPage = 4;
      const pagesCount = Math.ceil(tables.length / itemsPerPage);
      let pagesHtml = '';

      for (let p = 0; p < pagesCount; p++) {
        const pageTables = tables.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
        pagesHtml += `
          <div class="a4-page" ${p === pagesCount - 1 ? 'style="page-break-after: auto;"' : ''}>
            ${pageTables.map(t => {
              const tableTitle = t.tableNumber.toUpperCase().includes('BÀN') 
                ? t.tableNumber.toUpperCase() 
                : `BÀN ${t.tableNumber}`;

              return `
                <div class="table-card">
                  <!-- Header -->
                  <div>
                    <div style="font-size: 13px; font-weight: 900; color: #6f4e37; text-transform: uppercase;">
                      ${storeInfo.brandName || storeInfo.storeName}
                    </div>
                    ${storeInfo.brandName && storeInfo.storeName !== storeInfo.brandName ? `
                      <div style="font-size: 10px; color: #666; font-weight: 600;">
                        ${storeInfo.storeName}
                      </div>
                    ` : ''}
                    <div style="
                      margin: 3px auto;
                      padding: 2px 14px;
                      background: #6f4e37;
                      color: #fff;
                      font-size: 17px;
                      font-weight: 900;
                      border-radius: 6px;
                      display: inline-block;
                    ">
                      ${tableTitle}
                    </div>
                  </div>

                  <!-- QR Code -->
                  <div style="
                    padding: 4px;
                    background: #fff;
                    border: 1px solid #e8d2c0;
                    border-radius: 8px;
                    display: inline-block;
                    margin: 2px 0;
                  ">
                    <img src="${t.qrDataUrl}" alt="${tableTitle}" style="width: 44mm; height: 44mm; display: block;" />
                  </div>

                  <!-- Footer -->
                  <div>
                    <div style="font-size: 11px; font-weight: 900; color: #6f4e37; text-transform: uppercase;">
                      QUÉT MÃ ĐỂ GỌI MÓN
                    </div>
                    <div style="font-size: 9px; color: #666; margin-top: 1px;">
                      Mở camera quét mã · Xem thực đơn tại bàn
                    </div>
                    ${storeInfo.wifiName ? `
                      <div style="font-size: 9px; color: #9a3412; font-weight: 600; margin-top: 3px;">
                        Wifi: ${storeInfo.wifiName} ${storeInfo.wifiPassword ? `· Pass: ${storeInfo.wifiPassword}` : ''}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
      return pagesHtml;
    })()}
  `;
}
