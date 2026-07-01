import {
  Badge,
  Box,
  Button,
  Container,
  Heading,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FC } from "react";
import { Link as RouterLink } from "react-router-dom";
import { BRISTAN_DEMO_ACCOUNTS } from "./bristanDemoRoutes";

const BristanDemoJourneys: FC = () => {
  return (
    <Container maxW="7xl" py={10}>
      <Stack spacing={4} mb={8}>
        <Badge
          alignSelf="flex-start"
          colorScheme="blue"
          fontSize="sm"
          px={3}
          py={1}
        >
          Bristan Marketplace Demo
        </Badge>
        <Heading as="h1" size="xl">
          Demo Accounts
        </Heading>
        <Text color="gray.600" maxW="3xl">
          Reference details for the Bristan sandbox buyer personas. Log in
          manually with the standard login form, then visit the mapped route for
          that account. This page does not switch users or start a one-click
          login flow.
        </Text>
      </Stack>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        {BRISTAN_DEMO_ACCOUNTS.map((account) => (
          <Box
            key={account.username}
            borderWidth="1px"
            borderRadius="lg"
            p={6}
            bg="white"
            shadow="sm"
          >
            <Stack spacing={4} h="full">
              <Stack spacing={2} flex="1">
                <Heading as="h2" size="md">
                  {account.persona}
                </Heading>
                <Text color="gray.700">{account.story}</Text>
                <Box fontSize="sm" color="gray.600">
                  <Text>
                    <strong>Username:</strong> {account.username}
                  </Text>
                  <Text>
                    <strong>Buyer ID:</strong> {account.buyerID}
                  </Text>
                  <Text>
                    <strong>Catalog ID:</strong> {account.catalogID}
                  </Text>
                  <Text>
                    <strong>Route after login:</strong> {account.targetRoute}
                  </Text>
                </Box>
              </Stack>
              <Button
                as={RouterLink}
                to={account.targetRoute}
                colorScheme="blue"
                variant="outline"
              >
                Open route
              </Button>
            </Stack>
          </Box>
        ))}
      </SimpleGrid>
    </Container>
  );
};

export default BristanDemoJourneys;
