// Unit tests for the weekly meeting document parser. Run: node --test lib/reporting/
// Fixtures are lifted verbatim from docs/reporting/09.14.2026.pdf.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMeetingDocument, parseLooseDate, splitTitle, splitOwner } from "./parse.ts";

test("parseLooseDate handles the phrasings the document uses", () => {
  assert.equal(parseLooseDate("May 22nd, 2026"), "2026-05-22");
  assert.equal(parseLooseDate("Oct 1st, 2026"), "2026-10-01");
  assert.equal(parseLooseDate("September 11th, 2026"), "2026-09-11");
  assert.equal(parseLooseDate("9/14/2026"), "2026-09-14");
  assert.equal(parseLooseDate("09/07/26"), "2026-09-07");
  assert.equal(parseLooseDate("Sept 17th-18th"), null); // no year — kept as raw text
  assert.equal(parseLooseDate(""), null);
  assert.equal(parseLooseDate(null), null);
});

test("splitTitle pulls out the job number and budget note", () => {
  assert.deepEqual(splitTitle("25_062_ Olson Casita"), {
    jobNumber: "25_062", title: "Olson Casita", valueNote: null,
  });
  assert.deepEqual(splitTitle("25_036_ Schluter Art Sales (E Main Gallery) - $1.2M"), {
    jobNumber: "25_036", title: "Schluter Art Sales (E Main Gallery)", valueNote: "$1.2M",
  });
  assert.deepEqual(splitTitle("25_072_ Waring ADU $600-$800"), {
    jobNumber: "25_072", title: "Waring ADU", valueNote: "$600-$800",
  });
  // Leads have no job number yet.
  assert.deepEqual(splitTitle("Hazelwood Residence – home expansion/ courtyard"), {
    jobNumber: null, title: "Hazelwood Residence – home expansion/ courtyard", valueNote: null,
  });
});

test("splitOwner takes trailing initials as the owner", () => {
  assert.deepEqual(splitOwner("Stair Rail – follow up – YH"), { body: "Stair Rail – follow up", ownerLabel: "YH" });
  assert.deepEqual(splitOwner("Bracket install – 21st BP/JB"), { body: "Bracket install – 21st", ownerLabel: "BP/JB" });
  assert.deepEqual(splitOwner("Waiting on permit"), { body: "Waiting on permit", ownerLabel: null });
});

const DOC = `Weekly Workload Meetings
9/14/2026
Active Project Status
• 25_062_ Olson Casita
o Project Status: In Progress
o Original Completion Date: May 22nd, 2026
o Current Completion Date: September 11th, 2026
o Financial: July Paid
o Issues/Action Items:
§ Photographs – need to be scheduled
§ Stair Rail – follow up – YH
o Procurement:
§ Zia tile is still backordered – eta mid-September
• 25_042_Baxter Residence
o Project Status: In Progress
§ Scope: Laundry Room Renovation
o Financial: Pay app going out today
Warranty Jobs
o 25_052_VCS
o Substantial Completion / Warranty Date: August 22nd 2025/ August 22nd 2027
Active Leads Status Updates
• 26_013_Garfield Casita
o Ben – send client info to contract engineering initial evaluation
• Kira Peters – Kitchen remodel, budget under 50k
o Pre-liminary proposal sent to client 9/3
General Items
1. Builder's Risk Maintenance
I. IH4 M342269 00-4/06/2026 Lysay Residence
`;

test("parses the real document structure", () => {
  const doc = parseMeetingDocument(DOC);
  assert.equal(doc.meetingDate, "2026-09-14");

  const keys = doc.sections.map((s) => s.key);
  assert.deepEqual(keys, ["active_projects", "warranty", "active_leads", "general"]);

  const olson = doc.sections[0].items[0];
  assert.equal(olson.jobNumber, "25_062");
  assert.equal(olson.title, "Olson Casita");
  assert.equal(olson.statusText, "In Progress");
  assert.equal(olson.originalCompletion, "May 22nd, 2026");
  assert.equal(olson.currentCompletion, "September 11th, 2026");
  assert.equal(olson.financialNote, "July Paid");
  assert.equal(olson.actions.length, 2);
  assert.deepEqual(olson.actions[1], { body: "Stair Rail – follow up", ownerLabel: "YH" });
  assert.equal(olson.procurementNote, "Zia tile is still backordered – eta mid-September");

  // A "§ Scope:" line still lands as an action item; the section bucket only
  // switches on an "o Label:" line, which is how the source document works.
  const baxter = doc.sections[0].items[1];
  assert.equal(baxter.jobNumber, "25_042");
  assert.equal(baxter.financialNote, "Pay app going out today");

  const leads = doc.sections[2];
  assert.equal(leads.items.length, 2);
  assert.equal(leads.items[0].latestUpdate, "Ben – send client info to contract engineering initial evaluation");
  assert.equal(leads.items[1].jobNumber, null);
  assert.equal(leads.items[1].title, "Kira Peters – Kitchen remodel, budget under 50k");

  // Numbered lines in General Items become their own entries.
  const general = doc.sections[3];
  assert.equal(general.items[0].title, "Builder's Risk Maintenance");
  assert.equal(general.items[1].title, "IH4 M342269 00-4/06/2026 Lysay Residence");
});

test("warranty entries keep the raw substantial-completion line", () => {
  const doc = parseMeetingDocument(DOC);
  const warranty = doc.sections[1];
  // The heading is followed by "o"-level bullets, so the first one opens the item.
  assert.ok(warranty.items.length >= 1);
  const raw = warranty.items.map((i) => i.warrantyDate).find(Boolean);
  assert.equal(raw, "August 22nd 2025/ August 22nd 2027");
});

test("label lines without a colon still open their bucket", () => {
  const doc = parseMeetingDocument([
    "Active Project Status",
    "• 25_062_ Olson Casita",
    "o Punchlist items",
    "§ Substantial completion",
    "o Procurement",
    "§ Zia tile backordered",
  ].join("\n"));
  const item = doc.sections[0].items[0];
  assert.equal(item.latestUpdate, null, "the label itself is not an update");
  assert.equal(item.notes, "Substantial completion");
  assert.equal(item.procurementNote, "Zia tile backordered");
});

test("bullet characters alone on a line are ignored", () => {
  const doc = parseMeetingDocument([
    "Active Project Status",
    "• 25_036_ Schluter Art Sales",
    "o Procurement:",
    "§",
  ].join("\n"));
  const item = doc.sections[0].items[0];
  assert.equal(item.latestUpdate, null);
  assert.equal(item.procurementNote, null);
});

test("empty input yields no sections", () => {
  assert.deepEqual(parseMeetingDocument("").sections, []);
  assert.deepEqual(parseMeetingDocument("   \n\n  ").sections, []);
});
