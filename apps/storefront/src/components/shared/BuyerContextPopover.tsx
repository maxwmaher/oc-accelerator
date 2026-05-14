import {
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Stack,
  Text,
} from "@chakra-ui/react";
import { MeUser } from "ordercloud-javascript-sdk";
import { FC } from "react";
import { IS_AUTO_APPLY } from "../../constants";
import type { SellerSelection } from "../../context/SellerContext";

interface BuyerContextPopoverProps {
  user?: MeUser;
  selectedSeller?: SellerSelection;
  activeCatalog?: {
    id?: string;
    name?: string;
  };
}

const formatBoolean = (value: boolean) => (value ? "Enabled" : "Disabled");

const getUserName = (user?: MeUser) =>
  [user?.FirstName, user?.LastName].filter(Boolean).join(" ") || undefined;

type BuyerContextUser = MeUser & {
  Buyer?: MeUser["Buyer"] & { Name?: string };
  CompanyName?: string;
  xp?: {
    BuyerName?: string;
    CompanyName?: string;
    companyName?: string;
  };
};

const getBuyerCompanyID = (user?: MeUser) => user?.Buyer?.ID || user?.CompanyID;

const getBuyerCompanyName = (user?: MeUser) => {
  const contextUser = user as BuyerContextUser | undefined;
  return (
    contextUser?.Buyer?.Name ||
    contextUser?.CompanyName ||
    contextUser?.xp?.BuyerName ||
    contextUser?.xp?.CompanyName ||
    contextUser?.xp?.companyName
  );
};

const ContextRow: FC<{ label: string; value?: string }> = ({
  label,
  value,
}) => (
  <HStack align="start" justify="space-between" gap={4}>
    <Text color="chakra-subtle-text" fontSize="xs" minW="32">
      {label}
    </Text>
    <Text
      fontSize="sm"
      fontWeight="medium"
      textAlign="right"
      wordBreak="break-word"
    >
      {value || "Not available"}
    </Text>
  </HStack>
);

const BuyerContextPopover: FC<BuyerContextPopoverProps> = ({
  user,
  selectedSeller,
  activeCatalog,
}) => {
  const buyerCompanyID = getBuyerCompanyID(user);
  const catalogValue = activeCatalog?.id
    ? activeCatalog.name
      ? `${activeCatalog.name} (${activeCatalog.id})`
      : activeCatalog.id
    : undefined;

  return (
    <Popover placement="bottom-end" strategy="fixed">
      <PopoverTrigger>
        <Button size="xs" variant="outline" colorScheme="teal">
          Buyer Context
        </Button>
      </PopoverTrigger>
      <PopoverContent maxW={{ base: "calc(100vw - 2rem)", md: "sm" }}>
        <PopoverArrow />
        <PopoverHeader>
          <HStack justify="space-between" align="center">
            <Text fontWeight="semibold">Active buyer context</Text>
            <Badge colorScheme="teal" variant="subtle">
              Read-only
            </Badge>
          </HStack>
        </PopoverHeader>
        <PopoverBody>
          <Stack spacing={3}>
            <Box>
              <Text fontSize="sm" color="chakra-subtle-text">
                OrderCloud resolves catalog access, product visibility, pricing,
                promotions, and seller context from the active buyer/user
                context.
              </Text>
            </Box>
            <Divider />
            <Stack spacing={2}>
              <ContextRow label="Current user" value={getUserName(user)} />
              <ContextRow label="User ID" value={user?.ID} />
              <ContextRow label="Buyer/company ID" value={buyerCompanyID} />
              <ContextRow
                label="Buyer/company name"
                value={getBuyerCompanyName(user)}
              />
              <ContextRow
                label="Buying from"
                value={selectedSeller?.displayName}
              />
              <ContextRow
                label="Seller context ID"
                value={selectedSeller?.sellerID}
              />
              <ContextRow label="Active catalog" value={catalogValue} />
              <ContextRow
                label="Auto-apply promotions"
                value={formatBoolean(IS_AUTO_APPLY)}
              />
            </Stack>
          </Stack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default BuyerContextPopover;
