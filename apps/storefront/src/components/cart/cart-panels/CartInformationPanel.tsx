import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Input,
  Stack,
  VStack,
} from "@chakra-ui/react";
import { Address } from "ordercloud-javascript-sdk";
import { Dispatch, SetStateAction, useState } from "react";
import { DebouncedInput } from "../../shared/DebouncedInput";

type CartInformationPanelProps = {
  shippingAddress: Address;
  setShippingAddress: Dispatch<SetStateAction<Address>>;
  handleSaveShippingAddress: (address: Address) => void;
};

const UK_DEMO_ADDRESSES: Address[] = [
  {
    FirstName: "Bristan",
    LastName: "Demo",
    CompanyName: "Bristan Group",
    Street1: "1 Brassware Way",
    Street2: "Unit 4",
    City: "Tamworth",
    State: "Staffordshire",
    Zip: "B77 5PN",
    Country: "GB",
    Phone: "+44 1827 010 100",
  },
  {
    FirstName: "Trade",
    LastName: "Buyer",
    CompanyName: "North Supplies Ltd",
    Street1: "24 Merchant Park",
    Street2: "",
    City: "Manchester",
    State: "Greater Manchester",
    Zip: "M1 4BT",
    Country: "GB",
    Phone: "+44 161 496 0100",
  },
  {
    FirstName: "Marketplace",
    LastName: "Buyer",
    CompanyName: "Approved Merchant Demo",
    Street1: "8 Canal Street",
    Street2: "Floor 2",
    City: "Birmingham",
    State: "West Midlands",
    Zip: "B1 1AA",
    Country: "GB",
    Phone: "+44 121 496 0100",
  },
  {
    FirstName: "Spare",
    LastName: "Parts",
    CompanyName: "Installer Demo",
    Street1: "15 Plumbers Yard",
    Street2: "",
    City: "Leeds",
    State: "West Yorkshire",
    Zip: "LS1 4AP",
    Country: "GB",
    Phone: "+44 113 496 0100",
  },
];

