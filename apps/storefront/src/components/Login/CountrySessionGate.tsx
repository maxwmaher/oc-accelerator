import { Center, Spinner, useDisclosure, useToast } from "@chakra-ui/react";
import { queryClient, useOrderCloudContext } from "@ordercloud/react-sdk";
import { Me } from "ordercloud-javascript-sdk";
import { useEffect, useState, type PropsWithChildren } from "react";
import { ACTIVE_COUNTRY, COUNTRY_SELECTION_ENABLED } from "../../config/country";
import { shopperMatchesCountry } from "../../utils/kfmbCountryState";
import LoginModal from "./LoginModal";

/** Resolve the buyer before mounting any catalog/cart callers, including confirmation. */
export default function CountrySessionGate({ children }: PropsWithChildren) {
  const { isAuthenticated, token, logout } = useOrderCloudContext();
  const [validatedToken, setValidatedToken] = useState<string>();
  const disclosure = useDisclosure();
  const toast = useToast();
  useEffect(() => {
    if (!COUNTRY_SELECTION_ENABLED) return;
    if (!isAuthenticated || !token) { setValidatedToken(undefined); return; }
    let active = true;
    Me.Get().then((user) => {
      if (!active) return;
      if (!shopperMatchesCountry(user, ACTIVE_COUNTRY)) throw new Error("This shopper belongs to another country. Sign in with a shopper account for the selected country.");
      queryClient.setQueryData(["currentUser"], user);
      setValidatedToken(token);
    }).catch((error: unknown) => {
      if (!active) return;
      logout();
      toast({ title: "Shopper session could not be verified", description: error instanceof Error ? error.message : "Please sign in again.", status: "error" });
    });
    return () => { active = false; };
  }, [isAuthenticated, token, logout, toast]);
  if (!COUNTRY_SELECTION_ENABLED) return <>{children}</>;
  if (!isAuthenticated) return <LoginModal disclosure={{ ...disclosure, isOpen: true, onClose: () => {} }} />;
  if (!token || validatedToken !== token) return <Center minH="100vh"><Spinner aria-label="Verifying country shopper session" /></Center>;
  return <>{children}</>;
}
