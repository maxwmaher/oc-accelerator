import {
  Alert,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Radio,
  RadioGroup,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { OrderWorksheet } from "ordercloud-javascript-sdk";
import { useEffect, useMemo, useState } from "react";
import {
  DemoCreditCardForm,
  DemoPaymentMethod,
  prepareDemoAccountOnFilePayment,
  prepareDemoCreditCardPayment,
  validateDemoCreditCard,
} from "../../../services/demoCheckoutPayment";
import { canUseBristanDemoAccountOnFile } from "../../bristan/bristanDemoRoutes";

const defaultCardForm: DemoCreditCardForm = {
  cardholderName: "Bristan Demo Buyer",
  cardNumber: "4111 1111 1111 1111",
  expiration: "12/30",
  cvv: "123",
  billingZip: "10001",
};

type CartPaymentPanelProps = {
  orderWorksheet: OrderWorksheet;
  submitOrder: () => Promise<void>;
  submitting: boolean;
  username?: string;
  handlePrevTab?: () => void;
};

export const CartPaymentPanel = ({
  orderWorksheet,
  submitOrder,
  submitting,
  username,
  handlePrevTab,
}: CartPaymentPanelProps) => {
  const [paymentMethod, setPaymentMethod] =
    useState<DemoPaymentMethod>("credit-card");
  const [cardForm, setCardForm] = useState<DemoCreditCardForm>(defaultCardForm);
  const [preparingPayment, setPreparingPayment] = useState(false);
  const [validationError, setValidationError] = useState<string>();
  const toast = useToast();

  const canUseAccountOnFile = canUseBristanDemoAccountOnFile(username);

  useEffect(() => {
    if (!canUseAccountOnFile && paymentMethod === "account-on-file") {
      setPaymentMethod("credit-card");
    }
  }, [canUseAccountOnFile, paymentMethod]);

  const cardValidationErrors = useMemo(
    () => validateDemoCreditCard(cardForm),
    [cardForm]
  );

  const updateCardField = (field: keyof DemoCreditCardForm, value: string) => {
    setValidationError(undefined);
    setCardForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    setValidationError(undefined);
    setPreparingPayment(true);

    try {
      if (paymentMethod === "credit-card") {
        await prepareDemoCreditCardPayment(orderWorksheet, cardForm);
      } else {
        if (!canUseAccountOnFile) {
          throw new Error("Pay by account on file is not available for this buyer.");
        }
        await prepareDemoAccountOnFilePayment(orderWorksheet);
      }

      await submitOrder();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to prepare payment. Please try again.";
      setValidationError(message);
      toast({
        title: "Payment could not be prepared",
        description: message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setPreparingPayment(false);
    }
  };

  const isBusy = preparingPayment || submitting;

  return (
    <Stack spacing={6}>
      <Box>
        <Text fontWeight="semibold" mb={3}>
          Choose a payment method
        </Text>
        <RadioGroup
          value={paymentMethod}
          onChange={(value) => setPaymentMethod(value as DemoPaymentMethod)}
        >
          <Stack spacing={4}>
            <Box borderWidth="1px" borderRadius="md" p={4}>
              <Radio value="credit-card" fontWeight="semibold">
                Demo credit card
              </Radio>
              <Text color="gray.600" fontSize="sm" mt={2}>
                Use the safe demo card authorization for this checkout.
              </Text>
            </Box>
            {canUseAccountOnFile && (
              <Box borderWidth="1px" borderRadius="md" p={4}>
                <Radio value="account-on-file" fontWeight="semibold">
                  Pay by account on file
                </Radio>
                <Text color="gray.600" fontSize="sm" mt={2}>
                  Available for Bristan trade merchant accounts.
                </Text>
              </Box>
            )}
          </Stack>
        </RadioGroup>
      </Box>

      {paymentMethod === "credit-card" && (
        <Stack borderWidth="1px" borderRadius="md" p={4} spacing={4}>
          <Text fontWeight="semibold">Demo credit card details</Text>
          <FormControl isInvalid={!cardForm.cardholderName.trim()}>
            <FormLabel>Cardholder name</FormLabel>
            <Input
              value={cardForm.cardholderName}
              onChange={(event) =>
                updateCardField("cardholderName", event.target.value)
              }
            />
            <FormErrorMessage>Cardholder name is required.</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={cardForm.cardNumber.replace(/\D/g, "").length < 13}>
            <FormLabel>Card number</FormLabel>
            <Input
              inputMode="numeric"
              autoComplete="cc-number"
              value={cardForm.cardNumber}
              onChange={(event) => updateCardField("cardNumber", event.target.value)}
            />
            <FormErrorMessage>Enter a valid demo card number.</FormErrorMessage>
          </FormControl>
          <HStack align="start">
            <FormControl>
              <FormLabel>Expiration (MM/YY)</FormLabel>
              <Input
                value={cardForm.expiration}
                onChange={(event) =>
                  updateCardField("expiration", event.target.value)
                }
              />
            </FormControl>
            <FormControl>
              <FormLabel>CVV</FormLabel>
              <Input
                inputMode="numeric"
                type="password"
                value={cardForm.cvv}
                onChange={(event) => updateCardField("cvv", event.target.value)}
              />
            </FormControl>
          </HStack>
          <FormControl>
            <FormLabel>Billing ZIP</FormLabel>
            <Input
              inputMode="numeric"
              value={cardForm.billingZip}
              onChange={(event) => updateCardField("billingZip", event.target.value)}
            />
          </FormControl>
          <Text color="gray.600" fontSize="sm">
            Only safe card metadata is saved for this demo; full card numbers and
            CVV values are never stored after submission.
          </Text>
        </Stack>
      )}

      {validationError && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {validationError}
        </Alert>
      )}

      <HStack alignSelf="flex-end" mt={2}>
        <Button variant="ghost" onClick={handlePrevTab}>Back to shipping</Button>
        <Button
          onClick={handleSubmit}
          isDisabled={
            isBusy || (paymentMethod === "credit-card" && cardValidationErrors.length > 0)
          }
          isLoading={isBusy}
          loadingText={preparingPayment ? "Preparing payment" : "Submitting"}
          colorScheme="blue"
        >
          Place order
        </Button>
      </HStack>
    </Stack>
  );
};
