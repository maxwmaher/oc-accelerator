import { ArrowForwardIcon, DeleteIcon } from '@chakra-ui/icons'
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Checkbox,
  Container,
  HStack,
  Heading,
  Input,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
  UnorderedList,
  useColorModeValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { useAuthMutation } from '@ordercloud/react-sdk'
import { FC, ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { checkRaiDemoReadiness, deleteRaiDemoData, prepareRaiDemoEventWebsites } from './raiEventSetupService'
import { RaiDeleteDemoDataResult, RaiDemoReadinessResult, RaiPrepareDemoEventWebsitesResult } from './types'

const EVENT_WEBSITE_OPTIONS = [
  { label: 'ISE 2026', catalogID: 'ISE_2026_CATALOG', purpose: 'Main exhibitor ordering site', requiredFor: 'Blue Ocean Exhibits buyer setup', required: true },
  { label: 'RAI Catering Portal', catalogID: 'RAI_CATERING_CATALOG', purpose: 'Shared catering product availability', requiredFor: 'Pizza product demo', required: true },
  { label: 'Vegetarian-only Event', catalogID: 'VEGETARIAN_EVENT_CATALOG', purpose: 'Shows event-specific product rules', requiredFor: 'Vegetarian topping exclusion demo', required: true },
  { label: 'Interclean 2026', catalogID: 'INTERCLEAN_2026_CATALOG', purpose: 'Additional event website example', requiredFor: 'Optional reuse/exclusion story', required: false },
]

const DEFAULT_SELECTED_EVENT_WEBSITE_IDS = EVENT_WEBSITE_OPTIONS.filter((item) => item.required).map((item) => item.catalogID)
const REQUIRED_EVENT_WEBSITE_IDS = DEFAULT_SELECTED_EVENT_WEBSITE_IDS

const getPreparedCatalogIDs = (result?: RaiPrepareDemoEventWebsitesResult) => result ? [...result.createdCatalogIDs, ...result.updatedCatalogIDs] : []

const hasPreparedRequiredEventWebsites = (result?: RaiPrepareDemoEventWebsitesResult) => {
  const preparedCatalogIDs = getPreparedCatalogIDs(result)
  return REQUIRED_EVENT_WEBSITE_IDS.every((catalogID) => preparedCatalogIDs.includes(catalogID))
}

const RaiEventSetupLanding: FC = () => {
  const toast = useToast()
  const location = useLocation()
  const resetModal = useDisclosure()
  const [readiness, setReadiness] = useState<RaiDemoReadinessResult>()
  const [prepareResult, setPrepareResult] = useState<RaiPrepareDemoEventWebsitesResult>()
  const [deleteResult, setDeleteResult] = useState<RaiDeleteDemoDataResult>()
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [selectedCatalogIDs, setSelectedCatalogIDs] = useState(DEFAULT_SELECTED_EVENT_WEBSITE_IDS)
  const [readinessError, setReadinessError] = useState<string>()
  const readinessCheckReason = useRef<'auto' | 'manual'>('auto')
  const focusStep = new URLSearchParams(location.search).get('focus')

  const readinessMutation = useAuthMutation({
    mutationKey: ['rai-demo-readiness'],
    mutationFn: checkRaiDemoReadiness,
    onSuccess: (data) => {
      setReadiness(data)
      setReadinessError(undefined)
      if (readinessCheckReason.current === 'manual') {
        toast({ title: data.readyToRecord ? 'OrderCloud setup is complete' : 'Demo status refreshed', description: data.readyToRecord ? 'Review the OrderCloud summary for the objects and assignments created.' : 'Follow the next available setup step.', status: data.readyToRecord ? 'success' : 'info' })
      }
    },
    onError: (error) => {
      const description = error instanceof Error ? error.message : 'Demo readiness could not be checked.'
      setReadinessError(description)
      if (readinessCheckReason.current === 'manual') toast({ title: 'Status refresh failed', description, status: 'warning' })
    },
  })

  const prepareMutation = useAuthMutation({
    mutationKey: ['rai-demo-event-websites-prepare'],
    mutationFn: prepareRaiDemoEventWebsites,
    onSuccess: (data) => {
      setPrepareResult(data)
      const preparedCount = data.createdCatalogIDs.length + data.updatedCatalogIDs.length
      const requiredEventWebsitesReady = hasPreparedRequiredEventWebsites(data)
      readinessCheckReason.current = 'auto'
      readinessMutation.mutate(undefined)
      toast({
        title: preparedCount ? 'Demo event websites prepared' : 'Demo event websites could not be prepared',
        description: requiredEventWebsitesReady ? 'Create Pizza setup is now available.' : `${data.createdCatalogIDs.length} created, ${data.updatedCatalogIDs.length} updated.`,
        status: preparedCount ? data.warnings.length ? 'warning' : 'success' : 'error',
      })
    },
    onError: (error) => {
      const description = error instanceof Error ? error.message : 'Demo event websites could not be prepared.'
      toast({ title: 'Prepare action failed', description, status: 'error' })
    },
  })

  const deleteMutation = useAuthMutation({
    mutationKey: ['rai-demo-data-delete'],
    mutationFn: deleteRaiDemoData,
    onSuccess: (data) => {
      setDeleteResult(data)
      setReadiness(undefined)
      setPrepareResult(undefined)
      setDeleteConfirmation('')
      resetModal.onClose()
      readinessCheckReason.current = 'auto'
      readinessMutation.mutate(undefined)
      const title = data.overallStatus === 'already-clean'
        ? 'Demo data is already clean'
        : data.overallStatus === 'partial'
          ? 'Some demo data was deleted'
          : data.overallStatus === 'failed'
            ? 'Demo data could not be deleted'
            : 'RAI demo data deleted'
      toast({
        title,
        description: data.overallStatus === 'already-clean' ? 'Next: prepare demo event websites.' : 'Review the reset summary, then prepare demo event websites.',
        status: data.overallStatus === 'deleted' || data.overallStatus === 'already-clean' ? 'success' : data.overallStatus === 'partial' ? 'warning' : 'error',
      })
    },
    onError: (error) => {
      const description = error instanceof Error ? error.message : 'Demo data could not be deleted.'
      toast({ title: 'Delete demo data failed', description, status: 'error' })
    },
  })

  useEffect(() => {
    readinessCheckReason.current = 'auto'
    readinessMutation.mutate(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshStatus = () => {
    readinessCheckReason.current = 'manual'
    readinessMutation.mutate(undefined)
  }

  return (
    <Container maxW="6xl" p={8}>
      <Stack spacing={3} mb={8}>
        <Text color="blue.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
          Demo experience
        </Text>
        <Heading as="h1" size="xl" color="chakra-subtle-text">
          RAI Event Setup
        </Heading>
        <Text maxW="3xl" color="chakra-subtle-text" fontSize="lg">
          Guided daily workflows for ecommerce and admin teams preparing event websites, reusable products, exhibitor buyers, and event-specific pricing.
        </Text>
      </Stack>
      <GuidedSetupChecklist
        readiness={readiness}
        prepareResult={prepareResult}
        readinessError={readinessError}
        focusStep={focusStep}
        selectedCatalogIDs={selectedCatalogIDs}
        onSelectionChange={setSelectedCatalogIDs}
        onRefresh={refreshStatus}
        onPrepare={() => prepareMutation.mutate(selectedCatalogIDs)}
        isChecking={readinessMutation.isPending}
        isPreparing={prepareMutation.isPending}
      />
      <AdvancedResetSection result={deleteResult} onOpen={resetModal.onOpen} isDeleting={deleteMutation.isPending} />
      <DeleteDemoDataModal
        isOpen={resetModal.isOpen}
        onClose={resetModal.onClose}
        confirmation={deleteConfirmation}
        onConfirmationChange={setDeleteConfirmation}
        onDelete={() => deleteMutation.mutate(undefined)}
        isDeleting={deleteMutation.isPending}
      />
    </Container>
  )
}

interface GuidedSetupChecklistProps {
  readiness?: RaiDemoReadinessResult
  prepareResult?: RaiPrepareDemoEventWebsitesResult
  readinessError?: string
  focusStep: string | null
  selectedCatalogIDs: string[]
  onSelectionChange: (catalogIDs: string[]) => void
  onRefresh: () => void
  onPrepare: () => void
  isChecking: boolean
  isPreparing: boolean
}

type GuidedStepStatus = 'ready' | 'next' | 'blocked' | 'attention' | 'optional'

const guidedStatusCopy: Record<GuidedStepStatus, { label: string; colorScheme: string }> = {
  ready: { label: 'Ready', colorScheme: 'green' },
  next: { label: 'Next step', colorScheme: 'blue' },
  blocked: { label: 'Blocked', colorScheme: 'gray' },
  attention: { label: 'Needs attention', colorScheme: 'orange' },
  optional: { label: 'Optional warning', colorScheme: 'orange' },
}

const getStepStatus = (isReady: boolean, isNext: boolean, hasWarning = false): GuidedStepStatus => {
  if (isReady && hasWarning) return 'optional'
  if (isReady) return 'ready'
  if (isNext) return 'next'
  return 'blocked'
}

const GuidedSetupChecklist: FC<GuidedSetupChecklistProps> = ({ readiness, prepareResult, readinessError, focusStep, selectedCatalogIDs, onSelectionChange, onRefresh, onPrepare, isChecking, isPreparing }) => {
  const eventWebsitesReady = readiness?.canCreatePizza || hasPreparedRequiredEventWebsites(prepareResult)
  const pizzaSetupReady = readiness?.pizzaSetupReady ?? false
  const exhibitorSetupReady = readiness?.exhibitorSetupReady ?? false
  const readyToRecord = readiness?.readyToRecord ?? false
  const productWarnings = readiness?.productSetup.some((item) => item.status === 'warning') ?? false
  const buyerWarnings = readiness?.buyerSetup.some((item) => item.status === 'warning') ?? false
  const setupSummaryHasNotes = Boolean(readiness?.warnings.length)
  const stepFourStatusLabel = readyToRecord ? setupSummaryHasNotes ? 'Complete with notes' : 'Complete' : 'Needs attention'
  const stepFourStatusColor = readyToRecord ? setupSummaryHasNotes ? 'orange' : 'green' : 'orange'
  const selectedEventWebsiteNames = EVENT_WEBSITE_OPTIONS.filter((item) => selectedCatalogIDs.includes(item.catalogID)).map((item) => item.label).join(', ')

  return (
    <Card variant="outline" p={2}>
      <CardBody>
        <Stack spacing={6}>
          <HStack justify="space-between" align="flex-start" flexWrap="wrap">
            <Box>
              <Heading as="h2" size="lg">RAI Admin Demo Setup</Heading>
              <Text color="chakra-subtle-text" mt={2}>
                Follow these steps in order to prepare the OrderCloud demo environment and review how the pieces connect.
              </Text>
            </Box>
            <Button variant="outline" onClick={onRefresh} isLoading={isChecking} isDisabled={isPreparing}>
              Refresh status
            </Button>
          </HStack>
          {isChecking && !readiness && <Text color="chakra-subtle-text">Checking current demo status…</Text>}
          {readinessError && (
            <Card variant="outline" borderColor="orange.300">
              <CardBody>
                <Stack spacing={2}>
                  <Text fontWeight="semibold">Current demo status could not be checked.</Text>
                  <Text color="chakra-subtle-text">You can retry status refresh. If this continues, check your API access.</Text>
                </Stack>
              </CardBody>
            </Card>
          )}
          <Stack spacing={4}>
            <GuidedStepCard
              stepNumber={1}
              title="Review event websites"
              description="These are the event websites used in the walkthrough. Select the ones to create or refresh before publishing products and registering exhibitors."
              status={getStepStatus(eventWebsitesReady, !eventWebsitesReady)}
              readyText={`These event websites are ready: ${selectedEventWebsiteNames || 'none selected'}.`}
              result={prepareResult && <PrepareSummary result={prepareResult} />}
              action={(
                <Stack spacing={4}>
                  <EventWebsiteSelection selectedCatalogIDs={selectedCatalogIDs} onSelectionChange={onSelectionChange} readiness={readiness} prepareResult={prepareResult} />
                  <Button alignSelf="flex-start" colorScheme="blue" onClick={onPrepare} isLoading={isPreparing} isDisabled={isChecking || selectedCatalogIDs.length === 0}>
                    Create or refresh selected event websites
                  </Button>
                </Stack>
              )}
            />
            <GuidedStepCard
              stepNumber={2}
              title="Create Pizza product setup"
              description="Create Pizza once, configure pricing and options, then publish it to selected event websites."
              status={getStepStatus(pizzaSetupReady, eventWebsitesReady && !pizzaSetupReady, productWarnings)}
              readyText="Pizza product setup is ready."
              blockedText="Prepare event websites first."
              action={<Button as={Link} to="/rai-event-setup/products/new" colorScheme="blue" rightIcon={<ArrowForwardIcon />} isDisabled={!eventWebsitesReady || isChecking}>{pizzaSetupReady ? 'Review or update Pizza setup' : 'Start Pizza setup'}</Button>}
            />
            <GuidedStepCard
              stepNumber={3}
              title="Register Blue Ocean Exhibits"
              description="Create the exhibitor, buyer contact, event website access, and pricing access."
              status={getStepStatus(exhibitorSetupReady, eventWebsitesReady && pizzaSetupReady && !exhibitorSetupReady, buyerWarnings)}
              readyText="Blue Ocean Exhibits setup is ready."
              blockedText={eventWebsitesReady ? 'Create the Pizza product setup first.' : 'Prepare event websites first.'}
              isHighlighted={focusStep === 'buyer'}
              action={<Button as={Link} to="/rai-event-setup/buyers/new" colorScheme="blue" rightIcon={<ArrowForwardIcon />} isDisabled={!eventWebsitesReady || !pizzaSetupReady || isChecking}>{exhibitorSetupReady ? 'Review or update exhibitor setup' : 'Start exhibitor setup'}</Button>}
            />
            <GuidedStepCard
              stepNumber={4}
              title="Review OrderCloud setup summary"
              description="Review the OrderCloud products, catalogs, buyers, and assignments created by this guided setup."
              status={readyToRecord ? 'ready' : eventWebsitesReady && pizzaSetupReady && exhibitorSetupReady ? 'next' : 'blocked'}
              statusLabel={stepFourStatusLabel}
              statusColorScheme={stepFourStatusColor}
              readyText="OrderCloud setup is complete."
              blockedText={!eventWebsitesReady ? 'Prepare event websites first.' : !pizzaSetupReady ? 'Create Pizza setup first.' : 'Register Blue Ocean Exhibits first.'}
              result={readiness && <OrderCloudSetupSummary readiness={readiness} />}
              isHighlighted={focusStep === 'readiness'}
              action={<Button colorScheme="blue" variant={readyToRecord ? 'outline' : 'solid'} onClick={onRefresh} isLoading={isChecking} isDisabled={!eventWebsitesReady || !pizzaSetupReady || !exhibitorSetupReady || isPreparing}>Refresh OrderCloud summary</Button>}
            />
          </Stack>
          {readiness && <TechnicalDetails items={readiness.technicalSummary} />}
        </Stack>
      </CardBody>
    </Card>
  )
}

const GuidedStepCard: FC<{
  stepNumber: number
  title: string
  description: string
  status: GuidedStepStatus
  action: ReactNode
  readyText?: string
  blockedText?: string
  result?: ReactNode
  isHighlighted?: boolean
  statusLabel?: string
  statusColorScheme?: string
}> = ({ stepNumber, title, description, status, action, readyText, blockedText, result, isHighlighted = false, statusLabel, statusColorScheme }) => {
  const statusDetails = guidedStatusCopy[status]
  const displayStatus = { label: statusLabel || statusDetails.label, colorScheme: statusColorScheme || statusDetails.colorScheme }
  const borderColor = useColorModeValue(isHighlighted || status === 'next' ? 'blue.300' : 'gray.200', isHighlighted || status === 'next' ? 'blue.500' : 'gray.700')
  const boxShadow = isHighlighted ? '0 0 0 2px var(--chakra-colors-blue-300)' : undefined

  return (
    <Card variant="outline" borderColor={borderColor} boxShadow={boxShadow}>
      <CardBody>
        <Stack spacing={4}>
          <HStack justify="space-between" align="flex-start" flexWrap="wrap">
            <HStack align="flex-start">
              <Badge borderRadius="full" colorScheme={displayStatus.colorScheme}>{stepNumber}</Badge>
              <Box>
                <Heading as="h3" size="md">{title}</Heading>
                <Text color="chakra-subtle-text" mt={1}>{description}</Text>
              </Box>
            </HStack>
            <Badge colorScheme={displayStatus.colorScheme}>{displayStatus.label}</Badge>
          </HStack>
          {status === 'ready' && readyText && <Text color="chakra-subtle-text">{readyText} Rerunning this step is safe.</Text>}
          {status === 'optional' && readyText && <Text color="chakra-subtle-text">{readyText} Review optional notes below when needed.</Text>}
          {status === 'blocked' && blockedText && <Text color="chakra-subtle-text">{blockedText}</Text>}
          <Box>{action}</Box>
          {result}
        </Stack>
      </CardBody>
    </Card>
  )
}

const getReadinessItem = (items: RaiDemoReadinessResult['eventWebsites'], label: string) => items.find((item) => item.label === label)

const getReadinessBadgeColor = (status?: string) => {
  if (status === 'ready') return 'green'
  if (status === 'warning') return 'orange'
  if (status === 'missing') return 'red'
  return 'gray'
}

const SummaryStatusBadge: FC<{ status?: string; label?: string }> = ({ status, label }) => (
  <Badge colorScheme={getReadinessBadgeColor(status)}>{label || (status === 'ready' ? 'Ready' : status === 'warning' ? 'Needs attention' : status === 'missing' ? 'Missing' : 'Not checked')}</Badge>
)

const SummaryRow: FC<{ label: string; value: string; status?: string; statusLabel?: string; note?: string }> = ({ label, value, status, statusLabel, note }) => (
  <Box borderWidth="1px" borderRadius="md" p={3}>
    <HStack justify="space-between" align="flex-start" gap={3}>
      <Box>
        <Text fontWeight="semibold">{label}</Text>
        <Text fontSize="sm" color="chakra-subtle-text">{value}</Text>
        {note && <Text fontSize="sm" color="chakra-subtle-text" mt={1}>{note}</Text>}
      </Box>
      <SummaryStatusBadge status={status} label={statusLabel} />
    </HStack>
  </Box>
)

const OrderCloudSummaryGroup: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <Box>
    <Heading as="h4" size="sm" mb={3}>{title}</Heading>
    <Stack spacing={2}>{children}</Stack>
  </Box>
)

const OrderCloudSetupSummary: FC<{ readiness: RaiDemoReadinessResult }> = ({ readiness }) => {
  const colors = useResultCardColors(readiness.readyToRecord ? readiness.warnings.length ? 'orange' : 'green' : 'blue')
  const product = getReadinessItem(readiness.productSetup, 'Product')
  const price = getReadinessItem(readiness.productSetup, 'Price')
  const options = getReadinessItem(readiness.productSetup, 'Options')
  const buyer = getReadinessItem(readiness.buyerSetup, 'Buyer organization')
  const buyerUser = getReadinessItem(readiness.buyerSetup, 'Buyer user')
  const iseAccess = getReadinessItem(readiness.buyerSetup, 'ISE 2026 access')
  const pizzaPricing = getReadinessItem(readiness.buyerSetup, 'Pizza pricing')
  const shopperAccess = getReadinessItem(readiness.buyerSetup, 'Shopper access/security profile')
  const interclean = readiness.eventWebsites.find((item) => item.technicalID === 'INTERCLEAN_2026_CATALOG')

  return (
    <Card bg={colors.bg} borderColor={colors.borderColor} variant="outline">
      <CardBody>
        <Stack spacing={5} color={colors.textColor}>
          <Box>
            <Heading as="h3" size="sm" color={colors.headingColor}>
              {readiness.readyToRecord ? 'OrderCloud setup is complete' : 'OrderCloud setup summary'}
            </Heading>
            <Text color={colors.subtleColor} mt={1}>
              This summary shows the catalogs, product setup, buyer setup, and assignments created for the RAI demo.
            </Text>
          </Box>
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5}>
            <OrderCloudSummaryGroup title="Catalogs / event websites">
              {EVENT_WEBSITE_OPTIONS.map((eventWebsite) => {
                const item = readiness.eventWebsites.find((entry) => entry.technicalID === eventWebsite.catalogID)
                const isOptionalMissing = !eventWebsite.required && item?.status !== 'ready'
                return (
                  <SummaryRow
                    key={eventWebsite.catalogID}
                    label={`${eventWebsite.catalogID} — ${eventWebsite.label}`}
                    value={eventWebsite.purpose}
                    status={isOptionalMissing ? 'warning' : item?.status}
                    statusLabel={isOptionalMissing ? 'Optional/not created' : item?.status === 'ready' ? 'Active' : undefined}
                    note={item?.message}
                  />
                )
              })}
            </OrderCloudSummaryGroup>
            <OrderCloudSummaryGroup title="Product setup">
              <SummaryRow label="Product: RAI_PIZZA" value="Reusable Pizza product" status={product?.status} note={product?.message} />
              <SummaryRow label="PriceSchedule: RAI_PIZZA_DEFAULT_PRICE" value="Default Pizza price schedule" status={price?.status} note={price?.message} />
              <SummaryRow label="Specs: RAI_PIZZA_SIZE, RAI_PIZZA_FLAVOUR, RAI_PIZZA_TOPPING" value="Size, flavour, and topping options" status={options?.status} note={options?.message} />
              <SummaryRow label="Event option rule" value="Vegetarian-only Event excludes Pepperoni and Ham" status={options?.status === 'ready' ? 'ready' : options?.status} />
            </OrderCloudSummaryGroup>
            <OrderCloudSummaryGroup title="Product availability assignments">
              {readiness.productAvailabilityAssignments.map((assignment) => (
                <SummaryRow
                  key={assignment.technicalID || assignment.label}
                  label={assignment.label}
                  value={assignment.technicalID || 'Catalog product assignment'}
                  status={assignment.status}
                  statusLabel={assignment.status === 'ready' ? 'Published' : undefined}
                  note={assignment.message}
                />
              ))}
              {interclean?.status !== 'ready' && (
                <Text fontSize="sm" color={colors.subtleColor}>Interclean 2026 is optional and does not block the main demo path.</Text>
              )}
            </OrderCloudSummaryGroup>
            <OrderCloudSummaryGroup title="Buyer setup">
              <SummaryRow label="Buyer: RAI_EXHIBITOR_BLUE_OCEAN_EXHIBITS_ISE_2026" value="Blue Ocean Exhibits" status={buyer?.status} note={buyer?.message} />
              <SummaryRow label="Buyer User: RAI_BUYER_ALEX_DEMO_ISE_2026" value="alex.demo@blue-ocean-exhibits.example" status={buyerUser?.status} note={buyerUser?.message} />
              <SummaryRow label="Event and booth" value="ISE 2026 · Booth 12-A40" status={buyer?.status} />
            </OrderCloudSummaryGroup>
            <OrderCloudSummaryGroup title="Buyer access assignments">
              <SummaryRow label="Blue Ocean Exhibits → ISE_2026_CATALOG" value="Event website access for ISE 2026" status={iseAccess?.status} note={iseAccess?.message} />
              <SummaryRow label="Blue Ocean Exhibits → RAI_PIZZA / RAI_PIZZA_DEFAULT_PRICE" value="Product/pricing assignment" status={pizzaPricing?.status} statusLabel={pizzaPricing?.status === 'ready' ? 'Assigned' : undefined} note={pizzaPricing?.message} />
            </OrderCloudSummaryGroup>
            <OrderCloudSummaryGroup title="Shopper access">
              <SummaryRow
                label="Security profile assignment"
                value={shopperAccess?.technicalID || 'No shopper security profile was assigned in this demo environment.'}
                status={shopperAccess?.status}
                statusLabel={shopperAccess?.status === 'ready' ? 'Assigned' : undefined}
                note={shopperAccess?.message}
              />
            </OrderCloudSummaryGroup>
          </SimpleGrid>
        </Stack>
      </CardBody>
    </Card>
  )
}

const EventWebsiteSelection: FC<{ selectedCatalogIDs: string[]; onSelectionChange: (catalogIDs: string[]) => void; readiness?: RaiDemoReadinessResult; prepareResult?: RaiPrepareDemoEventWebsitesResult }> = ({ selectedCatalogIDs, onSelectionChange, readiness, prepareResult }) => {
  const toggleCatalog = (catalogID: string) => {
    onSelectionChange(selectedCatalogIDs.includes(catalogID)
      ? selectedCatalogIDs.filter((item) => item !== catalogID)
      : [...selectedCatalogIDs, catalogID])
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
      {EVENT_WEBSITE_OPTIONS.map((eventWebsite) => {
        const readinessItem = readiness?.eventWebsites.find((item) => item.technicalID === eventWebsite.catalogID)
        const wasPrepared = getPreparedCatalogIDs(prepareResult).includes(eventWebsite.catalogID)
        const isSelected = selectedCatalogIDs.includes(eventWebsite.catalogID)
        return (
          <Card key={eventWebsite.catalogID} variant="outline">
            <CardBody>
              <Stack spacing={3}>
                <HStack justify="space-between" align="flex-start">
                  <Checkbox isChecked={isSelected} onChange={() => toggleCatalog(eventWebsite.catalogID)}>
                    <Text fontWeight="semibold">{eventWebsite.label}</Text>
                  </Checkbox>
                  <Badge colorScheme={eventWebsite.required ? 'blue' : 'gray'}>{eventWebsite.required ? 'Required' : 'Optional'}</Badge>
                </HStack>
                <Text color="chakra-subtle-text">{eventWebsite.purpose}</Text>
                <Text fontSize="sm" color="chakra-subtle-text">Required for: {eventWebsite.requiredFor}</Text>
                <HStack flexWrap="wrap">
                  <Badge colorScheme={isSelected ? 'green' : 'gray'}>{isSelected ? 'Selected' : 'Not selected'}</Badge>
                  {(readinessItem || wasPrepared) && <Badge colorScheme={wasPrepared || readinessItem?.status === 'ready' ? 'green' : readinessItem?.status === 'warning' ? 'orange' : 'red'}>{wasPrepared || readinessItem?.status === 'ready' ? 'Ready' : readinessItem?.status === 'warning' ? 'Optional warning' : 'Not ready'}</Badge>}
                </HStack>
                <Text fontSize="xs" color="chakra-subtle-text">Catalog ID: {eventWebsite.catalogID}</Text>
              </Stack>
            </CardBody>
          </Card>
        )
      })}
    </SimpleGrid>
  )
}

const useResultCardColors = (scheme: 'green' | 'orange' | 'blue' | 'red') => ({
  bg: useColorModeValue(`${scheme}.50`, `${scheme}.900`),
  borderColor: useColorModeValue(`${scheme}.200`, `${scheme}.600`),
  headingColor: useColorModeValue(`${scheme}.800`, `${scheme}.100`),
  textColor: useColorModeValue('gray.800', `${scheme}.50`),
  subtleColor: useColorModeValue('gray.700', `${scheme}.100`),
})

const AdvancedResetSection: FC<{ result?: RaiDeleteDemoDataResult; onOpen: () => void; isDeleting: boolean }> = ({ result, onOpen, isDeleting }) => (
  <Accordion allowToggle mt={6}>
    <AccordionItem border="1px solid" borderColor="chakra-border-color" borderRadius="md">
      <AccordionButton>
        <Box as="span" flex="1" textAlign="left" fontWeight="semibold">
          Advanced: reset demo data
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel>
        <Stack spacing={4}>
          <Text color="chakra-subtle-text">
            Use this only when you want to test the demo from a clean starting point.
          </Text>
          <Button alignSelf="flex-start" colorScheme="red" variant="outline" leftIcon={<DeleteIcon />} onClick={onOpen} isLoading={isDeleting}>
            Delete demo data
          </Button>
          {result && <DeleteSummary result={result} />}
        </Stack>
      </AccordionPanel>
    </AccordionItem>
  </Accordion>
)

const DeleteDemoDataModal: FC<{
  isOpen: boolean
  onClose: () => void
  confirmation: string
  onConfirmationChange: (value: string) => void
  onDelete: () => void
  isDeleting: boolean
}> = ({ isOpen, onClose, confirmation, onConfirmationChange, onDelete, isDeleting }) => {
  const canDelete = confirmation === 'DELETE RAI DEMO'

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Delete RAI demo data?</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text color="chakra-subtle-text">
              This removes only the demo data managed by the RAI Event Setup flow:
            </Text>
            <UnorderedList spacing={2} color="chakra-subtle-text">
              <ListItem>Demo event websites</ListItem>
              <ListItem>Pizza product setup</ListItem>
              <ListItem>Blue Ocean Exhibits demo buyer</ListItem>
              <ListItem>Demo buyer contact</ListItem>
              <ListItem>Demo access and pricing assignments</ListItem>
            </UnorderedList>
            <Box>
              <Text fontWeight="semibold" mb={2}>Type DELETE RAI DEMO to confirm.</Text>
              <Input value={confirmation} onChange={(event) => onConfirmationChange(event.target.value)} placeholder="DELETE RAI DEMO" />
            </Box>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isDeleting}>Cancel</Button>
          <Button colorScheme="red" onClick={onDelete} isDisabled={!canDelete || isDeleting} isLoading={isDeleting}>
            Delete demo data
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

const DeleteSummary: FC<{ result: RaiDeleteDemoDataResult }> = ({ result }) => {
  const scheme = result.overallStatus === 'deleted' || result.overallStatus === 'already-clean' ? 'green' : result.overallStatus === 'partial' ? 'orange' : 'red'
  const colors = useResultCardColors(scheme)
  const heading = result.overallStatus === 'already-clean'
    ? 'Demo data is already clean'
    : result.overallStatus === 'partial'
      ? 'Some demo data was deleted'
      : result.overallStatus === 'failed'
        ? 'Demo data could not be deleted'
        : 'RAI demo data deleted'

  return (
    <Card bg={colors.bg} borderColor={colors.borderColor} variant="outline">
      <CardBody>
        <Stack spacing={3} color={colors.textColor}>
          <Heading as="h3" size="sm" color={colors.headingColor}>{heading}</Heading>
          <Text color={colors.subtleColor}>Next: prepare demo event websites.</Text>
          {result.warnings.length > 0 && (
            <Box>
              <Text fontWeight="semibold">Items that need review</Text>
              <UnorderedList>
                {result.warnings.map((warning) => <ListItem key={warning}>{warning}</ListItem>)}
              </UnorderedList>
            </Box>
          )}
          <TechnicalDetails items={[
            `Deleted: ${result.deletedItems.length ? result.deletedItems.join(', ') : 'none'}`,
            `Skipped: ${result.skippedItems.length ? result.skippedItems.map((item) => `${item.label} ${item.id}: ${item.reason}`).join(' · ') : 'none'}`,
            `Missing: ${result.notFoundItems.length ? result.notFoundItems.join(', ') : 'none'}`,
            ...result.technicalSummary,
          ]} />
        </Stack>
      </CardBody>
    </Card>
  )
}

const PrepareSummary: FC<{ result: RaiPrepareDemoEventWebsitesResult }> = ({ result }) => {
  const hasPreparedCatalogs = result.createdCatalogIDs.length + result.updatedCatalogIDs.length > 0
  const hasWarnings = result.warnings.length > 0
  const colors = useResultCardColors(!hasPreparedCatalogs && hasWarnings ? 'red' : hasWarnings ? 'orange' : 'blue')
  const readyCatalogIDs = [...result.createdCatalogIDs, ...result.updatedCatalogIDs]
  const readyEventWebsites = EVENT_WEBSITE_OPTIONS.filter((item) => readyCatalogIDs.includes(item.catalogID)).map((item) => item.label)
  const skippedEventWebsites = EVENT_WEBSITE_OPTIONS.filter((item) => result.skippedCatalogIDs.includes(item.catalogID)).map((item) => item.label)

  return (
    <Card bg={colors.bg} borderColor={colors.borderColor} variant="outline">
      <CardBody>
        <Stack spacing={2} color={colors.textColor}>
          <Text fontWeight="semibold" color={colors.headingColor}>
            {hasPreparedCatalogs ? `${readyEventWebsites.length} event websites are ready` : 'Event websites could not be prepared'}
          </Text>
          {readyEventWebsites.length > 0 && <UnorderedList>{readyEventWebsites.map((label) => <ListItem key={label}>{label}</ListItem>)}</UnorderedList>}
          {skippedEventWebsites.length > 0 && <Text color={colors.subtleColor}>{skippedEventWebsites.join(', ')} {skippedEventWebsites.length === 1 ? 'was' : 'were'} not selected for this run.</Text>}
          <Text color={colors.subtleColor}>Created {result.createdCatalogIDs.length} and updated {result.updatedCatalogIDs.length} event websites.</Text>
          <Text fontWeight="semibold" color={colors.headingColor}>Next: create the Pizza product setup, then register Blue Ocean Exhibits.</Text>
          {hasWarnings && <UnorderedList>{result.warnings.map((warning) => <ListItem key={warning}>{warning}</ListItem>)}</UnorderedList>}
          <TechnicalDetails items={[
            `Created: ${result.createdCatalogIDs.length ? result.createdCatalogIDs.join(', ') : 'none'}`,
            `Updated: ${result.updatedCatalogIDs.length ? result.updatedCatalogIDs.join(', ') : 'none'}`,
            `Skipped by selection: ${result.skippedCatalogIDs.length ? result.skippedCatalogIDs.join(', ') : 'none'}`,
            ...result.technicalSummary,
          ]} />
        </Stack>
      </CardBody>
    </Card>
  )
}

const TechnicalDetails: FC<{ items: ReactNode[] }> = ({ items }) => (
  <Accordion allowToggle>
    <AccordionItem>
      <AccordionButton>
        <Box as="span" flex="1" textAlign="left" fontWeight="semibold">
          OrderCloud details
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel color="chakra-subtle-text">
        <UnorderedList spacing={2}>{items.map((item) => <ListItem key={String(item)}>{item}</ListItem>)}</UnorderedList>
      </AccordionPanel>
    </AccordionItem>
  </Accordion>
)

export default RaiEventSetupLanding
