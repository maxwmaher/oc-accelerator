import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, HStack, Heading, Text, VStack, useToast } from '@chakra-ui/react'
import { useOcResourceGet } from '@ordercloud/react-sdk'
import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { NavButton } from '../Layout/Layout'
import { ApiError } from '../OperationForm'
import ResourceList from '../ResourceList/ResourceList'

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
  const toast = useToast()

  const hasValidParams = useMemo(
    () => isRealPathParam(direction) && isRealPathParam(orderID),
    [direction, orderID]
  )

  const orderQuery = useOcResourceGet<any>(
    'Orders',
    { direction: direction || '', orderID: orderID || '' },
    { disabled: !hasValidParams, staleTime: 300000 }
  )

  useEffect(() => {
    if (!hasValidParams || !orderQuery.isError) return
    const ocError = orderQuery.error?.response?.data?.Errors?.[0] as ApiError
    if (ocError && !toast.isActive(ocError.ErrorCode)) {
      toast({ id: ocError.ErrorCode, title: ocError.Message, status: 'error' })
    }
  }, [hasValidParams, orderQuery.error?.response?.data?.Errors, orderQuery.isError, toast])

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

  return (
    <>
      <VStack position="sticky" top="0" zIndex={1} background="chakra-body-bg" alignItems="start" mb={0} pb={3} mx={-1} px={4} borderBottomWidth={1} borderBottomColor="chakra-border-color">
        <Box py={3} flexGrow="1" w="full">
          <Heading size="md" as="h1">{orderQuery.data?.ID || orderID}</Heading>
          {orderQuery.data?.ID && orderQuery.data?.ID !== orderID && (
            <Text mt="2px" fontSize="xs" color="chakra-subtle-text">{orderID}</Text>
          )}
        </Box>
        <HStack as="nav" id={`${orderID}-tabs`}>
          <NavButton minW="auto" size="sm" rounded="full" to={`/orders/${direction}/${orderID}`}>Details</NavButton>
          <NavButton minW="auto" size="sm" rounded="full" to={`/orders/${direction}/${orderID}/line-items`}>Line Items</NavButton>
          <NavButton minW="auto" size="sm" rounded="full" to={`/orders/${direction}/${orderID}/promotions`}>Promotions</NavButton>
          <NavButton minW="auto" size="sm" rounded="full" to={`/orders/${direction}/${orderID}/approvers`}>Approvers</NavButton>
          <NavButton minW="auto" size="sm" rounded="full" to={`/orders/${direction}/${orderID}/approvals`}>Approvals</NavButton>
          <NavButton minW="auto" size="sm" rounded="full" to={`/orders/${direction}/${orderID}/payments`}>Payments</NavButton>
          <NavButton minW="auto" size="sm" rounded="full" to={`/orders/${direction}/${orderID}/shipments`}>Shipments</NavButton>
        </HStack>
      </VStack>
      <ResourceList resourceName="LineItems" readOnly={true} />
    </>
  )
}

export default OrderLineItemsRoute
