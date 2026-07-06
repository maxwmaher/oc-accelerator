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
  SimpleGrid,
  Spinner,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import {
  BuyerProduct,
  ListPageWithFacets,
  Me,
} from "ordercloud-javascript-sdk";
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
  getBristanDemoTargetRoute,
  getCorrectedBristanDemoCatalogPath,
  isBristanDemoMarketplaceBuyerContext,
} from "../bristan/bristanDemoRoutes";
import { useCurrentUser } from "../../hooks/currentUser";

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
  const { data: user } = useCurrentUser();
  const bristanDemoTargetRoute = getBristanDemoTargetRoute(user?.Username);
  const correctedPath = getCorrectedBristanDemoCatalogPath(
    location.pathname,
    user?.Username,
  );

  useEffect(() => {
    if (bristanDemoTargetRoute && location.pathname === "/products") {
      navigate(bristanDemoTargetRoute, { replace: true });
    }
  }, [bristanDemoTargetRoute, location.pathname, navigate]);

  useEffect(() => {
    if (correctedPath) {
      navigate(correctedPath, { replace: true });
    }
  }, [correctedPath, navigate]);

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

  const shouldHideMarketplaceOffers = isBristanDemoMarketplaceBuyerContext(
    user?.Username,
    catalogId,
  );

  const { data, isLoading } = useOcResourceListWithFacets<BuyerProduct>(
    "Me.Products",
    {
      search: searchTerm,
      page: currentPage.toString(),
      pageSize: shouldHideMarketplaceOffers ? "100" : undefined,
      catalogId,
      categoryId,
      ...filters,
    },
    undefined,
    { disabled: Boolean(correctedPath) },
  );
  const [marketplaceData, setMarketplaceData] =
    useState<ListPageWithFacets<BuyerProduct>>();
  const [isLoadingMarketplaceData, setIsLoadingMarketplaceData] =
    useState(false);

  useEffect(() => {
    if (correctedPath || !shouldHideMarketplaceOffers) {
      setMarketplaceData(undefined);
      setIsLoadingMarketplaceData(false);
      return;
    }

    let isCurrent = true;
    const fetchMarketplaceProducts = async () => {
      setIsLoadingMarketplaceData(true);
      try {
        const pageSize = 100;
        const firstPage = await Me.ListProducts<BuyerProduct>({
          search: searchTerm,
          page: currentPage,
          pageSize,
          catalogID: catalogId,
          categoryID: categoryId,
          filters,
        });
        const totalPages = firstPage.Meta?.TotalPages ?? currentPage;
        const additionalPages = Array.from(
          { length: Math.min(2, Math.max(totalPages - currentPage, 0)) },
          (_, index) => currentPage + index + 1,
        );
        const additionalResults = await Promise.all(
          additionalPages.map((page) =>
            Me.ListProducts<BuyerProduct>({
              search: searchTerm,
              page,
              pageSize,
              catalogID: catalogId,
              categoryID: categoryId,
              filters,
            }),
          ),
        );

        if (isCurrent) {
          setMarketplaceData({
            ...firstPage,
            Items: [
              ...(firstPage.Items ?? []),
              ...additionalResults.flatMap((result) => result.Items ?? []),
            ],
          });
        }
      } finally {
        if (isCurrent) {
          setIsLoadingMarketplaceData(false);
        }
      }
    };

    fetchMarketplaceProducts();

    return () => {
      isCurrent = false;
    };
  }, [
    catalogId,
    categoryId,
    correctedPath,
    currentPage,
    filters,
    searchTerm,
    shouldHideMarketplaceOffers,
  ]);

  const productData = shouldHideMarketplaceOffers ? marketplaceData : data;
  const visibleProducts = useMemo(
    () =>
      (productData?.Items ?? []).filter(
        (product) =>
          !product.ParentID &&
          (!shouldHideMarketplaceOffers ||
            (product.xp?.SupplierOffer !== true &&
              product.xp?.HiddenMarketplaceOffer !== true)),
      ),
    [productData?.Items, shouldHideMarketplaceOffers],
  );

  const handleRoutingChange = useCallback(
    (queryKey: string, resetPage?: boolean, index?: number) =>
      (value?: string | boolean | number) => {
        const searchParams = new URLSearchParams(location.search);
        const hasPageParam = Boolean(searchParams.get("page"));
        const isFilterParam = !["search", "page", "pageSize"].includes(
          queryKey,
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
            index !== undefined ? prevValue[index] : undefined,
          );
        }

        navigate(
          { pathname: location.pathname, search: searchParams.toString() },
          { state: { shallow: true } },
        );
      },
    [location.pathname, location.search, navigate],
  );

  const listOptions = useMemo(() => {
    return parse(location.search.slice(1)) as ServiceListOptions;
  }, [location.search]);

  if (correctedPath || isLoading || isLoadingMarketplaceData) {
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
              facets={productData?.Meta?.Facets}
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
              facets={productData?.Meta?.Facets}
              onChange={handleRoutingChange}
            />
          </CardBody>
        </Card>
        <GridItem display={{ base: "block", md: "none" }}>
          <Button aria-label="Open Filters" onClick={onOpen} mb={4} size="sm">
            Refine your search
          </Button>
        </GridItem>
        <SimpleGrid
          as={GridItem}
          w="full"
          gridTemplateColumns="repeat(auto-fill, minmax(270px, 1fr))"
          spacing={4}
        >
          {visibleProducts.map((p) => (
            <React.Fragment key={p.ID}>
              {renderItem ? renderItem(p) : <ProductCard product={p} />}
            </React.Fragment>
          ))}
        </SimpleGrid>
        {visibleProducts.length === 0 && (
          <Center h="20vh">
            <Heading as="h2" size="md">
              No products found
            </Heading>
          </Center>
        )}
      </Grid>

      {productData?.Meta?.TotalPages && productData?.Meta?.TotalPages > 1 && (
        <Center>
          <Pagination
            page={currentPage}
            totalPages={productData?.Meta?.TotalPages}
            onChange={handleRoutingChange("page")}
          />
        </Center>
      )}
    </>
  );
};

export default ProductList;
