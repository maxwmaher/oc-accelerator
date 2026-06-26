import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getRaiDemoContextById,
  RAI_DEMO_CONTEXT_CHANGED_EVENT,
  RAI_DEMO_CONTEXT_STORAGE_KEY,
  RAI_DEMO_CONTEXTS,
} from "../demo/raiDemoContexts";

const getStoredRaiDemoContextId = () => {
  if (typeof window === "undefined") return RAI_DEMO_CONTEXTS[0].id;

  return getRaiDemoContextById(
    window.localStorage.getItem(RAI_DEMO_CONTEXT_STORAGE_KEY),
  ).id;
};

export const useRaiDemoContext = () => {
  const [selectedContextId, setSelectedContextIdState] = useState(
    getStoredRaiDemoContextId,
  );

  const syncSelectedContextId = useCallback(() => {
    setSelectedContextIdState(getStoredRaiDemoContextId());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === RAI_DEMO_CONTEXT_STORAGE_KEY) {
        syncSelectedContextId();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      RAI_DEMO_CONTEXT_CHANGED_EVENT,
      syncSelectedContextId,
    );

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        RAI_DEMO_CONTEXT_CHANGED_EVENT,
        syncSelectedContextId,
      );
    };
  }, [syncSelectedContextId]);

  const setSelectedContextId = useCallback((nextId: string) => {
    const nextContextId = getRaiDemoContextById(nextId).id;
    setSelectedContextIdState(nextContextId);

    if (typeof window === "undefined") return;

    // Demo-only client-side profile context; production would source this from
    // the post-Keycloak Momentus/profile-service call.
    window.localStorage.setItem(RAI_DEMO_CONTEXT_STORAGE_KEY, nextContextId);
    window.dispatchEvent(new CustomEvent(RAI_DEMO_CONTEXT_CHANGED_EVENT));
  }, []);

  const selectedContext = useMemo(
    () => getRaiDemoContextById(selectedContextId),
    [selectedContextId],
  );

  return {
    selectedContext,
    selectedContextId: selectedContext.id,
    setSelectedContextId,
  };
};
