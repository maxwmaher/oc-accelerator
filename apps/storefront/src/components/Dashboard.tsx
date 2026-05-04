import {
  Badge,
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Icon,
  Image,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FC } from "react";
import { IconType } from "react-icons";
import { FiClipboard, FiRefreshCcw, FiTool, FiTruck } from "react-icons/fi";
import { Link as RouterLink } from "react-router-dom";
import defaultHeroImage from "../assets/default_images/default_hero_image.jpg";
import {
  DASHBOARD_HERO_IMAGE,
  DASHBOARD_SECONDARY_IMAGE,
  DASHBOARD_TERTIARY_IMAGE,
} from "../constants";

import defaultImage1 from "../assets/default_images/default_image_1.jpg";
import defaultImage2 from "../assets/default_images/default_image_2.jpg";
import defaultImage3 from "../assets/default_images/default_image_3.jpg";
import defaultImage4 from "../assets/default_images/default_image_4.jpg";
import defaultImage5 from "../assets/default_images/default_image_5.jpg";
import defaultImage6 from "../assets/default_images/default_image_6.jpg";
import defaultImage7 from "../assets/default_images/default_image_7.jpg";
import defaultImage8 from "../assets/default_images/default_image_8.jpg";

const defaultImages = [
  defaultImage1,
  defaultImage2,
  defaultImage3,
  defaultImage4,
  defaultImage5,
  defaultImage6,
  defaultImage7,
  defaultImage8,
];

type Insight = {
  title: string;
  description: string;
  icon: IconType;
};

const featuredCategories = [
  { title: "Engine & Driveline", description: "Core components to support performance and reliability." },
  { title: "Brakes & Wheel End", description: "Key parts for service, safety, and control." },
  { title: "Electrical & Lighting", description: "Lighting, connectors, and electrical essentials." },
  { title: "Filters & Service Kits", description: "Routine maintenance items in one place." },
  { title: "Cab & Interior", description: "Interior replacement items and driver-area essentials." },
  { title: "Workshop Supplies", description: "Everyday shop needs for efficient service operations." },
  { title: "Safety & Visibility", description: "Products that support safer working and driving conditions." },
  { title: "Power Solutions Components", description: "Support items for industrial and power applications." },
];

const portalInsights: Insight[] = [
  {
    title: "Faster ordering for common parts",
    description: "Save time with quick access to frequently purchased service and replacement items.",
    icon: FiRefreshCcw,
  },
  {
    title: "Better support for planned maintenance",
    description: "Align parts purchasing with service schedules to keep workshop flow consistent.",
    icon: FiTool,
  },
  {
    title: "Improved visibility for repeat purchasing",
    description: "Use order history and account context to simplify recurring procurement decisions.",
    icon: FiClipboard,
  },
  {
    title: "Built for fleet and workshop teams",
    description: "Support technicians, buyers, and operations stakeholders in one storefront experience.",
    icon: FiTruck,
  },
];

const ScaniaPortalMark: FC = () => (
  <HStack spacing={3} align="center">
    <Box aria-hidden="true">
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="46" height="46" rx="12" fill="#0B2441" />
        <path d="M13 33C17 27 21 24 26 24C31 24 35 27 39 33" stroke="#9DB4C8" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M15 36H37" stroke="#D2DEE8" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 19L26 15L30 19" stroke="#D2DEE8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Box>
    <Stack spacing={0}>
      <Text fontSize="xs" letterSpacing="0.12em" color="gray.500" fontWeight="semibold">
        CUSTOMER PORTAL DEMO
      </Text>
      <Text fontSize="xl" fontWeight="bold" color="#0B2441" letterSpacing="0.08em">
        SCANIA
      </Text>
    </Stack>
  </HStack>
);

