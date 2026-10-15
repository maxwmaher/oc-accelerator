import { Box, Button, Flex, Grid, Heading, Icon, Link, Spinner, Stack, Text } from "@chakra-ui/react";
import { LineItem, LineItems, Order, Orders, RequiredDeep } from "ordercloud-javascript-sdk";
import { useCallback, useEffect, useState } from "react";
import { TbCheck, TbMapPin } from "react-icons/tb";
import { Link as RouterLink, useLocation } from "react-router-dom";
import formatPrice from "../../utils/formatPrice";
import { DemoNotice, Surface, TradeBrand, TradeFooter } from "../trade/TradePrimitives";
import OrderSummary from "./OrderSummary";
import SubmittedOrderItems from "./SubmittedOrderItems";

const OrderConfirmation = (): JSX.Element => {
  const [loading, setLoading] = useState(true);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [order, setOrder] = useState<RequiredDeep<Order>>();
  const location = useLocation();
  const load = useCallback(async () => {
    const orderID = new URLSearchParams(location.search).get("orderID");
    if (!orderID) { setLoading(false); return; }
    const submitted = await Orders.Get("Outgoing", orderID);
    if (!submitted.IsSubmitted) { setLoading(false); return; }
    setOrder(submitted);
    const lines = await LineItems.List("Outgoing", orderID, { pageSize: 100 });
    setLineItems(lines.Items);
    setLoading(false);
  }, [location.search]);
  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);
  const pickup = order?.xp?.KFMBCheckout?.Pickup;

  return <Flex direction="column" minH="100dvh" bg="trade.ivory">
    <Box as="header" bg="white" borderBottom="1px solid" borderColor="trade.border">
      <Flex maxW="1320px" mx="auto" px={{ base: 4, md: 6, xl: 8 }} py={5} align="center" justify="space-between" gap={4}>
        <Link as={RouterLink} to="/products" _hover={{ textDecoration: "none" }}><TradeBrand /></Link>
        <Text fontSize="sm" color="trade.muted" textAlign="right">Order confirmation</Text>
      </Flex>
    </Box>
    <Box as="main" w="full" maxW="1320px" mx="auto" px={{ base: 4, md: 6, xl: 8 }} py={{ base: 6, md: 10 }} flex={1}>
      {loading ? <Surface py={16} textAlign="center"><Spinner size="lg" color="trade.ink" /><Text mt={4} role="status">Loading your submitted order…</Text></Surface> : !order ?
        <Surface maxW="720px" mx="auto" py={12}><Stack align="flex-start" spacing={4}><Heading as="h1" size="xl">Order not confirmed</Heading><Text color="trade.muted">Submission did not complete. Return to the cart and retry.</Text><Button as={RouterLink} to="/cart">Return to cart</Button></Stack></Surface> : <>
          <Flex align="flex-start" gap={4} mb={{ base: 6, md: 8 }}>
            <Flex flexShrink={0} bg="green.100" color="green.800" borderRadius="full" boxSize={{ base: 11, md: 14 }} justify="center" align="center"><Icon as={TbCheck} boxSize={7} /></Flex>
            <Stack spacing={2} minW={0}><Heading as="h1" size={{ base: "xl", md: "2xl" }}>Order confirmed</Heading><Text color="trade.muted">Your submitted order is recorded below.</Text><Text fontSize="sm" overflowWrap="anywhere"><Text as="span" color="trade.muted">Order ID: </Text><Text as="span" fontWeight="semibold" color="trade.ink">{order.ID}</Text></Text></Stack>
          </Flex>
          <Grid templateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 360px" }} gap={{ base: 6, xl: 8 }} alignItems="start">
            <Stack spacing={6} minW={0}>
              <Surface><Stack spacing={5}>
                <Flex align="center" gap={2}><Icon as={TbMapPin} color="trade.gold" boxSize={5} /><Heading as="h2" size="md">Pickup details</Heading></Flex>
                <Grid templateColumns={{ base: "minmax(0, 1fr)", md: "1fr 1fr" }} gap={5}>
                  <Stack spacing={1}><Text fontSize="sm" color="trade.muted">Pickup location</Text><Text fontWeight="semibold">{pickup?.Label || "Pickup"}</Text>{pickup?.Country && <Text fontSize="sm" color="trade.muted">Country: {pickup.Country}</Text>}</Stack>
                  <Stack spacing={1}><Text fontSize="sm" color="trade.muted">Pickup contact</Text><Text fontWeight="semibold" overflowWrap="anywhere">{pickup?.ContactName || "Not provided"}</Text><Text overflowWrap="anywhere">{pickup?.Contact || "Not provided"}</Text></Stack>
                </Grid>
                {pickup?.Notes && <Box><Text fontSize="sm" color="trade.muted" mb={1}>Order notes</Text><Text whiteSpace="pre-wrap" overflowWrap="anywhere">{pickup.Notes}</Text></Box>}
                <Text fontSize="sm" color="trade.muted">Fulfillment: Pickup — shipping {formatPrice(order.ShippingCost ?? 0, order.Currency)}</Text>
              </Stack></Surface>
              <DemoNotice><Text fontWeight="semibold" color="trade.ink" mb={1}>Simulated payment status: Approved — demo payment, no real charge</Text><Text>This order used the demonstration payment flow.</Text></DemoNotice>
              <Surface><Heading as="h2" size="md" mb={1}>Ordered items <Text as="span" color="trade.muted" fontWeight="normal">({lineItems.length})</Text></Heading><SubmittedOrderItems lineItems={lineItems} currency={order.Currency} /></Surface>
            </Stack>
            <Box minW={0}><OrderSummary order={order} /></Box>
          </Grid>
        </>}
    </Box>
    <TradeFooter />
  </Flex>;
};
export default OrderConfirmation;
