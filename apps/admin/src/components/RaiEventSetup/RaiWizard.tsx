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
  CheckboxGroup,
  Container,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Input,
  ListItem,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  UnorderedList,
  VStack,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react'
import { FC, ReactNode, useMemo, useState } from 'react'
import { useAuthMutation } from '@ordercloud/react-sdk'
import { Link } from 'react-router-dom'
import { submitRaiBuyerSetup, submitRaiProductSetup } from './raiEventSetupService'
import { RaiBuyerSetupForm, RaiBuyerSetupResult, RaiProductSetupForm, RaiProductSetupResult } from './types'

interface WizardShellProps {
  title: string
  description: string
  steps: string[]
  currentStep: number
  children: ReactNode
  onBack: () => void
  onNext: () => void
  onSubmit: () => void
  isSubmitting?: boolean
}

const WizardShell: FC<WizardShellProps> = ({ title, description, steps, currentStep, children, onBack, onNext, onSubmit, isSubmitting = false }) => {
  const isReviewStep = currentStep === steps.length - 1

  return (
    <Container maxW="6xl" p={8}>
      <Button as={Link} to="/rai-event-setup" variant="ghost" mb={4}>
        Back to RAI Event Setup
      </Button>
      <Heading as="h1" size="lg" color="chakra-subtle-text">
        {title}
      </Heading>
      <Text mt={2} color="chakra-subtle-text">
        {description}
      </Text>
      <Card mt={6} variant="outline">
        <CardBody>
          <Stack spacing={6}>
            <Box>
              <HStack justify="space-between" mb={3} flexWrap="wrap">
                {steps.map((step, index) => (
                  <Badge key={step} colorScheme={index === currentStep ? 'blue' : index < currentStep ? 'green' : 'gray'}>
                    {index + 1}. {step}
                  </Badge>
                ))}
              </HStack>
              <Progress value={((currentStep + 1) / steps.length) * 100} colorScheme="blue" borderRadius="full" />
            </Box>
            <Divider />
            {children}
            <HStack justify="space-between">
              <Button onClick={onBack} isDisabled={currentStep === 0 || isSubmitting} variant="outline">
                Previous
              </Button>
              <Button colorScheme="blue" onClick={isReviewStep ? onSubmit : onNext} isLoading={isSubmitting} isDisabled={isSubmitting}>
                {isReviewStep ? 'Create demo setup' : 'Next'}
              </Button>
            </HStack>
          </Stack>
        </CardBody>
      </Card>
    </Container>
  )
}

const SummaryRow: FC<{ label: string; value: ReactNode }> = ({ label, value }) => (
  <Box>
    <Text fontSize="sm" color="chakra-subtle-text">{label}</Text>
    <Text fontWeight="semibold">{value}</Text>
  </Box>
)

const optionList = (items: string[]) => items.join(', ')


const eventWebsiteLabelsByCatalogID: Record<string, string> = {
  ISE_2026_CATALOG: 'ISE 2026',
  INTERCLEAN_2026_CATALOG: 'Interclean 2026',
  RAI_CATERING_CATALOG: 'RAI Catering Portal',
  VEGETARIAN_EVENT_CATALOG: 'Vegetarian-only Event',
}

const formatEventWebsiteLabels = (catalogIDs: string[]) => catalogIDs.map((catalogID) => eventWebsiteLabelsByCatalogID[catalogID] ?? catalogID).join(', ')

const useResultCardColors = (scheme: 'green' | 'orange') => ({
  bg: useColorModeValue(`${scheme}.50`, `${scheme}.900`),
  borderColor: useColorModeValue(`${scheme}.200`, `${scheme}.600`),
  headingColor: useColorModeValue(`${scheme}.800`, `${scheme}.100`),
  textColor: useColorModeValue('gray.800', `${scheme}.50`),
  subtleColor: useColorModeValue('gray.700', `${scheme}.100`),
})

