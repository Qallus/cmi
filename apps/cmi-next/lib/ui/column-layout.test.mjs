import { strict as assert } from "node:assert";
import { test } from "node:test";
import { layoutColumns } from "./column-layout.ts";

const defaults = { a: 100, b: 200, c: 100 };

test("unknown width: defaults, no scaling", () => {
  const { widths, total } = layoutColumns({ keys: ["a", "b", "c"], defaults, custom: {}, available: 0 });
  assert.deepEqual(widths, { a: 100, b: 200, c: 100 });
  assert.equal(total, 400);
});

test("extra space is shared in proportion, not given to one column", () => {
  const { widths, total } = layoutColumns({ keys: ["a", "b", "c"], defaults, custom: {}, available: 800 });
  assert.deepEqual(widths, { a: 200, b: 400, c: 200 });
  assert.equal(total, 800);
});

test("hiding a column spreads its space across the rest", () => {
  const { widths } = layoutColumns({ keys: ["a", "b"], defaults, custom: {}, available: 600 });
  assert.deepEqual(widths, { a: 200, b: 400 });
});

test("a resized column keeps its width; the others fill", () => {
  const { widths, total } = layoutColumns({ keys: ["a", "b", "c"], defaults, custom: { b: 300 }, available: 700 });
  assert.equal(widths.b, 300);
  assert.equal(widths.a, 200);
  assert.equal(widths.c, 200);
  assert.equal(total, 700);
});

test("too narrow: nothing shrinks below its width (the table scrolls)", () => {
  const { widths, total } = layoutColumns({ keys: ["a", "b", "c"], defaults, custom: {}, available: 300 });
  assert.deepEqual(widths, { a: 100, b: 200, c: 100 });
  assert.equal(total, 400);
});

test("all resized: they scale together except the pinned one", () => {
  const custom = { a: 100, b: 100 };
  const all = layoutColumns({ keys: ["a", "b"], defaults, custom, available: 400 });
  assert.deepEqual(all.widths, { a: 200, b: 200 });
  const dragging = layoutColumns({ keys: ["a", "b"], defaults, custom, available: 400, pinned: "a" });
  assert.deepEqual(dragging.widths, { a: 100, b: 300 });
});

test("rounding leftovers go to the last flexing column", () => {
  const { widths, total } = layoutColumns({ keys: ["a", "b", "c"], defaults: { a: 100, b: 100, c: 100 }, custom: {}, available: 1000 });
  assert.equal(total, 1000);
  assert.equal(widths.a + widths.b + widths.c, 1000);
});
