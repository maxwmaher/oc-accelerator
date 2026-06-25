import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Badge,
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Icon,
  Image,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useDisclosure,
  UseDisclosureProps,
  useToast,
  VStack,
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
import { DEFAULT_BRAND } from "../assets/DEFAULT_BRAND";
import { BRAND_LOGO_DARK, BRAND_LOGO_LIGHT } from "../constants";
import {
  getRaiDemoContextById,
  RAI_DEMO_CONTEXT_STORAGE_KEY,
  RAI_DEMO_CONTEXTS,
  isDelegatedRaiDemoContext,
} from "../demo/raiDemoContexts";
import { useCurrentUser } from "../hooks/currentUser";
import MegaMenu from "../Layout/MegaMenu";

interface MainMenuProps {
  loginDisclosure: UseDisclosureProps;
}

const MainMenu: FC<MainMenuProps> = ({ loginDisclosure }) => {
  const { data: user } = useCurrentUser();
  const { isLoggedIn, logout } = useOrderCloudContext();
  const megaMenuDisclosure = useDisclosure();
  const toast = useToast();
  const [selectedCatalog, setSelectedCatalog] = useState<string>("");
  const [selectedRaiContextId, setSelectedRaiContextId] = useState(() => {
    if (typeof window === "undefined") return RAI_DEMO_CONTEXTS[0].id;

    return getRaiDemoContextById(
      window.localStorage.getItem(RAI_DEMO_CONTEXT_STORAGE_KEY),
    ).id;
  });

  const { orderWorksheet } = useShopper();

  const { data: catalogData } = useOcResourceList<Catalog>(
    "Me.Catalogs",
    undefined,
    undefined,
    { staleTime: 300000 },
  );

  const catalogs = useMemo(() => catalogData?.Items ?? [], [catalogData]);

  const activeCatalogId = catalogs.length > 0 ? catalogs[0]?.ID : undefined;

  const { data: categoryData } = useOcResourceList<Category>(
    "Me.Categories",
    activeCatalogId ? { catalogId: activeCatalogId } : undefined,
    undefined,
    { staleTime: 300000 },
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
        0,
      ) || 0
    );
  }, [orderWorksheet?.LineItems]);

  const selectedRaiContext = getRaiDemoContextById(selectedRaiContextId);
  const isDelegatedRaiContext = isDelegatedRaiDemoContext(selectedRaiContext);

  useEffect(() => {
    window.localStorage.setItem(
      RAI_DEMO_CONTEXT_STORAGE_KEY,
      selectedRaiContext.id,
    );
  }, [selectedRaiContext.id]);

  const handleRaiContextSelect = (contextId: string) => {
    if (contextId === selectedRaiContext.id) return;

    if (totalQuantity > 0) {
      toast({
        title: "Cart belongs to the current stand",
        description:
          "Complete or empty the cart before switching event or stand context.",
        status: "info",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setSelectedRaiContextId(getRaiDemoContextById(contextId).id);
  };

  const renderRaiContextMenu = () => {
    if (!isLoggedIn) return null;

    return (
      <Menu placement="bottom-end">
        <MenuButton
          as={Button}
          variant="outline"
          size="sm"
          rightIcon={<ChevronDownIcon />}
          maxW={{ base: "44", md: "72" }}
        >
          <VStack align="start" spacing={0}>
            <Text as="span" noOfLines={1}>
              {`${selectedRaiContext.eventName} · ${selectedRaiContext.hall} · Stand ${selectedRaiContext.standNumber}`}
            </Text>
            {isDelegatedRaiContext && (
              <Text as="span" fontSize="2xs" color="purple.600" noOfLines={1}>
                Ordering on behalf of exhibitor
              </Text>
            )}
          </VStack>
        </MenuButton>
        <MenuList minW="xs" maxW="sm">
          <Box px={3} py={2}>
            <HStack mb={2} spacing={2} flexWrap="wrap">
              <Badge colorScheme="purple" variant="subtle">
                Mocked Momentus profile
              </Badge>
              {isDelegatedRaiContext && (
                <Badge colorScheme="orange" variant="subtle">
                  Mocked delegated access
                </Badge>
              )}
            </HStack>
            <VStack align="stretch" spacing={1}>
              <Text fontWeight="semibold">
                {isDelegatedRaiContext
                  ? selectedRaiContext.actorCompanyName
                  : selectedRaiContext.companyName}
              </Text>
              {isDelegatedRaiContext && (
                <>
                  <Text fontSize="xs" color="gray.600">
                    Actor: {selectedRaiContext.actorCompanyName}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    Role: {selectedRaiContext.actorRole}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    Ordering for: {selectedRaiContext.actingOnBehalfOfCompanyName}
                  </Text>
                </>
              )}
              <Text fontSize="sm">
                {selectedRaiContext.eventName} ({selectedRaiContext.eventId})
              </Text>
              <Text fontSize="sm">
                {selectedRaiContext.hall} · Stand{" "}
                {selectedRaiContext.standNumber}
              </Text>
              <Text fontSize="xs" color="gray.600">
                ExhibitorID: {selectedRaiContext.exhibitorId}
              </Text>
              <Text fontSize="xs" color="gray.600">
                AccountID: {selectedRaiContext.accountId}
              </Text>
              <Text fontSize="xs" color="gray.600">
                Role: {selectedRaiContext.role}
              </Text>
              <Text fontSize="xs" color="gray.600">
                Package: {selectedRaiContext.standPackage}
              </Text>
              {isDelegatedRaiContext && (
                <>
                  <Text fontSize="xs" color="gray.600">
                    DelegationID: {selectedRaiContext.delegationId}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    Invoice to: {selectedRaiContext.invoiceTo}
                  </Text>
                </>
              )}
            </VStack>
          </Box>
          {RAI_DEMO_CONTEXTS.map((context) => (
            <MenuItem
              key={context.id}
              onClick={() => handleRaiContextSelect(context.id)}
              fontWeight={
                context.id === selectedRaiContext.id ? "semibold" : "normal"
              }
            >
              <VStack align="stretch" spacing={0}>
                <Text fontSize="sm">
                  {context.eventName} · {context.hall} · Stand{" "}
                  {context.standNumber}
                </Text>
                <Text
                  fontSize="xs"
                  color="gray.500"
                  display={{ base: "none", md: "block" }}
                >
                  {isDelegatedRaiDemoContext(context)
                    ? `${context.actorRole} · ordering for ${context.actingOnBehalfOfCompanyName}`
                    : `${context.standType} · ${context.standPackage}`}
                </Text>
              </VStack>
            </MenuItem>
          ))}
        </MenuList>
      </Menu>
    );
  };

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
    <HStack
      h="12"
      as="header"
      position="sticky"
      w="full"
      top="0"
      zIndex={2}
      bgColor="whiteAlpha.600"
      borderBottom="1px solid"
      borderColor="whiteAlpha.900"
      px="8"
      backdropFilter="auto"
      backdropBlur="5px"
      py={2}
    >
      <Container h="100%" maxW="full">
        <HStack h="100%" justify="flex-start" alignItems="center">
          <RouterLink to="/">
            {BRAND_LOGO_LIGHT ? (
              <Image src={BRAND_LOGO_LIGHT} alt="WildSite Logo" h="10" />
            ) : BRAND_LOGO_DARK ? (
              <Image src={BRAND_LOGO_DARK} alt="WildSite Logo (Dark)" h="10" />
            ) : (
              <DEFAULT_BRAND h="10" />
            )}
          </RouterLink>
          <HStack as="nav" flexGrow="1" ml={3}>
            {categories.length > 0 && (
              <Button
                isActive={megaMenuDisclosure.isOpen}
                size="sm"
                variant="ghost"
                onClick={megaMenuDisclosure.onToggle}
              >
                Categories
              </Button>
            )}
            {renderCatalogMenu()}
          </HStack>
          <HStack spacing={2}>
            {renderRaiContextMenu()}
            {isLoggedIn && (
              <Heading size="sm" display={{ base: "none", lg: "block" }}>
                {`Welcome, ${user?.FirstName} ${user?.LastName}`}
              </Heading>
            )}
            <Button
              as={RouterLink}
              to="/cart"
              variant="outline"
              size="sm"
              leftIcon={
                totalQuantity !== 0 ? (
                  <Box position="relative" mt="2px" mr="2px" lineHeight="1">
                    <Box
                      id="cartCountFrame"
                      top="5px"
                      left="6px"
                      position="absolute"
                      height="9px"
                      width="15px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text
                        fontSize=".5rem"
                        color="white"
                        fontWeight="bold"
                        letterSpacing="-.5px"
                      >
                        {totalQuantity}
                      </Text>
                    </Box>

                    <Icon
                      fontSize="lg"
                      as={TbShoppingCartFilled}
                      color="gray.500"
                    />
                  </Box>
                ) : undefined
              }
              aria-label={`Link to cart`}
            >
              Cart
            </Button>
            {isLoggedIn ? (
              <Button size="sm" onClick={logout}>
                Logout
              </Button>
            ) : (
              <Button size="sm" onClick={loginDisclosure.onOpen}>
                Login
              </Button>
            )}
          </HStack>
        </HStack>
        {megaMenuDisclosure.isOpen && (
          <MegaMenu
            isOpen={megaMenuDisclosure.isOpen}
            onClose={megaMenuDisclosure.onClose}
            selectedCatalog={selectedCatalog}
            setSelectedCatalog={setSelectedCatalog}
          />
        )}
      </Container>
    </HStack>
  );
};

export default MainMenu;
