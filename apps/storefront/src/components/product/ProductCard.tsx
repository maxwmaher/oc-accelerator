import { Box, Card, CardBody, Center, Heading, HStack, Icon, Image, Stack, Text } from "@chakra-ui/react";
import { BuyerProduct } from "ordercloud-javascript-sdk";
import { FunctionComponent, useState } from "react";
import { TbArrowRight, TbPhoto } from "react-icons/tb";
import { Link as RouterLink } from "react-router-dom";
import formatPrice from "../../utils/formatPrice";
import { sellingUnit } from "../../utils/kfmbSellingUnit";

interface ProductCardProps {
  product: BuyerProduct;
}

const ProductCard: FunctionComponent<ProductCardProps> = ({ product }) => {
  const unit = sellingUnit(product);
  const image = product.xp?.Images?.[0]?.ThumbnailUrl || product.xp?.Images?.[0]?.Url;
  const [failedImage, setFailedImage] = useState<string>();
  const imageUnavailable = !image || failedImage === image;
  return (
    <Card as={RouterLink} to={`/products/${product.ID}`} h="full" overflow="hidden" border="1px solid" borderColor="trade.border" borderRadius="lg" boxShadow="none" textDecoration="none" _hover={{ borderColor: "trade.gold", boxShadow: "sm" }} _focusVisible={{ outline: "3px solid", outlineColor: "trade.gold", outlineOffset: "3px" }}>
      <CardBody p={0} display="flex" flexDirection="column">
        <Center bg="white" w="full" h={{ base: "230px", md: "218px" }} p={6} position="relative" overflow="hidden" borderBottom="1px solid" borderColor="trade.border">
          {imageUnavailable ? <Stack align="center" color="trade.muted" spacing={2}><Icon boxSize={10} as={TbPhoto} aria-hidden /><Text fontSize="sm">Image unavailable</Text></Stack> : <Image boxSize="full" objectFit="contain" src={image} alt={product.Name || "Product"} bg="white" onError={() => setFailedImage(image)} />}
        </Center>
        <Stack spacing={3} p={5} flex={1} align="stretch">
          <Box>
            <Heading as="h3" size="md" lineHeight="short" noOfLines={3} minH="2.7em">{product.Name}</Heading>
            <Text color="trade.muted" fontSize="sm" mt={2} minH="1.5em">{unit.detail || `Sold by ${unit.singular}`}</Text>
          </Box>
          <Text fontSize="xs" color="trade.muted" noOfLines={1} title={product.ID}>Product ID: {product.ID}</Text>
          <HStack justify="space-between" align="end" mt="auto" pt={2} gap={3}>
            <Box>{product.PriceSchedule?.PriceBreaks?.length ? <><Text fontSize="xl" fontWeight="700" sx={{ fontVariantNumeric: "tabular-nums" }} whiteSpace="nowrap" color="trade.ink">{formatPrice(product.PriceSchedule.PriceBreaks[0].Price, product.PriceSchedule.Currency)}</Text><Text fontSize="sm" color="trade.muted">per {unit.singular}</Text></> : <Text fontSize="sm" color="trade.muted">Price unavailable</Text>}</Box>
            <Icon as={TbArrowRight} boxSize={5} color="trade.ink" mb={1} aria-hidden />
          </HStack>
        </Stack>
      </CardBody>
    </Card>
  );
};

export default ProductCard;
