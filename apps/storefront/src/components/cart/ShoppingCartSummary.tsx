import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Divider,
  Flex,
  FormControl,
  Heading,
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
import { isBristanDemoSupplierBuyerBulkContext } from "../bristan/bristanDemoRoutes";
import OcCurrentOrderLineItemList from "./OcCurrentOrderLineItemList";
import { TABS } from "./ShoppingCart";

interface CartSummaryProps {
  onSubmitOrder: () => void;
  deleteOrder: () => void;
  tabIndex: number;
  username?: string;
  continueShoppingRoute: string;
}

const formatCurrency = (value?: number) =>
  typeof value === "number" ? `$${value.toFixed(2)}` : undefined;

const CartSummary: React.FC<CartSummaryProps> = ({
  deleteOrder,
  tabIndex,
  username,
  continueShoppingRoute,
}) => {
  const { addCartPromo, removeCartPromo, orderWorksheet } = useShopper();
  const [promoCode, setPromoCode] = useState<string>("");
  const toast = useToast();
  const lineItems = orderWorksheet?.LineItems || [];
  const itemCount = useMemo(
    () => lineItems.reduce((total, item) => total + Number(item.Quantity || 0), 0),
    [lineItems]
  );

  const handleLineItemChange = (newLi: LineItem) => {
    console.log("Line item updated:", newLi);
  };

  const handleApplyPromotion = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!promoCode) return;
      try {
        addCartPromo(promoCode);
        toast({ title: `Promotion '${promoCode}' applied to cart`, status: "success", duration: 5000, isClosable: true });
        setPromoCode("");
      } catch (error) {
        console.error(error);
      }
    },
    [addCartPromo, promoCode, toast]
  );

  const handleRemovePromotion = useCallback(
    async (promoCode: string | undefined) => {
      if (!promoCode) return;
      try {
        await removeCartPromo(promoCode);
        toast({ title: `Promotion '${promoCode}' removed from cart`, status: "success", duration: 5000, isClosable: true });
        setPromoCode("");
      } catch (error) {
        console.error(error);
      }
    },
    [removeCartPromo, toast]
  );

  const order = orderWorksheet?.Order;
  const showShippingAmount = typeof order?.ShippingCost === "number" && tabIndex >= TABS.PAYMENT;
  const showTaxAmount = typeof order?.TaxCost === "number" && tabIndex >= TABS.PAYMENT;
  const showCalculatedNext = tabIndex === TABS.INFORMATION;

  return (
    <Box position={{ lg: "sticky" }} top={{ lg: 6 }}>
      <VStack align="stretch" spacing={5} bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="2xl" p={{ base: 4, md: 6 }} boxShadow="sm">
        <Flex justify="space-between" align="start" gap={4}>
          <Box>
            <Heading as="h2" size="md">Order summary</Heading>
            <Text color="gray.600" fontSize="sm">{itemCount} {itemCount === 1 ? "item" : "items"} in this order</Text>
          </Box>
          <Badge colorScheme="blue" variant="subtle">Bristan demo</Badge>
        </Flex>
        <ButtonGroup alignSelf="flex-end" alignItems="center" gap={3}>
          <Button variant="link" size="xs" colorScheme="gray" onClick={deleteOrder}>Clear cart</Button>
          <Button size="xs" variant="outline" as={RouterLink} to={continueShoppingRoute}>Continue shopping</Button>
        </ButtonGroup>
        <OcCurrentOrderLineItemList
          lineItems={orderWorksheet?.LineItems}
          emptyMessage="Your cart is empty"
          onChange={handleLineItemChange}
          editable={false}
          isTradeBuyer={isBristanDemoSupplierBuyerBulkContext(username)}
        />
        <Divider />
        <form id="APPLY_PROMO" onSubmit={handleApplyPromotion}>
          <Flex justify="space-between" align="start">
            <FormControl mb={3}>
              <InputGroup>
                <Input aria-label="Promo code" placeholder="Promo code" type="text" size="sm" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} />
              </InputGroup>
            </FormControl>
            <Button ml={2} type="submit" size="sm" variant="outline">Apply</Button>
          </Flex>
        </form>
        {orderWorksheet?.OrderPromotions?.map((p) => (
          <Flex justify="space-between" key={p.Code}>
            <Text alignContent="center">{p.Code?.toLocaleUpperCase()}</Text>
            <Button colorScheme="danger" size="sm" onClick={() => handleRemovePromotion(p.Code)}>Remove</Button>
          </Flex>
        ))}
        <Divider />
        <Stack spacing={3}>
          <Flex justify="space-between"><Text>Subtotal</Text><Text>{formatCurrency(order?.Subtotal)}</Text></Flex>
          {!!order?.PromotionDiscount && order.PromotionDiscount > 0 && (
            <Flex justify="space-between"><Text>Promotion discount</Text><Text>- {formatCurrency(order.PromotionDiscount)}</Text></Flex>
          )}
          {(showShippingAmount || showCalculatedNext) && (
            <Flex justify="space-between"><Text>Shipping</Text><Text>{showShippingAmount ? formatCurrency(order?.ShippingCost) : "Calculated at next step"}</Text></Flex>
          )}
          {(showTaxAmount || showCalculatedNext) && (
            <Flex justify="space-between"><Text>Tax</Text><Text>{showTaxAmount ? formatCurrency(order?.TaxCost) : "Calculated at next step"}</Text></Flex>
          )}
          <Divider />
          <Flex justify="space-between" fontWeight="bold" fontSize="lg"><Text>{tabIndex >= TABS.PAYMENT ? "Total" : "Current total"}</Text><Text>{formatCurrency(order?.Total)}</Text></Flex>
          {tabIndex < TABS.PAYMENT && <Text color="gray.600" fontSize="xs">Shipping and tax are calculated in the next steps.</Text>}
        </Stack>
      </VStack>
    </Box>
  );
};

export default CartSummary;
