import { createContext, FC, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Me, Orders } from "ordercloud-javascript-sdk";
import { useOrderCloudContext } from "@ordercloud/react-sdk";
import { useCurrentUser } from "../hooks/currentUser";

type SellerType = "admin" | "supplier";

interface SellerSelection {
  sellerType: SellerType;
  sellerID: string;
  displayName: string;
}

interface BuyerSeller {
  SupplierID: string;
  Name?: string;
}

interface SellerContextValue {
  selectedSeller?: SellerSelection;
  availableSuppliers: BuyerSeller[];
  loadingSuppliers: boolean;
  setSelectedSeller: (selection: SellerSelection) => void;
  clearSelectedSeller: () => void;
  ensureOrderSellerContext: (orderID?: string) => Promise<void>;
}

const STORAGE_KEY = "oc_storefront_selected_seller";

const SellerContext = createContext<SellerContextValue | undefined>(undefined);

export const SellerProvider: FC<PropsWithChildren> = ({ children }) => {
  const { isLoggedIn } = useOrderCloudContext();
  const { data: user } = useCurrentUser();
  const [selectedSeller, setSelectedSellerState] = useState<SellerSelection | undefined>();
  const [availableSuppliers, setAvailableSuppliers] = useState<BuyerSeller[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSelectedSellerState(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setAvailableSuppliers([]);
      return;
    }
    const fetchSuppliers = async () => {
      setLoadingSuppliers(true);
      try {
        const result = await Me.ListBuyerSellers({ pageSize: 100, sortBy: ["Name"] });
        setAvailableSuppliers(
          (result.Items || []).map((item) => ({
            SupplierID: item.ID || "",
            Name: item.Name || item.ID || "Supplier",
          }))
          .filter((item) => Boolean(item.SupplierID))
        );
      } finally {
        setLoadingSuppliers(false);
      }
    };
    fetchSuppliers();
  }, [isLoggedIn]);

  const setSelectedSeller = useCallback((selection: SellerSelection) => {
    setSelectedSellerState(selection);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  }, []);

  const clearSelectedSeller = useCallback(() => {
    setSelectedSellerState(undefined);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const ensureOrderSellerContext = useCallback(
    async (orderID?: string) => {
      if (!orderID || !selectedSeller?.sellerID || selectedSeller.sellerType !== "supplier") return;
      await Orders.Patch("Outgoing", orderID, { ToCompanyID: selectedSeller.sellerID });
    },
    [selectedSeller?.sellerID, selectedSeller?.sellerType]
  );

  useEffect(() => {
    if (!isLoggedIn) {
      clearSelectedSeller();
      return;
    }
    if (!selectedSeller && user?.Seller?.ID) {
      // keep intentionally unselected to force buyer choice after login
    }
  }, [clearSelectedSeller, isLoggedIn, selectedSeller, user?.Seller?.ID]);

  const value = useMemo(
    () => ({
      selectedSeller,
      availableSuppliers,
      loadingSuppliers,
      setSelectedSeller,
      clearSelectedSeller,
      ensureOrderSellerContext,
    }),
    [
      availableSuppliers,
      clearSelectedSeller,
      ensureOrderSellerContext,
      loadingSuppliers,
      selectedSeller,
      setSelectedSeller,
    ]
  );

  return <SellerContext.Provider value={value}>{children}</SellerContext.Provider>;
};

export const useSellerContext = () => {
  const context = useContext(SellerContext);
  if (!context) {
    throw new Error("useSellerContext must be used inside SellerProvider");
  }
  return context;
};

export type { SellerSelection, SellerType };
