import {
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
  useToast,
} from "@chakra-ui/react";
import { BuyerProduct, LineItem } from "ordercloud-javascript-sdk";
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { TbPhoto } from "react-icons/tb";
import { Link as RouterLink, useLocation } from "react-router-dom";
import formatPrice from "../../utils/formatPrice";
import OcQuantityInput from "./OcQuantityInput";
import { useOcResourceGet, useShopper } from "@ordercloud/react-sdk";
import { productQuantity, quantityError } from "../../utils/kfmbQuantityRules";
import { assertCartQuantityChange } from "../../utils/kfmbCartQuantityChecks";
import { markQuantityEdit, runCartAction } from "../../utils/kfmbCartEdits";

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
  const [quantity, setQuantity] = useState(Number(lineItem.Quantity ?? 1));
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string>();
  const { patchCartLineItem, deleteCartLineItem, orderWorksheet, worksheetLoading } = useShopper();
  const { data: buyerProduct, isLoading: priceLoading } = useOcResourceGet<BuyerProduct>(
    "Me.Products", { productID: lineItem.ProductID }, { disabled: !editable }
  );
  const { pathname } = useLocation();
  const toast = useToast();
  const editKey = `${orderWorksheet?.Order?.ID ?? "cart"}:${lineItem.ID}`;
  const otherQuantity = productQuantity(orderWorksheet?.LineItems, lineItem.ProductID, lineItem.ID);
  const inputError = editable ? quantityError(buyerProduct?.PriceSchedule, quantity, otherQuantity) : undefined;
  const dirty = quantity !== lineItem.Quantity;
  const product = useMemo(() => lineItem.Product, [lineItem]);
  const [isDeliveryInstructionsModalOpen, setIsDeliveryInstructionsModalOpen] = useState(false);

  useEffect(() => {
    setQuantity(Number(lineItem.Quantity ?? 1));
    markQuantityEdit(editKey, false);
  }, [lineItem.ID, lineItem.Quantity, editKey]);
  useEffect(() => () => markQuantityEdit(editKey, false), [editKey]);

  const changeQuantity = (next: number) => {
    setQuantity(next);
    setUpdateError(undefined);
    markQuantityEdit(editKey, next !== lineItem.Quantity);
  };

  const updateLineItem = useCallback(async () => {
    if (!editable || updating || inputError || quantity === lineItem.Quantity) return;
    setUpdating(true);
    setUpdateError(undefined);
    try {
      const orderId = orderWorksheet?.Order?.ID;
      if (!orderId) throw new Error("The cart is not ready. Refresh and try again.");
      await runCartAction(async () => {
        await assertCartQuantityChange(orderId, lineItem.ProductID, quantity, lineItem.ID);
        const response = await patchCartLineItem({ ID: lineItem.ID!, lineItem: { Quantity: quantity } });
        markQuantityEdit(editKey, false);
        if (onChange) onChange(response);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update this cart line.";
      setUpdateError(message);
      toast({ title: "Quantity was not updated", description: message, status: "error", isClosable: true });
    } finally {
      setUpdating(false);
    }
  }, [editable, updating, inputError, quantity, lineItem, orderWorksheet?.Order?.ID,
      patchCartLineItem, editKey, onChange, toast]);

  const removeLineItem = async () => {
    if (!editable || updating) return;
    setUpdating(true);
    try {
      await runCartAction(async () => {
        await deleteCartLineItem(lineItem.ID!);
        markQuantityEdit(editKey, false);
      });
    } catch (error) {
      toast({ title: "Could not remove this item", description: error instanceof Error ? error.message : "Please retry.", status: "error" });
    } finally { setUpdating(false); }
  };

  const lineSubtotal = useMemo(() => {
    return formatPrice(lineItem.LineSubtotal);
  }, [lineItem]);

  const unitPrice = useMemo(() => {
    return formatPrice(lineItem.UnitPrice);
  }, [lineItem]);

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
            {lineItem?.Product?.xp?.Images ? (
              <Image
                rounded="md"
                boxSize="full"
                objectFit="cover"
                src={lineItem?.Product?.xp?.Images[0].Url}
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
          {editable && pathname !== "/order-confirmation" && (
            <Button
              size="xs"
              fontSize=".75rem"
              variant="link"
              colorScheme="accent"
              isDisabled={updating}
              onClick={() => void removeLineItem()}
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
                controlId={`quantity-${lineItem.ID}`}
                productId={lineItem.ProductID}
                priceSchedule={buyerProduct?.PriceSchedule}
                otherQuantity={otherQuantity}
                quantity={quantity}
                disabled={updating || worksheetLoading || priceLoading}
                onChange={changeQuantity}
              />
            )}
            {dirty && (
              <HStack>
                <Button size="xs" isLoading={updating}
                  isDisabled={updating || worksheetLoading || priceLoading || !!inputError}
                  onClick={() => void updateLineItem()}>Update</Button>
                <Button size="xs" variant="ghost" isDisabled={updating}
                  onClick={() => changeQuantity(Number(lineItem.Quantity ?? 1))}>Cancel</Button>
              </HStack>
            )}
            {dirty && <Text fontSize="xs">Apply or cancel this edit before placing the order.</Text>}
            {updateError && <Text fontSize="xs" role="alert" color="red.600">{updateError}</Text>}
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
