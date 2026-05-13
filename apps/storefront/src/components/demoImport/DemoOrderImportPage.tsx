import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Code,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  ListItem,
  OrderedList,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  UnorderedList,
  useToast,
} from "@chakra-ui/react";
import { useOrderCloudContext } from "@ordercloud/react-sdk";
import { ChangeEvent, FC, useMemo, useState } from "react";
import { useCurrentUser } from "../../hooks/currentUser";
import {
  buildDemoCustomerData,
  createBatchID,
  DemoOrderImportBatchResult,
  DemoOrderImportError,
  DemoOrderImportGroupedOrder,
  DemoOrderImportNormalizedRow,
  DemoOrderImportOrderResult,
  expectedDemoImportColumns,
  groupRowsByExternalOrderID,
  normalizeImportedRows,
  parseDemoOrderImportFile,
  runDemoOrderImportBatch,
  summarizeBatchResults,
  validateGroupedOrder,
} from "../../services/demoOrderImport";

type PreviewOrder = DemoOrderImportGroupedOrder & {
  errors: DemoOrderImportError[];
};

type PreviewState = {
  fileName: string;
  rawRowCount: number;
  normalizedRows: DemoOrderImportNormalizedRow[];
  setupErrors: DemoOrderImportError[];
  orders: PreviewOrder[];
};

const sampleHeader = expectedDemoImportColumns.join(",");
const sampleRows = [
  "DEMO-ORDER-001,,PRODUCT-ID-1,1,,,,Jane,Buyer,100 Demo Way,,Minneapolis,MN,55401,US,555-0100,55401,jane.buyer@example.com",
  "DEMO-ORDER-001,,PRODUCT-ID-2,2,,,,Jane,Buyer,100 Demo Way,,Minneapolis,MN,55401,US,555-0100,55401,jane.buyer@example.com",
].join("\n");

const formatCurrency = (amount?: number) =>
  typeof amount === "number"
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount)
    : "—";

const formatErrors = (errors: DemoOrderImportError[]) =>
  errors.map((error) => error.message).join("; ") || "—";

