import {
  Badge,
  Box,
  Button,
  Center,
  Collapse,
  Container,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Skeleton,
  Spinner,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LineItem, LineItems, Me, Order } from "ordercloud-javascript-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { FiCalendar, FiPackage, FiTruck } from "react-icons/fi";
import { formatDate } from "../../utils/formatDate";
import formatPrice from "../../utils/formatPrice";

type LineItemState = {
  loading: boolean;
  loaded: boolean;
  error: boolean;
  items: LineItem[];
};

const defaultLineItemState: LineItemState = {
  loading: false,
  loaded: false,
  error: false,
  items: [],
};

const toDisplayStatus = (status?: string) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "Unknown";

const toSellerDisplay = (sellerID?: string) => {
  if (!sellerID) return "Seller unavailable";
  const clean = sellerID.replace(/[-_]/g, " ").trim();
  return clean
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const isReorderEligible = (order: Order) =>
  order.IsSubmitted || (order.Status || "").toLowerCase() === "submitted";

const getOrderTotal = (order: Order) => {
  if (typeof order.Total === "number") return order.Total;
  return (order.Subtotal || 0) + (order.ShippingCost || 0) + (order.TaxCost || 0);
};

const MyOrders = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [lineItemStateByOrder, setLineItemStateByOrder] = useState<Record<string, LineItemState>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await Me.ListOrders({ sortBy: ["!DateCreated"], pageSize: 20 });
      setOrders(result.Items || []);
    } catch (e) {
      console.error("Failed to load buyer orders", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const summary = useMemo(() => {
    const openOrders = orders.filter((o) => (o.Status || "").toLowerCase() === "open").length;
    const mostRecent = orders[0]?.DateSubmitted || orders[0]?.DateCreated;
    return {
      totalOrders: orders.length,
      openOrders,
      mostRecent,
    };
  }, [orders]);

  const loadLineItems = async (orderID: string) => {
    setLineItemStateByOrder((prev) => ({
      ...prev,
      [orderID]: { ...(prev[orderID] || defaultLineItemState), loading: true, error: false },
    }));

    try {
      const result = await LineItems.List("Outgoing", orderID, { pageSize: 100 });
      setLineItemStateByOrder((prev) => ({
        ...prev,
        [orderID]: {
          loading: false,
          loaded: true,
          error: false,
          items: result.Items || [],
        },
      }));
    } catch (e) {
      console.error(`Failed to load line items for order ${orderID}`, e);
      setLineItemStateByOrder((prev) => ({
        ...prev,
        [orderID]: { ...(prev[orderID] || defaultLineItemState), loading: false, loaded: true, error: true },
      }));
    }
  };

  const toggleOrderDetails = async (orderID: string) => {
    const nextExpanded = !expandedOrders[orderID];
    setExpandedOrders((prev) => ({ ...prev, [orderID]: nextExpanded }));

    const lineItemState = lineItemStateByOrder[orderID];
    if (nextExpanded && !lineItemState?.loaded && !lineItemState?.loading) {
      await loadLineItems(orderID);
    }
  };

  if (loading) {
    return (
      <Container maxW="container.xl" py={{ base: 6, md: 10 }}>
        <VStack align="stretch" spacing={4}>
          <Skeleton height="26px" width="180px" />
          <Skeleton height="20px" width="460px" maxW="100%" />
          {[...Array(3)].map((_, idx) => (
            <Skeleton key={idx} h="156px" borderRadius="xl" />
          ))}
        </VStack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxW="container.lg" py={8}>
        <Heading size="lg" mb={3}>
          My Orders
        </Heading>
        <Text color="chakra-subtle-text" mb={4}>
          We couldn&apos;t load your orders right now.
        </Text>
        <Button onClick={loadOrders} colorScheme="blue">
          Retry
        </Button>
      </Container>
    );
  }

  return (
    <Box bg="gray.50" minH="calc(100vh - 120px)">
      <Container maxW="container.xl" py={{ base: 6, md: 10 }}>
        <VStack align="stretch" spacing={6}>
          <Box>
            <Heading size="lg">My Orders</Heading>
            <Text mt={2} color="chakra-subtle-text">
              Review recent purchases, seller details, order totals, and fulfillment status.
            </Text>
          </Box>

          {orders.length > 0 ? (
            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
              <Box bg="white" borderWidth="1px" borderColor="gray.200" rounded="xl" p={4}>
                <Stat>
                  <StatLabel>Total orders</StatLabel>
                  <StatNumber>{summary.totalOrders}</StatNumber>
                </Stat>
              </Box>
              <Box bg="white" borderWidth="1px" borderColor="gray.200" rounded="xl" p={4}>
                <Stat>
                  <StatLabel>Open orders</StatLabel>
                  <StatNumber>{summary.openOrders}</StatNumber>
                </Stat>
              </Box>
              <Box bg="white" borderWidth="1px" borderColor="gray.200" rounded="xl" p={4}>
                <Stat>
                  <StatLabel>Most recent</StatLabel>
                  <StatNumber fontSize="lg">{summary.mostRecent ? formatDate(summary.mostRecent) : "N/A"}</StatNumber>
                </Stat>
              </Box>
            </Grid>
          ) : null}

          {orders.length === 0 ? (
            <Center>
              <Box
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                rounded="2xl"
                p={{ base: 6, md: 8 }}
                maxW="2xl"
                textAlign="center"
                boxShadow="sm"
              >
                <Heading size="md" mb={2}>
                  No orders yet
                </Heading>
                <Text color="chakra-subtle-text" mb={6}>
                  Orders you place will appear here for review.
                </Text>
                <Button as={RouterLink} to="/products" colorScheme="blue" size="md">
                  Start shopping
                </Button>
              </Box>
            </Center>
          ) : (
            <Stack gap={4}>
              {orders.map((order) => {
                if (!order.ID) return null;
                const orderID = order.ID;
                const lineItemState = lineItemStateByOrder[orderID] || defaultLineItemState;
                const isExpanded = Boolean(expandedOrders[orderID]);

                return (
                  <Box key={orderID} bg="white" borderWidth="1px" borderColor="gray.200" rounded="2xl" p={5} boxShadow="sm">
                    <Grid templateColumns={{ base: "1fr", lg: "2fr 2fr 1fr" }} gap={5}>
                      <GridItem>
                        <Text fontSize="xs" textTransform="uppercase" color="gray.500" letterSpacing="wide">
                          Order ID
                        </Text>
                        <Heading size="sm" mt={1}>{orderID}</Heading>
                        <HStack mt={3} color="gray.600" fontSize="sm">
                          <Icon as={FiCalendar} />
                          <Text>Submitted: {formatDate(order.DateSubmitted || order.DateCreated || "")}</Text>
                        </HStack>
                        <HStack mt={2} color="gray.600" fontSize="sm">
                          <Icon as={FiTruck} />
                          <Text>Seller: {toSellerDisplay(order.ToCompanyID)}</Text>
                        </HStack>
                      </GridItem>

                      <GridItem>
                        <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap={2}>
                          <Text color="gray.500" fontSize="sm">Subtotal</Text>
                          <Text textAlign="right" fontSize="sm">{formatPrice(order.Subtotal || 0)}</Text>
                          <Text color="gray.500" fontSize="sm">Shipping</Text>
                          <Text textAlign="right" fontSize="sm">{formatPrice(order.ShippingCost || 0)}</Text>
                          <Text color="gray.500" fontSize="sm">Tax</Text>
                          <Text textAlign="right" fontSize="sm">{formatPrice(order.TaxCost || 0)}</Text>
                          <Text color="gray.500" fontSize="sm">Status</Text>
                          <Text textAlign="right" fontSize="sm">{toDisplayStatus(order.Status)}</Text>
                        </Grid>
                      </GridItem>

                      <GridItem>
                        <VStack align={{ base: "start", lg: "end" }} spacing={3}>
                          <Badge px={3} py={1} rounded="full" colorScheme={toDisplayStatus(order.Status) === "Open" ? "blue" : "green"}>
                            {toDisplayStatus(order.Status)}
                          </Badge>
                          <Box textAlign={{ base: "left", lg: "right" }}>
                            <Text fontSize="xs" color="gray.500">Order total</Text>
                            <Text fontSize="2xl" fontWeight="bold" color="gray.900">{formatPrice(getOrderTotal(order))}</Text>
                          </Box>
                          <HStack spacing={2}>
                            {isReorderEligible(order) ? (
                              <Button
                                as={RouterLink}
                                to={`/orders/${orderID}/reorder-preview`}
                                size="sm"
                                colorScheme="green"
                                variant="outline"
                                _focusVisible={{ boxShadow: "outline" }}
                              >
                                Reorder
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              colorScheme="blue"
                              variant={isExpanded ? "solid" : "outline"}
                              onClick={() => toggleOrderDetails(orderID)}
                              _focusVisible={{ boxShadow: "outline" }}
                            >
                              {isExpanded ? "Hide details" : "View details"}
                            </Button>
                          </HStack>
                        </VStack>
                      </GridItem>
                    </Grid>

                    <Collapse in={isExpanded} animateOpacity>
                      <Box mt={4} borderTopWidth="1px" borderColor="gray.100" pt={4}>
                        {lineItemState.loading ? (
                          <HStack color="gray.500"><Spinner size="sm" /><Text fontSize="sm">Loading line items...</Text></HStack>
                        ) : lineItemState.error ? (
                          <Text fontSize="sm" color="gray.500">We couldn&apos;t load line items for this order.</Text>
                        ) : lineItemState.items.length === 0 ? (
                          <Text fontSize="sm" color="gray.500">No line items found for this order.</Text>
                        ) : (
                          <Stack spacing={2}>
                            {lineItemState.items.map((item: LineItem) => (
                              <Box key={item.ID} borderWidth="1px" borderColor="gray.100" rounded="lg" p={3}>
                                <HStack justify="space-between" align="start" spacing={4}>
                                  <VStack align="start" spacing={1}>
                                    <HStack><Icon as={FiPackage} color="gray.500" /><Text fontWeight="medium">{item.Product?.Name || "Unnamed product"}</Text></HStack>
                                    <Text fontSize="sm" color="gray.500">Product ID: {item.ProductID || "N/A"}</Text>
                                    {item.SupplierID ? <Text fontSize="sm" color="gray.500">Supplier: {item.SupplierID}</Text> : null}
                                  </VStack>
                                  <VStack align="end" spacing={1}>
                                    <Text fontSize="sm" color="gray.500">Qty: {item.Quantity || 0}</Text>
                                    <Text fontSize="sm" color="gray.500">Unit: {formatPrice(item.UnitPrice || 0)}</Text>
                                    <Text fontWeight="semibold">{formatPrice((item.LineTotal as number) || 0)}</Text>
                                  </VStack>
                                </HStack>
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Collapse>
                  </Box>
                );
              })}
            </Stack>
          )}
        </VStack>
      </Container>
    </Box>
  );
};

export default MyOrders;
