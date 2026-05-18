import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Button,
  ButtonGroup,
  Divider,
  Flex,
  FormControl,
  Input,
  InputGroup,
  Stack,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useShopper } from "@ordercloud/react-sdk";
import { LineItem } from "ordercloud-javascript-sdk";
import React, { FormEvent, useCallback, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import OcCurrentOrderLineItemList from "./OcCurrentOrderLineItemList";
import { useSellerContext } from "../../context/SellerContext";
import { TABS } from "./ShoppingCart";

type FulfillmentPanelContent = {
  title: string;
  description: string;
  channelLabel: string;
};

const SUPPLIER_IDS = {
  abc: "ABC_USED_PARTS_SUPPLIER",
  nordic: "NORDIC_EDI_SUPPLIER",
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const getString = (record: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const normalize = (...values: Array<string | undefined>) =>
  values.filter(Boolean).join(" ").toLowerCase();

const getLineItemFulfillmentContent = (lineItems?: LineItem[]) => {
  const offerMetadata = lineItems
    ?.map((lineItem) => {
      const xp = asRecord(lineItem.Product?.xp);
      const supplier = asRecord(xp.supplier);
      const catalogUpdate = asRecord(xp.catalogUpdate);
      const offer = asRecord(xp.offer);

      if (!Object.keys(supplier).length && !Object.keys(offer).length) {
        return undefined;
      }

      return {
        supplierID: getString(supplier, "id", "supplierID"),
        sellerID: getString(supplier, "sellerID"),
        sellerType: getString(supplier, "sellerType"),
        displayName: getString(supplier, "displayName", "name"),
        catalogSource: getString(catalogUpdate, "source", "updateModel"),
      };
    })
    .find(Boolean);

  if (!offerMetadata) return undefined;

  const searchable = normalize(
    offerMetadata.supplierID,
    offerMetadata.sellerID,
    offerMetadata.sellerType,
    offerMetadata.displayName,
    offerMetadata.catalogSource,
  );

  if (searchable.includes("abc") || searchable.includes("used")) {
    return {
      title: "Fulfilled by ABC Used Parts Supplier",
      description:
        "This supplier offer represents an ad hoc/used-parts supplier with its own pricing, availability, condition metadata, and buyer eligibility.",
      channelLabel: "ABC Used Parts Supplier offer",
    };
  }

  if (searchable.includes("nordic") || searchable.includes("edi")) {
    return {
      title: "Fulfilled by Nordic EDI Supplier",
      description:
        "This supplier offer represents a catalog-sync/EDI-enabled partner with externally managed pricing and availability.",
      channelLabel: "Nordic EDI Supplier offer",
    };
  }

  if (searchable.includes("admin") || searchable.includes("scania direct")) {
    return {
      title: "Fulfilled by Scania Direct",
      description:
        "This item is sold through the direct OEM channel with admin-managed pricing and inventory.",
      channelLabel: "Scania Direct",
    };
  }

  return undefined;
};

const getCartFulfillmentContent = (
  lineItems: LineItem[] | undefined,
  toCompanyID?: string,
  selectedSellerName?: string,
): FulfillmentPanelContent | undefined => {
  const lineItemContent = getLineItemFulfillmentContent(lineItems);
  if (lineItemContent) return lineItemContent;

  const sellerContext = normalize(toCompanyID, selectedSellerName);
  if (!sellerContext) return undefined;

  if (
    sellerContext.includes(SUPPLIER_IDS.abc.toLowerCase()) ||
    sellerContext.includes("abc") ||
    sellerContext.includes("used")
  ) {
    return {
      title: "Fulfilled by ABC Used Parts Supplier",
      description:
        "This supplier offer represents an ad hoc/used-parts supplier with its own pricing, availability, condition metadata, and buyer eligibility.",
      channelLabel: "ABC Used Parts Supplier offer",
    };
  }

  if (
    sellerContext.includes(SUPPLIER_IDS.nordic.toLowerCase()) ||
    sellerContext.includes("nordic") ||
    sellerContext.includes("edi")
  ) {
    return {
      title: "Fulfilled by Nordic EDI Supplier",
      description:
        "This supplier offer represents a catalog-sync/EDI-enabled partner with externally managed pricing and availability.",
      channelLabel: "Nordic EDI Supplier offer",
    };
  }

  if (sellerContext.includes("scania") || sellerContext.includes("direct")) {
    return {
      title: "Fulfilled by Scania Direct",
      description:
        "This item is sold through the direct OEM channel with admin-managed pricing and inventory.",
      channelLabel: "Scania Direct",
    };
  }

  return {
    title: "Fulfilled by selected supplier",
    description:
      "This supplier cart is fulfilled by the selected marketplace seller with supplier-specific pricing and availability.",
    channelLabel: "Supplier offer",
  };
};

interface CartSummaryProps {
  onSubmitOrder: () => void;
  deleteOrder: () => void;
  tabIndex: number;
  fallbackShippingCost?: number;
}

const CartSummary: React.FC<CartSummaryProps> = ({
  deleteOrder,
  tabIndex,
  fallbackShippingCost,
}) => {
  const { addCartPromo, removeCartPromo, orderWorksheet } = useShopper();
  const { selectedSeller } = useSellerContext();
  const [promoCode, setPromoCode] = useState<string>("");
  const handleLineItemChange = (newLi: LineItem) => {
    // Implement the logic to update the line item
    console.log("Line item updated:", newLi);
  };
  const toast = useToast();
  const fulfillmentContent = useMemo(
    () =>
      getCartFulfillmentContent(
        orderWorksheet?.LineItems,
        orderWorksheet?.Order?.ToCompanyID,
        selectedSeller?.displayName,
      ),
    [
      orderWorksheet?.LineItems,
      orderWorksheet?.Order?.ToCompanyID,
      selectedSeller?.displayName,
    ],
  );

  const handleApplyPromotion = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!promoCode) return;
      try {
        addCartPromo(promoCode);
        toast({
          title: `Promotion '${promoCode}' applied to cart`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        setPromoCode("");
      } catch (error) {
        console.error(error);
      }
    },
    [addCartPromo, promoCode, toast],
  );

  const handleRemovePromotion = useCallback(
    async (promoCode: string | undefined) => {
      if (!promoCode) return;
      try {
        await removeCartPromo(promoCode);
        toast({
          title: `Promotion '${promoCode}' removed from cart`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        setPromoCode("");
      } catch (error) {
        console.error(error);
      }
    },
    [removeCartPromo, toast],
  );

  return (
    <VStack align="stretch" spacing={6}>
      <ButtonGroup alignSelf="flex-end" alignItems="center" gap={3} mt={-3}>
        <Button variant="link" size="xs" onClick={deleteOrder}>
          Clear cart
        </Button>
        <Button
          size="xs"
          variant="outline"
          alignSelf="flex-end"
          as={RouterLink}
          to="/products"
        >
          Continue shopping
        </Button>
      </ButtonGroup>
      <OcCurrentOrderLineItemList
        lineItems={orderWorksheet?.LineItems}
        emptyMessage="Your cart is empty"
        onChange={handleLineItemChange}
        editable={false}
      />
      {fulfillmentContent && (
        <Alert
          status="info"
          variant="subtle"
          rounded="md"
          alignItems="flex-start"
        >
          <AlertIcon mt={1} />
          <Stack spacing={2}>
            <Flex align="center" gap={2} wrap="wrap">
              <AlertTitle>{fulfillmentContent.title}</AlertTitle>
              <Badge colorScheme="blue" variant="subtle">
                {fulfillmentContent.channelLabel}
              </Badge>
            </Flex>
            <AlertDescription fontSize="sm">
              {fulfillmentContent.description}
            </AlertDescription>
          </Stack>
        </Alert>
      )}
      <Divider />
      <form id="APPLY_PROMO" onSubmit={handleApplyPromotion}>
        <Flex justify="space-between">
          <FormControl isRequired mb={3}>
            <InputGroup>
              <Input
                aria-label="Gift card or discount code"
                placeholder="Gift card or discount code"
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
              />
            </InputGroup>
          </FormControl>
          <Button colorScheme="secondary" ml={2} type="submit">
            Apply
          </Button>
        </Flex>
      </form>
      {orderWorksheet?.OrderPromotions?.map((p) => (
        <Flex justify="space-between">
          <Text alignContent="center">{p.Code?.toLocaleUpperCase()}</Text>
          <Button
            colorScheme="danger"
            onClick={() => handleRemovePromotion(p.Code)}
          >
            Remove
          </Button>
        </Flex>
      ))}
      <Divider />
      <Stack spacing={3}>
        <Flex justify="space-between">
          <Text>Subtotal</Text>
          <Text>${orderWorksheet?.Order?.Subtotal?.toFixed(2)}</Text>
        </Flex>
        {orderWorksheet?.Order.PromotionDiscount &&
          orderWorksheet?.Order.PromotionDiscount > 0 && (
            <Flex justify="space-between">
              <Text>Promotion Discount</Text>
              <Text>
                - ${orderWorksheet?.Order?.PromotionDiscount?.toFixed(2)}
              </Text>
            </Flex>
          )}
        <Flex justify="space-between">
          <Text>Shipping</Text>
          {tabIndex !== TABS.SHIPPING && tabIndex !== TABS.INFORMATION && (
            <Text>
              $
              {(
                fallbackShippingCost ??
                orderWorksheet?.Order?.ShippingCost ??
                0
              ).toFixed(2)}
            </Text>
          )}
        </Flex>
        <Flex justify="space-between">
          <Text>Tax</Text>
          {tabIndex !== TABS.SHIPPING && tabIndex !== TABS.INFORMATION && (
            <Text>${orderWorksheet?.Order?.TaxCost?.toFixed(2)}</Text>
          )}
        </Flex>
        <Flex justify="space-between" fontWeight="bold" fontSize="lg">
          <Text>Total</Text>
          <Text>
            $
            {(
              (orderWorksheet?.Order?.Total ?? 0) +
              (fallbackShippingCost
                ? fallbackShippingCost -
                  (orderWorksheet?.Order?.ShippingCost ?? 0)
                : 0)
            ).toFixed(2)}
          </Text>
        </Flex>
      </Stack>
    </VStack>
  );
};

export default CartSummary;
