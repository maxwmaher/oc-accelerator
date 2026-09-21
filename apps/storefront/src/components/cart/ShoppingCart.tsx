import { Button, Center, Container, Grid, GridItem, Heading, Spinner, Tab, TabList, TabPanel, TabPanels, Tabs, Text, useToast, VStack } from "@chakra-ui/react";
import { useOrderCloudContext, useShopper } from "@ordercloud/react-sdk";
import { Orders } from "ordercloud-javascript-sdk";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { DEFAULT_PICKUP_LOCATION } from "../../config/pickupLocations";
import { useCurrentUser } from "../../hooks/currentUser";
import { assertNoPendingQuantityEdits, runCartAction } from "../../utils/kfmbCartEdits";
import { getDemoOrderStatus, PaymentOutcome, processDemoPayment } from "../../utils/demoCheckoutApi";
import { CartInformationPanel, PickupForm } from "./cart-panels/CartInformationPanel";
import { CartPaymentPanel } from "./cart-panels/CartPaymentPanel";
import CartSkeleton from "./ShoppingCartSkeleton";
import CartSummary from "./ShoppingCartSummary";

const TABS = { PICKUP: 0, PAYMENT: 1 };
export const ShoppingCart = (): JSX.Element => {
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tabIndex, setTabIndex] = useState(TABS.PICKUP);
  const [paymentStatus, setPaymentStatus] = useState<string>();
  const [pickup, setPickup] = useState<PickupForm>({ contactName: "", contact: "", notes: "" });
  const { orderWorksheet, worksheetLoading, deleteCart, submitCart, applyPromotions, calculateOrder, refreshWorksheet } = useShopper();
  const { isLoggedIn } = useOrderCloudContext();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const user = currentUser.data;
    if (user && !pickup.contactName && !pickup.contact)
      setPickup((value) => ({ ...value, contactName: `${user.FirstName || ""} ${user.LastName || ""}`.trim(), contact: user.Email || user.Phone || "" }));
  }, [currentUser.data, pickup.contact, pickup.contactName]);

  const savePickup = useCallback(async () => {
    const order = orderWorksheet?.Order;
    if (!order?.ID || !isLoggedIn) {
      toast({ title: "Sign in to continue checkout", status: "warning" }); return;
    }
    setSaving(true);
    try {
      assertNoPendingQuantityEdits();
      await Orders.Patch("Outgoing", order.ID, {
        ShippingCost: 0, TaxCost: 0,
        xp: { ...(order.xp || {}), KFMBCheckout: { ...((order.xp?.KFMBCheckout as object) || {}), Fulfillment: "Pickup", Pickup: { LocationID: DEFAULT_PICKUP_LOCATION.id, Country: DEFAULT_PICKUP_LOCATION.country, Label: DEFAULT_PICKUP_LOCATION.label, ContactName: pickup.contactName.trim(), Contact: pickup.contact.trim(), Notes: pickup.notes.trim() } } },
      });
      await applyPromotions();
      await calculateOrder();
      await refreshWorksheet();
      setPaymentStatus(undefined);
      setTabIndex(TABS.PAYMENT);
    } catch (error) {
      toast({ title: "Could not save pickup details", description: error instanceof Error ? error.message : "Try again.", status: "error" });
    } finally { setSaving(false); }
  }, [applyPromotions, calculateOrder, isLoggedIn, orderWorksheet?.Order, pickup, refreshWorksheet, toast]);

  const handlePayment = useCallback(async (outcome: PaymentOutcome) => {
    const orderID = orderWorksheet?.Order?.ID;
    if (!orderID || submitting) return;
    if (!isLoggedIn) { toast({ title: "Sign in to submit this order", status: "warning" }); return; }
    setSubmitting(true);
    try {
      await runCartAction(async () => {
        assertNoPendingQuantityEdits();
        const initialStatus = await getDemoOrderStatus(orderID);
        if (initialStatus.status === "submitted") {
          await refreshWorksheet().catch(() => undefined);
          navigate(`/order-confirmation?orderID=${encodeURIComponent(orderID)}`);
          return;
        }
        await applyPromotions();
        const calculated = await calculateOrder();
        const order = calculated.Order;
        await refreshWorksheet();
        const payment = await processDemoPayment(orderID, outcome, order.Total, order.Currency);
        setPaymentStatus(payment.status);
        if (payment.status !== "approved") {
          if (payment.errors?.length) throw new Error(payment.errors.join(" "));
          toast({ title: payment.status === "declined" ? "Demo payment declined" : "Demo payment cancelled", description: "Your cart is unchanged and can be retried.", status: "info" });
          return;
        }
        try {
          await submitCart();
        } catch (submissionError) {
          // A timeout can hide a successful OrderCloud submission. Only the authoritative,
          // ownership-checked status endpoint may turn that ambiguous result into confirmation.
          const status = await getDemoOrderStatus(orderID);
          if (status.status !== "submitted") throw submissionError;
        }
        await refreshWorksheet().catch(() => undefined);
        navigate(`/order-confirmation?orderID=${encodeURIComponent(orderID)}`);
      });
    } catch (error) {
      toast({ title: "Checkout was not completed", description: error instanceof Error ? error.message : "Your cart remains available. Please try again.", status: "error", duration: 7000, isClosable: true });
    } finally { setSubmitting(false); }
  }, [applyPromotions, calculateOrder, isLoggedIn, navigate, orderWorksheet?.Order?.ID, refreshWorksheet, submitCart, submitting, toast]);

  if (worksheetLoading) return <CartSkeleton />;
  if (!orderWorksheet?.Order || !orderWorksheet.LineItems?.length) return <Center flex="1"><VStack mt={-28}><Heading>Cart is empty</Heading><Button as={RouterLink} size="sm" to="/products">Continue shopping</Button></VStack></Center>;
  return <>
    {submitting && <Center boxSize="full" h="100vh" position="absolute" zIndex={1234} background="whiteAlpha.400"><VStack><Spinner size="xl" /><Text>Completing demo checkout…</Text></VStack></Center>}
    <Grid gridTemplateColumns={{ md: "3fr 2fr" }} w="full" flex="1">
      <GridItem><Container maxW="container.lg" mx="0" ml="auto" p={{ base: 6, lg: 12 }}><Heading mb={6}>Pickup checkout</Heading>
        {!isLoggedIn && <Text color="red.600" mb={4}>Sign in with a shopper account before continuing.</Text>}
        <Tabs size="sm" index={tabIndex} onChange={setTabIndex} variant="soft-rounded"><TabList><Tab>Pickup details</Tab><Tab isDisabled={!orderWorksheet.Order.xp?.KFMBCheckout?.Pickup}>Payment and review</Tab></TabList><TabPanels>
          <TabPanel><CartInformationPanel pickup={pickup} setPickup={setPickup} handleSavePickup={savePickup} saving={saving} /></TabPanel>
          <TabPanel><CartPaymentPanel onPayment={handlePayment} submitting={submitting} paymentStatus={paymentStatus} /></TabPanel>
        </TabPanels></Tabs>
      </Container></GridItem>
      <GridItem bgColor="blackAlpha.100"><Container maxW="container.sm" mx="0" mr="auto" p={{ base: 6, lg: 12 }}><CartSummary deleteOrder={deleteCart} onSubmitOrder={() => handlePayment("approve")} tabIndex={tabIndex} /></Container></GridItem>
    </Grid>
  </>;
};
export default ShoppingCart;
