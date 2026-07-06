import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Container,
  Divider,
  HStack,
  Heading,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useShopper } from "@ordercloud/react-sdk";
import { Address, LineItem, LineItems, Me, Order } from "ordercloud-javascript-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import formatPrice from "../../utils/formatPrice";

interface OrderWithLineItems {
  order: Order;
  lineItems: LineItem[];
  shippingAddress?: Address;
}

const submittedStatuses = new Set([
  "Submitted",
  "AwaitingApproval",
  "Open",
  "Completed",
  "Canceled",
  "Declined",
]);

const formatDate = (date?: string) => {
  if (!date) return "Not submitted yet";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
};

const shippingSummary = (address?: Address) => {
  if (!address) return "Shipping address not available";
  return [address.Street1, address.City, address.State, address.Zip]
    .filter(Boolean)
    .join(", ");
};

const MyOrders = () => {
  const [orders, setOrders] = useState<OrderWithLineItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [reorderingOrderId, setReorderingOrderId] = useState<string>();
  const { addCartLineItem } = useShopper();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    let isMounted = true;

    const loadOrders = async () => {
      try {
        setLoading(true);
        setError(undefined);
        const result = await Me.ListOrders<Order>({
          pageSize: 100,
          sortBy: ["!DateSubmitted", "!DateCreated"],
        });
        const submittedOrders = (result.Items || []).filter(
          (order) =>
            order.ID &&
            order.IsSubmitted !== false &&
            order.Status &&
            submittedStatuses.has(order.Status),
        );

        const ordersWithLineItems = await Promise.all(
          submittedOrders.map(async (order) => {
            const [lineItemResult, shippingAddress] = await Promise.all([
              LineItems.List("Outgoing", order.ID!, { pageSize: 100 }),
              order.ShippingAddressID
                ? Me.GetAddress(order.ShippingAddressID)
                : Promise.resolve(undefined),
            ]);
            return {
              order,
              lineItems: lineItemResult.Items || [],
              shippingAddress,
            };
          }),
        );

        if (isMounted) {
          setOrders(ordersWithLineItems);
        }
      } catch (err) {
        console.error("Failed to load orders:", err);
        if (isMounted) {
          setError("We couldn't load your orders. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadOrders();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleDetails = useCallback((orderId: string) => {
    setExpandedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const reorder = useCallback(
    async ({ order, lineItems }: OrderWithLineItems) => {
      if (!order.ID) return;
      setReorderingOrderId(order.ID);
      let addedCount = 0;

      for (const lineItem of lineItems) {
        try {
          await addCartLineItem({
            ProductID: lineItem.ProductID,
            Quantity: lineItem.Quantity || 1,
            xp: lineItem.xp,
          });
          addedCount += 1;
        } catch (err) {
          console.error(`Failed to reorder ${lineItem.ProductID}:`, err);
          toast({
            title: `Could not reorder ${lineItem.ProductID}`,
            description: "This product may no longer be available.",
            status: "warning",
            duration: 6000,
            isClosable: true,
          });
        }
      }

      setReorderingOrderId(undefined);

      if (addedCount > 0) {
        toast({
          title: "Reorder added to cart",
          description: "Items were added to your current cart.",
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        navigate("/cart");
      }
    },
    [addCartLineItem, navigate, toast],
  );

  const orderCards = useMemo(
    () =>
      orders.map(({ order, lineItems, shippingAddress }) => {
        const hasMerchantOffer = lineItems.some(
          (lineItem) => lineItem.xp?.MarketplaceSupplierOffer,
        );
        const orderId = order.ID || "";
        const isExpanded = expandedOrderIds.has(orderId);

        return (
          <Card key={orderId} variant="outline">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between" align="flex-start" flexWrap="wrap">
                  <Box>
                    <Heading size="md">Order {order.ID}</Heading>
                    <Text color="chakra-subtle-text" fontSize="sm">
                      {formatDate(order.DateSubmitted || order.DateCreated)}
                    </Text>
                  </Box>
                  <Badge colorScheme="blue">{order.Status}</Badge>
                </HStack>
                <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
                  <Box>
                    <Text fontSize="xs" color="chakra-subtle-text">
                      Items
                    </Text>
                    <Text fontWeight="semibold">
                      {order.LineItemCount ?? lineItems.length}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="chakra-subtle-text">
                      Total
                    </Text>
                    <Text fontWeight="semibold">{formatPrice(order.Total)}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="chakra-subtle-text">
                      Payment/account
                    </Text>
                    <Text fontWeight="semibold">
                      {order.xp?.PaymentMethod || "Account checkout"}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="chakra-subtle-text">
                      Ship to
                    </Text>
                    <Text fontWeight="semibold">{shippingSummary(shippingAddress)}</Text>
                  </Box>
                </SimpleGrid>
                {hasMerchantOffer && (
                  <Alert status="info" borderRadius="md">
                    <AlertIcon />
                    This order includes merchant-offer selections.
                  </Alert>
                )}
                <HStack>
                  <Button size="sm" onClick={() => toggleDetails(orderId)}>
                    {isExpanded ? "Hide details" : "View details"}
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="primary"
                    onClick={() => reorder({ order, lineItems })}
                    isLoading={reorderingOrderId === orderId}
                    isDisabled={Boolean(reorderingOrderId)}
                  >
                    Reorder
                  </Button>
                </HStack>
                {isExpanded && (
                  <>
                    <Divider />
                    <TableContainer>
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Product</Th>
                            <Th>Product ID</Th>
                            <Th isNumeric>Qty</Th>
                            <Th isNumeric>Unit price</Th>
                            <Th isNumeric>Line total</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {lineItems.map((lineItem) => (
                            <Tr key={lineItem.ID}>
                              <Td>
                                <Text fontWeight="semibold">
                                  {lineItem.Product?.Name || lineItem.ProductID}
                                </Text>
                                {lineItem.xp?.MarketplaceSupplierOffer && (
                                  <Text fontSize="xs" color="chakra-subtle-text">
                                    Merchant: {lineItem.xp.SupplierName || "Approved merchant"}
                                    {lineItem.xp.OfferProductID
                                      ? ` • Offer: ${lineItem.xp.OfferProductID}`
                                      : ""}
                                  </Text>
                                )}
                              </Td>
                              <Td>{lineItem.ProductID}</Td>
                              <Td isNumeric>{lineItem.Quantity}</Td>
                              <Td isNumeric>{formatPrice(lineItem.UnitPrice)}</Td>
                              <Td isNumeric>{formatPrice(lineItem.LineTotal)}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </Stack>
            </CardBody>
          </Card>
        );
      }),
    [expandedOrderIds, orders, reorder, reorderingOrderId, toggleDetails],
  );

  return (
    <Container maxW="container.xl" py={10}>
      <VStack align="stretch" spacing={6}>
        <Heading>My Orders</Heading>
        {loading && (
          <HStack>
            <Spinner />
            <Text>Loading orders...</Text>
          </HStack>
        )}
        {error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            {error}
          </Alert>
        )}
        {!loading && !error && orders.length === 0 && (
          <Card variant="outline">
            <CardBody>
              <VStack spacing={4}>
                <Text>No orders yet. Start shopping to place your first Bristan demo order.</Text>
                <Button as={RouterLink} to="/products" colorScheme="primary">
                  Shop products
                </Button>
              </VStack>
            </CardBody>
          </Card>
        )}
        {!loading && !error && orderCards}
      </VStack>
    </Container>
  );
};

export default MyOrders;
