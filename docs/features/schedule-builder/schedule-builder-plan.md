# Schedule Builder and list views: plan

**Status:** proposed on 2026-10-30, waiting for Jeremy's decisions (below).
**Flag:** `schedule_builder`, which stays off until it's approved.

## What's already shipped (2026-10-30)

- **Schedules page (global):**
  - An **Add Schedule** button (top right) picks the job, then runs the normal Add Schedule wizard (template, copy or blank) and opens that job's schedule.
  - The list sorts on every column, and you can tick rows to get a floating quick-action bar (Status, Health, Archive, Delete).
- **Shared list kit:** `components/ui/data-table.tsx` contains `useSort`, `SortableTh`, `useRowSelection`, `HeaderCheckbox`, `RowCheckbox`, `SelectionBar` and `BarAction`. Every list moves onto it (part 2).

## Part 1: Multi-level Schedule Builder

### Goal

You build one schedule from the Schedules page that can:
- hold other schedules inside it (as many levels as needed), like a job's Master Schedule holds Design, Permitting, Construction and so on;
- belong to a job, a Pipeline deal, a Pre-Con record, or the company itself (for example "Q1 hiring" or "Showroom remodel");
- contain items that point at anything in the dashboard: a Pipeline deal, a job, a vendor or trade partner, a selection, a Projects & Tasks project, a punch list or a contact.

### Data (one migration, run by Jeremy)

- **`job_schedules`:**
  - `job_id` becomes optional.
  - Add `parent_schedule_id`, which points at its parent schedule. Deleting the parent deletes its children; archiving the parent archives them.
  - Add `scope_type` (`job` | `deal` | `precon` | `company`) and `scope_id`, so a schedule belongs to one record or to the company.
- **`schedule_items`:** add `link_type`, `link_id` and `link_label` (the record an item points at), with an index on `(link_type, link_id)`, so "what's scheduled for this vendor" is a single query.
- **Moving dates:** today, moving a task only moves linked tasks on the same job. That changes to use the links themselves, so it works across a schedule tree that has no job.

### Workflow (one dialog, four short steps)

1. **What's it for?** Choose one of four cards: Job, Pipeline deal, Pre-Con, or Company / internal. Then search for the record (not needed for Company).
2. **Basics:** name, type, start date, owner, and optionally a template with the "move following tasks / I'll adjust myself" choice.
3. **Schedules inside it (optional):**
   - Add rows, each with a name, type and optional template (for example Design + Permitting + Construction).
   - Every row starts on the same start date unless you change it.
   - A row can have rows of its own.
4. **Review → Create.** This opens the schedule in the same workspace the job Schedule tab uses. Sub-schedules show indented in the schedule picker, and all 8 views work.

### Adding items from the dashboard

- In a schedule, **Add Item** gets a second tab, **From a record**.
- One search box covers deals, jobs, Pre-Con, vendors and trade partners, selections, projects, punch lists and contacts.
- Picking a record creates a linked item with a suggested title and date:
  - a selection: its decision due date
  - a deal: its expected close date
  - a trade partner: its COI or requalification due date
  - a punch list: its due date
- The item shows a chip that opens the record. Later, record pages get an "On schedules" panel.

### Claude

- `cmi_schedule_create` gains `for` (job, deal, precon or company), `parent_schedule_id` and `sub_schedules`.
- A new tool, `cmi_schedule_item_from_record`, adds a linked item.
- Same safety rules as today.

### Phases

| Phase | Scope | Needs |
|---|---|---|
| A | Migration, data layer, cascade across a tree, standalone schedule page `/dashboard/schedules/[id]` | migration |
| B | Builder dialog (4 steps), nested schedules in the picker and Overview roll-up | A |
| C | "From a record" items + link chips | A |
| D | Claude tools + Bolt guide | B, C |

## Part 2: Sorting, checkboxes and quick actions on every list

Each list keeps its current look and moves onto the shared kit:
- column-header sorting
- a row checkbox and "select all" header checkbox
- the floating quick-action bar while anything is ticked

Lists that already have parts of this (Pipeline, Jobs, Cloud) are aligned rather than rebuilt.

| List | Sorting | Checkboxes + bar | Proposed quick actions |
|---|---|---|---|
| Contacts | add | move inline bar → floating | Type, Status, Owner, Tags, Add to Pipeline, Export, Archive, Delete (unchanged) |
| Pre-Con | add | has (QuickActionBar) | unchanged |
| Jobs (list/card) | add to all views | has | unchanged |
| Trade Partners directory + applications | add | add for all who can manage | Requalify, Status, Export |
| Selections (global + job) | add | add | Status, Send for approval, Mark ordered, Export |
| Documents | add | add | Share, Move, Archive |
| Daily Logs (global + job) | add (table mode) | add | Export / PDF, Share with client |
| Punch Lists | add | add | Assign, Close, Export |
| Change Orders, Invoices (job) | add | add | Status, Export / PDF |
| Job Files | add | has | unchanged |
| Communications | add | has | unchanged |
| Schedules → Items tab | add | add | Status, Assign, Shift dates |
| Quotes, Team, Portfolio, Messaging consent | add | where actions exist | unchanged |

We'll roll this out in batches of 3–4 lists, each checked in the browser.

## Decisions needed from Jeremy

1. **Who it's for:** besides Jobs, should a schedule belong to Pipeline deals, Pre-Con and the company (internal), or to fewer of these?
2. **Nesting:** unlimited levels, or two (a schedule and the schedules inside it)? Two is simpler to read.
3. **Records items can point at:** deals, jobs, Pre-Con, vendors and trade partners, selections, projects, punch lists, contacts. Add or remove any?
4. **Quick actions in Part 2:** OK with the table above, or are there lists where you want different actions?
