/**
 * The key the Pipeline list uses to hand its current ordering to a deal page.
 *
 * Session, not local: it describes one browsing session's sort and filters, and
 * should not outlive the tab. Shared from here so the two ends cannot drift.
 */
export const PIPELINE_ORDER_KEY = "cmi-pipeline-order";
