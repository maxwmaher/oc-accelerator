using Accelerator.Pelckmans;

namespace Accelerator.Functions;
// All identifiers and payloads are compiled from the persisted typed offer. The browser cannot proxy commerce writes.
public sealed class PelckmansPublisher(PelckmansCommerce commerce) {
    public Task<IReadOnlyDictionary<string,string>> Publish(PelckmansOffer offer, CancellationToken ct) => commerce.Publish(offer,ct);
    public Task<VerificationResult> Verify(PelckmansOffer offer,IReadOnlyList<OfferComponent>? basket,CancellationToken ct)=>commerce.Verify(offer,basket,ct);
    public Task<CatalogPage> Discover(string? search,int page,int pageSize,CancellationToken ct)=>commerce.Discover(search,page,pageSize,ct);
}
