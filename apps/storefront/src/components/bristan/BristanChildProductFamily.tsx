import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Container,
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
  useToast,
} from "@chakra-ui/react";
import { BuyerProduct, Me, OrderCloudError } from "ordercloud-javascript-sdk";
import pluralize from "pluralize";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useShopper } from "@ordercloud/react-sdk";
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
  const { addCartLineItem } = useShopper();
  const [children, setChildren] = useState<BuyerProduct[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(true);
  const [childLoadError, setChildLoadError] = useState<string>();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingProductId, setAddingProductId] = useState<string>();

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
      <SimpleGrid gridTemplateColumns={{ lg: "1.2fr 1.8fr" }} gap={12} w="full">
        <ProductImageGallery images={product.xp?.Images || []} />
        <VStack alignItems="flex-start" gap={4}>
          <Badge colorScheme="primary">{product.xp?.BrandRange || "Bristan"}</Badge>
          <Heading maxW="2xl" size="xl">{product.Name}</Heading>
          <Text color="chakra-subtle-text" fontSize="sm">
            Product code: {product.xp?.ProductCode || product.ID}
          </Text>
          <Text fontSize="3xl" fontWeight="medium">{formatPrice(displayPrice)}</Text>
          <Text maxW="prose">{product.xp?.Description || product.Description}</Text>
          {product.xp?.Features?.length > 0 && (
            <UnorderedList spacing={1} pl={4}>
              {product.xp.Features.map((feature: string) => (
                <ListItem key={feature}>{feature}</ListItem>
              ))}
            </UnorderedList>
          )}
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            Select the complete tap or a spare part below. This parent product is not directly orderable.
          </Alert>
        </VStack>
      </SimpleGrid>

      <Box mt={10}>
        {isLoadingChildren ? (
          <HStack><Spinner /><Text>Loading purchase options…</Text></HStack>
        ) : childLoadError ? (
          <Alert status="warning" borderRadius="md"><AlertIcon />{childLoadError}</Alert>
        ) : (
          <VStack align="stretch" gap={8}>
            {completeChild && (
              <Card borderWidth="1px" borderColor="primary.200">
                <CardBody>
                  <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} alignItems="center">
                    <Box>
                      <Heading size="md">Buy complete tap</Heading>
                      <Text color="chakra-subtle-text" fontSize="sm">
                        {completeChild.xp?.PartNumber}
                      </Text>
                    </Box>
                    <Text fontSize="2xl" fontWeight="semibold">
                      {formatPrice(completeChild.PriceSchedule?.PriceBreaks?.[0]?.Price)}
                    </Text>
                    <HStack justify={{ md: "flex-end" }}>
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
                    </HStack>
                  </SimpleGrid>
                </CardBody>
              </Card>
            )}

            <Box>
              <Heading size="lg" mb={2}>Spare parts</Heading>
              <Text color="chakra-subtle-text" mb={1}>{product.xp?.SparesNote}</Text>
              <Text color="chakra-subtle-text" mb={4}>{product.xp?.ExpectedSparesDelivery}</Text>
              {product.xp?.SparesDiagramUrl && (
                <Link color="primary.600" href={product.xp.SparesDiagramUrl} isExternal>View diagram</Link>
              )}
              <TableContainer display={{ base: "none", md: "block" }}>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Diagram #</Th>
                      <Th>Part name</Th>
                      <Th>Part number</Th>
                      <Th isNumeric>Price</Th>
                      <Th>Quantity</Th>
                      <Th>Add to cart</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {spareParts.map((part) => (
                      <Tr key={part.ID}>
                        <Td>{part.xp?.DiagramNumber}</Td>
                        <Td>{part.Name}</Td>
                        <Td>{part.xp?.PartNumber}</Td>
                        <Td isNumeric>{formatPrice(part.PriceSchedule?.PriceBreaks?.[0]?.Price)}</Td>
                        <Td>
                          <OcQuantityInput
                            controlId={`qty-${part.ID}`}
                            priceSchedule={part.PriceSchedule}
                            quantity={quantities[part.ID!] ?? 1}
                            onChange={(value) => setQuantities((current) => ({ ...current, [part.ID!]: value }))}
                          />
                        </Td>
                        <Td>
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
                      <VStack align="stretch">
                        <HStack justify="space-between"><Badge>Diagram {part.xp?.DiagramNumber}</Badge><Text fontWeight="semibold">{formatPrice(part.PriceSchedule?.PriceBreaks?.[0]?.Price)}</Text></HStack>
                        <Heading size="sm">{part.Name}</Heading>
                        <Text fontSize="sm" color="chakra-subtle-text">Part number: {part.xp?.PartNumber}</Text>
                        <HStack>
                          <OcQuantityInput controlId={`qty-${part.ID}`} priceSchedule={part.PriceSchedule} quantity={quantities[part.ID!] ?? 1} onChange={(value) => setQuantities((current) => ({ ...current, [part.ID!]: value }))} />
                          <Button size="sm" onClick={() => addChildToCart(part)} isLoading={addingProductId === part.ID}>Add to cart</Button>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>
                ))}
              </VStack>
            </Box>
          </VStack>
        )}
      </Box>
    </Container>
  );
};

export default BristanChildProductFamily;
