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
  Stack,
  Text,
  UnorderedList,
  useColorModeValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { useAuthMutation } from '@ordercloud/react-sdk'
import { FC, ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { checkRaiDemoReadiness, deleteRaiDemoData, prepareRaiDemoEventWebsites } from './raiEventSetupService'
import { RaiDeleteDemoDataResult, RaiDemoReadinessResult, RaiPrepareDemoEventWebsitesResult } from './types'

const RaiEventSetupLanding: FC = () => {
  const toast = useToast()
  const resetModal = useDisclosure()
  const [readiness, setReadiness] = useState<RaiDemoReadinessResult>()
  const [prepareResult, setPrepareResult] = useState<RaiPrepareDemoEventWebsitesResult>()
  const [deleteResult, setDeleteResult] = useState<RaiDeleteDemoDataResult>()
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [readinessError, setReadinessError] = useState<string>()
  const readinessCheckReason = useRef<'auto' | 'manual'>('auto')

  const readinessMutation = useAuthMutation({
    mutationKey: ['rai-demo-readiness'],
    mutationFn: checkRaiDemoReadiness,
    onSuccess: (data) => {
      setReadiness(data)
      setReadinessError(undefined)
      if (readinessCheckReason.current === 'manual') {
        toast({ title: data.readyToRecord ? 'Ready to record' : 'Demo status refreshed', description: data.readyToRecord ? 'The RAI demo setup is ready to record.' : 'Follow the next available setup step.', status: data.readyToRecord ? 'success' : 'info' })
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
      readinessCheckReason.current = 'auto'
      readinessMutation.mutate(undefined)
      toast({
        title: preparedCount ? 'Demo event websites prepared' : 'Demo event websites could not be prepared',
        description: `${data.createdCatalogIDs.length} created, ${data.updatedCatalogIDs.length} updated.`,
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
        onRefresh={refreshStatus}
        onPrepare={() => prepareMutation.mutate(undefined)}
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

const GuidedSetupChecklist: FC<GuidedSetupChecklistProps> = ({ readiness, prepareResult, readinessError, onRefresh, onPrepare, isChecking, isPreparing }) => {
  const eventWebsitesReady = readiness?.eventWebsitesReady ?? false
  const pizzaSetupReady = readiness?.pizzaSetupReady ?? false
  const exhibitorSetupReady = readiness?.exhibitorSetupReady ?? false
  const readyToRecord = readiness?.readyToRecord ?? false
  const productWarnings = readiness?.productSetup.some((item) => item.status === 'warning') ?? false
  const buyerWarnings = readiness?.buyerSetup.some((item) => item.status === 'warning') ?? false
  const eventWebsiteNames = 'ISE 2026, Interclean 2026, RAI Catering Portal, Vegetarian-only Event'

  return (
    <Card variant="outline" p={2}>
      <CardBody>
        <Stack spacing={6}>
          <HStack justify="space-between" align="flex-start" flexWrap="wrap">
            <Box>
              <Heading as="h2" size="lg">RAI Admin Demo Setup</Heading>
              <Text color="chakra-subtle-text" mt={2}>
                Follow these steps in order to prepare the OrderCloud demo environment and record the walkthrough.
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
              title="Prepare event websites"
              description="Create the event websites that products and exhibitors will be connected to."
              status={getStepStatus(eventWebsitesReady, !eventWebsitesReady)}
              readyText={`These event websites are ready: ${eventWebsiteNames}.`}
              result={prepareResult && <PrepareSummary result={prepareResult} />}
              action={<Button colorScheme="blue" onClick={onPrepare} isLoading={isPreparing} isDisabled={isChecking}>{eventWebsitesReady ? 'Prepare again' : 'Prepare event websites'}</Button>}
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
              action={<Button as={Link} to="/rai-event-setup/buyers/new" colorScheme="blue" rightIcon={<ArrowForwardIcon />} isDisabled={!eventWebsitesReady || !pizzaSetupReady || isChecking}>{exhibitorSetupReady ? 'Review or update exhibitor setup' : 'Start exhibitor setup'}</Button>}
            />
            <GuidedStepCard
              stepNumber={4}
              title="Final readiness check"
              description="Confirm the event websites, Pizza product setup, and exhibitor access are ready before recording."
              status={readyToRecord ? 'ready' : eventWebsitesReady && pizzaSetupReady && exhibitorSetupReady ? 'next' : 'blocked'}
              readyText="Ready to record."
              blockedText={!eventWebsitesReady ? 'Prepare event websites first.' : !pizzaSetupReady ? 'Create Pizza setup first.' : 'Register Blue Ocean Exhibits first.'}
              action={<Button colorScheme="blue" variant={readyToRecord ? 'outline' : 'solid'} onClick={onRefresh} isLoading={isChecking} isDisabled={!eventWebsitesReady || !pizzaSetupReady || !exhibitorSetupReady || isPreparing}>{readyToRecord ? 'Check again' : 'Check final readiness'}</Button>}
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
}> = ({ stepNumber, title, description, status, action, readyText, blockedText, result }) => {
  const statusDetails = guidedStatusCopy[status]
  const borderColor = useColorModeValue(status === 'next' ? 'blue.300' : 'gray.200', status === 'next' ? 'blue.500' : 'gray.700')

  return (
    <Card variant="outline" borderColor={borderColor}>
      <CardBody>
        <Stack spacing={4}>
          <HStack justify="space-between" align="flex-start" flexWrap="wrap">
            <HStack align="flex-start">
              <Badge borderRadius="full" colorScheme={statusDetails.colorScheme}>{stepNumber}</Badge>
              <Box>
                <Heading as="h3" size="md">{title}</Heading>
                <Text color="chakra-subtle-text" mt={1}>{description}</Text>
              </Box>
            </HStack>
            <Badge colorScheme={statusDetails.colorScheme}>{statusDetails.label}</Badge>
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

  return (
    <Card bg={colors.bg} borderColor={colors.borderColor} variant="outline">
      <CardBody>
        <Stack spacing={2} color={colors.textColor}>
          <Text fontWeight="semibold" color={colors.headingColor}>
            {hasPreparedCatalogs ? 'Event websites are prepared' : 'Event websites could not be prepared'}
          </Text>
          <Text color={colors.subtleColor}>Created {result.createdCatalogIDs.length} and updated {result.updatedCatalogIDs.length} event websites.</Text>
          <Text fontWeight="semibold" color={colors.headingColor}>Next: create the Pizza product setup, then register Blue Ocean Exhibits.</Text>
          {hasWarnings && <UnorderedList>{result.warnings.map((warning) => <ListItem key={warning}>{warning}</ListItem>)}</UnorderedList>}
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
