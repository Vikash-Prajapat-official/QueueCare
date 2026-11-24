import { describe, expect, it } from "vitest";
import { CSV_BOM, csvCell, csvRow } from "@/lib/csv";

describe("csvCell", () => {
  it("leaves plain text alone", () => {
    expect(csvCell("Medicine")).toBe("Medicine");
    expect(csvCell("चिकित्सा")).toBe("चिकित्सा");
  });

  it("writes numbers and booleans, and nothing for empty values", () => {
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(true)).toBe("true");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("quotes text with commas, quotes or new lines", () => {
    expect(csvCell("Dr. A, B")).toBe('"Dr. A, B"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  it("stops spreadsheet formulas from running", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell("+91 98765")).toBe("'+91 98765");
    expect(csvCell("-1+1")).toBe("'-1+1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("\tcmd")).toBe("'\tcmd");
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
  });

  it("does not touch real negative numbers", () => {
    expect(csvCell(-3)).toBe("-3");
  });
});

describe("csvRow", () => {
  it("joins cells and ends with a Windows line break", () => {
    expect(csvRow(["a", 1, null, "b,c"])).toBe('a,1,,"b,c"\r\n');
  });

  it("has a byte order mark constant for Excel", () => {
    expect(CSV_BOM).toBe("﻿");
  });
});
