import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  Container,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useClipboard,
} from "@chakra-ui/react";
import {
  Address,
  LineItem,
  LineItems,
  Me,
  Order,
  Orders,
  Payment,
  Payments,
  RequiredDeep,
} from "ordercloud-javascript-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TbCheckbox, TbCopy, TbPrinter, TbShoppingBag } from "react-icons/tb";
import { useLocation, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../../hooks/currentUser";
import formatPrice from "../../utils/formatPrice";
import {
  getBristanDemoTargetRoute,
  isBristanDemoMarketplaceBuyerContext,
  isBristanDemoSupplierBuyerBulkContext,
} from "../bristan/bristanDemoRoutes";
import OrderSummary from "./OrderSummary";

type DemoPaymentXp = {
  PaymentMethodLabel?: string;
  SafeCardDetails?: {
    Last4?: string;
    CardType?: string;
  };
  Last4?: string;
  CardType?: string;
  AccountReference?: string;
  PurchaseOrderNumber?: string;
};

type Journey = "spares" | "marketplace" | "trade";

const getJourney = (
  username?: string,
  order?: Order,
  lineItems: LineItem[] = [],
): Journey => {
  const catalogId = order?.xp?.CatalogID || order?.xp?.CatalogId;
  if (isBristanDemoMarketplaceBuyerContext(username, catalogId)) return "marketplace";
  if (lineItems.some((lineItem) => lineItem.xp?.MarketplaceSupplierOffer)) return "marketplace";
  if (isBristanDemoSupplierBuyerBulkContext(username, catalogId)) return "trade";
  return "spares";
};

const getPaymentDetails = (
  order?: Order,
  payments: Payment<DemoPaymentXp>[] = [],
  journey: Journey = "spares",
) => {
  const payment = payments.find((item) => item.Accepted) || payments[0];
  const xp = payment?.xp || {};
  const isAccountOnFile =
    payment?.Type === "PurchaseOrder" ||
    xp.AccountReference === "BRISTAN-ACCOUNT-ON-FILE" ||
    journey === "trade";
  const last4 = xp.SafeCardDetails?.Last4 || xp.Last4;
  const cardType = xp.SafeCardDetails?.CardType || xp.CardType;

  if (isAccountOnFile) {
    return {
      label: "Pay by account on file",
      status: payment?.Accepted === false ? "Authorized" : "Accepted",
      reference: xp.AccountReference || xp.PurchaseOrderNumber || "BRISTAN-ACCOUNT-ON-FILE",
      badge: "Account on file",
    };
  }

  return {
    label: order?.xp?.PaymentMethod || xp.PaymentMethodLabel || "Demo credit card",
    status: payment?.Accepted === false ? "Authorized" : "Accepted",
    reference: last4 ? `${cardType || "Demo card"} ending in ${last4}` : "Safe demo card authorization",
    badge: "Credit card",
  };
};

const formatOrderDate = (date?: string) => {
  if (!date) return undefined;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
};

const formatAddress = (address?: Address) => {
  if (!address) return [];
  return [
    [address.Street1, address.Street2].filter(Boolean).join(" "),
    [address.City, address.State, address.Zip].filter(Boolean).join(", "),
    address.Country,
  ].filter(Boolean);
};

const OrderConfirmation = (): JSX.Element => {
  const [loading, setLoading] = useState(true);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [order, setOrder] = useState<RequiredDeep<Order>>();
  const [payments, setPayments] = useState<Payment<DemoPaymentXp>[]>([]);
  const [shippingAddress, setShippingAddress] = useState<Address>();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const { hasCopied, onCopy } = useClipboard(order?.ID || "");

  const username = currentUser?.Username || order?.FromUser?.Username;
  const journey = useMemo(() => getJourney(username, order, lineItems), [lineItems, order, username]);
  const paymentDetails = useMemo(
    () => getPaymentDetails(order, payments, journey),
    [journey, order, payments],
  );
  const orderDate = formatOrderDate(order?.DateSubmitted || order?.DateCreated);
  const shippingLines = formatAddress(shippingAddress);
  const continueShoppingRoute = getBristanDemoTargetRoute(username) || "/products";
  const fulfillmentNote =
    journey === "marketplace"
      ? "Your selected merchant offer has been captured with the order."
      : journey === "trade"
        ? "Your trade account order has been submitted for fulfillment."
        : "Your spare parts order is ready for processing.";

  const getOrder = useCallback(async () => {
    const searchParams = new URLSearchParams(location.search);
    const orderId = searchParams.get("orderID");

    if (!orderId) {
      console.error("Order ID not found in URL");
      setLoading(false);
      return;
    }

    const result = await Orders.Get("Outgoing", orderId);
    setOrder(result);
    setLoading(false);
  }, [location.search]);

  const getLineItems = useCallback(async () => {
    if (!order?.ID) return;
    const result = await LineItems.List("Outgoing", order.ID);
    setLineItems(result.Items);
  }, [order]);

  const getPayments = useCallback(async () => {
    if (!order?.ID) return;
    const result = await Payments.List<Payment<DemoPaymentXp>>("Outgoing", order.ID);
    setPayments(result.Items);
  }, [order]);

  const getShippingAddress = useCallback(async () => {
    if (!order?.ShippingAddressID) return;
    const addressResult = await Me.GetAddress(order.ShippingAddressID);
    setShippingAddress(addressResult);
  }, [order]);

  useEffect(() => {
    getOrder();
  }, [getOrder]);

  useEffect(() => {
    getLineItems();
    getPayments();
    getShippingAddress();
  }, [order, getLineItems, getPayments, getShippingAddress]);

  if (loading) {
    return (
      <Container maxW="container.lg" centerContent py={16}>
        <Spinner size="xl" />
      </Container>
    );
  }

  if (!order) {
    return (
      <Container maxW="container.lg" centerContent py={16}>
        <Heading>Order not found</Heading>
        <Text>
          We couldn't find the order information. Please check the URL and try
          again.
        </Text>
      </Container>
    );
  }

  return (
    <Box bg="gray.50" minH="100vh" w="full" py={{ base: 6, lg: 10 }}>
      <Container maxW="container.xl">
        <Grid templateColumns={{ base: "1fr", lg: "minmax(0, 1.25fr) minmax(380px, .75fr)" }} gap={8}>
          <GridItem>
            <Stack spacing={6}>
              <Card borderTopWidth="6px" borderTopColor="primary">
                <CardBody>
                  <HStack gap={4} align="flex-start">
                    <Icon as={TbCheckbox} boxSize={12} color="primary" aria-hidden />
                    <Stack spacing={2}>
                      <Heading as="h1" size="xl">Order confirmed</Heading>
                      <Text fontSize="lg">Your Bristan order has been placed successfully.</Text>
                      <HStack flexWrap="wrap" gap={3}>
                        <Text fontWeight="semibold">Order ID: {order.ID}</Text>
                        <Button size="xs" leftIcon={<TbCopy />} variant="outline" onClick={onCopy}>
                          {hasCopied ? "Copied" : "Copy order ID"}
                        </Button>
                        {orderDate && <Badge colorScheme="green">{orderDate}</Badge>}
                      </HStack>
                      <Text color="gray.700">
                        {order.FromUser?.FirstName} {order.FromUser?.LastName}
                        {order.FromCompanyID ? ` · ${order.FromCompanyID}` : ""}
                      </Text>
                    </Stack>
                  </HStack>
                </CardBody>
              </Card>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
                <Card><CardBody><Stack spacing={3}>
                  <Heading as="h2" size="md">Payment details</Heading>
                  <HStack><Badge colorScheme={journey === "trade" ? "purple" : "blue"}>{paymentDetails.badge}</Badge><Badge colorScheme="green">{paymentDetails.status}</Badge></HStack>
                  <Text fontWeight="semibold">{paymentDetails.label}</Text>
                  <Text color="gray.700">{paymentDetails.reference}</Text>
                </Stack></CardBody></Card>

                <Card><CardBody><Stack spacing={3}>
                  <Heading as="h2" size="md">Shipping and fulfillment</Heading>
                  <Text fontWeight="semibold">{order.ShippingCost && order.ShippingCost > 0 ? "Standard Shipping" : "Free Shipping"}</Text>
                  {typeof order.ShippingCost === "number" && <Text>Shipping cost: {formatPrice(order.ShippingCost)}</Text>}
                  {shippingLines.length > 0 && <Box>{shippingLines.map((line) => <Text key={line} color="gray.700">{line}</Text>)}</Box>}
                  <Text>{fulfillmentNote}</Text>
                </Stack></CardBody></Card>
              </SimpleGrid>

              <Card><CardBody><Stack spacing={4}>
                <Heading as="h2" size="md">What happens next</Heading>
                {[
                  "Order received",
                  journey === "trade" ? "Trade account terms applied" : journey === "marketplace" ? "Payment accepted and merchant selection recorded" : "Payment accepted",
                  journey === "spares" ? "Parts order ready for processing" : "Fulfillment begins",
                ].map((step, index) => (
                  <HStack key={step} align="flex-start">
                    <Badge borderRadius="full" colorScheme="green">{index + 1}</Badge>
                    <Text fontWeight="medium">{step}</Text>
                  </HStack>
                ))}
              </Stack></CardBody></Card>

              <ButtonGroup flexWrap="wrap" gap={3}>
                <Button leftIcon={<TbShoppingBag />} onClick={() => navigate(continueShoppingRoute)}>Continue shopping</Button>
                <Button variant="outline" onClick={() => navigate("/orders")}>View My Orders</Button>
                <Button variant="outline" leftIcon={<TbPrinter />} onClick={() => window.print()}>Print confirmation</Button>
              </ButtonGroup>
            </Stack>
          </GridItem>
          <GridItem>
            <Box position={{ lg: "sticky" }} top={{ lg: 6 }}>
              <Card>
                <CardBody>
                  <OrderSummary order={order} lineItems={lineItems} journey={journey} continueShoppingRoute={continueShoppingRoute} />
                </CardBody>
              </Card>
            </Box>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default OrderConfirmation;
