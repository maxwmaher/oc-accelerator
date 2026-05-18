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
  Divider,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Text,
  useToast,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import {
  BuyerProduct,
  Cart,
  InventoryRecord,
  Me,
  Order,
  OrderCloudError,
} from "ordercloud-javascript-sdk";
import pluralize from "pluralize";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IS_MULTI_LOCATION_INVENTORY } from "../../constants";
import formatPrice from "../../utils/formatPrice";
import { resolveSellerLabel, resolveUsedPartsMeta } from "../../utils/demoProductMeta";
import OcQuantityInput from "../cart/OcQuantityInput";
import ProductImageGallery from "./product-detail/ProductImageGallery";
import { useOcResourceList, useShopper } from "@ordercloud/react-sdk";
import { useSellerContext } from "../../context/SellerContext";
import {
  getSupplierOffers,
  normalizeSupplierOfferSummary,
  SupplierOfferViewModel,
} from "../../services/supplierOffers";


const formatOfferFallback = (value?: string | number) => {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
};

const isInventoryDebugEnabled = () =>
  typeof window !== "undefined" &&
  window.localStorage.getItem("DEBUG_SUPPLIER_OFFERS_INVENTORY") === "true";

const debugInventory = (message: string, data: Record<string, unknown>) => {
  if (isInventoryDebugEnabled()) {
    console.debug(`[AvailableOffers inventory] ${message}`, data);
  }
};

interface AvailableOffersProps {
  offers: SupplierOfferViewModel[];
  warnings: Array<{ source: string; message: string }>;
  isLoading: boolean;
  quantity: number;
  addingOfferProductID?: string;
  onAddOffer: (offer: SupplierOfferViewModel) => void;
}

interface ProductSellerSource {
  sellerType: "admin" | "supplier";
  sellerID?: string;
  displayName: string;
}

