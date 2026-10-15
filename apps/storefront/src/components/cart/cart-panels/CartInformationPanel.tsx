import { Box, Button, Flex, FormControl, FormErrorMessage, FormHelperText, FormLabel, Heading, Icon, Input, Text, Textarea, VStack } from "@chakra-ui/react";
import { TbMapPin } from "react-icons/tb";
import { ACTIVE_PICKUP_LOCATION } from "../../../config/pickupLocations";

export interface PickupForm { contactName: string; contact: string; notes: string; }
type Props = { pickup: PickupForm; setPickup: (value: PickupForm) => void; handleSavePickup: () => void; saving: boolean; };

export const CartInformationPanel = ({ pickup, setPickup, handleSavePickup, saving }: Props) => (
  <VStack alignItems="stretch" spacing={5} as="form" onSubmit={(event) => { event.preventDefault(); handleSavePickup(); }}>
    <Heading as="h2" size="md">Pickup details</Heading>
    <Flex gap={3} bg="trade.ivory" p={4} borderRadius="md" align="flex-start"><Icon as={TbMapPin} boxSize={5} color="trade.ink" mt={.5} flexShrink={0} /><Box><Text fontWeight="semibold" mb={1}>{ACTIVE_PICKUP_LOCATION.label}</Text><Text fontSize="sm" color="trade.muted">This is a demonstration location. A delivery address and shipping method are not required.</Text></Box></Flex>
    <FormControl isRequired isInvalid={!pickup.contactName.trim()}>
      <FormLabel htmlFor="pickup-contact-name">Pickup contact name</FormLabel>
      <Input id="pickup-contact-name" autoComplete="name" value={pickup.contactName} onChange={(e) => setPickup({ ...pickup, contactName: e.target.value })} />
      {!pickup.contactName.trim() && <FormErrorMessage>Contact name is required.</FormErrorMessage>}
    </FormControl>
    <FormControl isRequired isInvalid={!pickup.contact.trim()}>
      <FormLabel htmlFor="pickup-contact">Contact information</FormLabel>
      <Input id="pickup-contact" placeholder="Email or phone" value={pickup.contact} onChange={(e) => setPickup({ ...pickup, contact: e.target.value })} />
      <FormHelperText color="trade.muted">Enter an email address or phone number for the pickup contact.</FormHelperText>
      {!pickup.contact.trim() && <FormErrorMessage>Email or phone is required.</FormErrorMessage>}
    </FormControl>
    <FormControl>
      <FormLabel htmlFor="pickup-notes">Order notes (optional)</FormLabel>
      <Textarea id="pickup-notes" minH="100px" value={pickup.notes} onChange={(e) => setPickup({ ...pickup, notes: e.target.value })} />
    </FormControl>
    <Button type="submit" alignSelf="flex-end" w={{ base: "full", md: "auto" }} h="auto" minH="48px" py={3} isLoading={saving} isDisabled={!pickup.contactName.trim() || !pickup.contact.trim()}>
      Save pickup details and review
    </Button>
  </VStack>
);
