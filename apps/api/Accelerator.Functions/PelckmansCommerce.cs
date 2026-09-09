using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Accelerator.Pelckmans;
using Microsoft.Extensions.Configuration;

namespace Accelerator.Functions;

/// <summary>A deliberately small, typed REST adapter for OrderCloud operations not exposed consistently by the pinned SDK.</summary>
public sealed class PelckmansCommerce(IHttpClientFactory clients, IConfiguration config) {
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    readonly string api=(config["OrderCloudSettings:ApiUrl"] ?? "").TrimEnd('/');

    public async Task<CatalogPage> Discover(string? search,int page,int pageSize,CancellationToken ct) {
        page=Math.Max(1,page); pageSize=Math.Clamp(pageSize,1,50);
        var token=await ShopperToken(ct);
        var query=$"page={page}&pageSize={pageSize}&search={Uri.EscapeDataString(search??"")}&searchOn=ID,Name,Description";
        using var doc=await Send(HttpMethod.Get,$"/v1/me/products?{query}",token,null,ct);
        var root=doc.RootElement; var list=new List<CatalogItem>();
        foreach(var p in Array(root,"Items")) {
            var xp=Property(p,"xp"); var entity=String(xp,"EntityType") ?? "Product";
            var studio=Property(xp,"PelckmansStudio");
            if(Bool(p,"IsBundle") || entity.Contains("Bundle",StringComparison.OrdinalIgnoreCase) || studio.ValueKind==JsonValueKind.Object) continue;
            var price=Decimal(p,"Price");
            if(price is null) price=Decimal(Property(p,"PriceSchedule"),"PriceBreaks",0,"Price");
            var source=Property(xp,"Source"); var enrichment=Property(xp,"Enrichment");
            list.Add(new(String(p,"ID")??"",String(p,"Name")??String(enrichment,"Title")??String(source,"Title")??String(p,"ID")??"",entity,price,
                String(enrichment,"CoverImageUrl")??String(source,"CoverImageUrl")??String(p,"DefaultSupplierID"),
                Strings(Property(Property(xp,"Relationships"),"AuthorIDs")),Strings(Property(Property(xp,"Relationships"),"GenreIDs")),String(Property(xp,"Commerce"),"Status")));
        }
        var authors=Facets(list.SelectMany(x=>x.AuthorIds)); var genres=Facets(list.SelectMany(x=>x.GenreIds));
        var meta=Property(root,"Meta");
        return new(list,authors,genres,Int(meta,"Page")??page,Int(meta,"PageSize")??pageSize,Int(meta,"TotalCount")??list.Count,Int(meta,"TotalPages")??1);
    }

    public async Task<IReadOnlyDictionary<string,string>> Publish(PelckmansOffer offer,CancellationToken ct) {
        OfferEngine.ValidateComplete(offer); var token=await ServiceToken(ct); var refs=new Dictionary<string,string>();
        if(offer.Type==OfferType.Bundle) {
            var bundle=Id(offer.Id,"BUNDLE");
            await Put($"/v1/products/{bundle}",token,new { ID=bundle, Name=offer.Name, Active=false, IsBundle=true, xp=new { PelckmansStudio=new { ParentOfferID=offer.Id, Revision=offer.Revision, ResourceType="Bundle" } } },ct); refs["bundle"]=bundle;
            foreach(var c in offer.Components) {
                var allocation=Id(offer.Id,"COMP",c.ProductId);
                await Put($"/v1/products/{allocation}",token,new { ID=allocation, Name=c.Title??c.ProductId, Active=true, xp=new { PelckmansStudio=new { ParentOfferID=offer.Id, SourceProductID=c.ProductId, DemoAllocation=true } } },ct);
                var schedule=Id(offer.Id,"PS",c.ProductId); var bundlePrice=c.IncludedFree?0:c.UnitPrice;
                await Put($"/v1/priceschedules/{schedule}",token,new { ID=schedule, Name=$"{offer.Name}: {c.Title}", ApplyTax=false, ApplyShipping=false, PriceBreaks=new[]{new { Quantity=1, Price=bundlePrice }}, xp=new { PelckmansStudio=new { ParentOfferID=offer.Id, SourceProductID=c.ProductId } } },ct);
                await Put($"/v1/products/{allocation}/priceschedules/{schedule}",token,new{},ct);
                await Put($"/v1/bundles/{bundle}/components/{allocation}",token,new { ProductID=allocation, Quantity=c.Quantity, Required=c.Required, BundlePrice=bundlePrice },ct);
                refs[$"component:{c.ProductId}"]=allocation; refs[$"price:{c.ProductId}"]=schedule;
            }
            await Patch($"/v1/products/{bundle}",token,new { Active=true },ct);
        } else {
            var promotion=Id(offer.Id,"PROMO"); var (eligible,value)=OfferEngine.CompilePromotion(offer);
            await Put($"/v1/promotions/{promotion}",token,new { ID=promotion, Name=offer.Name, Active=true, AutoApply=true, CanCombine=false, LineItemLevel=true, Priority=offer.Type==OfferType.BuyThreePayTwo?100:110, QuantityLimitPerOrder=offer.Type==OfferType.BuyThreePayTwo?1:(int?)null, EligibleItemSort=offer.Type==OfferType.BuyThreePayTwo?"UnitPrice":null, EligibleExpression=eligible, ValueExpression=value, xp=new { PelckmansStudio=new { ParentOfferID=offer.Id, Revision=offer.Revision, EligibilitySnapshot=offer.Rule!.ProductIds } } },ct);
            var buyer=Required("Pelckmans:BuyerID"); await Put($"/v1/promotions/{promotion}/assignments/{buyer}",token,new { PromotionID=promotion, BuyerID=buyer },ct); refs["promotion"]=promotion;
        }
        return refs;
    }

