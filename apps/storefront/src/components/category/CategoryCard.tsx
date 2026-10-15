import { Card, CardBody, Heading, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { Category } from "ordercloud-javascript-sdk";
import { FunctionComponent } from "react";
import { TbArrowRight } from "react-icons/tb";
import { Link as RouterLink } from "react-router-dom";

interface CategoryCardProps {
  category: Category;
  catalogId?: string;
}

const CategoryCard: FunctionComponent<CategoryCardProps> = ({ category, catalogId }) => (
  <Card
    as={RouterLink}
    to={category.ChildCount ? `/shop/${catalogId}/categories/${category.ID}` : `/shop/${catalogId}/categories/${category.ID}/products`}
    minH="158px"
    h="full"
    border="1px solid"
    borderColor="trade.border"
    borderRadius="lg"
    boxShadow="none"
    textDecoration="none"
    _hover={{ borderColor: "trade.gold", boxShadow: "sm" }}
    _focusVisible={{ outline: "3px solid", outlineColor: "trade.gold", outlineOffset: "3px" }}
  >
    <CardBody p={6} display="flex" flexDirection="column" justifyContent="space-between" gap={5}>
      <Stack spacing={2}>
        <Heading as="h3" size="md" lineHeight="short">{category.Name}</Heading>
        {category.xp?.Description && <Text color="trade.muted" fontSize="sm">{category.xp.Description}</Text>}
      </Stack>
      <HStack justify="space-between" color="trade.muted" fontSize="sm"><Text>{category.ChildCount ? "Browse categories" : "View products"}</Text><Icon as={TbArrowRight} boxSize={5} aria-hidden /></HStack>
    </CardBody>
  </Card>
);

export default CategoryCard;
