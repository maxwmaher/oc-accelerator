using System;
using System.Collections.Generic;

namespace Accelerator.Checkout;

public sealed record DemoPaymentRequest(string Outcome, decimal Amount, string Currency);

public sealed record DemoPaymentResponse(string Status, string? PaymentID, decimal Amount, string Currency,
    IReadOnlyList<string>? Errors = null);

public sealed class DemoCheckoutOptions
{
    public bool Enabled { get; set; }
    public string MarketplaceID { get; set; } = string.Empty;
    public string HashKey { get; set; } = string.Empty;
    public string[] StorefrontClientIDs { get; set; } = Array.Empty<string>();
}
