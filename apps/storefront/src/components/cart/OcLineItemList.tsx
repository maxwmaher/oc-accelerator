import { Card, CardBody, Text, VStack } from "@chakra-ui/react";
import { LineItem } from "ordercloud-javascript-sdk";
import { FunctionComponent } from "react";
import OcLineItemCard from "./OcLineItemCard";

interface OcLineItemListProps {
  emptyMessage?: string;
  editable?: boolean;
  lineItems?: LineItem[];
  onChange: (newLineItem: LineItem) => void;
  isTradeBuyer?: boolean;
}

const OcLineItemList: FunctionComponent<OcLineItemListProps> = ({
  emptyMessage,
  editable,
  lineItems,
  onChange,
  isTradeBuyer,
}) => {
  return lineItems && lineItems.length ? (
    <VStack gap={4} alignItems="flex-start" w="full">
      <Card
        variant="outline"
        w="full"
        rounded="xl"
        bgColor="white"
        borderColor="gray.200"
      >
        <CardBody display="flex" flexDirection="column" gap={2}>
          {lineItems.map((li, idx) => (
            <OcLineItemCard
              key={idx}
              lineItem={li}
              editable={editable}
              onChange={onChange}
              isTradeBuyer={isTradeBuyer}
            />
          ))}
        </CardBody>
      </Card>
    </VStack>
  ) : (
    <Text alignSelf="flex-start">{emptyMessage}</Text>
  );
};

export default OcLineItemList;
