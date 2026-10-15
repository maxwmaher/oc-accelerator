import { Box, Stack, Text } from "@chakra-ui/react";
import { LineItem } from "ordercloud-javascript-sdk";
import { FunctionComponent } from "react";
import OcLineItemCard from "./OcLineItemCard";

interface OcLineItemListProps {
  emptyMessage?: string;
  editable?: boolean;
  currency?: string;
  lineItems?: LineItem[];
  onChange: (newLineItem: LineItem) => void;
}

const OcLineItemList: FunctionComponent<OcLineItemListProps> = ({
  emptyMessage,
  editable,
  currency,
  lineItems,
  onChange,
}) => {
  return lineItems && lineItems.length ? (
    <Stack spacing={0} w="full" divider={<Box borderBottom="1px solid" borderColor="trade.border" />}>
          {lineItems.map((li) => (
            <OcLineItemCard
              key={li.ID}
              lineItem={li}
              editable={editable}
              currency={currency}
              onChange={onChange}
            />
          ))}
    </Stack>
  ) : (
    <Text alignSelf="flex-start">{emptyMessage}</Text>
  );
};

export default OcLineItemList;
