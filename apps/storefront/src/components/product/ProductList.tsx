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
  SimpleGrid,
  Spinner,
  Tag,
  Text,
  VStack,
  Wrap,
  WrapItem,
  useDisclosure,
} from "@chakra-ui/react";
import { BuyerProduct } from "ordercloud-javascript-sdk";
import { parse } from "querystring";
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import Pagination from "../shared/pagination/Pagination";
import FilterSearchMenu, {
  ServiceListOptions,
} from "../shared/search/SearchMenu";
import FacetList from "./facets/FacetList";
import ProductCard from "./ProductCard";
import { useOcResourceListWithFacets } from "@ordercloud/react-sdk";
import {
  getRaiDemoContextById,
  isDelegatedRaiDemoContext,
  RAI_DEMO_CONTEXT_STORAGE_KEY,
} from "../../demo/raiDemoContexts";
import {
  getRaiDemoCatalogueSegment,
  productMatchesRaiDemoCatalogueFilter,
  RAI_DEMO_CATALOGUE_FILTER_LABELS,
  RAI_DEMO_CONTEXT_CHANGED_EVENT,
  RaiDemoCatalogueFilter,
} from "../../demo/raiDemoVisibility";

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
  const [raiCatalogueFilter, setRaiCatalogueFilter] =
    useState<RaiDemoCatalogueFilter>("all");
  const [selectedRaiContextId, setSelectedRaiContextId] = useState(() =>
    typeof window === "undefined"
      ? undefined
      : window.localStorage.getItem(RAI_DEMO_CONTEXT_STORAGE_KEY),
  );

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

  const { data, isLoading } = useOcResourceListWithFacets<BuyerProduct>(
    "Me.Products",
    {
      search: searchTerm,
      page: currentPage.toString(),
      catalogId,
      categoryId,
      ...filters,
    }
  );

  useEffect(() => {
    const updateSelectedRaiContext = () => {
      setSelectedRaiContextId(
        window.localStorage.getItem(RAI_DEMO_CONTEXT_STORAGE_KEY),
      );
      setRaiCatalogueFilter("all");
    };

    window.addEventListener(
      RAI_DEMO_CONTEXT_CHANGED_EVENT,
      updateSelectedRaiContext,
    );
    window.addEventListener("storage", updateSelectedRaiContext);

    return () => {
      window.removeEventListener(
        RAI_DEMO_CONTEXT_CHANGED_EVENT,
        updateSelectedRaiContext,
      );
      window.removeEventListener("storage", updateSelectedRaiContext);
    };
  }, []);

  const selectedRaiContext = useMemo(
    () => getRaiDemoContextById(selectedRaiContextId),
    [selectedRaiContextId],
  );

  const raiCatalogueSegment = useMemo(
    () => getRaiDemoCatalogueSegment(selectedRaiContext),
    [selectedRaiContext],
  );

  const filteredProducts = useMemo(() => {
    return (data?.Items ?? []).filter((product) =>
      productMatchesRaiDemoCatalogueFilter(
        product,
        selectedRaiContext,
        raiCatalogueFilter,
      ),
    );
  }, [data?.Items, raiCatalogueFilter, selectedRaiContext]);

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

  if (isLoading) {
    return (
      <Center h="50vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  return (
    <>
      <Drawer placement="left" onClose={onClose} isOpen={isOpen}>
        <DrawerOverlay />
        <DrawerContent>
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
        gridTemplateColumns={{ md: "300px 1fr" }}
        gap="4"
        alignItems="flex-start"
      >
        <Card
          as={GridItem}
          position="sticky"
          top="20"
          display={{ base: "none", md: "block" }}
        >
          <CardBody as={VStack} alignItems="stretch">
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
        <GridItem display={{ base: "block", md: "none" }}>
          <Button aria-label="Open Filters" onClick={onOpen} mb={4} size="sm">
            Refine your search
          </Button>
        </GridItem>
        <GridItem>
          <Card mb={4} borderColor="teal.100" borderWidth="1px">
            <CardBody>
              {/* Demo-only: production would enforce visibility with OrderCloud catalog assignments, user groups, price schedules, and/or middleware-driven product visibility from Momentus. */}
              <HStack justifyContent="space-between" alignItems="flex-start">
                <VStack alignItems="flex-start" spacing={2}>
                  <HStack flexWrap="wrap">
                    <Heading size="sm">Catalogue tailored for this stand</Heading>
                    <Tag colorScheme="teal" size="sm">
                      Mocked Momentus visibility rules
                    </Tag>
                    {isDelegatedRaiDemoContext(selectedRaiContext) && (
                      <Tag colorScheme="purple" size="sm">
                        Delegated catalogue view
                      </Tag>
                    )}
                  </HStack>
                  <Text fontSize="sm">
                    Assortment is filtered by event, hall, stand type, and stand
                    package.
                  </Text>
                  <Text fontSize="sm" color="chakra-subtle-text">
                    {raiCatalogueSegment.emphasis}
                  </Text>
                  <Wrap spacing={2}>
                    <WrapItem>
                      <Tag size="sm">Event: {selectedRaiContext.eventName}</Tag>
                    </WrapItem>
                    <WrapItem>
                      <Tag size="sm">Hall: {selectedRaiContext.hall}</Tag>
                    </WrapItem>
                    <WrapItem>
                      <Tag size="sm">
                        Stand: {selectedRaiContext.standNumber}
                      </Tag>
                    </WrapItem>
                    <WrapItem>
                      <Tag size="sm">Type: {selectedRaiContext.standType}</Tag>
                    </WrapItem>
                    <WrapItem>
                      <Tag size="sm">
                        Package: {selectedRaiContext.standPackage}
                      </Tag>
                    </WrapItem>
                  </Wrap>
                </VStack>
              </HStack>
              <Wrap mt={4} spacing={2}>
                {(Object.keys(RAI_DEMO_CATALOGUE_FILTER_LABELS) as RaiDemoCatalogueFilter[]).map(
                  (filter) => (
                    <WrapItem key={filter}>
                      <Button
                        size="xs"
                        variant={
                          raiCatalogueFilter === filter ? "solid" : "outline"
                        }
                        colorScheme={
                          raiCatalogueFilter === filter ? "teal" : undefined
                        }
                        onClick={() => setRaiCatalogueFilter(filter)}
                      >
                        {RAI_DEMO_CATALOGUE_FILTER_LABELS[filter]}
                      </Button>
                    </WrapItem>
                  ),
                )}
              </Wrap>
            </CardBody>
          </Card>
          <SimpleGrid
            w="full"
            gridTemplateColumns="repeat(auto-fill, minmax(270px, 1fr))"
            spacing={4}
          >
            {filteredProducts.map((p) => (
              <React.Fragment key={p.ID}>
                {renderItem ? renderItem(p) : <ProductCard product={p} />}
              </React.Fragment>
            ))}
          </SimpleGrid>
        </GridItem>
        {filteredProducts.length === 0 && (
          <Center h="20vh">
            <Heading as="h2" size="md">
              No products found
            </Heading>
          </Center>
        )}
      </Grid>

      {data?.Meta?.TotalPages && data?.Meta?.TotalPages > 1 && (
        <Center>
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
