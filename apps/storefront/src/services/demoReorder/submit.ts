import { DEMO_CARD_CVV, DEMO_CARD_NUMBER } from "../demoPayment";
import { runDemoCartCheckout } from "../demoCartCheckout";
import { getFutureDemoExpiration } from "../demoOrderImport/demoData";
import { buildDemoReorderPreview } from "./preview";
import { DemoReorderSubmitResult, DemoReorderValidationMessage } from "./types";

const toValidationErrors = (messages: string[]): DemoReorderValidationMessage[] =>
  messages.map((message) => ({ stage: "SOURCE_ORDER", message }));

export const submitDemoReorder = async (
  orderID: string,
): Promise<DemoReorderSubmitResult> => {
  const preview = await buildDemoReorderPreview(orderID);
  if (!preview.canSubmit || !preview.shippingAddress) {
    return {
      sourceOrderID: orderID,
      status: "FAILED",
      paymentStatus: "NOT_CREATED",
      submitStatus: "NOT_SUBMITTED",
      errors: preview.errors,
    };
  }

  const { expirationMonth, expirationYear } = getFutureDemoExpiration();
  const checkoutResult = await runDemoCartCheckout({
    referenceID: orderID,
    sellerID: preview.sourceOrder.toCompanyID,
    lines: preview.lines.map((line, index) => ({
      lineID: line.sourceLineItemID,
      lineNumber: index + 1,
      ProductID: line.productID as string,
      Quantity: line.quantity as number,
      InventoryRecordID: line.resolvedInventoryRecordID || line.inventoryRecordID,
      Specs: line.specs,
      xp: {
        DemoReorder: true,
        SourceOrderID: orderID,
        SourceLineItemID: line.sourceLineItemID,
      },
    })),
    shippingAddress: preview.shippingAddress,
    preferredShippingMethod: preview.previousShippingMethod,
    payment: {
      nameOnCard:
        `${preview.shippingAddress.FirstName || "Demo"} ${
          preview.shippingAddress.LastName || "Shopper"
        }`.trim(),
      cardNumber: DEMO_CARD_NUMBER,
      expirationMonth,
      expirationYear,
      cvv: DEMO_CARD_CVV,
      billingZip: preview.shippingAddress.Zip || "60601",
    },
    orderXp: {
      DemoReorder: true,
      SourceOrderID: orderID,
    },
  });

  return {
    sourceOrderID: orderID,
    newSubmittedOrderID: checkoutResult.submittedOrderID,
    status: checkoutResult.status,
    selectedShippingMethod: checkoutResult.shipping,
    shippingMatchStatus: checkoutResult.shipping?.matchStatus,
    paymentStatus: checkoutResult.paymentStatus,
    submitStatus: checkoutResult.submitStatus,
    failureStage: checkoutResult.failureStage,
    cleanupStatus: checkoutResult.cleanupStatus,
    errors: checkoutResult.errors.length
      ? toValidationErrors(checkoutResult.errors.map((error) => error.message))
      : [],
  };
};
