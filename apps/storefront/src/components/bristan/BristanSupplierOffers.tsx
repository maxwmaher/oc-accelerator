import {
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  SimpleGrid,
  Text,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useShopper } from "@ordercloud/react-sdk";
import { OrderCloudError } from "ordercloud-javascript-sdk";
import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import formatPrice from "../../utils/formatPrice";

export interface BristanSupplierOfferSummary {
  SupplierKey?: string;
  SupplierID?: string;
  SupplierName?: string;
  OfferProductID?: string;
  OfferPriceScheduleID?: string;
  Price?: number;
  Availability?: string;
  LeadTime?: string;
  OfferRank?: number;
}

interface BristanSupplierOffersProps {
  canonicalProductId: string;
  supplierOffers?: BristanSupplierOfferSummary[];
}

const supplierName = (offer: BristanSupplierOfferSummary) =>
  offer.SupplierName || offer.SupplierID || "Approved supplier";

const offerRank = (offer: BristanSupplierOfferSummary) =>
  Number(offer.OfferRank ?? 999);

const BRISTAN_DEMO_SUPPLIER_OFFER_ID_PREFIX = "bristan-demo-offer";

const isBristanDemoSupplierOfferProductId = (productId: string) =>
  productId.startsWith(`${BRISTAN_DEMO_SUPPLIER_OFFER_ID_PREFIX}-`);

const BristanSupplierOffers: React.FC<BristanSupplierOffersProps> = ({
  canonicalProductId,
  supplierOffers = [],
}) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { addCartLineItem } = useShopper();
  const isSupplierOfferProduct =
    isBristanDemoSupplierOfferProductId(canonicalProductId);
  const [addingOfferId, setAddingOfferId] = useState<string>();
  const offers = useMemo(() => {
    return [...supplierOffers].sort((a, b) => {
      const rankDelta = offerRank(a) - offerRank(b);
      return (
        rankDelta ||
        (a.SupplierKey || "").localeCompare(b.SupplierKey || "") ||
        supplierName(a).localeCompare(supplierName(b))
      );
    });
  }, [supplierOffers]);

  const handleBuyOffer = useCallback(
    async (offer: BristanSupplierOfferSummary) => {
      if (!offer.OfferProductID) return;
      const offerProductId = offer.OfferProductID;
      const quantity = 1;

      try {
        setAddingOfferId(offerProductId);
        await addCartLineItem({
          ProductID: canonicalProductId,
          Quantity: quantity,
          xp: {
            MarketplaceSupplierOffer: true,
            OfferProductID: offer.OfferProductID,
            OfferPriceScheduleID: offer.OfferPriceScheduleID,
            SupplierKey: offer.SupplierKey,
            SupplierID: offer.SupplierID,
            SupplierName: offer.SupplierName,
            SupplierOfferPrice: offer.Price,
            Availability: offer.Availability,
            LeadTime: offer.LeadTime,
          },
        });
        toast({
          title: `Added from ${supplierName(offer)}`,
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
    [addCartLineItem, canonicalProductId, navigate, toast],
  );

  if (isSupplierOfferProduct) {
    return null;
  }

  return (
    <Box w="full" maxW="2xl" mt={2}>
      <Heading size="md" mb={3}>
        Available from approved suppliers
      </Heading>
      {offers.length > 0 ? (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          {offers.map((offer) => (
            <Card key={offer.OfferProductID} variant="outline">
              <CardBody as={VStack} alignItems="flex-start" spacing={3}>
                <Heading size="sm">{supplierName(offer)}</Heading>
                <Text fontSize="2xl" fontWeight="semibold">
                  {formatPrice(offer.Price)}
                </Text>
                <Box>
                  <Text fontSize="sm">
                    <strong>Availability:</strong>{" "}
                    {offer.Availability || "Contact supplier"}
                  </Text>
                  <Text fontSize="sm">
                    <strong>Lead time:</strong>{" "}
                    {offer.LeadTime || "Confirmed after order"}
                  </Text>
                </Box>
                <Text color="chakra-subtle-text" fontSize="xs">
                  Offer product ID: {offer.OfferProductID}
                </Text>
                <Button
                  colorScheme="primary"
                  onClick={() => handleBuyOffer(offer)}
                  isLoading={addingOfferId === offer.OfferProductID}
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
