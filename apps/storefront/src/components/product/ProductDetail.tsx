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
  useToast,
  VStack,
} from "@chakra-ui/react";
import {
  BuyerProduct,
  InventoryRecord,
} from "ordercloud-javascript-sdk";
import pluralize from "pluralize";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IS_MULTI_LOCATION_INVENTORY } from "../../constants";
import formatPrice from "../../utils/formatPrice";
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
      toast({ title: `${quantity} ${pluralize("pack", quantity)} added to cart`, status: "success", duration: 4000, isClosable: true });
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
      inputError, canAddQuantity, cart]);

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
            {formatPrice(product.PriceSchedule?.PriceBreaks?.[0]?.Price, product.PriceSchedule?.Currency)}
          </Text>
          <HStack alignItems="center" gap={4} my={3}>
            <Button
              colorScheme="primary"
              type="button"
              onClick={handleAddToCart}
              isLoading={addingToCart}
              isDisabled={addingToCart || outOfStock || !canAddQuantity}
            >
              {outOfStock ? "Out of stock" : "Add To Cart"}
            </Button>
            {userError || cart.status === "error" ? (
              <VStack alignItems="flex-start" gap={1}>
                <Text role="alert" fontSize="xs" color="red.600">
                  {userError instanceof Error ? userError.message : cart.status === "error" ? cart.message : "Shopper data could not be loaded."}
                </Text>
                <Button size="xs" variant="outline" onClick={() => userError ? retryUser() : cart.retry()}>
                  Retry
                </Button>
              </VStack>
            ) : (
              <OcQuantityInput
                controlId="addToCart"
                priceSchedule={product.PriceSchedule}
                quantity={quantity}
                otherQuantity={alreadyInCart}
                loading={!quantityReady}
                disabled={addingToCart || !quantityReady || outOfStock}
                onChange={setQuantity}
              />
            )}
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
