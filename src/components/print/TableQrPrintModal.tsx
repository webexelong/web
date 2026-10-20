import { useState } from 'react';
import { 
  printHtml, 
  generateTableQrStickerHtml, 
  generateBatchTableQrA4Html, 
  type TableQrPrintItem, 
  type StorePrintInfo 
} from '../../services/printService';

interface TableQrPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Bàn đơn lẻ (nếu in lẻ)
  singleTable?: TableQrPrintItem | null;
  // Danh sách toàn bộ bàn (nếu in hàng loạt)
  allTables?: TableQrPrintItem[];
  defaultStoreInfo: StorePrintInfo;
}

export default function TableQrPrintModal({
  isOpen,
  onClose,
  singleTable,
  allTables = [],
  defaultStoreInfo,
}: TableQrPrintModalProps) {
  const [mode, setMode] = useState<'single' | 'batch'>(singleTable ? 'single' : 'batch');
  const [wifiName, setWifiName] = useState(defaultStoreInfo.wifiName || '');
  const [wifiPassword, setWifiPassword] = useState(defaultStoreInfo.wifiPassword || '');
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const currentStoreInfo: StorePrintInfo = {
    ...defaultStoreInfo,
    wifiName: wifiName.trim() || undefined,
    wifiPassword: wifiPassword.trim() || undefined,
  };

  const previewTable = singleTable || (allTables.length > 0 ? allTables[0] : null);

  const htmlPreview = mode === 'single' && previewTable
    ? generateTableQrStickerHtml(previewTable, currentStoreInfo)
    : generateBatchTableQrA4Html(allTables.length > 0 ? allTables : (singleTable ? [singleTable] : []), currentStoreInfo);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      if (mode === 'single' && previewTable) {
        const title = `Tem QR - ${previewTable.tableNumber}`;
        await printHtml(generateTableQrStickerHtml(previewTable, currentStoreInfo), title);
      } else {
        const title = `Danh Sách QR Bàn Khổ A4 - ${currentStoreInfo.storeName}`;
        await printHtml(generateBatchTableQrA4Html(allTables, currentStoreInfo), title);
      }
    } catch (err) {
      console.error('Print table QR failed:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadSingleImage = () => {
    if (!previewTable) return;
    const link = document.createElement('a');
    link.href = previewTable.qrDataUrl;
    link.download = `QR-${previewTable.tableNumber}.png`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">qr_code_2</span>
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 leading-tight">In Mã QR Dán Bàn / Standee</h3>
              <p className="text-xs text-gray-500">
                {mode === 'single' && previewTable 
                  ? `In tem riêng cho Bàn ${previewTable.tableNumber}` 
                  : `In hàng loạt ${allTables.length} bàn (Dàn trang khổ A4)`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Toolbar: Options & Wifi setup */}
        <div className="px-5 py-3 border-b border-gray-100 bg-white space-y-3">
          {/* Switch Mode: Single vs Batch */}
          {allTables.length > 0 && singleTable && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider w-24">
                Chế độ in:
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`py-1.5 px-3 rounded-xl font-bold transition-all ${
                    mode === 'single'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Bàn này ({singleTable.tableNumber})
                </button>
                <button
                  type="button"
                  onClick={() => setMode('batch')}
                  className={`py-1.5 px-3 rounded-xl font-bold transition-all ${
                    mode === 'batch'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Toàn bộ {allTables.length} bàn (Khổ A4)
                </button>
              </div>
            </div>
          )}

          {/* Cấu hình Wifi hiển thị trên tem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Tên mạng Wifi quán (in kèm dưới tem)
              </label>
              <input
                type="text"
                placeholder="VD: WebCafe Free Wifi"
                value={wifiName}
                onChange={(e) => setWifiName(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Mật khẩu Wifi
              </label>
              <input
                type="text"
                placeholder="VD: 88888888"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Live Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-stone-100 flex justify-center">
          <div className="bg-white shadow-xl rounded-2xl p-4 border border-stone-200 max-w-full overflow-x-auto self-start">
            <div 
              dangerouslySetInnerHTML={{ __html: htmlPreview }} 
              className="select-text"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-white flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500 hidden sm:block">
            {mode === 'single' 
              ? 'Chuẩn kích thước lồng chân mica chữ T (Standee để bàn) hoặc decal dán.' 
              : 'Dàn trang sẵn 4 tem / tờ A4, có đường viền cắt tiện lợi.'}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {mode === 'single' && previewTable && (
              <button
                type="button"
                onClick={handleDownloadSingleImage}
                className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                title="Tải ảnh QR PNG về máy để gửi xưởng in ấn decal ngoài"
              >
                <span className="material-symbols-outlined text-base">download</span>
                <span>Tải Ảnh QR</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-orange-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPrinting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Đang đẩy lệnh...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">print</span>
                  <span>{mode === 'single' ? 'In Tem Bàn Này' : `In Toàn Bộ ${allTables.length} Bàn (A4)`}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
