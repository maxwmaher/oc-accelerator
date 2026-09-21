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
  disabled?: boolean;
  quantity: number;
  /** Quantity of this ProductID in other cart lines (or already in cart on PDP). */
  otherQuantity?: number;
  onChange: (quantity: number) => void;
}

const OcQuantityInput: FunctionComponent<OcQuantityInputProps> = ({
  controlId, productId, priceSchedule, label = "Quantity", disabled,
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

  if (!ps || !bounds) return <Text fontSize="xs">Quantity rules unavailable or loading.</Text>;

  return (
    <VStack alignItems="flex-start" gap={1} maxW="320px">
      <Text as="label" htmlFor={controlId} fontSize="sm">{label}</Text>
      <Text id={`${controlId}-rules`} fontSize="xs" color="chakra-subtle-text">
        {quantityRuleLabel(ps)}
        {ps.UseCumulativeQuantity && otherQuantity > 0 ? ` Already in the cart elsewhere: ${otherQuantity}.` : ""}
      </Text>
      {ps.RestrictedQuantity ? (
        <Select id={controlId} size="sm" maxW="120px" value={Number.isFinite(quantity) ? quantity : ""}
          isDisabled={disabled || noRemaining || !allowedEntries.length}
          aria-describedby={`${controlId}-rules`} isInvalid={!!error}
          onChange={handleSelectChange}>
          {!allowedEntries.includes(quantity) && <option value="">Choose quantity</option>}
          {allowedEntries.map(value => <option key={value} value={value}>{value}</option>)}
        </Select>
      ) : (
        <NumberInput id={controlId} size="sm" maxW="120px"
          value={Number.isFinite(quantity) ? quantity : ""}
          min={bounds.entryMin} max={bounds.entryMax === undefined ? undefined : Math.max(bounds.entryMin, bounds.entryMax)}
          step={1} keepWithinRange clampValueOnBlur={false}
          isDisabled={disabled || noRemaining} isInvalid={!!error}
          onChange={(text, value) => onChange(text.trim() === "" ? Number.NaN : value)}>
          <NumberInputField inputMode="numeric" aria-label={label}
            aria-describedby={`${controlId}-rules${error ? ` ${controlId}-error` : ""}`} />
          <NumberInputStepper><NumberIncrementStepper /><NumberDecrementStepper /></NumberInputStepper>
        </NumberInput>
      )}
      {noRemaining ? (
        <Text fontSize="xs">The order maximum has been reached. Reduce or remove an existing cart line to add more.</Text>
      ) : error ? (
        <Text id={`${controlId}-error`} role="alert" fontSize="xs" color="red.600">{error}</Text>
      ) : null}
    </VStack>
  );
};
export default OcQuantityInput;
