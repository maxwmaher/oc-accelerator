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
  useToast,
} from '@chakra-ui/react'
import { FC, ReactNode, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { submitRaiBuyerSetup, submitRaiProductSetup } from './raiEventSetupService'
import { RaiBuyerSetupForm, RaiProductSetupForm } from './types'

interface WizardShellProps {
  title: string
  description: string
  steps: string[]
  currentStep: number
  children: ReactNode
  onBack: () => void
  onNext: () => void
  onSubmit: () => void
}

const WizardShell: FC<WizardShellProps> = ({ title, description, steps, currentStep, children, onBack, onNext, onSubmit }) => {
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
              <Button onClick={onBack} isDisabled={currentStep === 0} variant="outline">
                Previous
              </Button>
              <Button colorScheme="blue" onClick={isReviewStep ? onSubmit : onNext}>
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

const ProductReview: FC<{ form: RaiProductSetupForm }> = ({ form }) => (
  <Stack spacing={5}>
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
      <SummaryRow label="Product" value={`${form.name} · ${form.category}`} />
      <SummaryRow label="Pricing for this event" value={`${form.currency} ${form.basePrice}`} />
      <SummaryRow label="Vegetarian-only event eligible" value={form.vegetarianOnlyEventEligible ? 'Yes' : 'No'} />
      <SummaryRow label="Product availability" value={optionList(form.eventWebsites)} />
      <SummaryRow label="Sizes" value={optionList(form.sizes)} />
      <SummaryRow label="Flavours" value={optionList(form.flavours)} />
      <SummaryRow label="Toppings" value={optionList(form.toppings)} />
    </SimpleGrid>
    <TechnicalDetails items={['Product', 'Extended properties / XP', 'Price schedule', 'Product options/specs', 'Event website/catalog assignments']} />
  </Stack>
)

const BuyerReview: FC<{ form: RaiBuyerSetupForm }> = ({ form }) => (
  <Stack spacing={5}>
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
      <SummaryRow label="Event" value={form.eventName} />
      <SummaryRow label="Exhibitor company" value={`${form.companyName} · Booth ${form.boothNumber}`} />
      <SummaryRow label="Buyer user" value={`${form.firstName} ${form.lastName} · ${form.email}`} />
      <SummaryRow label="Exhibitor access" value={optionList(form.eventWebsites)} />
      <SummaryRow label="Products" value={optionList(form.productAccess)} />
      <SummaryRow label="Pricing for this event" value={form.pricingTier} />
    </SimpleGrid>
    <TechnicalDetails items={['Buyer organization', 'Buyer user', 'Event website/catalog access', 'Product access', 'Pricing access']} />
  </Stack>
)

const TechnicalDetails: FC<{ items: string[] }> = ({ items }) => (
  <Accordion allowToggle>
    <AccordionItem>
      <AccordionButton>
        <Box as="span" flex="1" textAlign="left" fontWeight="semibold">
          What will happen in OrderCloud?
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
  const [form, setForm] = useState<RaiProductSetupForm>({
    name: 'Pizza', category: 'Food & Catering', vegetarianOnlyEventEligible: true, basePrice: '12.50', currency: 'EUR',
    sizes: ['Small', 'Medium', 'Large'], flavours: ['Margherita', 'Vegetarian', 'Pepperoni'], toppings: ['Olives', 'Mushrooms', 'Extra Cheese', 'Pepperoni', 'Ham'], eventWebsites: ['ISE 2026', 'RAI Catering Portal'],
  })
  const update = <K extends keyof RaiProductSetupForm>(key: K, value: RaiProductSetupForm[K]) => setForm((prev) => ({ ...prev, [key]: value }))
  const body = useMemo(() => {
    if (currentStep === 0) return <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}><FormControl><FormLabel>Product name</FormLabel><Input value={form.name} onChange={(e) => update('name', e.target.value)} /></FormControl><FormControl><FormLabel>Category</FormLabel><Input value={form.category} onChange={(e) => update('category', e.target.value)} /></FormControl><Checkbox isChecked={form.vegetarianOnlyEventEligible} onChange={(e) => update('vegetarianOnlyEventEligible', e.target.checked)}>Vegetarian-only event eligible</Checkbox></SimpleGrid>
    if (currentStep === 1) return <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}><FormControl><FormLabel>Pricing for this event</FormLabel><Input value={form.basePrice} onChange={(e) => update('basePrice', e.target.value)} /></FormControl><FormControl><FormLabel>Currency</FormLabel><Select value={form.currency} onChange={(e) => update('currency', e.target.value)}><option>EUR</option><option>USD</option><option>GBP</option></Select></FormControl></SimpleGrid>
    if (currentStep === 2) return <VStack align="stretch" spacing={5}><CheckboxGroup value={form.sizes} onChange={(v) => update('sizes', v as string[])}><FormLabel>Sizes</FormLabel><HStack flexWrap="wrap"><Checkbox value="Small">Small</Checkbox><Checkbox value="Medium">Medium</Checkbox><Checkbox value="Large">Large</Checkbox></HStack></CheckboxGroup><CheckboxGroup value={form.flavours} onChange={(v) => update('flavours', v as string[])}><FormLabel>Flavours</FormLabel><HStack flexWrap="wrap"><Checkbox value="Margherita">Margherita</Checkbox><Checkbox value="Vegetarian">Vegetarian</Checkbox><Checkbox value="Pepperoni">Pepperoni</Checkbox></HStack></CheckboxGroup><CheckboxGroup value={form.toppings} onChange={(v) => update('toppings', v as string[])}><FormLabel>Toppings</FormLabel><HStack flexWrap="wrap">{['Olives', 'Mushrooms', 'Extra Cheese', 'Pepperoni', 'Ham'].map((item) => <Checkbox key={item} value={item}>{item}</Checkbox>)}</HStack></CheckboxGroup></VStack>
    if (currentStep === 3) return <CheckboxGroup value={form.eventWebsites} onChange={(v) => update('eventWebsites', v as string[])}><FormLabel>Product availability across event websites</FormLabel><Stack><Checkbox value="ISE 2026">ISE 2026</Checkbox><Checkbox value="RAI Catering Portal">RAI Catering Portal</Checkbox><Checkbox value="Amsterdam Events Marketplace">Amsterdam Events Marketplace</Checkbox></Stack></CheckboxGroup>
    return <ProductReview form={form} />
  }, [currentStep, form])
  return <WizardShell title="Create Event Product" description="Create a reusable event product and choose where it should be available." steps={steps} currentStep={currentStep} onBack={() => setCurrentStep((s) => Math.max(0, s - 1))} onNext={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))} onSubmit={async () => { await submitRaiProductSetup(form); toast({ title: 'Demo product setup ready', description: 'Phase 2 will connect this guided flow to OrderCloud writes.', status: 'success' }) }}>{body}</WizardShell>
}