const ProductReview: FC<{ form: RaiProductSetupForm; result?: RaiProductSetupResult }> = ({ form, result }) => (
  <Stack spacing={5}>
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
      <SummaryRow label="Reusable product" value={`${form.name} · ${form.category}`} />
      <SummaryRow label="Pricing tier" value={`${form.currency} ${form.basePrice}`} />
      <SummaryRow label="Vegetarian-only event eligible" value={form.vegetarianOnlyEventEligible ? 'Yes' : 'No'} />
      <SummaryRow label="Product availability" value={optionList(form.eventWebsites)} />
      <SummaryRow label="Size options" value={optionList(form.sizes)} />
      <SummaryRow label="Flavour options" value={optionList(form.flavours)} />
      <SummaryRow label="Topping options" value={optionList(form.toppings)} />
    </SimpleGrid>
    {result && <ProductSuccess result={result} />}
    <TechnicalDetails items={result?.technicalSummary ?? ['Product', 'Price schedule', 'Product options/specs', 'Event website/catalog assignments']} label={result ? 'What happened in OrderCloud?' : undefined} />
  </Stack>
)

const BuyerReview: FC<{ form: RaiBuyerSetupForm; result?: RaiBuyerSetupResult }> = ({ form, result }) => (
  <Stack spacing={5}>
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
      <SummaryRow label="Event" value={form.eventName} />
      <SummaryRow label="Exhibitor company" value={`${form.companyName} · Booth ${form.boothNumber}`} />
      <SummaryRow label="Buyer contact" value={`${form.firstName} ${form.lastName} · ${form.email}`} />
      <SummaryRow label="Event website access" value={optionList(form.eventWebsites)} />
      <SummaryRow label="Shopper access" value={optionList(form.productAccess)} />
      <SummaryRow label="Pricing tier" value={form.pricingTier} />
    </SimpleGrid>
    {result && <BuyerSuccess result={result} companyName={form.companyName} />}
    <TechnicalDetails items={result?.technicalSummary ?? ['Buyer organization', 'Buyer user', 'Catalog access', 'Product/pricing assignment', 'Shopper/security profile']} label={result ? 'What happened in OrderCloud?' : undefined} />
  </Stack>
)

const BuyerSuccess: FC<{ result: RaiBuyerSetupResult; companyName: string }> = ({ result, companyName }) => {
  const colors = useResultCardColors(result.warnings.length ? 'orange' : 'green')

  return (
    <Stack spacing={4}>
      <Card bg={colors.bg} borderColor={colors.borderColor} variant="outline">
        <CardBody>
          <Stack spacing={3} color={colors.textColor}>
            <Heading as="h2" size="md" color={colors.headingColor}>
              {result.warnings.length ? 'Blue Ocean Exhibits is partly ready for ISE 2026' : 'Blue Ocean Exhibits is ready for ISE 2026'}
            </Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <SummaryRow label="Event website access" value={result.catalogAccessAssigned ? result.eventWebsiteLabel : 'Prepare event websites, then run this step again'} />
            <SummaryRow label="Buyer contact" value={result.username} />
            <SummaryRow label="Exhibitor company ID" value={result.buyerID} />
            <SummaryRow label="Booth" value={result.boothNumber} />
            <SummaryRow label="Pricing tier" value={result.priceTier} />
            <SummaryRow label="Pizza pricing override" value={result.productPricingAssigned ? 'Applied' : 'Not applied'} />
            <SummaryRow label="Shopper access" value={result.securityProfileAssigned ? 'Ready' : 'Shopper access profile was not found in this demo environment'} />
          </SimpleGrid>
          {result.warnings.length > 0 && (
            <Box>
              <Text fontWeight="semibold" color={colors.headingColor}>Setup completed with friendly notes</Text>
              <UnorderedList>
                {result.warnings.map((warning) => <ListItem key={warning}>{warning}</ListItem>)}
              </UnorderedList>
            </Box>
          )}
        </Stack>
      </CardBody>
    </Card>
    <Card variant="outline">
      <CardBody>
        <Stack spacing={3}>
          <Heading as="h3" size="sm">Buyer access preview</Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <SummaryRow label="Event website" value={result.eventWebsiteLabel} />
            <SummaryRow label="Exhibitor" value={companyName} />
            <SummaryRow label="Booth" value={result.boothNumber} />
            <SummaryRow label="Can access event products" value={result.catalogAccessAssigned ? 'Yes' : 'No'} />
            <SummaryRow label="Pizza pricing override" value={result.productPricingAssigned ? result.priceTier : 'Not applied; storefront access remains assigned'} />
            <SummaryRow label="Example product" value={result.exampleProductAvailable ? 'Pizza' : 'Pizza not confirmed yet'} />
          </SimpleGrid>
        </Stack>
      </CardBody>
    </Card>
  </Stack>
  )
}

