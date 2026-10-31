import React, { useState, useRef, useCallback } from 'react';
import { menuApi } from '../api/apis';

interface ImageCropUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}

// Clean preview URL (handles both relative `/uploads/...` and absolute URLs)
export const resolveDisplayUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  const isDev = ['localhost', '127.0.0.1'].includes(host);
  const origin = isDev ? `http://${host}:5277` : (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function ImageCropUpload({
  value,
  onChange,
  label = 'Hình ảnh món'
}: ImageCropUploadProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isManualUrlMode, setIsManualUrlMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fixed 1:1 ratio transforms
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Open modal with fresh transforms
  const openCropModal = (src: string) => {
    setImageSrc(src);
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setErrorMessage('');
    setIsCropModalOpen(true);
  };

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMessage('Dung lượng tệp vượt quá 5MB. Vui lòng chọn ảnh nhẹ hơn.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate extension
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Định dạng không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG hoặc WEBP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      openCropModal(reader.result as string);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag / Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  // Generate cropped 600x600 image and upload to server
  const handleCropAndSave = useCallback(async () => {
    if (!imageRef.current) return;
    setIsUploading(true);
    setErrorMessage('');

    try {
      const img = imageRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Không thể khởi tạo Canvas 2D');

      // Standard square resolution: 600x600
      const targetSize = 600;
      canvas.width = targetSize;
      canvas.height = targetSize;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Center transform
      ctx.save();
      ctx.translate(targetSize / 2, targetSize / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      const viewportDim = 280; // Size of UI crop frame in px
      const scaleFactor = targetSize / viewportDim;

      const baseScale = viewportDim / Math.min(img.naturalWidth, img.naturalHeight);
      const drawWidth = img.naturalWidth * zoom * scaleFactor * baseScale;
      const drawHeight = img.naturalHeight * zoom * scaleFactor * baseScale;

      ctx.drawImage(
        img,
        -drawWidth / 2 + position.x * scaleFactor,
        -drawHeight / 2 + position.y * scaleFactor,
        drawWidth,
        drawHeight
      );
      ctx.restore();

      // Convert to WebP blob
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            setErrorMessage('Không thể trích xuất tệp ảnh. Vui lòng thử lại.');
            setIsUploading(false);
            return;
          }

          try {
            const serverUrl = await menuApi.uploadImage(blob, 'menu');
            if (!serverUrl) {
              throw new Error('Máy chủ không trả về đường dẫn ảnh hợp lệ.');
            }
            onChange(serverUrl);
            setIsCropModalOpen(false);
          } catch (uploadErr: any) {
            console.error('Lỗi khi tải ảnh lên server:', uploadErr);
            const detailed =
              uploadErr.response?.data?.message ||
              uploadErr.response?.data?.title ||
              uploadErr.message ||
              'Không thể kết nối đến máy chủ API. Vui lòng kiểm tra backend và thử lại.';
            setErrorMessage(detailed);
          } finally {
            setIsUploading(false);
          }
        },
        'image/webp',
        0.88
      );
    } catch (err: any) {
      console.error('Lỗi cắt ảnh:', err);
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi xử lý ảnh.');
      setIsUploading(false);
    }
  }, [onChange, position, rotation, zoom]);

  return (
    <div className="space-y-2">
      {/* Header Label and Input Toggle */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-bold text-on-surface dark:text-[#F8F4EE]">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setIsManualUrlMode(!isManualUrlMode)}
          className="text-xs text-primary dark:text-[#E8B98A] hover:underline font-semibold flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">
            {isManualUrlMode ? 'add_photo_alternate' : 'link'}
          </span>
          <span>{isManualUrlMode ? 'Tải từ máy tính' : 'Nhập URL trực tiếp'}</span>
        </button>
      </div>

      {/* Error alert */}
      {errorMessage && !isCropModalOpen && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">error</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Mode A: Manual URL Input */}
      {isManualUrlMode ? (
        <div className="space-y-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
              link
            </span>
            <input
              type="url"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://example.com/hinh-anh-mon.jpg"
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low dark:bg-[#241C18] border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs sm:text-sm text-on-surface dark:text-[#F8F4EE] placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {value && (
            <div className="flex items-center gap-3 p-2.5 bg-surface-container-lowest dark:bg-[#140F0D] rounded-xl border border-outline-variant/15 dark:border-white/5">
              <img
                src={resolveDisplayUrl(value)}
                alt="Preview"
                className="w-14 h-14 rounded-lg object-cover border border-outline-variant/20"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=Error';
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-on-surface dark:text-[#F8F4EE] truncate">Xem trước ảnh</p>
                <p className="text-[11px] text-on-surface-variant dark:text-[#A4968C] truncate">{value}</p>
              </div>
              <button
                type="button"
                onClick={() => onChange('')}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
                title="Gỡ ảnh"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Mode B: Visual Upload & Crop */
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />

          {value ? (
            /* Current Image Selected Display */
            <div className="flex items-center gap-4 p-3 bg-surface-container-lowest dark:bg-[#140F0D] rounded-2xl border border-outline-variant/20 dark:border-white/10">
              <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border border-outline-variant/30 dark:border-white/10 shadow-sm bg-surface-container-low">
                <img
                  src={resolveDisplayUrl(value)}
                  alt="Ảnh món"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Image';
                  }}
                />
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    Đã tải ảnh
                  </span>
                  <span className="text-[11px] text-on-surface-variant dark:text-[#A4968C]">Chuẩn vuông 1:1</span>
                </div>
                <p className="text-xs text-on-surface dark:text-[#F8F4EE] font-medium truncate">
                  {value.startsWith('/uploads') ? 'Ảnh lưu trên máy chủ' : value}
                </p>

                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 dark:bg-primary/20 text-primary dark:text-[#E8B98A] hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white rounded-xl text-xs font-bold transition-all active:scale-95 border border-primary/20"
                  >
                    <span className="material-symbols-outlined text-sm">photo_camera</span>
                    <span>Đổi ảnh khác</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl text-xs font-bold transition"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State: Friendly Upload Dropzone */
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const dataTransfer = new DataTransfer();
                  dataTransfer.items.add(file);
                  if (fileInputRef.current) {
                    fileInputRef.current.files = dataTransfer.files;
                    handleFileChange({ target: fileInputRef.current } as any);
                  }
                }
              }}
              className="group cursor-pointer border-2 border-dashed border-outline-variant/50 dark:border-white/15 hover:border-primary dark:hover:border-[#E8B98A] rounded-2xl p-6 text-center bg-surface-container-lowest/60 dark:bg-[#140F0D]/60 hover:bg-surface-container-low dark:hover:bg-[#1E1714] transition-all"
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 dark:bg-white/5 flex items-center justify-center text-primary dark:text-[#E8B98A] group-hover:scale-110 transition-transform mb-3">
                <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
              </div>
              <p className="text-sm font-bold text-on-surface dark:text-[#F8F4EE] mb-1">
                Nhấn để tải ảnh món lên từ máy
              </p>
              <p className="text-xs text-on-surface-variant dark:text-[#A4968C]">
                Hỗ trợ định dạng JPG, PNG, WEBP (tối đa 5MB)
              </p>
            </div>
          )}
        </div>
      )}

      {/* SIMPLIFIED 1:1 CROP MODAL */}
      {isCropModalOpen && imageSrc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface dark:bg-[#1E1714] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/30 dark:border-white/10 flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary dark:text-[#E8B98A] text-xl">crop</span>
                <h3 className="font-title-sm font-black text-on-surface dark:text-[#F8F4EE]">
                  Căn Chỉnh Ảnh Món
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCropModalOpen(false)}
                disabled={isUploading}
                className="p-1.5 text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-container dark:hover:bg-white/10 rounded-xl transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Error banner inside modal */}
            {errorMessage && (
              <div className="px-5 py-2.5 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            {/* Crop Canvas Viewport */}
            <div className="p-5 flex flex-col items-center select-none bg-surface-container-lowest/50 dark:bg-[#140F0D]">
              <p className="text-xs text-on-surface-variant dark:text-[#A4968C] mb-3 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">pan_tool</span>
                Kéo ảnh để căn vị trí đẹp nhất
              </p>

              {/* Fixed 280x280 Square Frame */}
              <div
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUp}
                className="relative w-[280px] h-[280px] rounded-2xl overflow-hidden border-2 border-primary dark:border-[#E8B98A] shadow-xl cursor-move bg-black flex items-center justify-center"
              >
                {/* 3x3 Grid Overlay */}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 z-10 opacity-30 border border-white/20">
                  <div className="border-r border-b border-white/30" />
                  <div className="border-r border-b border-white/30" />
                  <div className="border-b border-white/30" />
                  <div className="border-r border-b border-white/30" />
                  <div className="border-r border-b border-white/30" />
                  <div className="border-b border-white/30" />
                  <div className="border-r border-white/30" />
                  <div className="border-r border-white/30" />
                  <div />
                </div>

                {/* Transformed Image */}
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Crop Target"
                  draggable={false}
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    maxWidth: 'none',
                    maxHeight: 'none',
                  }}
                  className="pointer-events-none select-none max-w-none"
                />
              </div>
            </div>

            {/* Simplified Controls */}
            <div className="px-5 py-3.5 space-y-3 bg-surface dark:bg-[#1E1714]">
              {/* Zoom control */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(0.8, prev - 0.1))}
                  className="w-8 h-8 rounded-xl bg-surface-container dark:bg-white/5 hover:bg-surface-container-high dark:hover:bg-white/10 text-on-surface dark:text-[#F8F4EE] flex items-center justify-center text-sm font-bold transition"
                  title="Thu nhỏ"
                >
                  <span className="material-symbols-outlined text-base">remove</span>
                </button>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="range"
                    min="0.8"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full accent-primary h-2 bg-surface-container-high dark:bg-white/10 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-on-surface-variant dark:text-[#A4968C] w-10 text-right">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
                  className="w-8 h-8 rounded-xl bg-surface-container dark:bg-white/5 hover:bg-surface-container-high dark:hover:bg-white/10 text-on-surface dark:text-[#F8F4EE] flex items-center justify-center text-sm font-bold transition"
                  title="Phóng to"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                </button>
              </div>

              {/* Action buttons: Rotate & Reset */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container dark:bg-white/5 hover:bg-surface-container-high dark:hover:bg-white/10 text-xs font-bold text-on-surface dark:text-[#F8F4EE] transition active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">rotate_right</span>
                  <span>Xoay 90°</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                    setPosition({ x: 0, y: 0 });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container dark:bg-white/5 hover:bg-surface-container-high dark:hover:bg-white/10 text-xs font-bold text-on-surface-variant dark:text-[#A4968C] transition active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                  <span>Căn giữa</span>
                </button>

                <span className="text-[11px] text-on-surface-variant dark:text-[#A4968C]">
                  Chuẩn 600×600 WebP
                </span>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-outline-variant/20 dark:border-white/10 bg-surface-container-lowest dark:bg-[#140F0D]">
              <button
                type="button"
                onClick={() => setIsCropModalOpen(false)}
                disabled={isUploading}
                className="px-4 py-2 border border-outline-variant/30 dark:border-white/10 rounded-xl text-xs font-bold text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-container dark:hover:bg-white/5 transition disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleCropAndSave}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                    <span>Đang lưu ảnh...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">check</span>
                    <span>Dùng Ảnh Này</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
