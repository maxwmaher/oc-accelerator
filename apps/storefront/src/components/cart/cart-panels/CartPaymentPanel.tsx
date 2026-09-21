import { Alert, AlertDescription, AlertIcon, Button, ButtonGroup, Heading, Text, VStack } from "@chakra-ui/react";
import { PaymentOutcome } from "../../../utils/demoCheckoutApi";

type Props = { onPayment: (outcome: PaymentOutcome) => void; submitting: boolean; paymentStatus?: string; };
export const CartPaymentPanel = ({ onPayment, submitting, paymentStatus }: Props) => (
  <VStack align="stretch" spacing={5}>
    <Heading size="md">Payment and review</Heading>
    <Alert status="info"><AlertIcon /><AlertDescription><strong>Demo payment — no real charge.</strong> No card number or CVV is collected.</AlertDescription></Alert>
    <Text>Choose an outcome to simulate the hosted card gateway. Only Approve creates and accepts an OrderCloud payment record.</Text>
    {paymentStatus && <Text fontWeight="semibold">Payment status: {paymentStatus}</Text>}
    <ButtonGroup justifyContent="flex-end">
      <Button variant="ghost" onClick={() => onPayment("cancel")} isDisabled={submitting}>Cancel</Button>
      <Button colorScheme="red" variant="outline" onClick={() => onPayment("decline")} isDisabled={submitting}>Decline</Button>
      <Button onClick={() => onPayment("approve")} isLoading={submitting}>Approve and submit order</Button>
    </ButtonGroup>
  </VStack>
);
