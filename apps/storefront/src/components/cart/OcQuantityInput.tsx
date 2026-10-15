import { ChangeEvent, FunctionComponent, useMemo } from "react";
import {
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react";
import { PriceSchedule, BuyerProduct } from "ordercloud-javascript-sdk";
import { useOcResourceGet } from "@ordercloud/react-sdk";
import { quantityBounds, quantityError, quantityRuleLabel } from "../../utils/kfmbQuantityRules";

interface OcQuantityInputProps {
  controlId: string;
  priceSchedule?: PriceSchedule;
  productId?: string;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  quantity: number;
  /** Quantity of this ProductID in other cart lines (or already in cart on PDP). */
  otherQuantity?: number;
  onChange: (quantity: number) => void;
}

const OcQuantityInput: FunctionComponent<OcQuantityInputProps> = ({
  controlId, productId, priceSchedule, label = "Quantity", disabled, loading = false,
  quantity, otherQuantity = 0, onChange,
}) => {
  const { data } = useOcResourceGet<BuyerProduct>(
    "Me.Products", { productID: productId! },
    { disabled: !productId || !!priceSchedule }
  );
  const ps = priceSchedule ?? data?.PriceSchedule;
  const bounds = useMemo(() => ps ? quantityBounds(ps, otherQuantity) : undefined, [ps, otherQuantity]);
  const error = quantityError(ps, quantity, otherQuantity);
  const noRemaining = bounds?.entryMax !== undefined && bounds.entryMax < bounds.entryMin;
  const allowedEntries = ps?.PriceBreaks
    ?.map(breakpoint => (breakpoint.Quantity ?? Number.NaN) - (bounds?.offset ?? 0))
    .filter(value => Number.isSafeInteger(value) && value >= (bounds?.entryMin ?? 1) &&
      (bounds?.entryMax === undefined || value <= bounds.entryMax)) ?? [];
  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => onChange(Number(event.target.value));

  if (loading) return <Text role="status" fontSize="sm" color="trade.muted">Loading quantity and cart rules…</Text>;
  if (!ps || !bounds) return <Text role="alert" fontSize="sm" color="red.700">Quantity rules are unavailable.</Text>;

  return (
    <VStack alignItems="flex-start" spacing={2} maxW="360px" w="full">
      <Text as="label" htmlFor={controlId} fontSize="sm" fontWeight="semibold" color="trade.ink">{label}</Text>
      {noRemaining ? null : ps.RestrictedQuantity ? (
        <Select id={controlId} size="md" maxW="220px" minH="48px" value={Number.isFinite(quantity) ? quantity : ""}
          isDisabled={disabled || noRemaining || !allowedEntries.length}
          aria-describedby={`${controlId}-rules`} isInvalid={!!error}
          onChange={handleSelectChange}>
          {!allowedEntries.includes(quantity) && <option value="">Choose quantity</option>}
          {allowedEntries.map(value => <option key={value} value={value}>{value}</option>)}
        </Select>
      ) : (
        <NumberInput id={controlId} size="md" maxW="244px" w="full" display="flex" alignItems="center"
          value={Number.isFinite(quantity) ? quantity : ""}
          min={bounds.entryMin} max={bounds.entryMax === undefined ? undefined : Math.max(bounds.entryMin, bounds.entryMax)}
          step={1} keepWithinRange clampValueOnBlur={false}
          isDisabled={disabled || noRemaining} isInvalid={!!error}
          onChange={(text, value) => onChange(text.trim() === "" ? Number.NaN : value)}>
          <NumberInputField inputMode="numeric" aria-label={label} minH="48px" minW="64px" pr={3} mr={2} flex={1}
            aria-describedby={`${controlId}-rules${error ? ` ${controlId}-error` : ""}`} />
          <NumberInputStepper position="static" flexDir="row" w="104px" h="48px" m={0} gap={2} flexShrink={0}>
            <NumberIncrementStepper minW="48px" minH="48px" border="1px solid" borderColor="trade.border" borderRadius="md" bg="trade.ivory" aria-label="Increase quantity" />
            <NumberDecrementStepper minW="48px" minH="48px" border="1px solid" borderColor="trade.border" borderRadius="md" bg="trade.ivory" aria-label="Decrease quantity" />
          </NumberInputStepper>
        </NumberInput>
      )}
      <Text id={`${controlId}-rules`} fontSize="sm" color="trade.muted">
        {quantityRuleLabel(ps)}
        {ps.UseCumulativeQuantity && otherQuantity > 0 ? ` Already in the cart elsewhere: ${otherQuantity}.` : ""}
      </Text>
      {noRemaining ? (
        <Text fontSize="sm" color="trade.muted">The order maximum has been reached. Reduce or remove an existing cart line to add more.</Text>
      ) : error ? (
        <Text id={`${controlId}-error`} role="alert" fontSize="sm" color="red.700">{error}</Text>
      ) : null}
    </VStack>
  );
};
export default OcQuantityInput;
