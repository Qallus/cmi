export interface ArticleSection {
  heading?: string;
  body: string;
}

export interface ArticleContent {
  slug: string;
  sections: ArticleSection[];
}

export const ARTICLE_CONTENT: ArticleContent[] = [
  {
    slug: "custom-home-build",
    sections: [
      {
        body: "Building a custom home is one of the most significant decisions you'll ever make — and one of the most rewarding. But between breaking ground and handing over the keys, there are a lot of moving parts. After managing hundreds of custom builds across Arizona, we've learned that the clients who feel most confident throughout the process are the ones who knew what to expect before it started.",
      },
      {
        heading: "Phase 1: Pre-Construction",
        body: "Before a single shovel hits the dirt, there's weeks of groundwork that happens behind the scenes. This is where your architectural plans get reviewed and finalized, permits are submitted to the city or county, and subcontractors are lined up. A good general contractor will pull you into this phase early — not just hand you a timeline. Expect questions about finish selections, material lead times, and structural decisions that are much easier (and cheaper) to make now than mid-build.",
      },
      {
        heading: "Phase 2: Site Prep and Foundation",
        body: "Once permits are approved, the site gets cleared, graded, and prepped for the foundation. This phase feels slow from the outside — a lot of dirt moving — but what happens here sets the tolerance for everything above it. In Arizona, we deal with expansive soils in some areas, which means proper compaction tests and engineered pads aren't optional. If your contractor is skipping these steps, that's a red flag.",
      },
      {
        heading: "Phase 3: Framing",
        body: "Framing is the phase most homeowners get excited about because the house starts to look like a house. Walls go up, the roof structure takes shape, and you can finally walk through and feel the scale of each room. This is also the best time to flag any layout concerns — once drywall goes in, moving a wall is a real cost. Your project manager should be scheduling a framing walk with you before insulation begins.",
      },
      {
        heading: "Phase 4: MEP Rough-In",
        body: "Mechanical, electrical, and plumbing rough-in happens while the walls are still open. This is where every wire, pipe, and duct gets run to its final location — behind drywall, in the floor, through the ceiling. It's also where experienced trade coordination matters most. Congested ceilings and competing trades in tight spaces are common causes of delays. A GC who's managed the schedule well gets all three trades in and inspected without stoppage.",
      },
      {
        heading: "Phase 5: Drywall, Finishes, and Trim",
        body: "Drywall board, tape, texture, and paint transform the skeleton into a home. This phase takes longer than most clients expect, and that's okay — rushing paint and texture shows. After paint comes the trim carpentry, cabinetry installation, countertops, tile, and flooring. The order matters: cabinets before countertops, tile before baseboards, flooring before hardware. A well-sequenced schedule protects your finishes and keeps trades from tripping over each other.",
      },
      {
        heading: "Phase 6: Final Inspections and Walkthrough",
        body: "The punch list is the last mile. Your GC walks the home, creates a list of items to correct or complete, and your job is to be thorough. Look at every outlet, every door, every tile edge. A reputable builder takes this seriously — they want you to find everything before you move in. After punch list sign-off, final inspections are scheduled, the certificate of occupancy is issued, and you get your keys. No surprises, no shortcuts. That's how a CMI build ends.",
      },
    ],
  },
  {
    slug: "adu-101",
    sections: [
      {
        body: "Accessory dwelling units — ADUs — have become one of the most practical investments an Arizona homeowner can make. Whether you're looking to house a family member, generate rental income, or add long-term value to your property, an ADU is worth understanding before you build. Here's what you need to know before breaking ground.",
      },
      {
        heading: "What Counts as an ADU?",
        body: "An ADU is a secondary, self-contained dwelling unit on a residential property. That includes detached casitas, garage conversions, basement apartments, and attached in-law suites. In Arizona, the rules vary by municipality — Scottsdale, Phoenix, Tempe, and Mesa each have their own setback requirements, size limits, and owner-occupancy rules. The first step is always a zoning check specific to your parcel.",
      },
      {
        heading: "Size and Setback Rules",
        body: "Most Arizona jurisdictions allow ADUs up to 50% of the primary home's square footage, or a hard cap around 1,000–1,200 sq ft. Setbacks from property lines typically run 5–10 feet, and some municipalities require the ADU to match the primary structure's architecture. Before you fall in love with a floor plan, verify what your lot actually allows — not what you read in a general article.",
      },
      {
        heading: "Permitting: Don't Skip It",
        body: "Unpermitted ADUs are a serious liability. They complicate refinancing, create problems at resale, and can result in removal orders from the city. The permitting process for an ADU involves architectural drawings, structural engineering, MEP plans, and multiple city inspections. It adds 4–8 weeks to the pre-construction timeline, but it's non-negotiable. A GC who suggests skipping permits to save time is not someone you want building your ADU.",
      },
      {
        heading: "What Does It Cost?",
        body: "In the Phoenix metro, expect to budget $175–$275 per square foot for a well-built detached ADU, all-in. A 600 sq ft casita runs $105K–$165K depending on finishes, site conditions, and utility connections. Garage conversions are typically less because the structure already exists, but the foundation, insulation, and MEP upgrades add up quickly. Get a full scope estimate before committing — not a per-foot range from a salesperson.",
      },
      {
        heading: "Rental Income Potential",
        body: "A well-located ADU in Scottsdale or the East Valley can generate $1,500–$2,200/month in long-term rental income, or more for short-term. Run your numbers with a real estate advisor, but the general rule holds: a properly built ADU typically pays for itself within 7–12 years in rental income alone, while also adding 20–30% of its cost to the home's appraised value.",
      },
    ],
  },
  {
    slug: "interior-design-trends-2026",
    sections: [
      {
        body: "Arizona's design landscape has matured significantly over the last few years. The maximalist, all-white, all-neutral wave that dominated the 2010s has given way to something more considered — homes that feel deliberately assembled rather than templated. Here's what's defining the best interiors coming out of Scottsdale and the broader Valley in 2026.",
      },
      {
        heading: "Warm Neutrals Are Replacing Cool Grays",
        body: "The cool gray walls that seemed universal five years ago are being replaced — quickly. Warm putty tones, aged whites, limewash finishes, and earthy taupes are the new baseline. These colors work better with Arizona's natural light, which has an amber quality in the afternoons that makes cool tones look harsh. Benjamin Moore's Pale Oak, Swiss Coffee, and Sherwin-Williams' Accessible Beige aren't going anywhere.",
      },
      {
        heading: "Natural Materials, Everywhere",
        body: "Stone, plaster, wood, leather, linen — the push toward organic materials is real and sustained. We're seeing Venetian plaster walls replacing painted drywall in feature rooms, honed travertine replacing polished porcelain, and live-edge or wire-brushed oak replacing smooth MDF cabinetry. The common thread is texture and imperfection — materials that look like they came from the earth rather than a factory.",
      },
      {
        heading: "Concealed and Integrated Cabinetry",
        body: "Integrated appliances, flush-panel cabinetry, and hidden storage are defining high-end kitchen design in 2026. The goal is a kitchen that reads as a singular architectural object rather than a room filled with appliances. Panel-ready refrigerators, integrated dishwashers, and push-to-open drawers with no visible hardware are now standard asks on high-end custom builds.",
      },
      {
        heading: "Bolder Accent Choices",
        body: "While the background is warm and restrained, accent selections are becoming bolder. Dark-stained wood islands against light perimeter cabinetry, deep sage or slate cabinetry in secondary kitchens, unlacquered brass and aged bronze hardware — these are design choices that would have felt risky five years ago but now read as confident and considered.",
      },
      {
        heading: "Outdoor-Indoor Continuity",
        body: "In Arizona's climate, the relationship between indoor and outdoor living has always been important — but the execution has gotten much more intentional. Full-panel sliding glass walls that open to covered patios, matching interior and exterior flooring through the threshold, and outdoor kitchens that match the interior kitchen's finish level are all standard in high-end builds now. The goal is that the outdoor space feels like another room, not an afterthought.",
      },
    ],
  },
  {
    slug: "commercial-construction-process",
    sections: [
      {
        body: "Commercial construction runs on a different set of rules than residential. The stakes are higher, the schedules are tighter, and the consequences of a missed coordination point can cascade across multiple trades and push a client's opening date back by weeks. Here's how CMI manages complexity on large-scale commercial projects — from pre-construction through final punch.",
      },
      {
        heading: "Pre-Construction: Where the Real Work Happens",
        body: "The most important phase of any commercial project is the one before construction starts. We review full sets of construction documents, identify conflicts in MEP coordination, establish a realistic critical-path schedule, and lock in major subcontractors before ground breaks. Value engineering conversations happen here — not mid-build, where scope changes cost double.",
      },
      {
        heading: "Phased Construction and Operational Continuity",
        body: "Many commercial jobs — particularly tenant improvements and occupied-building renovations — require phased construction to keep existing operations running. This means sequenced demolition, temporary walls, dust barriers, off-hours work for high-impact tasks, and regular coordination meetings with the building owner or property management. A GC who has only built ground-up doesn't understand the operational complexity of a live-building TI.",
      },
      {
        heading: "Trade Coordination and the Superintendent Role",
        body: "On any commercial job above 5,000 sq ft, the superintendent's role is essentially full-time logistics. Coordinating material deliveries with elevator and loading dock schedules, sequencing drywall, electrical, mechanical, and plumbing rough-ins without conflicts, and managing inspection windows across multiple city departments requires someone who has managed this complexity before. CMI's superintendents carry this responsibility directly, not through a subcontractor.",
      },
      {
        heading: "Schedule as a Deliverable",
        body: "Commercial clients have opening dates, lease commencement dates, and investor commitments tied to project delivery. The schedule isn't a suggestion — it's a deliverable. We build schedules with float, identify the critical path, and update them weekly. When something slips — weather, material delays, permit holds — we have a documented recovery plan rather than a shrug.",
      },
      {
        heading: "Closeout and Commissioning",
        body: "Commercial closeout is substantially more complex than residential. Certificate of occupancy requires signed off inspections across building, fire, electrical, plumbing, and mechanical departments. Many commercial buildings also require systems commissioning — verifying that HVAC, fire suppression, and electrical systems perform to spec before occupancy. CMI's closeout process starts 4 weeks before the target delivery date, not after.",
      },
    ],
  },
  {
    slug: "renovation-checklist",
    sections: [
      {
        body: "Renovations fail for predictable reasons: scope creep, unclear decisions, missed lead times, and the wrong GC for the job. The homeowners who come out of a renovation proud of the result — and still speaking to their contractor — usually did one thing differently: they prepared. This checklist covers what to have in place before your renovation starts.",
      },
      {
        heading: "1. Define the Scope in Writing",
        body: "Your renovation scope should exist as a document, not a conversation. It should specify every room, every finish, every appliance, every structural change. 'Update the kitchen' is not a scope. 'Remove existing cabinets and countertops, install custom cabinetry to ceiling height, Calacatta quartz countertops, Sub-Zero panel-ready refrigerator, Thermador 36\" range' — that's a scope. The more specific you are, the more accurate your estimate will be.",
      },
      {
        heading: "2. Make All Material Selections Before Signing a Contract",
        body: "Lead times on tile, cabinets, appliances, and fixtures can run 8–16 weeks. If your contractor frames out a kitchen before your cabinets are selected, you'll be living with compromise — or paying for a change order. Make your finish selections before the contract is signed, and confirm availability and lead times with your supplier before the schedule is built.",
      },
      {
        heading: "3. Understand What Requires a Permit",
        body: "Structural changes, electrical panel work, new plumbing, HVAC modifications, and additions almost always require permits in Arizona. Cosmetic work — flooring, paint, cabinet replacement with no structural changes — typically doesn't. Ask your GC to specify which items require permits and what the review timeline looks like in your jurisdiction. Unpermitted work is a liability you carry long after the contractor is gone.",
      },
      {
        heading: "4. Build a Contingency Budget",
        body: "Every renovation reveals something unexpected — a rotted subfloor, outdated wiring, a plumbing chase that's not where the plans say it is. Budget 10–15% above your contract amount for unforeseen conditions. If you don't use it, great. If you need it and don't have it, you're making decisions under financial pressure.",
      },
      {
        heading: "5. Establish Communication Norms Upfront",
        body: "Who is your single point of contact at the contracting company? How often will you receive schedule updates? What's the process for approving change orders? What's the communication channel — email, app, text? These questions feel administrative, but they prevent 80% of the friction that turns a renovation sour. Establish them before you sign.",
      },
      {
        heading: "6. Plan Your Living Situation",
        body: "If your kitchen is being gutted for 8 weeks, where are you eating? If your master bath is out, is the guest bath functional? Plan your temporary living situation in advance — not on demo day. Many clients underestimate how disruptive a major renovation is to daily life, and the stress of that disruption bleeds into how they perceive the project overall.",
      },
    ],
  },
  {
    slug: "choosing-a-general-contractor",
    sections: [
      {
        body: "Choosing a general contractor is one of the most consequential decisions in any construction or renovation project. The price on the estimate matters less than most people think — what matters is whether the person building your home has the experience, systems, and communication skills to deliver. Here are the five things that actually matter when you're vetting a GC in Arizona.",
      },
      {
        heading: "1. License and Insurance — Non-Negotiable",
        body: "In Arizona, general contractors are licensed through the Arizona Registrar of Contractors (ROC). A residential GC needs a B-1 license; commercial work requires an additional classification. Verify the license is active at roc.az.gov before any conversation goes further. Beyond the license, require a current Certificate of Insurance showing general liability and workers' compensation coverage. If a subcontractor is injured on your property and the GC isn't properly insured, that liability can land on you.",
      },
      {
        heading: "2. Portfolio Relevance",
        body: "A GC who primarily builds commercial tenant improvements is not the same as one who builds high-end custom homes — even if they'll take both jobs. Review their completed work carefully. Ask to see projects similar in scope, size, and finish level to yours. Better yet, ask if you can visit a completed project or speak with a past client. A contractor who can't provide references from projects like yours hasn't done them.",
      },
      {
        heading: "3. Communication Style",
        body: "The contractor who communicates worst during the sales process will communicate worst during construction. Pay attention: do they return calls promptly? Are their written estimates clear and detailed? Do they answer your questions directly or deflect? Communication breakdowns are the root cause of most renovation disputes. The best GCs are proactive communicators — you hear from them before you need to ask.",
      },
      {
        heading: "4. Estimate Structure",
        body: "A quality estimate is itemized by scope, not a single total number. You should be able to see material allowances, labor costs, subcontractor line items, and overhead and profit as separate entries. A single-line estimate for a $200,000 project is not an estimate — it's a placeholder. Ask for the breakdown, and if a contractor can't or won't provide one, move on.",
      },
      {
        heading: "5. Culture and Chemistry",
        body: "You will be in a working relationship with this person for months. Do they show up on time? Do they treat your property with respect on the site walk? Do they listen when you describe what you want, or do they immediately start selling? The best GC for your project is one who is technically excellent and genuinely interested in getting it right — not just getting it done. Trust your read on that as much as the paperwork.",
      },
    ],
  },
  {
    slug: "spotlight-ambassador-adu",
    sections: [
      {
        body: "The Drake Residence was one of the most ambitious ground-up residential builds CMI has taken on — a 4,200 sq ft custom home with a detached 800 sq ft casita, outdoor kitchen, and pool on a sloped lot in north Scottsdale. From initial site work through final walkthrough, the project took 14 months and involved over 40 subcontractors. Here's how it came together.",
      },
      {
        heading: "The Brief",
        body: "The clients came to CMI after going through a design-build process with two other firms that hadn't delivered a construction document set they felt confident building from. They wanted a modern desert contemporary home that didn't fight the site's natural grade, a casita for extended family visits, and an outdoor living space that would be genuinely usable 10 months of the year. The design team had a strong vision — CMI's job was to make it buildable and deliver it.",
      },
      {
        heading: "Site Challenges",
        body: "The lot had an 18-foot elevation change from front to back — a significant grade that required a carefully engineered retaining system and a split-level foundation approach. Early in pre-construction, we worked with the structural engineer to optimize the retaining wall design and reduce excavation volume. The result was a home that steps down with the site rather than fighting it, with a lower level that opens directly to the pool deck.",
      },
      {
        heading: "Trade Coordination on a Complex Site",
        body: "A sloped lot with two structures — the main house and the casita — requires careful sequencing. We phased the foundation work to allow the structural framing of the main house to proceed while retaining wall work continued at the lower grade. MEP rough-in across both structures required a coordinated underground utility plan that connected to the main house systems while allowing the casita to function independently if needed.",
      },
      {
        heading: "Finishes and Selections",
        body: "The clients had strong preferences and worked with an interior designer throughout the process. All finish selections were locked before construction began — a discipline that paid dividends. The kitchen featured 12-foot ceilings with custom cabinetry to ceiling height, integrated Thermador appliances, and a quartzite island. The primary bath included a curbless shower with a continuous floor-to-ceiling stone tile pattern that required precision layout and a specialty tile installer.",
      },
      {
        heading: "Delivery",
        body: "The Drake Residence was delivered two weeks ahead of the original schedule, within budget, and with a punch list that was closed within three weeks of turnover. The clients have since referred two projects to CMI. For our team, this build represents what happens when great design, thorough pre-construction, and disciplined field management come together. It's the kind of project that makes the work worth doing.",
      },
    ],
  },
];

export function getArticleContent(slug: string): ArticleContent | null {
  return ARTICLE_CONTENT.find((a) => a.slug === slug) ?? null;
}
