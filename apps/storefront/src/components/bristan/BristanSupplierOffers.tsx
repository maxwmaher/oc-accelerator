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

interface BristanSupplierOffersProps {
  canonicalProductId: string;
}

const supplierName = (offer: BuyerProduct) =>
  offer.xp?.SupplierName || offer.xp?.SupplierID || "Approved supplier";

const offerRank = (offer: BuyerProduct) => Number(offer.xp?.OfferRank ?? 999);

const BRISTAN_DEMO_SUPPLIER_OFFER_KEYS = ["north", "south"] as const;

const getExpectedOfferProductIds = (canonicalProductId: string) =>
  BRISTAN_DEMO_SUPPLIER_OFFER_KEYS.map(
    (supplierKey) => `bristan-demo-offer-${supplierKey}-${canonicalProductId}`,
  );

const BristanSupplierOffers: React.FC<BristanSupplierOffersProps> = ({
  canonicalProductId,
}) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { addCartLineItem } = useShopper();
  const [addingOfferId, setAddingOfferId] = useState<string>();
  const [offerProducts, setOfferProducts] = useState<BuyerProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    const fetchOfferProducts = async () => {
      setIsLoading(true);
      try {
        const offerResults = await Promise.all(
          getExpectedOfferProductIds(canonicalProductId).map(
            async (offerProductId) => {
              try {
                return await Me.GetProduct<BuyerProduct>(offerProductId);
              } catch (error) {
                console.warn(
                  "Bristan supplier offer product was not available:",
                  offerProductId,
                  error,
                );
                return undefined;
              }
            },
          ),
        );

        if (isCurrent) {
          setOfferProducts(
            offerResults
              .filter(
                (offer) =>
                  offer?.xp?.SupplierOffer === true &&
                  offer?.xp?.CanonicalProductID === canonicalProductId,
              )
              .map((offer) => offer as BuyerProduct),
          );
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
  }, [canonicalProductId]);

  const offers = useMemo(
    () =>
      [...offerProducts].sort((a, b) => {
        const rankDelta = offerRank(a) - offerRank(b);
        return rankDelta || supplierName(a).localeCompare(supplierName(b));
      }),
    [offerProducts],
  );

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
