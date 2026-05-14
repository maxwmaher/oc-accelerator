import { CheckIcon, CloseIcon, EmailIcon, PhoneIcon } from "@chakra-ui/icons";
import {
  Badge,
  Button,
  Card,
  Container,
  HStack,
  Heading,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useOrderCloudContext } from "@ordercloud/react-sdk";
import { FC } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useCurrentUser } from "../../hooks/currentUser";

const demoGuideItems = [
  {
    title: "Buyer Accounts & Users",
    path: "/buyers",
    description:
      "Show buyer accounts, buyer users, user groups, addresses, catalogs, promotions, and approval rules.",
  },
  {
    title: "Catalog & Product Visibility",
    path: "/catalogs",
    description:
      "Show catalog, category, buyer, and product assignments that control what each account can browse.",
  },
  {
    title: "Customer Pricing",
    path: "/price-schedules",
    description:
      "Show price schedules and assignments that support account- or group-specific pricing.",
  },
  {
    title: "Promotions",
    path: "/promotions",
    description: "Show promotion configuration and buyer or user-group eligibility.",
  },
  {
    title: "Orders & Operations",
    path: "/orders/Incoming",
    description:
      "Inspect submitted orders, line items, promotions, approvals, payments, and shipments.",
  },
  {
    title: "Products & Inventory",
    path: "/products",
    description:
      "Show product configuration and inventory records that can be synchronized from external systems.",
  },
  {
    title: "Admin Permissions",
    path: "/security-profiles",
    description: "Show security profiles and assignments used to manage admin permissions.",
  },
];

const Dashboard: FC = () => {
  const { data: user } = useCurrentUser();
  const ocContext = useOrderCloudContext();

  return (
    <Container maxW="full" p={8}>
      <Heading as="h1" size="lg" color="chakra-subtle-text">
        Dashboard
      </Heading>
      <SimpleGrid
        gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))"
        gap={6}
        mt={6}
      >
        <Card variant="outline" p={6} gridColumn={{ base: "auto", xl: "span 2" }}>
          <VStack align="stretch" spacing={4}>
            <Heading as="h2" size="md">
              B2B Commerce Demo Guide
            </Heading>
            <Text color="chakra-subtle-text">
              Use these shortcuts to walk through the admin resources that support the storefront B2B demo.
            </Text>
            <SimpleGrid
              gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))"
              gap={4}
            >
              {demoGuideItems.map((item) => (
                <Card key={item.path} variant="outline" p={4} gap={3}>
                  <Button
                    as={RouterLink}
                    to={item.path}
                    alignSelf="flex-start"
                    colorScheme="primary"
                    variant="outline"
                    size="sm"
                  >
                    {item.title}
                  </Button>
                  <Text fontSize="sm" color="chakra-subtle-text">
                    {item.description}
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          </VStack>
        </Card>
        <Card variant="outline" p={6}>
          <Text color="chakra-subtle-text">My User:</Text>
          <Text>
            {user?.FirstName} {user?.LastName}
            <Text
              ml="3"
              display="inline"
              color="chakra-subtle-text"
              fontFamily="monospace"
            >
              ({user?.ID})
            </Text>
          </Text>
          <HStack>
            <Text>
              <Text display="inline" color="chakra-subtle-text">
                Active:
              </Text>
              {user?.Active === true ? (
                <CheckIcon mx="2" color="green.500" />
              ) : (
                <CloseIcon mx="2" color="red.500" />
              )}
              {user?.Active.toString()}
            </Text>
          </HStack>
        </Card>
        <Card variant="outline" p={6}>
          <Text color="chakra-subtle-text">Contact:</Text>
          <Text display="flex" gap={3} alignItems="center">
            <EmailIcon color="chakra-placeholder-color" />
            {user?.Email}
          </Text>
          {user?.Phone && (
            <Text display="flex" gap={3} alignItems="center">
              <PhoneIcon color="chakra-placeholder-color" />
              {user?.Phone?.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}
            </Text>
          )}
        </Card>
        <Card variant="outline" p={6}>
          <Text color="chakra-subtle-text">Seller ID:</Text>
          <Text>{user?.Seller.ID}</Text>
        </Card>
        <Card variant="outline" p={6} alignItems="flex-start" gap={3}>
          <Text mb={-2} color="chakra-subtle-text">
            Available roles:
          </Text>
          <HStack gap={2} flexWrap="wrap">
            {user?.AvailableRoles.map((role, idx) => (
              <Badge w="min-content" key={idx}>
                {role}
              </Badge>
            ))}
          </HStack>
        </Card>
        <Card variant="outline" p={6} alignItems="flex-start" gap={3}>
          <Text mb={-2} color="chakra-subtle-text">
            OrderCloud Base API URL
          </Text>
          <Text>{ocContext?.baseApiUrl}</Text>
        </Card>
      </SimpleGrid>
    </Container>
  );
};

export default Dashboard;
