import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  HStack,
  Heading,
  Button,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { LineItems, OrderDirection, Orders } from 'ordercloud-javascript-sdk'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'

function isRealPathParam(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.includes('{') &&
    !value.includes('}') &&
    !value.includes('%7B') &&
    !value.includes('%7D')
  )
}

const OrderLineItemsRoute = () => {
  const { direction, orderID } = useParams()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  const hasValidParams = useMemo(
    () => isRealPathParam(direction) && isRealPathParam(orderID),
    [direction, orderID]
  )

  const orderQuery = useQuery<any>({
    queryKey: ['order', direction, orderID],
    queryFn: () => Orders.Get(direction as OrderDirection, orderID!),
    enabled: hasValidParams,
    staleTime: 300000,
  })

  const lineItemsQuery = useQuery<any>({
    queryKey: ['order-line-items', direction, orderID, page, pageSize],
    queryFn: () => LineItems.List(direction as OrderDirection, orderID!, { page, pageSize }),
    enabled: hasValidParams,
    staleTime: 60000,
  })

  if (!hasValidParams) {
    return (
      <Box p={4}>
        <Alert status="error">
          <AlertIcon />
          <Box>
            <AlertTitle>Invalid order route parameters</AlertTitle>
            <AlertDescription>
              This page cannot load because one or more route parameters are invalid.
            </AlertDescription>
          </Box>
        </Alert>
      </Box>
    )
  }

  const tabs = [
    { label: 'Details', to: `/orders/${direction}/${orderID}` },
    { label: 'Line Items', to: `/orders/${direction}/${orderID}/line-items` },
    { label: 'Promotions', to: `/orders/${direction}/${orderID}/promotions` },
    { label: 'Approvers', to: `/orders/${direction}/${orderID}/approvers` },
    { label: 'Approvals', to: `/orders/${direction}/${orderID}/approvals` },
    { label: 'Payments', to: `/orders/${direction}/${orderID}/payments` },
    { label: 'Shipments', to: `/orders/${direction}/${orderID}/shipments` },
  ]

  const lineItems = lineItemsQuery.data?.Items || []
  const meta = lineItemsQuery.data?.Meta

  return (
    <>
      <VStack
        position="sticky"
        top="0"
        zIndex={1}
        background="chakra-body-bg"
        alignItems="start"
        mb={0}
        pb={3}
        mx={-1}
        px={4}
        borderBottomWidth={1}
        borderBottomColor="chakra-border-color"
      >
        <Box py={3} flexGrow="1" w="full">
          <Heading size="md" as="h1">{orderQuery.data?.ID || orderID}</Heading>
          <Text mt="2px" fontSize="xs" color="chakra-subtle-text">{direction}</Text>
        </Box>
        <HStack as="nav" spacing={2}>
          {tabs.map((tab) => (
            <Button
              key={tab.label}
              as={RouterLink}
              to={tab.to}
              px={3}
              py={1}
              borderWidth={1}
              borderRadius="full"
              bg={tab.label === 'Line Items' ? 'purple.600' : 'transparent'}
              color={tab.label === 'Line Items' ? 'white' : 'inherit'}
>
              {tab.label}
            </Button>
          ))}
        </HStack>
      </VStack>

      <Box p={4}>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Ship From Address ID</Th>
              <Th>Product ID</Th>
              <Th isNumeric>Quantity</Th>
              <Th>Bundle Item ID</Th>
              <Th>Is Bundle Item</Th>
            </Tr>
          </Thead>
          <Tbody>
            {lineItems.map((item: any) => (
              <Tr key={item.ID}>
                <Td>{item.ID}</Td>
                <Td>{item.ShipFromAddressID || '-'}</Td>
                <Td>{item.ProductID || '-'}</Td>
                <Td isNumeric>{item.Quantity}</Td>
                <Td>{item.BundleItemID || '-'}</Td>
                <Td>{item.IsBundleItem ? 'true' : 'false'}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        {lineItemsQuery.isLoading && <Text mt={3}>Loading line items...</Text>}
        {!lineItemsQuery.isLoading && lineItems.length === 0 && <Text mt={3}>No line items found.</Text>}

        {meta?.TotalPages && meta.TotalPages > 1 && (
          <HStack mt={4}>
            <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} isDisabled={page <= 1}>Previous</Button>
            <Text>Page {meta.Page} of {meta.TotalPages}</Text>
            <Button
              size="sm"
              onClick={() => setPage((p) => Math.min(meta.TotalPages || p, p + 1))}
              isDisabled={page >= (meta.TotalPages || 1)}
            >
              Next
            </Button>
          </HStack>
        )}
      </Box>
    </>
  )
}

export default OrderLineItemsRoute
