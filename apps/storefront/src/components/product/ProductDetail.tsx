import {
  Button,
  Center,
  Heading,
  HStack,
  Link,
  Stack,
  Box,
  SimpleGrid,
  Spinner,
  Text,
  useToast,
} from "@chakra-ui/react";
import {
  BuyerProduct,
  InventoryRecord,
} from "ordercloud-javascript-sdk";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { IS_MULTI_LOCATION_INVENTORY } from "../../constants";
import formatPrice from "../../utils/formatPrice";
import { sellingUnit } from "../../utils/kfmbSellingUnit";
import { Surface } from "../trade/TradePrimitives";
import OcQuantityInput from "../cart/OcQuantityInput";
import ProductImageGallery from "./product-detail/ProductImageGallery";
import {
  useOcResourceGet,
  useOcResourceList,
  useShopper,
} from "@ordercloud/react-sdk";

import { productQuantity, quantityBounds, quantityError } from "../../utils/kfmbQuantityRules";
import { assertCartQuantityChange } from "../../utils/kfmbCartQuantityChecks";
import { runCartAction } from "../../utils/kfmbCartEdits";
import { useCurrentUser } from "../../hooks/currentUser";
import { useCurrentCart } from "../../hooks/currentCart";
import {
  canAddPdpQuantity,
  editPdpQuantityState,
  emptyPdpQuantityState,
  resolvePdpQuantityState,
} from "../../utils/kfmbPdpQuantityState";

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
  const { data: product, isLoading: loading, error: productError, refetch: retryProduct } = useOcResourceGet<BuyerProduct>(
    "Me.Products",
    { productID: productId }
  );
  const { data: inventoryRecords } = useOcResourceList<InventoryRecord>(
    "Me.ProductInventoryRecords",
    undefined,
    { productID: productId },
    { disabled: !IS_MULTI_LOCATION_INVENTORY }
  );

  const unit = sellingUnit(product);
  const [addingToCart, setAddingToCart] = useState(false);
  const [quantityState, setQuantityState] = useState(emptyPdpQuantityState);
  const { data: currentUser, isLoading: userLoading, error: userError, refetch: retryUser } = useCurrentUser();
  const outOfStock = useMemo(
    () => product?.Inventory?.QuantityAvailable === 0,
    [product?.Inventory?.QuantityAvailable]
  );
  const { addCartLineItem } = useShopper();
  const cart = useCurrentCart(!userLoading && !!currentUser && !userError);
  const addingRef = useRef(false);
  const cartReady = cart.status === "empty" || cart.status === "ready";
  const cartLines = cartReady ? cart.lineItems : [];
  const alreadyInCart = cartReady
    ? productQuantity(cartLines, productId)
    : 0;
  const entryBounds = product?.PriceSchedule
    ? quantityBounds(product.PriceSchedule, alreadyInCart)
    : undefined;
  const quantityContext = currentUser?.ID && product?.PriceSchedule?.ID
    ? `${currentUser.ID}:${productId}:${product.PriceSchedule.ID}`
    : undefined;
  const quantityReady = !!quantityContext && !userLoading && cartReady && !!entryBounds &&
    quantityState.contextKey === quantityContext && quantityState.initialized;
  const quantity = quantityReady ? quantityState.quantity : Number.NaN;
  const inputError = quantityReady
    ? quantityError(product?.PriceSchedule, quantity, alreadyInCart)
    : "Product, pricing, and cart quantities are still loading.";
  const canAddQuantity = canAddPdpQuantity(quantityReady, inputError);

  // Initialize only after pricing, shopper, and cart are known. The keyed state
  // deliberately survives equivalent refetches, but never crosses contexts.
  useEffect(() => {
    setQuantityState(previous => resolvePdpQuantityState(
      previous,
      quantityContext,
      !!quantityContext && !userLoading && cartReady,
      entryBounds?.entryMin
    ));
  }, [quantityContext, userLoading, cartReady, entryBounds?.entryMin]);

  const setQuantity = useCallback((next: number) => {
    if (!quantityContext || !quantityReady) return;
    setQuantityState(previous => editPdpQuantityState(previous, quantityContext, next));
  }, [quantityContext, quantityReady]);

  useEffect(() => {
    const availableRecord = inventoryRecords?.Items.find(
      (item) => item.QuantityAvailable > 0
    );
    if (availableRecord) {
      setActiveRecordId(availableRecord.ID);
    }
  }, [inventoryRecords?.Items]);

  const handleAddToCart = useCallback(async () => {
    if (addingRef.current || !canAddQuantity || !product?.PriceSchedule) return;
    if (inputError) {
      toast({ title: "Check the quantity", description: inputError, status: "warning" });
      return;
    }
    if (IS_MULTI_LOCATION_INVENTORY && !activeRecordId) {
      toast({ title: "Select an available pickup location", status: "warning" });
      return;
    }
    addingRef.current = true;
    setAddingToCart(true);
    try {
      await runCartAction(async () => {
        await assertCartQuantityChange(cart.status === "ready" ? cart.worksheet.Order?.ID : undefined, productId, quantity);
        await addCartLineItem({ ProductID: productId, Quantity: quantity, InventoryRecordID: activeRecordId });
      });
      toast({ title: `${quantity} ${quantity === 1 ? unit.singular : unit.plural} added to cart`, status: "success", duration: 4000, isClosable: true });
      navigate("/cart");
    } catch (error) {
      toast({
        title: "Unable to add this quantity",
        description: error instanceof Error ? error.message : "Cart update failed. Please try again.",
        status: "error", duration: 7000, isClosable: true,
      });
    } finally {
      addingRef.current = false;
      setAddingToCart(false);
    }
  }, [product, activeRecordId, productId, toast, addCartLineItem, quantity, navigate,
      inputError, canAddQuantity, cart, unit.singular, unit.plural]);

  return loading ? (
    <Surface><Center minH="340px"><Stack align="center" spacing={4}><Spinner size="lg" color="trade.ink" /><Text color="trade.muted">Loading product and pricing…</Text></Stack></Center></Surface>
  ) : product ? (
    renderProductDetail ? (
      renderProductDetail(product)
    ) : (
      <Stack spacing={6}>
        <HStack spacing={2} fontSize="sm" color="trade.muted" as="nav" aria-label="Breadcrumb"><Link as={RouterLink} to="/">Home</Link><Text aria-hidden>/</Text><Link as={RouterLink} to="/products">Products</Link></HStack>
        <SimpleGrid gridTemplateColumns={{ lg: "minmax(0, 1fr) minmax(0, 1.1fr)" }} gap={{ base: 7, lg: 10 }} alignItems="start" w="full">
          <ProductImageGallery images={product.xp?.Images || []} productName={product.Name} />
          <Stack alignItems="stretch" minW={0} spacing={6}>
            <Stack spacing={3}>
              <Heading as="h1" size={{ base: "xl", md: "2xl" }} lineHeight="shorter">{product.Name}</Heading>
              <Text color="trade.muted" fontWeight="500">{unit.detail || `Sold by ${unit.singular}`}</Text>
              {product.Description && <Text lineHeight="tall" maxW="60ch">{product.Description}</Text>}
            </Stack>
            <Surface p={{ base: 5, md: 6 }}>
              <Stack spacing={5}>
                <Box borderBottom="1px solid" borderColor="trade.border" pb={5}>
                  <Text fontSize="sm" color="trade.muted" mb={1}>Price per {unit.singular}</Text>
                  {product.PriceSchedule?.PriceBreaks?.length ? <Text fontSize={{ base: "3xl", md: "4xl" }} fontWeight="700" sx={{ fontVariantNumeric: "tabular-nums" }} whiteSpace="nowrap" color="trade.ink">{formatPrice(product.PriceSchedule.PriceBreaks[0].Price, product.PriceSchedule.Currency)}</Text> : <Text fontSize="lg" color="trade.muted">Price unavailable</Text>}
                </Box>
                {userError || cart.status === "error" ? (
                  <Stack alignItems="flex-start" spacing={3}>
                    <Text role="alert" fontSize="sm" color="red.700">{userError instanceof Error ? userError.message : cart.status === "error" ? cart.message : "Shopper data could not be loaded."}</Text>
                    <Button variant="outline" onClick={() => userError ? retryUser() : cart.retry()}>Retry</Button>
                  </Stack>
                ) : (
                  <OcQuantityInput
                    controlId="addToCart"
                    label={`Quantity (${unit.plural})`}
                    priceSchedule={product.PriceSchedule}
                    quantity={quantity}
                    otherQuantity={alreadyInCart}
                    loading={!quantityReady}
                    disabled={addingToCart || !quantityReady || outOfStock}
                    onChange={setQuantity}
                  />
                )}
                <Text color="trade.muted" fontSize="sm">Quantity 1 represents one complete {unit.singular}. Prices apply to the selling unit shown above.</Text>
                <Button colorScheme="primary" type="button" onClick={handleAddToCart} isLoading={addingToCart} loadingText="Adding to cart" isDisabled={addingToCart || outOfStock || !canAddQuantity} w={{ base: "full", sm: "auto" }} alignSelf={{ sm: "flex-start" }} minW={{ sm: "200px" }}>
                  {outOfStock ? "Out of stock" : "Add To Cart"}
                </Button>
              </Stack>
            </Surface>
            <Text fontSize="sm" color="trade.muted" overflowWrap="anywhere">Product ID: {product.ID}</Text>
            {!outOfStock && IS_MULTI_LOCATION_INVENTORY && (
              <Stack spacing={4}>
                <Heading as="h2" size="md">Pickup inventory locations ({inventoryRecords?.Items.length || 0})</Heading>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                  {inventoryRecords?.Items.map(item => (
                    <Button onClick={() => setActiveRecordId(item.ID)} variant="outline" h="auto" whiteSpace="normal" p={4} textAlign="left" justifyContent="flex-start" key={item.ID} isDisabled={item.QuantityAvailable === 0} aria-pressed={activeRecordId === item.ID} borderColor={activeRecordId === item.ID ? "trade.ink" : "trade.border"} borderWidth={activeRecordId === item.ID ? "2px" : "1px"}>
                      <Stack spacing={1} fontWeight="normal" fontSize="sm"><Text fontWeight="600">{item.Address.AddressName}</Text><Text>{item.Address.Street1}</Text>{item.Address.Street2 && <Text>{item.Address.Street2}</Text>}<Text>Stock: {item.QuantityAvailable}</Text><Text fontWeight="600" mt={2}>{item.QuantityAvailable === 0 ? "Out of stock" : activeRecordId === item.ID ? "Selected location" : "Select this location"}</Text></Stack>
                    </Button>
                  ))}
                </SimpleGrid>
              </Stack>
            )}
          </Stack>
        </SimpleGrid>
      </Stack>
    )
  ) : (
    <Surface><Stack align="flex-start" spacing={4}><Heading as="h1" size="lg">{productError ? "Product could not be loaded" : "Product not found"}</Heading><Text color="trade.muted">{productError ? "Please try again to load product details and pricing." : "This product is not available in the current catalog."}</Text><Text fontSize="sm" color="trade.muted" overflowWrap="anywhere">Product ID: {productId}</Text>{productError ? <Button variant="outline" onClick={() => retryProduct()}>Try again</Button> : <Button as={RouterLink} to="/products">Browse products</Button>}</Stack></Surface>
  );
};

export default ProductDetail;
