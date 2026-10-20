namespace WebCafe.Backend.Models.DTOs.AI
{
    public class AiRecommendationRequestDto
    {
        public int StoreId { get; set; }
        public int TenantId { get; set; }
        public int? CustomerId { get; set; }
        public List<int> CurrentCartItemIds { get; set; } = new();
        public string? Occasion { get; set; } // "morning", "afternoon", "evening", "pairing", "all_day"
        public string? MoodOrPreference { get; set; } // "healthy", "sweet", "caffeine", "snack"
    }

    public class AiRecommendationResponseDto
    {
        public bool IsAiGenerated { get; set; } = true;
        public string ModelUsed { get; set; } = "gemini-3.6-flash";
        public string Headline { get; set; } = string.Empty;
        public string ChefNote { get; set; } = string.Empty;
        public List<AiRecommendedItemDto> Recommendations { get; set; } = new();
        public List<AiRecommendedComboDto> Combos { get; set; } = new();
    }

    public class AiRecommendedItemDto
    {
        public int MenuItemId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public decimal Price { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public string? PairingTip { get; set; }
        public string Badge { get; set; } = "AI Gợi ý"; // "Best Match", "Trending", "Chef's Pick", "Perfect Pairing"
        public double ConfidenceScore { get; set; } = 0.95;
        public string? SuggestedSugarLevel { get; set; } = "100%";
        public string? SuggestedIceLevel { get; set; } = "100%";
        public string? SuggestedSize { get; set; } = "Medium";
        public bool IsDrink { get; set; } = true;
    }

    public class AiRecommendedComboDto
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<int> ItemIds { get; set; } = new();
        public List<AiRecommendedItemDto> Items { get; set; } = new();
        public decimal OriginalPrice { get; set; }
        public decimal DiscountedPrice { get; set; }
        public int DiscountPercent { get; set; } = 10;
        public string Tag { get; set; } = "Combo Tiết Kiệm";
    }

    public class AiChatMessageDto
    {
        public string Role { get; set; } = "user"; // "user" hoặc "model"
        public string Content { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class AiChatRequestDto
    {
        public int StoreId { get; set; }
        public int TenantId { get; set; }
        public int? CustomerId { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<AiChatMessageDto> History { get; set; } = new();
        public List<int> CurrentCartItemIds { get; set; } = new();
    }

    public class AiChatResponseDto
    {
        public string Reply { get; set; } = string.Empty;
        public List<AiRecommendedItemDto> SuggestedItems { get; set; } = new();
        public List<string> QuickFollowUps { get; set; } = new();
        public bool IsAiGenerated { get; set; } = true;
        public string ModelUsed { get; set; } = "gemini-3.6-flash";
    }

    public class InventoryAiChatRequestDto
    {
        public int StoreId { get; set; }
        public string Message { get; set; } = string.Empty;
        public int PeriodDays { get; set; } = 30;
        public List<AiChatMessageDto> History { get; set; } = new();
    }

    public class InventoryAiRecommendationDto
    {
        public string IngredientName { get; set; } = string.Empty;
        public decimal SuggestedQuantity { get; set; }
        public string Unit { get; set; } = string.Empty;
        public string Priority { get; set; } = "medium";
        public string Reason { get; set; } = string.Empty;
    }

    public class InventoryAiChatResponseDto
    {
        public string Reply { get; set; } = string.Empty;
        public List<InventoryAiRecommendationDto> Recommendations { get; set; } = new();
        public List<string> QuickFollowUps { get; set; } = new();
        public bool IsAiGenerated { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public int PeriodDays { get; set; }
        public List<InventoryAiTopProductDto> TopSellingItems { get; set; } = new();
    }

    public class InventoryAiTopProductDto
    {
        public int MenuItemId { get; set; }
        public string MenuItemName { get; set; } = string.Empty;
        public int SoldQuantity { get; set; }
    }
}
