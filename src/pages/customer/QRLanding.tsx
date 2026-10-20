import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { tableApi } from '../../api/apis';
import { Coffee, CheckCircle2, Loader2 } from 'lucide-react';

export default function QRLanding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const { initGuestSession, fetchMenu } = useStore();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectedInfo, setConnectedInfo] = useState<{ storeName?: string; tableNumber?: string } | null>(null);

  useEffect(() => {
    const processQRCode = async () => {
      try {
        // New QR format: /qr/{qrToken}. Legacy routes remain supported temporarily.
        let storeId: number;
        let tableId: number;
        let tableNumber: string;
        let storeName: string | undefined;
        let tableToken: string | undefined;

        if (params.qrToken) {
          const resolved = await tableApi.resolveQr(params.qrToken);
          if (!resolved) throw new Error('QR không hợp lệ');
          storeId = resolved.storeId;
          tableId = resolved.tableId;
          tableNumber = resolved.tableNumber;
          storeName = resolved.storeName;
          tableToken = resolved.qrToken || params.qrToken;
        } else if (params.storeId && params.tableId) {
          // Path params: /table/:storeId/:tableId
          const resolved = await tableApi.resolveLegacyQr(parseInt(params.storeId), parseInt(params.tableId));
          if (!resolved) throw new Error('QR không hợp lệ');
          storeId = resolved.storeId;
          tableId = resolved.tableId;
          tableNumber = resolved.tableNumber;
          storeName = resolved.storeName;
          tableToken = resolved.qrToken;
        } else {
          // Query params: /qr?store=1&table=5
          const storeParam = searchParams.get('store');
          const tableParam = searchParams.get('table');

          if (!storeParam || !tableParam) {
            setError('Mã QR không hợp lệ. Vui lòng quét lại mã QR tại bàn.');
            setIsProcessing(false);
            return;
          }

          const storeIdFromQr = Number.parseInt(storeParam, 10);
          if (!Number.isInteger(storeIdFromQr) || storeIdFromQr <= 0) throw new Error('QR không hợp lệ');
          const resolved = await tableApi.resolveLegacyByNumber(storeIdFromQr, tableParam);
          if (!resolved) throw new Error('QR không hợp lệ');
          storeId = resolved.storeId;
          tableId = resolved.tableId;
          tableNumber = resolved.tableNumber;
          storeName = resolved.storeName;
          tableToken = resolved.qrToken;
        }

        if (isNaN(storeId) || isNaN(tableId)) {
          setError('Thông tin bàn hoặc quán không hợp lệ.');
          setIsProcessing(false);
          return;
        }

        if (!Number.isInteger(storeId) || storeId <= 0 || !tableId) {
          throw new Error('QR không hợp lệ');
        }

        // Initialize guest session with both tableId (number) and tableNumber (display string)
        initGuestSession(storeId, tableId, tableNumber, storeName, tableToken);
        setConnectedInfo({ storeName, tableNumber });

        // Fetch menu for this store
        await fetchMenu(storeId);

        // Success animation then redirect
        setTimeout(() => {
          navigate('/menu');
        }, 1500);
      } catch (err) {
        console.error('QR processing error:', err);
        setError('Có lỗi xảy ra khi nhận diện mã bàn. Vui lòng thử lại.');
        setIsProcessing(false);
      }
    };

    processQRCode();
  }, [searchParams, params, initGuestSession, fetchMenu, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '3rem 2rem',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          boxShadow: '0 10px 30px rgba(139, 92, 246, 0.4)',
        }}>
          {isProcessing ? (
            <Loader2 size={40} color="white" className="animate-spin" />
          ) : error ? (
            <Coffee size={40} color="white" />
          ) : (
            <CheckCircle2 size={40} color="white" />
          )}
        </div>

        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 'bold',
          color: 'var(--text-primary)',
          marginBottom: '0.75rem',
        }}>
          {isProcessing ? 'Đang kết nối...' : error ? 'Oops!' : `Bàn ${connectedInfo?.tableNumber || ''}`}
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '0.95rem',
          lineHeight: '1.6',
          marginBottom: '2rem',
        }}>
          {isProcessing ? (
            <>Vui lòng đợi trong giây lát<br />Chúng tôi đang chuẩn bị thực đơn cho bạn...</>
          ) : error ? (
            error
          ) : (
            <>
              Bạn đã kết nối thành công tới <strong>Bàn {connectedInfo?.tableNumber}</strong>{connectedInfo?.storeName ? ` (${connectedInfo.storeName})` : ''}!<br />
              Đang chuyển đến thực đơn...
            </>
          )}
        </p>

        {error && (
          <button
            onClick={() => navigate('/menu')}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.875rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              borderRadius: '12px',
            }}
          >
            Xem Thực Đơn
          </button>
        )}

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </div>
    </div>
  );
}
