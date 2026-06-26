import {
  Badge,
  Box,
  Card,
  CardBody,
  Container,
  Divider,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Text,
} from "@chakra-ui/react";
import { FC } from "react";

const orderingPhases = [
  ["Early bird ordering", "2026-05-01", "2026-07-31"],
  ["Standard ordering", "2026-08-01", "2026-08-31"],
  ["Late ordering", "2026-09-01", "2026-10-07"],
  ["Build-up ordering", "2026-10-08", "2026-10-11"],
  ["Event ordering", "2026-10-12", "2026-10-15"],
] as const;

const visibilityRules = [
  ["Hall 8 · Space only", "Power, sockets, raised floor, placement services"],
  ["Hall 10 · Standard booth", "Catering, additional sockets, booth services"],
  ["Stand builder delegated access", "Represented exhibitor catalogue view"],
  [
    "Pavilion-ready rule placeholder",
    "Future hall/pavilion supplier segmentation",
  ],
] as const;

const productServiceRules = [
  {
    name: "Additional sockets",
    details: [
      "Available through build-up",
      "Requires stand grid placement",
      "Required fields: grid location, required by, technical contact phone",
      "Supplier route: Electrical services",
    ],
  },
  {
    name: "Croissant in a bag",
    details: [
      "Available in standard ordering",
      "Requires delivery date, time slot, stand contact",
      "Supplier route: Catering operations",
    ],
  },
  {
    name: "Raised stand floor",
    details: [
      "Deadline-sensitive",
      "Requires stand area, ramp, floor finish",
      "Supplier route: Stand construction",
    ],
  },
] as const;

const routingSteps = [
  "Webshop captures complete order and line-level service attributes",
  "Middleware receives OrderCloud order payload",
  "Momentus creates invoice and supplier work orders",
  "Supplier routing comes from Momentus resource mapping and RAI operations queues",
  "Supplier mappings can vary by event/hall/resource",
] as const;

const commerceAuthorities = [
  [
    "Momentus",
    "Events, stands, accounts/exhibitors, pricing phases, invoices, supplier work orders",
  ],
  [
    "OrderCloud",
    "Cart, order capture, catalogue experience, buyer/storefront APIs",
  ],
  [
    "Webshop enrichment",
    "Product descriptions, images, service-field UX, guided ordering",
  ],
  [
    "Keycloak/profile service",
    "User identity, event/stand context, delegated access",
  ],
] as const;

