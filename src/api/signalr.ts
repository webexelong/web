import * as signalR from '@microsoft/signalr';
import { HUB_URL } from './apiClient';
import type { OrderDto } from '../types/apiTypes';

class SignalRService {
  private connection: signalR.HubConnection | null = null;

  public async startConnection(storeId?: number, tableId?: number) {
    // If already connected or connecting, check store group then skip
    if (this.connection) {
      const state = this.connection.state;
      if (state === signalR.HubConnectionState.Connected) {
        if (storeId) {
          try {
            await this.connection.invoke('JoinStoreGroup', storeId);
          } catch {}
        }
        return;
      }
      if (state === signalR.HubConnectionState.Connecting) {
        return;
      }
    }

    const token = localStorage.getItem('token');

    // Build connection with proper configuration
    const hubOptions: signalR.IHttpConnectionOptions = {
      skipNegotiation: false,
      transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents | signalR.HttpTransportType.LongPolling,
    };

    if (token) {
      hubOptions.accessTokenFactory = () => token;
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, hubOptions)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    try {
      await this.connection.start();
      console.log('✅ SignalR connected successfully');

      if (storeId) {
        await this.connection.invoke('JoinStoreGroup', storeId);
        console.log(`✅ Joined store group: ${storeId}`);
      }
      if (tableId) {
        await this.connection.invoke('JoinTableGroup', tableId);
        console.log(`✅ Joined table group: ${tableId}`);
      }
    } catch (err) {
      console.error('❌ SignalR connection error:', err);
      // Don't throw - allow app to continue without realtime
    }
  }

  public onNewOrder(callback: (order: OrderDto) => void) {
    if (this.connection) {
      this.connection.on('NewOrderReceived', callback);
    }
  }

  public offNewOrder(callback?: (...args: any[]) => void) {
    if (this.connection) {
      if (callback) this.connection.off('NewOrderReceived', callback);
      else this.connection.off('NewOrderReceived');
    }
  }

  public onOrderStatusChanged(callback: (orderId: number, status: string, orderCode: string) => void) {
    if (this.connection) {
      this.connection.on('OrderStatusChanged', callback);
    }
  }

  public offOrderStatusChanged(callback?: (...args: any[]) => void) {
    if (this.connection) {
      if (callback) this.connection.off('OrderStatusChanged', callback);
      else this.connection.off('OrderStatusChanged');
    }
  }

  public onTableStatusChanged(callback: (tableId: number, status: string) => void) {
    if (this.connection) {
      this.connection.on('TableStatusChanged', callback);
      this.connection.on('tablestatuschanged', callback);
    }
  }

  public offTableStatusChanged(callback?: (...args: any[]) => void) {
    if (this.connection) {
      if (callback) {
        this.connection.off('TableStatusChanged', callback);
        this.connection.off('tablestatuschanged', callback);
      } else {
        this.connection.off('TableStatusChanged');
        this.connection.off('tablestatuschanged');
      }
    }
  }

  public stopConnection() {
    if (this.connection) {
      this.connection.stop();
      this.connection = null;
    }
  }
}

// Default export
export default new SignalRService();

// Named export
export const signalRService = new SignalRService();
