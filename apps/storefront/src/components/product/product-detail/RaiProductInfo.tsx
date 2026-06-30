import {
  Box,
  Heading,
  ListItem,
  Table,
  Tbody,
  Td,
  Text,
  Tr,
  UnorderedList,
  VStack,
} from "@chakra-ui/react";
import React from "react";

interface RaiProductAttribute {
  Name: string;
  Value: string;
}

interface RaiProductInfoXp {
  Descriptions?: {
    Full?: string;
  };
  Pricing?: {
    UnitLabel?: string;
    VatText?: string;
  };
  Ordering?: {
    Deadline?: string;
    LeadTime?: string;
    Availability?: string;
    Notes?: string[];
  };
  Attributes?: RaiProductAttribute[];
  SourceCategoryPaths?: Array<string | string[]>;
}

export const getFirstSourceCategoryPathLabel = (
  sourceCategoryPaths?: unknown,
): string | undefined => {
  if (!Array.isArray(sourceCategoryPaths) || sourceCategoryPaths.length === 0) {
    return undefined;
  }

  const [firstPath] = sourceCategoryPaths;

  if (Array.isArray(firstPath)) {
    if (
      firstPath.length === 0 ||
      firstPath.some((part) => typeof part !== "string")
    ) {
      return undefined;
    }

    const label = firstPath.join(" › ");
    return label || undefined;
  }

  if (typeof firstPath === "string") {
    const label = firstPath.includes(" > ")
      ? firstPath.split(" > ").join(" › ")
      : firstPath;

    return label || undefined;
  }

  return undefined;
};

const RaiProductInfo: React.FC<{ rai?: RaiProductInfoXp }> = ({ rai }) => {
  const sourceCategoryPathLabel = getFirstSourceCategoryPathLabel(
    rai?.SourceCategoryPaths,
  );

  return !rai ? null : (
    <VStack align="stretch" spacing={4} w="full">
      {rai.Descriptions?.Full && (
        <Box>
          <Heading size="sm">What RAI needs to know</Heading>
          <Text whiteSpace="pre-wrap">{rai.Descriptions.Full}</Text>
        </Box>
      )}
      {rai.Pricing?.UnitLabel && (
        <Text>
          <strong>Unit/package:</strong> {rai.Pricing.UnitLabel}
        </Text>
      )}
      {rai.Pricing?.VatText && (
        <Text>
          <strong>VAT:</strong> {rai.Pricing.VatText}
        </Text>
      )}
      {(rai.Ordering?.Deadline ||
        rai.Ordering?.LeadTime ||
        rai.Ordering?.Availability) && (
        <Box>
          <Heading size="sm">Operational notes</Heading>
          {rai.Ordering.Deadline && <Text>Deadline: {rai.Ordering.Deadline}</Text>}
          {rai.Ordering.LeadTime && <Text>Lead time: {rai.Ordering.LeadTime}</Text>}
          {rai.Ordering.Availability && (
            <Text>Availability: {rai.Ordering.Availability}</Text>
          )}
        </Box>
      )}
      {rai.Ordering?.Notes && rai.Ordering.Notes.length > 0 && (
        <UnorderedList>
          {rai.Ordering.Notes.map((note) => (
            <ListItem key={note}>{note}</ListItem>
          ))}
        </UnorderedList>
      )}
      {rai.Attributes && rai.Attributes.length > 0 && (
        <Table size="sm">
          <Tbody>
            {rai.Attributes.map((attribute) => (
              <Tr key={attribute.Name}>
                <Td fontWeight="semibold">{attribute.Name}</Td>
                <Td>{attribute.Value}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      {sourceCategoryPathLabel && (
        <Text fontSize="sm" color="chakra-subtle-text">
          Source category: {sourceCategoryPathLabel}
        </Text>
      )}
    </VStack>
  );
};

export default RaiProductInfo;
