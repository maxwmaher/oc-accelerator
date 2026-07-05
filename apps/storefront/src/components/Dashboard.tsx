import {
  Box,
  Button,
  Container,
  Heading,
  Image,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FC, useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";
import bristanLogo from "../assets/bristan/bristan-logo.png";
import hero1 from "../assets/bristan/hero1.jpg";
import hero2 from "../assets/bristan/hero2.jpg";
import hero3 from "../assets/bristan/hero3.jpg";
import { useCurrentUser } from "../hooks/currentUser";
import {
  BRISTAN_DEMO_CATALOG_IDS,
  getBristanDemoCategoriesRoute,
  getBristanDemoShopAllRoute,
} from "./bristan/bristanDemoRoutes";

const featureCards = [
  {
    image: hero1,
    title: "Spare parts self-service",
    body: "Help installers and builders identify the right Bristan accessories, spares, and product codes without calling support.",
  },
  {
    image: hero2,
    title: "Trade buying and bulk pricing",
    body: "Support trade merchant accounts with account-specific catalogs, minimum quantities, and quantity price breaks.",
  },
  {
    image: hero3,
    title: "Approved merchant marketplace",
    body: "Show Bristan-owned canonical product data with merchant-specific offers, availability, lead times, and merchant selection carried into the cart.",
  },
];

const Dashboard: FC = () => {
  const { data: user } = useCurrentUser();

  const { browseCategoriesRoute, shopAllProductsRoute } = useMemo(() => {
    const username = user?.Username;
    const bristanDemoCategoriesRoute = getBristanDemoCategoriesRoute(username);
    const bristanDemoShopAllRoute = getBristanDemoShopAllRoute(username);

    return {
      browseCategoriesRoute:
        bristanDemoCategoriesRoute ??
        `/shop/${BRISTAN_DEMO_CATALOG_IDS.marketplace}/categories`,
      shopAllProductsRoute: bristanDemoShopAllRoute ?? "/products",
    };
  }, [user?.Username]);

  return (
    <Box bg="gray.50">
      <Box
        bg="linear-gradient(135deg, #0c2d57 0%, #124574 48%, #edf7fb 48%, #edf7fb 100%)"
        color="white"
      >
        <Container
          maxW="container.2xl"
          px={{ base: 5, md: 10 }}
          py={{ base: 10, lg: 16 }}
        >
          <SimpleGrid
            columns={{ base: 1, lg: 2 }}
            gap={{ base: 10, lg: 14 }}
            alignItems="center"
          >
            <Stack spacing={7} align="flex-start" maxW="2xl">
              <Box bg="white" borderRadius="full" px={5} py={3} boxShadow="lg">
                <Image
                  src={bristanLogo}
                  alt="Bristan"
                  h={{ base: 8, md: 10 }}
                  objectFit="contain"
                />
              </Box>
              <Stack spacing={4}>
                <Text
                  color="cyan.100"
                  fontWeight="bold"
                  letterSpacing="0.12em"
                  textTransform="uppercase"
                >
                  Connected commerce demo marketplace
                </Text>
                <Heading
                  as="h1"
                  fontSize={{ base: "4xl", md: "5xl", xl: "6xl" }}
                  lineHeight="1.02"
                >
                  Find the right Bristan product faster
                </Heading>
                <Text
                  fontSize={{ base: "lg", md: "xl" }}
                  color="whiteAlpha.900"
                  maxW="xl"
                >
                  Explore Bristan-governed product data, spare-parts
                  self-service, trade buying, and approved merchant marketplace
                  journeys in one connected demo.
                </Text>
              </Stack>
              <Stack
                direction={{ base: "column", sm: "row" }}
                spacing={4}
                w={{ base: "full", sm: "auto" }}
              >
                <Button
                  as={RouterLink}
                  to={shopAllProductsRoute}
                  size="lg"
                  colorScheme="cyan"
                  color="blue.900"
                >
                  Shop all products
                </Button>
                <Button
                  as={RouterLink}
                  to={browseCategoriesRoute}
                  size="lg"
                  variant="outline"
                  borderColor="whiteAlpha.800"
                  color="white"
                  _hover={{ bg: "whiteAlpha.200" }}
                >
                  Browse categories
                </Button>
              </Stack>
            </Stack>

            <Box position="relative" minH={{ base: "360px", md: "520px" }}>
              <Image
                src={hero1}
                alt="Bristan bathroom products"
                position="absolute"
                inset={{ base: "0 0 auto 0", md: "0 auto auto 10%" }}
                w={{ base: "72%", md: "64%" }}
                h={{ base: "245px", md: "360px" }}
                objectFit="cover"
                borderRadius="3xl"
                boxShadow="2xl"
              />
              <Image
                src={hero2}
                alt="Bristan kitchen and washroom fittings"
                position="absolute"
                right={{ base: 0, md: 4 }}
                top={{ base: 24, md: 20 }}
                w={{ base: "58%", md: "52%" }}
                h={{ base: "220px", md: "320px" }}
                objectFit="cover"
                borderRadius="3xl"
                boxShadow="2xl"
                border="8px solid"
                borderColor="white"
              />
              <Image
                src={hero3}
                alt="Bristan shower and brassware range"
                position="absolute"
                left={{ base: 8, md: 0 }}
                bottom="0"
                w={{ base: "62%", md: "48%" }}
                h={{ base: "190px", md: "255px" }}
                objectFit="cover"
                borderRadius="3xl"
                boxShadow="2xl"
                border="8px solid"
                borderColor="white"
              />
            </Box>
          </SimpleGrid>
        </Container>
      </Box>

      <Container
        maxW="container.2xl"
        px={{ base: 5, md: 10 }}
        py={{ base: 10, lg: 16 }}
      >
        <Stack spacing={8}>
          <Stack spacing={3} maxW="3xl">
            <Text
              color="blue.600"
              fontWeight="bold"
              letterSpacing="0.12em"
              textTransform="uppercase"
            >
              Demo journeys
            </Text>
            <Heading color="gray.800" fontSize={{ base: "3xl", md: "4xl" }}>
              One Bristan experience for consumers, trade buyers, and approved
              merchants
            </Heading>
          </Stack>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
            {featureCards.map((feature) => (
              <Stack
                key={feature.title}
                bg="white"
                borderRadius="2xl"
                overflow="hidden"
                boxShadow="lg"
                border="1px solid"
                borderColor="gray.100"
                spacing={0}
              >
                <Image
                  src={feature.image}
                  alt={feature.title}
                  h="220px"
                  w="full"
                  objectFit="cover"
                />
                <Stack spacing={3} p={6}>
                  <Heading as="h2" size="md" color="gray.800">
                    {feature.title}
                  </Heading>
                  <Text color="gray.600">{feature.body}</Text>
                </Stack>
              </Stack>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
};

export default Dashboard;
