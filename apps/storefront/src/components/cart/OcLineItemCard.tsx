import { Box, Button, Flex, Grid, HStack, Image, Link, Stack, Text, VStack, useToast } from "@chakra-ui/react";
import { BuyerProduct, LineItem } from "ordercloud-javascript-sdk";
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link as RouterLink } from "react-router-dom";
import formatPrice from "../../utils/formatPrice";
import OcQuantityInput from "./OcQuantityInput";
import { useOcResourceGet, useShopper } from "@ordercloud/react-sdk";
import { productQuantity, quantityError } from "../../utils/kfmbQuantityRules";
import { assertCartQuantityChange } from "../../utils/kfmbCartQuantityChecks";
import { markQuantityEdit, runCartAction } from "../../utils/kfmbCartEdits";
import { sellingUnit } from "../../utils/kfmbSellingUnit";

interface OcLineItemCardProps {
  lineItem: LineItem;
  editable?: boolean;
  currency?: string;
  onChange?: (newLi: LineItem) => void;
}

const OcLineItemCard: FunctionComponent<OcLineItemCardProps> = ({
  lineItem,
  editable,
  currency,
  onChange,
}) => {
  const [quantity, setQuantity] = useState(Number(lineItem.Quantity ?? 1));
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string>();
  const { patchCartLineItem, deleteCartLineItem, orderWorksheet, worksheetLoading } = useShopper();
  const { data: buyerProduct, isLoading: priceLoading } = useOcResourceGet<BuyerProduct>(
    "Me.Products", { productID: lineItem.ProductID }, { disabled: !editable }
  );
  const toast = useToast();
  const editKey = `${orderWorksheet?.Order?.ID ?? "cart"}:${lineItem.ID}`;
  const otherQuantity = productQuantity(orderWorksheet?.LineItems, lineItem.ProductID, lineItem.ID);
  const inputError = editable ? quantityError(buyerProduct?.PriceSchedule, quantity, otherQuantity) : undefined;
  const dirty = quantity !== lineItem.Quantity;
  const product = useMemo(() => lineItem.Product, [lineItem]);

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
    return formatPrice(lineItem.LineSubtotal, currency || orderWorksheet?.Order?.Currency);
  }, [lineItem, currency, orderWorksheet?.Order?.Currency]);

  const unitPrice = useMemo(() => {
    return formatPrice(lineItem.UnitPrice, currency || orderWorksheet?.Order?.Currency);
  }, [lineItem, currency, orderWorksheet?.Order?.Currency]);

  const unit = sellingUnit(product);
  return (
    <Grid id="lineItemRow" templateColumns={{ base: "64px minmax(0, 1fr)", md: "80px minmax(0, 1fr)" }} gap={{ base: 3, md: 5 }} py={5} w="full" minW={0}>
      <Box w="full" h={{ base: "80px", md: "100px" }} p={2} border="1px solid" borderColor="trade.border" bg="white" borderRadius="md">
        <Image src={lineItem.Product?.xp?.Images?.[0]?.Url} alt={lineItem.Product?.Name || "Product"} objectFit="contain" w="full" h="full" fallback={<Flex h="full" align="center" justify="center"><Text fontSize="xs" color="trade.muted" textAlign="center">Image unavailable</Text></Flex>} />
      </Box>
      <Stack spacing={4} minW={0}>
        <Stack spacing={1}>
          <Link as={RouterLink} to={`/products/${lineItem.ProductID}`} fontWeight="semibold" lineHeight="short" overflowWrap="anywhere">{lineItem.Product?.Name || lineItem.ProductID}</Link>
          {unit.detail && <Text fontSize="sm" color="trade.muted">{unit.detail}</Text>}
          <Text fontSize="sm" color="trade.muted">{unitPrice} / {unit.singular}</Text>
          <Text fontSize="xs" color="trade.muted" overflowWrap="anywhere">Item number: {lineItem.ProductID}</Text>
          {lineItem.Specs?.map((spec) => <React.Fragment key={spec.SpecID}><Text fontSize="sm" color="trade.muted">{spec.Name}: {spec.Value}</Text></React.Fragment>)}
        </Stack>
        <Flex align="flex-end" gap={4} wrap="wrap" justify="space-between">
          {editable ? <VStack alignItems="flex-start" spacing={2} minW={0}>
            {product && <OcQuantityInput
              controlId={`quantity-${lineItem.ID}`}
              productId={lineItem.ProductID}
              priceSchedule={buyerProduct?.PriceSchedule}
              otherQuantity={otherQuantity}
              quantity={quantity}
              label={`Quantity (${unit.plural})`}
              disabled={updating || worksheetLoading || priceLoading}
              onChange={changeQuantity}
            />}
            {dirty && <>
              <HStack flexWrap="wrap"><Button size="sm" isLoading={updating} isDisabled={updating || worksheetLoading || priceLoading || !!inputError} onClick={() => void updateLineItem()}>Update</Button><Button size="sm" variant="ghost" isDisabled={updating} onClick={() => changeQuantity(Number(lineItem.Quantity ?? 1))}>Cancel</Button></HStack>
              <Text fontSize="sm" color="trade.muted">Apply or cancel this edit before placing the order.</Text>
            </>}
            {updateError && <Text fontSize="sm" role="alert" color="red.700">{updateError}</Text>}
          </VStack> : <Text fontSize="sm" color="trade.muted">Qty: <Text as="span" fontWeight="semibold" color="trade.ink">{lineItem.Quantity} {lineItem.Quantity === 1 ? unit.singular : unit.plural}</Text></Text>}
          <Text fontWeight="semibold" fontSize="lg" color="trade.ink" whiteSpace="nowrap" ml="auto">{lineSubtotal}</Text>
        </Flex>
        {editable && <Button size="sm" variant="ghost" alignSelf="flex-start" ml={-3} isDisabled={updating} onClick={() => void removeLineItem()}>Remove</Button>}
      </Stack>
    </Grid>
  );
};

export default OcLineItemCard;
