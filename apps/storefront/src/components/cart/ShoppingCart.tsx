import { Box, Button, Center, Flex, Grid, Heading, Icon, Link, Spinner, Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text, useToast, VStack } from "@chakra-ui/react";
import { useOrderCloudContext, useShopper } from "@ordercloud/react-sdk";
import { Orders } from "ordercloud-javascript-sdk";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { TbShoppingBag } from "react-icons/tb";
import { COUNTRY_SELECTION_ENABLED } from "../../config/country";
import { ACTIVE_PICKUP_LOCATION } from "../../config/pickupLocations";
import { useCurrentUser } from "../../hooks/currentUser";
import { assertNoPendingQuantityEdits, runCartAction } from "../../utils/kfmbCartEdits";
import { getDemoOrderStatus, PaymentOutcome, processDemoPayment } from "../../utils/demoCheckoutApi";
import { CartInformationPanel, PickupForm } from "./cart-panels/CartInformationPanel";
import { CartPaymentPanel } from "./cart-panels/CartPaymentPanel";
import CartSkeleton from "./ShoppingCartSkeleton";
import CartSummary from "./ShoppingCartSummary";
import OcCurrentOrderLineItemList from "./OcCurrentOrderLineItemList";
import { PageIntro, Surface } from "../trade/TradePrimitives";

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
  const savedPickup = orderWorksheet?.Order?.xp?.KFMBCheckout?.Pickup;
  const pickupMatchesCountry = !COUNTRY_SELECTION_ENABLED ||
    (savedPickup?.LocationID === ACTIVE_PICKUP_LOCATION.id && savedPickup?.Country === ACTIVE_PICKUP_LOCATION.country);

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
      await runCartAction(async () => {
        assertNoPendingQuantityEdits();
        await Orders.Patch("Outgoing", order.ID, {
          ShippingCost: 0, TaxCost: 0,
          xp: { ...(order.xp || {}), KFMBCheckout: { ...((order.xp?.KFMBCheckout as object) || {}), Fulfillment: "Pickup", Pickup: { LocationID: ACTIVE_PICKUP_LOCATION.id, Country: ACTIVE_PICKUP_LOCATION.country, Label: ACTIVE_PICKUP_LOCATION.label, ContactName: pickup.contactName.trim(), Contact: pickup.contact.trim(), Notes: pickup.notes.trim() } } },
        });
        await applyPromotions();
        await calculateOrder();
        await refreshWorksheet();
        setPaymentStatus(undefined);
        setTabIndex(TABS.PAYMENT);
      });
    } catch (error) {
      toast({ title: "Could not save pickup details", description: error instanceof Error ? error.message : "Try again.", status: "error" });
    } finally { setSaving(false); }
  }, [applyPromotions, calculateOrder, isLoggedIn, orderWorksheet?.Order, pickup, refreshWorksheet, toast]);

  const handlePayment = useCallback(async (outcome: PaymentOutcome) => {
    const orderID = orderWorksheet?.Order?.ID;
    if (!orderID || submitting) return;
    if (!isLoggedIn) { toast({ title: "Sign in to submit this order", status: "warning" }); return; }
    if (!pickupMatchesCountry) {
      toast({ title: "Save pickup details for this country before payment", status: "warning" }); return;
    }
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
  }, [applyPromotions, calculateOrder, isLoggedIn, navigate, orderWorksheet?.Order?.ID, refreshWorksheet, submitCart, submitting, pickupMatchesCountry, toast]);

  if (worksheetLoading) return <CartSkeleton />;
  if (!orderWorksheet?.Order || !orderWorksheet.LineItems?.length) return <Surface maxW="760px" mx="auto" w="full" textAlign="center" py={{ base: 10, md: 16 }}><Stack align="center" spacing={5}><Center boxSize={16} bg="trade.ivory" borderRadius="full"><Icon as={TbShoppingBag} boxSize={8} color="trade.ink" /></Center><Heading as="h1" size="xl">Cart is empty</Heading><Text color="trade.muted" maxW="44ch">Browse your catalog and add the selling units you need to start an order.</Text><Button as={RouterLink} to="/products">Continue shopping</Button></Stack></Surface>;
  return <>
    {submitting && <Center inset={0} position="fixed" zIndex={1234} bg="whiteAlpha.900" role="status" aria-live="polite"><VStack spacing={5}><Spinner size="xl" color="trade.ink" /><Text fontWeight="semibold">Completing demo checkout…</Text></VStack></Center>}
    <PageIntro title="Pickup checkout"><Text>Review your items, confirm your pickup contact, then submit your demo order.</Text></PageIntro>
    <Grid templateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 360px" }} gap={{ base: 6, xl: 8 }} w="full" alignItems="start">
      <Stack spacing={6} minW={0}>
        <Surface>
          <Flex align="center" justify="space-between" gap={3} mb={3} flexWrap="wrap"><Heading as="h2" size="md">Your items <Text as="span" fontWeight="normal" color="trade.muted">({orderWorksheet.LineItems.length})</Text></Heading><Link as={RouterLink} to="/products" fontSize="sm" fontWeight="semibold">Continue shopping</Link></Flex>
          <OcCurrentOrderLineItemList currency={orderWorksheet.Order.Currency} lineItems={orderWorksheet.LineItems} emptyMessage="Your cart is empty" onChange={() => undefined} editable />
        </Surface>
        <Surface p={0} overflow="hidden">
          {!isLoggedIn && <Text color="red.700" px={{ base: 5, md: 7 }} pt={5}>Sign in with a shopper account before continuing.</Text>}
          <Tabs index={tabIndex} onChange={setTabIndex} variant="unstyled">
            <TabList px={{ base: 3, md: 5 }} pt={4} borderBottom="1px solid" borderColor="trade.border" gap={{ base: 1, md: 4 }}>
              <Tab gap={2} py={4} px={{ base: 2, md: 3 }} flex={1} minH="56px" fontSize="sm" fontWeight="semibold" borderBottom="3px solid" borderColor="transparent" color="trade.muted" _selected={{ borderColor: "trade.gold", color: "trade.ink" }}><Center aria-hidden="true" boxSize={6} flexShrink={0} border="1px solid" borderColor="currentColor" borderRadius="full" fontSize="xs">1</Center>Pickup details</Tab>
              <Tab gap={2} py={4} px={{ base: 2, md: 3 }} flex={1} minH="56px" fontSize="sm" fontWeight="semibold" borderBottom="3px solid" borderColor="transparent" color="trade.muted" _selected={{ borderColor: "trade.gold", color: "trade.ink" }} _disabled={{ opacity: .5, cursor: "not-allowed" }} isDisabled={!savedPickup || !pickupMatchesCountry}><Center aria-hidden="true" boxSize={6} flexShrink={0} border="1px solid" borderColor="currentColor" borderRadius="full" fontSize="xs">2</Center>Payment and review</Tab>
            </TabList>
            <TabPanels>
              <TabPanel p={{ base: 5, md: 7 }}><CartInformationPanel pickup={pickup} setPickup={setPickup} handleSavePickup={savePickup} saving={saving} /></TabPanel>
              <TabPanel p={{ base: 5, md: 7 }}><CartPaymentPanel onPayment={handlePayment} submitting={submitting} paymentStatus={paymentStatus} /></TabPanel>
            </TabPanels>
          </Tabs>
        </Surface>
      </Stack>
      <Box minW={0}><CartSummary deleteOrder={async () => {
        try { await runCartAction(() => deleteCart()); }
        catch (error) { toast({ title: "Could not clear cart", description: error instanceof Error ? error.message : "Try again.", status: "error" }); }
      }} /></Box>
    </Grid>
  </>;
};
export default ShoppingCart;