const ProductSuccess: FC<{ result: RaiProductSetupResult }> = ({ result }) => {
  const colors = useResultCardColors(result.skippedCatalogs.length ? 'orange' : 'green')

  return (
    <Card bg={colors.bg} borderColor={colors.borderColor} variant="outline">
      <CardBody>
        <Stack spacing={3} color={colors.textColor}>
          <Heading as="h2" size="md" color={colors.headingColor}>Pizza product setup is ready</Heading>
          {result.skippedCatalogs.length > 0 && (
            <Text color={colors.subtleColor}>Some event websites need another pass before Pizza is published there.</Text>
          )}
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <SummaryRow label="Event websites published to" value={result.assignedCatalogIDs.length ? formatEventWebsiteLabels(result.assignedCatalogIDs) : 'Prepare event websites, then run this step again'} />
          <SummaryRow label="Default price" value={`${result.currency} ${result.defaultPrice.toFixed(2)}`} />
          <SummaryRow label="Product ID" value={result.productID} />
          <SummaryRow label="Product options" value={result.specs.map((spec) => `${spec.name}: ${spec.optionIDs.length}`).join(' · ')} />
          <SummaryRow label="Vegetarian-only event restriction" value="Pepperoni and Ham are excluded for the vegetarian-only event." />
        </SimpleGrid>
        {result.skippedCatalogs.length > 0 && (
          <Box>
            <Text fontWeight="semibold" color={colors.headingColor}>Event websites needing another pass</Text>
            <UnorderedList>
              {result.skippedCatalogs.map((catalog) => <ListItem key={catalog.eventWebsiteLabel}>{catalog.eventWebsiteLabel}: {catalog.reason}</ListItem>)}
            </UnorderedList>
          </Box>
        )}
      </Stack>
    </CardBody>
  </Card>
  )
}

const TechnicalDetails: FC<{ items: string[]; label?: string }> = ({ items, label = 'What will happen in OrderCloud?' }) => (
  <Accordion allowToggle>
    <AccordionItem>
      <AccordionButton>
        <Box as="span" flex="1" textAlign="left" fontWeight="semibold">
          {label}
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel color="chakra-subtle-text">
        <UnorderedList spacing={2}>{items.map((item) => <ListItem key={item}>{item}</ListItem>)}</UnorderedList>
      </AccordionPanel>
    </AccordionItem>
  </Accordion>
)

