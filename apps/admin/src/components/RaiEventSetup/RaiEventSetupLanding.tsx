import { ArrowForwardIcon } from '@chakra-ui/icons'
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
  ListItem,
  OrderedList,
  SimpleGrid,
  Stack,
  Text,
  UnorderedList,
  useToast,
} from '@chakra-ui/react'
import { useAuthMutation } from '@ordercloud/react-sdk'
import { FC, ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import { checkRaiDemoReadiness, prepareRaiDemoEventWebsites } from './raiEventSetupService'
import { RaiDemoReadinessResult, RaiPrepareDemoEventWebsitesResult, RaiReadinessItem, RaiReadinessItemStatus } from './types'

const statusCopy: Record<RaiReadinessItemStatus, { label: string; colorScheme: string }> = {
  ready: { label: 'Ready', colorScheme: 'green' },
  missing: { label: 'Missing', colorScheme: 'red' },
  warning: { label: 'Warning', colorScheme: 'orange' },
  unchecked: { label: 'Not checked', colorScheme: 'gray' },
}

const RaiEventSetupLanding: FC = () => {
  const toast = useToast()
  const [readiness, setReadiness] = useState<RaiDemoReadinessResult>()
  const [prepareResult, setPrepareResult] = useState<RaiPrepareDemoEventWebsitesResult>()

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
      toast({ title: 'Demo event websites prepared', description: `${data.createdCatalogIDs.length} created, ${data.updatedCatalogIDs.length} updated.`, status: data.warnings.length ? 'warning' : 'success' })
    },
    onError: (error) => {
      const description = error instanceof Error ? error.message : 'Demo event websites could not be prepared.'
      toast({ title: 'Prepare action failed', description, status: 'error' })
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

const PrepareSummary: FC<{ result: RaiPrepareDemoEventWebsitesResult }> = ({ result }) => (
  <Card bg="blue.50" borderColor="blue.200" variant="outline">
    <CardBody>
      <Stack spacing={2}>
        <Text fontWeight="semibold">Event websites are prepared</Text>
        <Text color="chakra-subtle-text">Created {result.createdCatalogIDs.length} and updated {result.updatedCatalogIDs.length} event websites.</Text>
        <Text fontWeight="semibold" color="blue.700">Next: create the Pizza product setup, then register Blue Ocean Exhibits.</Text>
        {result.warnings.length > 0 && <UnorderedList color="orange.700">{result.warnings.map((warning) => <ListItem key={warning}>{warning}</ListItem>)}</UnorderedList>}
      </Stack>
    </CardBody>
  </Card>
)

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
        <Card bg="green.50" borderColor="green.200" variant="outline">
          <CardBody><Text fontWeight="semibold" color="green.700">Ready to record the admin walkthrough.</Text></CardBody>
        </Card>
      )}
      {(hasMissingEventWebsites || hasMissingPizza || hasMissingBuyer) && (
        <Card bg="orange.50" borderColor="orange.200" variant="outline">
          <CardBody>
            <UnorderedList color="orange.800">
              {hasMissingEventWebsites && <ListItem>Next: prepare event websites.</ListItem>}
              {hasMissingPizza && <ListItem>Next: create the Pizza product setup.</ListItem>}
              {hasMissingBuyer && <ListItem>Next: register Blue Ocean Exhibits.</ListItem>}
            </UnorderedList>
          </CardBody>
        </Card>
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
