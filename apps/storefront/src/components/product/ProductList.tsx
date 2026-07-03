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
  LinkBox,
  LinkOverlay,
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
  Link as RouterLink,
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
import { mapRouteParamsToOrderCloudListOptions } from "../../utils/orderCloudListOptions";

export interface ProductListProps {
  renderItem?: (product: BuyerProduct) => JSX.Element;
}

const RAI_DEMO_SERVICE_GROUPS = [
  {
    title: "Food, beverages & catering",
    body: "Breakfast items, catering services, delivery windows, and stand-contact details.",
    cta: "Browse catering",
    href: "/shop/buyer/categories/rai-devworld-cat-food-breakfast-catering/products",
  },
  {
    title: "Power, internet & water",
    body: "Power connections, sockets, placement details, and technical supplier instructions.",
    cta: "Browse power services",
    href: "/shop/buyer/categories/rai-devworld-cat-power-sockets/products",
  },
  {
    title: "Stand construction",
    body: "Raised flooring, ramp requirements, finishes, and build-up-sensitive services.",
    cta: "Browse stand construction",
    href: "/shop/buyer/categories/rai-devworld-cat-raised-flooring/products",
  },
] as const;

const RAI_DEMO_CATEGORY_PAGE_COPY: Record<
  string,
  { heading: string; description: string }
> = {
  "rai-devworld-cat-food-breakfast-catering": {
    heading: "Breakfast & catering",
    description:
      "Food and beverage services with delivery timing and stand-contact details.",
  },
  "rai-devworld-cat-power-sockets": {
    heading: "Power & sockets",
    description:
      "Electrical services that may require grid placement, required-by timing, and technical contact details.",
  },
  "rai-devworld-cat-raised-flooring": {
    heading: "Raised flooring",
    description:
      "Stand construction services with area, ramp, finish, and build-up planning details.",
  },
};

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
      ...mapRouteParamsToOrderCloudListOptions({ catalogId, categoryId }),
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

  const categoryPageCopy = categoryId
    ? RAI_DEMO_CATEGORY_PAGE_COPY[categoryId]
    : undefined;

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
          <VStack alignItems="stretch" spacing={4} mb={4}>
            <VStack alignItems="flex-start" spacing={2}>
              <HStack flexWrap="wrap">
                <Heading as="h1" size="xl">
                  Shop stand services
                </Heading>
                <Tag colorScheme="teal" size="sm">
                  Context-aware catalogue · Mocked Momentus visibility rules
                </Tag>
              </HStack>
              <Text color="chakra-subtle-text" maxW="4xl">
                Browse the services available for the active event, hall, stand,
                and ordering phase. Catalogue visibility and recommendations are
                shaped by the selected Momentus profile context.
              </Text>
            </VStack>

            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
              {RAI_DEMO_SERVICE_GROUPS.map((group) => (
                <LinkBox
                  as={Card}
                  key={group.href}
                  borderWidth="1px"
                  borderColor="teal.100"
                  transition="all .15s ease"
                  _hover={{ shadow: "md", transform: "translateY(-1px)" }}
                >
                  <CardBody as={VStack} alignItems="flex-start" spacing={3}>
                    <Heading size="md">{group.title}</Heading>
                    <Text fontSize="sm" color="chakra-subtle-text">
                      {group.body}
                    </Text>
                    <LinkOverlay as={RouterLink} to={group.href}>
                      <Button size="sm" colorScheme="teal" variant="outline">
                        {group.cta}
                      </Button>
                    </LinkOverlay>
                  </CardBody>
                </LinkBox>
              ))}
            </SimpleGrid>

            {categoryPageCopy && (
              <Card borderWidth="1px">
                <CardBody>
                  <Heading as="h2" size="lg" mb={2}>
                    {categoryPageCopy.heading}
                  </Heading>
                  <Text color="chakra-subtle-text">
                    {categoryPageCopy.description}
                  </Text>
                </CardBody>
              </Card>
            )}
          </VStack>

          <Card mb={4} borderColor="teal.100" borderWidth="1px">
            <CardBody>
              {/* Demo-only: production would enforce visibility with OrderCloud catalog assignments, user groups, price schedules, and/or middleware-driven product visibility from Momentus. */}
              <HStack justifyContent="space-between" alignItems="flex-start">
                <VStack alignItems="flex-start" spacing={2}>
                  <HStack flexWrap="wrap">
                    <Heading size="sm">Current stand context</Heading>
                    {isDelegatedRaiDemoContext(selectedRaiContext) && (
                      <Tag colorScheme="purple" size="sm">
                        Ordering on behalf of{" "}
                        {selectedRaiContext.actingOnBehalfOfCompanyName}
                      </Tag>
                    )}
                  </HStack>
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
                        Stand number: {selectedRaiContext.standNumber}
                      </Tag>
                    </WrapItem>
                    <WrapItem>
                      <Tag size="sm">
                        Stand type: {selectedRaiContext.standType}
                      </Tag>
                    </WrapItem>
                    <WrapItem>
                      <Tag size="sm">
                        Stand package: {selectedRaiContext.standPackage}
                      </Tag>
                    </WrapItem>
                    <WrapItem>
                      <Tag size="sm">
                        ExhibitorID: {selectedRaiContext.exhibitorId}
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
