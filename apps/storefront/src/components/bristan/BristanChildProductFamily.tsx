import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Collapse,
  Container,
  Divider,
  Heading,
  HStack,
  Link,
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  UnorderedList,
  ListItem,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { BuyerProduct, Me, OrderCloudError } from "ordercloud-javascript-sdk";
import pluralize from "pluralize";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useShopper } from "@ordercloud/react-sdk";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import formatPrice from "../../utils/formatPrice";
import OcQuantityInput from "../cart/OcQuantityInput";
import ProductImageGallery from "../product/product-detail/ProductImageGallery";

interface BristanChildProductFamilyProps {
  product: BuyerProduct;
}

type ChildProductRole = "CompleteProduct" | "SparePart";

const roleSort = (product: BuyerProduct) =>
  product.xp?.ChildProductRole === "CompleteProduct" ? 0 : 1;

const diagramSort = (product: BuyerProduct) => {
  const value = Number.parseInt(product.xp?.DiagramNumber, 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
};

const childLineItemXp = (child: BuyerProduct) => {
  const role = child.xp?.ChildProductRole as ChildProductRole | undefined;
  const base = {
    ParentProductID: child.xp?.ParentProductID,
    ParentProductCode: child.xp?.ParentProductCode,
    ChildProductRole: role,
  };
  if (role === "SparePart") {
    return {
      ...base,
      PartNumber: child.xp?.PartNumber,
      DiagramNumber: child.xp?.DiagramNumber,
    };
  }
  return base;
};

const BristanChildProductFamily: React.FC<BristanChildProductFamilyProps> = ({
  product,
}) => {
  const { catalogId } = useParams<{ catalogId: string }>();
  const toast = useToast();
  const navigate = useNavigate();
  const sparePartsSectionRef = useRef<HTMLDivElement>(null);
  const {
    isOpen: isSparesOpen,
    onOpen: onOpenSpares,
    onToggle: onToggleSpares,
  } = useDisclosure();
  const { addCartLineItem } = useShopper();
  const [children, setChildren] = useState<BuyerProduct[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(true);
  const [childLoadError, setChildLoadError] = useState<string>();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingProductId, setAddingProductId] = useState<string>();
  const [shouldScrollToSpares, setShouldScrollToSpares] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const fetchChildren = async () => {
      setIsLoadingChildren(true);
      setChildLoadError(undefined);
      try {
        const result = await Me.ListProducts<BuyerProduct>({
          catalogID: catalogId,
          pageSize: 100,
          filters: { ParentID: product.ID },
        });
        const sortedChildren = [...(result.Items ?? [])].sort(
          (a, b) => roleSort(a) - roleSort(b) || diagramSort(a) - diagramSort(b),
        );
        if (isCurrent) {
          setChildren(sortedChildren);
          setQuantities((current) => {
            const next = { ...current };
            sortedChildren.forEach((child) => {
              next[child.ID!] = next[child.ID!] ?? child.PriceSchedule?.MinQuantity ?? 1;
            });
            return next;
          });
        }
      } catch (error) {
        console.error("Failed to load Bristan child products", error);
        if (isCurrent) {
          setChildLoadError(
            "We could not load the purchase options for this tap. Please refresh or try again shortly.",
          );
        }
      } finally {
        if (isCurrent) setIsLoadingChildren(false);
      }
    };
    fetchChildren();
    return () => {
      isCurrent = false;
    };
  }, [catalogId, product.ID]);

  const completeChild = useMemo(
    () => children.find((child) => child.xp?.ChildProductRole === "CompleteProduct"),
    [children],
  );
  const spareParts = useMemo(
    () => children.filter((child) => child.xp?.ChildProductRole === "SparePart"),
    [children],
  );

  const handleViewSpareParts = useCallback(() => {
    onOpenSpares();
    setShouldScrollToSpares(true);
  }, [onOpenSpares]);

  useEffect(() => {
    if (!isSparesOpen || !shouldScrollToSpares) return;

    const animationFrame = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        sparePartsSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setShouldScrollToSpares(false);
      }, 0);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isSparesOpen, shouldScrollToSpares]);

  const addChildToCart = useCallback(
    async (child: BuyerProduct) => {
      const childID = child.ID!;
      const quantity = quantities[childID] ?? child.PriceSchedule?.MinQuantity ?? 1;
      try {
        setAddingProductId(childID);
        await addCartLineItem({
          ProductID: childID,
          Quantity: quantity,
          xp: childLineItemXp(child),
        });
        toast({
          title: `${quantity} ${pluralize("item", quantity)} added to cart`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        navigate("/cart");
      } catch (error) {
        const description =
          error instanceof OrderCloudError
            ? error.message
            : "An unexpected error occurred. Please try again.";
        toast({
          title: "Error adding to cart",
          description,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setAddingProductId(undefined);
      }
    },
    [addCartLineItem, navigate, quantities, toast],
  );

  const displayPrice =
    product.xp?.DisplayPrice ?? completeChild?.PriceSchedule?.PriceBreaks?.[0]?.Price;

  return (
    <Container maxW="container.4xl">
      <SimpleGrid gridTemplateColumns={{ lg: "1.2fr 1.8fr" }} gap={{ base: 8, lg: 12 }} w="full">
        <ProductImageGallery images={product.xp?.Images || []} />
        <VStack alignItems="flex-start" gap={4}>
          <Badge colorScheme="primary">{product.xp?.BrandRange || "Bristan"}</Badge>
          <Heading maxW="2xl" size="xl">{product.Name}</Heading>
          <Text color="chakra-subtle-text" fontSize="sm">
            Product code: {product.xp?.ProductCode || product.ID}
          </Text>
          <Text fontSize="3xl" fontWeight="medium">{formatPrice(displayPrice)}</Text>
          <Text maxW="prose">{product.xp?.Description || product.Description}</Text>

          {isLoadingChildren ? (
            <HStack
              borderWidth="1px"
              borderRadius="lg"
              p={4}
              w="full"
              maxW="2xl"
            >
              <Spinner size="sm" />
              <Text>Loading purchase options…</Text>
            </HStack>
          ) : childLoadError ? (
            <Alert status="warning" borderRadius="md" maxW="2xl">
              <AlertIcon />
              {childLoadError}
            </Alert>
          ) : completeChild ? (
            <Card
              borderWidth="1px"
              borderColor="primary.200"
              bg="primary.50"
              w="full"
              maxW="2xl"
            >
              <CardBody>
                <VStack align="stretch" gap={4}>
                  <HStack justify="space-between" align="flex-start" gap={4}>
                    <Box>
                      <Heading size="md">Buy complete tap</Heading>
                      <Text color="chakra-subtle-text" fontSize="sm" mt={1}>
                        Includes clicker waste
                      </Text>
                    </Box>
                    <Text fontSize="2xl" fontWeight="semibold" whiteSpace="nowrap">
                      {formatPrice(completeChild.PriceSchedule?.PriceBreaks?.[0]?.Price)}
                    </Text>
                  </HStack>
                  <HStack flexWrap="wrap" gap={3}>
                    <OcQuantityInput
                      controlId={`qty-${completeChild.ID}`}
                      priceSchedule={completeChild.PriceSchedule}
                      quantity={quantities[completeChild.ID!] ?? 1}
                      onChange={(value) => setQuantities((current) => ({ ...current, [completeChild.ID!]: value }))}
                    />
                    <Button
                      colorScheme="primary"
                      onClick={() => addChildToCart(completeChild)}
                      isLoading={addingProductId === completeChild.ID}
                    >
                      Add to cart
                    </Button>
                    {spareParts.length > 0 && (
                      <Button
                        variant="outline"
                        colorScheme="blue"
                        borderColor="blue.500"
                        color="blue.700"
                        bg="blue.50"
                        _hover={{ bg: "blue.100", borderColor: "blue.600" }}
                        onClick={handleViewSpareParts}
                      >
                        View spare parts
                      </Button>
                    )}
                  </HStack>
                  {spareParts.length > 0 && (
                    <Text color="chakra-subtle-text" fontSize="sm">
                      Need a replacement part? Jump straight to compatible spares.
                    </Text>
                  )}
                </VStack>
              </CardBody>
            </Card>
          ) : null}

          {product.xp?.Features?.length > 0 && (
            <UnorderedList spacing={1} pl={4}>
              {product.xp.Features.map((feature: string) => (
                <ListItem key={feature}>{feature}</ListItem>
              ))}
            </UnorderedList>
          )}
          <Text color="chakra-subtle-text" fontSize="sm">
            Order the complete tap or browse compatible spare parts.
          </Text>
        </VStack>
      </SimpleGrid>

      {!isLoadingChildren && !childLoadError && spareParts.length > 0 && (
        <Box ref={sparePartsSectionRef} mt={{ base: 8, lg: 10 }} scrollMarginTop="6rem">
          <Divider mb={4} />
          <Button
            variant="outline"
            borderColor="primary.200"
            bg="chakra-body-bg"
            w="full"
            justifyContent="space-between"
            alignItems="center"
            px={4}
            py={5}
            h="auto"
            onClick={onToggleSpares}
            rightIcon={isSparesOpen ? <FiChevronUp /> : <FiChevronDown />}
          >
            <VStack align="flex-start" gap={1} textAlign="left">
              <HStack>
                <Heading size="lg">Compatible spare parts</Heading>
                <Badge colorScheme="gray">{spareParts.length} available</Badge>
              </HStack>
              <Text color="chakra-subtle-text" fontSize="sm" fontWeight="normal">
                View and order replacement parts for this tap.
              </Text>
            </VStack>
          </Button>
          <Collapse in={isSparesOpen} animateOpacity>
            <Box pt={4}>
              <Text color="chakra-subtle-text" mb={1}>{product.xp?.SparesNote}</Text>
              <Text color="chakra-subtle-text" mb={4}>{product.xp?.ExpectedSparesDelivery}</Text>
              {product.xp?.SparesDiagramUrl && (
                <Link color="primary.600" href={product.xp.SparesDiagramUrl} isExternal>View diagram</Link>
              )}
              <TableContainer display={{ base: "none", md: "block" }} mt={4}>
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>Diagram #</Th>
                      <Th>Part name</Th>
                      <Th>Part number</Th>
                      <Th isNumeric>Price</Th>
                      <Th>Quantity</Th>
                      <Th textAlign="right">Add to cart</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {spareParts.map((part) => (
                      <Tr key={part.ID}>
                        <Td fontWeight="semibold">{part.xp?.DiagramNumber}</Td>
                        <Td>{part.Name}</Td>
                        <Td color="chakra-subtle-text">{part.xp?.PartNumber}</Td>
                        <Td isNumeric>{formatPrice(part.PriceSchedule?.PriceBreaks?.[0]?.Price)}</Td>
                        <Td>
                          <OcQuantityInput
                            controlId={`qty-${part.ID}`}
                            priceSchedule={part.PriceSchedule}
                            quantity={quantities[part.ID!] ?? 1}
                            onChange={(value) => setQuantities((current) => ({ ...current, [part.ID!]: value }))}
                          />
                        </Td>
                        <Td textAlign="right">
                          <Button size="sm" onClick={() => addChildToCart(part)} isLoading={addingProductId === part.ID}>Add to cart</Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
              <VStack display={{ base: "flex", md: "none" }} align="stretch" mt={4}>
                {spareParts.map((part) => (
                  <Card key={part.ID}>
                    <CardBody>
                      <VStack align="stretch" gap={3}>
                        <HStack justify="space-between"><Badge>Diagram {part.xp?.DiagramNumber}</Badge><Text fontWeight="semibold">{formatPrice(part.PriceSchedule?.PriceBreaks?.[0]?.Price)}</Text></HStack>
                        <Heading size="sm">{part.Name}</Heading>
                        <Text fontSize="sm" color="chakra-subtle-text">Part number: {part.xp?.PartNumber}</Text>
                        <HStack flexWrap="wrap">
                          <OcQuantityInput controlId={`qty-${part.ID}`} priceSchedule={part.PriceSchedule} quantity={quantities[part.ID!] ?? 1} onChange={(value) => setQuantities((current) => ({ ...current, [part.ID!]: value }))} />
                          <Button size="sm" onClick={() => addChildToCart(part)} isLoading={addingProductId === part.ID}>Add to cart</Button>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>
                ))}
              </VStack>
            </Box>
          </Collapse>
        </Box>
      )}
    </Container>
  );
};

export default BristanChildProductFamily;
