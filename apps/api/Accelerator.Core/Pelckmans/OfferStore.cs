using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using System.Text.Json;

namespace Accelerator.Pelckmans;
public interface IOfferStore { Task<IReadOnlyList<StoreDocument>> List(CancellationToken ct); Task<StoreDocument?> Get(string id,CancellationToken ct); Task<StoreDocument> Put(PelckmansOffer offer,string? etag,CancellationToken ct); }
public sealed class BlobOfferStore(BlobContainerClient container) : IOfferStore {
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public async Task<IReadOnlyList<StoreDocument>> List(CancellationToken ct) { var result=new List<StoreDocument>(); await foreach(var b in container.GetBlobsAsync(cancellationToken:ct)) { var d=await Get(Path.GetFileNameWithoutExtension(b.Name),ct); if(d!=null) result.Add(d); } return result.OrderByDescending(x=>x.Offer.UpdatedAt).ToList(); }
    public async Task<StoreDocument?> Get(string id,CancellationToken ct) { try { var r=await container.GetBlobClient($"{Safe(id)}.json").DownloadContentAsync(ct); return new(r.Value.Content.ToObjectFromJson<PelckmansOffer>(Json)!,r.Value.Details.ETag.ToString()); } catch(RequestFailedException e) when(e.Status==404){ return null; } }
    public async Task<StoreDocument> Put(PelckmansOffer offer,string? etag,CancellationToken ct) { await container.CreateIfNotExistsAsync(PublicAccessType.None,cancellationToken:ct); var options=new BlobUploadOptions { Conditions=etag is null ? new BlobRequestConditions{IfNoneMatch=ETag.All} : new BlobRequestConditions{IfMatch=new ETag(etag)} }; var r=await container.GetBlobClient($"{Safe(offer.Id)}.json").UploadAsync(BinaryData.FromObjectAsJson(offer,Json),options,ct); return new(offer,r.Value.ETag.ToString()); }
    static string Safe(string id) => id.All(c=>char.IsLetterOrDigit(c)||c is '-' or '_') ? id : throw new ArgumentException("Invalid offer ID");
}
