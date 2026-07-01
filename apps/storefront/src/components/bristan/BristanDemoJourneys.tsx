import {
  Badge,
  Box,
  Button,
  Container,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useOrderCloudContext } from "@ordercloud/react-sdk";
import { FC, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BRISTAN_DEMO_CATALOG_IDS,
  BRISTAN_DEMO_JOURNEY_ROUTES,
} from "./bristanDemoRoutes";

const DEMO_PASSWORD =
  import.meta.env.VITE_APP_BRISTAN_DEMO_PASSWORD || "BristanDemo123!";

interface BristanJourney {
  persona: string;
  story: string;
  username: string;
  buyerID: string;
  catalogID: string;
  targetRoute: string;
}

const journeys: BristanJourney[] = [
  {
    persona: "Installer / Spare Parts",
    story:
      "Accessories-only spare parts self-service for installers and builders who need to quickly identify Bristan replacement parts.",
    username: "bristan-demo-spares-user",
    buyerID: "bristan-demo-spares-buyer",
    catalogID: BRISTAN_DEMO_CATALOG_IDS.spares,
    targetRoute: BRISTAN_DEMO_JOURNEY_ROUTES.spares,
  },
  {
    persona: "Supplier Buying from Bristan - North Supplies",
    story:
      "Bulk buying from Bristan with supplier-specific quantity breaks for the North Supplies account.",
    username: "bristan-demo-supplier-north-buyer-user",
    buyerID: "bristan-demo-supplier-north-buyer",
    catalogID: BRISTAN_DEMO_CATALOG_IDS.supplierNorth,
    targetRoute: BRISTAN_DEMO_JOURNEY_ROUTES.supplierNorth,
  },
  {
    persona: "Supplier Buying from Bristan - South Supplies",
    story:
      "A second supplier buyer account that shows how account-specific pricing and future order history can differ by trading partner.",
    username: "bristan-demo-supplier-south-buyer-user",
    buyerID: "bristan-demo-supplier-south-buyer",
    catalogID: BRISTAN_DEMO_CATALOG_IDS.supplierSouth,
    targetRoute: BRISTAN_DEMO_JOURNEY_ROUTES.supplierSouth,
  },
  {
    persona: "Marketplace Buyer",
    story:
      "A normal buyer browsing Bristan-governed product data with supplier offers seeded for the next PDP comparison phase.",
    username: "bristan-demo-marketplace-user",
    buyerID: "bristan-demo-marketplace-buyer",
    catalogID: BRISTAN_DEMO_CATALOG_IDS.marketplace,
    targetRoute: BRISTAN_DEMO_JOURNEY_ROUTES.marketplace,
  },
];

const BristanDemoJourneys: FC = () => {
  const { isLoggedIn, login, logout } = useOrderCloudContext();
  const [activeUsername, setActiveUsername] = useState<string>();
  const toast = useToast();
  const navigate = useNavigate();

  const enterJourney = async (journey: BristanJourney) => {
    setActiveUsername(journey.username);
    try {
      if (isLoggedIn) await logout();
      await login(journey.username, DEMO_PASSWORD, false);
      toast({
        title: `Entered ${journey.persona}`,
        description: `Logged in as ${journey.username}.`,
        status: "success",
        duration: 3500,
        isClosable: true,
      });
      navigate(journey.targetRoute, { replace: true });
    } catch (error) {
      toast({
        title: "Could not enter demo journey",
        description:
          error instanceof Error
            ? error.message
            : "Check that the Bristan demo seed has been rerun with matching demo user passwords.",
        status: "error",
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setActiveUsername(undefined);
    }
  };

  return (
    <Container maxW="7xl" py={10}>
      <Stack spacing={4} mb={8}>
        <Badge alignSelf="flex-start" colorScheme="blue" fontSize="sm" px={3} py={1}>
          Bristan Marketplace Demo
        </Badge>
        <Heading as="h1" size="xl">
          Choose a Bristan buyer journey
        </Heading>
        <Text color="gray.600" maxW="3xl">
          Switch between sandbox buyer personas to demo installer spare-parts self-service,
          supplier bulk purchasing, and marketplace browsing without exposing admin or
          middleware credentials in the storefront.
        </Text>
      </Stack>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        {journeys.map((journey) => (
          <Box
            key={journey.username}
            borderWidth="1px"
            borderRadius="lg"
            p={6}
            bg="white"
            shadow="sm"
          >
            <Stack spacing={4} h="full">
              <Stack spacing={2} flex="1">
                <Heading as="h2" size="md">
                  {journey.persona}
                </Heading>
                <Text color="gray.700">{journey.story}</Text>
                <Box fontSize="sm" color="gray.600">
                  <Text>
                    <strong>Username:</strong> {journey.username}
                  </Text>
                  <Text>
                    <strong>Buyer:</strong> {journey.buyerID}
                  </Text>
                  <Text fontSize="xs" fontFamily="mono" color="gray.500">
                    Catalog: {journey.catalogID}
                  </Text>
                </Box>
              </Stack>
              <Button
                colorScheme="blue"
                onClick={() => enterJourney(journey)}
                isLoading={activeUsername === journey.username}
                loadingText="Switching buyer"
              >
                Enter as this buyer
              </Button>
            </Stack>
          </Box>
        ))}
      </SimpleGrid>
    </Container>
  );
};

export default BristanDemoJourneys;
