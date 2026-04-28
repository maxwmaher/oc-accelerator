import {
  Box,
  Button,
  Center,
  Container,
  Heading,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Orders, Order } from "ordercloud-javascript-sdk";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { formatDate } from "../../utils/formatDate";
import formatPrice from "../../utils/formatPrice";

const MyOrders = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const result = await Orders.List("Outgoing", { sortBy: ["!DateCreated"], pageSize: 20 });
        setOrders(result.Items || []);
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, []);

  if (loading) {
    return (
      <Center h="40vh">
        <Spinner size="xl" />
      </Center>
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
          <Button as={RouterLink} to="/products" size="sm">
            Start shopping
          </Button>
        </VStack>
      ) : (
        <Stack gap={4}>
          {orders.map((order) => (
            <Box key={order.ID} borderWidth="1px" rounded="md" p={4}>
              <Heading size="sm">{order.ID}</Heading>
              <Text color="chakra-subtle-text" fontSize="sm">
                Created: {order.DateCreated ? formatDate(order.DateCreated) : "N/A"}
              </Text>
              <Text color="chakra-subtle-text" fontSize="sm">
                Status: {order.Status}
              </Text>
              <Text mt={2} fontWeight="medium">
                Total: {formatPrice(order.Total)}
              </Text>
              <Button
                as={RouterLink}
                to={`/order-confirmation?orderID=${order.ID}`}
                size="xs"
                mt={3}
                variant="outline"
              >
                View details
              </Button>
            </Box>
          ))}
        </Stack>
      )}
    </Container>
  );
};

export default MyOrders;
