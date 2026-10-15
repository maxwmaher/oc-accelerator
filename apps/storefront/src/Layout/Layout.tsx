import {
  Container,
  Box,
  useDisclosure,
} from "@chakra-ui/react";
import { useOrderCloudContext } from "@ordercloud/react-sdk";
import { FC, useEffect } from "react";
import { Outlet } from "react-router-dom";
import MainMenu from "../Layout/MainMenu";
import LoginModal from "../components/Login/LoginModal";
import { TradeFooter } from "../components/trade/TradePrimitives";

const Layout: FC = () => {
  const { allowAnonymous, isAuthenticated, isLoggedIn } =
    useOrderCloudContext();
  const loginDisclosure = useDisclosure();

  useEffect(() => {
    if (!allowAnonymous && !isAuthenticated) {
      loginDisclosure.onOpen();
    } else if (loginDisclosure.isOpen && isLoggedIn) {
      loginDisclosure.onClose();
    }
  }, [loginDisclosure, allowAnonymous, isAuthenticated, isLoggedIn]);

  return (
    <Box minH="100dvh" display="flex" flexDirection="column" bg="trade.ivory">
      <Box as="a" href="#outletWrapper" position="absolute" left={4} top="-100px" bg="trade.ink" color="white" p={3} zIndex={100} _focus={{ top: 4 }}>Skip to content</Box>
      <LoginModal disclosure={loginDisclosure} />
      <MainMenu loginDisclosure={loginDisclosure} />
      <Container as="main" id="outletWrapper" tabIndex={-1} maxW="1320px" px={{ base: 4, md: 6, xl: 8 }} py={{ base: 6, md: 10 }} flex="1" w="full" minW={0}>
        <Outlet />
      </Container>
      <TradeFooter />
    </Box>
  );
};

export default Layout;
