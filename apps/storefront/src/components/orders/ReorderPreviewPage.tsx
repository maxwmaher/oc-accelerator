import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  GridItem,
  Heading,
  HStack,
  Skeleton,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  ListItem,
  UnorderedList,
  Thead,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useOrderCloudContext } from "@ordercloud/react-sdk";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { getDemoReorderPaymentPreview, previewDemoReorder, submitDemoReorder } from "../../services/demoReorder";
import { DemoReorderPreview, DemoReorderSubmitResult } from "../../services/demoReorder/types";
import { formatDate } from "../../utils/formatDate";
import formatPrice from "../../utils/formatPrice";

const formatAddress = (address?: DemoReorderPreview["shippingAddress"]) => {
  if (!address) return "Unavailable";
  return [
    `${address.FirstName || ""} ${address.LastName || ""}`.trim(),
    address.CompanyName,
    address.Street1,
    address.Street2,
    [address.City, address.State, address.Zip].filter(Boolean).join(", "),
    address.Country,
  ]
    .filter(Boolean)
    .join(" • ");
};

const ReorderPreviewPage = () => {
  const { orderID = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAuthenticated, isLoggedIn, allowAnonymous } = useOrderCloudContext();
  const [preview, setPreview] = useState<DemoReorderPreview | null>(null);
  const [result, setResult] = useState<DemoReorderSubmitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPreview = useCallback(async () => {
    if (!orderID) return;
    setLoading(true);
    setLoadError(null);
    try {
      const nextPreview = await previewDemoReorder(orderID);
      setPreview(nextPreview);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [orderID]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const submit = async () => {
    if (!preview?.canSubmit || isSubmitting) return;
    const confirmed = window.confirm(
      `Submit this demo reorder? This will clear and use your active buyer cart, create and submit a brand-new demo order based on source order ${orderID}, and submitted orders will remain in OrderCloud. The original order will not be changed. Final pricing, shipping, tax, and availability may differ from the previous order.`,
    );
    if (!confirmed) return;
    setIsSubmitting(true);
    setResult(null);
    try {
      const submitResult = await submitDemoReorder(orderID);
      setResult(submitResult);
      if (submitResult.status === "SUCCESS" && submitResult.newSubmittedOrderID) {
        navigate(`/order-confirmation?orderID=${submitResult.newSubmittedOrderID}`);
      }
    } catch (error) {
      toast({
        title: "Reorder failed",
        description: error instanceof Error ? error.message : String(error),
        status: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!allowAnonymous && !isAuthenticated) {
    return (
      <Container maxW="container.lg" py={8}>
        <Alert status="warning" rounded="md">
          <AlertIcon />
          <AlertDescription>Please sign in with a buyer account to preview a reorder.</AlertDescription>
        </Alert>
      </Container>
    );
  }

  if (allowAnonymous && !isLoggedIn) {
    return (
      <Container maxW="container.lg" py={8}>
        <Alert status="warning" rounded="md">
          <AlertIcon />
          <AlertDescription>Reorder requires an authenticated buyer context.</AlertDescription>
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack align="stretch" spacing={4}>
          <Skeleton h="32px" w="260px" />
          <Skeleton h="90px" rounded="lg" />
          <Skeleton h="280px" rounded="lg" />
        </VStack>
      </Container>
    );
  }

  if (loadError || !preview) {
    return (
      <Container maxW="container.lg" py={8}>
        <Heading size="lg" mb={4}>Reorder Preview</Heading>
        <Alert status="error" rounded="md" mb={4}>
          <AlertIcon />
          <AlertDescription>{loadError || "Unable to load reorder preview."}</AlertDescription>
        </Alert>
        <Button as={RouterLink} to="/orders" variant="outline">Back to orders</Button>
      </Container>
    );
  }

  const paymentPreview = getDemoReorderPaymentPreview(preview.shippingAddress?.Zip);

  return (
    <Container maxW="container.xl" py={8}>
      <VStack align="stretch" spacing={6}>
        <HStack justify="space-between" align="start">
          <Box>
            <Heading size="lg">Reorder Preview</Heading>
            <Text color="gray.600" mt={2}>Review source order {preview.sourceOrder.orderID} before creating a brand-new demo order.</Text>
          </Box>
          <Button as={RouterLink} to="/orders" variant="outline">Back to orders</Button>
        </HStack>

        <Alert status="warning" rounded="lg">
          <AlertIcon />
          <AlertDescription>
            The original order will not be changed. Final price, promotions, shipping, tax, and availability may differ from the previous order.
          </AlertDescription>
        </Alert>

        <Box bg="gray.50" borderWidth="1px" rounded="lg" p={4}>
          <Heading size="sm" mb={2}>How reorder creates a new order</Heading>
          <UnorderedList spacing={1} fontSize="sm" color="gray.600">
            <ListItem>Reorder does not clone the old order; it uses the prior order as source data.</ListItem>
            <ListItem>Before submit, it re-resolves current product availability, pricing, inventory, shipping, tax, promotions, and payment.</ListItem>
            <ListItem>The result is a brand-new order, which is why final totals may differ from the previous order.</ListItem>
          </UnorderedList>
        </Box>

        <Grid templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }} gap={4}>
          <Box bg="white" borderWidth="1px" rounded="xl" p={4}>
            <Text fontSize="xs" color="gray.500">Source order</Text>
            <Text fontWeight="semibold">{preview.sourceOrder.orderID}</Text>
          </Box>
          <Box bg="white" borderWidth="1px" rounded="xl" p={4}>
            <Text fontSize="xs" color="gray.500">Submitted</Text>
            <Text fontWeight="semibold">{formatDate(preview.sourceOrder.dateSubmitted || preview.sourceOrder.dateCreated || "")}</Text>
          </Box>
          <Box bg="white" borderWidth="1px" rounded="xl" p={4}>
            <Text fontSize="xs" color="gray.500">Status</Text>
            <Badge colorScheme={preview.canSubmit ? "green" : "red"}>{preview.sourceOrder.status || "Unknown"}</Badge>
          </Box>
          <Box bg="white" borderWidth="1px" rounded="xl" p={4}>
            <Text fontSize="xs" color="gray.500">Previous total</Text>
            <Text fontWeight="semibold">{formatPrice(preview.sourceOrder.total || 0)}</Text>
          </Box>
        </Grid>

        {[...preview.warnings, ...preview.errors].map((message, index) => (
          <Alert key={`${message.stage}-${index}`} status={preview.errors.includes(message) ? "error" : "info"} rounded="md">
            <AlertIcon />
            <AlertDescription>{message.message}</AlertDescription>
          </Alert>
        ))}

        <Box bg="white" borderWidth="1px" rounded="xl" p={4}>
          <Heading size="md" mb={4}>Line items</Heading>
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Product ID</Th>
                  <Th>Name</Th>
                  <Th isNumeric>Qty</Th>
                  <Th>Inventory / Specs</Th>
                  <Th>Status</Th>
                  <Th>Message</Th>
                </Tr>
              </Thead>
              <Tbody>
                {preview.lines.map((line) => (
                  <Tr key={line.sourceLineItemID || line.productID}>
                    <Td>{line.productID || "N/A"}</Td>
                    <Td>{line.productName || "Unavailable"}</Td>
                    <Td isNumeric>{line.quantity || 0}</Td>
                    <Td>
                      <Text fontSize="sm">Inventory: {line.resolvedInventoryRecordID || line.inventoryRecordID || "N/A"}</Text>
                      <Text fontSize="xs" color="gray.500">Specs: {line.specs?.length || 0}</Text>
                    </Td>
                    <Td><Badge colorScheme={line.reorderable ? "green" : "red"}>{line.reorderable ? "Reorderable" : "Blocked"}</Badge></Td>
                    <Td>{line.validationMessage || "Ready"}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>

        <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={4}>
          <GridItem bg="white" borderWidth="1px" rounded="xl" p={4}>
            <Heading size="md" mb={3}>Shipping preview</Heading>
            <Stack spacing={3}>
              <Box><Text fontSize="xs" color="gray.500">Previous shipping address</Text><Text>{formatAddress(preview.shippingAddress)}</Text></Box>
              <Box><Text fontSize="xs" color="gray.500">Previous shipping method</Text><Text>{preview.previousShippingMethod?.ShipMethodName || "Not found"}</Text></Box>
              <Box><Text fontSize="xs" color="gray.500">Matching and fallback strategy</Text><Text>{preview.shippingStrategy}</Text></Box>
            </Stack>
          </GridItem>
          <GridItem bg="white" borderWidth="1px" rounded="xl" p={4}>
            <Heading size="md" mb={3}>Payment preview</Heading>
            <Text>Demo credit card</Text>
            <Text fontWeight="semibold">{paymentPreview.maskedCardNumber}</Text>
            <Divider my={3} />
            <Text fontSize="sm" color="gray.600">Billing ZIP: {paymentPreview.billingZip}</Text>
            <Text fontSize="sm" color="gray.600">Expires: {paymentPreview.expirationMonth}/{paymentPreview.expirationYear}</Text>
          </GridItem>
        </Grid>

        {result?.status === "FAILED" ? (
          <Alert status="error" rounded="md">
            <AlertIcon />
            <AlertDescription>{result.errors.map((error) => error.message).join("; ") || "Submit reorder failed."}</AlertDescription>
          </Alert>
        ) : null}

        <HStack justify="end">
          <Button as={RouterLink} to="/orders" variant="ghost">Cancel</Button>
          <Button colorScheme="blue" onClick={submit} isLoading={isSubmitting} isDisabled={!preview.canSubmit || isSubmitting}>
            Submit Reorder
          </Button>
        </HStack>
      </VStack>
    </Container>
  );
};

export default ReorderPreviewPage;
