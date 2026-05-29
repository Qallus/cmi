import type { PortfolioItem } from "./types";

const now = new Date().toISOString();

export const demoPortfolioItems: PortfolioItem[] = [
  {
    id: "demo-haverish",
    project_id: null,
    wp_post_id: null,
    title: "Haverish",
    slug: "haverish",
    subtitle: "Architectural and Design Coordination",
    category: "Residential",
    year: 2024,
    location: "Scottsdale, AZ",
    timeline: "6 mo",
    square_feet: 3400,
    description: "A full interior design coordination project with warm material selections, custom millwork, and a cohesive living space presentation.",
    featured_image: "/portfolio/haverish/haverish-01.jpg",
    gallery_images: ["/portfolio/haverish/haverish-01.jpg", "/portfolio/haverish/haverish-02.jpg", "/portfolio/haverish/haverish-03.jpg"],
    video_urls: [],
    services_used: ["Interior Design", "Cabinetry & Millwork", "Lighting Design"],
    attributes_json: [
      { label: "Scope", value: "Interior design coordination" },
      { label: "Location", value: "Scottsdale, AZ" }
    ],
    tags: ["Residential", "Interior Design"],
    status: "published",
    is_featured: true,
    client_visible: true,
    sort_order: 1,
    seo_title: null,
    seo_description: null,
    published_at: now,
    last_synced_at: null,
    sync_status: "demo",
    sync_error: null,
    metadata: {},
    created_at: now,
    updated_at: now
  },
  {
    id: "demo-8702",
    project_id: null,
    wp_post_id: null,
    title: "8702",
    slug: "8702",
    subtitle: "Full Interior Renovation",
    category: "Residential",
    year: 2023,
    location: "Scottsdale, AZ",
    timeline: "4 mo",
    square_feet: 1400,
    description: "Constructed Matter put together the full interior design package with finish specs and transformed the space.",
    featured_image: "/portfolio/8702/8702-01.jpg",
    gallery_images: ["/portfolio/8702/8702-01.jpg", "/portfolio/8702/8702-02.jpg"],
    video_urls: [],
    services_used: ["Plumbing", "Electrical", "Tile & Stone", "Interior Design"],
    attributes_json: [
      { label: "Year", value: "2023" },
      { label: "Timeline", value: "4 mo" }
    ],
    tags: ["Residential", "Renovation"],
    status: "published",
    is_featured: true,
    client_visible: true,
    sort_order: 2,
    seo_title: null,
    seo_description: null,
    published_at: now,
    last_synced_at: null,
    sync_status: "demo",
    sync_error: null,
    metadata: {},
    created_at: now,
    updated_at: now
  }
];
