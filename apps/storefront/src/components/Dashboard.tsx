import {
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
import hero1 from "../assets/bristan/hero1.jpg";
import hero2 from "../assets/bristan/hero2.jpg";
import hero3 from "../assets/bristan/hero3.jpg";

const Dashboard: FC = () => {
  return (
    <Container maxW="full">
      <SimpleGrid gridTemplateColumns={{ lg: "1fr 2fr" }}>
        <Stack
          direction="column"
          justifyContent="center"
          alignItems="flex-start"
          gap={6}
          px={{ base: 12, lg: "24" }}
          minH={{ base: "40vh", lg: "unset%" }}
        >
          <Heading maxW={{ lg: "sm" }} size="4xl" as="h1">
            Find the right Bristan product faster
          </Heading>
          <Button as={RouterLink} to="/products" size="sm" mt={8}>
            Shop products
          </Button>
        </Stack>
        <Image
          h="75dvh"
          w="full"
          objectFit="cover"
          objectPosition="center center"
          src={hero1}
          alt="Bristan kitchen tap and sink product hero"
        />
      </SimpleGrid>
      <SimpleGrid gridTemplateColumns={{ lg: "1fr 1fr" }}>
        <Image
          h="75dvh"
          w="full"
          objectFit="cover"
          objectPosition="center center"
          src={hero2}
          alt="Bristan bathroom tap product detail"
        />
        <Stack
          direction="column"
          justifyContent="center"
          alignItems="flex-start"
          gap={6}
          px={{ base: 12, lg: 12 }}
          minH={{ base: "40vh", lg: "unset%" }}
          maxW="prose"
        >
          <Heading>Spare parts self-service for installers</Heading>
          <Text>
            Help installers and builders identify the right Bristan accessories,
            spares, and product codes without calling support.
          </Text>
        </Stack>
      </SimpleGrid>
      <SimpleGrid gridTemplateColumns={{ lg: "1fr 1fr" }}>
        <Stack
          direction="column"
          justifyContent="center"
          alignItems="flex-start"
          gap={6}
          px={{ base: 12, lg: 24 }}
          minH={{ base: "40vh", lg: "unset" }}
          maxW="prose"
        >
          <Heading>Trade buying and marketplace readiness</Heading>
          <Text>
            Support supplier bulk purchasing, account-specific pricing, and
            future supplier-led marketplace journeys using Bristan-governed
            product data.
          </Text>
        </Stack>
        <Image
          h="75dvh"
          w="full"
          objectFit="cover"
          objectPosition="center center"
          src={hero3}
          alt="Bristan trade bathroom product setting"
        />
      </SimpleGrid>
    </Container>
  );
};

export default Dashboard;
