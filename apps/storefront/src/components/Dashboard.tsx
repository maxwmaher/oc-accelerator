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
import devWorldHeroImage from "../assets/rai_images/dev-world.png";

const contextCards = [
  {
    title: "Context-aware catalogue",
    body: "Assortment and recommendations adapt by event, hall, stand type, stand package, and delegated access.",
  },
  {
    title: "Operational details captured early",
    body: "Delivery windows, stand contacts, utility placement, grid location, and technical instructions are captured before checkout.",
  },
  {
    title: "Ready for Momentus handoff",
    body: "Submitted orders carry ExhibitorID, stand context, VAT, payment method, and line-level service attributes for downstream processing.",
  },
];

const serviceFeatures = [
  {
    title: "Power and sockets",
    body: "Capture placement, required-by timing, and technical contact details for electrical services.",
    cta: "Browse power services",
    link: "/shop/buyer/categories/rai-devworld-cat-power-sockets/products",
  },
  {
    title: "Catering",
    body: "Select delivery windows and stand contacts for food and beverage orders.",
    cta: "Browse catering",
    link: "/shop/buyer/categories/rai-devworld-cat-food-breakfast-catering/products",
  },
  {
    title: "Stand construction",
    body: "Configure raised flooring, ramp requirements, finishes, and build-up-sensitive services.",
    cta: "Browse stand construction",
    link: "/shop/buyer/categories/rai-devworld-cat-raised-flooring/products",
  },
];

const Dashboard: FC = () => {
  return (
    <Container maxW="full" px={0}>
      <SimpleGrid gridTemplateColumns={{ base: "1fr", lg: "1.08fr 0.92fr" }}>
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
            Order the stand services your team needs for the right event, hall, stand, and ordering phase.
          </Text>
          <Text maxW="2xl" color="gray.600">
            This demo shows a context-aware webshop for RAI Amsterdam exhibitors and stand builders. Catalogue visibility, service requirements, payment terms, VAT display, and supplier routing are shaped by the active event and stand context.
          </Text>
          <Stack direction={{ base: "column", sm: "row" }} gap={3} pt={2}>
            <Button as={RouterLink} to="/products" colorScheme="blue">
              Shop stand services
            </Button>
            <Button as={RouterLink} to="/orders" variant="outline" colorScheme="blue">
              Review my orders
            </Button>
          </Stack>
          <Box borderWidth="1px" borderColor="blue.100" bg="blue.50" borderRadius="lg" p={5} maxW="2xl">
            <Stack gap={2}>
              <Heading as="h2" size="sm" color="blue.900">
                Start with your stand context
              </Heading>
              <Text color="blue.900">
                Switch between exhibitor stands or delegated stand-builder access to see how the catalogue, order capture, and downstream handoff adapt.
              </Text>
            </Stack>
          </Box>
        </Stack>
        <Image
          h={{ base: "45dvh", lg: "75dvh" }}
          w="full"
          objectFit="cover"
          objectPosition="left center"
          src={devWorldHeroImage}
          alt="DevWorld 2026 exhibitor services"
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
            Browse event services, choose the products that apply to your stand, and capture the information suppliers need before build-up begins.
          </Text>
        </Stack>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={5}>
          {serviceFeatures.map((feature) => (
            <Stack key={feature.title} gap={4} p={6} borderRadius="lg" borderWidth="1px" h="full" alignItems="flex-start">
              <Heading as="h3" size="md">
                {feature.title}
              </Heading>
              <Text color="gray.600" flex="1">{feature.body}</Text>
              <Button as={RouterLink} to={feature.link} variant="link" colorScheme="blue">
                {feature.cta}
              </Button>
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
          OrderCloud manages the storefront, cart, order capture, and buyer experience. Momentus remains authoritative for event, account, stand, pricing phase, invoice, and supplier work-order data. This demo uses mocked Momentus and profile-service context to make the target integration flow visible.
        </Text>
        <Text color="gray.500" fontSize="sm">
          Demo-only: integrations, payment terms, event phases, and stand context are represented with realistic mocked data for the in-person demo.
        </Text>
      </Stack>
    </Container>
  );
};

export default Dashboard;
