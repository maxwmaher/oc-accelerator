import { Container, Divider, Grid, GridItem, HStack, Heading, Icon, Spinner, Text, VStack } from "@chakra-ui/react";
import { LineItem, LineItems, Order, Orders, RequiredDeep } from "ordercloud-javascript-sdk";
import { useCallback, useEffect, useState } from "react";
import { TbCheckbox } from "react-icons/tb";
import { useLocation } from "react-router-dom";
import OrderSummary from "./OrderSummary";
const OrderConfirmation = (): JSX.Element => {
  const [loading, setLoading] = useState(true); const [lineItems, setLineItems] = useState<LineItem[]>([]); const [order, setOrder] = useState<RequiredDeep<Order>>(); const location = useLocation();
  const load = useCallback(async () => { const orderID = new URLSearchParams(location.search).get("orderID"); if (!orderID) { setLoading(false); return; } const submitted = await Orders.Get("Outgoing", orderID); if (!submitted.IsSubmitted) { setLoading(false); return; } setOrder(submitted); const lines = await LineItems.List("Outgoing", orderID, { pageSize: 100 }); setLineItems(lines.Items); setLoading(false); }, [location.search]);
  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);
  if (loading) return <Container maxW="container.lg" centerContent><Spinner size="xl" /></Container>;
  if (!order) return <Container maxW="container.lg" centerContent><Heading>Order not confirmed</Heading><Text>Submission did not complete. Return to the cart and retry.</Text></Container>;
  const pickup = order.xp?.KFMBCheckout?.Pickup;
  return <Grid gridTemplateColumns={{ md: "3fr 2fr" }} w="full" minH="100vh" flex="1"><GridItem><Container maxW="container.lg" mx="0" ml="auto" p={{ base: 6, lg: 12 }}><VStack alignItems="flex-start" minH="500px"><HStack gap="3"><Icon layerStyle="icon.subtle" boxSize="icon.2xl" color="primary" as={TbCheckbox} /><VStack alignItems="flex-start" gap="0"><Heading size="xl">Order confirmed</Heading><Text>Order ID: {order.ID}</Text></VStack></HStack><Divider my="3" /><Heading size="md">Pickup details</Heading><Text fontWeight="bold">{pickup?.Label || "Pickup"}</Text><Text>{pickup?.ContactName}</Text><Text>{pickup?.Contact}</Text>{pickup?.Notes && <Text>Notes: {pickup.Notes}</Text>}<Divider my="3" /><Text>Fulfillment: Pickup — shipping {order.Currency} 0.00</Text><Text>Tax not calculated in this demo.</Text><Text fontWeight="bold">Simulated payment status: Approved — demo payment, no real charge</Text></VStack></Container></GridItem><GridItem bgColor="blackAlpha.100"><Container maxW="container.sm" mx="0" mr="auto" p={{ base: 6, lg: 12 }}><OrderSummary order={order} lineItems={lineItems} /></Container></GridItem></Grid>;
};
export default OrderConfirmation;
