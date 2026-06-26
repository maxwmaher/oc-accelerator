import {
  Badge,
  Button,
  Center,
  HStack,
  Heading,
  Icon,
  Image,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { LineItem } from "ordercloud-javascript-sdk";
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { TbPhoto } from "react-icons/tb";
import { Link as RouterLink, useLocation } from "react-router-dom";
import useDebounce from "../../hooks/useDebounce";
import formatPrice from "../../utils/formatPrice";
import { parseProductXp } from "../../utils/productXp";
import OcQuantityInput from "./OcQuantityInput";
import { useShopper } from "@ordercloud/react-sdk";

interface RaiDelegationXp {
  DelegatedOrder?: boolean;
  ActingOnBehalfOfCompanyName?: string;
}

interface RaiLineItemXp {
  RAI?: {
    Demo?: boolean;
    SupplierRoute?: string;
    ServiceDetailsType?: "catering" | "utility" | "flooring" | string;
    ServiceDetails?: Record<string, string | undefined>;
    CapturedFor?: {
      EventID?: string;
      ExhibitorID?: string;
      Hall?: string;
      StandNumber?: string;
    };
    Delegation?: RaiDelegationXp;
  };
}

const getRaiLineItemXp = (lineItem: LineItem) =>
  lineItem.xp as RaiLineItemXp | undefined;

const getRaiSupplierRoute = (lineItem: LineItem) => {
  const rai = getRaiLineItemXp(lineItem)?.RAI;
  if (rai?.SupplierRoute) return rai.SupplierRoute;
  if (rai?.ServiceDetailsType === "catering") return "Catering operations";
  if (rai?.ServiceDetailsType === "utility") return "Electrical services";
  if (rai?.ServiceDetailsType === "flooring") return "Stand construction";
  if (rai?.Demo) return "Exhibitor services";
  return undefined;
};

const getRaiServiceDetailsSummary = (lineItem: LineItem) => {
  const rai = getRaiLineItemXp(lineItem)?.RAI;
  const details = rai?.ServiceDetails;
  if (!rai?.Demo || !details) return undefined;

  if (rai.ServiceDetailsType === "catering") {
    return `Delivery date: ${details.deliveryDate || "—"} · Time slot: ${details.deliveryTimeSlot || "—"} · Stand contact: ${details.standContactName || "—"}`;
  }
  if (rai.ServiceDetailsType === "utility") {
    return `Grid location: ${details.standGridLocation || "—"} · Required by: ${details.requiredBy || "—"} · Technical contact: ${details.technicalContactPhone || "—"}`;
  }
  if (rai.ServiceDetailsType === "flooring") {
    return `Stand area: ${details.standAreaM2 || "—"} m² · Ramp: ${details.rampRequired || "—"} · Finish: ${details.floorFinish || "—"}`;
  }
  return undefined;
};

const getRaiCapturedForSummary = (lineItem: LineItem) => {
  const capturedFor = getRaiLineItemXp(lineItem)?.RAI?.CapturedFor;
  if (!capturedFor) return undefined;
  return `EventID: ${capturedFor.EventID || "—"} · ExhibitorID: ${capturedFor.ExhibitorID || "—"} · Hall: ${capturedFor.Hall || "—"} · Stand number: ${capturedFor.StandNumber || "—"}`;
};

interface OcLineItemCardProps {
  lineItem: LineItem;
  editable?: boolean;
  onChange?: (newLi: LineItem) => void;
}

const OcLineItemCard: FunctionComponent<OcLineItemCardProps> = ({
  lineItem,
  editable,
  onChange,
}) => {
  const [quantity, setQuantity] = useState(lineItem.Quantity);
  const { patchCartLineItem, deleteCartLineItem } = useShopper();
  const { pathname } = useLocation();

  const debouncedQuantity: number = useDebounce(quantity, 300);

  const product = useMemo(() => lineItem.Product, [lineItem]);
  const [isDeliveryInstructionsModalOpen, setIsDeliveryInstructionsModalOpen] =
    useState(false);

  const updateLineItem = useCallback(
    async (quantity: number) => {
      if (lineItem.Quantity === quantity) return;
      const response = await patchCartLineItem({
        ID: lineItem.ID!,
        lineItem: {
          Quantity: quantity,
        },
      });
      if (onChange) {
        onChange(response);
      }
    },
    [lineItem.ID, lineItem.Quantity, onChange, patchCartLineItem],
  );

  useEffect(() => {
    updateLineItem(debouncedQuantity);
  }, [debouncedQuantity, updateLineItem]);

  const lineSubtotal = useMemo(() => {
    return formatPrice(lineItem.LineSubtotal);
  }, [lineItem]);

  const unitPrice = useMemo(() => {
    return formatPrice(lineItem.UnitPrice);
  }, [lineItem]);

  const productXp = useMemo(
    () => parseProductXp(lineItem?.Product?.xp),
    [lineItem?.Product?.xp],
  );
  const primaryImage = productXp.Images?.[0];
  const primaryImageUrl = primaryImage?.ThumbnailUrl || primaryImage?.Url;
  const raiSupplierRoute = useMemo(
    () => getRaiSupplierRoute(lineItem),
    [lineItem],
  );
  const raiServiceDetailsSummary = useMemo(
    () => getRaiServiceDetailsSummary(lineItem),
    [lineItem],
  );
  const raiCapturedForSummary = useMemo(
    () => getRaiCapturedForSummary(lineItem),
    [lineItem],
  );
  const raiDelegation = getRaiLineItemXp(lineItem)?.RAI?.Delegation;

  return (
    <>
      <HStack
        id="lineItemRow"
        flexWrap={{ base: "wrap", lg: "nowrap" }}
        p={{ base: 3, md: "unset" }}
        gap={9}
        w="full"
      >
        <VStack alignItems="flex-start" gap={0}>
          <Center
            bgColor="chakra-subtle-bg"
            aspectRatio="1 / 1"
            objectFit="cover"
            boxSize="80px"
            rounded="md"
          >
            {primaryImageUrl ? (
              <Image
                rounded="md"
                boxSize="full"
                objectFit="cover"
                src={primaryImageUrl}
                zIndex={1}
                onError={(e) => {
                  e.currentTarget.src = ""; // Prevent the broken image from rendering
                  e.currentTarget.style.display = "none"; // Hide the broken image
                }}
              />
            ) : (
              <Icon fontSize="2rem" color="gray.300" as={TbPhoto} />
            )}
            <Icon
              fontSize="2rem"
              color="gray.300"
              as={TbPhoto}
              position="absolute"
            />
          </Center>
          {pathname !== "/order-confirmation" && (
            <Button
              size="xs"
              fontSize=".75rem"
              variant="link"
              colorScheme="accent"
              onClick={() => deleteCartLineItem(lineItem.ID!)}
            >
              Remove
            </Button>
          )}
        </VStack>
        <VStack alignItems="flex-start" gap={3} flexGrow="1">
          <Link as={RouterLink} to={`/products/${lineItem?.Product?.ID}`}>
            <Text fontSize="sm" lineHeight="1.3" display="inline-block">
              {lineItem.Product?.Name}
            </Text>
          </Link>
          <HStack alignItems="center" color="chakra-subtle-text" mt={-2}>
            <Text fontSize="xs">
              <Text fontWeight="600" display="inline">
                Item number:{" "}
              </Text>
              {lineItem.Product?.ID}
            </Text>
          </HStack>
          {raiSupplierRoute && (
            <Badge mt={-2} colorScheme="blue" variant="subtle">
              Supplier route: {raiSupplierRoute}
            </Badge>
          )}
          {raiServiceDetailsSummary && (
            <Text mt={-2} fontSize="xs" color="chakra-subtle-text">
              <Text fontWeight="600" display="inline">
                Service details: {" "}
              </Text>
              {raiServiceDetailsSummary}
            </Text>
          )}
          {raiCapturedForSummary && (
            <Text mt={-3} fontSize="xs" color="chakra-subtle-text">
              <Text fontWeight="600" display="inline">
                Event / stand: {" "}
              </Text>
              {raiCapturedForSummary}
            </Text>
          )}
          {raiDelegation?.DelegatedOrder && (
            <Text mt={-3} fontSize="xs" color="purple.600" fontWeight="600">
              Stand builder order for {raiDelegation.ActingOnBehalfOfCompanyName} · Invoice to exhibitor
            </Text>
          )}
          {lineItem?.Specs?.map((spec) => (
            <React.Fragment key={spec.SpecID}>
              <Text mt={-3} fontSize="xs" color="chakra-subtle-text">
                <Text fontWeight="600" display="inline">
                  {spec.Name}:
                </Text>{" "}
                {spec.Value}
              </Text>
            </React.Fragment>
          ))}
        </VStack>
        {editable ? (
          <VStack alignItems="flex-start">
            {product && (
              <OcQuantityInput
                controlId="addToCart"
                productId={lineItem.ProductID}
                quantity={Number(quantity)}
                onChange={setQuantity}
              />
            )}
          </VStack>
        ) : (
          <Text ml="auto" color="chakra-subtle-text">
            Qty:{" "}
            <Text as="span" fontWeight="bold" color="chakra-body-text">
              {lineItem.Quantity}
            </Text>
          </Text>
        )}
        <VStack minW="75px" alignItems="flex-end" gap="0">
          <Text fontWeight="600" fontSize="lg">
            {lineSubtotal}
          </Text>
          <Text fontSize=".7em" color="chakra-subtle-text">
            ({unitPrice} each)
          </Text>
        </VStack>
      </HStack>

      <Modal
        isOpen={isDeliveryInstructionsModalOpen}
        onClose={() => setIsDeliveryInstructionsModalOpen(false)}
      >
        <ModalOverlay />
        <ModalContent width="full" w="100%" maxWidth="800px">
          <ModalHeader>
            <Heading>Add Delivery Instructions</Heading>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack>
              <Textarea placeholder="Delivery instructions" height="175px" />
              <HStack
                w="100%"
                width="full"
                justifyItems="space-between"
                justifyContent="space-between"
                mb={6}
              >
                <Button
                  type="button"
                  aria-describedby="ae-checkout-tip"
                  border="1px"
                  borderColor="gray.300"
                  variant="primaryButton"
                  height="50px"
                  onClick={() => setIsDeliveryInstructionsModalOpen(false)}
                >
                  <Text fontSize="18px">Add Delivery Instructions</Text>
                </Button>

                <Button
                  type="button"
                  aria-describedby="ae-checkout-tip"
                  border="1px"
                  borderColor="gray.300"
                  variant="secondaryButton"
                  height="50px"
                  onClick={() => setIsDeliveryInstructionsModalOpen(false)}
                >
                  <Text fontSize="18px">Cancel</Text>
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default OcLineItemCard;
