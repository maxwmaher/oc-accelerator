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
import formatPrice from "../../utils/formatPrice";

interface OrderSummaryProps {
  order: RequiredDeep<Order>;
  lineItems: LineItem[];
}

const OrderSummary: React.FC<OrderSummaryProps> = ({ order, lineItems }) => {
  const navigate = useNavigate();
  const { isLoggedIn, newAnonSession } = useOrderCloudContext();

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
        <Flex justify="space-between">
          <Text>Subtotal</Text>
          <Text>{formatPrice(order.Subtotal)}</Text>
        </Flex>
        {order.PromotionDiscount && order.PromotionDiscount > 0 && (
          <Flex justify="space-between">
            <Text>Promotion</Text>
            <Text>- {formatPrice(order.PromotionDiscount)}</Text>
          </Flex>
        )}
        <Flex justify="space-between">
          <Text>VAT / Tax</Text>
          <Text>{formatPrice(order.TaxCost)}</Text>
        </Flex>
        <Flex justify="space-between" fontWeight="bold" fontSize="lg">
          <Text>Total</Text>
          <Text>{formatPrice(order.Total)}</Text>
        </Flex>
      </Stack>
    </VStack>
  );
};

export default OrderSummary;