export const RaiProductWizard: FC = () => {
  const toast = useToast()
  const steps = ['Product basics', 'Pricing', 'Options', 'Event availability', 'Review']
  const [currentStep, setCurrentStep] = useState(0)
  const [result, setResult] = useState<RaiProductSetupResult>()
  const productMutation = useAuthMutation({
    mutationKey: ['rai-event-product-setup'],
    mutationFn: submitRaiProductSetup,
    onSuccess: (data) => {
      setResult(data)
      toast({
        title: 'Pizza product setup is ready',
        description: data.skippedCatalogs.length ? 'Some event websites need another pass before Pizza is published there.' : 'The demo product was created or updated.',
        status: data.skippedCatalogs.length ? 'warning' : 'success',
      })
    },
    onError: (error) => {
      const description = error instanceof Error ? error.message : 'OrderCloud could not create the product setup.'
      toast({ title: 'Product setup failed', description, status: 'error' })
    },
  })
  const [form, setForm] = useState<RaiProductSetupForm>({
    name: 'Pizza', category: 'Food & Catering', vegetarianOnlyEventEligible: true, basePrice: '12.50', currency: 'EUR',
    sizes: ['Small', 'Medium', 'Large'], flavours: ['Margherita', 'Vegetarian', 'Pepperoni'], toppings: ['Olives', 'Mushrooms', 'Extra Cheese', 'Pepperoni', 'Ham'], eventWebsites: ['ISE 2026', 'RAI Catering Portal'],
  })
  const update = <K extends keyof RaiProductSetupForm>(key: K, value: RaiProductSetupForm[K]) => setForm((prev) => ({ ...prev, [key]: value }))
  const body = useMemo(() => {
    if (currentStep === 0) return <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}><FormControl><FormLabel>Product name</FormLabel><Input value={form.name} onChange={(e) => update('name', e.target.value)} /></FormControl><FormControl><FormLabel>Category</FormLabel><Input value={form.category} onChange={(e) => update('category', e.target.value)} /></FormControl><Checkbox isChecked={form.vegetarianOnlyEventEligible} onChange={(e) => update('vegetarianOnlyEventEligible', e.target.checked)}>Eligible for vegetarian-only events</Checkbox></SimpleGrid>
    if (currentStep === 1) return <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}><FormControl><FormLabel>Pricing tier</FormLabel><Input value={form.basePrice} onChange={(e) => update('basePrice', e.target.value)} /></FormControl><FormControl><FormLabel>Currency</FormLabel><Select value={form.currency} onChange={(e) => update('currency', e.target.value)}><option>EUR</option><option>USD</option><option>GBP</option></Select></FormControl></SimpleGrid>
    if (currentStep === 2) return <VStack align="stretch" spacing={5}><CheckboxGroup value={form.sizes} onChange={(v) => update('sizes', v as string[])}><FormLabel>Product options: size</FormLabel><HStack flexWrap="wrap"><Checkbox value="Small">Small</Checkbox><Checkbox value="Medium">Medium</Checkbox><Checkbox value="Large">Large</Checkbox></HStack></CheckboxGroup><CheckboxGroup value={form.flavours} onChange={(v) => update('flavours', v as string[])}><FormLabel>Product options: flavour</FormLabel><HStack flexWrap="wrap"><Checkbox value="Margherita">Margherita</Checkbox><Checkbox value="Vegetarian">Vegetarian</Checkbox><Checkbox value="Pepperoni">Pepperoni</Checkbox></HStack></CheckboxGroup><CheckboxGroup value={form.toppings} onChange={(v) => update('toppings', v as string[])}><FormLabel>Product options: toppings</FormLabel><HStack flexWrap="wrap">{['Olives', 'Mushrooms', 'Extra Cheese', 'Pepperoni', 'Ham'].map((item) => <Checkbox key={item} value={item}>{item}</Checkbox>)}</HStack></CheckboxGroup></VStack>
    if (currentStep === 3) return <CheckboxGroup value={form.eventWebsites} onChange={(v) => update('eventWebsites', v as string[])}><FormLabel>Product availability across event websites</FormLabel><Stack><Checkbox value="ISE 2026">ISE 2026</Checkbox><Checkbox value="RAI Catering Portal">RAI Catering Portal</Checkbox><Checkbox value="Interclean 2026">Interclean 2026</Checkbox><Checkbox value="Vegetarian-only Event">Vegetarian-only Event</Checkbox></Stack></CheckboxGroup>
    return <ProductReview form={form} result={result} />
  }, [currentStep, form, result])
  return <WizardShell title="Create Pizza Product Setup" description="Create Pizza once, configure product options, and publish it across the selected event websites." steps={steps} currentStep={currentStep} onBack={() => setCurrentStep((s) => Math.max(0, s - 1))} onNext={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))} onSubmit={() => productMutation.mutate(form)} isSubmitting={productMutation.isPending}>{body}</WizardShell>
}

