import {
  Button,
  FormControl,
  FormLabel,
  Icon,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from "@chakra-ui/react";
import { FC, useId } from "react";
import { TbSearch, TbX } from "react-icons/tb";
import { DebouncedInput } from "../DebouncedInput";

export type ServiceListOptions = { [key: string]: ServiceListOptions | string };

interface SearchMenuProps {
  listOptions: ServiceListOptions;
  handleRoutingChange: (
    queryKey: string,
    resetPage?: boolean,
    index?: number
  ) => (value?: string | boolean | number) => void;
}

const SearchMenu: FC<SearchMenuProps> = ({ listOptions, handleRoutingChange }) => {
  const controlId = useId();
  return (
    <FormControl>
      <FormLabel htmlFor={controlId}>Search products</FormLabel>
      <InputGroup w="100%" size="md">
        <InputLeftElement pointerEvents="none" h="48px"><Icon boxSize={5} as={TbSearch} color="trade.muted" /></InputLeftElement>
        <DebouncedInput
          id={controlId}
          h="48px"
          pl={10}
          pr={(listOptions.search as string)?.length ? 12 : 3}
          placeholder="Product keyword"
          value={(listOptions.search as string) || ""}
          onChange={(value: string | number) => handleRoutingChange("search", true)(value)}
        />
        {(listOptions.search as string)?.length > 0 && <InputRightElement w="48px" h="48px"><Button aria-label="Clear product search" variant="ghost" w="44px" h="44px" minW="44px" p={0} onClick={() => handleRoutingChange("search", true)("")}><Icon as={TbX} boxSize={5} /></Button></InputRightElement>}
      </InputGroup>
    </FormControl>
  );
};

export default SearchMenu;