const Dashboard: FC = () => {
  const getDefaultImage = () => {
    const randomIndex = Math.floor(Math.random() * defaultImages.length);
    return defaultImages[randomIndex];
  };

  return (
    <Container maxW="full" p={0}>
      <SimpleGrid gridTemplateColumns={{ lg: "1fr 1.2fr" }} bg="gray.50">
        <Stack justifyContent="center" alignItems="flex-start" gap={6} px={{ base: 8, md: 12, lg: 20 }} py={{ base: 12, lg: 16 }}>
          <ScaniaPortalMark />
          <Badge colorScheme="blue" variant="subtle" px={3} py={1} borderRadius="full">
            Scania Customer Portal / SPO
          </Badge>
          <Heading maxW={{ lg: "lg" }} size="3xl" as="h1" color="gray.800">
            Keep your fleet moving
          </Heading>
          <Text maxW="2xl" color="gray.600" fontSize="lg">
            Welcome to the Scania Customer Portal demo — a streamlined storefront experience for parts, maintenance needs, and operational support.
            Browse key categories, place orders, and help keep vehicles, workshops, and teams moving efficiently.
          </Text>
          <HStack spacing={4} pt={2}>
            <Button as={RouterLink} to="/products" colorScheme="blue" size="md">
              Shop parts
            </Button>
            <Button as={RouterLink} to="/orders" variant="outline" colorScheme="blue" size="md">
              View orders
            </Button>
          </HStack>
        </Stack>
        <Image h={{ base: "45vh", lg: "72vh" }} w="full" objectFit="cover" src={DASHBOARD_HERO_IMAGE || defaultHeroImage} alt="Fleet operations hero placeholder" />
      </SimpleGrid>

      <SimpleGrid gridTemplateColumns={{ lg: "1fr 1fr" }}>
        <Image h={{ base: "38vh", lg: "62vh" }} w="full" objectFit="cover" src={DASHBOARD_SECONDARY_IMAGE || getDefaultImage()} alt="Workshop essentials placeholder" />
        <Stack justifyContent="center" alignItems="flex-start" gap={5} px={{ base: 8, md: 12, lg: 16 }} py={{ base: 10, lg: 14 }}>
          <Heading size="xl">Workshop-ready essentials</Heading>
          <Text color="gray.600" maxW="xl">
            From service kits and filters to electrical components and brake-related parts, quickly access the items your team needs to support
            routine maintenance and day-to-day workshop operations.
          </Text>
          <Button as={RouterLink} to="/products" variant="outline" colorScheme="blue">Browse maintenance parts</Button>
        </Stack>
      </SimpleGrid>

      <SimpleGrid gridTemplateColumns={{ lg: "1fr 1fr" }}>
        <Stack justifyContent="center" alignItems="flex-start" gap={5} px={{ base: 8, md: 12, lg: 16 }} py={{ base: 10, lg: 14 }}>
          <Heading size="xl">Built for fleet uptime</Heading>
          <Text color="gray.600" maxW="xl">
            Support planned maintenance, simplify repeat ordering, and help reduce downtime with a storefront experience designed for fleet,
            workshop, and procurement teams.
          </Text>
          <Button as={RouterLink} to="/products" variant="outline" colorScheme="blue">Explore fleet solutions</Button>
        </Stack>
        <Image h={{ base: "38vh", lg: "62vh" }} w="full" objectFit="cover" src={DASHBOARD_TERTIARY_IMAGE || getDefaultImage()} alt="Fleet uptime placeholder" />
      </SimpleGrid>

      <Stack spacing={8} px={{ base: 8, md: 12, lg: 16 }} py={{ base: 12, lg: 16 }} bg="white">
        <Stack spacing={3}>
          <Heading size="lg">Connected support for modern operations</Heading>
          <Text color="gray.600" maxW="4xl">
            Bring together parts purchasing, order visibility, and operational support in one place with a demo experience inspired by today&apos;s
            connected transport environments.
          </Text>
          <Button as={RouterLink} to="/orders" alignSelf="flex-start" variant="outline" colorScheme="blue">View support tools</Button>
        </Stack>

        <Box>
          <Heading size="md" mb={5}>Featured categories</Heading>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
            {featuredCategories.map((category) => (
              <Box key={category.title} borderWidth="1px" borderColor="gray.200" borderRadius="lg" p={5} bg="gray.50">
                <VStack align="flex-start" spacing={3}>
                  <Text fontWeight="semibold">{category.title}</Text>
                  <Text fontSize="sm" color="gray.600">{category.description}</Text>
                  <Button as={RouterLink} to="/products" size="sm" variant="link" colorScheme="blue">View category</Button>
                </VStack>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      </Stack>

      <Box bg="gray.50" px={{ base: 8, md: 12, lg: 16 }} py={{ base: 12, lg: 14 }}>
        <Stack spacing={6}>
          <Heading size="lg">Why teams choose this portal</Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            {portalInsights.map((insight) => (
              <Box key={insight.title} borderWidth="1px" borderColor="gray.200" borderRadius="lg" bg="white" p={5}>
                <HStack align="flex-start" spacing={4}>
                  <Icon as={insight.icon} boxSize={5} color="blue.600" mt={1} />
                  <Stack spacing={1}>
                    <Text fontWeight="semibold">{insight.title}</Text>
                    <Text color="gray.600" fontSize="sm">{insight.description}</Text>
                  </Stack>
                </HStack>
              </Box>
            ))}
          </SimpleGrid>
        </Stack>
      </Box>

      <Box px={{ base: 8, md: 12, lg: 16 }} py={{ base: 10, lg: 12 }}>
        <Box borderRadius="xl" bg="#0B2441" color="white" px={{ base: 6, md: 8 }} py={{ base: 7, md: 8 }}>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
            <Stack spacing={1}>
              <Text fontWeight="semibold">Designed for fleet and workshop teams</Text>
              <Text fontSize="sm" color="blue.100">Built to support practical day-to-day service and procurement workflows.</Text>
            </Stack>
            <Stack spacing={1}>
              <Text fontWeight="semibold">Order history and account purchasing context</Text>
              <Text fontSize="sm" color="blue.100">Track repeat purchases and maintain alignment across teams and locations.</Text>
            </Stack>
            <Stack spacing={1}>
              <Text fontWeight="semibold">Simplified access to parts and support resources</Text>
              <Text fontSize="sm" color="blue.100">Give operations, service, and buying teams one place to execute with confidence.</Text>
            </Stack>
          </SimpleGrid>
        </Box>
      </Box>
    </Container>
  );
};

export default Dashboard;
