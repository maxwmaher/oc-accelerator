import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Address } from "ordercloud-javascript-sdk";
import { Dispatch, SetStateAction, useState } from "react";
import { DebouncedInput } from "../../shared/DebouncedInput";
import { US_STATES } from "../../../constants";

type CartInformationPanelProps = {
  shippingAddress: Address;
  setShippingAddress: Dispatch<SetStateAction<Address>>;
  handleSaveShippingAddress: () => void;
};

const demoAddress: Address = {
  FirstName: "Bristan",
  LastName: "Demo",
  CompanyName: "Bristan Demo",
  Street1: "1 Demo Trade Park",
  Street2: "",
  City: "Plymouth",
  State: "MN",
  Zip: "55446",
  Country: "US",
  Phone: "5550100",
};

export const CartInformationPanel = ({
  shippingAddress,
  setShippingAddress,
  handleSaveShippingAddress,
}: CartInformationPanelProps) => {
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const updateAddress = (field: keyof Address, value: string) => {
    setShippingAddress({ ...shippingAddress, [field]: value });
    setFormErrors((prev) => ({ ...prev, [field]: false }));
  };

  const fillDemoAddress = () => {
    setShippingAddress((current) => ({
      ...current,
      ...Object.fromEntries(
        Object.entries(demoAddress).filter(([key]) => !current[key as keyof Address])
      ),
    }));
    setFormErrors({});
  };

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const trimmed = cleaned.slice(0, 10);
    const match = trimmed.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!match) return trimmed;
    const [, area, prefix, line] = match;
    if (!area) return "";
    if (!prefix) return `(${area}`;
    if (!line) return `(${area}) ${prefix}`;
    return `(${area}) ${prefix}-${line}`;
  };

  const handlePhoneChange = (value: string | number) => {
    const rawValue = value.toString().replace(/\D/g, "").slice(0, 10);
    updateAddress("Phone", rawValue);
  };

  const validateFields = () => {
    const newErrors: Record<string, boolean> = {};
    const requiredFields = ["Street1", "City", "State", "Zip"] as const;
    requiredFields.forEach((field) => {
      if (!shippingAddress?.[field]) newErrors[field] = true;
    });
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormSubmit = () => {
    if (validateFields()) handleSaveShippingAddress();
  };

  return (
    <VStack alignItems="stretch" as="form" spacing={5} onSubmit={(event) => event.preventDefault()}>
      <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" p={5} bg="white">
        <HStack justify="space-between" align="start" mb={4} gap={4} flexWrap="wrap">
          <Box>
            <Heading as="h2" size="md">Contact</Heading>
            <Text color="gray.600" fontSize="sm">We will use this for delivery updates on your Bristan order.</Text>
          </Box>
          <Button size="sm" variant="outline" onClick={fillDemoAddress}>Use demo address</Button>
        </HStack>
        <FormControl>
          <FormLabel>Phone number</FormLabel>
          <DebouncedInput
            name="Phone"
            placeholder="555-0100"
            value={formatPhoneNumber(shippingAddress?.Phone || "")}
            onChange={handlePhoneChange}
          />
          <FormHelperText>Demo-safe contact details are fine for walkthroughs.</FormHelperText>
        </FormControl>
      </Box>

      <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" p={5} bg="white">
        <Heading as="h2" size="md" mb={1}>Shipping address</Heading>
        <Text color="gray.600" fontSize="sm" mb={4}>Required fields are marked with an asterisk.</Text>
        <Stack spacing={4}>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <FormControl isInvalid={formErrors.FirstName}>
              <FormLabel>First name</FormLabel>
              <Input name="FirstName" placeholder="First name" value={shippingAddress?.FirstName || ""} onChange={(e) => updateAddress("FirstName", e.target.value)} />
              <FormErrorMessage>First name is required.</FormErrorMessage>
            </FormControl>
            <FormControl isInvalid={formErrors.LastName}>
              <FormLabel>Last name</FormLabel>
              <Input name="LastName" placeholder="Last name" value={shippingAddress?.LastName || ""} onChange={(e) => updateAddress("LastName", e.target.value)} />
              <FormErrorMessage>Last name is required.</FormErrorMessage>
            </FormControl>
          </SimpleGrid>
          <FormControl>
            <FormLabel>Company (optional)</FormLabel>
            <Input name="CompanyName" placeholder="Company name" value={shippingAddress?.CompanyName || ""} onChange={(e) => updateAddress("CompanyName", e.target.value)} />
          </FormControl>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <FormControl isRequired isInvalid={formErrors.Street1} gridColumn={{ md: "span 2" }}>
              <FormLabel>Street address</FormLabel>
              <Input name="Street1" placeholder="Street address" value={shippingAddress?.Street1 || ""} onChange={(e) => updateAddress("Street1", e.target.value)} />
              <FormErrorMessage>Street address is required.</FormErrorMessage>
            </FormControl>
            <FormControl>
              <FormLabel>Apartment, suite (optional)</FormLabel>
              <Input name="Street2" placeholder="Suite or unit" value={shippingAddress?.Street2 || ""} onChange={(e) => updateAddress("Street2", e.target.value)} />
            </FormControl>
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <FormControl isRequired isInvalid={formErrors.City}>
              <FormLabel>City</FormLabel>
              <Input name="City" placeholder="City" value={shippingAddress?.City || ""} onChange={(e) => updateAddress("City", e.target.value)} />
              <FormErrorMessage>City is required.</FormErrorMessage>
            </FormControl>
            <FormControl isRequired isInvalid={formErrors.State}>
              <FormLabel>State</FormLabel>
              <Select name="State" placeholder="Select state" value={shippingAddress?.State || ""} onChange={(e) => updateAddress("State", e.target.value)}>
                {US_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
              </Select>
              <FormErrorMessage>State is required.</FormErrorMessage>
            </FormControl>
            <FormControl isRequired isInvalid={formErrors.Zip}>
              <FormLabel>ZIP code</FormLabel>
              <Input name="Zip" placeholder="ZIP" value={shippingAddress?.Zip || ""} onChange={(e) => updateAddress("Zip", e.target.value)} />
              <FormErrorMessage>ZIP code is required.</FormErrorMessage>
            </FormControl>
          </SimpleGrid>
        </Stack>
      </Box>

      <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" p={5} bg="white">
        <Heading as="h2" size="md" mb={2}>Delivery preferences</Heading>
        <Text color="gray.600" fontSize="sm">Shipping options and costs are calculated after the address is confirmed.</Text>
      </Box>

      <Button alignSelf="flex-end" onClick={handleFormSubmit} mt={2} colorScheme="blue">
        Continue to shipping
      </Button>
    </VStack>
  );
};
