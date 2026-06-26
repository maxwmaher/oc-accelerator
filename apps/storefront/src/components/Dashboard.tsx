import {
  Badge,
  Box,
  Button,
  Container,
  Heading,
  Image,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FC } from "react";
import { Link as RouterLink } from "react-router-dom";
import defaultHeroImage from "../assets/default_images/default_hero_image.jpg";
import { DASHBOARD_HERO_IMAGE } from "../constants";

const contextCards = [
  {
    title: "Context-aware catalogue",
    body: "Assortment and recommendations adapt by event, hall, stand type, stand package, and delegated access context.",
  },
  {
    title: "Service details captured early",
    body: "Catering time slots, utility placement, stand-grid location, and supplier instructions are captured before checkout.",
  },
  {
    title: "Ready for Momentus handoff",
    body: "Submitted orders carry VAT, payment method, ExhibitorID, stand context, and line-level service attributes for downstream processing.",
  },
];

const serviceFeatures = [
  {
    title: "Power and sockets",
    body: "Capture placement, required-by timing, and technical contact details for electrical services.",
  },
  {
    title: "Catering",
    body: "Select delivery windows and stand contacts for food and beverage orders.",
  },
  {
    title: "Stand construction",
    body: "Configure raised flooring, ramp requirements, finishes, and build-up-sensitive services.",
  },
];

const Dashboard: FC = () => {
  return (
    <Container maxW="full" px={0}>
      <SimpleGrid gridTemplateColumns={{ base: "1fr", lg: "1fr 1fr" }}>
        <Stack
          direction="column"
          justifyContent="center"
          alignItems="flex-start"
          gap={6}
          px={{ base: 8, md: 12, lg: 24 }}
          py={{ base: 16, lg: 24 }}
          minH={{ base: "auto", lg: "75dvh" }}
        >
          <Badge colorScheme="blue" px={3} py={1} borderRadius="full">
            Mocked Momentus profile · OrderCloud storefront demo
          </Badge>
          <Heading maxW="xl" size="3xl" as="h1">
            DevWorld 2026 exhibitor services
          </Heading>
          <Text maxW="2xl" fontSize={{ base: "lg", md: "xl" }} fontWeight="semibold">
            Order the services your stand needs, at the right time, for the right hall, stand, and event phase.
          </Text>
          <Text maxW="2xl" color="gray.600">
            This demo shows an event-driven webshop experience for RAI Amsterdam exhibitors and stand builders. Catalogue visibility, ordering windows, required service details, payment terms, and supplier routing are shaped by the active Momentus profile context.
          </Text>
          <Stack direction={{ base: "column", sm: "row" }} gap={3} pt={2}>
            <Button as={RouterLink} to="/products" colorScheme="blue">
              Shop stand services
            </Button>
            <Button as={RouterLink} to="/orders" variant="outline" colorScheme="blue">
              Review my orders
            </Button>
          </Stack>
        </Stack>
        <Image
          h={{ base: "45dvh", lg: "75dvh" }}
          w="full"
          objectFit="cover"
          objectPosition="center center"
          src={DASHBOARD_HERO_IMAGE || defaultHeroImage}
          alt="RAI Amsterdam exhibitor services demo"
        />
      </SimpleGrid>

      <Box px={{ base: 8, md: 12, lg: 24 }} py={{ base: 10, lg: 12 }} bg="gray.50">
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={5}>
          {contextCards.map((card) => (
            <Stack key={card.title} gap={3} p={6} bg="white" borderRadius="lg" borderWidth="1px" h="full">
              <Heading as="h2" size="md">
                {card.title}
              </Heading>
              <Text color="gray.600">{card.body}</Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Box>

      <Stack px={{ base: 8, md: 12, lg: 24 }} py={{ base: 14, lg: 20 }} gap={8}>
        <Stack maxW="3xl" gap={4}>
          <Heading as="h2" size="xl">
            Everything exhibitors need to prepare their stand
          </Heading>
          <Text color="gray.600" fontSize="lg">
            Browse event services, choose the products that apply to your stand, and capture the operational details suppliers need before build-up begins.
          </Text>
        </Stack>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={5}>
          {serviceFeatures.map((feature) => (
            <Stack key={feature.title} gap={3} p={6} borderRadius="lg" borderWidth="1px" h="full">
              <Heading as="h3" size="md">
                {feature.title}
              </Heading>
              <Text color="gray.600">{feature.body}</Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Stack>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={0} bg="gray.900" color="white">
        <Stack px={{ base: 8, md: 12, lg: 24 }} py={{ base: 14, lg: 20 }} gap={4}>
          <Heading as="h2" size="xl">
            Built for exhibitors and stand builders
          </Heading>
          <Text color="gray.200" fontSize="lg">
            Stand builders can work inside the represented exhibitor’s stand context while preserving audit, delegation, and invoice attribution details.
          </Text>
        </Stack>
        <Stack px={{ base: 8, md: 12, lg: 16 }} py={{ base: 10, lg: 20 }} justifyContent="center">
          <Box borderWidth="1px" borderColor="whiteAlpha.300" borderRadius="lg" p={6} bg="whiteAlpha.100">
            <Text fontWeight="semibold">
              Demo scenario: Amsterdam Standbouw B.V. ordering on behalf of Northstar Exhibitions B.V. for DevWorld 2026.
            </Text>
          </Box>
        </Stack>
      </SimpleGrid>

      <Stack px={{ base: 8, md: 12, lg: 24 }} py={{ base: 14, lg: 20 }} gap={5} maxW="5xl">
        <Heading as="h2" size="xl">
          Designed around RAI’s operating model
        </Heading>
        <Text color="gray.600" fontSize="lg">
          OrderCloud manages the storefront, cart, order capture, and buyer experience. Momentus remains authoritative for event, account, stand, pricing, invoice, and supplier work-order data. The demo uses mocked Momentus and profile-service context to make the target integration flow visible.
        </Text>
        <Text color="gray.500" fontSize="sm">
          Demo-only: integrations, payment terms, event phases, and stand context are represented with realistic mocked data for the in-person demo.
        </Text>
      </Stack>
    </Container>
  );
};

export default Dashboard;
