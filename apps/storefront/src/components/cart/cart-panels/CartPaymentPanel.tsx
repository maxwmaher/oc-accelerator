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
import { Order, Orders, Payment, Payments } from "ordercloud-javascript-sdk";
import { FormEvent, useEffect, useMemo, useState } from "react";
import formatPrice from "../../../utils/formatPrice";
import { getDemoAcceptPaymentUrl } from "../../../config/demoFunctions";

type CartPaymentPanelProps = {
  submitOrder: () => void;
  submitting: boolean;
};

type DemoPaymentForm = {
  nameOnCard: string;
  cardNumber: string;
  expirationMonth: string;
  expirationYear: string;
  cvv: string;
  billingZip: string;
};

const initialState: DemoPaymentForm = {
  nameOnCard: "",
  cardNumber: "",
  expirationMonth: "",
  expirationYear: "",
  cvv: "",
  billingZip: "",
};
const amountsDiffer = (a?: number | null, b?: number | null) => Math.abs((a ?? 0) - (b ?? 0)) > 0.0001;

type DemoPaymentSummary = {
  cardholderName: string;
  cardType: string;
  maskedCardNumber: string;
  expirationMonth: number;
  expirationYear: number;
  billingZip: string;
  amount: number;
};

type DemoPaymentXp = {
  BillingZip?: string;
  CardType?: string;
  CardholderName?: string;
  DemoPayment?: boolean;
  ExpirationMonth?: number;
  ExpirationYear?: number;
  LastFour?: string;
};

type DemoPayment = Payment<DemoPaymentXp>;


const parseResponseBody = (responseText: string) => {
  if (!responseText) return null;
  try {
    return JSON.parse(responseText);
  } catch {
    return { message: responseText };
  }
};

const getCardType = (cardNumber: string) => {
  if (/^4/.test(cardNumber)) return "Visa";
  if (/^5[1-5]/.test(cardNumber)) return "Mastercard";
  if (/^3[47]/.test(cardNumber)) return "AmericanExpress";
  if (/^6(?:011|5)/.test(cardNumber)) return "Discover";
  return "Unknown";
};

