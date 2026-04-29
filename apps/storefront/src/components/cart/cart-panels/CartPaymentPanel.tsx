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
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useShopper } from "@ordercloud/react-sdk";
import { Payment, Payments } from "ordercloud-javascript-sdk";
import { FormEvent, useMemo, useState } from "react";
import { FUNCTIONS_BASE_URL } from "../../../constants";

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

const getCardType = (cardNumber: string) => {
  if (/^4/.test(cardNumber)) return "Visa";
  if (/^5[1-5]/.test(cardNumber)) return "Mastercard";
  if (/^3[47]/.test(cardNumber)) return "AmericanExpress";
  if (/^6(?:011|5)/.test(cardNumber)) return "Discover";
  return "Unknown";
};

export const CartPaymentPanel = ({ submitOrder, submitting }: CartPaymentPanelProps) => {
  const { orderWorksheet } = useShopper();
  const toast = useToast();
  const [processingPayment, setProcessingPayment] = useState(false);
  const [formData, setFormData] = useState<DemoPaymentForm>(initialState);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof DemoPaymentForm, string>>>({});
  const [acceptedPayment, setAcceptedPayment] = useState<Payment | null>(null);

  const orderID = orderWorksheet?.Order?.ID;
  const total = orderWorksheet?.Order?.Total ?? 0;

  const paymentReady = useMemo(() => {
    if (acceptedPayment?.Accepted) return true;
    return false;
  }, [acceptedPayment?.Accepted]);

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

  const acceptPayment = async (createdPayment: Payment) => {
    const endpoint = `${FUNCTIONS_BASE_URL}/api/payments/accept`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderID, paymentID: createdPayment.ID }),
    });
    if (!response.ok) {
      throw new Error(`Payment acceptance failed (${response.status})`);
    }
    return (await response.json()) as Payment;
  };

  const onSubmitDemoPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!orderID || total <= 0) {
      toast({ title: "Missing order", description: "Unable to locate the active order.", status: "error" });
      return;
    }
    if (!FUNCTIONS_BASE_URL) {
      toast({ title: "Missing payment API config", description: "Set VITE_APP_FUNCTIONS_BASE_URL.", status: "error" });
      return;
    }
    if (!validate()) return;

    const sanitizedCard = formData.cardNumber.replace(/\s+/g, "");
    const createdPaymentRequest = {
      Type: "CreditCard" as any,
      Amount: total,
      xp: {
        CardType: getCardType(sanitizedCard),
        LastFour: sanitizedCard.slice(-4),
        ExpirationMonth: Number(formData.expirationMonth),
        ExpirationYear: Number(formData.expirationYear),
        BillingZip: formData.billingZip.trim(),
        DemoPayment: true,
      },
    };

    try {
      setProcessingPayment(true);
      const createdPayment = await Payments.Create("Outgoing", orderID, createdPaymentRequest);
      const accepted = await acceptPayment(createdPayment);
      setAcceptedPayment(accepted);
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
      <Box as="form" onSubmit={onSubmitDemoPayment}>
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
      </Box>

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
