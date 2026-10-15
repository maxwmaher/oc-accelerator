import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useOcResourceList } from "@ordercloud/react-sdk";
import { Catalog, Category } from "ordercloud-javascript-sdk";
import { FC, useMemo } from "react";
import { TbArrowRight } from "react-icons/tb";
import { Link as RouterLink } from "react-router-dom";
import { ACTIVE_COUNTRY, ACTIVE_COUNTRY_CODE, COUNTRY_SELECTION_ENABLED } from "../config/country";
import CategoryCard from "./category/CategoryCard";
import { DemoNotice, Surface } from "./trade/TradePrimitives";

const Dashboard: FC = () => {
  const { data: catalogData, isLoading, error, refetch } = useOcResourceList<Catalog>(
    "Me.Catalogs", undefined, undefined, { staleTime: 300000 }
  );
  const catalogs = useMemo(() => (catalogData?.Items ?? []).filter(
    catalog => !COUNTRY_SELECTION_ENABLED || catalog.ID === ACTIVE_COUNTRY.catalogID
  ), [catalogData]);
  const catalogId = catalogs[0]?.ID;
  const { data: categoryData, isLoading: categoriesLoading } = useOcResourceList<Category>(
    "Me.Categories", { catalogId, ParentID: undefined }, undefined,
    { staleTime: 300000, ...(!catalogId ? { disabled: true } : {}) }
  );
  const countryLabel = ACTIVE_COUNTRY_CODE === "kw" ? "Kuwait" : "Saudi Arabia";

  return (
    <Stack spacing={{ base: 7, md: 10 }}>
      <Surface position="relative" overflow="hidden" p={{ base: 6, md: 9 }} borderTop="3px solid" borderTopColor="trade.gold">
        <Flex direction={{ base: "column", md: "row" }} align={{ md: "center" }} justify="space-between" gap={7}>
          <Stack spacing={3} maxW="680px">
            <Text color="trade.muted" fontWeight="600" fontSize="sm">
              {COUNTRY_SELECTION_ENABLED ? `${countryLabel} catalog` : "Your trade catalog"}
            </Text>
            <Heading as="h1" size={{ base: "xl", md: "2xl" }} lineHeight="shorter">Order for your business.</Heading>
            <Text color="trade.muted" fontSize={{ base: "md", md: "lg" }} maxW="54ch">
              Browse your assigned catalog, choose complete selling units, and review your order for pickup.
            </Text>
          </Stack>
          <Button as={RouterLink} to={catalogId ? `/shop/${catalogId}/products` : "/products"} rightIcon={<TbArrowRight />} alignSelf={{ base: "flex-start", md: "center" }} flexShrink={0}>
            Browse products
          </Button>
        </Flex>
      </Surface>

      <Box as="section" aria-labelledby="catalog-heading">
        <HStack justify="space-between" align="baseline" mb={5} gap={4} flexWrap="wrap">
          <Heading as="h2" size="lg" id="catalog-heading">Browse the catalog</Heading>
          {catalogId && <Text fontSize="sm" color="trade.muted">{catalogs[0].Name}</Text>}
        </HStack>
        {isLoading || categoriesLoading ? (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={5} role="status" aria-label="Loading catalog">
            {[0, 1, 2].map(index => <Skeleton key={index} h="154px" borderRadius="lg" />)}
          </SimpleGrid>
        ) : error ? (
          <Surface><Stack spacing={3} align="flex-start"><Heading as="h3" size="md">The catalog could not be loaded</Heading><Text color="trade.muted">Please try again to see the catalog assigned to your account.</Text><Button variant="outline" onClick={() => refetch()}>Try again</Button></Stack></Surface>
        ) : categoryData?.Items?.length ? (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={5}>
            {categoryData.Items.map(category => <CategoryCard key={category.ID} category={category} catalogId={catalogId} />)}
          </SimpleGrid>
        ) : catalogs.length ? (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={5}>
            {catalogs.map(catalog => <Box key={catalog.ID} as={RouterLink} to={`/shop/${catalog.ID}/products`} display="block" borderRadius="lg" _focusVisible={{ outline: "3px solid", outlineColor: "trade.gold", outlineOffset: "3px" }}><Surface h="full" _hover={{ borderColor: "trade.gold", boxShadow: "sm" }}>
              <Stack spacing={4}><Heading as="h3" size="md">{catalog.Name}</Heading><HStack justify="space-between" color="trade.muted"><Text>View assigned products</Text><TbArrowRight aria-hidden /></HStack></Stack>
            </Surface></Box>)}
          </SimpleGrid>
        ) : (
          <Surface><Heading as="h3" size="md" mb={2}>No catalog is available</Heading><Text color="trade.muted">There are no catalogs assigned to this account.</Text></Surface>
        )}
      </Box>
      <DemoNotice>OrderCloud customer demo. Product prices and quantity requirements are shown for your signed-in account. Quantity 1 represents one complete selling unit as described on the product.</DemoNotice>
    </Stack>
  );
};

export default Dashboard;
