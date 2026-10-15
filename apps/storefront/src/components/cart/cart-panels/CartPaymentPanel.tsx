import { Alert, AlertDescription, AlertIcon, Button, Flex, Heading, Text, VStack } from "@chakra-ui/react";
import { PaymentOutcome } from "../../../utils/demoCheckoutApi";
import { DemoNotice } from "../../trade/TradePrimitives";

type Props = { onPayment: (outcome: PaymentOutcome) => void; submitting: boolean; paymentStatus?: string; };
export const CartPaymentPanel = ({ onPayment, submitting, paymentStatus }: Props) => (
  <VStack align="stretch" spacing={5}>
    <Heading as="h2" size="md">Payment and review</Heading>
    <DemoNotice><Text fontWeight="semibold" color="trade.ink" mb={1}>Demo payment — no real charge.</Text><Text>No card number or CVV is collected. Review the order summary before approving.</Text></DemoNotice>
    <Text color="trade.muted" fontSize="sm">Choose a simulated payment outcome. Approve submits this order; Decline or Cancel keeps the cart available to retry.</Text>
    {paymentStatus && <Alert status={paymentStatus === "approved" ? "success" : "info"} variant="subtle"><AlertIcon /><AlertDescription><Text fontWeight="semibold">Payment status: {paymentStatus}</Text>{paymentStatus !== "approved" && <Text>Your cart is unchanged. You can retry when ready.</Text>}</AlertDescription></Alert>}
    <Button w="full" h="auto" minH="48px" py={3} onClick={() => onPayment("approve")} isLoading={submitting}>Approve and submit order</Button>
    <Flex gap={3} justify="flex-end" wrap="wrap">
      <Button variant="ghost" onClick={() => onPayment("cancel")} isDisabled={submitting}>Cancel</Button>
      <Button variant="outline" onClick={() => onPayment("decline")} isDisabled={submitting}>Decline</Button>
    </Flex>
  </VStack>
);
