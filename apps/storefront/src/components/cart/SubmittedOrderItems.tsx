import { Box, Flex, Image, Link, Stack, Text } from "@chakra-ui/react";
import type { LineItem } from "ordercloud-javascript-sdk";
import { Link as RouterLink } from "react-router-dom";
import formatPrice from "../../utils/formatPrice";
import { sellingUnit } from "../../utils/kfmbSellingUnit";

/** Submitted items need no current-cart queries or quantity hooks. */
export default function SubmittedOrderItems({ lineItems, currency }: { lineItems: LineItem[]; currency?: string }) {
  return <Stack spacing={0} divider={<Box borderBottom="1px solid" borderColor="trade.border" />}>
    {lineItems.map((line) => {
      const unit = sellingUnit(line.Product);
      const image = line.Product?.xp?.Images?.[0]?.Url;
      return <Flex id="lineItemRow" key={line.ID} py={5} gap={{ base: 3, md: 5 }} align="flex-start" minW={0}>
        <Box flexShrink={0} w={{ base: "64px", md: "80px" }} h={{ base: "80px", md: "96px" }} border="1px solid" borderColor="trade.border" bg="white" borderRadius="md" p={2}>
          <Image src={image} alt={line.Product?.Name || "Product"} objectFit="contain" w="full" h="full" fallback={<Flex h="full" align="center" justify="center"><Text fontSize="xs" textAlign="center" color="trade.muted">Image unavailable</Text></Flex>} />
        </Box>
        <Stack flex={1} minW={0} spacing={2}>
          <Link as={RouterLink} to={`/products/${line.ProductID}`} fontWeight="semibold" lineHeight="short" overflowWrap="anywhere">{line.Product?.Name || line.ProductID}</Link>
          {unit.detail && <Text fontSize="sm" color="trade.muted">{unit.detail}</Text>}
          <Text fontSize="sm">{line.Quantity} {line.Quantity === 1 ? unit.singular : unit.plural} <Text as="span" color="trade.muted">× {formatPrice(line.UnitPrice, currency)} / {unit.singular}</Text></Text>
          <Text fontSize="xs" color="trade.muted" overflowWrap="anywhere">Item number: {line.ProductID}</Text>
          {line.Specs?.map(spec => <Text key={spec.SpecID} fontSize="sm" color="trade.muted">{spec.Name}: {spec.Value}</Text>)}
          <Text fontWeight="semibold" color="trade.ink" whiteSpace="nowrap" display={{ base: "block", md: "none" }}>{formatPrice(line.LineSubtotal, currency)}</Text>
        </Stack>
        <Text display={{ base: "none", md: "block" }} fontWeight="semibold" color="trade.ink" whiteSpace="nowrap">{formatPrice(line.LineSubtotal, currency)}</Text>
      </Flex>;
    })}
  </Stack>;
}
