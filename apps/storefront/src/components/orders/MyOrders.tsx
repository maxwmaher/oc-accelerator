import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  LineItem,
  LineItems,
  Me,
  Order,
  Orders,
} from "ordercloud-javascript-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { isDelegatedRaiDemoContext } from "../../demo/raiDemoContexts";
import { useRaiDemoContext } from "../../hooks/useRaiDemoContext";
import formatPrice from "../../utils/formatPrice";
import {
  formatServiceDetails,
  getMomentusOrderReference,
  getSupplierRoute,
  RaiServiceDetailsType,
} from "../cart/OrderConfirmation";

type OrderWithLineItems = Order & { LineItems?: LineItem[] };

const getOrderRaiContext = (order: OrderWithLineItems) => {
  const capturedFor = order.LineItems?.map(
    (lineItem) => (lineItem.xp as any)?.RAI?.CapturedFor,
  ).find(Boolean);

  return {
    eventId: capturedFor?.EventID || "Unassigned event",
    exhibitorId: capturedFor?.ExhibitorID || "Unassigned exhibitor",
    hall: capturedFor?.Hall || "—",
    standNumber: capturedFor?.StandNumber || "Unassigned stand",
  };
};

const getOrderDelegation = (order: OrderWithLineItems) =>
  order.LineItems?.map(
    (lineItem) => (lineItem.xp as any)?.RAI?.Delegation,
  ).find((delegation) => delegation?.DelegatedOrder);

const getPaymentMethod = (order: Order) => {
  const method = (order.xp as any)?.RAI?.Payment?.Method;
  if (method === "card") return "Pay now by card";
  return (order.xp as any)?.PaymentMethod || "Pay by invoice";
};

const getOrderDate = (order: Order) =>
  order.DateSubmitted || order.DateCreated || order.DateApproved || "—";

const formatOrderDate = (date?: string) => {
  if (!date || date === "—") return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
};

const listOutgoingOrders = async () => {
  if (typeof (Me as any).ListOrders === "function") {
    return (Me as any).ListOrders({ pageSize: 100 });
  }

  // Safe demo fallback for shopper-authenticated contexts where Me.ListOrders is
  // not exposed by the installed SDK version.
  return Orders.List("Outgoing", { pageSize: 100 } as any);
};

