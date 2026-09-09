using Xunit;
using Accelerator.Pelckmans;

namespace Accelerator.Core.Tests;

public class OfferEngineTests
{
    static PelckmansOffer Promo(
        OfferType type,
        int minimum = 3,
        decimal percent = 0)
        => new()
        {
            Id = "PEL_STUDIO_TEST",
            Name = "test",
            Owner = "editor",
            Type = type,
            Rule = new(
                "category",
                "books",
                minimum,
                percent,
                ["a", "b", "c"]
            )
        };

    static OfferComponent Item(
        string id,
        decimal price,
        int qty = 1)
        => new(
            id,
            qty,
            true,
            false,
            price,
            id
        );

    [Fact]
    public void BuyThreePayTwo_DiscountsOneCheapestUnequalUnit()
    {
        var preview =
            OfferEngine.Preview(
                Promo(
                    OfferType.BuyThreePayTwo
                ),
                [
                    Item("a", 30),
                    Item("b", 20),
                    Item("c", 10)
                ]
            );

        Assert.Equal(
            10,
            preview.Discount
        );

        Assert.Equal(
            50,
            preview.Payable
        );
    }

    [Theory]
    [InlineData(2, 0)]
    [InlineData(3, 20)]
    [InlineData(6, 20)]
    public void BuyThreePayTwo_QuantitiesAndOneUnitCap(
        int qty,
        int discount)
    {
        Assert.Equal(
            discount,
            OfferEngine.Preview(
                Promo(
                    OfferType.BuyThreePayTwo
                ),
                [
                    Item(
                        "a",
                        20,
                        qty
                    )
                ]
            ).Discount
        );
    }

    [Fact]
    public void SegmentDiscount_CountsOnlyEligibleUnits()
    {
        var belowThreshold =
            OfferEngine.Preview(
                Promo(
                    OfferType.SegmentDiscount,
                    4,
                    10
                ),
                [
                    Item(
                        "a",
                        20,
                        3
                    ),
                    Item(
                        "x",
                        20
                    )
                ]
            );

        Assert.Equal(
            0,
            belowThreshold.Discount
        );

        var atThreshold =
            OfferEngine.Preview(
                Promo(
                    OfferType.SegmentDiscount,
                    4,
                    10
                ),
                [
                    Item(
                        "a",
                        20,
                        4
                    ),
                    Item(
                        "x",
                        20
                    )
                ]
            );

        Assert.Equal(
            8,
            atThreshold.Discount
        );
    }

    [Fact]
    public void Bundle_FreeComponentDoesNotMutateSourcePrice()
    {
        var source =
            Item(
                "event",
                15
            );

        var offer =
            new PelckmansOffer
            {
                Id = "PEL_STUDIO_B",
                Name = "b",
                Owner = "e",
                Type = OfferType.Bundle,
                Components =
                [
                    source with
                    {
                        IncludedFree = true
                    }
                ]
            };

        Assert.Equal(
            15,
            source.UnitPrice
        );

        Assert.Equal(
            15,
            OfferEngine
                .Preview(offer)
                .Discount
        );
    }
}

public class WorkflowTests
{
    static PelckmansOffer Draft()
        => new()
        {
            Id = "PEL_STUDIO_W",
            Name = "w",
            Owner = "editor",
            Type = OfferType.Bundle,
            Components =
            [
                new(
                    "a",
                    1,
                    true,
                    false,
                    10
                ),
                new(
                    "b",
                    1,
                    true,
                    false,
                    10
                )
            ]
        };

    [Fact]
    public void CreatorCannotApprove()
    {
        var pending =
            OfferWorkflow.Submit(
                Draft(),
                new(
                    "editor",
                    true,
                    false
                )
            );

        Assert.Throws<
            InvalidOperationException
        >(
            () =>
                OfferWorkflow.Approve(
                    pending,
                    new(
                        "editor",
                        false,
                        true
                    )
                )
        );
    }

    [Fact]
    public void EditorCannotPublish()
    {
        var pending =
            OfferWorkflow.Submit(
                Draft(),
                new(
                    "editor",
                    true,
                    false
                )
            );

        var approved =
            OfferWorkflow.Approve(
                pending,
                new(
                    "approver",
                    false,
                    true
                )
            );

        Assert.Throws<
            UnauthorizedAccessException
        >(
            () =>
                OfferWorkflow.CanPublish(
                    approved,
                    new(
                        "editor",
                        true,
                        false
                    )
                )
        );
    }

