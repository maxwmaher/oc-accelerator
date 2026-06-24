import { Box, Heading, ListItem, Table, Tbody, Td, Text, Tr, UnorderedList, VStack } from '@chakra-ui/react'
import React from 'react'
const RaiProductInfo: React.FC<{ rai?: any }> = ({ rai }) => !rai ? null : <VStack align="stretch" spacing={4} w="full">
  {rai.Descriptions?.Full && <Box><Heading size="sm">Description</Heading><Text whiteSpace="pre-wrap">{rai.Descriptions.Full}</Text></Box>}
  {rai.Pricing?.UnitLabel && <Text><strong>Unit/package:</strong> {rai.Pricing.UnitLabel}</Text>}
  {rai.Pricing?.VatText && <Text><strong>VAT:</strong> {rai.Pricing.VatText}</Text>}
  {(rai.Ordering?.Deadline || rai.Ordering?.LeadTime || rai.Ordering?.Availability) && <Box><Heading size="sm">Ordering</Heading>{rai.Ordering.Deadline && <Text>Deadline: {rai.Ordering.Deadline}</Text>}{rai.Ordering.LeadTime && <Text>Lead time: {rai.Ordering.LeadTime}</Text>}{rai.Ordering.Availability && <Text>Availability: {rai.Ordering.Availability}</Text>}</Box>}
  {rai.Ordering?.Notes?.length > 0 && <UnorderedList>{rai.Ordering.Notes.map((n:string)=><ListItem key={n}>{n}</ListItem>)}</UnorderedList>}
  {rai.Attributes?.length > 0 && <Table size="sm"><Tbody>{rai.Attributes.map((a:any)=><Tr key={a.Name}><Td fontWeight="semibold">{a.Name}</Td><Td>{a.Value}</Td></Tr>)}</Tbody></Table>}
  {rai.SourceCategoryPaths?.[0] && <Text fontSize="sm" color="chakra-subtle-text">Source category: {rai.SourceCategoryPaths[0].join(' › ')}</Text>}
</VStack>
export default RaiProductInfo
