import { strict as assert } from "node:assert";
import { test } from "node:test";
import { finishOf, movedBanner } from "./move-banner.ts";

const fmt = (s) => s;

test("finish is the latest end, or a milestone's start", () => {
  assert.equal(finishOf([{ start_date: "2027-03-01", end_date: "2027-03-09" }, { start_date: "2027-03-11" }]), "2027-03-11");
  assert.equal(finishOf([]), null);
});

test("banner names the count and the new finish", () => {
  assert.equal(movedBanner(3, "2027-03-09", "2027-03-11", fmt), "3 tasks moved · finish now 2027-03-11 (2 days later).");
  assert.equal(movedBanner(1, "2027-03-11", "2027-03-11", fmt), "1 task moved · finish still 2027-03-11.");
  assert.equal(movedBanner(2, "2027-03-11", "2027-03-10", fmt), "2 tasks moved · finish now 2027-03-10 (1 day earlier).");
});
