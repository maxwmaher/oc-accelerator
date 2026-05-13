import {
  Button,
  Center,
  Container,
  Grid,
  GridItem,
  Heading,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useShopper } from "@ordercloud/react-sdk";
import { Address } from "ordercloud-javascript-sdk";
import { useCallback, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { CartInformationPanel } from "./cart-panels/CartInformationPanel";
import { CartPaymentPanel } from "./cart-panels/CartPaymentPanel";
import CartShippingPanel from "./cart-panels/CartShippingPanel";
import CartSkeleton from "./ShoppingCartSkeleton";
import CartSummary from "./ShoppingCartSummary";
import { useSellerContext } from "../../context/SellerContext";
import { useEffect } from "react";

export const TABS = {
  INFORMATION: 0,
  SHIPPING: 1,
  PAYMENT: 2,
};

export const ShoppingCart = (): JSX.Element => {
  const [submitting, setSubmitting] = useState(false);
  const [tabIndex, setTabIndex] = useState(TABS.INFORMATION);
  const [fallbackShippingMode, setFallbackShippingMode] = useState(false);
  const [fallbackShippingCost, setFallbackShippingCost] = useState<number | undefined>();

  const {
    orderWorksheet,
    worksheetLoading,
    deleteCart,
    submitCart,
    estimateShipping,
    calculateOrder,
    setShippingAddress: persistShippingAddress,
  } = useShopper();
  const { selectedSeller, ensureOrderSellerContext } = useSellerContext();

  const [shippingAddress, setShippingAddressState] = useState<Address>({
    FirstName: "",
    LastName: "",
    CompanyName: "",
    Street1: "",
    Street2: "",
    City: "",
    State: "",
    Zip: "",
    Country: "US",
    Phone: "",
  });

  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const clearMismatchedCart = async () => {
      const mismatch =
        selectedSeller?.sellerType === "supplier" &&
        orderWorksheet?.Order?.ToCompanyID &&
        orderWorksheet.Order.ToCompanyID !== selectedSeller.sellerID &&
        orderWorksheet?.LineItems?.length;
      if (mismatch) {
        await deleteCart();
        toast({
          title: "Cart updated",
          description: "Seller changed. Previous cart items were cleared.",
          status: "info",
          duration: 3500,
          isClosable: true,
        });
      }
    };
    clearMismatchedCart();
  }, [
    deleteCart,
    orderWorksheet?.LineItems?.length,
    orderWorksheet?.Order?.ToCompanyID,
    selectedSeller?.sellerID,
    selectedSeller?.sellerType,
    toast,
  ]);

  const submitOrder = useCallback(async () => {
    setSubmitting(true);
    if (!orderWorksheet?.Order?.ID) return;
    try {
      await ensureOrderSellerContext();
      console.log("[Checkout] Before calculate", { orderID: orderWorksheet.Order.ID });
      let calculateResponse;
      try {
        calculateResponse = await calculateOrder();
      } catch (calculateError) {
        console.error("[Checkout] Calculate failed", calculateError);
        throw calculateError;
      }
      console.log("[Checkout] Calculate response", calculateResponse);
      console.log("[Checkout] Before submit", { orderID: orderWorksheet.Order.ID });
      await submitCart();
      setSubmitting(false);
      navigate(`/order-confirmation?orderID=${orderWorksheet.Order.ID}`);
    } catch (err) {
      if (fallbackShippingMode && orderWorksheet?.Order?.ID) {
        setSubmitting(false);
        navigate(`/order-confirmation?orderID=${orderWorksheet.Order.ID}`);
        return;
      }
      console.error("Error submitting order:", err);
      setSubmitting(false);
      toast({
        title: "Error submitting order",
        description:
          "There was an issue submitting your order. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [calculateOrder, ensureOrderSellerContext, fallbackShippingMode, navigate, orderWorksheet?.Order?.ID, submitCart, toast]);

  const deleteOrder = useCallback(async () => {
    if (!orderWorksheet?.Order?.ID) return;
    await deleteCart();
  }, [deleteCart, orderWorksheet?.Order?.ID]);

  const handleNextTab = () => {
    setTabIndex((prevIndex) =>
      Math.min(prevIndex + 1, Object.keys(TABS).length - 1)
    );
  };

  const handlePrevTab = () => {
    setTabIndex((prevIndex) => Math.max(prevIndex - 1, 0));
  };

  const handleTabChange = (index: number) => {
    setTabIndex(index);
  };

  const handleSaveShippingAddress = async () => {
    if (!orderWorksheet?.Order?.ID) return;

    try {
      await ensureOrderSellerContext();
      // Persist to the OrderCloud cart before estimating so shipping services receive the latest address.
      await persistShippingAddress(shippingAddress);
      const estimatedWorksheet = await estimateShipping();
      const response = estimatedWorksheet?.ShipEstimateResponse;

      if (!response?.Succeeded || !response?.ShipEstimates?.length) {
        throw new Error("Shipping estimate did not return selectable ship methods.");
      }
      handleNextTab();
    } catch (err) {
      console.error("Failed to save shipping address:", err);
      toast({
        title: "Shipping estimate unavailable",
        description: "Please verify shipping details and try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <>
      {worksheetLoading ? (
        <CartSkeleton />
      ) : (
        <>
          {orderWorksheet?.Order &&
          orderWorksheet?.LineItems &&
          orderWorksheet?.LineItems?.length ? (
            <>
              {submitting && (
                <Center
                  boxSize="full"
                  h="100vh"
                  position="absolute"
                  zIndex={1234}
                  background="whiteAlpha.400"
                >
                  <VStack>
                    <Spinner
                      label="submitting order..."
                      thickness="10px"
                      speed=".5s"
                      color="gray.300"
                      opacity=".9"
                      size="xl"
                      zIndex={1235}
                    />
                    <Text color="gray.500">Submitting order...</Text>
                  </VStack>
                </Center>
              )}
              <Grid
                gridTemplateColumns={{ md: "3fr 2fr" }}
                w="full"
                justifyItems="stretch"
                flex="1"
              >
                <GridItem alignSelf="flex-end" h="full">
                  <Container
                    maxW="container.lg"
                    mx="0"
                    ml="auto"
                    p={{ base: 6, lg: 12 }}
                  >
                    <Heading mb={6}>Checkout</Heading>
                    {selectedSeller?.displayName && (
                      <Text mb={4} color="chakra-subtle-text">
                        Buying from: {selectedSeller.displayName}
                      </Text>
                    )}

                    <Tabs
                      size="sm"
                      index={tabIndex}
                      onChange={handleTabChange}
                      variant="soft-rounded"
                    >
                      <TabList>
                        <Tab>Information</Tab>
                        <Tab>Shipping</Tab>
                        <Tab>Payment</Tab>
                      </TabList>

                      <TabPanels>
                        <TabPanel>
                          <CartInformationPanel
                            shippingAddress={shippingAddress}
                            setShippingAddress={setShippingAddressState}
                            handleSaveShippingAddress={
                              handleSaveShippingAddress
                            }
                          />
                        </TabPanel>
                        <TabPanel>
                          <CartShippingPanel
                            shippingAddress={shippingAddress}
                            handleNextTab={handleNextTab}
                            handlePrevTab={handlePrevTab}
                            onFallbackModeChange={(isFallback, selectedCost) => {
                              setFallbackShippingMode(isFallback);
                              setFallbackShippingCost(selectedCost);
                            }}
                          />
                        </TabPanel>

                        <TabPanel display="flex" flexDirection="column">
                          <CartPaymentPanel
                            submitOrder={submitOrder}
                            submitting={submitting}
                          />
                        </TabPanel>
                      </TabPanels>
                    </Tabs>
                  </Container>
                </GridItem>

                <GridItem bgColor="blackAlpha.100" h="full">
                  <Container
                    maxW="container.sm"
                    mx="0"
                    mr="auto"
                    p={{ base: 6, lg: 12 }}
                  >
                    {worksheetLoading ? (
                      <Spinner />
                    ) : (
                      <CartSummary
                        deleteOrder={deleteOrder}
                        onSubmitOrder={submitOrder}
                        tabIndex={tabIndex}
                        fallbackShippingCost={fallbackShippingMode ? fallbackShippingCost : undefined}
                      />
                    )}
                  </Container>
                </GridItem>
              </Grid>
            </>
          ) : (
            <Center flex="1">
              <VStack mt={-28}>
                <Heading>Cart is empty</Heading>
                <Button as={RouterLink} size="sm" to="/products">
                  Continue shopping
                </Button>
              </VStack>
            </Center>
          )}
        </>
      )}
    </>
  );
};

export default ShoppingCart;
