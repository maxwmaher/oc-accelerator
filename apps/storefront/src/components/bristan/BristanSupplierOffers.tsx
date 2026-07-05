import {
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Text,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useShopper } from "@ordercloud/react-sdk";
import { BuyerProduct, Me, OrderCloudError } from "ordercloud-javascript-sdk";
import pluralize from "pluralize";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import formatPrice from "../../utils/formatPrice";
import { BRISTAN_DEMO_CATALOG_IDS } from "./bristanDemoRoutes";

interface BristanSupplierOffersProps {
  canonicalProductId: string;
}

const supplierName = (offer: BuyerProduct) =>
  offer.xp?.SupplierName || offer.xp?.SupplierID || "Approved supplier";

const offerRank = (offer: BuyerProduct) => Number(offer.xp?.OfferRank ?? 999);

const BRISTAN_DEMO_SUPPLIER_OFFER_KEYS = ["north", "south"] as const;
const BRISTAN_DEMO_MARKETPLACE_CATALOG_ID = BRISTAN_DEMO_CATALOG_IDS.marketplace;
const BRISTAN_SUPPLIER_OFFERS_PAGE_SIZE = 100;
const BRISTAN_SUPPLIER_OFFERS_PAGE_CAP = 10;
const BRISTAN_DEMO_SUPPLIER_OFFER_ID_PREFIX = "bristan-demo-offer";

const getExpectedOfferProductIds = (canonicalProductId: string) =>
  BRISTAN_DEMO_SUPPLIER_OFFER_KEYS.map(
    (supplierKey) => `bristan-demo-offer-${supplierKey}-${canonicalProductId}`,
  );

const getOfferSortIndex = (offer: BuyerProduct, expectedOfferIds: string[]) => {
  const expectedIndex = offer.ID ? expectedOfferIds.indexOf(offer.ID) : -1;
  return expectedIndex === -1 ? Number.MAX_SAFE_INTEGER : expectedIndex;
};

const isBristanDemoSupplierOfferProductId = (productId: string) =>
  productId.startsWith(`${BRISTAN_DEMO_SUPPLIER_OFFER_ID_PREFIX}-`);

