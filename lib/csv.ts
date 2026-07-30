// Purpose: Serializes tabular data into a CSV document.

export function generateCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const csvRows = rows.map((row) =>
    row
      .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
      .join(","),
  );

  return [headers.join(","), ...csvRows].join("\n");
}
