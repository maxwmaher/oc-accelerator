import {
  Button,
  Card,
  CardBody,
  Center,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Link,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { BuyerProduct } from "ordercloud-javascript-sdk";
import { parse } from "querystring";
import React, { FunctionComponent, useCallback, useMemo } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
  Link as RouterLink,
} from "react-router-dom";
import Pagination from "../shared/pagination/Pagination";
import FilterSearchMenu, {
  ServiceListOptions,
} from "../shared/search/SearchMenu";
import FacetList from "./facets/FacetList";
import ProductCard from "./ProductCard";
import { useOcResourceListWithFacets } from "@ordercloud/react-sdk";

import { TbAdjustmentsHorizontal } from "react-icons/tb";
import { PageIntro, Surface } from "../trade/TradePrimitives";

import { ACTIVE_COUNTRY, COUNTRY_SELECTION_ENABLED } from "../../config/country";

export interface ProductListProps {
  renderItem?: (product: BuyerProduct) => JSX.Element;
}

const ProductList: FunctionComponent<ProductListProps> = ({ renderItem }) => {
  const { catalogId, categoryId } = useParams<{
    catalogId: string;
    categoryId: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const searchTerm = useMemo(() => {
    return searchParams.get("search") || undefined;
  }, [searchParams]);

  const currentPage = useMemo(() => {
    return Number(searchParams.get("page")) || 1;
  }, [searchParams]);

  const filters = useMemo(() => {
    const filtersObj = {} as { [key: string]: string | string[] };
    for (const key of searchParams.keys()) {
      if (!["search", "page", "pageSize"].includes(key)) {
        filtersObj[key] = searchParams.getAll(key);
      }
      searchParams.getAll(key);
    }
    return filtersObj;
  }, [searchParams]);

  const { data, isLoading, error, refetch } = useOcResourceListWithFacets<BuyerProduct>(
    "Me.Products",
    {
      search: searchTerm,
      page: currentPage.toString(),
      catalogId: COUNTRY_SELECTION_ENABLED ? ACTIVE_COUNTRY.catalogID : catalogId,
      categoryId,
      ...filters,
    }
  );

  const handleRoutingChange = useCallback(
    (queryKey: string, resetPage?: boolean, index?: number) =>
      (value?: string | boolean | number) => {
        const searchParams = new URLSearchParams(location.search);
        const hasPageParam = Boolean(searchParams.get("page"));
        const isFilterParam = !["search", "page", "pageSize"].includes(
          queryKey
        );

        // filters can have multiple values for one key i.e. SpecCount > 0 AND SpecCount < 2
        const prevValue = isFilterParam
          ? searchParams.getAll(queryKey)
          : searchParams.get(queryKey);
        if (!value && !prevValue) return;
        if (value) {
          if (!isFilterParam && prevValue !== value) {
            searchParams.set(queryKey, value.toString());
          } else if (isFilterParam) {
            prevValue?.includes(value.toString())
              ? searchParams.delete(queryKey, value.toString())
              : searchParams.append(queryKey, value.toString());
          }
          if (hasPageParam && resetPage) searchParams.delete("page"); // reset page on filter change
        } else if (prevValue) {
          searchParams.delete(
            queryKey,
            index !== undefined ? prevValue[index] : undefined
          );
        }

        navigate(
          { pathname: location.pathname, search: searchParams.toString() },
          { state: { shallow: true } }
        );
      },
    [location.pathname, location.search, navigate]
  );

  const listOptions = useMemo(() => {
    return parse(location.search.slice(1)) as ServiceListOptions;
  }, [location.search]);

  return (
    <>
      <Link as={RouterLink} to="/" fontSize="sm" color="trade.muted" alignSelf="flex-start" mb={5}>Home / Catalog</Link>
      <PageIntro title={searchTerm ? "Search products" : "Products"}>
        <Text>{searchTerm ? `Results for “${searchTerm}”` : "Browse the products and prices available to your account."}</Text>
      </PageIntro>
      <Drawer placement="left" onClose={onClose} isOpen={isOpen}>
        <DrawerOverlay />
        <DrawerContent maxW="340px">
          <DrawerCloseButton />
          <DrawerHeader>Filters</DrawerHeader>
          <DrawerBody>
            <FilterSearchMenu
              listOptions={listOptions}
              handleRoutingChange={handleRoutingChange}
            />
            <FacetList
              facets={data?.Meta?.Facets}
              onChange={handleRoutingChange}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Grid
        gridTemplateColumns={{ lg: "240px minmax(0, 1fr)" }}
        gap={{ base: 5, lg: 7 }}
        alignItems="flex-start"
      >
        <Card
          as={GridItem}
          position="sticky"
          top="6"
          display={{ base: "none", lg: "block" }}
          border="1px solid" borderColor="trade.border" boxShadow="none"
        >
          <CardBody as={VStack} alignItems="stretch" p={5} spacing={5} minW={0}>
            <Heading as="h2" size="sm">Find products</Heading>
            <FilterSearchMenu
              listOptions={listOptions}
              handleRoutingChange={handleRoutingChange}
            />
            <FacetList
              facets={data?.Meta?.Facets}
              onChange={handleRoutingChange}
            />
          </CardBody>
        </Card>
        <GridItem minW={0}>
          <HStack justify="space-between" mb={5} gap={3} flexWrap="wrap">
            <Text fontSize="sm" color="trade.muted" role="status">{isLoading ? "Loading products…" : data?.Meta?.TotalCount !== undefined ? `${data.Meta.TotalCount} ${data.Meta.TotalCount === 1 ? "product" : "products"}` : "Catalog products"}</Text>
            <Button aria-label="Open Filters" onClick={onOpen} variant="outline" leftIcon={<Icon as={TbAdjustmentsHorizontal} />} display={{ base: "inline-flex", lg: "none" }}>Search & filters</Button>
          </HStack>
          {isLoading ? <Surface><Center minH="240px"><Stack align="center" spacing={4}><Spinner size="lg" color="trade.ink" /><Text color="trade.muted">Loading your catalog…</Text></Stack></Center></Surface> : error ? (
            <Surface><Stack align="flex-start" spacing={3}><Heading as="h2" size="md">Products could not be loaded</Heading><Text color="trade.muted">Please try again to see your assigned products and prices.</Text><Button variant="outline" onClick={() => refetch()}>Try again</Button></Stack></Surface>
          ) : data?.Items?.length === 0 ? (
            <Surface><Center py={10}><Stack align="center" spacing={3}><Heading as="h2" size="md">No products found</Heading><Text color="trade.muted" textAlign="center">Try another keyword or adjust your filters.</Text></Stack></Center></Surface>
          ) : (
            <SimpleGrid w="full" gridTemplateColumns="repeat(auto-fill, minmax(min(100%, 250px), 1fr))" spacing={5}>
              {data?.Items?.map(product => <React.Fragment key={product.ID}>{renderItem ? renderItem(product) : <ProductCard product={product} />}</React.Fragment>)}
            </SimpleGrid>
          )}
        </GridItem>
      </Grid>

      {data?.Meta?.TotalPages && data?.Meta?.TotalPages > 1 && (
        <Center mt={8}>
          <Pagination
            page={currentPage}
            totalPages={data?.Meta?.TotalPages}
            onChange={handleRoutingChange("page")}
          />
        </Center>
      )}
    </>
  );
};

export default ProductList;
