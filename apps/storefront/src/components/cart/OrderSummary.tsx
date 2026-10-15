import { Button, Heading, Stack } from "@chakra-ui/react";
import { useOrderCloudContext } from "@ordercloud/react-sdk";
import type { Order } from "ordercloud-javascript-sdk";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Surface } from "../trade/TradePrimitives";
import OrderTotals from "./OrderTotals";

export default function OrderSummary({ order }: { order: Order }) {
  const navigate = useNavigate();
  const { isLoggedIn, newAnonSession } = useOrderCloudContext();
  const handleContinueShopping = useCallback(async () => {
    if (!isLoggedIn) await newAnonSession();
    navigate("/products");
  }, [isLoggedIn, navigate, newAnonSession]);

  return <Surface as="aside"><Stack spacing={6}>
    <Heading as="h2" size="md">Order summary</Heading>
    <OrderTotals order={order} />
    <Button w="full" onClick={() => void handleContinueShopping()}>Continue shopping</Button>
  </Stack></Surface>;
}
