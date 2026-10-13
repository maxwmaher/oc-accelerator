import { LineItem } from 'ordercloud-javascript-sdk'
import { FunctionComponent } from 'react'
import OcLineItemList from './OcLineItemList'

interface OcCurrentOrderLineItemListProps {
  emptyMessage?: string;
  editable?: boolean;
  currency?: string;
  productType?: string;
  lineItems?: LineItem[];
  onChange: (newLineItem: LineItem) => void;
}

const OcCurrentOrderLineItemList: FunctionComponent<OcCurrentOrderLineItemListProps> = ({
  emptyMessage,
  editable,
  currency,
  productType,
  lineItems,
  onChange
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
      currency={currency}
      lineItems={productItems}
      onChange={onChange}
    />
  )
}

export default OcCurrentOrderLineItemList
