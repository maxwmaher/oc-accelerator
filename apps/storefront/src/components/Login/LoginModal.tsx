import {
  Box, Center, Flex, Heading, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalOverlay, Stack, Text, UseDisclosureReturn,
} from "@chakra-ui/react";
import { useOrderCloudContext } from "@ordercloud/react-sdk";
import { FC, useRef } from "react";
import LoginForm from "../Login/LoginForm";
import CountrySelector from "../CountrySelector";
import { ACTIVE_COUNTRY_CODE, COUNTRY_SELECTION_ENABLED } from "../../config/country";
import { countryName } from "../../utils/kfmbCountryState";
import { DemoNotice, TradeBrand, TradeFooter } from "../trade/TradePrimitives";

interface ILoginModal { disclosure: UseDisclosureReturn; }

const LoginModal: FC<ILoginModal> = ({ disclosure: { onClose, isOpen } }) => {
  const { allowAnonymous } = useOrderCloudContext();
  const initialFocusRef = useRef<HTMLInputElement>(null);
  return <Modal size={allowAnonymous ? "lg" : "full"} onClose={onClose} isOpen={isOpen} initialFocusRef={initialFocusRef} isCentered>
    <ModalOverlay />
    <ModalContent aria-labelledby="kfmb-login-heading" m={0} borderRadius={allowAnonymous ? "xl" : 0} minH={allowAnonymous ? undefined : "100dvh"}>
      {allowAnonymous && <ModalCloseButton />}
      <ModalBody p={0} display="flex" flexDirection="column">
        <Box px={{ base: 5, md: 8 }} py={6} borderTop="3px solid" borderColor="trade.gold"><Box maxW="1200px" mx="auto"><TradeBrand /></Box></Box>
        <Center flex="1" px={{ base: 4, md: 8 }} py={{ base: 4, md: 10 }}>
          <Flex maxW={allowAnonymous ? "full" : "1000px"} w="full" border="1px solid" borderColor="trade.border" borderRadius="xl" overflow="hidden" bg="white" boxShadow="0 8px 32px rgba(20,45,59,.05)" direction={{ base: "column", md: allowAnonymous ? "column" : "row" }}>
            {!allowAnonymous && <Stack display={{ base: "none", md: "flex" }} spacing={6} w={{ base: "full", md: "44%" }} bg="trade.ink" color="white" p={{ base: 6, md: 10 }} justify="center">
              <Box w="44px" h="3px" bg="trade.gold" />
              <Heading as="h2" color="white" size={{ base: "lg", md: "xl" }}>Your catalog.<br />Your trade order.</Heading>
              <Text color="white" lineHeight="tall">Browse your assigned products and pricing, build an order, and review pickup details in one place.</Text>
              <Text fontSize="sm" color="white">OrderCloud customer demo</Text>
            </Stack>}
            <Box flex="1" minW={0} p={{ base: 6, md: 10 }}>
              <Heading id="kfmb-login-heading" size="lg" mb={3}>Login {!allowAnonymous && "Required"}{COUNTRY_SELECTION_ENABLED && ` — ${countryName(ACTIVE_COUNTRY_CODE)}`}</Heading>
              <Text color="trade.muted" mb={6}>Sign in with your shopper account to start ordering.</Text>
              {COUNTRY_SELECTION_ENABLED && <Box mb={6} p={4} bg="trade.ivory" borderRadius="md"><CountrySelector /></Box>}
              <LoginForm initialFocusRef={initialFocusRef} onSuccess={onClose} />
              <DemoNotice>Demo ordering experience. Payment is simulated; no real charge is made.</DemoNotice>
            </Box>
          </Flex>
        </Center>
        {!allowAnonymous && <TradeFooter />}
      </ModalBody>
    </ModalContent>
  </Modal>;
};
export default LoginModal;
