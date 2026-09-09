using Accelerator.Pelckmans;

namespace Accelerator.Functions;
// All identifiers and payloads are compiled from the persisted typed offer. The browser cannot proxy commerce writes.
public sealed class PelckmansPublisher {
    public Task<IReadOnlyDictionary<string,string>> Publish(PelckmansOffer offer, CancellationToken ct) {
        // Publication adapter is deliberately strict until a supported OrderCloud SDK implementation is configured.
        // Never report a simulated success or mutate source schedules.
        throw new InvalidOperationException("Native publication requires Pelckmans OrderCloud publication configuration. Run the setup diagnostic before publishing.");
    }
}
