import {
  Box,
  Center,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  UseDisclosureReturn,
} from "@chakra-ui/react";
import { useOrderCloudContext } from "@ordercloud/react-sdk";
import { FC, useRef } from "react";
import LoginForm from "../Login/LoginForm";

import CountrySelector from "../CountrySelector";
import { ACTIVE_COUNTRY_CODE, COUNTRY_SELECTION_ENABLED } from "../../config/country";
import { countryName } from "../../utils/kfmbCountryState";

interface ILoginModal {
  disclosure: UseDisclosureReturn;
}

const LoginModal: FC<ILoginModal> = ({ disclosure: {onClose, isOpen} }) => {
  const {allowAnonymous} = useOrderCloudContext();
  const initialFocusRef = useRef<HTMLInputElement>(null);
  return (
    <Modal
      size={allowAnonymous ? "lg" : "full"}
      onClose={onClose}
      isOpen={isOpen}
      initialFocusRef={initialFocusRef}
      isCentered
    >
      <ModalOverlay backdropFilter="blur(10px)" />
      <ModalContent>
        {allowAnonymous && <ModalCloseButton />}
        <ModalBody as={Center}>
          <Box w={allowAnonymous ? "full" : "400px"} maxW="100%" pt={5}>
            {COUNTRY_SELECTION_ENABLED && <Box mb={6}><CountrySelector /></Box>}
            <Heading size="md" textAlign="center" mb={10}>
              Login {!allowAnonymous && "Required"}{COUNTRY_SELECTION_ENABLED && ` — ${countryName(ACTIVE_COUNTRY_CODE)}`}
            </Heading>
            <LoginForm initialFocusRef={initialFocusRef} onSuccess={onClose}/>
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default LoginModal;
