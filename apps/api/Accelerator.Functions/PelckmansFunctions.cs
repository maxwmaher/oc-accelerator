using Accelerator.Pelckmans;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace Accelerator.Functions;
public sealed class PelckmansFunctions(IOfferStore store, PelckmansAuth auth, PelckmansPublisher publisher) {
    [Function("PelckmansCapabilities")]
    public async Task<IActionResult> Capabilities([HttpTrigger(AuthorizationLevel.Anonymous,"get",Route="pelckmans/capabilities")] HttpRequest req,CancellationToken ct) { try { var a=await auth.Authenticate(req,ct); return new OkObjectResult(a); } catch(Exception e){ return Error(e); } }
    [Function("PelckmansOffers")]
    public async Task<IActionResult> Offers([HttpTrigger(AuthorizationLevel.Anonymous,"get",Route="pelckmans/offers")] HttpRequest req,CancellationToken ct) { try { var a=await auth.Authenticate(req,ct); var all=await store.List(ct); return new OkObjectResult(all.Where(x=>a.Approver||string.Equals(x.Offer.Owner,a.Username,StringComparison.OrdinalIgnoreCase))); } catch(Exception e){ return Error(e); } }
    [Function("PelckmansOffer")]
    public async Task<IActionResult> Offer([HttpTrigger(AuthorizationLevel.Anonymous,"get",Route="pelckmans/offers/{id}")] HttpRequest req,string id,CancellationToken ct) { try { var a=await auth.Authenticate(req,ct); var d=await store.Get(id,ct); if(d is null)return new NotFoundResult(); if(!a.Approver&&!string.Equals(d.Offer.Owner,a.Username,StringComparison.OrdinalIgnoreCase))return new ForbidResult(); return new OkObjectResult(d); } catch(Exception e){ return Error(e); } }
    [Function("PelckmansCreate")]
    public async Task<IActionResult> Create([HttpTrigger(AuthorizationLevel.Anonymous,"post",Route="pelckmans/offers")] HttpRequest req,[Microsoft.Azure.Functions.Worker.Http.FromBody] CreateOffer body,CancellationToken ct) { try { var a=await auth.Authenticate(req,ct); if(!a.Editor)return new ForbidResult(); var id=$"PEL_STUDIO_{Guid.NewGuid():N}".ToUpperInvariant(); var o=new PelckmansOffer{Id=id,Name=body.Name.Trim(),Type=body.Type,Owner=a.Username,Components=body.Components??[],Rule=body.Rule,History=[new(DateTimeOffset.UtcNow,a.Username,"Created")]}; return new CreatedResult($"/api/pelckmans/offers/{id}",await store.Put(o,null,ct)); } catch(Exception e){ return Error(e); } }
    [Function("PelckmansPreview")]
    public async Task<IActionResult> Preview([HttpTrigger(AuthorizationLevel.Anonymous,"post",Route="pelckmans/offers/{id}/preview")] HttpRequest req,string id,CancellationToken ct) { try { var (d,_)=await Owned(req,id,ct); return new OkObjectResult(OfferEngine.Preview(d.Offer)); } catch(Exception e){ return Error(e); } }
    [Function("PelckmansAction")]
    public async Task<IActionResult> Action([HttpTrigger(AuthorizationLevel.Anonymous,"post",Route="pelckmans/offers/{id}/{action}")] HttpRequest req,string id,string action,[Microsoft.Azure.Functions.Worker.Http.FromBody] OfferAction? body,CancellationToken ct) { try { var (d,a)=await Owned(req,id,ct,false); PelckmansOffer next=action.ToLowerInvariant() switch { "submit"=>OfferWorkflow.Submit(d.Offer,a), "approve"=>OfferWorkflow.Approve(d.Offer,a), "reject"=>OfferWorkflow.Reject(d.Offer,a,body?.Comment??""), "publish"=>await Publish(d.Offer,a,ct), _=>throw new ArgumentException("Unknown action") }; return new OkObjectResult(await store.Put(next,body?.ETag??d.ETag,ct)); } catch(Exception e){ return Error(e); } }
    async Task<PelckmansOffer> Publish(PelckmansOffer o,WorkspaceActor a,CancellationToken ct) { OfferWorkflow.CanPublish(o,a); try { var refs=await publisher.Publish(o,ct); return o with{Status=OfferStatus.Published,PublishedResources=refs,PublicationError=null,History=o.History.Append(new(DateTimeOffset.UtcNow,a.Username,"Published",Revision:o.Revision)).ToList()}; } catch(Exception e){ return o with{Status=OfferStatus.PublishFailed,PublicationError=e.Message,History=o.History.Append(new AuditEntry(DateTimeOffset.UtcNow,a.Username,"Publication failed",e.Message,o.Revision)).ToList()}; } }
    async Task<(StoreDocument,WorkspaceActor)> Owned(HttpRequest req,string id,CancellationToken ct,bool ownerOnly=true) { var a=await auth.Authenticate(req,ct); var d=await store.Get(id,ct)??throw new KeyNotFoundException(); if(ownerOnly&&!a.Approver&&!string.Equals(d.Offer.Owner,a.Username,StringComparison.OrdinalIgnoreCase))throw new UnauthorizedAccessException(); return(d,a); }
    static IActionResult Error(Exception e)=>e switch { UnauthorizedAccessException _=>new ObjectResult(new{error=e.Message}){StatusCode=403},ArgumentException _=>new BadRequestObjectResult(new{error=e.Message}),KeyNotFoundException _=>new NotFoundResult(),_=>new ObjectResult(new{error="The operation could not be completed."}){StatusCode=500} };
}
public record CreateOffer(string Name,OfferType Type,IReadOnlyList<OfferComponent>? Components,OfferRule? Rule);
public record OfferAction(string? ETag,string? Comment);
