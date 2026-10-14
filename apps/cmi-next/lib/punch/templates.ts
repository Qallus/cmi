// Built-in construction punch list templates. They live in code so they ship
// with the app and can't be deleted; templates staff save themselves are rows
// in punch_templates.
import type { PunchTemplate } from "./types";

const t = (title: string, trade: string, location?: string) => ({ title, trade, location: location ?? null });

export const SYSTEM_TEMPLATES: PunchTemplate[] = [
  {
    id: "sys:final-walkthrough", name: "Final Walkthrough", category: "Closeout", is_system: true,
    description: "Room-by-room client walkthrough before turnover.",
    items: [
      t("Touch-up paint: walls, ceilings and trim", "Paint"),
      t("Check all doors open, close and latch; adjust hinges and strikes", "Carpentry"),
      t("Install missing door stops and hardware", "Carpentry"),
      t("Verify every switch, outlet and light works; GFCI/AFCI test", "Electrical"),
      t("Install missing cover plates", "Electrical"),
      t("Check faucets, drains and toilets for leaks and proper flow", "Plumbing"),
      t("Run HVAC; confirm airflow at every register and thermostat operation", "HVAC"),
      t("Inspect flooring for scratches, gaps and lippage", "Flooring"),
      t("Caulk gaps at trim, counters, tubs and showers", "Finish"),
      t("Clean windows, glass and mirrors; check screens", "Cleaning"),
      t("Final clean: cabinets, fixtures, floors and vents", "Cleaning"),
      t("Remove debris, protection and leftover materials", "General"),
      t("Hand over manuals, warranties and keys", "General"),
    ],
  },
  {
    id: "sys:pre-drywall", name: "Pre-Drywall Inspection", category: "Rough-In", is_system: true,
    description: "Walk before insulation and drywall cover the framing and rough-ins.",
    items: [
      t("Framing matches plans: walls, openings and heights", "Framing"),
      t("Blocking installed for cabinets, TV mounts, grab bars and accessories", "Framing"),
      t("Electrical boxes at correct heights and locations", "Electrical"),
      t("Low-voltage, data and AV runs complete and labeled", "Low Voltage"),
      t("Plumbing rough-in: valve heights, drains and stub-outs", "Plumbing"),
      t("HVAC ducts sealed and supported; returns in place", "HVAC"),
      t("Fire blocking and penetrations sealed", "Framing"),
      t("Nail plates installed over pipes and wires", "General"),
      t("Window and door flashing complete", "Exterior"),
      t("Photograph every wall before cover", "General"),
    ],
  },
  {
    id: "sys:kitchen", name: "Kitchen", category: "Room", is_system: true,
    description: "Kitchen finish punch items.",
    items: [
      t("Cabinet doors and drawers aligned, soft-close working", "Cabinets", "Kitchen"),
      t("Install missing cabinet hardware, shelves and fillers", "Cabinets", "Kitchen"),
      t("Countertop seams, edges and sealing", "Countertops", "Kitchen"),
      t("Backsplash grout and caulk complete", "Tile", "Kitchen"),
      t("Appliances installed, level and tested", "Appliances", "Kitchen"),
      t("Range hood vents to exterior and runs on all speeds", "HVAC", "Kitchen"),
      t("Sink, faucet, disposal and dishwasher tested for leaks", "Plumbing", "Kitchen"),
      t("Under-cabinet and pendant lighting working", "Electrical", "Kitchen"),
    ],
  },
  {
    id: "sys:bathroom", name: "Bathroom", category: "Room", is_system: true,
    description: "Bathroom finish punch items.",
    items: [
      t("Shower and tub: grout, caulk and glass seal", "Tile", "Bathroom"),
      t("Shower valve temperature and pressure checked", "Plumbing", "Bathroom"),
      t("Toilet secure, caulked and flushing properly", "Plumbing", "Bathroom"),
      t("Vanity level; drawers and doors aligned", "Cabinets", "Bathroom"),
      t("Mirrors, towel bars and accessories installed", "Finish", "Bathroom"),
      t("Exhaust fan vents outside and runs quietly", "HVAC", "Bathroom"),
      t("GFCI outlets tested", "Electrical", "Bathroom"),
      t("Floor slopes to drain; no hollow tiles", "Tile", "Bathroom"),
    ],
  },
  {
    id: "sys:exterior", name: "Exterior & Landscape", category: "Exterior", is_system: true,
    description: "Outside of the house and site.",
    items: [
      t("Stucco or siding patches blended and painted", "Exterior"),
      t("Exterior doors weather-stripped and sealed", "Exterior"),
      t("Gutters and downspouts drain away from foundation", "Exterior"),
      t("Grading slopes away from the house", "Sitework"),
      t("Irrigation zones tested; no overspray on walls", "Landscape"),
      t("Plants, trees and ground cover installed per plan", "Landscape"),
      t("Exterior lighting working and on timers", "Electrical"),
      t("Hardscape: pavers level, joints filled, concrete clean", "Hardscape"),
      t("Pool/spa equipment tested (if applicable)", "Pool"),
    ],
  },
  {
    id: "sys:closeout", name: "Project Closeout", category: "Closeout", is_system: true,
    description: "Paperwork and handoff to finish the job.",
    items: [
      t("Final inspections passed and permits closed", "General"),
      t("Certificate of occupancy / final sign-off received", "General"),
      t("As-built drawings and paint/finish schedule delivered", "General"),
      t("Warranty binder and manufacturer registrations delivered", "General"),
      t("Lien releases collected from all trades", "Accounting"),
      t("Final invoice sent and retainage released", "Accounting"),
      t("Client walkthrough signed off", "General"),
      t("Warranty start date set; 11-month walkthrough scheduled", "General"),
    ],
  },
];
