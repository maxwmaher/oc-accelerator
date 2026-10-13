import { Alert, AlertIcon } from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { type PropsWithChildren } from "react";
import { ACTIVE_COUNTRY, COUNTRY_SELECTION_ENABLED } from "../config/country";

export default function CountryCatalogGuard({ children }: PropsWithChildren) {
  const { catalogId } = useParams();
  if (COUNTRY_SELECTION_ENABLED && catalogId && catalogId !== ACTIVE_COUNTRY.catalogID) {
    return <Alert status="error"><AlertIcon />This catalog does not belong to the selected country. Use Shop All Products.</Alert>;
  }
  return <>{children}</>;
}
