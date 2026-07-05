import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardFooter,
  Center,
  Container,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
} from "@chakra-ui/react";
import {
  BuyerProduct,
  InventoryRecord,
  OrderCloudError,
} from "ordercloud-javascript-sdk";
import pluralize from "pluralize";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IS_MULTI_LOCATION_INVENTORY } from "../../constants";
import formatPrice from "../../utils/formatPrice";
import { useCurrentUser } from "../../hooks/currentUser";
import BristanSupplierOffers from "../bristan/BristanSupplierOffers";
import {
  isBristanDemoMarketplaceBuyerContext,
  isBristanDemoSupplierBuyerBulkContext,
} from "../bristan/bristanDemoRoutes";
import OcQuantityInput from "../cart/OcQuantityInput";
import ProductImageGallery from "./product-detail/ProductImageGallery";
import {
  useOcResourceGet,
  useOcResourceList,
  useShopper,
} from "@ordercloud/react-sdk";

export interface ProductDetailProps {
  productId: string;
  renderProductDetail?: (product: BuyerProduct) => JSX.Element;
}

const ProductDetail: React.FC<ProductDetailProps> = ({
  productId,
  renderProductDetail,
}) => {
  const navigate = useNavigate();
  const { catalogId } = useParams<{ catalogId: string }>();
  const toast = useToast();
  const { data: user } = useCurrentUser();
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const { data: product, isLoading: loading } = useOcResourceGet<BuyerProduct>(
    "Me.Products",
    { productID: productId },
  );
  const { data: inventoryRecords } = useOcResourceList<InventoryRecord>(
    "Me.ProductInventoryRecords",
    undefined,
    { productID: productId },
    { disabled: !IS_MULTI_LOCATION_INVENTORY },
  );

  const [addingToCart, setAddingToCart] = useState(false);
  const [quantity, setQuantity] = useState(
    product?.PriceSchedule?.MinQuantity ?? 1,
  );
  const outOfStock = useMemo(
    () => product?.Inventory?.QuantityAvailable === 0,
    [product?.Inventory?.QuantityAvailable],
  );
  const minimumQuantity = product?.PriceSchedule?.MinQuantity ?? 1;
  const priceBreaks = useMemo(
    () =>
      [...(product?.PriceSchedule?.PriceBreaks ?? [])].sort(
        (a, b) => a.Quantity - b.Quantity,
      ),
    [product?.PriceSchedule?.PriceBreaks],
  );
  const isSupplierBuyerBulkContext = isBristanDemoSupplierBuyerBulkContext(
    user?.Username,
    catalogId,
  );
  const isMarketplaceBuyerContext = isBristanDemoMarketplaceBuyerContext(
    user?.Username,
    catalogId,
  );
  const isSupplierOfferProduct = product?.xp?.SupplierOffer === true;
  const showMarketplaceSupplierOffers =
    isMarketplaceBuyerContext && product && !isSupplierOfferProduct;
  const basePriceBreak = priceBreaks[0];
  const isBelowMinimumQuantity = quantity < minimumQuantity;
  const { addCartLineItem } = useShopper();

  useEffect(() => {
    if (product?.PriceSchedule?.MinQuantity) {
      setQuantity(product.PriceSchedule.MinQuantity);
    }
  }, [product?.ID, product?.PriceSchedule?.MinQuantity]);

  useEffect(() => {
    const availableRecord = inventoryRecords?.Items.find(
      (item) => item.QuantityAvailable > 0,
    );
    if (availableRecord) {
      setActiveRecordId(availableRecord.ID);
    }
  }, [inventoryRecords?.Items]);

  const handleAddToCart = useCallback(async () => {
    if (!product) {
      console.warn("[ProductDetail.tsx] Product not found for ID:", productId);
      return <div>Product not found for ID: {productId}</div>;
    }

    if (IS_MULTI_LOCATION_INVENTORY && !activeRecordId) {
      toast({
        title: "No Inventory Available",
        description: "Please select a store with available inventory.",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
    }

    if (quantity < minimumQuantity) {
      toast({
        title: `Minimum order quantity is ${minimumQuantity}`,
        description: `Increase the quantity to at least ${minimumQuantity} units before adding this product to cart.`,
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      setAddingToCart(true);
      await addCartLineItem({
        ProductID: productId,
        Quantity: quantity,
        InventoryRecordID: activeRecordId,
      });
      setAddingToCart(false);
      toast({
        title: `${quantity} ${pluralize("item", quantity)} added to cart`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      navigate("/cart");
    } catch (error) {
      setAddingToCart(false);
      if (error instanceof OrderCloudError) {
        toast({
          title: "Error adding to cart",
          description:
            error.message ||
            "Please ensure all required specifications are filled out.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } else {
        console.error("Failed to add item to cart:", error);
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    }
  }, [
    product,
    activeRecordId,
    productId,
    toast,
    addCartLineItem,
    quantity,
    minimumQuantity,
    navigate,
  ]);

  return loading ? (
    <Center h="50vh">
      <Spinner size="xl" thickness="10px" />
    </Center>
  ) : product ? (
    renderProductDetail ? (
      renderProductDetail(product)
    ) : (
      <SimpleGrid
        as={Container}
        gridTemplateColumns={{ lg: "1.5fr 2fr" }}
        gap={12}
        w="full"
        maxW="container.4xl"
      >
        <ProductImageGallery images={product.xp?.Images || []} />
        <VStack alignItems="flex-start" maxW="4xl" gap={4}>
          <Heading maxW="2xl" size="xl">
            {product.Name}
          </Heading>
          <Text color="chakra-subtle-text" fontSize="sm">
            {product.ID}
          </Text>
          <Text maxW="prose">{product.Description}</Text>
          <Text fontSize="3xl" fontWeight="medium">
            {formatPrice(product?.PriceSchedule?.PriceBreaks?.[0].Price)}
          </Text>
          {isSupplierBuyerBulkContext && (
            <Box
              borderWidth="1px"
              borderColor="primary.200"
              borderRadius="md"
              bg="primary.50"
              p={4}
              w="full"
              maxW="2xl"
            >
              <HStack mb={2}>
                <Badge colorScheme="primary" fontSize="sm">
                  Bristan trade bulk account
                </Badge>
              </HStack>
              <Text fontWeight="semibold">
                Minimum order quantity: {minimumQuantity} units
              </Text>
              <Text color="chakra-subtle-text" fontSize="sm" mt={1}>
                Your Bristan supplier buyer account includes account-specific
                bulk price breaks. Trade pricing improves at higher quantities.
              </Text>
              {priceBreaks.length > 0 && (
                <TableContainer mt={4}>
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Quantity</Th>
                        <Th>Unit price</Th>
                        <Th>Approx. savings vs first break</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {priceBreaks.map((priceBreak) => {
                        const savings = basePriceBreak?.Price
                          ? basePriceBreak.Price - priceBreak.Price
                          : 0;
                        return (
                          <Tr key={priceBreak.Quantity}>
                            <Td>{priceBreak.Quantity}+</Td>
                            <Td>{formatPrice(priceBreak.Price)}</Td>
                            <Td>
                              {savings > 0
                                ? `${formatPrice(savings)} per unit`
                                : "Base bulk price"}
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
          {showMarketplaceSupplierOffers ? (
            <BristanSupplierOffers canonicalProductId={product.ID} />
          ) : (
            <>
              {isBelowMinimumQuantity && (
                <Alert status="warning" borderRadius="md" maxW="2xl">
                  <AlertIcon />
                  Minimum order quantity is {minimumQuantity} units for this
                  product.
                </Alert>
              )}
              <HStack alignItems="center" gap={4} my={3}>
                <Button
                  colorScheme="primary"
                  type="button"
                  onClick={handleAddToCart}
                  isDisabled={
                    addingToCart || outOfStock || isBelowMinimumQuantity
                  }
                >
                  {outOfStock ? "Out of stock" : "Add To Cart"}
                </Button>
                <OcQuantityInput
                  controlId="addToCart"
                  priceSchedule={product.PriceSchedule}
                  quantity={quantity}
                  onChange={setQuantity}
                />
              </HStack>
            </>
          )}
          {!outOfStock && IS_MULTI_LOCATION_INVENTORY && (
            <>
              <Heading size="sm" color="chakra-subtle-text">
                {`(${inventoryRecords?.Items.length}) locations with inventory`}
              </Heading>
              <HStack spacing={4}>
                {inventoryRecords?.Items.length &&
                  inventoryRecords?.Items.map((item) => (
                    <Button
                      onClick={() => setActiveRecordId(item.ID)}
                      cursor="pointer"
                      variant="outline"
                      as={Card}
                      h="150px"
                      aspectRatio="1 / 1"
                      key={item.ID}
                      isDisabled={item.QuantityAvailable === 0}
                    >
                      <CardBody
                        fontSize="xs"
                        p={1}
                        display="flex"
                        alignItems="flext-start"
                        justifyContent="center"
                        flexFlow="column nowrap"
                      >
                        <Text fontSize="sm">{item.Address.AddressName}</Text>
                        <Text>{item.Address.Street1}</Text>
                        {item.Address.Street2 && (
                          <Text>{item.Address.Street2}</Text>
                        )}
                        <Text>Stock: {item.QuantityAvailable}</Text>
                      </CardBody>
                      <CardFooter py={2} fontSize="xs">
                        {item.QuantityAvailable === 0
                          ? "Out of stock"
                          : "Select This Store"}
                      </CardFooter>
                    </Button>
                  ))}
              </HStack>
            </>
          )}
        </VStack>
      </SimpleGrid>
    )
  ) : (
    <div>Product not found for ID: {productId}</div>
  );
};

export default ProductDetail;
