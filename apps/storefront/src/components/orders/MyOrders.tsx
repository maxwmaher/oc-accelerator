import {
  Badge,
  Box,
  Button,
  Center,
  Collapse,
  Container,
  Flex,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LineItem, LineItems, Me, Order } from "ordercloud-javascript-sdk";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
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

const MyOrders = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [lineItemStateByOrder, setLineItemStateByOrder] = useState<Record<string, LineItemState>>({});

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const result = await Me.ListOrders({ sortBy: ["!DateCreated"], pageSize: 20 });
        setOrders(result.Items || []);
      } catch (e) {
        console.error("Failed to load buyer orders", e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, []);

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
      <Center h="40vh">
        <VStack>
          <Spinner size="xl" />
          <Text color="chakra-subtle-text">Loading orders...</Text>
        </VStack>
      </Center>
    );
  }

  if (error) {
    return (
      <Container maxW="container.lg" py={8}>
        <Heading size="lg" mb={6}>
          My Orders
        </Heading>
        <Text>We couldn&apos;t load your orders right now.</Text>
      </Container>
    );
  }

  return (
    <Container maxW="container.lg" py={8}>
      <Heading size="lg" mb={6}>
        My Orders
      </Heading>
      {orders.length === 0 ? (
        <VStack alignItems="flex-start">
          <Text color="chakra-subtle-text">No orders found yet.</Text>
          <Text color="chakra-subtle-text">Orders you place from this portal will appear here.</Text>
          <Button as={RouterLink} to="/products" size="sm">
            Start shopping
          </Button>
        </VStack>
      ) : (
        <Stack gap={4}>
          {orders.map((order) => {
            if (!order.ID) return null;
            const orderID = order.ID;
            const lineItemState = lineItemStateByOrder[orderID] || defaultLineItemState;
            const isExpanded = Boolean(expandedOrders[orderID]);
            return (
              <Box key={orderID} borderWidth="1px" rounded="md" p={4}>
                <Flex justify="space-between" align="start" wrap="wrap" gap={3}>
                  <Box>
                    <Heading size="sm">Order {order.ID}</Heading>
                    <Text color="chakra-subtle-text" fontSize="sm">
                      Submitted: {formatDate(order.DateSubmitted || order.DateCreated || "")}
                    </Text>
                    <Text color="chakra-subtle-text" fontSize="sm">
                      Seller: {order.ToCompanyID || "N/A"}
                    </Text>
                  </Box>
                  <VStack align="end" spacing={1}>
                    <Badge colorScheme={order.Status === "Open" ? "blue" : "green"}>{order.Status || "Unknown"}</Badge>
                    <Text fontWeight="semibold">{formatPrice(order.Total || 0)}</Text>
                  </VStack>
                </Flex>

                <HStack mt={3} spacing={6} fontSize="sm" color="chakra-subtle-text" align="start" wrap="wrap">
                  <Text>Subtotal: {formatPrice(order.Subtotal || 0)}</Text>
                  <Text>Shipping: {formatPrice(order.ShippingCost || 0)}</Text>
                  <Text>Tax: {formatPrice(order.TaxCost || 0)}</Text>
                  <Text>Status: {order.Status || "N/A"}</Text>
                </HStack>

                <Button size="xs" mt={3} variant="outline" onClick={() => toggleOrderDetails(orderID)}>
                  {isExpanded ? "Hide details" : "View details"}
                </Button>

                <Collapse in={isExpanded} animateOpacity>
                  <Box mt={4} borderTopWidth="1px" pt={3}>
                    {lineItemState.loading ? (
                      <Text fontSize="sm" color="chakra-subtle-text">
                        Loading line items...
                      </Text>
                    ) : lineItemState.error ? (
                      <Text fontSize="sm" color="chakra-subtle-text">
                        We couldn&apos;t load line items for this order.
                      </Text>
                    ) : lineItemState.items.length === 0 ? (
                      <Text fontSize="sm" color="chakra-subtle-text">
                        No line items found for this order.
                      </Text>
                    ) : (
                      <Stack spacing={2}>
                        {lineItemState.items.map((item: LineItem) => (
                          <Box key={item.ID} borderWidth="1px" rounded="md" p={3}>
                            <Text fontWeight="medium">{item.Product?.Name || "Unnamed product"}</Text>
                            <Text fontSize="sm" color="chakra-subtle-text">
                              Product ID: {item.ProductID || "N/A"}
                            </Text>
                            <Text fontSize="sm" color="chakra-subtle-text">
                              Quantity: {item.Quantity || 0}
                            </Text>
                            <Text fontSize="sm" color="chakra-subtle-text">
                              Unit price: {formatPrice(item.UnitPrice || 0)}
                            </Text>
                            <Text fontSize="sm" color="chakra-subtle-text">
                              Line total: {formatPrice((item.LineTotal as number) || 0)}
                            </Text>
                            {item.SupplierID ? (
                              <Text fontSize="sm" color="chakra-subtle-text">
                                Supplier: {item.SupplierID}
                              </Text>
                            ) : null}
                            {item.Variant ? (
                              <Text fontSize="sm" color="chakra-subtle-text">
                                Variant: {JSON.stringify(item.Variant)}
                              </Text>
                            ) : null}
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
    </Container>
  );
};

export default MyOrders;