    public async Task<VerificationResult> Verify(PelckmansOffer offer,IReadOnlyList<OfferComponent>? basket,CancellationToken ct) {
        if(offer.Status!=OfferStatus.Published) throw new ArgumentException("Only a published offer can be verified.");
        var token=await ShopperToken(ct); var order=Id(offer.Id,"VERIFY",Guid.NewGuid().ToString("N")[..8]);
        await Post("/v1/me/orders/Outgoing",token,new { ID=order, xp=new { PelckmansStudio=new { ParentOfferID=offer.Id, DisposableTestOrder=true } } },ct);
        if(offer.Type==OfferType.Bundle) await Post($"/v1/me/orders/Outgoing/{order}/bundles/{offer.PublishedResources["bundle"]}",token,new { Quantity=1 },ct);
        else foreach(var x in basket??offer.Components) await Post($"/v1/me/orders/Outgoing/{order}/lineitems",token,new { ProductID=x.ProductId, Quantity=x.Quantity },ct);
        await Post($"/v1/me/orders/Outgoing/{order}/promotions",token,new{},ct);
        using var o=await Send(HttpMethod.Get,$"/v1/me/orders/Outgoing/{order}",token,null,ct);
        using var li=await Send(HttpMethod.Get,$"/v1/me/orders/Outgoing/{order}/lineitems?pageSize=100",token,null,ct);
        var lines=Array(li.RootElement,"Items").Select(x=>new VerificationLine(String(x,"ProductID")??"",String(Property(x,"Product"),"Name")??String(x,"ProductID")??"",Int(x,"Quantity")??0,Decimal(x,"UnitPrice")??0,Decimal(x,"LineTotal")??0,false,Decimal(x,"PromotionDiscount")??0)).ToList();
        var expected=OfferEngine.Preview(offer,basket); var actualDiscount=Decimal(o.RootElement,"PromotionDiscount")??lines.Sum(x=>x.Discount);
        var discrepancies=new List<string>(); if(Math.Abs(actualDiscount-expected.Discount)>.01m) discrepancies.Add($"Expected {expected.Discount.ToString("0.00",CultureInfo.InvariantCulture)} EUR discount; OrderCloud returned {actualDiscount.ToString("0.00",CultureInfo.InvariantCulture)} EUR.");
        var promotions=Strings(Property(o.RootElement,"AppliedPromotions"));
        return new(order,lines,Decimal(o.RootElement,"Subtotal")??lines.Sum(x=>x.LineTotal),actualDiscount,Decimal(o.RootElement,"Total")??lines.Sum(x=>x.LineTotal)-actualDiscount,promotions,discrepancies,offer.PublishedResources.ToDictionary(x=>x.Key,x=>x.Value).Append(new KeyValuePair<string,string>("testOrder",order)).ToDictionary(x=>x.Key,x=>x.Value));
    }