export const CartPaymentPanel = ({ submitOrder, submitting }: CartPaymentPanelProps) => {
  const { orderWorksheet, calculateOrder } = useShopper();
  const toast = useToast();
  const [processingPayment, setProcessingPayment] = useState(false);
  const [formData, setFormData] = useState<DemoPaymentForm>(initialState);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof DemoPaymentForm, string>>>({});
  const [acceptedPayment, setAcceptedPayment] = useState<DemoPayment | null>(null);
  const [existingPayment, setExistingPayment] = useState<DemoPayment | null>(null);
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
        const paymentList = await Payments.List("Outgoing", orderID, { pageSize: 100, sortBy: ["DateCreated"] });
        let accepted: DemoPayment | null = (paymentList.Items?.find((payment) => payment.Accepted) as DemoPayment | undefined) || null;
        const latest = paymentList.Items?.[paymentList.Items.length - 1] || null;
        if (accepted?.ID && amountsDiffer(accepted.Amount, total)) {
          accepted = await acceptPayment(orderID, accepted.ID, total);
        }

        const selected = accepted || latest;
        setAcceptedPayment(accepted || null);
        setExistingPayment(selected);
        if (accepted) {
          const xp = accepted.xp || {};
          setSummary({
            cardholderName: xp.CardholderName || "Cardholder",
            cardType: xp.CardType || "Credit Card",
            maskedCardNumber: `•••• •••• •••• ${xp.LastFour || "0000"}`,
            expirationMonth: Number(xp.ExpirationMonth) || 0,
            expirationYear: Number(xp.ExpirationYear) || 0,
            billingZip: xp.BillingZip || "N/A",
            amount: accepted.Amount ?? total,
          });
        } else {
          setSummary(null);
        }
      } catch (error) {
        console.error("Failed to load payments", error);
        toast({ title: "Unable to load payments", description: "Please refresh and try again.", status: "error" });
      } finally {
        setLoadingPaymentState(false);
      }
    };
    loadPayments();
  }, [orderID, toast, total]);

  const validate = () => {
    const nextErrors: Partial<Record<keyof DemoPaymentForm, string>> = {};
    const sanitizedCard = formData.cardNumber.replace(/\s+/g, "");
    const month = Number(formData.expirationMonth);
    const year = Number(formData.expirationYear);
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;

    if (!formData.nameOnCard.trim()) nextErrors.nameOnCard = "Name on card is required";
    if (!/^\d{13,19}$/.test(sanitizedCard)) nextErrors.cardNumber = "Card number must be 13-19 digits";
    if (!Number.isInteger(month) || month < 1 || month > 12) nextErrors.expirationMonth = "Use month 1-12";
    if (!Number.isInteger(year) || year < currentYear || year > currentYear + 20) {
      nextErrors.expirationYear = "Enter a valid future year";
    } else if (month && year === currentYear && month < currentMonth) {
      nextErrors.expirationYear = "Expiration must be in the future";
    }
    if (!/^\d{3,4}$/.test(formData.cvv)) nextErrors.cvv = "CVV is required";
    if (!formData.billingZip.trim()) nextErrors.billingZip = "Billing ZIP/postal code is required";

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const acceptPayment = async (orderID: string, paymentID: string, amount: number) => {
    const direction = "All";
    const endpoint = getDemoAcceptPaymentUrl();
    const method = "POST";
    const requestBody = { orderID, paymentID, direction, amount };

    try {
      if (!endpoint) {
        throw new Error("PAYMENT_FLOW_DEBUG: missing functions base URL, cannot call acceptpayment");
      }

      console.info("PAYMENT_FLOW_DEBUG: about to accept payment", {
        resolvedUrl: endpoint,
        method,
        requestPayload: requestBody,
      });

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      const responseBody = parseResponseBody(responseText);
      console.info("PAYMENT_FLOW_DEBUG: accept payment response", {
        status: response.status,
        responseBody,
      });

      if (!response.ok) {
        const error = new Error(responseBody?.message || responseBody?.error || `Payment acceptance failed (${response.status})`);
        console.error("PAYMENT_FLOW_DEBUG: accept payment failed", {
          error,
          resolvedUrl: endpoint,
          payload: requestBody,
          status: response.status,
          responseBody,
        });
        throw error;
      }

      return responseBody as DemoPayment;
    } catch (error) {
      console.error("PAYMENT_FLOW_DEBUG: accept payment failed", {
        error,
        resolvedUrl: endpoint,
        payload: requestBody,
      });
      throw error;
    }
  };

  const onSubmitDemoPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!orderID || total <= 0) {
      toast({ title: "Missing order", description: "Unable to locate the active order.", status: "error" });
      return;
    }
    if (!validate()) return;

    const sanitizedCard = formData.cardNumber.replace(/\s+/g, "");
    let paymentAmount = total;
    try {
      setProcessingPayment(true);
      await calculateOrder();
      const latestWorksheet = await calculateOrder();
      const currentOrder = (latestWorksheet?.Order as Order) || ((await Orders.Get("Outgoing", orderID)) as Order);
      if (!currentOrder?.ID) throw new Error("Unable to load current order before payment create.");
      const estimateResponse = latestWorksheet?.ShipEstimateResponse;
      if (!estimateResponse?.Succeeded || !estimateResponse?.ShipEstimates?.length) {
        throw new Error("Shipping estimate must succeed before creating payment.");
      }
      const latestTotal = latestWorksheet?.Order?.Total ?? currentOrder.Total ?? total;
      paymentAmount = latestTotal;
      console.info("paymentAmount and order.Total before payment creation", { paymentAmount, orderTotal: latestTotal });
      if (amountsDiffer(paymentAmount, latestTotal)) {
        const mismatchMessage = `Payment amount mismatch: attempted ${paymentAmount}, expected order total ${latestTotal}`;
        console.error(mismatchMessage);
        throw new Error(mismatchMessage);
      }

      const createdPaymentRequest = {
        Type: "CreditCard" as const,
        Amount: paymentAmount,
        xp: {
          CardholderName: formData.nameOnCard.trim(),
          CardType: getCardType(sanitizedCard),
          LastFour: sanitizedCard.slice(-4),
          ExpirationMonth: Number(formData.expirationMonth),
          ExpirationYear: Number(formData.expirationYear),
          BillingZip: formData.billingZip.trim(),
          DemoPayment: true,
        },
      };

      let paymentToUse = existingPayment;
      if (paymentToUse?.Accepted) {
        paymentToUse = null;
      }

      console.info("PAYMENT_FLOW_DEBUG: about to create payment", {
        orderID: currentOrder.ID,
        direction: "Outgoing",
        amount: paymentAmount,
        requestPayload: createdPaymentRequest,
        existingPaymentID: paymentToUse?.ID || null,
      });

      const workingPayment = paymentToUse?.ID
        ? await Payments.Patch("Outgoing", currentOrder.ID, paymentToUse.ID, createdPaymentRequest)
        : await Payments.Create("Outgoing", currentOrder.ID, createdPaymentRequest);

      if (!workingPayment?.ID) throw new Error("Payment was created or updated without an ID.");
      console.info("PAYMENT_FLOW_DEBUG: payment created", {
        orderID: currentOrder.ID,
        paymentID: workingPayment.ID,
        direction: "Outgoing",
        amount: workingPayment.Amount ?? paymentAmount,
        rawCreatedPaymentResponse: workingPayment,
      });

      const paymentCheck = await Payments.Get("Outgoing", currentOrder.ID, workingPayment.ID);
      if (!paymentCheck?.ID) throw new Error("Unable to verify created payment before acceptance.");
      console.info("Demo payment verified before acceptance", {
        orderID: currentOrder.ID,
        paymentID: paymentCheck.ID,
        amount: paymentCheck.Amount,
        accepted: paymentCheck.Accepted,
      });

      const accepted = await acceptPayment(currentOrder.ID, workingPayment.ID, paymentAmount);
      setAcceptedPayment(accepted);
      setExistingPayment(accepted);
      setSummary({
        cardholderName: formData.nameOnCard.trim(),
        cardType: getCardType(sanitizedCard) || "Credit Card",
        maskedCardNumber: `•••• •••• •••• ${sanitizedCard.slice(-4)}`,
        expirationMonth: Number(formData.expirationMonth),
        expirationYear: Number(formData.expirationYear),
        billingZip: formData.billingZip.trim(),
        amount: accepted.Amount ?? currentOrder.Total ?? paymentAmount,
      });
      setFormData(initialState);
      toast({ title: "Payment saved", description: "Demo payment is accepted and ready.", status: "success" });
    } catch (error) {
      console.error("Demo payment failed", error);
      toast({
        title: "Unable to save payment",
        description: "We couldn't save and accept this payment. Please try again.",
        status: "error",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <VStack align="stretch" spacing={4}>
      {loadingPaymentState ? (
        <HStack><Spinner size="sm" /><Text>Loading payment information...</Text></HStack>
      ) : null}

      {!paymentReady ? <Box as="form" onSubmit={onSubmitDemoPayment}>
        <VStack align="stretch" spacing={3}>
          <FormControl isRequired isInvalid={Boolean(fieldErrors.nameOnCard)}>
            <FormLabel>Name on card</FormLabel>
            <Input value={formData.nameOnCard} onChange={(e) => setFormData((p) => ({ ...p, nameOnCard: e.target.value }))} />
            <FormErrorMessage>{fieldErrors.nameOnCard}</FormErrorMessage>
          </FormControl>
          <FormControl isRequired isInvalid={Boolean(fieldErrors.cardNumber)}>
            <FormLabel>Card number</FormLabel>
            <Input value={formData.cardNumber} onChange={(e) => setFormData((p) => ({ ...p, cardNumber: e.target.value }))} />
            <FormErrorMessage>{fieldErrors.cardNumber}</FormErrorMessage>
          </FormControl>
          <HStack align="start">
            <FormControl isRequired isInvalid={Boolean(fieldErrors.expirationMonth)}>
              <FormLabel>Exp. month</FormLabel>
              <Input value={formData.expirationMonth} onChange={(e) => setFormData((p) => ({ ...p, expirationMonth: e.target.value }))} />
              <FormErrorMessage>{fieldErrors.expirationMonth}</FormErrorMessage>
            </FormControl>
            <FormControl isRequired isInvalid={Boolean(fieldErrors.expirationYear)}>
              <FormLabel>Exp. year</FormLabel>
              <Input value={formData.expirationYear} onChange={(e) => setFormData((p) => ({ ...p, expirationYear: e.target.value }))} />
              <FormErrorMessage>{fieldErrors.expirationYear}</FormErrorMessage>
            </FormControl>
            <FormControl isRequired isInvalid={Boolean(fieldErrors.cvv)}>
              <FormLabel>CVV</FormLabel>
              <Input value={formData.cvv} onChange={(e) => setFormData((p) => ({ ...p, cvv: e.target.value }))} />
              <FormErrorMessage>{fieldErrors.cvv}</FormErrorMessage>
            </FormControl>
          </HStack>
          <FormControl isRequired isInvalid={Boolean(fieldErrors.billingZip)}>
            <FormLabel>Billing ZIP/postal code</FormLabel>
            <Input value={formData.billingZip} onChange={(e) => setFormData((p) => ({ ...p, billingZip: e.target.value }))} />
            <FormErrorMessage>{fieldErrors.billingZip}</FormErrorMessage>
          </FormControl>
          <Button type="submit" isLoading={processingPayment} loadingText="Saving payment" alignSelf="flex-start">
            Save Payment
          </Button>
        </VStack>
      </Box> : null}

      {paymentReady && summary ? (
        <Box borderWidth="1px" borderRadius="md" p={4}>
          <Text fontWeight="semibold" mb={2}>Payment accepted</Text>
          <VStack align="stretch" spacing={1} fontSize="sm">
            <Text>Cardholder: {summary.cardholderName}</Text>
            <Text>Card type: {summary.cardType || "Credit Card"}</Text>
            <Text>Card number: {summary.maskedCardNumber}</Text>
            <Text>Expires: {summary.expirationMonth}/{summary.expirationYear}</Text>
            <Text>Billing ZIP: {summary.billingZip}</Text>
            <Text>Amount accepted: {formatPrice(summary.amount)}</Text>
          </VStack>
        </Box>
      ) : null}

      {paymentReady ? (
        <Alert status="success"><AlertIcon /><AlertTitle>Payment accepted</AlertTitle><AlertDescription>Order is ready for submission.</AlertDescription></Alert>
      ) : (
        <Alert status="warning"><AlertIcon /><AlertDescription>Save payment to enable Submit Order.</AlertDescription></Alert>
      )}

      <Text fontSize="sm" color="chakra-subtle-text">Demo mode only. Full card number and CVV are never stored.</Text>

      <Button alignSelf="flex-end" onClick={submitOrder} mt={2} isDisabled={submitting || processingPayment || !paymentReady}>
        {submitting ? "Submitting" : "Submit Order"}
      </Button>
    </VStack>
  );
};
