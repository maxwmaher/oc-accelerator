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
  OrderedList,
  SimpleGrid,
  Stack,
  Text,
  UnorderedList,
  useColorModeValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { useAuthMutation } from '@ordercloud/react-sdk'
import { FC, ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import { checkRaiDemoReadiness, deleteRaiDemoData, prepareRaiDemoEventWebsites } from './raiEventSetupService'
import { RaiDeleteDemoDataResult, RaiDemoReadinessResult, RaiPrepareDemoEventWebsitesResult, RaiReadinessItem, RaiReadinessItemStatus } from './types'

const statusCopy: Record<RaiReadinessItemStatus, { label: string; colorScheme: string }> = {
  ready: { label: 'Ready', colorScheme: 'green' },
  missing: { label: 'Missing', colorScheme: 'red' },
  warning: { label: 'Warning', colorScheme: 'orange' },
  unchecked: { label: 'Not checked', colorScheme: 'gray' },
}

const RaiEventSetupLanding: FC = () => {
  const toast = useToast()
  const resetModal = useDisclosure()
  const [readiness, setReadiness] = useState<RaiDemoReadinessResult>()
  const [prepareResult, setPrepareResult] = useState<RaiPrepareDemoEventWebsitesResult>()
  const [deleteResult, setDeleteResult] = useState<RaiDeleteDemoDataResult>()
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  const readinessMutation = useAuthMutation({
    mutationKey: ['rai-demo-readiness'],
    mutationFn: checkRaiDemoReadiness,
    onSuccess: (data) => {
      setReadiness(data)
      toast({ title: data.overallStatus === 'ready' ? 'Demo environment is ready' : 'Demo readiness checked', description: data.overallStatus === 'ready' ? 'The RAI demo setup is ready to record.' : 'Review the friendly readiness hints before recording.', status: data.overallStatus === 'ready' ? 'success' : 'warning' })
    },
    onError: (error) => {
      const description = error instanceof Error ? error.message : 'Demo readiness could not be checked.'
      toast({ title: 'Readiness check failed', description, status: 'error' })
    },
  })

  const prepareMutation = useAuthMutation({
    mutationKey: ['rai-demo-event-websites-prepare'],
    mutationFn: prepareRaiDemoEventWebsites,
    onSuccess: (data) => {
      setPrepareResult(data)
      const preparedCount = data.createdCatalogIDs.length + data.updatedCatalogIDs.length
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
      <DemoPathCard />
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mt={6}>
        <Card variant="outline" p={2} _hover={{ borderColor: 'blue.300', boxShadow: 'md' }}>
          <CardBody>
            <Stack spacing={4} align="flex-start">
              <Heading as="h2" size="md">Create Event Product</Heading>
              <Text color="chakra-subtle-text">
                Create a reusable Pizza product, configure business fields, product options, pricing for this event, and product availability across event websites.
              </Text>
              <HStack color="chakra-subtle-text" fontSize="sm" flexWrap="wrap">
                <Text>Basics</Text><Text>•</Text><Text>Pricing</Text><Text>•</Text><Text>Options</Text><Text>•</Text><Text>Availability</Text>
              </HStack>
              <Button as={Link} to="/rai-event-setup/products/new" colorScheme="blue" rightIcon={<ArrowForwardIcon />}>
                Start product setup
              </Button>
            </Stack>
          </CardBody>
        </Card>
        <Card variant="outline" p={2} _hover={{ borderColor: 'blue.300', boxShadow: 'md' }}>
          <CardBody>
            <Stack spacing={4} align="flex-start">
              <Heading as="h2" size="md">Register Exhibitor Buyer</Heading>
              <Text color="chakra-subtle-text">
                Register an exhibitor, create the buyer contact, and grant event website access with the right product availability and pricing tier.
              </Text>
              <HStack color="chakra-subtle-text" fontSize="sm" flexWrap="wrap">
                <Text>Event</Text><Text>•</Text><Text>Company</Text><Text>•</Text><Text>User</Text><Text>•</Text><Text>Access</Text>
              </HStack>
              <Button as={Link} to="/rai-event-setup/buyers/new" colorScheme="blue" rightIcon={<ArrowForwardIcon />}>
                Start buyer setup
              </Button>
            </Stack>
          </CardBody>
        </Card>
      </SimpleGrid>
      <DemoReadinessCard
        mt={6}
        readiness={readiness}
        prepareResult={prepareResult}
        onCheck={() => readinessMutation.mutate(undefined)}
        onPrepare={() => prepareMutation.mutate(undefined)}
        isChecking={readinessMutation.isPending}
        isPreparing={prepareMutation.isPending}
      />
      <ResetDemoDataCard
        result={deleteResult}
        onOpen={resetModal.onOpen}
        isDeleting={deleteMutation.isPending}
      />
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

interface DemoReadinessCardProps {
  mt?: number
  readiness?: RaiDemoReadinessResult
  prepareResult?: RaiPrepareDemoEventWebsitesResult
  onCheck: () => void
  onPrepare: () => void
  isChecking: boolean
  isPreparing: boolean
}

const useResultCardColors = (scheme: 'green' | 'orange' | 'blue' | 'red') => ({
  bg: useColorModeValue(`${scheme}.50`, `${scheme}.900`),
  borderColor: useColorModeValue(`${scheme}.200`, `${scheme}.600`),
  headingColor: useColorModeValue(`${scheme}.800`, `${scheme}.100`),
  textColor: useColorModeValue('gray.800', `${scheme}.50`),
  subtleColor: useColorModeValue('gray.700', `${scheme}.100`),
})

const ResetDemoDataCard: FC<{ result?: RaiDeleteDemoDataResult; onOpen: () => void; isDeleting: boolean }> = ({ result, onOpen, isDeleting }) => (
  <Card variant="outline" mt={6} p={2}>
    <CardBody>
      <Stack spacing={4}>
        <Box>
          <Heading as="h2" size="md">Reset demo data</Heading>
          <Text color="chakra-subtle-text" mt={2}>
            This removes only the RAI demo resources created by this guided setup, so you can test or record the demo from a clean starting point.
          </Text>
        </Box>
        <Button alignSelf="flex-start" colorScheme="red" variant="outline" leftIcon={<DeleteIcon />} onClick={onOpen} isLoading={isDeleting}>
          Delete demo data
        </Button>
        {result && <DeleteSummary result={result} />}
      </Stack>
    </CardBody>
  </Card>
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

const DemoPathCard: FC = () => (
  <Card variant="outline" p={2}>
    <CardBody>
      <Stack spacing={4}>
        <Heading as="h2" size="md">Recommended demo path</Heading>
        <Text color="chakra-subtle-text">Follow this sequence when recording the admin walkthrough.</Text>
        <OrderedList spacing={2} color="chakra-subtle-text">
          <ListItem><Text as="span" fontWeight="semibold" color="chakra-body-text">Prepare event websites</Text> so the demo destinations are ready.</ListItem>
          <ListItem><Text as="span" fontWeight="semibold" color="chakra-body-text">Create Pizza product setup</Text> with product options, pricing, and event availability.</ListItem>
          <ListItem><Text as="span" fontWeight="semibold" color="chakra-body-text">Register Blue Ocean Exhibits</Text> with event website access and shopper access.</ListItem>
          <ListItem><Text as="span" fontWeight="semibold" color="chakra-body-text">Check demo readiness</Text> before recording the final take.</ListItem>
        </OrderedList>
        <Accordion allowToggle>
          <AccordionItem>
            <AccordionButton>
              <Box as="span" flex="1" textAlign="left" fontWeight="semibold">Suggested narration</Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel color="chakra-subtle-text">
              <UnorderedList spacing={2}>
                <ListItem>This area is designed for the ecommerce team.</ListItem>
                <ListItem>We can prepare event websites for a new event.</ListItem>
                <ListItem>We can create Pizza once and publish it across multiple event websites.</ListItem>
                <ListItem>We can configure options like size, flavour, and toppings.</ListItem>
                <ListItem>We can register an exhibitor and give them the right event access and pricing.</ListItem>
                <ListItem>The technical details are handled by OrderCloud behind the scenes.</ListItem>
              </UnorderedList>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </Stack>
    </CardBody>
  </Card>
)

const DemoReadinessCard: FC<DemoReadinessCardProps> = ({ mt, readiness, prepareResult, onCheck, onPrepare, isChecking, isPreparing }) => (
  <Card variant="outline" mt={mt} p={2}>
    <CardBody>
      <Stack spacing={5}>
        <Box>
          <Heading as="h2" size="md">Demo readiness</Heading>
          <Text color="chakra-subtle-text" mt={2}>
            Check whether the event websites, Pizza product setup, and demo exhibitor are ready before recording the RAI admin demo video.
          </Text>
        </Box>
        <HStack flexWrap="wrap">
          <Button colorScheme="blue" onClick={onPrepare} isLoading={isPreparing} isDisabled={isChecking}>Prepare demo event websites</Button>
          <Button colorScheme="blue" variant="outline" onClick={onCheck} isLoading={isChecking} isDisabled={isPreparing}>Check demo readiness</Button>
        </HStack>
        {prepareResult && <PrepareSummary result={prepareResult} />}
        {readiness && <ReadinessSummary result={readiness} />}
      </Stack>
    </CardBody>
  </Card>
)

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

const ReadinessSummary: FC<{ result: RaiDemoReadinessResult }> = ({ result }) => {
  const hasMissingEventWebsites = result.eventWebsites.some((item) => item.status === 'missing')
  const hasMissingPizza = result.productSetup.some((item) => item.status === 'missing')
  const hasMissingBuyer = result.buyerSetup.some((item) => ['Buyer organization', 'Buyer user'].includes(item.label) && item.status === 'missing')

  return (
    <Stack spacing={4}>
      <HStack>
        <Text fontWeight="semibold">Overall demo status</Text>
        <Badge colorScheme={result.overallStatus === 'ready' ? 'green' : result.overallStatus === 'partial' ? 'orange' : 'red'}>{result.overallStatus === 'ready' ? 'Ready' : result.overallStatus === 'partial' ? 'Partially ready' : 'Not ready'}</Badge>
      </HStack>
      {result.overallStatus === 'ready' && (
        <ReadyToRecordCard />
      )}
      {(hasMissingEventWebsites || hasMissingPizza || hasMissingBuyer) && (
        <ReadinessNextSteps hasMissingEventWebsites={hasMissingEventWebsites} hasMissingPizza={hasMissingPizza} hasMissingBuyer={hasMissingBuyer} />
      )}
      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
        <StatusGroup title="Event websites" items={result.eventWebsites} />
        <StatusGroup title="Pizza product setup" items={result.productSetup} />
        <StatusGroup title="Exhibitor buyer setup" items={result.buyerSetup} />
      </SimpleGrid>
      <TechnicalDetails items={result.technicalSummary} />
    </Stack>
  )
}

const ReadyToRecordCard: FC = () => {
  const colors = useResultCardColors('green')
  return (
    <Card bg={colors.bg} borderColor={colors.borderColor} variant="outline">
      <CardBody><Text fontWeight="semibold" color={colors.headingColor}>Ready to record the admin walkthrough.</Text></CardBody>
    </Card>
  )
}

const ReadinessNextSteps: FC<{ hasMissingEventWebsites: boolean; hasMissingPizza: boolean; hasMissingBuyer: boolean }> = ({ hasMissingEventWebsites, hasMissingPizza, hasMissingBuyer }) => {
  const colors = useResultCardColors('orange')
  return (
    <Card bg={colors.bg} borderColor={colors.borderColor} variant="outline">
      <CardBody color={colors.textColor}>
        <UnorderedList>
          {hasMissingEventWebsites && <ListItem>Next: prepare event websites.</ListItem>}
          {hasMissingPizza && <ListItem>Next: create the Pizza product setup.</ListItem>}
          {hasMissingBuyer && <ListItem>Next: register Blue Ocean Exhibits.</ListItem>}
        </UnorderedList>
      </CardBody>
    </Card>
  )
}

const StatusGroup: FC<{ title: string; items: RaiReadinessItem[] }> = ({ title, items }) => (
  <Card variant="outline">
    <CardBody>
      <Stack spacing={3}>
        <Heading as="h3" size="sm">{title}</Heading>
        {items.map((item) => <StatusRow key={`${title}-${item.label}`} item={item} />)}
      </Stack>
    </CardBody>
  </Card>
)

const StatusRow: FC<{ item: RaiReadinessItem }> = ({ item }) => {
  const status = statusCopy[item.status]
  return (
    <HStack justify="space-between" align="flex-start">
      <Box>
        <Text fontWeight="semibold">{item.label}</Text>
        {item.message && <Text fontSize="sm" color="chakra-subtle-text">{item.message}</Text>}
      </Box>
      <Badge colorScheme={status.colorScheme}>{status.label}</Badge>
    </HStack>
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
