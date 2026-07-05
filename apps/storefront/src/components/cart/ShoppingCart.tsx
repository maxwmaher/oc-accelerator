import {
  Badge,
  Box,
  Button,
  Center,
  Container,
  Grid,
  GridItem,
  Heading,
  HStack,
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
import { useCurrentUser } from "../../hooks/currentUser";
import {
  getBristanDemoShopAllRoute,
  getBristanDemoUserByUsername,
  isBristanDemoMarketplaceBuyerContext,
  isBristanDemoSupplierBuyerBulkContext,
} from "../bristan/bristanDemoRoutes";

export const TABS = {
  INFORMATION: 0,
  SHIPPING: 1,
  PAYMENT: 2,
  CONFIRMATION: 3,
};

const getCheckoutJourney = (username?: string) => {
  if (isBristanDemoMarketplaceBuyerContext(username)) {
    return {
      badge: "Approved Merchant Marketplace",
      subtitle: "Confirm your selected merchant offer and delivery details.",
      note: "Your selected merchant offer will be captured with the order.",
    };
  }

  if (isBristanDemoSupplierBuyerBulkContext(username)) {
    return {
      badge: "Trade Merchant Account",
      subtitle: "Complete your Bristan trade account order.",
      note: "Trade account pricing, minimum quantities, and account terms are applied to this order.",
    };
  }

  return {
    badge: "Spare Parts Self-Service",
    subtitle: "Complete your spare parts order.",
    note: "Spare parts and accessories are submitted directly for processing.",
  };
};

export const ShoppingCart = (): JSX.Element => {
  const [submitting, setSubmitting] = useState(false);
  const [tabIndex, setTabIndex] = useState(TABS.INFORMATION);

  const { data: user } = useCurrentUser();
  const demoUser = getBristanDemoUserByUsername(user?.Username);
  const checkoutJourney = getCheckoutJourney(user?.Username);
  const continueShoppingRoute =
    getBristanDemoShopAllRoute(user?.Username) || demoUser?.targetRoute || "/products";

  const {
    orderWorksheet,
    worksheetLoading,
    deleteCart,
    submitCart,
    estimateShipping,
  } = useShopper();

  const [shippingAddress, setShippingAddress] = useState<Address>({
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

  const submitOrder = useCallback(async () => {
    if (!orderWorksheet?.Order?.ID) return;
    setSubmitting(true);
    try {
      await submitCart();
      setSubmitting(false);
      navigate(`/order-confirmation?orderID=${orderWorksheet.Order.ID}`);
    } catch (err) {
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
  }, [navigate, orderWorksheet?.Order?.ID, submitCart, toast]);

  const deleteOrder = useCallback(async () => {
    if (!orderWorksheet?.Order?.ID) return;
    await deleteCart();
  }, [deleteCart, orderWorksheet?.Order?.ID]);

  const handleNextTab = () => {
    setTabIndex((prevIndex) =>
      Math.min(prevIndex + 1, TABS.PAYMENT)
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
      await setShippingAddress(shippingAddress);
      await estimateShipping();
    } catch (err) {
      console.error("Failed to save shipping address:", err);
    }
    handleNextTab();
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
                    <Box
                      bgGradient="linear(to-r, blue.900, blue.700)"
                      color="white"
                      borderRadius="2xl"
                      p={{ base: 5, md: 7 }}
                      mb={6}
                      boxShadow="lg"
                    >
                      <Badge colorScheme="blue" bg="whiteAlpha.300" color="white" mb={3}>
                        {checkoutJourney.badge}
                      </Badge>
                      <Heading as="h1" size="xl">Checkout</Heading>
                      <Text color="whiteAlpha.900" mt={2}>
                        {checkoutJourney.subtitle}
                      </Text>
                    </Box>

                    <Box
                      borderWidth="1px"
                      borderColor="blue.100"
                      bg="blue.50"
                      borderRadius="xl"
                      p={4}
                      mb={6}
                    >
                      <Text color="blue.900" fontSize="sm" fontWeight="medium">
                        {checkoutJourney.note}
                      </Text>
                    </Box>

                    <Tabs
                      size="sm"
                      index={tabIndex}
                      onChange={handleTabChange}
                      variant="unstyled"
                    >
                      <TabList as={HStack} spacing={2} mb={6} flexWrap="wrap">
                        {["Information", "Shipping", "Payment", "Confirmation"].map((label, index) => (
                          <Tab
                            key={label}
                            isDisabled={index === TABS.CONFIRMATION}
                            borderWidth="1px"
                            borderColor={tabIndex >= index ? "blue.600" : "gray.200"}
                            bg={tabIndex === index ? "blue.600" : tabIndex > index ? "blue.50" : "white"}
                            color={tabIndex === index ? "white" : tabIndex > index ? "blue.700" : "gray.600"}
                            borderRadius="full"
                            fontWeight="semibold"
                            _selected={{ bg: "blue.600", color: "white" }}
                            _disabled={{ opacity: 0.7, cursor: "not-allowed" }}
                          >
                            {tabIndex > index ? "✓ " : ""}{label}
                          </Tab>
                        ))}
                      </TabList>

                      <TabPanels>
                        <TabPanel>
                          <CartInformationPanel
                            shippingAddress={shippingAddress}
                            setShippingAddress={setShippingAddress}
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
                          />
                        </TabPanel>

                        <TabPanel display="flex" flexDirection="column">
                          <CartPaymentPanel
                            orderWorksheet={orderWorksheet}
                            submitOrder={submitOrder}
                            submitting={submitting}
                            username={user?.Username}
                            handlePrevTab={handlePrevTab}
                          />
                        </TabPanel>
                      </TabPanels>
                    </Tabs>
                  </Container>
                </GridItem>

                <GridItem bgColor="gray.50" h="full">
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
                        username={user?.Username}
                        continueShoppingRoute={continueShoppingRoute}
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
                <Button as={RouterLink} size="sm" to={continueShoppingRoute}>
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
