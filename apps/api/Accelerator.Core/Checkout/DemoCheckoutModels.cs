#nullable enable

using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Accelerator.Checkout;

public sealed record DemoPaymentRequest(string Outcome, decimal Amount, string Currency);

public sealed record DemoPaymentResponse(string Status, string? PaymentID, decimal Amount, string Currency,
    IReadOnlyList<string>? Errors = null);

public sealed record DemoOrderStatusResponse(string Status, string OrderID);

public sealed record PreWebhookBody(
    [property: JsonPropertyName("message")] string Message,
    [property: JsonPropertyName("errors")] IReadOnlyList<string>? Errors = null);

public sealed record PreWebhookResponse(
    [property: JsonPropertyName("proceed")] bool Proceed,
    [property: JsonPropertyName("body")] PreWebhookBody? Body = null);

public sealed class DemoCheckoutOptions
{
    public bool Enabled { get; set; }
    public string MarketplaceID { get; set; } = string.Empty;
    public string HashKey { get; set; } = string.Empty;
    public string[] StorefrontClientIDs { get; set; } = Array.Empty<string>();
    public string MiddlewareClientID { get; set; } = string.Empty;
    public string MiddlewareClientSecret { get; set; } = string.Empty;
}
