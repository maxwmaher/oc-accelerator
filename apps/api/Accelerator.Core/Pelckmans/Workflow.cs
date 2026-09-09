namespace Accelerator.Pelckmans;

public sealed record WorkspaceActor(string Username, bool Editor, bool Approver);
public static class OfferWorkflow {
    public static PelckmansOffer Submit(PelckmansOffer o, WorkspaceActor a) { OwnDraft(o,a); return Move(o, OfferStatus.PendingApproval, a, "Submitted"); }
    public static PelckmansOffer Approve(PelckmansOffer o, WorkspaceActor a) {
        if (!a.Approver || o.Status != OfferStatus.PendingApproval) throw new UnauthorizedAccessException();
        if (Same(o.Owner,a.Username)) throw new InvalidOperationException("Creators cannot approve their own offer.");
        return Move(o with { Approver=a.Username, ApprovedRevision=o.Revision }, OfferStatus.Approved, a, "Approved");
    }
    public static PelckmansOffer Reject(PelckmansOffer o, WorkspaceActor a, string comment) {
        if (!a.Approver || o.Status != OfferStatus.PendingApproval) throw new UnauthorizedAccessException();
        if (string.IsNullOrWhiteSpace(comment)) throw new ArgumentException("A rejection comment is required.");
        return Move(o with { Revision=o.Revision+1, ApprovedRevision=null, Approver=null }, OfferStatus.Draft, a, "Rejected", comment);
    }
    public static void CanPublish(PelckmansOffer o, WorkspaceActor a) {
        if (!a.Approver || (o.Status != OfferStatus.Approved && o.Status != OfferStatus.PublishFailed) || o.ApprovedRevision != o.Revision) throw new UnauthorizedAccessException("Exact approved revision required.");
    }
    public static PelckmansOffer Edit(PelckmansOffer o, WorkspaceActor a, string name, IReadOnlyList<OfferComponent> components, OfferRule? rule) { OwnDraft(o,a); return o with { Name=name, Components=components, Rule=rule, Revision=o.Revision+1, ApprovedRevision=null, Approver=null, UpdatedAt=DateTimeOffset.UtcNow }; }
    static void OwnDraft(PelckmansOffer o, WorkspaceActor a) { if (!a.Editor || o.Status != OfferStatus.Draft || !Same(o.Owner,a.Username)) throw new UnauthorizedAccessException(); }
    static bool Same(string a,string b) => string.Equals(a,b,StringComparison.OrdinalIgnoreCase);
    static PelckmansOffer Move(PelckmansOffer o, OfferStatus s, WorkspaceActor a, string action, string? comment=null) => o with { Status=s, UpdatedAt=DateTimeOffset.UtcNow, History=o.History.Append(new(DateTimeOffset.UtcNow,a.Username,action,comment,o.Revision)).ToList() };
}
