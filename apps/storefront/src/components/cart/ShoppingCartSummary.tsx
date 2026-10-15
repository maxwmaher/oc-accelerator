import {
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useShopper } from "@ordercloud/react-sdk";
import React, { FormEvent, useCallback, useState } from "react";
import { Surface } from "../trade/TradePrimitives";
import OrderTotals from "./OrderTotals";

import { runCartAction } from "../../utils/kfmbCartEdits";

interface CartSummaryProps {
  deleteOrder: () => void;
}

const CartSummary: React.FC<CartSummaryProps> = ({ deleteOrder }) => {
  const { addCartPromo, removeCartPromo, listEligiblePromotions, refreshWorksheet, orderWorksheet } = useShopper();
  const [promoCode, setPromoCode] = useState<string>("");
  const toast = useToast();

  const handleApplyPromotion = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!promoCode) return;
      try {
        await runCartAction(async () => {
          await listEligiblePromotions();
          await addCartPromo(promoCode.trim());
          await refreshWorksheet();
        });
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
        await runCartAction(async () => {
          await removeCartPromo(promoCode);
          await refreshWorksheet();
        });
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
    <Surface as="aside"><VStack align="stretch" spacing={6}>
      <Heading as="h2" size="md">Order summary</Heading>
      {orderWorksheet?.Order && <OrderTotals order={orderWorksheet.Order} />}
      <Divider />
      <form id="APPLY_PROMO" onSubmit={handleApplyPromotion}>
        <FormControl isRequired>
          <FormLabel htmlFor="promotion-code">Promotion code</FormLabel>
          <Flex gap={2}>
              <Input
                id="promotion-code"
                placeholder="Enter code"
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                minW={0}
              />
            <Button variant="outline" type="submit" flexShrink={0}>Apply</Button>
          </Flex>
        </FormControl>
      </form>
      {orderWorksheet?.OrderPromotions?.map((p) => (
        <Flex justify="space-between" key={p.ID || p.Code}>
          <Text alignContent="center" fontSize="sm" overflowWrap="anywhere">{p.Code?.toLocaleUpperCase()}</Text>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRemovePromotion(p.Code)}
          >
            Remove
          </Button>
        </Flex>
      ))}
      <Divider />
      <Button variant="ghost" size="sm" alignSelf="flex-start" onClick={deleteOrder}>Clear cart</Button>
    </VStack></Surface>
  );
};

export default CartSummary;
