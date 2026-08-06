export type ImportError = { row: number; field: string; reason: string };

export type ImportAction = "create" | "update" | "error";

export type ImportRow = {
  /** 1-based CSV line number, i.e. the header row is 1 and the first data row is 2. */
  rowNum: number;
  action: ImportAction;
  data: Record<string, string>;
  /** Why the row failed validation. Only set when `action` is "error". */
  errors?: ImportError[];
};

export type ImportPreview = { rows: ImportRow[]; errors: ImportError[] };

/** A column rendered in the preview table, left of the trailing Status column. */
export type PreviewColumn = { key: string; header: string };