export const RaiBuyerWizard: FC = () => {
  const toast = useToast()
  const steps = ['Select event', 'Exhibitor company', 'Buyer user', 'Access and pricing', 'Review']
  const [currentStep, setCurrentStep] = useState(0)
  const [form, setForm] = useState<RaiBuyerSetupForm>({ eventName: 'ISE 2026', companyName: 'Blue Ocean Exhibits', boothNumber: '12-A40', firstName: 'Alex', lastName: 'Demo', email: 'alex.demo@blue-ocean-exhibits.example', eventWebsites: ['ISE 2026'], productAccess: ['Food & Catering', 'Pizza'], pricingTier: 'ISE 2026 exhibitor pricing' })
  const update = <K extends keyof RaiBuyerSetupForm>(key: K, value: RaiBuyerSetupForm[K]) => setForm((prev) => ({ ...prev, [key]: value }))
  const body = useMemo(() => {
    if (currentStep === 0) return <FormControl><FormLabel>Event</FormLabel><Select value={form.eventName} onChange={(e) => update('eventName', e.target.value)}><option>ISE 2026</option><option>IBC 2026</option><option>Amsterdam Drone Week 2026</option></Select></FormControl>
    if (currentStep === 1) return <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}><FormControl><FormLabel>Company</FormLabel><Input value={form.companyName} onChange={(e) => update('companyName', e.target.value)} /></FormControl><FormControl><FormLabel>Booth</FormLabel><Input value={form.boothNumber} onChange={(e) => update('boothNumber', e.target.value)} /></FormControl></SimpleGrid>
    if (currentStep === 2) return <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}><FormControl><FormLabel>First name</FormLabel><Input value={form.firstName} onChange={(e) => update('firstName', e.target.value)} /></FormControl><FormControl><FormLabel>Last name</FormLabel><Input value={form.lastName} onChange={(e) => update('lastName', e.target.value)} /></FormControl><FormControl><FormLabel>Email</FormLabel><Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></FormControl></SimpleGrid>
    if (currentStep === 3) return <VStack align="stretch" spacing={5}><CheckboxGroup value={form.eventWebsites} onChange={(v) => update('eventWebsites', v as string[])}><FormLabel>Exhibitor access</FormLabel><Stack><Checkbox value="ISE 2026">ISE 2026 event website</Checkbox><Checkbox value="RAI Catering Portal">RAI Catering Portal</Checkbox></Stack></CheckboxGroup><CheckboxGroup value={form.productAccess} onChange={(v) => update('productAccess', v as string[])}><FormLabel>Product access</FormLabel><HStack flexWrap="wrap"><Checkbox value="Food & Catering">Food & Catering</Checkbox><Checkbox value="Pizza">Pizza</Checkbox><Checkbox value="Furniture">Furniture</Checkbox></HStack></CheckboxGroup><FormControl><FormLabel>Pricing for this event</FormLabel><Select value={form.pricingTier} onChange={(e) => update('pricingTier', e.target.value)}><option>ISE 2026 exhibitor pricing</option><option>Standard exhibitor pricing</option><option>Partner pricing</option></Select></FormControl></VStack>
    return <BuyerReview form={form} />
  }, [currentStep, form])
  return <WizardShell title="Register Exhibitor Buyer" description="Register an exhibitor buyer and give them the event access they need." steps={steps} currentStep={currentStep} onBack={() => setCurrentStep((s) => Math.max(0, s - 1))} onNext={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))} onSubmit={async () => { await submitRaiBuyerSetup(form); toast({ title: 'Demo buyer setup ready', description: 'Phase 2 will connect this guided flow to OrderCloud writes.', status: 'success' }) }}>{body}</WizardShell>
}
