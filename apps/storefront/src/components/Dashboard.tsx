import {
  Badge,
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Image,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FC } from "react";
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

const defaultImages = [defaultImage1, defaultImage2, defaultImage3, defaultImage4, defaultImage5, defaultImage6, defaultImage7, defaultImage8];

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
      <Text fontSize="xs" letterSpacing="0.12em" color="gray.500" fontWeight="semibold">CUSTOMER PORTAL DEMO</Text>
      <Text fontSize="xl" fontWeight="bold" color="#0B2441" letterSpacing="0.08em">SCANIA</Text>
    </Stack>
  </HStack>
);

const Dashboard: FC = () => {
  const getDefaultImage = () => defaultImages[Math.floor(Math.random() * defaultImages.length)];

  return (
    <Container maxW="full" p={0} pb={{ base: 12, lg: 16 }}>
      <SimpleGrid gridTemplateColumns={{ lg: "1fr 1.2fr" }} bg="gray.50">
        <Stack justifyContent="center" alignItems="flex-start" gap={6} px={{ base: 8, md: 12, lg: 20 }} py={{ base: 12, lg: 16 }}>
          <ScaniaPortalMark />
          <Badge colorScheme="blue" variant="subtle" px={3} py={1} borderRadius="full">Scania Customer Portal / SPO</Badge>
          <Heading maxW={{ lg: "lg" }} size="3xl" as="h1" color="gray.800">Keep your fleet moving</Heading>
          <Text maxW="2xl" color="gray.600" fontSize="lg">Welcome to the Scania Customer Portal demo — a streamlined storefront experience for parts, maintenance needs, and operational support. Browse key categories, place orders, and help keep vehicles, workshops, and teams moving efficiently.</Text>
          <HStack spacing={4} pt={2}>
            <Button as={RouterLink} to="/products" colorScheme="blue" size="md">Shop parts</Button>
            <Button as={RouterLink} to="/orders" variant="outline" colorScheme="blue" size="md">View orders</Button>
          </HStack>
        </Stack>
        <Image h={{ base: "45vh", lg: "72vh" }} w="full" objectFit="cover" src={DASHBOARD_HERO_IMAGE || defaultHeroImage} alt="Fleet operations hero placeholder" />
      </SimpleGrid>

      <SimpleGrid gridTemplateColumns={{ lg: "1fr 1fr" }}>
        <Image h={{ base: "38vh", lg: "62vh" }} w="full" objectFit="cover" src={DASHBOARD_SECONDARY_IMAGE || getDefaultImage()} alt="Workshop essentials placeholder" />
        <Stack justifyContent="center" alignItems="flex-start" gap={5} px={{ base: 8, md: 12, lg: 16 }} py={{ base: 10, lg: 14 }}>
          <Heading size="xl">Workshop-ready essentials</Heading>
          <Text color="gray.600" maxW="xl">From service kits and filters to electrical components and brake-related parts, quickly access the items your team needs to support routine maintenance and day-to-day workshop operations.</Text>
          <Button as={RouterLink} to="/products" variant="outline" colorScheme="blue">Browse maintenance parts</Button>
        </Stack>
      </SimpleGrid>

      <SimpleGrid gridTemplateColumns={{ lg: "1fr 1fr" }}>
        <Stack justifyContent="center" alignItems="flex-start" gap={5} px={{ base: 8, md: 12, lg: 16 }} py={{ base: 10, lg: 14 }}>
          <Heading size="xl">Built for fleet uptime</Heading>
          <Text color="gray.600" maxW="xl">Support planned maintenance, simplify repeat ordering, and help reduce downtime with a storefront experience designed for fleet, workshop, and procurement teams.</Text>
          <Button as={RouterLink} to="/products" variant="outline" colorScheme="blue">Explore fleet solutions</Button>
        </Stack>
        <Image h={{ base: "38vh", lg: "62vh" }} w="full" objectFit="cover" src={DASHBOARD_TERTIARY_IMAGE || getDefaultImage()} alt="Fleet uptime placeholder" />
      </SimpleGrid>
    </Container>
  );
};

export default Dashboard;
