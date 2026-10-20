import { useState } from 'react';
import { 
  printHtml, 
  generateReceiptHtml, 
  generateKitchenTicketHtml, 
  type ReceiptData, 
  type KitchenTicketData 
} from '../../services/printService';

interface ReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReceiptData;
}

export default function ReceiptPrintModal({ isOpen, onClose, data }: ReceiptPrintModalProps) {
  const [printType, setPrintType] = useState<'receipt' | 'kitchen'>('receipt');
  const [paperSize, setPaperSize] = useState<'k80' | 'k58'>('k80');
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const currentReceiptData: ReceiptData = {
    ...data,
    paperSize,
  };

  const kitchenData: KitchenTicketData = {
    orderCode: data.orderCode,
    tableNumber: data.tableNumber,
    staffName: data.staffName,
    createdAt: data.createdAt,
    items: data.items,
    note: data.note,
    storeInfo: data.storeInfo,
    paperSize,
  };

  const htmlPreview = printType === 'receipt' 
    ? generateReceiptHtml(currentReceiptData) 
    : generateKitchenTicketHtml(kitchenData);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const title = printType === 'receipt' ? `Hóa Đơn - ${data.orderCode}` : `Phiếu Bếp - ${data.orderCode}`;
      await printHtml(htmlPreview, title);
    } catch (err) {
      console.error('Print failed:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">print</span>
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 leading-tight">In Phiếu Đơn Hàng</h3>
              <p className="text-xs text-gray-500">{data.orderCode} · {data.tableNumber}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Toolbar: Switch Type & Paper Size */}
        <div className="px-5 py-3 border-b border-gray-100 bg-white grid grid-cols-2 gap-3 text-xs">
          {/* Loại phiếu */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Loại phiếu in
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl font-bold">
              <button
                type="button"
                onClick={() => setPrintType('receipt')}
                className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                  printType === 'receipt'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Hóa Đơn
              </button>
              <button
                type="button"
                onClick={() => setPrintType('kitchen')}
                className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                  printType === 'kitchen'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Phiếu Bếp
              </button>
            </div>
          </div>

          {/* Khổ giấy máy in */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Khổ giấy nhiệt
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl font-bold">
              <button
                type="button"
                onClick={() => setPaperSize('k80')}
                className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                  paperSize === 'k80'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                K80 (80mm)
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('k58')}
                className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                  paperSize === 'k58'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                K58 (58mm)
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview Container (Giả lập cuộn giấy in nhiệt) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-stone-100 flex justify-center">
          <div className="bg-white shadow-xl rounded-lg p-3 border border-stone-200 self-start transition-all">
            <div 
              dangerouslySetInnerHTML={{ __html: htmlPreview }} 
              className="select-text"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-white flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500 hidden sm:block">
            Tương thích 100% các máy in nhiệt Xprinter, Epson, Sunmi qua USB/LAN/Bluetooth.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
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
                  <span>In Phiếu Ngay</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
