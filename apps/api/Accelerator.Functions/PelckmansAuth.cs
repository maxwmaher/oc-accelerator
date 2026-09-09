using System.Net.Http.Headers;
using System.Text.Json;
using Accelerator.Pelckmans;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace Accelerator.Functions;
public sealed class PelckmansAuth(IHttpClientFactory clients, IConfiguration config) {
    public async Task<WorkspaceActor> Authenticate(HttpRequest req, CancellationToken ct) {
        var token=req.Headers.Authorization.ToString();
        if(!token.StartsWith("Bearer ",StringComparison.OrdinalIgnoreCase)) throw new UnauthorizedAccessException("A bearer token is required.");
        using var request=new HttpRequestMessage(HttpMethod.Get,$"{config["OrderCloudSettings:ApiUrl"]?.TrimEnd('/')}/v1/me");
        request.Headers.Authorization=AuthenticationHeaderValue.Parse(token);
        using var response=await clients.CreateClient().SendAsync(request,ct);
        if(!response.IsSuccessStatusCode) throw new UnauthorizedAccessException("OrderCloud rejected the access token.");
        using var json=JsonDocument.Parse(await response.Content.ReadAsStreamAsync(ct)); var root=json.RootElement;
        var username=root.GetProperty("Username").GetString() ?? throw new UnauthorizedAccessException();
        var roles=root.TryGetProperty("AvailableRoles",out var value)&&value.ValueKind==JsonValueKind.Array ? value.EnumerateArray().Select(x=>x.GetString()).ToHashSet(StringComparer.OrdinalIgnoreCase) : [];
        return new(username,roles.Contains("PelckmansOfferEditor"),roles.Contains("PelckmansOfferApprover"));
    }
}
