import { FormControl, FormLabel, Select, Text } from "@chakra-ui/react";
import { queryClient, useOrderCloudContext } from "@ordercloud/react-sdk";
import { useIsMutating } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { ACTIVE_COUNTRY_CODE, COUNTRY_SELECTION_ENABLED, countryEntryUrl } from "../config/country";
import { clearCountrySessions, isCountry } from "../utils/kfmbCountryState";
import { isCartActionInProgress, subscribeCartActions } from "../utils/kfmbCartEdits";

export default function CountrySelector() {
  const { authLoading, isAuthenticated } = useOrderCloudContext();
  const mutations = useIsMutating();
  const cartBusy = useSyncExternalStore(subscribeCartActions, isCartActionInProgress);
  if (!COUNTRY_SELECTION_ENABLED) return null;
  const busy = (authLoading && isAuthenticated) || mutations > 0 || cartBusy;
  return <FormControl w="full" minW={0}>
    <FormLabel htmlFor="kfmb-country" fontSize="sm" mb={1}>Shopping country</FormLabel>
    <Select id="kfmb-country" size="sm" bg="trade.ivory" fontWeight="600" value={ACTIVE_COUNTRY_CODE} isDisabled={busy} onChange={(event) => {
      const country = event.target.value;
      if (!isCountry(country) || country === ACTIVE_COUNTRY_CODE || (authLoading && isAuthenticated) || queryClient.isMutating() || isCartActionInProgress()) return;
      clearCountrySessions(window.sessionStorage);
      window.location.assign(countryEntryUrl(country));
    }}>
      <option value="kw">Kuwait</option><option value="sa">Saudi Arabia</option>
    </Select>
    <Text fontSize="sm" color="trade.muted" mt={1} lineHeight="short" role="status">{busy ? "Please wait for the current action to finish." : "Changing country requires signing in again."}</Text>
  </FormControl>;
}
