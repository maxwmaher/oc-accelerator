import { Button, Center, Heading, Link, SimpleGrid, Skeleton, Stack, Text } from "@chakra-ui/react";
import { Category } from "ordercloud-javascript-sdk";
import React, { FunctionComponent, useMemo } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import CategoryCard from "./CategoryCard";
import { useOcResourceList } from "@ordercloud/react-sdk";
import { PageIntro, Surface } from "../trade/TradePrimitives";

export interface CategoryListProps {
  renderItem?: (category: Category) => JSX.Element;
}

const CategoryList: FunctionComponent<CategoryListProps> = ({ renderItem }) => {
  const { catalogId, categoryId } = useParams<{ catalogId: string; categoryId?: string }>();
  const { data, isLoading, error, refetch } = useOcResourceList<Category>(
    "Me.Categories", { catalogId, ParentID: categoryId }, {},
    { staleTime: 300000, ...(!catalogId ? { disabled: true } : {}) }
  );
  const categories = useMemo(() => data?.Items, [data]);

  return (
    <>
      <Link as={RouterLink} to="/" fontSize="sm" color="trade.muted" alignSelf="flex-start" mb={5}>Home / Catalog</Link>
      <PageIntro title="Browse categories"><Text>Choose a category to find the products available to your account.</Text></PageIntro>
      {isLoading ? (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={5} role="status" aria-label="Loading categories">{[0, 1, 2].map(index => <Skeleton key={index} h="158px" borderRadius="lg" />)}</SimpleGrid>
      ) : error ? (
        <Surface><Stack spacing={3} align="flex-start"><Heading as="h2" size="md">Categories could not be loaded</Heading><Text color="trade.muted">Try again to browse this catalog.</Text><Button variant="outline" onClick={() => refetch()}>Try again</Button></Stack></Surface>
      ) : categories?.length === 0 ? (
        <Surface><Center py={8}><Stack align="center" spacing={4}><Heading as="h2" size="md">No categories found</Heading><Text color="trade.muted" textAlign="center">You can still browse the products in this catalog.</Text><Button as={RouterLink} to={`/shop/${catalogId}/products`}>Browse products</Button></Stack></Center></Surface>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={5}>
          {categories?.map(category => <React.Fragment key={category.ID}>{renderItem ? renderItem(category) : <CategoryCard category={category} catalogId={catalogId} />}</React.Fragment>)}
        </SimpleGrid>
      )}
    </>
  );
};

export default CategoryList;
