using Accelerator.Pelckmans;
namespace Accelerator.Core.Tests;
public class OfferEngineTests {
 static PelckmansOffer Promo(OfferType type,int minimum=3,decimal percent=0)=>new(){Id="PEL_STUDIO_TEST",Name="test",Owner="editor",Type=type,Rule=new("category","books",minimum,percent,["a","b","c"])};
 static OfferComponent Item(string id,decimal price,int qty=1)=>new(id,qty,true,false,price,id);
 [Fact] public void BuyThreePayTwo_DiscountsOneCheapestUnequalUnit(){var p=OfferEngine.Preview(Promo(OfferType.BuyThreePayTwo),[Item("a",30),Item("b",20),Item("c",10)]);Assert.Equal(10,p.Discount);Assert.Equal(50,p.Payable);}
 [Theory][InlineData(2,0)][InlineData(3,20)][InlineData(6,20)] public void BuyThreePayTwo_QuantitiesAndOneUnitCap(int qty,int discount){Assert.Equal(discount,OfferEngine.Preview(Promo(OfferType.BuyThreePayTwo),[Item("a",20,qty)]).Discount);}
 [Fact] public void SegmentDiscount_CountsOnlyEligibleUnits(){var p=OfferEngine.Preview(Promo(OfferType.SegmentDiscount,4,10),[Item("a",20,3),Item("x",20)]);Assert.Equal(0,p.Discount);var q=OfferEngine.Preview(Promo(OfferType.SegmentDiscount,4,10),[Item("a",20,4),Item("x",20)]);Assert.Equal(8,q.Discount);}
 [Fact] public void Bundle_FreeComponentDoesNotMutateSourcePrice(){var source=Item("event",15);var o=new PelckmansOffer{Id="PEL_STUDIO_B",Name="b",Owner="e",Type=OfferType.Bundle,Components=[source with{IncludedFree=true}]};Assert.Equal(15,source.UnitPrice);Assert.Equal(15,OfferEngine.Preview(o).Discount);}
}
public class WorkflowTests {
 static PelckmansOffer Draft()=>new(){Id="PEL_STUDIO_W",Name="w",Owner="editor",Type=OfferType.Bundle,Components=[new("a",1,true,false,10),new("b",1,true,false,10)]};
 [Fact] public void CreatorCannotApprove(){var p=OfferWorkflow.Submit(Draft(),new("editor",true,false));Assert.Throws<InvalidOperationException>(()=>OfferWorkflow.Approve(p,new("editor",false,true)));}
 [Fact] public void EditorCannotPublish(){var p=OfferWorkflow.Approve(OfferWorkflow.Submit(Draft(),new("editor",true,false)),new("approver",false,true));Assert.Throws<UnauthorizedAccessException>(()=>OfferWorkflow.CanPublish(p,new("editor",true,false)));}
 [Fact] public void RejectionRequiresCommentAndPreservesHistory(){var p=OfferWorkflow.Submit(Draft(),new("editor",true,false));Assert.Throws<ArgumentException>(()=>OfferWorkflow.Reject(p,new("approver",false,true),""));var d=OfferWorkflow.Reject(p,new("approver",false,true),"fix");Assert.Equal(OfferStatus.Draft,d.Status);Assert.Equal(2,d.History.Count);}
}
public class PelckmansCompletionTests {
 static PelckmansOffer Promotion(OfferType type,int minimum=3,decimal percent=0)=>new(){Id="PEL_STUDIO_P",Name="promo",Owner="editor",Type=type,Components=[new("a",1,true,false,20,"A")],Rule=new("author","writer",minimum,percent,["a","b"])};
 [Fact] public void Compiler_UsesSupportedQuantityAggregateAndCurrentItemSnapshot(){var(e,v)=OfferEngine.CompilePromotion(Promotion(OfferType.BuyThreePayTwo));Assert.Contains("items.quantity(",e);Assert.DoesNotContain("items.where",e);Assert.Contains("product.id = 'a'",e);Assert.Equal("item.unitprice",v);}
 [Fact] public void Compiler_UsesInvariantDecimal(){var(_,v)=OfferEngine.CompilePromotion(Promotion(OfferType.SegmentDiscount,4,12.5m));Assert.EndsWith("0.125",v);}
 [Fact] public void RepeatedProductIdsOnSeparateLinesDoNotCrash(){var offer=Promotion(OfferType.BuyThreePayTwo);var p=OfferEngine.Preview(offer,[new("a",1,true,false,20,"A"),new("a",2,true,false,20,"A")]);Assert.Equal(20,p.Discount);}
 [Fact] public void EmptyLegacyOfferCannotAdvance(){var empty=new PelckmansOffer{Id="PEL_STUDIO_OLD",Name="old",Owner="editor",Type=OfferType.Bundle};Assert.Throws<ArgumentException>(()=>OfferWorkflow.Submit(empty,new("editor",true,false)));}
 [Fact] public void EditIncrementsRevisionAndRecordsAudit(){var o=new PelckmansOffer{Id="PEL_STUDIO_E",Name="old",Owner="editor",Type=OfferType.Bundle};var e=OfferWorkflow.Edit(o,new("editor",true,false),"new",[new("a",1,true,false,10),new("b",1,true,false,10)],null);Assert.Equal(2,e.Revision);Assert.Equal("Edited",e.History.Single().Action);}
 [Fact] public void NonOwnerEditorCannotEdit(){var o=new PelckmansOffer{Id="PEL_STUDIO_E",Name="old",Owner="editor",Type=OfferType.Bundle};Assert.Throws<UnauthorizedAccessException>(()=>OfferWorkflow.Edit(o,new("other",true,false),"new",[],null));}
}
