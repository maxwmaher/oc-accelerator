import { FC, useCallback } from "react";
import routes from "./routes";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { IOrderCloudErrorContext, OrderCloudProvider } from "@ordercloud/react-sdk";
import {
  ALLOW_ANONYMOUS,
  BASE_API_URL,
  CLIENT_ID,
  IS_AUTO_APPLY,
  OPENID_CONNECT_CONFIG_ID,
  OPENID_CONNECT_ENABLED,
  OPENIDCONNECT_ACCESS_TOKEN_QUERY_PARAM_NAME,
  OPENIDCONNECT_IDP_ACCESS_TOKEN_QUERY_PARAM_NAME,
  OPENIDCONNECT_REFRESH_TOKEN_QUERY_PARAM_NAME
} from "./constants";
import { useToast } from "@chakra-ui/react";
import { OrderCloudError } from "ordercloud-javascript-sdk";
import GlobalLoadingIndicator from "./components/GlobalLoadingIndicator";

import { ACTIVE_COUNTRY, COUNTRY_API_URL, COUNTRY_SELECTION_ENABLED, ROUTER_BASENAME } from "./config/country";
import CountrySessionGate from "./components/Login/CountrySessionGate";

const basename = ROUTER_BASENAME;

const router = createBrowserRouter(routes, { basename });

const AppProvider: FC = () => {
  const toast = useToast();

  const defaultErrorHandler = useCallback((error: OrderCloudError, {logout}:IOrderCloudErrorContext) => {
    if (error.status === 401) {
      console.log('DEFAULT ERROR HANDLER', 401)
      return logout()
    }
    if (!toast.isActive(error.errorCode)) {
      toast({ id: error.errorCode, title: error.status === 403 ? 'Permission denied' : error.message, status: "error" });
    }
  }, [toast])

  return (
    <OrderCloudProvider
      baseApiUrl={COUNTRY_SELECTION_ENABLED ? COUNTRY_API_URL : BASE_API_URL}
      clientId={COUNTRY_SELECTION_ENABLED ? ACTIVE_COUNTRY.clientID : CLIENT_ID}
      scope={COUNTRY_SELECTION_ENABLED ? ["Shopper"] : []}
      customScope={[]}
      allowAnonymous={COUNTRY_SELECTION_ENABLED ? false : ALLOW_ANONYMOUS}
      autoApplyPromotions={IS_AUTO_APPLY}
      defaultErrorHandler={defaultErrorHandler}
      openIdConnect={{
        enabled: !COUNTRY_SELECTION_ENABLED && OPENID_CONNECT_ENABLED,
        autoRedirect: true,
        configs: [{ id: OPENID_CONNECT_CONFIG_ID}],
        accessTokenQueryParamName: OPENIDCONNECT_ACCESS_TOKEN_QUERY_PARAM_NAME,
        refreshTokenQueryParamName: OPENIDCONNECT_REFRESH_TOKEN_QUERY_PARAM_NAME,
        idpAccessTokenQueryParamName: OPENIDCONNECT_IDP_ACCESS_TOKEN_QUERY_PARAM_NAME
      }}
    >
      <CountrySessionGate><RouterProvider router={router} /></CountrySessionGate>
      <GlobalLoadingIndicator/>
    </OrderCloudProvider>
  );
};

export default AppProvider;
