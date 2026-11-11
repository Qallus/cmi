import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isPipelineNumber, nameFromTitle, titleFor } from "./numbering.ts";

test("pipeline numbers are YY_###", () => {
  assert.ok(isPipelineNumber("26_058"));
  assert.ok(isPipelineNumber(" 25_062 "));
  assert.ok(!isPipelineNumber("26-058"));
  assert.ok(!isPipelineNumber("2026_058"));
  assert.ok(!isPipelineNumber("26_58"));
});

test("the name is the title without its leading number and separator", () => {
  assert.equal(nameFromTitle("26_058_Smith Residence"), "Smith Residence");
  assert.equal(nameFromTitle("26_058 - Smith Residence"), "Smith Residence");
  assert.equal(nameFromTitle("Smith Residence"), "Smith Residence");
  assert.equal(nameFromTitle("26_058_25_062_Olson Casita"), "25_062_Olson Casita"); // only the first number
  assert.equal(nameFromTitle(null), "");
});

test("titles are rebuilt as number_name, dropping a number typed into the name", () => {
  assert.equal(titleFor("26_060", "Smith Residence"), "26_060_Smith Residence");
  assert.equal(titleFor("26_060", "26_058_Smith Residence"), "26_060_Smith Residence");
});