export const CartInformationPanel = ({
  shippingAddress,
  setShippingAddress,
  handleSaveShippingAddress,
}: CartInformationPanelProps) => {
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const handlePhoneChange = (value: string | number) => {
    setShippingAddress({
      ...shippingAddress,
      Phone: value.toString(),
    });
    setFormErrors((prev) => ({
      ...prev,
      Phone: !value.toString().trim(),
    }));
  };

  const useDemoAddress = () => {
    const demoAddress =
      UK_DEMO_ADDRESSES[Math.floor(Math.random() * UK_DEMO_ADDRESSES.length)];
    setShippingAddress({ ...demoAddress });
    setFormErrors({});
  };

  const validateFields = () => {
    const newErrors: Record<string, boolean> = {};
    const requiredFields = ["Street1", "City", "Zip", "Phone"] as const;

    requiredFields.forEach((field) => {
      if (!shippingAddress?.[field]) {
        newErrors[field] = true;
      }
    });

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormSubmit = () => {
    const ukShippingAddress = { ...shippingAddress, Country: "GB" };
    setShippingAddress(ukShippingAddress);
    if (validateFields()) {
      handleSaveShippingAddress(ukShippingAddress);
    }
  };

  return (
    <VStack alignItems="stretch" as="form">
      <Heading size="md" my={6}>
        Shipping address
      </Heading>

      <Stack direction={["column", "row"]} spacing={6} align="center">
        <Button type="button" onClick={useDemoAddress}>
          Use demo address
        </Button>
        <FormLabel m={0} color="gray.600" fontSize="sm">
          Use a demo-safe UK address for walkthroughs. Shipping options and
          costs are calculated after the address is confirmed.
        </FormLabel>
      </Stack>

      <Stack direction={["column", "row"]} spacing={6}>
        <FormControl isInvalid={formErrors.FirstName}>
          <FormLabel>First name</FormLabel>
          <Input
            name="FirstName"
            placeholder="Enter first name"
            value={shippingAddress?.FirstName || ""}
            onChange={(e) =>
              setShippingAddress({
                ...shippingAddress,
                FirstName: e.target.value,
              })
            }
          />
          {formErrors.FirstName && (
            <FormErrorMessage>First name is required.</FormErrorMessage>
          )}
        </FormControl>

        <FormControl isInvalid={formErrors.LastName}>
          <FormLabel>Last name</FormLabel>
          <Input
            name="LastName"
            placeholder="Enter last name"
            value={shippingAddress?.LastName || ""}
            onChange={(e) =>
              setShippingAddress({
                ...shippingAddress,
                LastName: e.target.value,
              })
            }
          />
          {formErrors.LastName && (
            <FormErrorMessage>Last name is required.</FormErrorMessage>
          )}
        </FormControl>
      </Stack>

      <FormControl>
        <FormLabel>Company, optional</FormLabel>
        <Input
          name="CompanyName"
          placeholder="Enter company name"
          value={shippingAddress?.CompanyName || ""}
          onChange={(e) =>
            setShippingAddress({
              ...shippingAddress,
              CompanyName: e.target.value,
            })
          }
        />
      </FormControl>

      <HStack gap="6">
        <FormControl isRequired isInvalid={formErrors.Street1}>
          <FormLabel>Address line 1</FormLabel>
          <Input
            name="Street1"
            placeholder="Enter address line 1"
            value={shippingAddress?.Street1 || ""}
            onChange={(e) =>
              setShippingAddress({
                ...shippingAddress,
                Street1: e.target.value,
              })
            }
          />
          {formErrors.Street1 && (
            <FormErrorMessage>Address line 1 is required.</FormErrorMessage>
          )}
        </FormControl>

        <FormControl flexBasis="75%">
          <FormLabel>Address line 2, optional</FormLabel>
          <Input
            name="Street2"
            placeholder="Enter address line 2"
            value={shippingAddress?.Street2 || ""}
            onChange={(e) =>
              setShippingAddress({
                ...shippingAddress,
                Street2: e.target.value,
              })
            }
          />
        </FormControl>
      </HStack>

      <Stack direction={["column", "row"]} spacing={6}>
        <FormControl isRequired isInvalid={formErrors.City}>
          <FormLabel>Town / City</FormLabel>
          <Input
            name="City"
            placeholder="Enter town or city"
            value={shippingAddress?.City || ""}
            onChange={(e) =>
              setShippingAddress({
                ...shippingAddress,
                City: e.target.value,
              })
            }
          />
          {formErrors.City && (
            <FormErrorMessage>Town / City is required.</FormErrorMessage>
          )}
        </FormControl>

        <FormControl isInvalid={formErrors.State}>
          <FormLabel>County, optional</FormLabel>
          <Input
            name="State"
            placeholder="Enter county"
            value={shippingAddress?.State || ""}
            onChange={(e) =>
              setShippingAddress({
                ...shippingAddress,
                State: e.target.value,
              })
            }
          />
        </FormControl>

        <FormControl flexBasis="50%" isRequired isInvalid={formErrors.Zip}>
          <FormLabel>Postcode</FormLabel>
          <Input
            placeholder="Enter postcode"
            value={shippingAddress?.Zip || ""}
            onChange={(e) =>
              setShippingAddress({
                ...shippingAddress,
                Zip: e.target.value,
              })
            }
          />
          {formErrors.Zip && (
            <FormErrorMessage>Postcode is required.</FormErrorMessage>
          )}
        </FormControl>
      </Stack>

      <Stack direction={["column", "row"]} spacing={6}>
        <FormControl isRequired>
          <FormLabel>Country</FormLabel>
          <Input value="United Kingdom" isReadOnly />
        </FormControl>
        <FormControl isRequired isInvalid={formErrors.Phone}>
          <FormLabel>Phone number</FormLabel>
          <DebouncedInput
            name="Phone"
            placeholder="Enter phone number"
            value={shippingAddress?.Phone || ""}
            onChange={handlePhoneChange}
          />
          {formErrors.Phone && (
            <FormErrorMessage>Phone number is required.</FormErrorMessage>
          )}
        </FormControl>
      </Stack>

      <Button alignSelf="flex-end" onClick={handleFormSubmit} mt={6}>
        Continue to shipping
      </Button>
    </VStack>
  );
};
