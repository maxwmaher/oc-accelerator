import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Text,
  Spinner,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useShopper } from "@ordercloud/react-sdk";
import { Order, Orders, Payments } from "ordercloud-javascript-sdk";
import { FormEvent, useEffect, useMemo, useState } from "react";
import formatPrice from "../../../utils/formatPrice";
import {
  amountsDiffer,
  acceptDemoPayment,
  buildDemoPaymentSummary,
  createOrPatchAndAcceptDemoPayment,
  DemoPayment,
  DemoPaymentFormData,
  DemoPaymentSummary,
  validateDemoPaymentForm,
} from "../../../services/demoPayment";

type CartPaymentPanelProps = {
  submitOrder: () => void;
  submitting: boolean;
};

type DemoPaymentForm = DemoPaymentFormData;

const initialState: DemoPaymentForm = {
  nameOnCard: "",
  cardNumber: "",
  expirationMonth: "",
  expirationYear: "",
  cvv: "",
  billingZip: "",
};
export const CartPaymentPanel = ({
  submitOrder,
  submitting,
}: CartPaymentPanelProps) => {
  const { orderWorksheet, calculateOrder } = useShopper();
  const toast = useToast();
  const [processingPayment, setProcessingPayment] = useState(false);
  const [formData, setFormData] = useState<DemoPaymentForm>(initialState);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof DemoPaymentForm, string>>
  >({});
  const [acceptedPayment, setAcceptedPayment] = useState<DemoPayment | null>(
    null,
  );
  const [existingPayment, setExistingPayment] = useState<DemoPayment | null>(
    null,
  );
  const [summary, setSummary] = useState<DemoPaymentSummary | null>(null);
  const [loadingPaymentState, setLoadingPaymentState] = useState(false);

  const orderID = orderWorksheet?.Order?.ID;
  const total = orderWorksheet?.Order?.Total ?? 0;

  const paymentReady = useMemo(() => {
    if (acceptedPayment?.Accepted) return true;
    return false;
  }, [acceptedPayment?.Accepted]);

  useEffect(() => {
    const loadPayments = async () => {
      if (!orderID) return;
      try {
        setLoadingPaymentState(true);
        const paymentList = await Payments.List("Outgoing", orderID, {
          pageSize: 100,
          sortBy: ["DateCreated"],
        });
        let accepted: DemoPayment | null =
          (paymentList.Items?.find((payment) => payment.Accepted) as
            | DemoPayment
            | undefined) || null;
        const latest =
          paymentList.Items?.[paymentList.Items.length - 1] || null;
        if (accepted?.ID && amountsDiffer(accepted.Amount, total)) {
          accepted = await acceptDemoPayment(orderID, accepted.ID, total);
        }

        const selected = accepted || latest;
        setAcceptedPayment(accepted || null);
        setExistingPayment(selected);
        if (accepted) {
          setSummary(buildDemoPaymentSummary(accepted, total));
        } else {
          setSummary(null);
        }
      } catch (error) {
        console.error("Failed to load payments", error);
        toast({
          title: "Unable to load payments",
          description: "Please refresh and try again.",
          status: "error",
        });
      } finally {
        setLoadingPaymentState(false);
      }
    };
    loadPayments();
  }, [orderID, toast, total]);

  const validate = () => {
    const nextErrors = validateDemoPaymentForm(formData);
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmitDemoPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!orderID || total <= 0) {
      toast({
        title: "Missing order",
        description: "Unable to locate the active order.",
        status: "error",
      });
      return;
    }
    if (!validate()) return;

    let paymentAmount = total;
    try {
      setProcessingPayment(true);
      await calculateOrder();
      const latestWorksheet = await calculateOrder();
      const currentOrder =
        (latestWorksheet?.Order as Order) ||
        ((await Orders.Get("Outgoing", orderID)) as Order);
      if (!currentOrder?.ID)
        throw new Error("Unable to load current order before payment create.");
      const estimateResponse = latestWorksheet?.ShipEstimateResponse;
      if (
        !estimateResponse?.Succeeded ||
        !estimateResponse?.ShipEstimates?.length
      ) {
        throw new Error(
          "Shipping estimate must succeed before creating payment.",
        );
      }
      const latestTotal =
        latestWorksheet?.Order?.Total ?? currentOrder.Total ?? total;
      paymentAmount = latestTotal;
      console.info("paymentAmount and order.Total before payment creation", {
        paymentAmount,
        orderTotal: latestTotal,
      });
      if (amountsDiffer(paymentAmount, latestTotal)) {
        const mismatchMessage = `Payment amount mismatch: attempted ${paymentAmount}, expected order total ${latestTotal}`;
        console.error(mismatchMessage);
        throw new Error(mismatchMessage);
      }

      const accepted = await createOrPatchAndAcceptDemoPayment({
        order: currentOrder,
        formData,
        amount: paymentAmount,
        existingPayment,
      });
      setAcceptedPayment(accepted);
      setExistingPayment(accepted);
      setSummary(
        buildDemoPaymentSummary(accepted, currentOrder.Total ?? paymentAmount),
      );
      setFormData(initialState);
      toast({
        title: "Payment saved",
        description: "Demo payment is accepted and ready.",
        status: "success",
      });
    } catch (error) {
      console.error("Demo payment failed", error);
      toast({
        title: "Unable to save payment",
        description:
          "We couldn't save and accept this payment. Please try again.",
        status: "error",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <VStack align="stretch" spacing={4}>
      {loadingPaymentState ? (
        <HStack>
          <Spinner size="sm" />
          <Text>Loading payment information...</Text>
        </HStack>
      ) : null}

      {!paymentReady ? (
        <Box as="form" onSubmit={onSubmitDemoPayment}>
          <VStack align="stretch" spacing={3}>
            <FormControl isRequired isInvalid={Boolean(fieldErrors.nameOnCard)}>
              <FormLabel>Name on card</FormLabel>
              <Input
                value={formData.nameOnCard}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, nameOnCard: e.target.value }))
                }
              />
              <FormErrorMessage>{fieldErrors.nameOnCard}</FormErrorMessage>
            </FormControl>
            <FormControl isRequired isInvalid={Boolean(fieldErrors.cardNumber)}>
              <FormLabel>Card number</FormLabel>
              <Input
                value={formData.cardNumber}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, cardNumber: e.target.value }))
                }
              />
              <FormErrorMessage>{fieldErrors.cardNumber}</FormErrorMessage>
            </FormControl>
            <HStack align="start">
              <FormControl
                isRequired
                isInvalid={Boolean(fieldErrors.expirationMonth)}
              >
                <FormLabel>Exp. month</FormLabel>
                <Input
                  value={formData.expirationMonth}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      expirationMonth: e.target.value,
                    }))
                  }
                />
                <FormErrorMessage>
                  {fieldErrors.expirationMonth}
                </FormErrorMessage>
              </FormControl>
              <FormControl
                isRequired
                isInvalid={Boolean(fieldErrors.expirationYear)}
              >
                <FormLabel>Exp. year</FormLabel>
                <Input
                  value={formData.expirationYear}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      expirationYear: e.target.value,
                    }))
                  }
                />
                <FormErrorMessage>
                  {fieldErrors.expirationYear}
                </FormErrorMessage>
              </FormControl>
              <FormControl isRequired isInvalid={Boolean(fieldErrors.cvv)}>
                <FormLabel>CVV</FormLabel>
                <Input
                  value={formData.cvv}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, cvv: e.target.value }))
                  }
                />
                <FormErrorMessage>{fieldErrors.cvv}</FormErrorMessage>
              </FormControl>
            </HStack>
            <FormControl isRequired isInvalid={Boolean(fieldErrors.billingZip)}>
              <FormLabel>Billing ZIP/postal code</FormLabel>
              <Input
                value={formData.billingZip}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, billingZip: e.target.value }))
                }
              />
              <FormErrorMessage>{fieldErrors.billingZip}</FormErrorMessage>
            </FormControl>
            <Button
              type="submit"
              isLoading={processingPayment}
              loadingText="Saving payment"
              alignSelf="flex-start"
            >
              Save Payment
            </Button>
          </VStack>
        </Box>
      ) : null}

      {paymentReady && summary ? (
        <Box borderWidth="1px" borderRadius="md" p={4}>
          <Text fontWeight="semibold" mb={2}>
            Payment accepted
          </Text>
          <VStack align="stretch" spacing={1} fontSize="sm">
            <Text>Cardholder: {summary.cardholderName}</Text>
            <Text>Card type: {summary.cardType || "Credit Card"}</Text>
            <Text>Card number: {summary.maskedCardNumber}</Text>
            <Text>
              Expires: {summary.expirationMonth}/{summary.expirationYear}
            </Text>
            <Text>Billing ZIP: {summary.billingZip}</Text>
            <Text>Amount accepted: {formatPrice(summary.amount)}</Text>
          </VStack>
        </Box>
      ) : null}

      {paymentReady ? (
        <Alert status="success">
          <AlertIcon />
          <AlertTitle>Payment accepted</AlertTitle>
          <AlertDescription>Order is ready for submission.</AlertDescription>
        </Alert>
      ) : (
        <Alert status="warning">
          <AlertIcon />
          <AlertDescription>
            Save payment to enable Submit Order.
          </AlertDescription>
        </Alert>
      )}

      <Text fontSize="sm" color="chakra-subtle-text">
        Demo mode only. Full card number and CVV are never stored.
      </Text>

      <Button
        alignSelf="flex-end"
        onClick={submitOrder}
        mt={2}
        isDisabled={submitting || processingPayment || !paymentReady}
      >
        {submitting ? "Submitting" : "Submit Order"}
      </Button>
    </VStack>
  );
};