const BristanSupplierOffers: React.FC<BristanSupplierOffersProps> = ({
  canonicalProductId,
}) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { addCartLineItem } = useShopper();
  const isSupplierOfferProduct = isBristanDemoSupplierOfferProductId(
    canonicalProductId,
  );
  const [addingOfferId, setAddingOfferId] = useState<string>();
  const [offerProducts, setOfferProducts] = useState<BuyerProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isSupplierOfferProduct) {
      setOfferProducts([]);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;

    const fetchOfferProducts = async () => {
      const expectedOfferIds = getExpectedOfferProductIds(canonicalProductId);
      const expectedOfferIdSet = new Set(expectedOfferIds);

      setIsLoading(true);
      try {
        const firstPage = await Me.ListProducts<BuyerProduct>({
          catalogID: BRISTAN_DEMO_MARKETPLACE_CATALOG_ID,
          page: 1,
          pageSize: BRISTAN_SUPPLIER_OFFERS_PAGE_SIZE,
        });
        const totalPages = Math.min(
          firstPage.Meta?.TotalPages ?? 1,
          BRISTAN_SUPPLIER_OFFERS_PAGE_CAP,
        );
        const additionalPages = Array.from(
          { length: Math.max(totalPages - 1, 0) },
          (_, index) => index + 2,
        );
        const additionalResults = await Promise.all(
          additionalPages.map((page) =>
            Me.ListProducts<BuyerProduct>({
              catalogID: BRISTAN_DEMO_MARKETPLACE_CATALOG_ID,
              page,
              pageSize: BRISTAN_SUPPLIER_OFFERS_PAGE_SIZE,
            }),
          ),
        );
        const catalogProducts = [
          ...(firstPage.Items ?? []),
          ...additionalResults.flatMap((result) => result.Items ?? []),
        ];

        if (isCurrent) {
          const matchingOfferProducts = catalogProducts.filter((offer) =>
            Boolean(offer.ID && expectedOfferIdSet.has(offer.ID)),
          );

          if (matchingOfferProducts.length === 0 && import.meta.env.DEV) {
            console.info("No Bristan supplier offers found in catalog list:", {
              canonicalProductId,
              expectedOfferIds,
              catalogProductsFetched: catalogProducts.length,
              first20FetchedProductIds: catalogProducts
                .slice(0, 20)
                .map((product) => product.ID),
              fetchedBristanDemoOfferProductIds: catalogProducts
                .map((product) => product.ID)
                .filter((productId): productId is string =>
                  Boolean(
                    productId &&
                      productId.includes(BRISTAN_DEMO_SUPPLIER_OFFER_ID_PREFIX),
                  ),
                ),
            });
          }

          setOfferProducts(matchingOfferProducts);
        }
      } catch (error) {
        console.warn("Unable to load Bristan supplier offers:", error);
        if (isCurrent) {
          setOfferProducts([]);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    fetchOfferProducts();

    return () => {
      isCurrent = false;
    };
  }, [canonicalProductId, isSupplierOfferProduct]);

  const offers = useMemo(() => {
    const expectedOfferIds = getExpectedOfferProductIds(canonicalProductId);

    return [...offerProducts].sort((a, b) => {
      const rankDelta = offerRank(a) - offerRank(b);
      return (
        rankDelta ||
        getOfferSortIndex(a, expectedOfferIds) -
          getOfferSortIndex(b, expectedOfferIds) ||
        supplierName(a).localeCompare(supplierName(b))
      );
    });
  }, [canonicalProductId, offerProducts]);

  const handleBuyOffer = useCallback(
    async (offer: BuyerProduct) => {
      if (!offer.ID) return;
      const offerProductId = offer.ID;
      const quantity = offer.PriceSchedule?.MinQuantity ?? 1;

      try {
        setAddingOfferId(offerProductId);
        await addCartLineItem({
          ProductID: offerProductId,
          Quantity: quantity,
        });
        toast({
          title: `${quantity} ${pluralize("item", quantity)} added to cart`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        navigate("/cart");
      } catch (error) {
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
          console.error("Failed to add supplier offer to cart:", error);
          toast({
            title: "Error",
            description: "An unexpected error occurred. Please try again.",
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        }
      } finally {
        setAddingOfferId(undefined);
      }
    },
    [addCartLineItem, navigate, toast],
  );

  if (isSupplierOfferProduct) {
    return null;
  }

  return (
    <Box w="full" maxW="2xl" mt={2}>
      <Heading size="md" mb={3}>
        Available from approved suppliers
      </Heading>
      {isLoading ? (
        <HStack color="chakra-subtle-text">
          <Spinner size="sm" />
          <Text>Loading supplier offers…</Text>
        </HStack>
      ) : offers.length > 0 ? (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          {offers.map((offer) => (
            <Card key={offer.ID} variant="outline">
              <CardBody as={VStack} alignItems="flex-start" spacing={3}>
                <Heading size="sm">{supplierName(offer)}</Heading>
                <Text fontSize="2xl" fontWeight="semibold">
                  {formatPrice(offer.PriceSchedule?.PriceBreaks?.[0]?.Price)}
                </Text>
                <Box>
                  <Text fontSize="sm">
                    <strong>Availability:</strong>{" "}
                    {offer.xp?.Availability || "Contact supplier"}
                  </Text>
                  <Text fontSize="sm">
                    <strong>Lead time:</strong>{" "}
                    {offer.xp?.LeadTime || "Confirmed after order"}
                  </Text>
                </Box>
                <Text color="chakra-subtle-text" fontSize="xs">
                  Offer product ID: {offer.ID}
                </Text>
                <Button
                  colorScheme="primary"
                  onClick={() => handleBuyOffer(offer)}
                  isLoading={addingOfferId === offer.ID}
                  isDisabled={Boolean(addingOfferId)}
                >
                  Buy from this supplier
                </Button>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      ) : (
        <Text color="chakra-subtle-text">
          No supplier offers are available for this product yet.
        </Text>
      )}
    </Box>
  );
};

export default BristanSupplierOffers;