const downloadTextFile = (fileName: string, contents: string, type: string) => {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const csvValue = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadResultJson = (result: DemoOrderImportBatchResult) => {
  const sensitiveKeys = new Set(["cause", "cardNumber", "cvv", "CardNumber", "CVV"]);
  downloadTextFile(
    `${result.batchID}.json`,
    JSON.stringify(
      result,
      (key, value) => (sensitiveKeys.has(key) ? undefined : value),
      2,
    ),
    "application/json",
  );
};

const buildResultsCsv = (result: DemoOrderImportBatchResult) => {
  const headers = [
    "BatchID",
    "ExternalOrderID",
    "OrderStatus",
    "OrderCloudOrderID",
    "SubmittedOrderID",
    "ShippingMethod",
    "ShippingCost",
    "PaymentStatus",
    "SubmitStatus",
    "FailureStage",
    "Errors",
    "LineNumber",
    "ProductID",
    "Quantity",
    "LineItemID",
    "LineStatus",
    "LineError",
  ];
  const rows = result.orderResults.flatMap((order) => {
    const orderErrors = formatErrors(order.errors);
    const failureStage = order.errors[0]?.stage || "";
    const lineResults = order.lineResults.length
      ? order.lineResults
      : [undefined];

    return lineResults.map((line) => [
      result.batchID,
      order.externalOrderID,
      order.status,
      order.orderID,
      order.submittedOrderID,
      order.shipping?.ShipMethodName,
      order.shipping?.Cost,
      order.paymentStatus || (order.status === "SUCCESS" ? "ACCEPTED" : "NOT_CREATED"),
      order.submitStatus || (order.submittedOrderID ? "SUBMITTED" : "NOT_SUBMITTED"),
      failureStage,
      orderErrors,
      line?.lineNumber,
      line?.productID,
      line?.quantity,
      line?.lineItemID,
      line?.status,
      line?.error?.message,
    ]);
  });
  return [headers, ...rows]
    .map((row) => row.map(csvValue).join(","))
    .join("\n");
};

const buildPreview = async (file: File): Promise<PreviewState> => {
  const rawRows = await parseDemoOrderImportFile(file);
  const normalized = normalizeImportedRows(rawRows);
  const groupedOrders = groupRowsByExternalOrderID(normalized.normalizedRows);
  const orders = groupedOrders.map((order) => ({
    ...order,
    errors: validateGroupedOrder(order),
  }));

  return {
    fileName: file.name,
    rawRowCount: rawRows.length,
    normalizedRows: normalized.normalizedRows,
    setupErrors: normalized.errors,
    orders,
  };
};

const DemoOrderImportPage: FC = () => {
  const { isLoggedIn } = useOrderCloudContext();
  const { data: user, isLoading: isUserLoading } = useCurrentUser();
  const toast = useToast();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [completedOrders, setCompletedOrders] = useState<DemoOrderImportOrderResult[]>([]);
  const [result, setResult] = useState<DemoOrderImportBatchResult | null>(null);

  const previewErrors = useMemo(
    () => [...(preview?.setupErrors || []), ...(preview?.orders.flatMap((order) => order.errors) || [])],
    [preview],
  );
  const canRun = Boolean(preview && preview.normalizedRows.length && !previewErrors.length && isLoggedIn && user && !isRunning);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPreview(null);
    setResult(null);
    setCompletedOrders([]);
    setParseError(null);
    if (!file) return;

    setIsParsing(true);
    try {
      setPreview(await buildPreview(file));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsParsing(false);
    }
  };

  const runImport = async () => {
    if (!preview || !canRun) return;
    const confirmed = window.confirm(
      "Run the demo import now? This will clear and use the active buyer cart, process orders one at a time, and submitted orders will not be deleted automatically.",
    );
    if (!confirmed) return;

    const batchID = createBatchID();
    const startedAt = new Date().toISOString();
    setIsRunning(true);
    setResult(null);
    setCompletedOrders([]);

    const localCompletedOrders: DemoOrderImportOrderResult[] = [];

    try {
      const batchResult = await runDemoOrderImportBatch(preview.normalizedRows, undefined, {
        batchID,
        onOrderComplete: (orderResult) => {
          localCompletedOrders.push(orderResult);
          setCompletedOrders((current) => [...current, orderResult]);
        },
      });
      setResult(batchResult);
      toast({
        title: "Demo import complete",
        description: `${batchResult.succeededCount} succeeded, ${batchResult.failedCount} failed.`,
        status: batchResult.failedCount ? "warning" : "success",
      });
    } catch (error) {
      const failed = summarizeBatchResults(batchID, startedAt, new Date().toISOString(), localCompletedOrders, [
        {
          stage: "VALIDATION",
          message: error instanceof Error ? error.message : String(error),
        },
      ]);
      setResult(failed);
      toast({ title: "Demo import failed", description: failed.errors[0]?.message, status: "error" });
    } finally {
      setIsRunning(false);
    }
  };

  if (!isLoggedIn || (!isUserLoading && !user)) {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Authenticated buyer required</AlertTitle>
          <AlertDescription>
            This demo-only import tool is blocked until a buyer user is logged in. Anonymous checkout is not used for this workflow.
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return (
    <Stack spacing={6} pb={10}>
      <Box>
        <Badge colorScheme="purple" mb={3}>Demo-only tool</Badge>
        <Heading as="h1" size="xl">Demo Order Import</Heading>
        <Text color="chakra-subtle-text" mt={2}>
          Upload a demo CSV file, review normalized grouped orders, then explicitly run the Phase 1 demo order import workflow.
        </Text>
      </Box>

      <Alert status="warning" borderRadius="md" alignItems="flex-start">
        <AlertIcon />
        <Box>
          <AlertTitle>Read before running</AlertTitle>
          <AlertDescription>
            <UnorderedList mt={2} spacing={1}>
              <ListItem>This tool processes demo orders using the current authenticated buyer context.</ListItem>
              <ListItem>It uses and clears the active buyer cart. Do not run this while preserving a manual cart.</ListItem>
              <ListItem>Orders are processed one at a time and imports never run on page load.</ListItem>
              <ListItem>Submitted orders will not be deleted automatically.</ListItem>
              <ListItem>Failed unsubmitted carts will attempt cleanup.</ListItem>
            </UnorderedList>
          </AlertDescription>
        </Box>
      </Alert>

      <Card>
        <CardHeader>
          <Heading size="md">1. Upload import file</Heading>
        </CardHeader>
        <CardBody>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel>CSV file</FormLabel>
              <Input type="file" accept=".csv,.xlsx" onChange={handleFileChange} isDisabled={isRunning} />
              <FormHelperText>
                CSV is enabled now. .xlsx uploads show a clear parser message until a spreadsheet parser dependency can be added.
              </FormHelperText>
            </FormControl>
            <Box>
              <Text fontWeight="semibold">Expected columns</Text>
              <Text fontSize="sm" color="chakra-subtle-text">
                Required: <Code>ExternalOrderID</Code>, <Code>ProductID</Code>, <Code>Quantity</Code>. Recommended: <Code>LineNumber</Code>. Optional fields include seller/supplier, inventory, shipping, billing ZIP, and customer email columns.
              </Text>
            </Box>
            <Box>
              <Text fontWeight="semibold">Example CSV schema (placeholder product IDs only)</Text>
              <Code display="block" whiteSpace="pre" overflowX="auto" p={3} mt={2}>{`${sampleHeader}\n${sampleRows}`}</Code>
            </Box>
            {isParsing && <Progress size="sm" isIndeterminate />}
            {parseError && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
          </Stack>
        </CardBody>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <Heading size="md">2. Preview grouped orders</Heading>
          </CardHeader>
          <CardBody>
            <Stack spacing={5}>
              <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
                <Box><Text fontSize="sm" color="chakra-subtle-text">File</Text><Text fontWeight="bold">{preview.fileName}</Text></Box>
                <Box><Text fontSize="sm" color="chakra-subtle-text">Rows parsed</Text><Text fontWeight="bold">{preview.rawRowCount}</Text></Box>
                <Box><Text fontSize="sm" color="chakra-subtle-text">Grouped orders</Text><Text fontWeight="bold">{preview.orders.length}</Text></Box>
                <Box><Text fontSize="sm" color="chakra-subtle-text">Line items</Text><Text fontWeight="bold">{preview.normalizedRows.length}</Text></Box>
              </SimpleGrid>

              {previewErrors.length > 0 && (
                <Alert status="error" borderRadius="md" alignItems="flex-start">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Validation errors</AlertTitle>
                    <UnorderedList mt={2}>
                      {previewErrors.map((error, index) => (
                        <ListItem key={`${error.message}-${index}`}>{error.externalOrderID ? `${error.externalOrderID}: ` : ""}{error.message}</ListItem>
                      ))}
                    </UnorderedList>
                  </Box>
                </Alert>
              )}

              <Stack spacing={4}>
                {preview.orders.map((order) => {
                  const customerData = buildDemoCustomerData(order);
                  const products = order.rows.map((row) => row.ProductID).join(", ");
                  const quantities = order.rows.map((row) => row.Quantity).join(", ");
                  return (
                    <Card key={order.externalOrderID} variant="outline">
                      <CardBody>
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                          <Box>
                            <Text fontSize="sm" color="chakra-subtle-text">ExternalOrderID</Text>
                            <Heading size="sm">{order.externalOrderID}</Heading>
                            <Badge mt={2} colorScheme={order.errors.length ? "red" : "green"}>{order.errors.length ? "Invalid" : "Valid to run"}</Badge>
                          </Box>
                          <Box>
                            <Text fontSize="sm" color="chakra-subtle-text">Seller/Supplier</Text>
                            <Text>{order.sellerID || "Current storefront seller context"}</Text>
                            <Text fontSize="sm" color="chakra-subtle-text" mt={2}>Line items: {order.rows.length}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="sm" color="chakra-subtle-text">Generated customer data</Text>
                            <Text>{customerData.shippingAddress.FirstName} {customerData.shippingAddress.LastName}</Text>
                            <Text fontSize="sm">{customerData.shippingAddress.Street1}, {customerData.shippingAddress.City}, {customerData.shippingAddress.State} {customerData.shippingAddress.Zip}</Text>
                            <Text fontSize="sm">Billing ZIP: {customerData.payment.billingZip}</Text>
                          </Box>
                        </SimpleGrid>
                        <Divider my={3} />
                        <Text fontSize="sm"><strong>Product IDs:</strong> {products}</Text>
                        <Text fontSize="sm"><strong>Quantities:</strong> {quantities}</Text>
                        {order.errors.length > 0 && <Text fontSize="sm" color="red.600"><strong>Errors:</strong> {formatErrors(order.errors)}</Text>}
                      </CardBody>
                    </Card>
                  );
                })}
              </Stack>

              <HStack justify="space-between" align="center">
                <Text fontSize="sm" color="chakra-subtle-text">The import will not create carts or orders until you click Run Import and confirm.</Text>
                <Button colorScheme="purple" onClick={runImport} isDisabled={!canRun} isLoading={isRunning}>Run Import</Button>
              </HStack>
            </Stack>
          </CardBody>
        </Card>
      )}

      {(isRunning || completedOrders.length > 0 || result) && (
        <Card>
          <CardHeader>
            <Heading size="md">3. Run progress and results</Heading>
          </CardHeader>
          <CardBody>
            <Stack spacing={5}>
              {preview && (
                <Box>
                  <HStack justify="space-between"><Text>{completedOrders.length} of {preview.orders.length} orders completed</Text><Text>{isRunning ? "Running sequentially..." : "Run complete"}</Text></HStack>
                  <Progress mt={2} value={preview.orders.length ? (completedOrders.length / preview.orders.length) * 100 : 0} />
                </Box>
              )}

              {result && (
                <>
                  <SimpleGrid columns={{ base: 1, md: 5 }} spacing={4}>
                    <Box><Text fontSize="sm" color="chakra-subtle-text">Batch ID</Text><Text fontWeight="bold">{result.batchID}</Text></Box>
                    <Box><Text fontSize="sm" color="chakra-subtle-text">Started</Text><Text>{result.startedAt}</Text></Box>
                    <Box><Text fontSize="sm" color="chakra-subtle-text">Completed</Text><Text>{result.completedAt}</Text></Box>
                    <Box><Text fontSize="sm" color="chakra-subtle-text">Succeeded</Text><Text>{result.succeededCount}</Text></Box>
                    <Box><Text fontSize="sm" color="chakra-subtle-text">Failed</Text><Text>{result.failedCount}</Text></Box>
                  </SimpleGrid>
                  <HStack>
                    <Button size="sm" onClick={() => downloadResultJson(result)}>Download JSON</Button>
                    <Button size="sm" variant="outline" onClick={() => downloadTextFile(`${result.batchID}.csv`, buildResultsCsv(result), "text/csv")}>Download CSV</Button>
                  </HStack>
                </>
              )}

              <TableContainer>
                <Table size="sm">
                  <Thead>
                    <Tr><Th>ExternalOrderID</Th><Th>Status</Th><Th>OrderCloud Order ID</Th><Th>Shipping</Th><Th>Payment</Th><Th>Submit</Th><Th>Failure</Th><Th>Errors</Th></Tr>
                  </Thead>
                  <Tbody>
                    {(result?.orderResults || completedOrders).map((order) => (
                      <Tr key={`${order.externalOrderID}-${order.orderIndex}`}>
                        <Td>{order.externalOrderID}</Td>
                        <Td><Badge colorScheme={order.status === "SUCCESS" ? "green" : "red"}>{order.status}</Badge></Td>
                        <Td>{order.submittedOrderID || order.orderID || "—"}</Td>
                        <Td>{order.shipping ? `${order.shipping.ShipMethodName} (${formatCurrency(order.shipping.Cost)})` : "—"}</Td>
                        <Td>{order.paymentStatus || (order.status === "SUCCESS" ? "ACCEPTED" : "NOT_CREATED")}</Td>
                        <Td>{order.submitStatus || (order.submittedOrderID ? "SUBMITTED" : "NOT_SUBMITTED")}</Td>
                        <Td>{order.errors[0]?.stage || "—"}</Td>
                        <Td>{formatErrors(order.errors)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>

              {result && (
                <Box>
                  <Heading size="sm" mb={3}>Line results</Heading>
                  <TableContainer>
                    <Table size="sm">
                      <Thead>
                        <Tr><Th>ExternalOrderID</Th><Th>LineNumber</Th><Th>ProductID</Th><Th>Quantity</Th><Th>LineItemID</Th><Th>Status/Error</Th></Tr>
                      </Thead>
                      <Tbody>
                        {result.lineResults.map((line) => (
                          <Tr key={`${line.externalOrderID}-${line.lineNumber}-${line.productID}`}>
                            <Td>{line.externalOrderID}</Td><Td>{line.lineNumber}</Td><Td>{line.productID}</Td><Td>{line.quantity}</Td><Td>{line.lineItemID || "—"}</Td><Td>{line.error?.message || line.status}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Stack>
          </CardBody>
        </Card>
      )}

      <Card variant="outline">
        <CardBody>
          <Heading size="sm" mb={2}>Manual QA reminder</Heading>
          <OrderedList spacing={1} fontSize="sm">
            <ListItem>Log in as a buyer user and navigate to <Code>/demo-import-orders</Code>.</ListItem>
            <ListItem>Upload a CSV with the expected DTO columns and placeholder product IDs replaced by real eligible products.</ListItem>
            <ListItem>Confirm the preview, validation, sequential progress, and JSON/CSV downloads.</ListItem>
          </OrderedList>
        </CardBody>
      </Card>
    </Stack>
  );
};

export default DemoOrderImportPage;
