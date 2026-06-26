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
] as const;

const productSetupExamples = [
  {
    name: "Additional sockets",
    details: [
      "Available through build-up",
      "Requires stand grid placement",
      "Supplier route: Electrical services",
    ],
  },
  {
    name: "Croissant in a bag",
    details: [
      "Available in standard ordering",
      "Requires delivery time slot",
      "Supplier route: Catering operations",
    ],
  },
  {
    name: "Raised stand floor",
    details: [
      "Deadline-sensitive",
      "Requires stand area and finish selection",
      "Supplier route: Stand construction",
    ],
  },
] as const;

const EventConfiguration: FC = () => {
  return (
    <Box bg="gray.50" minH="calc(100vh - 3rem)" py={{ base: 6, md: 10 }}>
      <Container maxW="7xl">
        <Stack spacing={8}>
          <Stack spacing={2}>
            <Badge alignSelf="start" colorScheme="purple" variant="subtle">
              Read-only RAI demo
            </Badge>
            <Heading as="h1" size="2xl">
              Event configuration
            </Heading>
            <Text color="gray.600" maxW="3xl">
              A business-user view for understanding and safely managing reused
              webshop setup with event-specific overrides.
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
                    DevWorld 2026 webshop setup
                  </Heading>
                  <HStack spacing={2} flexWrap="wrap">
                    <Badge colorScheme="purple">Draft configuration</Badge>
                    <Badge colorScheme="blue" variant="outline">
                      Mocked Momentus event configuration
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
                      RAI Exhibitor Services Master Template
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="bold">
                      Status
                    </Text>
                    <Text fontWeight="semibold">Draft configuration</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="bold">
                      Source
                    </Text>
                    <Text fontWeight="semibold">
                      Mocked Momentus event configuration
                    </Text>
                  </Box>
                </SimpleGrid>
              </Flex>
            </CardBody>
          </Card>

          <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6}>
            <Card>
              <CardBody>
                <Stack spacing={5}>
                  <Flex justify="space-between" gap={3} align="start">
                    <Heading as="h2" size="md">
                      Template reuse
                    </Heading>
                    <Badge colorScheme="green">Business user configurable</Badge>
                  </Flex>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Stat p={4} bg="green.50" borderRadius="lg">
                      <StatLabel>Shared global configuration</StatLabel>
                      <StatNumber>90%</StatNumber>
                      <StatHelpText>Reused defaults</StatHelpText>
                    </Stat>
                    <Stat p={4} bg="orange.50" borderRadius="lg">
                      <StatLabel>Event-specific overrides</StatLabel>
                      <StatNumber>10%</StatNumber>
                      <StatHelpText>Safe local changes</StatHelpText>
                    </Stat>
                  </SimpleGrid>
                  <Text>
                    <Text as="span" fontWeight="bold">
                      Reused from:
                    </Text>{" "}
                    DevWorld 2025
                  </Text>
                </Stack>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Stack spacing={4}>
                  <Heading as="h2" size="md">
                    Content overrides
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Box p={4} bg="white" borderWidth="1px" borderRadius="lg">
                      <Text fontSize="sm" color="gray.500">Shared page</Text>
                      <Text fontWeight="semibold">Hotel services</Text>
                    </Box>
                    <Box p={4} bg="purple.50" borderWidth="1px" borderRadius="lg">
                      <Text fontSize="sm" color="gray.500">Event override</Text>
                      <Text fontWeight="semibold">DevWorld partner hotels</Text>
                    </Box>
                    <Box p={4} bg="white" borderWidth="1px" borderRadius="lg">
                      <Text fontSize="sm" color="gray.500">Shared product content</Text>
                      <Text fontWeight="semibold">Base descriptions and images</Text>
                    </Box>
                    <Box p={4} bg="purple.50" borderWidth="1px" borderRadius="lg">
                      <Text fontSize="sm" color="gray.500">Event override</Text>
                      <Text fontWeight="semibold">
                        Deadline messaging and availability notes
                      </Text>
                    </Box>
                  </SimpleGrid>
                </Stack>
              </CardBody>
            </Card>
          </SimpleGrid>

          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Heading as="h2" size="md">
                  Ordering phases
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} spacing={4}>
                  {orderingPhases.map(([name, start, end]) => (
                    <Box key={name} p={4} bg="white" borderWidth="1px" borderRadius="lg">
                      <Text fontWeight="bold">{name}</Text>
                      <Text color="gray.600" fontSize="sm">
                        {start} to {end}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
              </Stack>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Flex justify="space-between" gap={3} align="start" flexWrap="wrap">
                  <Heading as="h2" size="md">
                    Visibility rules
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
                      <Text color="gray.600" maxW="3xl">{rule}</Text>
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
                  Product setup examples
                </Heading>
                <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
                  {productSetupExamples.map((product) => (
                    <Box key={product.name} p={5} bg="white" borderWidth="1px" borderRadius="xl">
                      <Heading as="h3" size="sm" mb={3}>{product.name}</Heading>
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

          <Box p={5} bg="purple.50" borderWidth="1px" borderColor="purple.100" borderRadius="xl">
            <Text color="purple.900" fontSize="sm">
              Demo-only view: production would sync event, pricing phase,
              account, stand, and resource data from Momentus. Business users
              would manage safe configuration fields while integrations enforce
              authoritative rules.
            </Text>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
};

export default EventConfiguration;
