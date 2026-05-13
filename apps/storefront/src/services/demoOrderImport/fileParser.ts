import { DemoOrderImportRawRow } from "./types";

const EXPECTED_COLUMNS = [
  "ExternalOrderID",
  "LineNumber",
  "ProductID",
  "Quantity",
  "SellerID",
  "SupplierID",
  "InventoryRecordID",
  "ShipFirstName",
  "ShipLastName",
  "ShipStreet1",
  "ShipStreet2",
  "ShipCity",
  "ShipState",
  "ShipZip",
  "ShipCountry",
  "ShipPhone",
  "BillingZip",
  "CustomerEmail",
] as const;

type DemoImportColumn = (typeof EXPECTED_COLUMNS)[number];

const columnLookup = new Map(
  EXPECTED_COLUMNS.map((column) => [column.toLowerCase(), column]),
);

const splitCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

const parseCsvText = (text: string): DemoOrderImportRawRow[] => {
  const normalizedText = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = normalizedText
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return [];

  const headerValues = splitCsvLine(lines[0]);
  const headers = headerValues.map((header) =>
    columnLookup.get(header.trim().toLowerCase()),
  );

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return values.reduce<DemoOrderImportRawRow>((row, value, index) => {
      const header = headers[index] as DemoImportColumn | undefined;
      if (header) row[header] = value;
      return row;
    }, {});
  });
};

export const expectedDemoImportColumns = EXPECTED_COLUMNS;

export const parseDemoOrderImportFile = async (
  file: File,
): Promise<DemoOrderImportRawRow[]> => {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return parseCsvText(await file.text());
  }

  if (extension === "xlsx") {
    throw new Error(
      "Excel .xlsx parsing is not enabled in this build because no spreadsheet parser dependency is available. Save the sheet as CSV and upload the .csv file for this demo page.",
    );
  }

  throw new Error("Unsupported file type. Upload a .csv file.");
};
