import { LineItem } from 'ordercloud-javascript-sdk'
import { FunctionComponent } from 'react'
import OcLineItemList from './OcLineItemList'

interface OcCurrentOrderLineItemListProps {
  emptyMessage?: string;
  editable?: boolean;
  productType?: string;
  lineItems?: LineItem[];
  onChange: (newLineItem: LineItem) => void;
  isTradeBuyer?: boolean;
}

const OcCurrentOrderLineItemList: FunctionComponent<OcCurrentOrderLineItemListProps> = ({
  emptyMessage,
  editable,
  productType,
  lineItems,
  onChange,
  isTradeBuyer
}) => {
  let productItems = lineItems
  if (productType != null) {
    productItems = lineItems?.filter(function (p) {
      return p.xp?.Type == productType
    })
  }

  return (
    <OcLineItemList
      emptyMessage={emptyMessage}
      editable={editable}
      lineItems={productItems}
      onChange={onChange}
      isTradeBuyer={isTradeBuyer}
    />
  )
}

export default OcCurrentOrderLineItemList
