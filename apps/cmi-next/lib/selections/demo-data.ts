import type { SelectionsData } from "./types";

export function getDemoSelectionsData(): SelectionsData {
  const projectId = "demo-project-kitchen";
  const taskId = "demo-task-countertop";
  const productId = "demo-product-quartz";
  const vendorId = "demo-vendor-arizona-tile";
  const clientId = "demo-client";
  const designerId = "demo-designer";

  return {
    products: [
      {
        id: productId,
        product_name: "MSI Calacatta Laza Quartz",
        product_slug: "msi-calacatta-laza-quartz",
        category: "Countertops",
        product_type: "Quartz slab",
        brand: "MSI",
        manufacturer: "MSI",
        sku: "CAL-LAZA",
        model_number: null,
        vendor_id: vendorId,
        vendor_name: "Arizona Tile",
        description: "White quartz countertop with warm veining for kitchen remodel selections.",
        image_url: "",
        gallery_urls: [],
        video_url: "",
        spec_sheet_url: "",
        product_url: "",
        unit_cost: 78,
        retail_price: 95,
        markup_percent: 20,
        lead_time_days: 14,
        availability_status: "available",
        warranty_info: "Manufacturer warranty applies.",
        install_notes: "Confirm slab layout before fabrication.",
        internal_notes: "Demo product catalog item.",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    selections: [
      {
        id: "demo-selection-countertop",
        project_id: projectId,
        project_schedule_item_id: taskId,
        project_name: "Scottsdale Kitchen Remodel",
        client_id: clientId,
        client_name: "Jeremy Waters",
        room_area_name: "Kitchen",
        category: "Countertops",
        name: "Quartz Countertop",
        product_id: productId,
        custom_product_name: "MSI Calacatta Laza Quartz",
        description: "Primary countertop selection tied to template/fabrication task.",
        image_url: "",
        gallery_urls: [],
        video_url: "",
        spec_sheet_url: "",
        product_url: "",
        vendor_id: vendorId,
        vendor_name: "Arizona Tile",
        subcontractor_id: null,
        subcontractor_name: "Countertop Installer",
        designer_user_id: designerId,
        designer_name: "Designer",
        related_task_id: taskId,
        quote_id: null,
        sow_id: null,
        contract_id: null,
        invoice_id: null,
        selection_status: "pending_client_approval",
        approval_status: "pending",
        procurement_status: "quote_requested",
        install_status: "not_ready",
        client_visible: true,
        client_approval_required: true,
        client_comments: null,
        quantity: 1,
        unit: "allowance",
        allowance_amount: 5000,
        estimated_cost: 6250,
        actual_cost: null,
        client_price: 6250,
        over_under_amount: 1250,
        markup_amount: null,
        tax_amount: null,
        total_amount: 6250,
        lead_time_days: 14,
        target_decision_date: "2026-06-03",
        target_order_date: "2026-06-05",
        target_delivery_date: "2026-06-19",
        target_install_date: "2026-06-24",
        internal_notes: "Demo selection record.",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    projects: [{ id: projectId, label: "Scottsdale Kitchen Remodel", sublabel: "active" }],
    tasks: [{ id: taskId, label: "Countertop template, fabrication, and install", sublabel: "Scottsdale Kitchen Remodel / Interior Finishes" }],
    contacts: [{ id: clientId, label: "Jeremy Waters", sublabel: "Client" }],
    vendors: [{ id: vendorId, label: "Arizona Tile", sublabel: "Vendor" }],
    subcontractors: [{ id: "demo-subcontractor", label: "Countertop Installer", sublabel: "Sub Contractor" }],
    staffUsers: [{ id: designerId, label: "Designer", sublabel: "designer" }]
  };
}
