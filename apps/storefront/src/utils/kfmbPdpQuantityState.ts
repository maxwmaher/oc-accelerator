export interface PdpQuantityState {
  contextKey?: string;
  quantity: number;
  initialized: boolean;
}

export const emptyPdpQuantityState = (): PdpQuantityState => ({
  quantity: Number.NaN,
  initialized: false,
});

/**
 * Initializes an entry once both halves of the PDP data have resolved. Keeping
 * the context key in state prevents a previous shopper/product value from
 * briefly becoming actionable while the next context is loading.
 */
export function resolvePdpQuantityState(
  previous: PdpQuantityState,
  contextKey: string | undefined,
  ready: boolean,
  initialQuantity: number | undefined
): PdpQuantityState {
  if (!contextKey || !ready || initialQuantity === undefined) {
    return previous.contextKey === contextKey && !previous.initialized
      ? previous
      : { contextKey, quantity: Number.NaN, initialized: false };
  }

  if (previous.contextKey === contextKey && previous.initialized) return previous;
  return { contextKey, quantity: initialQuantity, initialized: true };
}

export function editPdpQuantityState(
  previous: PdpQuantityState,
  contextKey: string,
  quantity: number
): PdpQuantityState {
  return { contextKey, quantity, initialized: previous.contextKey === contextKey && previous.initialized };
}

export function canAddPdpQuantity(ready: boolean, validationError?: string): boolean {
  return ready && !validationError;
}
