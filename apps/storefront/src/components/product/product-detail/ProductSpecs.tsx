import { Box, FormControl, FormErrorMessage, FormLabel, Select, Text, Textarea, VStack } from '@chakra-ui/react'
import React from 'react'
import formatPrice from '../../../utils/formatPrice'
import { SelectedSpec, SpecLike, estimateSelectedPrice, optionPriceImpact } from '../../../utils/specPricing'
interface Props { specs: SpecLike[]; selected: Record<string, SelectedSpec>; errors: string[]; basePrice: number; quantity: number; onChange: (selected: Record<string, SelectedSpec>) => void }
const ProductSpecs: React.FC<Props> = ({ specs, selected, errors, basePrice, quantity, onChange }) => {
  if (!specs.length) return null
  return <VStack align="stretch" w="full" spacing={4}>
    <Text fontWeight="semibold">Options</Text>
    {specs.sort((a,b)=>(a.ListOrder||0)-(b.ListOrder||0)).map(spec => {
      const id = spec.ID || ''; const invalid = errors.includes(spec.Name || id)
      return <FormControl key={id} isRequired={spec.Required} isInvalid={invalid}>
        <FormLabel>{spec.Name}</FormLabel>
        {spec.AllowOpenText ? <Textarea value={selected[id]?.Value || ''} onChange={e => onChange({...selected, [id]: { SpecID: id, Value: e.target.value }})} /> :
          <Select value={selected[id]?.OptionID || ''} onChange={e => onChange({...selected, [id]: { SpecID: id, OptionID: e.target.value }})}>
            <option value="">Select {spec.Name}</option>{spec.Options?.sort((a,b)=>(a as any).ListOrder-(b as any).ListOrder).map(o => <option key={o.ID} value={o.ID}>{o.Value}{optionPriceImpact(basePrice, quantity, o) ? ` (${formatPrice(optionPriceImpact(basePrice, quantity, o))})` : ''}</option>)}
          </Select>}
        {invalid && <FormErrorMessage>{spec.Name} is required.</FormErrorMessage>}
      </FormControl>
    })}
    <Box><Text fontSize="sm" color="chakra-subtle-text">Estimated selected total</Text><Text fontWeight="medium">{formatPrice(estimateSelectedPrice(basePrice, quantity, specs, selected))}</Text></Box>
  </VStack>
}
export default ProductSpecs