export const RaiBuyerWizard: FC = () => {
  const toast = useToast()
  const steps = ['Select event', 'Exhibitor company', 'Buyer user', 'Access and pricing', 'Review']
  const [currentStep, setCurrentStep] = useState(0)
  const [result, setResult] = useState<RaiBuyerSetupResult>()
  const buyerMutation = useAuthMutation({
    mutationKey: ['rai-event-buyer-setup'],
    mutationFn: submitRaiBuyerSetup,
    onSuccess: (data) => {
      setResult(data)
      toast({ title: data.warnings.length ? `${form.companyName} is partly ready` : `${form.companyName} is ready`, description: 'The exhibitor buyer was created or updated.', status: data.warnings.length ? 'warning' : 'success' })
    },
    onError: (error) => {
      const description = error instanceof Error ? error.message : 'OrderCloud could not create the buyer setup.'
      toast({ title: 'Buyer setup failed', description, status: 'error' })
    },
  })
  const [form, setForm] = useState<RaiBuyerSetupForm>({ eventName: 'ISE 2026', companyName: 'Blue Ocean Exhibits', boothNumber: '12-A40', firstName: 'Alex', lastName: 'Demo', email: 'alex.demo@blue-ocean-exhibits.example', eventWebsites: ['ISE 2026'], productAccess: ['Food & Catering', 'Pizza'], pricingTier: 'ISE 2026 exhibitor pricing' })
  const update = <K extends keyof RaiBuyerSetupForm>(key: K, value: RaiBuyerSetupForm[K]) => setForm((prev) => ({ ...prev, [key]: value }))
  const body = useMemo(() => {
    if (currentStep === 0) return <FormControl><FormLabel>Event</FormLabel><Select value={form.eventName} onChange={(e) => update('eventName', e.target.value)}><option>ISE 2026</option><option>IBC 2026</option><option>Amsterdam Drone Week 2026</option></Select></FormControl>
    if (currentStep === 1) return <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}><FormControl><FormLabel>Exhibitor company</FormLabel><Input value={form.companyName} onChange={(e) => update('companyName', e.target.value)} /></FormControl><FormControl><FormLabel>Booth number</FormLabel><Input value={form.boothNumber} onChange={(e) => update('boothNumber', e.target.value)} /></FormControl></SimpleGrid>
    if (currentStep === 2) return <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}><FormControl><FormLabel>First name</FormLabel><Input value={form.firstName} onChange={(e) => update('firstName', e.target.value)} /></FormControl><FormControl><FormLabel>Last name</FormLabel><Input value={form.lastName} onChange={(e) => update('lastName', e.target.value)} /></FormControl><FormControl><FormLabel>Email</FormLabel><Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></FormControl></SimpleGrid>
    if (currentStep === 3) return <VStack align="stretch" spacing={5}><CheckboxGroup value={form.eventWebsites} onChange={(v) => update('eventWebsites', v as string[])}><FormLabel>Event website access</FormLabel><Stack><Checkbox value="ISE 2026">ISE 2026 event website</Checkbox><Checkbox value="RAI Catering Portal">RAI Catering Portal</Checkbox></Stack></CheckboxGroup><CheckboxGroup value={form.productAccess} onChange={(v) => update('productAccess', v as string[])}><FormLabel>Shopper access</FormLabel><HStack flexWrap="wrap"><Checkbox value="Food & Catering">Food & Catering</Checkbox><Checkbox value="Pizza">Pizza</Checkbox><Checkbox value="Furniture">Furniture</Checkbox></HStack></CheckboxGroup><FormControl><FormLabel>Pricing tier</FormLabel><Select value={form.pricingTier} onChange={(e) => update('pricingTier', e.target.value)}><option>ISE 2026 exhibitor pricing</option><option>Standard exhibitor pricing</option><option>Partner pricing</option></Select></FormControl></VStack>
    return <BuyerReview form={form} result={result} />
  }, [currentStep, form, result])
  return <WizardShell title="Register Exhibitor Buyer" description="Register an exhibitor for an event, add the buyer contact, and grant event website access with the right pricing tier." steps={steps} currentStep={currentStep} onBack={() => setCurrentStep((s) => Math.max(0, s - 1))} onNext={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))} onSubmit={() => buyerMutation.mutate(form)} isSubmitting={buyerMutation.isPending}>{body}</WizardShell>
}
