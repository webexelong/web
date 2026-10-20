using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Models.DTOs.Order;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Hubs
{
    public interface IOrderHubClient
    {
        Task NewOrderReceived(OrderDto order);
        Task OrderStatusChanged(int orderId, string status, string orderCode);
        Task TableStatusChanged(int tableId, string status);
        Task OrderReady(int orderId, string orderCode, string message);
    }

    public class OrderHub : Hub<IOrderHubClient>
    {
        private readonly ITenantAccessService _tenantAccess;

        public OrderHub(ITenantAccessService tenantAccess)
        {
            _tenantAccess = tenantAccess;
        }

        [Authorize(Policy = AppPolicies.StaffAccess)]
        public async Task JoinStoreGroup(int storeId)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            await Groups.AddToGroupAsync(Context.ConnectionId, $"store_{storeId}");
        }

        [Authorize(Policy = AppPolicies.StaffAccess)]
        public async Task LeaveStoreGroup(int storeId)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"store_{storeId}");
        }

        [Authorize(Policy = AppPolicies.StaffAccess)]
        public async Task JoinTableGroup(int tableId)
        {
            await _tenantAccess.EnsureTableAccessAsync(tableId);
            await Groups.AddToGroupAsync(Context.ConnectionId, $"table_{tableId}");
        }

        // Allow guests to join order group for tracking (no authorization required for guests)
        [AllowAnonymous]
        public async Task JoinOrderGroup(int orderId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"order_{orderId}");
        }

        [AllowAnonymous]
        public async Task LeaveOrderGroup(int orderId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order_{orderId}");
        }
    }

    public interface IOrderNotificationService
    {
        Task NotifyNewOrderAsync(int storeId, OrderDto order);
        Task NotifyOrderStatusChangedAsync(int storeId, int? tableId, int orderId, string status, string orderCode);
        Task NotifyTableStatusChangedAsync(int storeId, int tableId, string status);
        Task NotifyOrderReadyAsync(int orderId, string orderCode, string tableNumber);
    }

    public class OrderNotificationService : IOrderNotificationService
    {
        private readonly IHubContext<OrderHub, IOrderHubClient> _hubContext;

        public OrderNotificationService(IHubContext<OrderHub, IOrderHubClient> hubContext)
        {
            _hubContext = hubContext;
        }

        public async Task NotifyNewOrderAsync(int storeId, OrderDto order)
        {
            await _hubContext.Clients.Group($"store_{storeId}").NewOrderReceived(order);
        }

        public async Task NotifyOrderStatusChangedAsync(int storeId, int? tableId, int orderId, string status, string orderCode)
        {
            await _hubContext.Clients.Group($"store_{storeId}").OrderStatusChanged(orderId, status, orderCode);
            if (tableId.HasValue)
            {
                await _hubContext.Clients.Group($"table_{tableId.Value}").OrderStatusChanged(orderId, status, orderCode);
            }

            // Notify guests when order is ready
            if (status == "ready")
            {
                var message = $"Đơn hàng #{orderCode} của bạn đã sẵn sàng! Mời bạn đến quầy lấy món.";
                await _hubContext.Clients.Group($"order_{orderId}").OrderReady(orderId, orderCode, message);
            }
        }

        public async Task NotifyTableStatusChangedAsync(int storeId, int tableId, string status)
        {
            await _hubContext.Clients.Group($"store_{storeId}").TableStatusChanged(tableId, status);
        }

        public async Task NotifyOrderReadyAsync(int orderId, string orderCode, string tableNumber)
        {
            var message = $"Đơn hàng #{orderCode} tại {tableNumber} đã sẵn sàng!";
            await _hubContext.Clients.Group($"order_{orderId}").OrderReady(orderId, orderCode, message);
        }
    }
}
