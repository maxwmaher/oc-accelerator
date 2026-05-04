import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Box,
  Badge,
  Button,
  Card,
  CardBody,
  Container,
  Heading,
  HStack,
  Icon,
  Image,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
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
import { DEFAULT_BRAND } from "../assets/DEFAULT_BRAND";
import { BRAND_LOGO_DARK, BRAND_LOGO_LIGHT } from "../constants";
import { useCurrentUser } from "../hooks/currentUser";
import { useSellerContext } from "../context/SellerContext";
import MegaMenu from "../Layout/MegaMenu";

interface MainMenuProps {
  loginDisclosure: UseDisclosureProps;
}

const MainMenu: FC<MainMenuProps> = ({ loginDisclosure }) => {
  const { data: user } = useCurrentUser();
  const { isLoggedIn, logout } = useOrderCloudContext();
  const megaMenuDisclosure = useDisclosure();
  const [selectedCatalog, setSelectedCatalog] = useState<string>("");

  const { orderWorksheet, deleteCart } = useShopper();
  const {
    selectedSeller,
    availableSuppliers,
    loadingSuppliers,
    setSelectedSeller,
  } = useSellerContext();

  const { data: catalogData } = useOcResourceList<Catalog>(
    "Me.Catalogs",
    undefined,
    undefined,
    { staleTime: 300000 }
  );

  const catalogs = useMemo(() => catalogData?.Items ?? [], [catalogData]);

  const activeCatalogId = catalogs.length > 0 ? catalogs[0]?.ID : undefined;

  const { data: categoryData } = useOcResourceList<Category>(
    "Me.Categories",
    activeCatalogId ? { catalogId: activeCatalogId } : undefined,
    undefined,
    { staleTime: 300000 }
  );

  const categories = useMemo(() => categoryData?.Items ?? [], [categoryData]);
  const selectedCatalogName = useMemo(
    () => catalogs.find((catalog) => catalog.ID === selectedCatalog)?.Name || "",
    [catalogs, selectedCatalog]
  );
  const isUsedPartsPortal = useMemo(
    () => /used/i.test(selectedCatalogName),
    [selectedCatalogName]
  );
  const portalLabel = isUsedPartsPortal
    ? "Used Parts Buyer Portal"
    : "Customer Portal / SPO";
  const sellerDisclosure = useDisclosure({ defaultIsOpen: false });

  const sellerOptionMeta: Record<string, { label: string; description: string }> = {
    [user?.Seller?.ID || "admin"]: {
      label: "Scania Direct",
      description: "Purchase directly from Scania-managed catalog and pricing.",
    },
  };

  availableSuppliers.forEach((supplier) => {
    const name = (supplier.Name || "").toLowerCase();
    const isUsed = /used/.test(name);
    const isAxles = /axle/.test(name);
    sellerOptionMeta[supplier.SupplierID] = {
      label: isUsed ? "Used Parts Supplier" : isAxles ? "Axles Supplier" : supplier.Name || supplier.SupplierID,
      description: isUsed
        ? "Browse available used and refurbished components."
        : isAxles
          ? "Shop axle-related parts and supplier-specific pricing."
          : "Shop supplier catalog and supplier-specific pricing.",
    };
  });

  useEffect(() => {
    if (!selectedCatalog && catalogs?.length)
      setSelectedCatalog(catalogs[0].ID);
  }, [catalogs, selectedCatalog]);

  useEffect(() => {
    if (isLoggedIn && !selectedSeller) {
      sellerDisclosure.onOpen();
    }
  }, [isLoggedIn, selectedSeller, sellerDisclosure]);

  const onSelectSeller = async (sellerType: "admin" | "supplier", sellerID: string, displayName: string) => {
    const hasExistingCartItems = Boolean(orderWorksheet?.LineItems?.length);
    const hasChangedSeller =
      selectedSeller &&
      (selectedSeller.sellerID !== sellerID || selectedSeller.sellerType !== sellerType);

    if (hasExistingCartItems && hasChangedSeller) {
      const shouldSwitch = window.confirm(
        "Changing who you buy from will clear your current cart. Continue?"
      );
      if (!shouldSwitch) return;
      await deleteCart();
    }

    setSelectedSeller({ sellerType, sellerID, displayName });
    sellerDisclosure.onClose();
  };

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
            <Badge colorScheme={isUsedPartsPortal ? "orange" : "blue"} px={2} py={1}>
              {portalLabel}
            </Badge>
            {categories.length > 0 && (
              <Button
                isActive={megaMenuDisclosure.isOpen}
                size="sm"
                variant="ghost"
                onClick={megaMenuDisclosure.onToggle}
              >
                {isUsedPartsPortal ? "Used Parts Categories" : "Categories"}
              </Button>
            )}
            {renderCatalogMenu()}
            <Button as={RouterLink} to="/orders" size="sm" variant="ghost">
              My Orders
            </Button>
            {isLoggedIn && (
              <Badge colorScheme="teal" px={2} py={1}>
                Buying from: {selectedSeller?.displayName || "Not selected"}
              </Badge>
            )}
            {isLoggedIn && (
              <Button type="button" size="xs" variant="outline" onClick={() => sellerDisclosure.onOpen()} aria-label="Change seller">
                Change seller
              </Button>
            )}
          </HStack>
          <HStack>
            {isLoggedIn && (
              <Heading size="sm">
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
      <Modal
        isOpen={sellerDisclosure.isOpen}
        onClose={sellerDisclosure.onClose}
        closeOnOverlayClick
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Change seller</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Text fontSize="sm" color="gray.600" mb={4}>
              Choose which seller catalog and pricing context you want to shop from.
            </Text>
            <HStack alignItems="stretch" flexDirection="column" spacing={3}>
              <Card
                as="button"
                textAlign="left"
                borderWidth={selectedSeller?.sellerType === "admin" ? "2px" : "1px"}
                borderColor={selectedSeller?.sellerType === "admin" ? "blue.500" : "gray.200"}
                onClick={() => onSelectSeller("admin", user?.Seller?.ID || "admin", "Scania Direct")}
              >
                <CardBody>
                  <Heading size="sm">Scania Direct</Heading>
                  <Text fontSize="sm" color="chakra-subtle-text">
                    Purchase directly from Scania-managed catalog and pricing.
                  </Text>
                </CardBody>
              </Card>
              {loadingSuppliers ? (
                <Spinner />
              ) : (
                availableSuppliers.map((supplier) => {
                  const option = sellerOptionMeta[supplier.SupplierID];
                  const isSelected =
                    selectedSeller?.sellerType === "supplier" &&
                    selectedSeller?.sellerID === supplier.SupplierID;

                  return (
                    <Card
                      key={supplier.SupplierID}
                      as="button"
                      textAlign="left"
                      borderWidth={isSelected ? "2px" : "1px"}
                      borderColor={isSelected ? "blue.500" : "gray.200"}
                      onClick={() =>
                        onSelectSeller(
                          "supplier",
                          supplier.SupplierID,
                          option?.label || supplier.Name || supplier.SupplierID
                        )
                      }
                    >
                      <CardBody>
                        <Heading size="sm">{option?.label || supplier.Name || supplier.SupplierID}</Heading>
                        <Text fontSize="sm" color="chakra-subtle-text">
                          {option?.description || "Shop supplier catalog and supplier-specific pricing."}
                        </Text>
                      </CardBody>
                    </Card>
                  );
                })
              )}
            </HStack>
          </ModalBody>
        </ModalContent>
      </Modal>

    </HStack>
  );
};

export default MainMenu;