const AvailableOffers: React.FC<AvailableOffersProps> = ({
  offers,
  warnings,
  isLoading,
  quantity,
  addingOfferProductID,
  onAddOffer,
}) => (
  <Box w="full" mt={6}>
    <Divider mb={6} />
    <VStack alignItems="stretch" gap={4}>
      <Box>
        <Heading size="md">Available Offers</Heading>
        <Text color="chakra-subtle-text" fontSize="sm">
          Buyer-accessible offers for this canonical part from Scania Direct and
          connected suppliers.
        </Text>
      </Box>

      {isLoading && (
        <HStack color="chakra-subtle-text">
          <Spinner size="sm" />
          <Text fontSize="sm">Loading available offers...</Text>
        </HStack>
      )}

      {warnings.map((warning) => (
        <Alert key={`${warning.source}-${warning.message}`} status="warning" rounded="md">
          <AlertIcon />
          <Text fontSize="sm">
            {warning.source}: {warning.message}
          </Text>
        </Alert>
      ))}

      {!isLoading && offers.length === 0 && (
        <Alert status="info" rounded="md">
          <AlertIcon />
          No related supplier offers are currently visible for this buyer.
        </Alert>
      )}

      {offers.map((offer) => {
        const inStock = (offer.stockQuantity ?? 0) > 0;
        return (
          <Card key={`${offer.sellerID || "admin"}-${offer.productID}`} variant="outline">
            <CardBody>
              <VStack alignItems="stretch" gap={4}>
                <HStack justifyContent="space-between" alignItems="flex-start" gap={4}>
                  <Box>
                    <Heading size="sm">{offer.supplierDisplayName}</Heading>
                    <Text fontSize="xs" color="chakra-subtle-text">
                      {offer.productName || "Supplier offer"}
                    </Text>
                    {offer.pricingModelLabel && (
                      <Text fontSize="xs" color="chakra-subtle-text">
                        {offer.pricingModelLabel}
                      </Text>
                    )}
                  </Box>
                  <VStack alignItems="flex-end" gap={1}>
                    <Text fontSize="2xl" fontWeight="semibold">
                      {formatPrice(offer.price)}
                    </Text>
                    <Badge colorScheme={inStock ? "green" : "red"}>
                      {inStock ? `${offer.stockQuantity} in stock` : "Out of stock"}
                    </Badge>
                  </VStack>
                </HStack>

                {offer.badges.length > 0 && (
                  <Wrap spacing={2}>
                    {offer.badges.map((badge) => (
                      <WrapItem key={badge}>
                        <Badge colorScheme={badge === "Lowest Offer" ? "green" : "blue"}>
                          {badge}
                        </Badge>
                      </WrapItem>
                    ))}
                  </Wrap>
                )}

                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} fontSize="sm">
                  <Text><Text as="span" fontWeight="semibold">Delivery:</Text> {formatOfferFallback(offer.deliveryEstimate)}</Text>
                  <Text><Text as="span" fontWeight="semibold">Warranty:</Text> {formatOfferFallback(offer.warranty)}</Text>
                  <Text><Text as="span" fontWeight="semibold">Shipping:</Text> {formatOfferFallback(offer.shippingLabel)}</Text>
                  <Text><Text as="span" fontWeight="semibold">Warehouse:</Text> {formatOfferFallback(offer.warehouseName || offer.inventoryLocations[0]?.name)}</Text>
                  <Text><Text as="span" fontWeight="semibold">Region:</Text> {formatOfferFallback(offer.warehouseRegion || offer.inventoryLocations[0]?.state)}</Text>
                  <Text><Text as="span" fontWeight="semibold">Fulfillment channel:</Text> {offer.supplierDisplayName || "Scania Direct"}</Text>
                </SimpleGrid>

                {offer.inventoryLocations.length > 0 && (
                  <Box bg="chakra-subtle-bg" rounded="md" p={3}>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>
                      Inventory locations
                    </Text>
                    <VStack alignItems="stretch" gap={1}>
                      {offer.inventoryLocations.map((location, index) => {
                        const locationLabel = location.name || `Location ${index + 1}`;
                        const locationRegion = [location.city, location.state]
                          .filter(Boolean)
                          .join(", ");

                        return (
                          <Text key={location.id || locationLabel} fontSize="xs" color="chakra-subtle-text">
                            {locationLabel}: {location.quantityAvailable ?? 0} available
                            {locationRegion ? ` · ${locationRegion}` : ""}
                          </Text>
                        );
                      })}
                    </VStack>
                  </Box>
                )}

                {offer.conditionSummary && (
                  <Text fontSize="sm">
                    <Text as="span" fontWeight="semibold">Condition / certification:</Text> {offer.conditionSummary}
                  </Text>
                )}
                {offer.catalogUpdateSummary && (
                  <Text fontSize="sm">
                    <Text as="span" fontWeight="semibold">Catalog sync:</Text> {offer.catalogUpdateSummary}
                  </Text>
                )}
                {offer.compatibilitySummary && (
                  <Text fontSize="sm">
                    <Text as="span" fontWeight="semibold">Compatibility:</Text> {offer.compatibilitySummary}
                  </Text>
                )}
                {offer.technicalSpecs.length > 0 && (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Technical specs</Text>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                      {offer.technicalSpecs.map((spec) => (
                        <Text key={spec.label} fontSize="xs" color="chakra-subtle-text">
                          <Text as="span" fontWeight="semibold" color="chakra-body-text">{spec.label}:</Text> {spec.value}
                        </Text>
                      ))}
                    </SimpleGrid>
                  </Box>
                )}
              </VStack>
            </CardBody>
            <CardFooter pt={0}>
              <Button
                colorScheme="primary"
                onClick={() => onAddOffer(offer)}
                isDisabled={!inStock || Boolean(addingOfferProductID)}
                isLoading={addingOfferProductID === offer.productID}
              >
                {inStock
                  ? `Add ${quantity} ${pluralize("item", quantity)}`
                  : "Out of stock"}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </VStack>
  </Box>
);

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
  const { selectedSeller, availableSuppliers, ensureOrderSellerContext } = useSellerContext();
  const scopedSellerID =
    selectedSeller?.sellerType === "supplier" ? selectedSeller.sellerID : undefined;
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [product, setProduct] = useState<BuyerProduct>();
  const [productSellerSource, setProductSellerSource] = useState<ProductSellerSource>();
  const [loading, setLoading] = useState(true);
  const inventorySellerID =
    productSellerSource?.sellerType === "supplier"
      ? productSellerSource.sellerID
      : scopedSellerID;
  const inventoryListOptions = inventorySellerID
    ? { sellerID: inventorySellerID }
    : undefined;
  const { data: inventoryRecords } = useOcResourceList<InventoryRecord>(
    "Me.ProductInventoryRecords",
    inventoryListOptions,
    { productID: productId },
    { disabled: !IS_MULTI_LOCATION_INVENTORY || !product }
  );

  const [addingToCart, setAddingToCart] = useState(false);
  const [addingOfferProductID, setAddingOfferProductID] = useState<string>();
  const [offers, setOffers] = useState<SupplierOfferViewModel[]>([]);
  const [offerWarnings, setOfferWarnings] = useState<
    Array<{ source: string; message: string }>
  >([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [quantity, setQuantity] = useState(
    product?.PriceSchedule?.MinQuantity ?? 1
  );
  const outOfStock = useMemo(
    () => product?.Inventory?.QuantityAvailable === 0,
    [product?.Inventory?.QuantityAvailable]
  );
  const { addCartLineItem, deleteCart, orderWorksheet } = useShopper();
  const soldBy = useMemo(() => resolveSellerLabel(product || {}), [product]);
  const usedPartsMeta = useMemo(
    () =>
      resolveUsedPartsMeta(product || {}).filter(
        (item) =>
          item.label.toLowerCase() !== "compatibility" &&
          item.value !== "[object Object]"
      ),
    [product]
  );
  const compatibilitySummary = useMemo(() => {
    const xp = product?.xp as Record<string, unknown> | undefined;
    return normalizeSupplierOfferSummary(xp?.compatibility);
  }, [product]);
  const productXp = product?.xp as { canonicalPartNumber?: string } | undefined;
  const canonicalPartNumber = productXp?.canonicalPartNumber;
  const offerSellerSources = useMemo(
    () => [
      { sellerType: "admin" as const, displayName: "Scania Direct" },
      ...availableSuppliers.map((seller) => ({
        sellerType: "supplier" as const,
        sellerID: seller.SupplierID,
        displayName: seller.Name || seller.SupplierID || "Supplier",
      })),
    ],
    [availableSuppliers]
  );

  useEffect(() => {
    debugInventory("ProductDetail inventory list source", {
      productID: productId,
      resolvedSellerSource: productSellerSource,
      sellerID: inventorySellerID || "omitted",
      source: "buyer-visible Me.ProductInventoryRecords list",
      disabled: !IS_MULTI_LOCATION_INVENTORY || !product,
    });
  }, [inventorySellerID, product, productId, productSellerSource]);

  useEffect(() => {
    let ignore = false;
    const fetchProduct = async () => {
      setLoading(true);
      const productSources: ProductSellerSource[] = scopedSellerID
        ? [
            {
              sellerType: "supplier",
              sellerID: scopedSellerID,
              displayName: selectedSeller?.displayName || scopedSellerID,
            },
          ]
        : [
            { sellerType: "admin", displayName: "Scania Direct" },
            ...availableSuppliers.map((seller) => ({
              sellerType: "supplier" as const,
              sellerID: seller.SupplierID,
              displayName: seller.Name || seller.SupplierID || "Supplier",
            })),
          ];

      try {
        for (const source of productSources) {
          try {
            const result = await Me.GetProduct(
              productId,
              source.sellerID ? { sellerID: source.sellerID } : undefined
            );
            if (!ignore) {
              setProduct(result as BuyerProduct);
              setProductSellerSource(source);
            }
            return;
          } catch (error) {
            // Continue trying buyer-visible supplier contexts for direct URL loads.
          }
        }

        if (!ignore) {
          setProduct(undefined);
          setProductSellerSource(undefined);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchProduct();
    return () => {
      ignore = true;
    };
  }, [availableSuppliers, productId, scopedSellerID, selectedSeller?.displayName]);

  useEffect(() => {
    setActiveRecordId(undefined);
  }, [inventorySellerID, productId]);

  useEffect(() => {
    const availableRecord = inventoryRecords?.Items.find(
      (item) => item.QuantityAvailable > 0
    );
    debugInventory("ProductDetail inventory list result", {
      productID: productId,
      sellerID: inventorySellerID || "omitted",
      resultCount: inventoryRecords?.Items.length ?? 0,
      selectedInventoryRecordID: availableRecord?.ID || "omitted",
      inventoryRecordSource: availableRecord
        ? "buyer-visible list response"
        : "omitted: no buyer-visible available record",
    });
    if (availableRecord) {
      setActiveRecordId(availableRecord.ID);
    }
  }, [inventoryRecords?.Items, inventorySellerID, productId]);

  useEffect(() => {
    if (!product || !canonicalPartNumber) {
      setOffers([]);
      setOfferWarnings([]);
      setOffersLoading(false);
      return;
    }

    let ignore = false;
    const fetchOffers = async () => {
      setOffersLoading(true);
      try {
        const result = await getSupplierOffers(product, {
          sellerSources: offerSellerSources,
        });
        if (!ignore) {
          setOffers(result.offers);
          setOfferWarnings(result.warnings);
        }
      } catch (error) {
        console.error("Failed to load supplier offers:", error);
        if (!ignore) {
          setOffers([]);
          setOfferWarnings([
            {
              source: "Available Offers",
              message: "Offers could not be loaded right now.",
            },
          ]);
        }
      } finally {
        if (!ignore) {
          setOffersLoading(false);
        }
      }
    };

    fetchOffers();
    return () => {
      ignore = true;
    };
  }, [canonicalPartNumber, offerSellerSources, product]);

  const ensureOfferSellerContext = useCallback(
    async (offer: SupplierOfferViewModel) => {
      const currentCart = await Cart.Get().catch(() => undefined);
      const currentToCompanyID = currentCart?.ToCompanyID;
      const hasLineItems = Boolean(
        currentCart?.LineItemCount || orderWorksheet?.LineItems?.length
      );
      const targetSellerID =
        offer.sellerType === "supplier" ? offer.sellerID : undefined;

      if (targetSellerID) {
        if (currentToCompanyID !== targetSellerID && hasLineItems) {
          await deleteCart();
        }
        if (currentToCompanyID !== targetSellerID) {
          await Cart.Save({ ToCompanyID: targetSellerID } as Order);
        }
        return;
      }

      if (currentToCompanyID && hasLineItems) {
        await deleteCart();
      } else if (currentToCompanyID) {
        await Cart.Delete();
      }
    },
    [deleteCart, orderWorksheet?.LineItems?.length]
  );

  const handleAddOfferToCart = useCallback(
    async (offer: SupplierOfferViewModel) => {
      try {
        setAddingOfferProductID(offer.productID);
        await ensureOfferSellerContext(offer);
        const safeOfferInventoryRecordID =
          offer.sellerType === "admin" ? offer.inventoryRecordID : undefined;
        debugInventory("Offer add-to-cart inventory record", {
          productID: offer.productID,
          resolvedSellerSource: {
            sellerType: offer.sellerType,
            sellerID: offer.sellerID,
          },
          sellerID: offer.sellerID || "omitted",
          selectedInventoryRecordID: safeOfferInventoryRecordID || "omitted",
          inventoryRecordSource: safeOfferInventoryRecordID
            ? "buyer-visible list response"
            : offer.inventoryRecordID
              ? "omitted: supplier offer inventory record not verified against active cart seller context"
              : "omitted: no buyer-visible available record",
        });
        await addCartLineItem({
          ProductID: offer.productID,
          Quantity: quantity,
          ...(safeOfferInventoryRecordID
            ? { InventoryRecordID: safeOfferInventoryRecordID }
            : {}),
        });
        toast({
          title: `${quantity} ${pluralize("item", quantity)} added to cart`,
          description: `Added ${offer.productName} from ${offer.supplierDisplayName}.`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        navigate("/cart");
      } catch (error) {
        if (error instanceof OrderCloudError) {
          toast({
            title: "Error adding offer to cart",
            description:
              error.message ||
              "Please ensure all required specifications are filled out.",
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        } else {
          console.error("Failed to add offer item to cart:", error);
          toast({
            title: "Error",
            description: "An unexpected error occurred. Please try again.",
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        }
      } finally {
        setAddingOfferProductID(undefined);
      }
    },
    [addCartLineItem, ensureOfferSellerContext, navigate, quantity, toast]
  );

  const activeRecordIsBuyerVisible = Boolean(
    activeRecordId &&
      inventoryRecords?.Items.some((record) => record.ID === activeRecordId)
  );
  const safeActiveRecordId = activeRecordIsBuyerVisible ? activeRecordId : undefined;

  const handleAddToCart = useCallback(async () => {
    if (!product) {
      console.warn("[ProductDetail.tsx] Product not found for ID:", productId);
      return <div>Product not found for ID: {productId}</div>;
    }

    if (IS_MULTI_LOCATION_INVENTORY && !safeActiveRecordId) {
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
      const productSellerID =
        productSellerSource?.sellerType === "supplier"
          ? productSellerSource.sellerID
          : selectedSeller?.sellerType === "supplier"
            ? selectedSeller.sellerID
            : undefined;
      const orderSellerMismatch =
        Boolean(productSellerID) &&
        Boolean(orderWorksheet?.Order?.ToCompanyID) &&
        orderWorksheet?.Order?.ToCompanyID !== productSellerID;
      if (orderSellerMismatch && orderWorksheet?.LineItems?.length) {
        await deleteCart();
      }
      if (productSellerID) {
        await Cart.Save({ ToCompanyID: productSellerID } as Order);
      } else {
        await ensureOrderSellerContext();
      }
      if (activeRecordId && !safeActiveRecordId) {
        debugInventory("Omitting unsafe current-product InventoryRecordID", {
          productID: productId,
          sellerID: productSellerID || "omitted",
          unsafeInventoryRecordID: activeRecordId,
          reason: "not present in current buyer-visible list response",
        });
      }
      await addCartLineItem({
        ProductID: productId,
        Quantity: quantity,
        ...(safeActiveRecordId
          ? { InventoryRecordID: safeActiveRecordId }
          : {}),
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
    activeRecordId,
    safeActiveRecordId,
    addCartLineItem,
    deleteCart,
    ensureOrderSellerContext,
    navigate,
    orderWorksheet?.Order?.ToCompanyID,
    orderWorksheet?.LineItems?.length,
    product,
    productId,
    productSellerSource?.sellerID,
    productSellerSource?.sellerType,
    quantity,
    selectedSeller?.sellerID,
    selectedSeller?.sellerType,
    toast,
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
          {(productSellerSource || soldBy) && (
            <Text fontSize="sm" color="chakra-subtle-text">
              Buying from {productSellerSource?.displayName || selectedSeller?.displayName || soldBy}
            </Text>
          )}
          <Text fontSize="3xl" fontWeight="medium">
            {formatPrice(product?.PriceSchedule?.PriceBreaks?.[0].Price)}
          </Text>
          {(usedPartsMeta.length > 0 || compatibilitySummary) && (
            <VStack alignItems="flex-start" gap={1} mt={1}>
              {usedPartsMeta.map((item) => (
                <Text key={item.label} fontSize="sm" color="chakra-subtle-text">
                  <Text as="span" fontWeight="semibold" color="chakra-body-text">
                    {item.label}:
                  </Text>{" "}
                  {item.value}
                </Text>
              ))}
              {compatibilitySummary && (
                <Text fontSize="sm" color="chakra-subtle-text">
                  <Text as="span" fontWeight="semibold" color="chakra-body-text">
                    Compatibility:
                  </Text>{" "}
                  {compatibilitySummary}
                </Text>
              )}
            </VStack>
          )}
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
          {canonicalPartNumber && (
            <AvailableOffers
              offers={offers}
              warnings={offerWarnings}
              isLoading={offersLoading}
              quantity={quantity}
              addingOfferProductID={addingOfferProductID}
              onAddOffer={handleAddOfferToCart}
            />
          )}
        </VStack>
      </SimpleGrid>
    )
  ) : (
    <div>Product not found for ID: {productId}</div>
  );
};

export default ProductDetail;
