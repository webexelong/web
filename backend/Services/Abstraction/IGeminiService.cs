using WebCafe.Backend.Models.DTOs.AI;

namespace WebCafe.Backend.Services.Abstraction
{
    public interface IGeminiService
    {
        Task<AiRecommendationResponseDto> GetSmartRecommendationsAsync(AiRecommendationRequestDto request);
        Task<AiChatResponseDto> ChatWithSommelierAsync(AiChatRequestDto request);
        Task<InventoryAiChatResponseDto> ChatWithInventoryAsync(InventoryAiChatRequestDto request);
        Task<InventoryAiChatResponseDto> GetInventorySummaryAsync(int storeId, int periodDays = 30);
    }
}
