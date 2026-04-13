import { describe, expect, it } from "vitest";
import {
  parsePenaltyImportCsv,
  splitCsvLineAllFields,
  splitCsvLineToFixedFields
} from "./penalty-csv-parse";

describe("splitCsvLineToFixedFields", () => {
  it("keeps commas in the last field when unquoted", () => {
    const line =
      "230,EMP-RIDER-001,2026-01-22,LATE,Late by 1 hour, no prior notice";
    expect(splitCsvLineToFixedFields(line, 5)).toEqual([
      "230",
      "EMP-RIDER-001",
      "2026-01-22",
      "LATE",
      "Late by 1 hour, no prior notice"
    ]);
  });

  it("respects quotes in earlier fields", () => {
    const line = '230,"EMP, JR",2026-01-05,LATE,Simple note';
    expect(splitCsvLineToFixedFields(line, 5)).toEqual([
      "230",
      "EMP, JR",
      "2026-01-05",
      "LATE",
      "Simple note"
    ]);
  });

  it("pads missing trailing columns", () => {
    expect(splitCsvLineToFixedFields("a,b", 4)).toEqual(["a", "b", "", ""]);
  });
});

describe("splitCsvLineAllFields", () => {
  it("splits on commas outside quotes", () => {
    expect(splitCsvLineAllFields('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });
});

describe("parsePenaltyImportCsv", () => {
  it("parses multi-row file with commas in notes (last column)", () => {
    const csv = `warehouse_code,employee_code,incident_date,penalty_code,notes
230,EMP-RIDER-001,2026-01-22,LATE,Late by 1 hour, no prior notice
231,EMP-PP-003,2026-01-06,LATE,Late by 25 mins on shift start
`;
    const { data, errors } = parsePenaltyImportCsv(csv);
    expect(errors).toEqual([]);
    expect(data).toHaveLength(2);
    expect(data[0]?.notes).toBe("Late by 1 hour, no prior notice");
    expect(data[1]?.notes).toBe("Late by 25 mins on shift start");
    expect(data[0]?.penalty_code).toBe("LATE");
  });

  it("returns error for empty file", () => {
    const { data, errors } = parsePenaltyImportCsv("   \n  ");
    expect(data).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });
});
