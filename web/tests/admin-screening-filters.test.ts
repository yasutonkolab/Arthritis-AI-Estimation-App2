import assert from "node:assert/strict";
import test from "node:test";
import {
  adminScreeningExportHref,
  adminScreeningListHref,
  endOfJapanDateExclusive,
  normalizeAdminScreeningFilters,
  startOfJapanDate,
} from "../src/lib/admin-screening-filters.ts";

test("一覧の検索条件を正規化する", () => {
  assert.deepEqual(
    normalizeAdminScreeningFilters({
      clinic: "265d0283-c135-4ff6-936d-ee3902eac268",
      from: "2026-09-01",
      to: "2026-09-31",
      status: "completed",
      subject: "  keio47  ",
      page: "3",
    }),
    {
      clinicId: "265d0283-c135-4ff6-936d-ee3902eac268",
      dateFrom: "2026-09-01",
      dateTo: "",
      status: "completed",
      subjectId: "keio47",
      page: 3,
    }
  );
});

test("不正な検索条件には安全な既定値を使う", () => {
  assert.deepEqual(
    normalizeAdminScreeningFilters({
      clinic: "not-a-uuid",
      from: "yesterday",
      status: "unknown",
      page: "-1",
    }),
    {
      clinicId: "",
      dateFrom: "",
      dateTo: "",
      status: "",
      subjectId: "",
      page: 1,
    }
  );
});

test("撮影日の範囲は日本時間の境界へ変換する", () => {
  assert.equal(startOfJapanDate("2026-09-05"), "2026-09-04T15:00:00.000Z");
  assert.equal(endOfJapanDateExclusive("2026-12-31"), "2026-12-31T15:00:00.000Z");
});

test("ページリンクは検索条件を維持し、1ページ目はpageを省略する", () => {
  const filters = normalizeAdminScreeningFilters({
    status: "failed",
    subject: "keio 1",
    page: "2",
  });
  assert.equal(
    adminScreeningListHref(filters, 3),
    "/admin/screenings?status=failed&subject=keio+1&page=3"
  );
  assert.equal(
    adminScreeningListHref(filters, 1),
    "/admin/screenings?status=failed&subject=keio+1"
  );
  assert.equal(
    adminScreeningExportHref(filters),
    "/admin/screenings/export?status=failed&subject=keio+1"
  );
});
