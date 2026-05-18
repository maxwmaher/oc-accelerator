import {
  Button,
  ButtonGroup,
  Divider,
  Flex,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LineItem, Order, RequiredDeep } from "ordercloud-javascript-sdk";
import React, { useCallback } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import OcCurrentOrderLineItemList from "./OcCurrentOrderLineItemList";
import { useOrderCloudContext } from "@ordercloud/react-sdk";

interface OrderSummaryProps {
  order: RequiredDeep<Order>;
  lineItems: LineItem[];
}

interface TotalRowProps {
  label: string;
  value: number | undefined;
  fontWeight?: "normal" | "bold";
  fontSize?: string;
}

const formatOrderAmount = (amount: number | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "symbol",
  }).format(typeof amount === "number" && Number.isFinite(amount) ? amount : 0);

const TotalRow: React.FC<TotalRowProps> = ({
  label,
  value,
  fontWeight = "normal",
  fontSize,
}) => (
  <Flex align="baseline" justify="space-between" gap={4}>
    <Text color="chakra-subtle-text" fontWeight={fontWeight}>
      {label}
    </Text>
    <Text fontWeight={fontWeight} fontSize={fontSize} textAlign="right">
      {formatOrderAmount(value)}
    </Text>
  </Flex>
);

const OrderSummary: React.FC<OrderSummaryProps> = ({ order, lineItems }) => {
  const navigate = useNavigate();
  const { isLoggedIn, newAnonSession } = useOrderCloudContext();
  const hasTax = typeof order.TaxCost === "number" && Number.isFinite(order.TaxCost);

  const handleLineItemChange = (newLi: LineItem) => {
    // Implement the logic to update the line item
    console.log("Line item updated:", newLi);
  };

  const handleContinueShopping = useCallback(async () => {
    if (isLoggedIn) {
      navigate("/products");
    } else {
      await newAnonSession();
      navigate("/products");
    }
  }, [isLoggedIn, navigate, newAnonSession]);

  return (
    <VStack align="stretch" spacing={6}>
      <ButtonGroup alignSelf="flex-end" alignItems="center" gap={3} mt={-3}>
        {order.IsSubmitted ? (
          <Button
            size="xs"
            variant="outline"
            alignSelf="flex-end"
            onClick={handleContinueShopping}
          >
            Continue shopping
          </Button>
        ) : (
          <Button
            size="xs"
            variant="outline"
            alignSelf="flex-end"
            as={RouterLink}
            to="/products"
          >
            Continue shopping
          </Button>
        )}
      </ButtonGroup>
      <OcCurrentOrderLineItemList
        lineItems={lineItems}
        emptyMessage=""
        onChange={handleLineItemChange}
        editable={false}
      />
      <Divider />
      <Stack spacing={3}>
        <TotalRow label="Subtotal" value={order.Subtotal} />
        <TotalRow label="Promotion" value={order.PromotionDiscount} />
        <TotalRow label="Shipping" value={order.ShippingCost} />
        {hasTax && <TotalRow label="Tax" value={order.TaxCost} />}
        <Divider />
        <TotalRow
          label="Total"
          value={order.Total}
          fontWeight="bold"
          fontSize="lg"
        />
      </Stack>
    </VStack>
  );
};

export default OrderSummary;
