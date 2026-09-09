using System.Text.Json.Serialization;

namespace Accelerator.Pelckmans;
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OfferType
{
    Bundle,
    BuyThreePayTwo,
    SegmentDiscount
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OfferStatus
{
    Draft,
    PendingApproval,
    Approved,
    Publishing,
    Published,
    PublishFailed
}
public record OfferComponent(string ProductId, int Quantity = 1, bool Required = true, bool IncludedFree = false, decimal UnitPrice = 0, string? Title = null);
public record OfferRule(string SelectorType, string SelectorId, int MinimumQuantity = 3, decimal DiscountPercent = 0, IReadOnlyList<string>? ProductIds = null);
public record AuditEntry(DateTimeOffset At, string Actor, string Action, string? Comment = null, int Revision = 1);
public sealed record PelckmansOffer {
    public int SchemaVersion { get; init; } = 1;
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required OfferType Type { get; init; }
    public OfferStatus Status { get; init; } = OfferStatus.Draft;
    public required string Owner { get; init; }
    public int Revision { get; init; } = 1;
    public int? ApprovedRevision { get; init; }
    public string? Approver { get; init; }
    public IReadOnlyList<OfferComponent> Components { get; init; } = [];
    public OfferRule? Rule { get; init; }
    public IReadOnlyList<AuditEntry> History { get; init; } = [];
    public IReadOnlyDictionary<string,string> PublishedResources { get; init; } = new Dictionary<string,string>();
    public string? PublicationError { get; init; }
    public DateTimeOffset UpdatedAt { get; init; } = DateTimeOffset.UtcNow;
}
public record StoreDocument(PelckmansOffer Offer, string ETag);
public record PreviewLine(string ProductId, string Title, int Quantity, decimal UnitPrice, decimal Discount, bool Qualifies);
public record OfferPreview(IReadOnlyList<PreviewLine> Lines, decimal Subtotal, decimal Discount, decimal Payable, string Label = "Estimated preview");