const EventCommerceSetup: FC = () => {
  return (
    <Box bg="gray.50" minH="calc(100vh - 3rem)" py={{ base: 6, md: 10 }}>
      <Container maxW="7xl">
        <Stack spacing={8}>
          <Stack spacing={2}>
            <Badge alignSelf="start" colorScheme="purple" variant="subtle">
              Read-only RAI demo
            </Badge>
            <Heading as="h1" size="2xl">
              Event commerce setup
            </Heading>
            <Text color="gray.600" maxW="3xl">
              A commerce-operations view for safely configuring event webshop
              behavior through reusable templates, Momentus-driven rules, and
              event-specific operational overrides.
            </Text>
          </Stack>

          <Card borderTop="6px solid" borderColor="purple.500" shadow="md">
            <CardBody>
              <Flex
                direction={{ base: "column", lg: "row" }}
                justify="space-between"
                gap={6}
              >
                <Stack spacing={3}>
                  <Heading as="h2" size="lg">
                    DevWorld 2026 commerce setup
                  </Heading>
                  <HStack spacing={2} flexWrap="wrap">
                    <Badge colorScheme="green">
                      Business user configurable
                    </Badge>
                    <Badge colorScheme="purple" variant="subtle">
                      Draft commerce configuration
                    </Badge>
                    <Badge colorScheme="blue" variant="outline">
                      Mocked Momentus event/resource configuration
                    </Badge>
                  </HStack>
                </Stack>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} minW="md">
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="bold">
                      EventID
                    </Text>
                    <Text fontWeight="semibold">DEVWORLD-2026</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="bold">
                      Template
                    </Text>
                    <Text fontWeight="semibold">
                      RAI Exhibitor Services Commerce Template
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="bold">
                      Status
                    </Text>
                    <Text fontWeight="semibold">
                      Draft commerce configuration
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="bold">
                      Source
                    </Text>
                    <Text fontWeight="semibold">
                      Mocked Momentus event/resource configuration
                    </Text>
                  </Box>
                </SimpleGrid>
              </Flex>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stack spacing={5}>
                <Heading as="h2" size="md">
                  Template reuse for commerce configuration
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Stat p={5} bg="green.50" borderRadius="lg">
                    <StatLabel>Reused commerce setup</StatLabel>
                    <StatNumber>90%</StatNumber>
                    <StatHelpText>Template defaults reused</StatHelpText>
                  </Stat>
                  <Stat p={5} bg="orange.50" borderRadius="lg">
                    <StatLabel>Event-specific overrides</StatLabel>
                    <StatNumber>10%</StatNumber>
                    <StatHelpText>Controlled operational changes</StatHelpText>
                  </Stat>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
                  <Box p={4} bg="white" borderWidth="1px" borderRadius="lg">
                    <Text fontSize="sm" color="gray.500">
                      Reused commerce baseline
                    </Text>
                    <Text fontWeight="semibold">DevWorld 2025</Text>
                  </Box>
                  <Box p={4} bg="white" borderWidth="1px" borderRadius="lg">
                    <Text fontSize="sm" color="gray.500">
                      Shared commerce setup
                    </Text>
                    <Text fontWeight="semibold">
                      Catalogue structure, product groups, service-field
                      templates, supplier routes
                    </Text>
                  </Box>
                  <Box p={4} bg="white" borderWidth="1px" borderRadius="lg">
                    <Text fontSize="sm" color="gray.500">
                      Event overrides
                    </Text>
                    <Text fontWeight="semibold">
                      Pricing dates, availability windows, hall visibility,
                      supplier mapping
                    </Text>
                  </Box>
                </SimpleGrid>
              </Stack>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Heading as="h2" size="md">
                  Ordering and pricing phases
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} spacing={4}>
                  {orderingPhases.map(([name, start, end]) => (
                    <Box
                      key={name}
                      p={4}
                      bg="white"
                      borderWidth="1px"
                      borderRadius="lg"
                    >
                      <Text fontWeight="bold">{name}</Text>
                      <Text color="gray.600" fontSize="sm">
                        {start} to {end}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
                <Text color="gray.600" fontSize="sm">
                  Pricing phases are event-relative and sourced from Momentus.
                  The webshop displays/enforces the active tier without becoming
                  the pricing authority.
                </Text>
              </Stack>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Flex
                  justify="space-between"
                  gap={3}
                  align="start"
                  flexWrap="wrap"
                >
                  <Heading as="h2" size="md">
                    Assortment visibility rules
                  </Heading>
                  <Badge colorScheme="blue" variant="subtle">
                    Mocked Momentus visibility rules
                  </Badge>
                </Flex>
                <Stack divider={<Divider />} spacing={0}>
                  {visibilityRules.map(([audience, rule]) => (
                    <Flex
                      key={audience}
                      direction={{ base: "column", md: "row" }}
                      justify="space-between"
                      gap={3}
                      py={4}
                    >
                      <Text fontWeight="bold">{audience}</Text>
                      <Text color="gray.600" maxW="3xl">
                        {rule}
                      </Text>
                    </Flex>
                  ))}
                </Stack>
              </Stack>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Heading as="h2" size="md">
                  Product service rules
                </Heading>
                <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
                  {productServiceRules.map((product) => (
                    <Box
                      key={product.name}
                      p={5}
                      bg="white"
                      borderWidth="1px"
                      borderRadius="xl"
                    >
                      <Heading as="h3" size="sm" mb={3}>
                        {product.name}
                      </Heading>
                      <Stack spacing={2}>
                        {product.details.map((detail) => (
                          <Text key={detail} color="gray.600" fontSize="sm">
                            • {detail}
                          </Text>
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </SimpleGrid>
              </Stack>
            </CardBody>
          </Card>

          <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6}>
            <Card>
              <CardBody>
                <Stack spacing={4}>
                  <Heading as="h2" size="md">
                    Supplier and work-order routing
                  </Heading>
                  <Stack divider={<Divider />} spacing={0}>
                    {routingSteps.map((step) => (
                      <Text key={step} py={3} color="gray.700">
                        • {step}
                      </Text>
                    ))}
                  </Stack>
                </Stack>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Stack spacing={4}>
                  <Heading as="h2" size="md">
                    Commerce data authority
                  </Heading>
                  <Stack divider={<Divider />} spacing={0}>
                    {commerceAuthorities.map(([system, scope]) => (
                      <Box key={system} py={3}>
                        <Text fontWeight="bold">{system}</Text>
                        <Text color="gray.600" fontSize="sm">
                          {scope}
                        </Text>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              </CardBody>
            </Card>
          </SimpleGrid>

          <Box
            p={5}
            bg="purple.50"
            borderWidth="1px"
            borderColor="purple.100"
            borderRadius="xl"
          >
            <Text color="purple.900" fontSize="sm">
              Demo-only view: production would sync event, pricing phase,
              account, stand, resource, and supplier data from Momentus.
              Business users would manage safe commerce configuration while
              authoritative rules remain enforced through integrations.
            </Text>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
};

export default EventCommerceSetup;
