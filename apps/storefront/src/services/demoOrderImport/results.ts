import {
  DemoOrderImportBatchResult,
  DemoOrderImportError,
  DemoOrderImportLineResult,
  DemoOrderImportOrderResult,
} from "./types";

export const createBatchID = () =>
  `demo-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const summarizeBatchResults = (
  batchID: string,
  startedAt: string,
  completedAt: string,
  orderResults: DemoOrderImportOrderResult[],
  setupErrors: DemoOrderImportError[] = [],
): DemoOrderImportBatchResult => {
  const lineResults: DemoOrderImportLineResult[] = orderResults.flatMap(
    (result) => result.lineResults,
  );
  const errors = [
    ...setupErrors,
    ...orderResults.flatMap((result) => result.errors),
  ];
  const succeededCount = orderResults.filter(
    (result) => result.status === "SUCCESS",
  ).length;

  return {
    batchID,
    startedAt,
    completedAt,
    totalOrders: orderResults.length,
    succeededCount,
    failedCount: orderResults.length - succeededCount,
    orderResults,
    lineResults,
    errors,
  };
};
