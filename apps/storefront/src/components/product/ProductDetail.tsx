import {
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
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Text,
  Alert,
  AlertIcon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
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
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { IS_MULTI_LOCATION_INVENTORY } from "../../constants";
import formatPrice from "../../utils/formatPrice";
import { parseProductXp } from "../../utils/productXp";
import OcQuantityInput from "../cart/OcQuantityInput";
import ProductImageGallery from "./product-detail/ProductImageGallery";
import ProductSpecs from "./product-detail/ProductSpecs";
import RaiProductInfo from "./product-detail/RaiProductInfo";
import {
  getRaiDemoContextById,
  isDelegatedRaiDemoContext,
  RAI_DEMO_CONTEXT_STORAGE_KEY,
} from "../../demo/raiDemoContexts";
import {
  SelectedSpec,
  SpecLike,
  validateRequiredSpecs,
} from "../../utils/specPricing";
import {
  useOcResourceGet,
  useOcResourceList,
  useShopper,
} from "@ordercloud/react-sdk";

type RaiServiceDetailsType = "catering" | "utility" | "flooring";
type RaiServiceDetails = Record<string, string>;
type RaiDependencyStatus =
  | "Available"
  | "Already captured"
  | "Mocked dependency";

interface RaiDependencyRecommendation {
  name: string;
  reason: string;
  status: RaiDependencyStatus;
  productId?: string;
}

const RAI_DEMO_PRODUCT_IDS = {
  mandatoryDaytimePower: "rai-devworld-product-power-day-230-3kw",
  additionalSockets: "rai-devworld-product-power-day-add-sock-exc",
  raisedStandFloor: "rai-devworld-product-floor-high-floor",
} as const;

const SERVICE_TIME_SLOTS = [
  "08:00–10:00",
  "10:00–12:00",
  "12:00–14:00",
  "14:00–16:00",
];
const GRID_LOCATIONS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const REQUIRED_BY_OPTIONS = [
  "Build-up day",
  "Event opening morning",
  "Full event duration",
];
const RAMP_OPTIONS = ["Yes", "No"];
const FLOOR_FINISH_OPTIONS = ["Standard grey", "Black carpet", "Blue carpet"];

const getRaiServiceDetailsType = (
  product?: BuyerProduct,
): RaiServiceDetailsType | undefined => {
  const haystack = [
    product?.ID,
    product?.Name,
    (product as any)?.SKU,
    (product?.xp as any)?.SKU,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/food|fnb|croissant|breakfast|sandwich|muesli|yoghurt/.test(haystack)) {
    return "catering";
  }
  if (/power|socket|electricity|connection/.test(haystack)) {
    return "utility";
  }
  if (/floor/.test(haystack)) {
    return "flooring";
  }
  return undefined;
};

const getRaiDependencyRecommendations = (
  product?: BuyerProduct,
  type?: RaiServiceDetailsType,
): RaiDependencyRecommendation[] => {
  if (!product || !type) return [];

  const productName = product.Name || "";
  const isAdditionalSockets =
    product.ID === RAI_DEMO_PRODUCT_IDS.additionalSockets;

  if (type === "catering") {
    return [
      {
        name: "Mandatory daytime power",
        reason:
          "Food and catering services need stand power available during service hours.",
        status: "Available",
        productId: RAI_DEMO_PRODUCT_IDS.mandatoryDaytimePower,
      },
      {
        name: "Additional sockets",
        reason: "Catering equipment often needs a dedicated nearby socket.",
        status: "Available",
        productId: RAI_DEMO_PRODUCT_IDS.additionalSockets,
      },
      ...(productName.toLowerCase().includes("coffee")
        ? [
            {
              name: "Water connection",
              reason:
                "Coffee service may require a water feed or refill point at the stand.",
              status: "Mocked dependency" as const,
            },
          ]
        : []),
    ];
  }

  if (type === "utility") {
    return [
      ...(!isAdditionalSockets
        ? [
            {
              name: "Additional sockets",
              reason:
                "Extra socket capacity helps exhibitors avoid last-minute power changes.",
              status: "Available" as const,
              productId: RAI_DEMO_PRODUCT_IDS.additionalSockets,
            },
          ]
        : []),
      {
        name: "Stand grid placement",
        reason:
          "Required configuration note captured above for utility installation planning.",
        status: "Already captured",
      },
    ];
  }

  if (type === "flooring") {
    return [
      {
        name: "Ramp access",
        reason:
          "Raised floors may need an accessibility ramp decision for the stand design.",
        status: "Already captured",
      },
      {
        name: "Carpet finish selection",
        reason:
          "Floor finish is selected with the raised floor service details.",
        status: "Already captured",
      },
    ];
  }

  return [];
};

interface RaiDependencyRecommendationsProps {
  recommendations: RaiDependencyRecommendation[];
}

const getRecommendationBadgeColor = (status: RaiDependencyStatus) => {
  if (status === "Available") return "green";
  if (status === "Already captured") return "blue";
  return "purple";
};

const RaiDependencyRecommendations: React.FC<
  RaiDependencyRecommendationsProps
> = ({ recommendations }) => {
  if (!recommendations.length) return null;

  return (
    <VStack
      alignItems="stretch"
      borderWidth="1px"
      borderRadius="md"
      p={4}
      spacing={3}
      w="full"
    >
      <VStack alignItems="flex-start" spacing={1}>
        <Heading size="sm">Recommended for this stand service</Heading>
        <Text fontSize="xs" color="chakra-subtle-text">
          Production implementation: dependencies would be driven by
          Momentus/product rules and enforced during checkout or guided
          ordering.
        </Text>
      </VStack>
      <VStack alignItems="stretch" spacing={2}>
        {recommendations.map((recommendation) => (
          <HStack
            key={`${recommendation.name}-${recommendation.status}`}
            alignItems={{ base: "flex-start", md: "center" }}
            borderWidth="1px"
            borderRadius="md"
            justifyContent="space-between"
            p={3}
            spacing={3}
          >
            <VStack alignItems="flex-start" spacing={1} flex="1">
              <HStack spacing={2} flexWrap="wrap">
                <Text fontSize="sm" fontWeight="semibold">
                  {recommendation.name}
                </Text>
                <Badge
                  colorScheme={getRecommendationBadgeColor(
                    recommendation.status,
                  )}
                >
                  {recommendation.status}
                </Badge>
              </HStack>
              <Text fontSize="xs" color="chakra-subtle-text">
                {recommendation.reason}
              </Text>
            </VStack>
            {recommendation.productId ? (
              <Button
                as={RouterLink}
                to={`/products/${recommendation.productId}`}
                size="sm"
                variant="outline"
                flexShrink={0}
              >
                View product
              </Button>
            ) : (
              <Button size="sm" variant="ghost" isDisabled flexShrink={0}>
                Handled in Momentus rules
              </Button>
            )}
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
};

const getRequiredRaiServiceDetailFields = (type?: RaiServiceDetailsType) => {
  if (type === "catering")
    return ["deliveryDate", "deliveryTimeSlot", "standContactName"];
  if (type === "utility")
    return ["standGridLocation", "requiredBy", "technicalContactPhone"];
  if (type === "flooring")
    return ["standAreaM2", "rampRequired", "floorFinish"];
  return [];
};

interface RaiServiceDetailsFormProps {
  type: RaiServiceDetailsType;
  details: RaiServiceDetails;
  onChange: (details: RaiServiceDetails) => void;
}

const RaiServiceDetailsForm: React.FC<RaiServiceDetailsFormProps> = ({
  type,
  details,
  onChange,
}) => {
  const setDetail = (key: string, value: string) =>
    onChange({ ...details, [key]: value });

  return (
    <VStack
      alignItems="stretch"
      borderWidth="1px"
      borderRadius="md"
      p={4}
      spacing={3}
      w="full"
    >
      <Heading size="sm">Required service details</Heading>
      <Text fontSize="xs" color="chakra-subtle-text">
        Demo-only RAI line-item data capture. Production would use
        business-configurable line-item fields driven by Momentus/product
        configuration.
      </Text>
      {type === "catering" && (
        <>
          <Input
            type="date"
            aria-label="Delivery date"
            value={details.deliveryDate || ""}
            onChange={(e) => setDetail("deliveryDate", e.target.value)}
          />
          <Select
            placeholder="Delivery time slot"
            value={details.deliveryTimeSlot || ""}
            onChange={(e) => setDetail("deliveryTimeSlot", e.target.value)}
          >
            {SERVICE_TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Stand contact name"
            value={details.standContactName || ""}
            onChange={(e) => setDetail("standContactName", e.target.value)}
          />
        </>
      )}
      {type === "utility" && (
        <>
          <Select
            placeholder="Stand grid location"
            value={details.standGridLocation || ""}
            onChange={(e) => setDetail("standGridLocation", e.target.value)}
          >
            {GRID_LOCATIONS.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </Select>
          <Select
            placeholder="Required by"
            value={details.requiredBy || ""}
            onChange={(e) => setDetail("requiredBy", e.target.value)}
          >
            {REQUIRED_BY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Input
            type="tel"
            placeholder="Technical contact phone"
            value={details.technicalContactPhone || ""}
            onChange={(e) => setDetail("technicalContactPhone", e.target.value)}
          />
        </>
      )}
      {type === "flooring" && (
        <>
          <Input
            type="number"
            min="0"
            step="0.1"
            placeholder="Stand area m²"
            value={details.standAreaM2 || ""}
            onChange={(e) => setDetail("standAreaM2", e.target.value)}
          />
          <Select
            placeholder="Ramp required"
            value={details.rampRequired || ""}
            onChange={(e) => setDetail("rampRequired", e.target.value)}
          >
            {RAMP_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Select
            placeholder="Floor finish"
            value={details.floorFinish || ""}
            onChange={(e) => setDetail("floorFinish", e.target.value)}
          >
            {FLOOR_FINISH_OPTIONS.map((finish) => (
              <option key={finish} value={finish}>
                {finish}
              </option>
            ))}
          </Select>
        </>
      )}
    </VStack>
  );
};

interface RaiStandPlacementMockProps {
  details: RaiServiceDetails;
  onChange: (details: RaiServiceDetails) => void;
  context: ReturnType<typeof getRaiDemoContextById>;
}

const RaiStandPlacementMock: React.FC<RaiStandPlacementMockProps> = ({
  details,
  onChange,
  context,
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const selectedLocation = details.standGridLocation || "";
  const setGridLocation = (location: string) =>
    onChange({ ...details, standGridLocation: location });

  const returnPlacement = () => {
    onClose();
    toast({
      title: "Placement returned from configurator",
      description: `Grid location ${selectedLocation || "not selected"} captured for supplier execution.`,
      status: "success",
      duration: 5000,
      isClosable: true,
    });
  };

  return (
    <VStack
      alignItems="stretch"
      borderWidth="1px"
      borderRadius="md"
      p={4}
      spacing={3}
      w="full"
    >
      <HStack
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
      >
        <Heading size="sm">Stand placement</Heading>
        <Badge colorScheme="purple">Mocked Art of Fiber grid</Badge>
      </HStack>
      <Text fontSize="xs" color="chakra-subtle-text">
        Demo-only placement preview for utility supplier execution.
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <SimpleGrid columns={2} spacing={2} aria-label="Stand placement grid">
          {GRID_LOCATIONS.map((location) => {
            const isSelected = selectedLocation === location;
            return (
              <Button
                key={location}
                type="button"
                variant={isSelected ? "solid" : "outline"}
                colorScheme={isSelected ? "primary" : "gray"}
                minH="52px"
                onClick={() => setGridLocation(location)}
                aria-pressed={isSelected}
              >
                {location}
              </Button>
            );
          })}
        </SimpleGrid>
        <VStack alignItems="stretch" spacing={2} fontSize="sm">
          <HStack justifyContent="space-between">
            <Text color="chakra-subtle-text">Hall</Text>
            <Text fontWeight="semibold">{context.hall}</Text>
          </HStack>
          <HStack justifyContent="space-between">
            <Text color="chakra-subtle-text">Stand number</Text>
            <Text fontWeight="semibold">{context.standNumber}</Text>
          </HStack>
          <HStack justifyContent="space-between">
            <Text color="chakra-subtle-text">Stand package</Text>
            <Text fontWeight="semibold">{context.standPackage}</Text>
          </HStack>
          <Button
            type="button"
            variant="outline"
            alignSelf="flex-start"
            onClick={onOpen}
          >
            Open stand configurator
          </Button>
        </VStack>
      </SimpleGrid>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Art of Fiber stand configurator</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack alignItems="stretch" spacing={4}>
              <Text fontSize="sm" color="chakra-subtle-text">
                This is a mocked redirect/return flow. Production would request
                a stand-specific configurator URL from RAI middleware. The
                configurator would return placement coordinates to the webshop.
              </Text>
              {/* Demo-only: Production would use RAI middleware and Art of Fiber, not local UI state. */}
              <Box borderWidth="1px" borderRadius="md" p={3}>
                <VStack alignItems="stretch" spacing={2} fontSize="sm">
                  <HStack justifyContent="space-between">
                    <Text color="chakra-subtle-text">EventID</Text>
                    <Text fontWeight="semibold">{context.eventId}</Text>
                  </HStack>
                  <HStack justifyContent="space-between">
                    <Text color="chakra-subtle-text">ExhibitorID</Text>
                    <Text fontWeight="semibold">{context.exhibitorId}</Text>
                  </HStack>
                  <HStack justifyContent="space-between">
                    <Text color="chakra-subtle-text">Hall</Text>
                    <Text fontWeight="semibold">{context.hall}</Text>
                  </HStack>
                  <HStack justifyContent="space-between">
                    <Text color="chakra-subtle-text">StandNumber</Text>
                    <Text fontWeight="semibold">{context.standNumber}</Text>
                  </HStack>
                  <HStack justifyContent="space-between">
                    <Text color="chakra-subtle-text">
                      Selected grid location
                    </Text>
                    <Text fontWeight="semibold">
                      {selectedLocation || "Not selected"}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              colorScheme="primary"
              onClick={returnPlacement}
            >
              Return placement to webshop
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

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
    { productID: productId },
  );
  const { data: inventoryRecords } = useOcResourceList<InventoryRecord>(
    "Me.ProductInventoryRecords",
    undefined,
    { productID: productId },
    { disabled: !IS_MULTI_LOCATION_INVENTORY },
  );

  const [addingToCart, setAddingToCart] = useState(false);
  const [specs, setSpecs] = useState<SpecLike[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<
    Record<string, SelectedSpec>
  >({});
  const [specErrors, setSpecErrors] = useState<string[]>([]);
  const [specsLoading, setSpecsLoading] = useState(false);
  const [quantity, setQuantity] = useState(
    product?.PriceSchedule?.MinQuantity ?? 1,
  );
  const [raiServiceDetails, setRaiServiceDetails] = useState<RaiServiceDetails>(
    {},
  );
  const productXp = useMemo(() => parseProductXp(product?.xp), [product?.xp]);
  const productImages = useMemo(
    () =>
      (productXp.Images || []).filter(
        (image): image is { ThumbnailUrl?: string; Url: string } =>
          Boolean(image.Url),
      ),
    [productXp.Images],
  );
  const raiServiceDetailsType = useMemo(
    () => getRaiServiceDetailsType(product),
    [product],
  );
  const raiDependencyRecommendations = useMemo(
    () => getRaiDependencyRecommendations(product, raiServiceDetailsType),
    [product, raiServiceDetailsType],
  );
  const selectedRaiContext = useMemo(
    () =>
      getRaiDemoContextById(
        typeof window === "undefined"
          ? undefined
          : window.localStorage.getItem(RAI_DEMO_CONTEXT_STORAGE_KEY),
      ),
    [],
  );
  const outOfStock = useMemo(
    () => product?.Inventory?.QuantityAvailable === 0,
    [product?.Inventory?.QuantityAvailable],
  );
  const { addCartLineItem } = useShopper();

  useEffect(() => {
    setQuantity(product?.PriceSchedule?.MinQuantity ?? 1);
  }, [product?.PriceSchedule?.MinQuantity]);

  useEffect(() => {
    setRaiServiceDetails({});
  }, [product?.ID]);

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
          if (spec.ID && spec.DefaultOptionID)
            defaults[spec.ID] = {
              SpecID: spec.ID,
              OptionID: spec.DefaultOptionID,
            };
        });
        setSelectedSpecs(defaults);
      } catch (error) {
        console.error("Failed to load product specs", error);
      } finally {
        if (!cancelled) setSpecsLoading(false);
      }
    }
    loadSpecs();
    return () => {
      cancelled = true;
    };
  }, [productId]);

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
      return;
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
        toast({
          title: "Required options missing",
          description: missing.join(", "),
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
        return;
      }
      if (raiServiceDetailsType) {
        const hasMissingRaiDetails = getRequiredRaiServiceDetailFields(
          raiServiceDetailsType,
        ).some((field) => !raiServiceDetails[field]?.trim());
        if (hasMissingRaiDetails) {
          setAddingToCart(false);
          toast({
            title: "Required service details missing",
            description:
              "Complete the RAI service details before adding this item to the cart.",
            status: "warning",
            duration: 5000,
            isClosable: true,
          });
          return;
        }
      }

      const raiLineItemXp = {
        RAI: {
          Demo: true,
          ...(raiServiceDetailsType
            ? {
                ServiceDetailsType: raiServiceDetailsType,
                ServiceDetails: raiServiceDetails,
              }
            : {}),
          CapturedFor: {
            EventID: selectedRaiContext.eventId,
            ExhibitorID: selectedRaiContext.exhibitorId,
            Hall: selectedRaiContext.hall,
            StandNumber: selectedRaiContext.standNumber,
          },
          // Demo-only: production would retrieve delegated access relationships
          // from the post-Keycloak profile/Momentus service call and enforce
          // permissions server-side before accepting this attribution.
          ...(isDelegatedRaiDemoContext(selectedRaiContext)
            ? {
                Delegation: {
                  DelegatedOrder: true,
                  DelegationID: selectedRaiContext.delegationId,
                  ActorAccountID: selectedRaiContext.actorAccountId,
                  ActorCompanyName: selectedRaiContext.actorCompanyName,
                  ActingOnBehalfOfAccountID:
                    selectedRaiContext.actingOnBehalfOfAccountId,
                  ActingOnBehalfOfCompanyName:
                    selectedRaiContext.actingOnBehalfOfCompanyName,
                  InvoiceTo: selectedRaiContext.invoiceTo,
                  Source: "Mocked exhibitor-granted access",
                },
              }
            : {}),
        },
      };

      await addCartLineItem({
        ProductID: productId,
        Quantity: quantity,
        InventoryRecordID: activeRecordId,
        Specs: Object.values(selectedSpecs).filter(
          (s) => s.OptionID || s.Value,
        ),
        xp: raiLineItemXp,
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
  }, [
    product,
    activeRecordId,
    productId,
    toast,
    addCartLineItem,
    quantity,
    navigate,
    specs,
    selectedSpecs,
    raiServiceDetailsType,
    raiServiceDetails,
    selectedRaiContext,
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
        <ProductImageGallery images={productImages} />
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
          {specsLoading && (
            <Alert status="info">
              <AlertIcon />
              Loading product options…
            </Alert>
          )}
          <ProductSpecs
            specs={specs}
            selected={selectedSpecs}
            errors={specErrors}
            basePrice={product?.PriceSchedule?.PriceBreaks?.[0].Price || 0}
            quantity={quantity}
            onChange={setSelectedSpecs}
          />
          <RaiProductInfo rai={productXp.RAI} />
          {raiServiceDetailsType && (
            <RaiDependencyRecommendations
              recommendations={raiDependencyRecommendations}
            />
          )}
          {raiServiceDetailsType && (
            <RaiServiceDetailsForm
              type={raiServiceDetailsType}
              details={raiServiceDetails}
              onChange={setRaiServiceDetails}
            />
          )}
          {raiServiceDetailsType === "utility" && (
            <RaiStandPlacementMock
              details={raiServiceDetails}
              onChange={setRaiServiceDetails}
              context={selectedRaiContext}
            />
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
        </VStack>
      </SimpleGrid>
    )
  ) : (
    <div>Product not found for ID: {productId}</div>
  );
};

export default ProductDetail;
