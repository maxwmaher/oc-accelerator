import {
  Badge,
  Box,
  Button,
  Center,
  Container,
  Grid,
  GridItem,
  Heading,
  SimpleGrid,
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
import { Address, Orders } from "ordercloud-javascript-sdk";
import { useCallback, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { CartInformationPanel } from "./cart-panels/CartInformationPanel";
import {
  CartPaymentPanel,
  RAI_PAYMENT_METHOD_LABELS,
  RaiPaymentMethod,
} from "./cart-panels/CartPaymentPanel";
import CartSkeleton from "./ShoppingCartSkeleton";
import CartSummary from "./ShoppingCartSummary";
import { useRaiDemoContext } from "../../hooks/useRaiDemoContext";
import { isDelegatedRaiDemoContext } from "../../demo/raiDemoContexts";

export const TABS = {
  INFORMATION: 0,
  PAYMENT: 1,
};

export const ShoppingCart = (): JSX.Element => {
  const [submitting, setSubmitting] = useState(false);
  const [tabIndex, setTabIndex] = useState(TABS.INFORMATION);
  const [paymentMethod, setPaymentMethod] =
    useState<RaiPaymentMethod>("invoice");

  const {
    orderWorksheet,
    worksheetLoading,
    deleteCart,
    submitCart,
    calculateOrder,
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
  const { selectedContext } = useRaiDemoContext();
  const isDelegatedContext = isDelegatedRaiDemoContext(selectedContext);
  const orderContextRows = useMemo(() => {
    const rows = [
      ["Event", selectedContext.eventName],
      ["Company", selectedContext.companyName],
      ["ExhibitorID", selectedContext.exhibitorId],
      ["Hall", selectedContext.hall],
      ["Stand number", selectedContext.standNumber],
      ["Stand type", selectedContext.standType],
      ["Stand package", selectedContext.standPackage],
      ["AccountID", selectedContext.accountId],
    ];

    if (isDelegatedContext) {
      rows.push(
        ["Ordered by", selectedContext.actorCompanyName],
        ["Ordering for", selectedContext.actingOnBehalfOfCompanyName || "—"],
        ["DelegationID", selectedContext.delegationId || "—"],
        ["Invoice attribution", selectedContext.invoiceTo || "—"],
      );
    }

    return rows;
  }, [isDelegatedContext, selectedContext]);

  const submitOrder = useCallback(async () => {
    if (!orderWorksheet?.Order?.ID) return;
    setSubmitting(true);
    try {
      const existingXp = (orderWorksheet.Order.xp || {}) as Record<string, unknown>;
      const existingRaiXp = (existingXp.RAI || {}) as Record<string, unknown>;
      await Orders.Patch("Outgoing", orderWorksheet.Order.ID, {
        xp: {
          ...existingXp,
          RAI: {
            ...existingRaiXp,
            Payment: {
              Method: paymentMethod,
              PayOnInvoiceFlag: true,
              Source: "Mocked Momentus account flag",
            },
          },
          PaymentMethod: RAI_PAYMENT_METHOD_LABELS[paymentMethod],
        },
      });
      await calculateOrder();
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
  }, [
    calculateOrder,
    navigate,
    orderWorksheet?.Order,
    paymentMethod,
    submitCart,
    toast,
  ]);

  const deleteOrder = useCallback(async () => {
    if (!orderWorksheet?.Order?.ID) return;
    await deleteCart();
  }, [deleteCart, orderWorksheet?.Order?.ID]);

  const handleNextTab = () => {
    setTabIndex((prevIndex) =>
      Math.min(prevIndex + 1, Object.keys(TABS).length - 1),
    );
  };

  const handleTabChange = (index: number) => {
    setTabIndex(index);
  };

  const handleSaveShippingAddress = async () => {
    if (!orderWorksheet?.Order?.ID) return;

    try {
      setShippingAddress(shippingAddress);
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
                    <Heading mb={3}>Review stand services</Heading>
                    <Text color="chakra-subtle-text" mb={6}>
                      Confirm the services, quantities, and operational details
                      for the active event and stand before submitting the order.
                    </Text>

                    <Box
                      borderWidth="1px"
                      borderRadius="lg"
                      p={4}
                      mb={6}
                      bg="white"
                    >
                      <Badge colorScheme="green" mb={3}>
                        Cart locked to current stand context
                      </Badge>
                      <Heading size="sm" mb={3}>
                        Order context
                      </Heading>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                        {orderContextRows.map(([label, value]) => (
                          <Box key={label}>
                            <Text fontSize="xs" color="chakra-subtle-text">
                              {label}
                            </Text>
                            <Text fontSize="sm" fontWeight="700">
                              {value}
                            </Text>
                          </Box>
                        ))}
                      </SimpleGrid>
                    </Box>

                    <Text fontSize="sm" color="chakra-subtle-text" mb={6}>
                      To prevent mixing services across stands, switch event or
                      stand context only after completing or emptying this cart.
                    </Text>

                    <Tabs
                      size="sm"
                      index={tabIndex}
                      onChange={handleTabChange}
                      variant="soft-rounded"
                    >
                      <TabList>
                        <Tab>Order details</Tab>
                        <Tab>Payment terms</Tab>
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
                        <TabPanel display="flex" flexDirection="column">
                          <CartPaymentPanel
                            paymentMethod={paymentMethod}
                            setPaymentMethod={setPaymentMethod}
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
                      />
                    )}
                  </Container>
                </GridItem>
              </Grid>
            </>
          ) : (
            <Center flex="1">
              <VStack mt={-28}>
                <Heading>No stand services in your cart</Heading>
                <Text color="chakra-subtle-text">
                  Browse the catalogue for the selected event and stand to add
                  services before checkout.
                </Text>
                <Button as={RouterLink} size="sm" to="/products">
                  Shop stand services
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
