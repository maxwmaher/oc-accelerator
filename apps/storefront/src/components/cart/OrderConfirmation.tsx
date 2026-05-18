import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Container,
  Divider,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  Address,
  LineItem,
  LineItems,
  Me,
  Order,
  Orders,
  RequiredDeep,
} from "ordercloud-javascript-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TbCheckbox } from "react-icons/tb";
import { useLocation } from "react-router-dom";
import OrderSummary from "./OrderSummary";


type HandoffChannel = "direct" | "abc-used" | "nordic-edi";

type HandoffMetadata = {
  fulfillmentSource: string;
  supplier?: string;
  selectedOfferProduct: string;
  orderID: string;
  paymentStatus: string;
};

type HandoffPanelContent = {
  channel: HandoffChannel;
  description: string;
  channelLabel: string;
  metadata: HandoffMetadata;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const getString = (record: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
};

const normalize = (...values: Array<string | undefined>) =>
  values.filter(Boolean).join(" ").toLowerCase();

const hasMeaningfulRecord = (record: Record<string, unknown>) =>
  Object.values(record).some((value) => value !== undefined && value !== null && value !== "");

const getProductHandoffSignals = (lineItem: LineItem) => {
  const product = lineItem.Product;
  const xp = asRecord(product?.xp);
  const supplier = asRecord(xp.supplier);
  const catalogUpdate = asRecord(xp.catalogUpdate);
  const offer = asRecord(xp.offer);
  const condition = xp.condition;

  return {
    productName: product?.Name || lineItem.ProductID,
    supplierName: getString(supplier, "displayName", "name"),
    supplierID: getString(supplier, "id", "supplierID"),
    sellerID: getString(supplier, "sellerID"),
    sellerType: getString(supplier, "sellerType"),
    catalogSource: getString(catalogUpdate, "source", "updateModel", "partnerType"),
    catalogPartner: getString(catalogUpdate, "partner", "partnerName"),
    offerType: getString(offer, "type", "offerType", "source"),
    hasSupplierMetadata: hasMeaningfulRecord(supplier) || hasMeaningfulRecord(offer),
    hasCatalogSyncMetadata: hasMeaningfulRecord(catalogUpdate),
    hasConditionMetadata:
      Boolean(condition) || getString(offer, "condition", "conditionSummary") !== undefined,
  };
};

const getOrderPaymentStatus = (order: RequiredDeep<Order>) => {
  const xp = asRecord(order.xp);
  return (
    getString(xp, "PaymentStatus", "paymentStatus") ||
    (order.IsSubmitted ? "Captured for submitted order" : "Not submitted")
  );
};

const resolveHandoffPanelContent = (
  order: RequiredDeep<Order>,
  lineItems: LineItem[],
): HandoffPanelContent | undefined => {
  const firstProductLineItem = lineItems.find((lineItem) => lineItem.Product);
  if (!order.ID || !firstProductLineItem) return undefined;

  const signals = getProductHandoffSignals(firstProductLineItem);
  if (!signals.productName) return undefined;

  const searchable = normalize(
    order.ToCompanyID,
    signals.supplierID,
    signals.sellerID,
    signals.sellerType,
    signals.supplierName,
    signals.catalogSource,
    signals.catalogPartner,
    signals.offerType,
    signals.hasCatalogSyncMetadata ? "catalog sync edi" : undefined,
    signals.hasConditionMetadata ? "used condition" : undefined,
  );

  let channel: HandoffChannel | undefined;
  if (
    searchable.includes("nordic") ||
    searchable.includes("edi") ||
    searchable.includes("catalog sync")
  ) {
    channel = "nordic-edi";
  } else if (
    searchable.includes("abc") ||
    searchable.includes("used") ||
    searchable.includes("ad hoc") ||
    signals.hasConditionMetadata
  ) {
    channel = "abc-used";
  } else if (
    searchable.includes("admin") ||
    searchable.includes("scania") ||
    searchable.includes("direct") ||
    (!signals.hasSupplierMetadata &&
      !signals.hasCatalogSyncMetadata &&
      !signals.hasConditionMetadata)
  ) {
    channel = "direct";
  }

  if (!channel) return undefined;

  const metadata: HandoffMetadata = {
    fulfillmentSource:
      channel === "direct"
        ? "Scania Direct"
        : channel === "abc-used"
          ? "ABC Used Parts Supplier"
          : "Nordic EDI Supplier",
    supplier: channel === "direct" ? undefined : signals.supplierName || metadataSupplierFallback(channel),
    selectedOfferProduct: signals.productName,
    orderID: order.ID,
    paymentStatus: getOrderPaymentStatus(order),
  };

  if (channel === "abc-used") {
    return {
      channel,
      description:
        "This order preserves the selected used-parts supplier offer, including supplier context, buyer eligibility, selected product, pricing, and fulfillment details for downstream routing.",
      channelLabel: "Ad hoc/used-parts supplier",
      metadata,
    };
  }

  if (channel === "nordic-edi") {
    return {
      channel,
      description:
        "This order preserves the selected catalog-sync/EDI supplier offer, including supplier context, selected product, pricing, and fulfillment details for downstream ERP processing.",
      channelLabel: "Catalog-sync/EDI partner",
      metadata,
    };
  }

  return {
    channel,
    description:
      "This order was captured through the direct OEM channel with admin-managed product, pricing, and fulfillment context ready for downstream processing.",
    channelLabel: "Direct OEM channel",
    metadata,
  };
};

const metadataSupplierFallback = (channel: HandoffChannel) => {
  if (channel === "abc-used") return "ABC Used Parts Supplier";
  if (channel === "nordic-edi") return "Nordic EDI Supplier";
  return undefined;
};

const OrderHandoffPanel = ({ content }: { content: HandoffPanelContent }) => {
  const metadataRows = [
    ["Fulfillment source", content.metadata.fulfillmentSource],
    ["Supplier", content.metadata.supplier],
    ["Selected offer product", content.metadata.selectedOfferProduct],
    ["Order ID", content.metadata.orderID],
    ["Payment status", content.metadata.paymentStatus],
    ["Downstream status", "Ready for handoff"],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <Alert status="info" variant="subtle" rounded="md" alignItems="flex-start">
      <AlertIcon mt={1} />
      <Stack spacing={3} w="full">
        <Stack spacing={2}>
          <HStack alignItems="center" gap={2} flexWrap="wrap">
            <AlertTitle>Order ready for ERP/D365 handoff</AlertTitle>
            <Badge colorScheme="blue" variant="subtle">
              {content.channelLabel}
            </Badge>
          </HStack>
          <AlertDescription fontSize="sm">{content.description}</AlertDescription>
        </Stack>
        <Box borderTop="1px solid" borderColor="blackAlpha.200" pt={3}>
          <Text
            fontSize="xs"
            fontWeight="bold"
            color="chakra-subtle-text"
            mb={2}
            textTransform="uppercase"
            letterSpacing="wide"
          >
            Demo metadata
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
            {metadataRows.map(([label, value]) => (
              <Box key={label}>
                <Text fontSize="xs" color="chakra-subtle-text">
                  {label}
                </Text>
                <Text fontSize="sm" fontWeight="semibold">
                  {value}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      </Stack>
    </Alert>
  );
};

const OrderConfirmation = (): JSX.Element => {
  const [loading, setLoading] = useState(true);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [order, setOrder] = useState<RequiredDeep<Order>>();
  const [shippingAddress, setShippingAddress] = useState<Address>();
  const location = useLocation();

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
    getShippingAddress();
  }, [order, getLineItems, getShippingAddress]);

  const handoffContent = useMemo(
    () => (order ? resolveHandoffPanelContent(order, lineItems) : undefined),
    [lineItems, order],
  );

  if (loading) {
    return (
      <Container maxW="container.lg" centerContent>
        <Spinner size="xl" />
      </Container>
    );
  }

  if (!order) {
    return (
      <Container maxW="container.lg" centerContent>
        <Heading>Order not found</Heading>
        <Text>
          We couldn't find the order information. Please check the URL and try
          again.
        </Text>
      </Container>
    );
  }

  return (
    <Grid
      gridTemplateColumns={{ md: "3fr 2fr" }}
      w="full"
      h="100vh"
      justifyItems="stretch"
      flex="1"
    >
      <GridItem alignSelf="flex-end" h="full">
        <Container maxW="container.lg" mx="0" ml="auto" p={{ base: 6, lg: 12 }}>
          <VStack alignItems="flex-start" flex="1" minH="500px">
            <HStack gap="3" alignItems="center">
              <Icon
                layerStyle="icon.subtle"
                boxSize="icon.2xl"
                color="primary"
                as={TbCheckbox}
              />
              <VStack alignItems="flex-start" gap="0">
                <Heading size="xl">Order confirmed</Heading>
                <Text color="chakra-subtle-text">Order ID: {order.ID}</Text>
              </VStack>
            </HStack>
            <Divider my="3" />
            <VStack justifyContent="flex-start" alignItems="flex-start">
              <HStack alignItems="flex-start">
                <VStack alignItems="flex-start" gap="0">
                  <Text fontWeight="bold">
                    {order.FromUser?.FirstName} {order.FromUser?.LastName}
                  </Text>
                  {shippingAddress && (
                    <>
                      <Text>
                        {shippingAddress.Street1} {shippingAddress.Street2}
                      </Text>
                      <Text>
                        {shippingAddress.City}, {shippingAddress.State}{" "}
                        {shippingAddress.Zip}
                      </Text>
                    </>
                  )}
                  <Text mt="3">
                    {order.FromUser?.Phone}
                    {order.FromUser?.Phone && "|"} {order.FromUser?.Email}
                  </Text>
                </VStack>
              </HStack>
            </VStack>
            {handoffContent && (
              <>
                <Divider my="3" />
                <OrderHandoffPanel content={handoffContent} />
              </>
            )}
            <Divider my="3" />
            <Text>
              Shipping Method:{" "}
              {order.ShippingCost > 0 ? "Standard Shipping" : "Free Shipping"}
            </Text>
            <Text>
              Payment Method: {order.xp?.PaymentMethod || "Not specified"}
            </Text>
          </VStack>
        </Container>
      </GridItem>
      <GridItem bgColor="blackAlpha.100" h="full">
        <Container maxW="container.sm" mx="0" mr="auto" p={{ base: 6, lg: 12 }}>
          <OrderSummary order={order} lineItems={lineItems} />
        </Container>
      </GridItem>
    </Grid>
  );
};

export default OrderConfirmation;
