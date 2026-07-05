import {
  Badge,
  Button,
  ButtonGroup,
  Divider,
  Flex,
  Heading,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LineItem, Order, RequiredDeep } from "ordercloud-javascript-sdk";
import React, { useCallback } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import OcCurrentOrderLineItemList from "./OcCurrentOrderLineItemList";
import { useOrderCloudContext } from "@ordercloud/react-sdk";
import formatPrice from "../../utils/formatPrice";

interface OrderSummaryProps {
  order: RequiredDeep<Order>;
  lineItems: LineItem[];
  journey?: "spares" | "marketplace" | "trade";
  continueShoppingRoute?: string;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({ order, lineItems, journey, continueShoppingRoute = "/products" }) => {
  const navigate = useNavigate();
  const { isLoggedIn, newAnonSession } = useOrderCloudContext();

  const handleLineItemChange = (newLi: LineItem) => {
    // Implement the logic to update the line item
    console.log("Line item updated:", newLi);
  };

  const handleContinueShopping = useCallback(async () => {
    if (isLoggedIn) {
      navigate(continueShoppingRoute);
    } else {
      await newAnonSession();
      navigate(continueShoppingRoute);
    }
  }, [continueShoppingRoute, isLoggedIn, navigate, newAnonSession]);

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
            to={continueShoppingRoute}
          >
            Continue shopping
          </Button>
        )}
      </ButtonGroup>
      <Stack spacing={2}>
        <Heading as="h2" size="md">Order summary</Heading>
        {journey === "marketplace" && <Badge alignSelf="flex-start" colorScheme="blue">Approved merchant marketplace</Badge>}
        {journey === "trade" && <Badge alignSelf="flex-start" colorScheme="purple">Trade account</Badge>}
      </Stack>
      <OcCurrentOrderLineItemList
        lineItems={lineItems}
        emptyMessage=""
        onChange={handleLineItemChange}
        editable={false}
      />
      <Divider />
      <Stack spacing={3}>
        <Flex justify="space-between">
          <Text>Subtotal</Text>
          <Text>{formatPrice(order.Subtotal)}</Text>
        </Flex>
        {typeof order.PromotionDiscount === "number" && order.PromotionDiscount > 0 && (
          <Flex justify="space-between">
            <Text>Discount / Promotion</Text>
            <Text>-{formatPrice(order.PromotionDiscount)}</Text>
          </Flex>
        )}
        {typeof order.ShippingCost === "number" && (
          <Flex justify="space-between">
            <Text>Shipping</Text>
            <Text>{order.ShippingCost > 0 ? formatPrice(order.ShippingCost) : "Free"}</Text>
          </Flex>
        )}
        {typeof order.TaxCost === "number" && order.TaxCost > 0 && (
          <Flex justify="space-between">
            <Text>Tax</Text>
            <Text>{formatPrice(order.TaxCost)}</Text>
          </Flex>
        )}
        <Divider />
        <Flex justify="space-between" fontWeight="bold" fontSize="xl">
          <Text>Total</Text>
          <Text>{formatPrice(order.Total)}</Text>
        </Flex>
      </Stack>
    </VStack>
  );
};

export default OrderSummary;
