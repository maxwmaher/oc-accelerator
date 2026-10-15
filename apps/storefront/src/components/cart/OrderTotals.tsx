import { Divider, Flex, Stack, Text } from "@chakra-ui/react";
import type { Order } from "ordercloud-javascript-sdk";
import formatPrice from "../../utils/formatPrice";

/** Display the order's recorded amounts, including its persisted currency. */
export default function OrderTotals({ order }: { order: Order }) {
  return <Stack spacing={3} fontSize="sm">
    <Flex justify="space-between" gap={4}><Text color="trade.muted">Subtotal</Text><Text whiteSpace="nowrap">{formatPrice(order.Subtotal, order.Currency)}</Text></Flex>
    <Flex justify="space-between" gap={4}><Text color="trade.muted">Promotion discount</Text><Text whiteSpace="nowrap">{order.PromotionDiscount ? "− " : ""}{formatPrice(order.PromotionDiscount ?? 0, order.Currency)}</Text></Flex>
    <Flex justify="space-between" gap={4}><Text color="trade.muted">Pickup shipping</Text><Text whiteSpace="nowrap">{formatPrice(order.ShippingCost ?? 0, order.Currency)}</Text></Flex>
    <Flex justify="space-between" gap={4}><Text color="trade.muted">Tax</Text><Text whiteSpace="nowrap">{formatPrice(order.TaxCost ?? 0, order.Currency)}</Text></Flex>
    <Divider my={1} />
    <Flex justify="space-between" gap={4} align="baseline" color="trade.ink"><Text fontWeight="semibold" fontSize="md">Total</Text><Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="bold" whiteSpace="nowrap">{formatPrice(order.Total, order.Currency)}</Text></Flex>
    <Text color="trade.muted" lineHeight="tall">Tax is not calculated in this demo. Pickup has no shipping charge.</Text>
  </Stack>;
}
