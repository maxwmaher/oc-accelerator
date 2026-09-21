import { Button, FormControl, FormErrorMessage, FormLabel, Heading, Input, Text, Textarea, VStack } from "@chakra-ui/react";
import { DEFAULT_PICKUP_LOCATION } from "../../../config/pickupLocations";

export interface PickupForm { contactName: string; contact: string; notes: string; }
type Props = { pickup: PickupForm; setPickup: (value: PickupForm) => void; handleSavePickup: () => void; saving: boolean; };

export const CartInformationPanel = ({ pickup, setPickup, handleSavePickup, saving }: Props) => (
  <VStack alignItems="stretch" spacing={5} as="form" onSubmit={(event) => { event.preventDefault(); handleSavePickup(); }}>
    <Heading size="md">Pickup details</Heading>
    <Text fontWeight="semibold">{DEFAULT_PICKUP_LOCATION.label}</Text>
    <Text color="gray.600">This is a demonstration location. A delivery address and shipping method are not required.</Text>
    <FormControl isRequired isInvalid={!pickup.contactName.trim()}>
      <FormLabel>Pickup contact name</FormLabel>
      <Input value={pickup.contactName} onChange={(e) => setPickup({ ...pickup, contactName: e.target.value })} />
      {!pickup.contactName.trim() && <FormErrorMessage>Contact name is required.</FormErrorMessage>}
    </FormControl>
    <FormControl isRequired isInvalid={!pickup.contact.trim()}>
      <FormLabel>Contact information</FormLabel>
      <Input placeholder="Email or phone" value={pickup.contact} onChange={(e) => setPickup({ ...pickup, contact: e.target.value })} />
      {!pickup.contact.trim() && <FormErrorMessage>Email or phone is required.</FormErrorMessage>}
    </FormControl>
    <FormControl>
      <FormLabel>Order notes (optional)</FormLabel>
      <Textarea value={pickup.notes} onChange={(e) => setPickup({ ...pickup, notes: e.target.value })} />
    </FormControl>
    <Button type="submit" alignSelf="flex-end" isLoading={saving} isDisabled={!pickup.contactName.trim() || !pickup.contact.trim()}>
      Save pickup details and review
    </Button>
  </VStack>
);