    [Fact]
    public void RejectionRequiresCommentAndPreservesHistory()
    {
        var pending =
            OfferWorkflow.Submit(
                Draft(),
                new(
                    "editor",
                    true,
                    false
                )
            );

        Assert.Throws<
            ArgumentException
        >(
            () =>
                OfferWorkflow.Reject(
                    pending,
                    new(
                        "approver",
                        false,
                        true
                    ),
                    ""
                )
        );

        var draft =
            OfferWorkflow.Reject(
                pending,
                new(
                    "approver",
                    false,
                    true
                ),
                "fix"
            );

        Assert.Equal(
            OfferStatus.Draft,
            draft.Status
        );

        Assert.Equal(
            2,
            draft.History.Count
        );
    }
}

public class PelckmansCompletionTests
{
    static PelckmansOffer Promotion(
        OfferType type,
        int minimum = 3,
        decimal percent = 0)
        => new()
        {
            Id = "PEL_STUDIO_P",
            Name = "promo",
            Owner = "editor",
            Type = type,
            Components =
            [
                new(
                    "a",
                    1,
                    true,
                    false,
                    20,
                    "A"
                )
            ],
            Rule = new(
                "author",
                "writer",
                minimum,
                percent,
                ["a", "b"]
            )
        };

    [Fact]
    public void Compiler_UsesSupportedQuantityAggregateAndCurrentItemSnapshot()
    {
        var (eligible, value) =
            OfferEngine.CompilePromotion(
                Promotion(
                    OfferType.BuyThreePayTwo
                )
            );

        Assert.Contains(
            "item.ProductID.in(",
            eligible
        );

        Assert.Contains(
            "items.quantity(ProductID = 'a' or ProductID = 'b')",
            eligible
        );

        Assert.DoesNotContain(
            "items.where",
            eligible
        );

        Assert.DoesNotContain(
            "items.quantity(ProductID.in(",
            eligible
        );

        Assert.Contains(
            "'a'",
            eligible
        );

        Assert.Contains(
            "'b'",
            eligible
        );

        Assert.Equal(
            "item.UnitPrice",
            value
        );

        Assert.True(
            eligible.Length <= 400
        );
    }

    [Fact]
    public void Compiler_UsesInvariantDecimal()
    {
        var (_, value) =
            OfferEngine.CompilePromotion(
                Promotion(
                    OfferType.SegmentDiscount,
                    4,
                    12.5m
                )
            );

        Assert.EndsWith(
            "0.125",
            value
        );
    }

    [Fact]
    public void RepeatedProductIdsOnSeparateLinesDoNotCrash()
    {
        var offer =
            Promotion(
                OfferType.BuyThreePayTwo
            );

        var preview =
            OfferEngine.Preview(
                offer,
                [
                    new(
                        "a",
                        1,
                        true,
                        false,
                        20,
                        "A"
                    ),
                    new(
                        "a",
                        2,
                        true,
                        false,
                        20,
                        "A"
                    )
                ]
            );

        Assert.Equal(
            20,
            preview.Discount
        );
    }

    [Fact]
    public void EmptyLegacyOfferCannotAdvance()
    {
        var empty =
            new PelckmansOffer
            {
                Id = "PEL_STUDIO_OLD",
                Name = "old",
                Owner = "editor",
                Type = OfferType.Bundle
            };

        Assert.Throws<
            ArgumentException
        >(
            () =>
                OfferWorkflow.Submit(
                    empty,
                    new(
                        "editor",
                        true,
                        false
                    )
                )
        );
    }

    [Fact]
    public void EditIncrementsRevisionAndRecordsAudit()
    {
        var original =
            new PelckmansOffer
            {
                Id = "PEL_STUDIO_E",
                Name = "old",
                Owner = "editor",
                Type = OfferType.Bundle
            };

        var edited =
            OfferWorkflow.Edit(
                original,
                new(
                    "editor",
                    true,
                    false
                ),
                "new",
                [
                    new(
                        "a",
                        1,
                        true,
                        false,
                        10
                    ),
                    new(
                        "b",
                        1,
                        true,
                        false,
                        10
                    )
                ],
                null
            );

        Assert.Equal(
            2,
            edited.Revision
        );

        Assert.Equal(
            "Edited",
            edited.History
                .Single()
                .Action
        );
    }

    [Fact]
    public void NonOwnerEditorCannotEdit()
    {
        var original =
            new PelckmansOffer
            {
                Id = "PEL_STUDIO_E",
                Name = "old",
                Owner = "editor",
                Type = OfferType.Bundle
            };

        Assert.Throws<
            UnauthorizedAccessException
        >(
            () =>
                OfferWorkflow.Edit(
                    original,
                    new(
                        "other",
                        true,
                        false
                    ),
                    "new",
                    [],
                    null
                )
        );
    }
}
