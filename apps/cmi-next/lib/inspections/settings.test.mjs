import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  parseCutoffTime, formatCutoff, cutoffToTimeInput, defaultCutoffLabel, isJurisdictionCode,
  cleanStatusRoles, canUpdateInspectionStatus, canEditJurisdictions, canEditInspectionSettings, DEFAULT_STATUS_ROLES,
} from "./settings.ts";

test("cutoff times read the ways people type them", () => {
  assert.equal(parseCutoffTime("15:30"), 930);
  assert.equal(parseCutoffTime("3:30 PM"), 930);
  assert.equal(parseCutoffTime("3 pm"), 900);
  assert.equal(parseCutoffTime("9:00 p.m."), 1260);
  assert.equal(parseCutoffTime("midnight"), 1440);
  assert.equal(parseCutoffTime("00:00"), 1440);
  assert.equal(parseCutoffTime("12:00 AM"), 1440);
  assert.equal(parseCutoffTime("12:30 pm"), 750);
  assert.equal(parseCutoffTime(""), null);
  assert.equal(parseCutoffTime("not published"), null);
  assert.equal(parseCutoffTime("25:00"), undefined);
  assert.equal(parseCutoffTime("13 pm"), undefined);
  assert.equal(parseCutoffTime("soon"), undefined);
});

test("cutoff times format back for people and for time inputs", () => {
  assert.equal(formatCutoff(930), "3:30 PM");
  assert.equal(formatCutoff(1260), "9:00 PM");
  assert.equal(formatCutoff(1440), "Midnight");
  assert.equal(formatCutoff(null), "");
  assert.equal(cutoffToTimeInput(930), "15:30");
  assert.equal(cutoffToTimeInput(1440), "");
  assert.equal(defaultCutoffLabel(900), "3:00 PM the business day before");
  assert.match(defaultCutoffLabel(null), /Not published/);
});

test("jurisdiction codes are the milestone ID prefixes", () => {
  assert.ok(isJurisdictionCode("SCOT"));
  assert.ok(isJurisdictionCode("PV"));
  assert.ok(!isJurisdictionCode("scot"));
  assert.ok(!isJurisdictionCode("S"));
  assert.ok(!isJurisdictionCode("GILBERT1"));
});

test("status: Super Admin and Admin always; others per the setting", () => {
  assert.deepEqual(DEFAULT_STATUS_ROLES, ["project_manager", "superintendent"]);
  assert.ok(canUpdateInspectionStatus("super_admin", []));
  assert.ok(canUpdateInspectionStatus("admin", []));
  assert.ok(canUpdateInspectionStatus("superintendent", DEFAULT_STATUS_ROLES));
  assert.ok(!canUpdateInspectionStatus("superintendent", ["project_manager"]));
  assert.ok(!canUpdateInspectionStatus("client", DEFAULT_STATUS_ROLES));
  assert.ok(!canUpdateInspectionStatus(null, DEFAULT_STATUS_ROLES));
  assert.deepEqual(cleanStatusRoles(["superintendent", "client", "project_manager", "superintendent"]), ["project_manager", "superintendent"]);
});

test("who edits what", () => {
  assert.ok(canEditJurisdictions("admin") && canEditJurisdictions("super_admin"));
  assert.ok(!canEditJurisdictions("project_manager"));
  assert.ok(canEditInspectionSettings("super_admin"));
  assert.ok(!canEditInspectionSettings("admin"));
});
