import { Cart } from "ordercloud-javascript-sdk";
import type { OrderWorksheet } from "ordercloud-javascript-sdk";
import { useAuthQuery, useOrderCloudContext } from "@ordercloud/react-sdk";
import { resolveCurrentCartState } from "../utils/kfmbCurrentCartState";

/** Observe the SDK's existing ["worksheet"] cache instead of creating a
 * second cart source. SDK mutations continue to invalidate this same key. */
export function useCurrentCart(userReady: boolean) {
  const { isAuthenticated } = useOrderCloudContext();
  const query = useAuthQuery<OrderWorksheet>({
    queryKey: ["worksheet"],
    queryFn: () => Cart.GetOrderWorksheet(),
    retry: false,
  }, () => undefined);
  const state = resolveCurrentCartState(
    isAuthenticated,
    userReady,
    query.isLoading || query.isPending,
    query.data,
    query.error
  );
  return { ...state, retry: query.refetch };
}
