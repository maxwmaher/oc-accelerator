/** Session-local UI state, not a server security boundary. No credentials are stored. */
const pendingLineEdits = new Set<string>();
let cartActionInProgress = false;

export function markQuantityEdit(lineId: string, pending: boolean): void {
  if (pending) pendingLineEdits.add(lineId);
  else pendingLineEdits.delete(lineId);
}

export function assertNoPendingQuantityEdits(): void {
  if (pendingLineEdits.size) {
    throw new Error("Apply or cancel your quantity changes in the cart before placing the order.");
  }
}

/** Prevent overlapping writes/submission through this page's modified handlers. */
export async function runCartAction<T>(action: () => Promise<T>): Promise<T> {
  if (cartActionInProgress) throw new Error("A cart update is still in progress. Please wait and try again.");
  cartActionInProgress = true;
  try {
    return await action();
  } finally {
    cartActionInProgress = false;
  }
}
