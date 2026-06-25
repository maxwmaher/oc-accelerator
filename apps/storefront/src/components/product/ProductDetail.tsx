import {
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
  Text,
  Alert,
  AlertIcon,
  useToast,
  VStack,
} from "@chakra-ui/react";
import {
  BuyerProduct,
  InventoryRecord,
  OrderCloudError,
  Me,
} from "ordercloud-javascript-sdk";
import pluralize from "pluralize";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IS_MULTI_LOCATION_INVENTORY } from "../../constants";
import formatPrice from "../../utils/formatPrice";
import { parseProductXp } from "../../utils/productXp";
import OcQuantityInput from "../cart/OcQuantityInput";
import ProductImageGallery from "./product-detail/ProductImageGallery";
import ProductSpecs from "./product-detail/ProductSpecs";
import RaiProductInfo from "./product-detail/RaiProductInfo";
import { SelectedSpec, SpecLike, validateRequiredSpecs } from "../../utils/specPricing";
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
  const toast = useToast();
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const { data: product, isLoading: loading } = useOcResourceGet<BuyerProduct>(
    "Me.Products",
    { productID: productId }
  );
  const { data: inventoryRecords } = useOcResourceList<InventoryRecord>(
    "Me.ProductInventoryRecords",
    undefined,
    { productID: productId },
    { disabled: !IS_MULTI_LOCATION_INVENTORY }
  );

  const [addingToCart, setAddingToCart] = useState(false);
  const [specs, setSpecs] = useState<SpecLike[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, SelectedSpec>>({});
  const [specErrors, setSpecErrors] = useState<string[]>([]);
  const [specsLoading, setSpecsLoading] = useState(false);
  const [quantity, setQuantity] = useState(
    product?.PriceSchedule?.MinQuantity ?? 1
  );
  const productXp = useMemo(() => parseProductXp(product?.xp), [product?.xp]);
  const outOfStock = useMemo(
    () => product?.Inventory?.QuantityAvailable === 0,
    [product?.Inventory?.QuantityAvailable]
  );
  const { addCartLineItem } = useShopper();

  useEffect(() => {
    setQuantity(product?.PriceSchedule?.MinQuantity ?? 1);
  }, [product?.PriceSchedule?.MinQuantity]);

  useEffect(() => {
    let cancelled = false;
    async function loadSpecs() {
      if (!productId) return;
      setSpecsLoading(true);
      try {
        const result = await Me.ListSpecs(productId);
        if (cancelled) return;
        const items = (result.Items || []) as SpecLike[];
        setSpecs(items);
        const defaults: Record<string, SelectedSpec> = {};
        items.forEach((spec) => {
          if (spec.ID && spec.DefaultOptionID) defaults[spec.ID] = { SpecID: spec.ID, OptionID: spec.DefaultOptionID };
        });
        setSelectedSpecs(defaults);
      } catch (error) {
        console.error("Failed to load product specs", error);
      } finally {
        if (!cancelled) setSpecsLoading(false);
      }
    }
    loadSpecs();
    return () => { cancelled = true; };
  }, [productId]);

  useEffect(() => {
    const availableRecord = inventoryRecords?.Items.find(
      (item) => item.QuantityAvailable > 0
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

    try {
      setAddingToCart(true);
      const missing = validateRequiredSpecs(specs, selectedSpecs);
      setSpecErrors(missing);
      if (missing.length) {
        setAddingToCart(false);
        toast({ title: "Required options missing", description: missing.join(", "), status: "warning", duration: 5000, isClosable: true });
        return;
      }
      await addCartLineItem({
        ProductID: productId,
        Quantity: quantity,
        InventoryRecordID: activeRecordId,
        Specs: Object.values(selectedSpecs).filter((s) => s.OptionID || s.Value),
      } as any);
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
  }, [product, activeRecordId, productId, toast, addCartLineItem, quantity, navigate, specs, selectedSpecs]);

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
        <ProductImageGallery images={productXp.Images || []} />
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
          {specsLoading && <Alert status="info"><AlertIcon />Loading product options…</Alert>}
          <ProductSpecs specs={specs} selected={selectedSpecs} errors={specErrors} basePrice={product?.PriceSchedule?.PriceBreaks?.[0].Price || 0} quantity={quantity} onChange={setSelectedSpecs} />
          <RaiProductInfo rai={productXp.RAI} />
          <HStack alignItems="center" gap={4} my={3}>
            <Button
              colorScheme="primary"
              type="button"
              onClick={handleAddToCart}
              isDisabled={addingToCart || outOfStock}
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