    async Task<string> ServiceToken(CancellationToken ct)=>await Token(Required("OrderCloudSettings:MiddlewareClientID"),Required("OrderCloudSettings:MiddlewareClientSecret"),null,null,ct);
    async Task<string> ShopperToken(CancellationToken ct)=>await Token(Required("Pelckmans:StorefrontClientID"),null,Required("Pelckmans:TestShopperUsername"),Required("Pelckmans:TestShopperPassword"),ct);
    async Task<string> Token(string client,string? secret,string? username,string? password,CancellationToken ct) {
        if(string.IsNullOrWhiteSpace(api)) throw new InvalidOperationException("OrderCloudSettings:ApiUrl is required.");
        var fields=username is null ? new Dictionary<string,string>{{"grant_type","client_credentials"},{"client_id",client},{"client_secret",secret!},{"scope","FullAccess"}} : new(){{"grant_type","password"},{"client_id",client},{"username",username},{"password",password!},{"buyer_id",Required("Pelckmans:BuyerID")},{"scope","Shopper"}};
        using var req=new HttpRequestMessage(HttpMethod.Post,$"{api}/oauth/token"){Content=new FormUrlEncodedContent(fields)}; using var res=await clients.CreateClient().SendAsync(req,ct); await Ensure(res,"authenticate"); using var d=JsonDocument.Parse(await res.Content.ReadAsStreamAsync(ct)); return String(d.RootElement,"access_token")??throw new InvalidOperationException("OrderCloud authentication returned no access token.");
    }
    Task Put(string path,string token,object body,CancellationToken ct)=>Write(HttpMethod.Put,path,token,body,ct); Task Patch(string path,string token,object body,CancellationToken ct)=>Write(HttpMethod.Patch,path,token,body,ct); Task Post(string path,string token,object body,CancellationToken ct)=>Write(HttpMethod.Post,path,token,body,ct);
    async Task Write(HttpMethod method,string path,string token,object body,CancellationToken ct){using var _=await Send(method,path,token,body,ct);}
    async Task<JsonDocument> Send(HttpMethod method,string path,string token,object? body,CancellationToken ct){using var req=new HttpRequestMessage(method,$"{api}{path}");req.Headers.Authorization=new("Bearer",token);if(body is not null)req.Content=new StringContent(JsonSerializer.Serialize(body,Json),Encoding.UTF8,"application/json");using var res=await clients.CreateClient().SendAsync(req,ct);await Ensure(res,path);var content=await res.Content.ReadAsStringAsync(ct);return JsonDocument.Parse(string.IsNullOrWhiteSpace(content)?"{}":content);}
    static async Task Ensure(HttpResponseMessage response,string operation){if(response.IsSuccessStatusCode)return;var correlation=response.Headers.TryGetValues("x-oc-correlation-id",out var v)?v.FirstOrDefault():null;var detail=await response.Content.ReadAsStringAsync();if(detail.Length>500)detail=detail[..500];throw new InvalidOperationException($"OrderCloud could not {operation} ({(int)response.StatusCode}; correlation {correlation??"not supplied"}): {detail}");}
    string Required(string key)=>config[key] is {Length:>0} value?value:throw new InvalidOperationException($"Server setting {key} is required.");
    static string Id(params string[] values){var value=string.Join('_',values).ToUpperInvariant().Replace("-","");return value[..Math.Min(100,value.Length)];}
    static JsonElement Property(JsonElement e,string name)=>e.ValueKind==JsonValueKind.Object&&e.TryGetProperty(name,out var v)?v:default;
    static string? String(JsonElement e,string name)=>Property(e,name).ValueKind==JsonValueKind.String?Property(e,name).GetString():null;
    static bool Bool(JsonElement e,string name)=>Property(e,name).ValueKind==JsonValueKind.True;
    static int? Int(JsonElement e,string name)=>Property(e,name).TryGetInt32(out var x)?x:null;
    static decimal? Decimal(JsonElement e,string name)=>Property(e,name).TryGetDecimal(out var x)?x:null;
    static decimal? Decimal(JsonElement e,string array,int index,string name){var a=Property(e,array);return a.ValueKind==JsonValueKind.Array&&a.GetArrayLength()>index?Decimal(a[index],name):null;}
    static IEnumerable<JsonElement> Array(JsonElement e,string name){var a=Property(e,name);return a.ValueKind==JsonValueKind.Array?a.EnumerateArray():[];}
    static IReadOnlyList<string> Strings(JsonElement e)=>e.ValueKind==JsonValueKind.Array?e.EnumerateArray().Select(x=>x.ValueKind==JsonValueKind.String?x.GetString():String(x,"ID")).Where(x=>x is not null).Cast<string>().ToList():[];
    static IReadOnlyList<CatalogFacet> Facets(IEnumerable<string> ids)=>ids.GroupBy(x=>x,StringComparer.OrdinalIgnoreCase).Select(x=>new CatalogFacet(x.Key,x.Key,x.Count())).OrderBy(x=>x.Name).ToList();
}