const MyOrders = (): JSX.Element => {
  const [orders, setOrders] = useState<OrderWithLineItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const { selectedContext: activeContext } = useRaiDemoContext();
  const isDelegated = isDelegatedRaiDemoContext(activeContext);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await listOutgoingOrders();
      const orderItems: Order[] = result.Items || [];
      const withLineItems = await Promise.all(
        orderItems.map(async (order) => {
          if (!order.ID) return order;
          try {
            const lineItems = await LineItems.List("Outgoing", order.ID);
            return { ...order, LineItems: lineItems.Items || [] };
          } catch (lineItemError) {
            console.warn("Unable to load order line items", lineItemError);
            return order;
          }
        }),
      );

      setOrders(withLineItems);
    } catch (ordersError) {
      console.error("Unable to load outgoing orders", ordersError);
      setError("We could not load your orders right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const currentContextOrders = useMemo(
    () =>
      orders.filter((order) => {
        const raiContext = getOrderRaiContext(order);
        return (
          raiContext.eventId === activeContext.eventId &&
          raiContext.exhibitorId === activeContext.exhibitorId &&
          raiContext.hall === activeContext.hall &&
          raiContext.standNumber === activeContext.standNumber
        );
      }),
    [
      activeContext.accountId,
      activeContext.actingOnBehalfOfAccountId,
      activeContext.delegationId,
      activeContext.eventId,
      activeContext.exhibitorId,
      activeContext.hall,
      activeContext.id,
      activeContext.standNumber,
      orders,
    ],
  );

  const groupedOrders = useMemo(() => {
    return currentContextOrders.reduce<Record<string, OrderWithLineItems[]>>(
      (groups, order) => {
        const raiContext = getOrderRaiContext(order);
        const key = `${raiContext.eventId}__${raiContext.standNumber}__${raiContext.exhibitorId}`;
        groups[key] = [...(groups[key] || []), order];
        return groups;
      },
      {},
    );
  }, [currentContextOrders]);

  return (
    <Container maxW="container.xl" py={{ base: 6, md: 10 }}>
      <VStack align="stretch" spacing={6}>
        <Stack
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          spacing={4}
        >
          <Box>
            <Heading size="xl">My orders</Heading>
            <Text color="chakra-subtle-text" mt={2}>
              Order history grouped by RAI event, stand, and ExhibitorID.
            </Text>
          </Box>
          <Button
            as={RouterLink}
            to="/products"
            colorScheme="blue"
            alignSelf="flex-start"
          >
            Continue shopping
          </Button>
        </Stack>

        <Box
          border="1px solid"
          borderColor="blackAlpha.200"
          rounded="xl"
          p={5}
          bg="white"
        >
          {/* Demo-only: Production filtering would use Momentus AccountID, ExhibitorID, event, stand, and delegated-access relationships from the profile service / middleware. */}
          <HStack spacing={2} mb={3} flexWrap="wrap">
            <Badge colorScheme="purple" variant="subtle">
              Active RAI context
            </Badge>
            {isDelegated && (
              <Badge colorScheme="orange" variant="subtle">
                Delegated ordering
              </Badge>
            )}
          </HStack>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
            <Text>
              <Text as="span" fontWeight="700">
                Company:
              </Text>{" "}
              {isDelegated
                ? activeContext.actorCompanyName
                : activeContext.companyName}
            </Text>
            <Text>
              <Text as="span" fontWeight="700">
                Event:
              </Text>{" "}
              {activeContext.eventName}
            </Text>
            <Text>
              <Text as="span" fontWeight="700">
                ExhibitorID:
              </Text>{" "}
              {activeContext.exhibitorId}
            </Text>
            <Text>
              <Text as="span" fontWeight="700">
                Hall:
              </Text>{" "}
              {activeContext.hall}
            </Text>
            <Text>
              <Text as="span" fontWeight="700">
                Stand number:
              </Text>{" "}
              {activeContext.standNumber}
            </Text>
            <Text>
              <Text as="span" fontWeight="700">
                AccountID:
              </Text>{" "}
              {activeContext.accountId}
            </Text>
          </SimpleGrid>
          {isDelegated && (
            <Alert status="info" rounded="md" mt={4}>
              <AlertIcon />
              Ordering on behalf of {activeContext.actingOnBehalfOfCompanyName}
            </Alert>
          )}
        </Box>

        {loading && <Spinner size="xl" alignSelf="center" />}
        {error && (
          <Alert status="error" rounded="md">
            <AlertIcon />
            {error}
          </Alert>
        )}

        {!loading && !error && currentContextOrders.length === 0 && (
          <Box
            textAlign="center"
            border="1px dashed"
            borderColor="blackAlpha.300"
            rounded="xl"
            py={12}
            px={6}
          >
            <Heading size="md" mb={3}>
              No orders for this event and stand yet.
            </Heading>
            <Button as={RouterLink} to="/products" colorScheme="blue">
              Continue shopping
            </Button>
          </Box>
        )}

        {Object.entries(groupedOrders).map(([groupKey, groupOrders]) => {
          const groupContext = getOrderRaiContext(groupOrders[0]);
          return (
            <VStack key={groupKey} align="stretch" spacing={4}>
              <Heading size="md">
                {groupContext.eventId} · {groupContext.hall} · Stand{" "}
                {groupContext.standNumber} · {groupContext.exhibitorId}
              </Heading>
              {groupOrders.map((order) => {
                const delegation = getOrderDelegation(order);
                return (
                  <Box
                    key={order.ID}
                    border="1px solid"
                    borderColor="blackAlpha.200"
                    rounded="xl"
                    p={5}
                    bg="white"
                    shadow="sm"
                  >
                    <Stack
                      direction={{ base: "column", lg: "row" }}
                      justify="space-between"
                      spacing={4}
                    >
                      <VStack align="start" spacing={1}>
                        <Heading size="sm">Order ID: {order.ID}</Heading>
                        <Text fontSize="sm" color="chakra-subtle-text">
                          Momentus Order: {getMomentusOrderReference(order.ID)}
                        </Text>
                        <Text fontSize="sm">
                          Date: {formatOrderDate(getOrderDate(order))}
                        </Text>
                      </VStack>
                      <VStack align={{ base: "start", lg: "end" }} spacing={2}>
                        <Badge colorScheme="blue" variant="subtle">
                          {order.Status || "Open"}
                        </Badge>
                        <Text fontWeight="700">{formatPrice(order.Total)}</Text>
                        <Text fontSize="sm">
                          Payment method: {getPaymentMethod(order)}
                        </Text>
                        <Badge
                          colorScheme={order.DateSubmitted ? "green" : "purple"}
                          variant="subtle"
                        >
                          {order.DateSubmitted
                            ? "Confirmed in Momentus (mocked)"
                            : "Queued for Momentus"}
                        </Badge>
                      </VStack>
                    </Stack>

                    {delegation?.DelegatedOrder && (
                      <Box
                        bg="purple.50"
                        border="1px solid"
                        borderColor="purple.100"
                        rounded="md"
                        p={3}
                        mt={4}
                      >
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={1}>
                          <Text fontSize="sm">
                            Ordered by: {delegation.ActorCompanyName}
                          </Text>
                          <Text fontSize="sm">
                            Ordering for:{" "}
                            {delegation.ActingOnBehalfOfCompanyName}
                          </Text>
                          <Text fontSize="sm">
                            DelegationID: {delegation.DelegationID}
                          </Text>
                          <Text fontSize="sm">
                            Invoice attribution: {delegation.InvoiceTo}
                          </Text>
                        </SimpleGrid>
                      </Box>
                    )}

                    {Boolean(order.LineItems?.length) && (
                      <VStack align="stretch" spacing={3} mt={4}>
                        <Divider />
                        {order.LineItems?.map((lineItem) => {
                          const rai = (lineItem.xp as any)?.RAI;
                          const type = rai?.ServiceDetailsType as
                            | RaiServiceDetailsType
                            | undefined;
                          return (
                            <HStack
                              key={lineItem.ID || lineItem.ProductID}
                              justify="space-between"
                              align="start"
                              spacing={4}
                            >
                              <Box>
                                <Text fontWeight="700" fontSize="sm">
                                  {lineItem.Product?.Name || lineItem.ProductID}
                                </Text>
                                <Text fontSize="xs" color="chakra-subtle-text">
                                  Supplier route: {getSupplierRoute(type)}
                                </Text>
                                <Text fontSize="xs" color="chakra-subtle-text">
                                  {formatServiceDetails(
                                    type,
                                    rai?.ServiceDetails,
                                  )}
                                </Text>
                              </Box>
                              <Badge colorScheme="blue" variant="subtle">
                                Qty {lineItem.Quantity}
                              </Badge>
                            </HStack>
                          );
                        })}
                      </VStack>
                    )}
                  </Box>
                );
              })}
            </VStack>
          );
        })}

        <Text fontSize="sm" color="chakra-subtle-text">
          Order changes are handled by RAI Exhibitor Services after submission.
        </Text>
      </VStack>
    </Container>
  );
};

export default MyOrders;
