import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Container,
  Flex,
  Stack,
  HStack,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useDisclosure,
  UseDisclosureProps,
} from "@chakra-ui/react";
import {
  useOcResourceList,
  useOrderCloudContext,
  useShopper,
} from "@ordercloud/react-sdk";
import { Catalog, Category } from "ordercloud-javascript-sdk";
import { FC, useEffect, useMemo, useState } from "react";
import { TbShoppingCartFilled } from "react-icons/tb";
import { Link as RouterLink } from "react-router-dom";
import { TradeBrand } from "../components/trade/TradePrimitives";
import { useCurrentUser } from "../hooks/currentUser";
import MegaMenu from "../Layout/MegaMenu";

import CountrySelector from "../components/CountrySelector";
import { ACTIVE_COUNTRY, COUNTRY_SELECTION_ENABLED } from "../config/country";

interface MainMenuProps {
  loginDisclosure: UseDisclosureProps;
}

const MainMenu: FC<MainMenuProps> = ({ loginDisclosure }) => {
  const { data: user } = useCurrentUser();
  const { isLoggedIn, logout } = useOrderCloudContext();
  const megaMenuDisclosure = useDisclosure();
  const [selectedCatalog, setSelectedCatalog] = useState<string>("");

  const { orderWorksheet } = useShopper();

  const { data: catalogData } = useOcResourceList<Catalog>(
    "Me.Catalogs",
    undefined,
    undefined,
    { staleTime: 300000 }
  );

  const catalogs = useMemo(() => (catalogData?.Items ?? []).filter((catalog) => !COUNTRY_SELECTION_ENABLED || catalog.ID === ACTIVE_COUNTRY.catalogID), [catalogData]);

  const activeCatalogId = catalogs.length > 0 ? catalogs[0]?.ID : undefined;

  const { data: categoryData } = useOcResourceList<Category>(
    "Me.Categories",
    activeCatalogId ? { catalogId: activeCatalogId } : undefined,
    undefined,
    { staleTime: 300000 }
  );

  const categories = useMemo(() => categoryData?.Items ?? [], [categoryData]);

  useEffect(() => {
    if (!selectedCatalog && catalogs?.length)
      setSelectedCatalog(catalogs[0].ID);
  }, [catalogs, selectedCatalog]);

  const totalQuantity = useMemo(() => {
    return (
      orderWorksheet?.LineItems?.reduce(
        (sum, item) => sum + item.Quantity,
        0
      ) || 0
    );
  }, [orderWorksheet?.LineItems]);

  const renderCatalogMenu = () => {
    if (catalogs?.length && catalogs.length > 1) {
      return (
        <Menu>
          <MenuButton
            as={Button}
            variant="outline"
            size="sm"
            rightIcon={<ChevronDownIcon />}
          >
            Shop by catalog
          </MenuButton>
          <MenuList>
            {catalogs?.map((catalog) => {
              return (
                <MenuItem
                  key={catalog.ID}
                  onClick={() => setSelectedCatalog(catalog.ID)}
                  as={RouterLink}
                  to={`/shop/${catalog.ID}/products`}
                >
                  {catalog.Name}
                </MenuItem>
              );
            })}
          </MenuList>
        </Menu>
      );
    } else if (catalogs?.length === 1) {
      return (
        <Button
          as={RouterLink}
          to={`/shop/${catalogs[0].ID}/products`}
          variant="ghost"
        >
          Shop All Products
        </Button>
      );
    }
    return null;
  };

  return (
    <Box as="header" bg="white" borderTop="3px solid" borderTopColor="trade.gold" borderBottom="1px solid" borderBottomColor="trade.border" position="relative" zIndex={10}>
      <Container maxW="1320px" px={{ base: 4, md: 6, xl: 8 }} py={{ base: 4, lg: 5 }}>
        <Flex align="center" gap={{ base: 4, lg: 6 }} flexWrap="wrap">
          <Box as={RouterLink} to="/" aria-label="KFMB home" flexShrink={0}><TradeBrand /></Box>
          <Flex as="nav" aria-label="Catalog navigation" gap={1} flex={{ base: "1 1 100%", lg: "1" }} order={{ base: 3, lg: 0 }} borderTop={{ base: "1px solid", lg: "none" }} borderColor="trade.border" pt={{ base: 3, lg: 0 }} flexWrap="wrap">
            {categories.length > 0 && <Button isActive={megaMenuDisclosure.isOpen} aria-expanded={megaMenuDisclosure.isOpen} aria-controls="catalog-categories" size="sm" variant="ghost" onClick={megaMenuDisclosure.onToggle} rightIcon={<ChevronDownIcon />}>Categories</Button>}
            {renderCatalogMenu()}
          </Flex>
          <Box w={{ base: "full", lg: "250px" }} order={{ base: 4, lg: 0 }}><CountrySelector /></Box>
          <Stack display={{ base: "contents", lg: "flex" }} spacing={2} ml="auto" align="flex-end" maxW={{ base: "none", lg: "240px" }} minW={0}>
            <HStack spacing={2} ml={{ base: "auto", lg: 0 }} order={{ base: 1, lg: 0 }}>
              <Button as={RouterLink} to="/cart" variant="outline" size="sm" leftIcon={<Icon as={TbShoppingCartFilled} boxSize={5} />} aria-label="Link to cart">
                Cart{totalQuantity > 0 && <Text as="span" ml={2} bg="trade.ink" color="white" borderRadius="sm" px={2} fontSize="sm">{totalQuantity}</Text>}
              </Button>
              {isLoggedIn ? <Button size="sm" variant="ghost" onClick={logout}>Logout</Button> : <Button size="sm" onClick={loginDisclosure.onOpen}>Login</Button>}
            </HStack>
            {isLoggedIn && user && <Text order={{ base: 2, lg: 0 }} flexBasis={{ base: "100%", lg: "auto" }} fontSize="sm" color="trade.muted" textAlign={{ base: "left", lg: "right" }} overflowWrap="anywhere">{`Welcome, ${[user.FirstName, user.LastName].filter(Boolean).join(" ") || user.Username || "shopper"}`}</Text>}
          </Stack>
        </Flex>
        {megaMenuDisclosure.isOpen && <MegaMenu isOpen={megaMenuDisclosure.isOpen} onClose={megaMenuDisclosure.onClose} selectedCatalog={selectedCatalog} setSelectedCatalog={setSelectedCatalog} />}
      </Container>
    </Box>
  );
};

export default MainMenu;
