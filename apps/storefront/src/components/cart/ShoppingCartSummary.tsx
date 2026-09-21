import {
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
import React, { FormEvent, useCallback, useState } from "react";
import formatPrice from "../../utils/formatPrice";
import { Link as RouterLink } from "react-router-dom";
import OcCurrentOrderLineItemList from "./OcCurrentOrderLineItemList";

interface CartSummaryProps {
  onSubmitOrder: () => void;
  deleteOrder: () => void;
  tabIndex: number;
}

const CartSummary: React.FC<CartSummaryProps> = ({ deleteOrder }) => {
  const { addCartPromo, removeCartPromo, listEligiblePromotions, refreshWorksheet, orderWorksheet } = useShopper();
  const [promoCode, setPromoCode] = useState<string>("");
  const handleLineItemChange = (newLi: LineItem) => {
    // Implement the logic to update the line item
    console.log("Line item updated:", newLi);
  };
  const toast = useToast();

  const handleApplyPromotion = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!promoCode) return;
      try {
        await listEligiblePromotions();
        await addCartPromo(promoCode.trim());
        await refreshWorksheet();
        toast({
          title: `Promotion '${promoCode}' applied to cart`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        setPromoCode("");
      } catch (error) {
        toast({ title: `Promotion '${promoCode}' was not applied`, description: error instanceof Error ? error.message : "This promotion is not eligible for this shopper or cart.", status: "error", duration: 6000, isClosable: true });
      }
    },
    [addCartPromo, listEligiblePromotions, promoCode, refreshWorksheet, toast]
  );

  const handleRemovePromotion = useCallback(
    async (promoCode: string | undefined) => {
      if (!promoCode) return;
      try {
        await removeCartPromo(promoCode);
        await refreshWorksheet();
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
    [refreshWorksheet, removeCartPromo, toast]
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
        <Flex justify="space-between" key={p.ID || p.Code}>
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
          <Text>{formatPrice(orderWorksheet?.Order?.Subtotal, orderWorksheet?.Order?.Currency)}</Text>
        </Flex>
        {orderWorksheet?.Order.PromotionDiscount &&
          orderWorksheet?.Order.PromotionDiscount > 0 && (
            <Flex justify="space-between">
              <Text>Promotion Discount</Text>
              <Text>
                - {formatPrice(orderWorksheet?.Order?.PromotionDiscount, orderWorksheet?.Order?.Currency)}
              </Text>
            </Flex>
          )}
        <Flex justify="space-between">
          <Text>Shipping</Text>
          <Text>{formatPrice(0, orderWorksheet?.Order?.Currency)}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text>Tax <Text as="span" fontSize="xs" color="gray.600">(not calculated in this demo)</Text></Text>
          <Text>{formatPrice(0, orderWorksheet?.Order?.Currency)}</Text>
        </Flex>
        <Flex justify="space-between" fontWeight="bold" fontSize="lg">
          <Text>Total</Text>
          <Text>{formatPrice(orderWorksheet?.Order?.Total, orderWorksheet?.Order?.Currency)}</Text>
        </Flex>
      </Stack>
    </VStack>
  );
};

export default CartSummary;
