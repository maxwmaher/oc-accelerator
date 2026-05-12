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
// TODO: Replace these local Dometic-style placeholders with licensed Dometic Media Bank/press-kit downloads when available.
// Recommended slots: hero = RV campsite meal lifestyle; secondary = RV/van road-trip comfort; tertiary = cooler or outdoor gear product promo.
import heroCampsiteImage from "../assets/storefront/dometic-rv-campsite-meal.svg";
import roadTripImage from "../assets/storefront/dometic-rv-road-trip.svg";
import coolerAdventureImage from "../assets/storefront/dometic-cooler-adventure.svg";
import {
  DASHBOARD_HERO_IMAGE,
  DASHBOARD_SECONDARY_IMAGE,
  DASHBOARD_TERTIARY_IMAGE,
} from "../constants";

const homepageImageSlots = {
  hero: {
    src: DASHBOARD_HERO_IMAGE || heroCampsiteImage,
    alt: "Friends gathered outside an RV campsite with Dometic outdoor gear",
  },
  secondary: {
    src: DASHBOARD_SECONDARY_IMAGE || roadTripImage,
    alt: "RV parked for a road trip with outdoor living setup",
  },
  tertiary: {
    src: DASHBOARD_TERTIARY_IMAGE || coolerAdventureImage,
    alt: "Dometic cooler and outdoor gear prepared for a weekend adventure",
  },
};

const DometicPortalMark: FC = () => (
  <HStack spacing={3} align="center">
    <Box aria-hidden="true">
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="46" height="46" rx="12" fill="#12352F" />
        <path d="M14 33C18 27 22 24 26 24C30 24 34 27 38 33" stroke="#DCCFAE" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M15 36H37" stroke="#F2E7CF" strokeWidth="2" strokeLinecap="round" />
        <circle cx="26" cy="18" r="4" fill="#D5964E" />
      </svg>
    </Box>
    <Stack spacing={0}>
      <Text fontSize="xs" letterSpacing="0.12em" color="gray.500" fontWeight="semibold">OUTDOOR LIVING STORE</Text>
      <Text fontSize="xl" fontWeight="bold" color="#12352F" letterSpacing="0.08em">DOMETIC</Text>
    </Stack>
  </HStack>
);

const Dashboard: FC = () => (
  <Container maxW="full" p={0} pb={{ base: 12, lg: 16 }}>
    <SimpleGrid gridTemplateColumns={{ lg: "1fr 1.2fr" }} bg="gray.50">
      <Stack justifyContent="center" alignItems="flex-start" gap={6} px={{ base: 8, md: 12, lg: 20 }} py={{ base: 12, lg: 16 }}>
        <DometicPortalMark />
        <Badge colorScheme="green" variant="subtle" px={3} py={1} borderRadius="full">RV, Van & Outdoor Living</Badge>
        <Heading maxW={{ lg: "lg" }} size="3xl" as="h1" color="gray.800">Gear for life beyond four walls.</Heading>
        <Text maxW="2xl" color="gray.600" fontSize="lg">Explore premium solutions for mobile comfort, outdoor living, and every journey in between. From cooling and cooking to power, shade, and camp essentials, Dometic helps make the road feel more like home.</Text>
        <HStack spacing={4} pt={2} flexWrap="wrap">
          <Button as={RouterLink} to="/products" colorScheme="green" size="md">Shop Outdoor Living</Button>
          <Button as={RouterLink} to="/orders" variant="outline" colorScheme="green" size="md">Build Your Setup</Button>
        </HStack>
      </Stack>
      <Image h={{ base: "45vh", lg: "72vh" }} w="full" objectFit="cover" objectPosition={{ base: "58% center", lg: "center" }} src={homepageImageSlots.hero.src} alt={homepageImageSlots.hero.alt} />
    </SimpleGrid>

    <SimpleGrid gridTemplateColumns={{ lg: "1fr 1fr" }}>
      <Image h={{ base: "38vh", lg: "62vh" }} w="full" objectFit="cover" objectPosition={{ base: "55% center", lg: "center" }} src={homepageImageSlots.secondary.src} alt={homepageImageSlots.secondary.alt} />
      <Stack justifyContent="center" alignItems="flex-start" gap={5} px={{ base: 8, md: 12, lg: 16 }} py={{ base: 10, lg: 14 }}>
        <Heading size="xl">Comfort for every mile</Heading>
        <Text color="gray.600" maxW="xl">Set up camp quickly with RV and van essentials that make the road feel effortless: shaded outdoor rooms, compact cooking, cold storage, lighting, and smart organization for longer stays.</Text>
        <Button as={RouterLink} to="/products" variant="outline" colorScheme="green">Browse RV & van essentials</Button>
      </Stack>
    </SimpleGrid>

    <SimpleGrid gridTemplateColumns={{ lg: "1fr 1fr" }}>
      <Stack justifyContent="center" alignItems="flex-start" gap={5} px={{ base: 8, md: 12, lg: 16 }} py={{ base: 10, lg: 14 }}>
        <Heading size="xl">Weekend-ready cooling and power</Heading>
        <Text color="gray.600" maxW="xl">Pack dependable refrigeration, drinkware, camp furniture, lighting, and portable power into one polished gear system for picnics, overlanding, and spontaneous escapes.</Text>
        <Button as={RouterLink} to="/products" variant="outline" colorScheme="green">Explore adventure gear</Button>
      </Stack>
      <Image h={{ base: "38vh", lg: "62vh" }} w="full" objectFit="cover" objectPosition={{ base: "50% center", lg: "center" }} src={homepageImageSlots.tertiary.src} alt={homepageImageSlots.tertiary.alt} />
    </SimpleGrid>
  </Container>
);

export default Dashboard;
