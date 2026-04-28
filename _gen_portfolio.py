import os

BASE = r"c:\Users\jwate\Constructed Matter Inc\portfolio"
SQSP = "https://images.squarespace-cdn.com/content/v1/61045ebed448e64bea2d4efb/"

projects = [
  dict(
    slug="ambassador-adu",
    title="Ambassador ADU",
    category="ADU",
    location="Arcadia / Scottsdale, AZ",
    year="2024",
    scope=["Detached ADU", "New Construction", "Permitting", "Interior Finishes", "Utility Connection"],
    sqft="620",
    description=[
      "The Ambassador ADU is a detached accessory dwelling unit set on a generous corner lot in Arcadia — finished to the standard of a primary residence and designed to function as one.",
      "Built as a self-contained income-generating unit, the project required a new utility service lateral, minor site regrading, and custom cabinetry fabricated off-site. The architectural palette mirrors the main house: stucco exterior, clay tile roofline details, and steel-framed windows that let in north light.",
      "Interior finishes were specified to hotel standard — concrete look tile floors, quartzite kitchen counters, integrated undercabinet lighting, and full-size appliances throughout. From groundbreaking to certificate of occupancy: eight months.",
    ],
    images=[
      SQSP+"f8d1c98a-e6b7-4b1d-ab9e-3ce111e9b817/Kit+Detail+2.jpg",
      SQSP+"a162f250-9a9e-4534-8539-cf97fe354da8/Kit+Detail.jpg",
      SQSP+"347f1cc7-d335-4f7b-8ed5-0a6e29c0a386/Kit+Shelf.jpg",
      SQSP+"199ab360-67f6-4307-9d8a-b82ec369a930/Kit+Detail+3.jpg",
      SQSP+"2552562b-0622-4402-9649-38b2cc78ac91/Living+Room+Detail.jpg",
      SQSP+"7279d35a-716a-485a-8603-baf24f26626f/Chair.jpg",
      SQSP+"c66e3390-0b69-4057-94a7-dc17d51e9d95/Bed+2.jpg",
      SQSP+"3f6b3379-697b-423e-bdfa-accc6d1361b2/Vanity+Detail.jpg",
      SQSP+"be0c4f51-2299-4e39-9832-11801f512773/Vanity+Detail+2.jpg",
      SQSP+"5b86f7cc-57ea-40cb-8cf1-e68e1c9c8231/Bath+Towel+Detail.jpg",
      SQSP+"7ef8128b-8fc2-48c3-aeca-58b7f26e8e07/Ext2.jpg",
      SQSP+"4484164b-6d54-4a3a-8650-654a14364de1/Ext.jpg",
      SQSP+"dabc3215-7ffd-402d-99d0-eab67c305b8c/DJI_0384.JPG",
      SQSP+"30ffd8a6-d378-454c-b765-a303f9bba3d9/DJI_0383.JPG",
    ],
  ),
  dict(
    slug="8702",
    title="8702",
    category="Residential",
    location="Scottsdale, AZ",
    year="2023",
    scope=["Custom Home", "New Construction", "Landscape Integration", "Pool & Hardscape", "Smart Home"],
    sqft="3,900",
    description=[
      "8702 is a ground-up custom residential build in Scottsdale — a single-story desert contemporary home designed around a central courtyard and seamless indoor-outdoor connectivity.",
      "The project was developed under CMI's full design-build process, with structural and interior design decisions made in parallel from day one. The result is a home where architecture and interiors feel unified rather than assembled.",
      "The outdoor environment received equal attention — a negative-edge pool, covered ramada, outdoor kitchen, and native landscape design create a resort-quality backyard that functions as a genuine extension of the main living area.",
    ],
    images=[
      SQSP+"123aab5a-5d9c-4da3-ade7-0c00a8ae39ea/Brandons+House-1.jpg",
      SQSP+"fa98872c-8902-4163-a99a-e94314e9486e/Brandons+House-8.jpg",
      SQSP+"9ff371d4-12b0-499b-928b-5e7dc27902bd/Brandons+House-2.jpg",
      SQSP+"ffd661c4-d6cc-43ad-82da-a83a6efcab53/Brandons+House-5.jpg",
      SQSP+"434a6045-cd83-42d4-9855-3d6f0e621dbf/Brandons+House-4.jpg",
      SQSP+"0d9a25ba-051c-432d-a79f-b6d09446d26e/Brandons+House-3.jpg",
      SQSP+"8e15bef4-fa19-4c7e-b458-4b90c2529509/Brandons+House-7.jpg",
      SQSP+"bc55e6fe-b78d-4940-b484-53e592ad3466/Brandons+House-10.jpg",
      SQSP+"4a40a962-e791-4581-a0fd-ec4ae11c2253/Brandons+House-6.jpg",
      SQSP+"c8c45d07-8b89-40e2-947d-6c10e9c95a14/Brandons+House-9.jpg",
    ],
  ),
  dict(
    slug="conrad-interior",
    title="Conrad Interior",
    category="Interior Design",
    location="Scottsdale, AZ",
    year="2024",
    scope=["Interior Design", "Custom Millwork", "Material Selection", "Finish Coordination", "Lighting Design"],
    sqft="3,400",
    description=[
      "The Conrad Interior project was a full-scope interior design engagement for a custom residence in Scottsdale — a home that required thoughtful material curation, custom millwork, and a cohesive design language from entry to primary suite.",
      "Working directly with the homeowners from concept through installation, our interior design team developed a warm, layered palette anchored by limewash plaster walls, honed travertine floors, and unlacquered brass hardware. Every finish selection was made with longevity and livability in mind.",
      "Custom cabinetry was designed in-house and fabricated locally. Lighting design was coordinated with the electrical contractor to achieve a layered, scene-capable system throughout the main living areas.",
    ],
    images=[
      SQSP+"589cd039-0f3e-488c-a28a-dc00086c6c8a/Conrad+Residence-13.jpg",
      SQSP+"00e612d1-f64f-4d38-a078-b5afc12a4127/Conrad+Residence-14.jpg",
      SQSP+"6889db1a-ea10-47e5-ab5f-5982b4e2123e/Conrad+Residence-15.jpg",
      SQSP+"6adbbe37-54bf-400a-9e39-833d3ea06e47/Conrad+Residence-16.jpg",
      SQSP+"7f8fcbb9-4fd9-4be5-8c8b-2c88c83a8e0e/Conrad+Residence-17.jpg",
      SQSP+"86e2b418-d63a-4a54-9d62-de9932e4aea6/Conrad+Residence-18.jpg",
      SQSP+"6e7ca713-6471-4697-89fb-cff025f5bf90/Conrad+Residence-19.jpg",
      SQSP+"b85fb321-92d3-44a8-8070-4e47deaae575/Conrad+Residence-20.jpg",
      SQSP+"29564708-0399-4ddd-b70a-68aace3da7c0/Conrad+Residence-21.jpg",
      SQSP+"43bd94ec-81be-473d-bb71-60c97d6c3352/Conrad+Residence-22.jpg",
      SQSP+"923fd76c-f6c1-4929-a6d7-a4237ff8b1a3/Conrad+Residence-23.jpg",
      SQSP+"7f498c6c-d40f-4970-a0b4-d9475174c5fa/Conrad+Residence-24.jpg",
      SQSP+"841909a9-bd00-4104-8866-3bebeca81d6f/Conrad+Residence-25.jpg",
      SQSP+"521c2d92-2b75-4e08-a17a-f847c43e0c53/Conrad+Residence-26.jpg",
      SQSP+"98d27b0b-f626-4a97-b633-e5142d727c45/Conrad+Residence-27.jpg",
      SQSP+"57b33805-702d-4893-9045-f3ec277c9100/Conrad+Residence-28.jpg",
      SQSP+"04d1b84c-6fa8-468a-b66a-1fac5aa0112c/Conrad+Residence-30.jpg",
      SQSP+"2c9b5bdc-e9f2-42a4-98aa-3729526a623a/Conrad+Residence-31.jpg",
      SQSP+"36d565b3-9bc6-4445-9a59-7df15ff884ed/Conrad+Residence-32.jpg",
      SQSP+"1908f3fe-d28e-459c-a4a3-2e3feaaaae15/Conrad+Residence-33.jpg",
    ],
  ),
  dict(
    slug="ply-place",
    title="Ply Place",
    category="Residential",
    location="Scottsdale, AZ",
    year="2024",
    scope=["Custom Home", "New Construction", "Design-Build", "Landscape Coordination", "Smart Home Integration"],
    sqft="4,100",
    description=[
      "Ply Place is a ground-up custom residential build in Scottsdale — a modern desert home designed to take full advantage of its site orientation, indoor-outdoor flow, and the Arizona climate.",
      "The project was delivered under a design-build contract, allowing CMI to integrate structural decisions with interior design selections from the earliest planning stages. The result is a home where storage, lighting, and material transitions feel considered rather than retrofitted.",
      "Large-format sliding glass walls connect the main living area to a fully equipped outdoor kitchen and covered lounge. Interior finishes include wide-plank white oak flooring, custom millwork throughout, and a statement kitchen with waterfall quartzite counters.",
    ],
    images=[
      SQSP+"eed88e19-ab27-4b5e-8a52-1adde7a6b5d8/Keim-10.jpg",
      SQSP+"478e6ad2-fc55-4762-b48c-b5fb05805e2d/Keim-16.jpg",
      SQSP+"35df99c4-71c0-4f9c-9e74-e1d50d74fc9b/Keim-11.jpg",
      SQSP+"61c0a0d3-8a9a-40df-bc54-eafd37aa462a/Keim-13.jpg",
      SQSP+"0709841a-0fbe-44b9-a158-4ffa29788c0a/Keim-14.jpg",
      SQSP+"fdb1e197-5253-4f9b-8220-0164b36600db/Keim-12.jpg",
      SQSP+"68ded38a-b653-486f-9e94-b37967d14029/Keim-15.jpg",
      SQSP+"bbe626a5-10f7-405c-a33d-48f36a1b78af/Keim-22.jpg",
      SQSP+"7bbccbaa-9813-4fd3-bd46-42ba959e3473/Keim-28.jpg",
      SQSP+"73dadfab-1393-46a4-b4dd-756a667984bb/Keim-27.jpg",
      SQSP+"c2f2528c-e86a-4524-9157-5a418b4cf671/Keim-29.jpg",
      SQSP+"e6b3e2aa-031c-4ece-ba7d-f88cdf9f056b/Keim-33.jpg",
      SQSP+"b4ba5425-6348-42b4-ab33-1faa171914c3/Keim-35.jpg",
      SQSP+"9eba01b5-194f-4b87-a511-5fefe8625fe3/Keim-38.jpg",
      SQSP+"7d129a68-79a0-4ad7-9e38-10e6d950e9d1/Keim-40.jpg",
    ],
  ),
  dict(
    slug="garden-plaza",
    title="Gaarden Plaza",
    category="Commercial",
    location="Scottsdale, AZ",
    year="2023",
    scope=["Commercial TI", "MEP Coordination", "ADA Compliance", "Permitting", "Project Management"],
    sqft="8,200",
    description=[
      "Garden Plaza was a full commercial tenant improvement project in Scottsdale — a multi-suite retail and mixed-use building requiring phased construction around active neighboring tenants.",
      "CMI managed all trade coordination, permitting, and ADA compliance for the project. The scope included new MEP systems throughout, demising wall construction, storefront glazing, and finish-out of four tenant suites to base building standard.",
      "The project was completed on schedule and within budget — a result of aggressive preconstruction planning and a subcontractor buyout that locked pricing three months before construction began.",
    ],
    images=[
      SQSP+"1e81aab0-672a-40ef-8ee4-324172b85e8b/Trinity+Church-14.jpg",
      SQSP+"f6d950dc-4ea8-4283-b330-0ae350bd1b3b/Screenshot+2023-05-08+at+8.54.25+PM.png",
      SQSP+"aec8cd5c-743d-4ec3-b285-90a52dbd01e0/Trinity+Church-15.jpg",
      SQSP+"52e3781f-0dd7-420e-9f2c-971f7f028306/Trinity+Church-16.jpg",
      SQSP+"b44acf0f-b3cb-4af9-9fa2-f40046cc8707/Trinity+Church-7.jpg",
      SQSP+"bd631bff-603c-4681-aa82-ef0e099ca5b7/Trinity+Church-6.jpg",
      SQSP+"4318ba63-2f0a-437c-9979-f9c1ab3045bb/Trinity+Church-8.jpg",
      SQSP+"87dda0a8-3040-4460-b233-f420750a780c/Trinity+Church-9.jpg",
      SQSP+"13988564-582c-455e-9b6f-29c723bed451/Trinity+Church-1.jpg",
      SQSP+"fb56bf4f-0e7c-40cd-8a30-d06219172073/Trinity+Church-13.jpg",
    ],
  ),
  dict(
    slug="res-inn",
    title="Res. Inn",
    category="Commercial",
    location="Mesa, AZ",
    year="2023",
    scope=["Exterior Renovation", "Hospitality", "Phased Construction", "Permitting", "Project Management"],
    sqft="18,200",
    description=[
      "The Residence Inn renovation was a hospitality sector engagement in Mesa — a phased exterior improvement project on an active, occupied Marriott property requiring careful coordination around ongoing guest operations.",
      "CMI managed the full exterior scope, including surface preparation, coating systems, and site logistics designed to minimize disruption to hotel operations. All work was sequenced in coordination with property management to maintain occupancy throughout construction.",
      "The result is a refreshed exterior envelope that brings the property in line with current Marriott brand standards and strengthens the property's competitive position in the Mesa market.",
    ],
    images=[
      SQSP+"82492f12-6244-45a1-b882-0ddc7926cd86/Hotel-2.jpg",
      SQSP+"d8c9908c-63d7-4a28-91f1-1015024a4c49/Hotel-1.jpg",
      SQSP+"e1d717ba-8bee-43d1-b612-58e50ef5a4f0/Hotel-4.jpg",
      SQSP+"da83a59a-74c7-4bf2-8c1e-a6a98ce99a06/Hotel-3.jpg",
      SQSP+"b399db5c-ab00-4b98-9544-579ed580277b/Hotel-5.jpg",
      SQSP+"76743656-1daf-404d-8805-b15d582d30a7/Hotel-6.jpg",
    ],
  ),
  dict(
    slug="real-faith-studio",
    title="Real Faith Studio",
    category="Commercial",
    location="Scottsdale, AZ",
    year="2022",
    scope=["Interior Design", "Commercial TI", "Custom Millwork", "Finish Coordination", "Permit Management"],
    sqft="2,800",
    description=[
      "Real Faith Studio was a full interior design and commercial tenant improvement project in Scottsdale — a creative studio environment designed to support the work produced within it.",
      "CMI coordinated the complete commercial TI scope in partnership with the interior design team, managing permit coordination, trade supervision, and custom millwork fabrication through to final occupancy.",
      "The finished space features clean-lined built-ins, carefully curated material selections, and a lighting system designed to support both focused creative work and client-facing presentations.",
    ],
    images=[
      SQSP+"5acfa8e2-ab12-4e79-9250-c56e77358799/Trinity+Church+Office-4+edit.jpg",
      SQSP+"f0658d5e-5385-4180-964d-6c1d32fa1f44/Trinity+Church+Office-7.jpg",
      SQSP+"c4abb930-3b38-4658-ba5e-9d1c6f553752/Trinity+Church+Office-9+edit.jpg",
      SQSP+"65cceffd-7348-454c-b5bc-65fcd3dde426/Trinity+Church+Office-6.jpg",
      SQSP+"79272505-1e82-4a4f-a18b-f1518777d775/Trinity+Church+Office-13.jpg",
      SQSP+"d1de37aa-de4d-4f94-83d0-542dfd73fa6a/Trinity+Church+Office-3+Edit.jpg",
      SQSP+"4538d2a1-ba37-4512-af07-091ae0e5678e/Trinity+Church+Office-5.jpg",
      SQSP+"39cb7149-7e8c-4671-820c-ad372a64956a/Trinity+Church+Office-2.jpg",
      SQSP+"b32e375d-b66a-4968-80dc-cc3af7bfe7dc/Trinity+Church+Office-1.jpg",
      SQSP+"bd4f1442-9392-4fe8-b2c5-b3af7734147f/Trinity+Church+Office-15+Edit.jpg",
      SQSP+"be142560-3187-44c6-937f-af9a5bb76c4e/Trinity+Church+Office-8.jpg",
      SQSP+"2c2d6ebc-57ed-422f-90f2-c4fe753d7db1/Trinity+Church+Office-12.jpg",
    ],
  ),
  dict(
    slug="vw-garage",
    title="VW Garage",
    category="Commercial",
    location="Scottsdale, AZ",
    year="2022",
    scope=["Commercial Build-Out", "High-Bay Construction", "Specialty MEP", "Permitting", "Project Management"],
    sqft="12,400",
    description=[
      "The VW Garage project was a ground-up commercial build-out for a specialty automotive facility in Scottsdale — a high-bay, high-finish environment designed for both function and client experience.",
      "The scope included structural steel framing, specialty mechanical systems (compressed air, vehicle lift infrastructure, exhaust ventilation), high-gloss polished concrete floors, and a premium client lounge and showroom area.",
      "CMI managed all trade coordination and permitting through the City of Scottsdale. The project was completed in 11 months and received its certificate of occupancy ahead of the client's target opening date.",
    ],
    images=[
      SQSP+"1a36b7ac-c91d-4e07-aefa-d0c168014f1c/VW+Garage-4.jpg",
      SQSP+"4e4d5a9e-d768-43a8-a6ba-6e9991c9f1b1/VW+Garage-1.jpg",
      SQSP+"0864c0f0-43c1-4df0-ac27-3c6688a2d963/VW+Garage-5.jpg",
      SQSP+"23fe45d3-4e1b-4716-b1c8-e6119553142f/VW+Garage-3.jpg",
      SQSP+"03213b7a-1a95-44ab-b32c-9fe62c46f955/VW+Garage-2.jpg",
      SQSP+"db57d7ea-109d-43cd-922c-76921ea255ee/VW+Garage-9.jpg",
      SQSP+"3c8b35a2-bd4b-4e4e-93d1-29024440248c/VW+Garage-8.jpg",
      SQSP+"4edd91d7-4344-4544-80de-9bab1de452c7/VW+Garage-7.jpg",
      SQSP+"10a3094c-006a-4e84-8d7b-00128cd2ebc6/VW+Garage-6.jpg",
      SQSP+"1a120285-056b-4e3b-b388-1f30796bfbcf/VW+Garage-10.jpg",
      SQSP+"c0f86a8d-511f-4448-841c-5e383c069a12/VW+Garage-11.jpg",
    ],
  ),
  dict(
    slug="parco",
    title="Parco",
    category="Residential",
    location="Scottsdale, AZ",
    year="2023",
    scope=["Luxury Renovation", "Kitchen & Bath", "Structural Modifications", "Custom Millwork", "Exterior Improvements"],
    sqft="5,600",
    description=[
      "The Parco project was a comprehensive luxury renovation of an existing custom home in Scottsdale — a complete transformation of the interior while preserving the architectural bones of the original structure.",
      "The scope included a full kitchen and primary bath remodel, structural wall removals to open the main living area, custom built-in millwork throughout, and exterior improvements including a new pool deck and landscape redesign.",
      "CMI managed the project under a design-build contract, coordinating directly with the homeowners on every material selection. The renovation was executed in phases to allow the family to remain in the home throughout construction.",
    ],
    images=[
      SQSP+"f7e8ec78-a4fd-4fac-9dcd-385ddce06322/Parco+Residence-12.jpg",
      SQSP+"c1258a72-9178-431e-a1fa-003f91cc337a/Parco+Residence-13.jpg",
      SQSP+"45dec560-fa9b-4ec8-898c-a942503e44db/Parco+Residence-15.jpg",
      SQSP+"d255b48f-9d02-423e-b662-1c916d2d4fc1/Parco+Residence-14.jpg",
      SQSP+"a1db389c-aba9-4c28-8c5d-be8526ed0b78/Parco+Residence-1.jpg",
      SQSP+"379d1330-f07c-4ff6-a3f5-0a0ebf14dbd3/Parco+Residence-2.jpg",
      SQSP+"a913f3ff-ae56-4afc-9da3-4dd6d319b104/Parco+Residence-3.jpg",
      SQSP+"15159832-62a7-412a-8b84-c8e713899393/Parco+Residence-9.jpg",
      SQSP+"c6029b24-c8ec-4773-9182-372f53659426/Parco+Residence-8.jpg",
      SQSP+"6be562f4-1463-48ba-9f45-51320e405a75/Parco+Residence-5.jpg",
      SQSP+"1b9fabe3-5951-4d23-9d09-3bc7e2857b1f/Parco+Residence-7.jpg",
      SQSP+"c768be1c-ea9c-4e4f-99dc-2e1f19d7c050/Parco+Residence-4.jpg",
    ],
  ),
]

NAV = '''<!-- ── Header ── -->
<header id="siteHeader" class="fixed top-0 left-0 right-0 z-50 bg-cmi-light/90 dark:bg-cmi-dark/90 backdrop-blur-md border-b border-neutral-200/60 dark:border-neutral-800/50 transition-all">
  <div class="max-w-[1400px] mx-auto px-6 lg:px-10">
    <div class="flex items-center justify-between h-[72px]">
      <a href="../index.html" class="flex items-center" aria-label="Constructed Matter Home">
        <img src="https://wp.constructedmatter.com/wp-content/uploads/2026/03/CMI_Logo_Black.svg" alt="Constructed Matter" class="h-8 w-auto block dark:hidden" />
        <img src="https://wp.constructedmatter.com/wp-content/uploads/2026/03/CMI_Logo_White.svg" alt="Constructed Matter" class="h-8 w-auto hidden dark:block" />
      </a>
      <nav class="hidden lg:flex items-center gap-1">
        <div class="mega-trigger">
          <button class="nav-link relative px-4 py-2 text-[13px] font-medium tracking-wide uppercase text-neutral-700 dark:text-neutral-300 hover:text-cmi-gold-light dark:hover:text-cmi-gold-dark flex items-center gap-1.5">Discover<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg></button>
          <div class="mega-menu left-aligned w-64 bg-white dark:bg-cmi-dark-light border border-neutral-200/60 dark:border-neutral-800/60 rounded-xl shadow-xl p-2">
            <a href="../about.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-cmi-gold-light dark:hover:text-cmi-gold-dark transition-colors">About Us</a>
            <a href="../team.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-cmi-gold-light dark:hover:text-cmi-gold-dark transition-colors">Our Team</a>
            <a href="../resources.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-cmi-gold-light dark:hover:text-cmi-gold-dark transition-colors">Resources</a>
            <a href="../contact.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-cmi-gold-light dark:hover:text-cmi-gold-dark transition-colors">Contact</a>
          </div>
        </div>
        <div class="mega-trigger">
          <button class="nav-link relative px-4 py-2 text-[13px] font-medium tracking-wide uppercase text-neutral-700 dark:text-neutral-300 hover:text-cmi-gold-light dark:hover:text-cmi-gold-dark flex items-center gap-1.5">Services<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg></button>
          <div class="mega-menu w-[520px] bg-white dark:bg-cmi-dark-light border border-neutral-200/60 dark:border-neutral-800/60 rounded-xl shadow-xl p-4">
            <div class="grid grid-cols-2 gap-1">
              <a href="../services/residential.html" class="flex flex-col gap-1 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"><span class="text-[13px] font-medium text-neutral-800 dark:text-neutral-200">Residential</span><span class="text-xs text-neutral-500">Custom homes &amp; renovations</span></a>
              <a href="../services/commercial.html" class="flex flex-col gap-1 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"><span class="text-[13px] font-medium text-neutral-800 dark:text-neutral-200">Commercial</span><span class="text-xs text-neutral-500">Offices, retail &amp; industrial</span></a>
              <a href="../services/adu.html" class="flex flex-col gap-1 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"><span class="text-[13px] font-medium text-neutral-800 dark:text-neutral-200">ADU</span><span class="text-xs text-neutral-500">Accessory dwelling units</span></a>
              <a href="../services/project-management.html" class="flex flex-col gap-1 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"><span class="text-[13px] font-medium text-neutral-800 dark:text-neutral-200">Project Management</span><span class="text-xs text-neutral-500">End-to-end oversight</span></a>
              <a href="../services/interior-design.html" class="flex flex-col gap-1 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"><span class="text-[13px] font-medium text-neutral-800 dark:text-neutral-200">Interior Design</span><span class="text-xs text-neutral-500">Spaces that reflect you</span></a>
              <a href="../services/new-construction.html" class="flex flex-col gap-1 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"><span class="text-[13px] font-medium text-neutral-800 dark:text-neutral-200">New Construction</span><span class="text-xs text-neutral-500">Built from the ground up</span></a>
            </div>
          </div>
        </div>
        <a href="../portfolio.html" class="nav-link relative px-4 py-2 text-[13px] font-medium tracking-wide uppercase text-cmi-gold-light dark:text-cmi-gold-dark">Portfolio</a>
        <a href="../contact.html" class="nav-link relative px-4 py-2 text-[13px] font-medium tracking-wide uppercase text-neutral-700 dark:text-neutral-300 hover:text-cmi-gold-light dark:hover:text-cmi-gold-dark">Contact</a>
        <button id="themeToggle" class="ml-2 w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" aria-label="Toggle theme">
          <svg class="w-4 h-4 block dark:hidden" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          <svg class="w-4 h-4 hidden dark:block" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        </button>
        <a href="../quote.html" class="ml-1 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium bg-cmi-gold-light dark:bg-cmi-gold-dark text-white hover:opacity-90 transition-opacity">Get a Free Quote</a>
      </nav>
      <div class="flex items-center gap-3 lg:hidden">
        <button id="mobileThemeToggle" class="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          <svg class="w-4 h-4 block dark:hidden" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          <svg class="w-4 h-4 hidden dark:block" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        </button>
        <button id="mobileMenuBtn" class="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>
    </div>
  </div>
</header>

<!-- Mobile Menu -->
<div id="mobileOverlay" class="mobile-overlay fixed inset-0 z-[200] lg:hidden">
  <div id="mobileBackdrop" class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
  <div class="mobile-panel absolute top-0 right-0 bottom-0 w-[300px] bg-white dark:bg-cmi-dark-light shadow-2xl overflow-y-auto">
    <div class="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-neutral-800">
      <img src="https://wp.constructedmatter.com/wp-content/uploads/2026/03/CMI_Logo_Black.svg" alt="CMI" class="h-7 w-auto block dark:hidden" />
      <img src="https://wp.constructedmatter.com/wp-content/uploads/2026/03/CMI_Logo_White.svg" alt="CMI" class="h-7 w-auto hidden dark:block" />
      <button id="mobileCloseBtn" class="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <nav class="p-5 space-y-1">
      <div>
        <button id="mobileDiscoverToggle" class="flex items-center justify-between w-full py-3 text-[15px] font-medium text-neutral-800 dark:text-neutral-200 border-b border-neutral-100 dark:border-neutral-800/60">Discover<svg id="mobileDiscoverChevron" class="w-4 h-4 text-neutral-400 transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg></button>
        <div id="mobileDiscoverSub" class="mobile-sub pl-4 space-y-1">
          <a href="../about.html" class="py-2.5 block text-[14px] text-neutral-600 dark:text-neutral-400">About Us</a>
          <a href="../team.html" class="py-2.5 block text-[14px] text-neutral-600 dark:text-neutral-400">Our Team</a>
          <a href="../resources.html" class="py-2.5 block text-[14px] text-neutral-600 dark:text-neutral-400">Resources</a>
          <a href="../contact.html" class="py-2.5 block text-[14px] text-neutral-600 dark:text-neutral-400">Contact</a>
        </div>
      </div>
      <div>
        <button id="mobileServicesToggle" class="flex items-center justify-between w-full py-3 text-[15px] font-medium text-neutral-800 dark:text-neutral-200 border-b border-neutral-100 dark:border-neutral-800/60">Services<svg id="mobileServicesChevron" class="w-4 h-4 text-neutral-400 transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg></button>
        <div id="mobileServicesSub" class="mobile-sub pl-4 space-y-1">
          <a href="../services/residential.html" class="py-2.5 block text-[14px] text-neutral-600 dark:text-neutral-400">Residential</a>
          <a href="../services/commercial.html" class="py-2.5 block text-[14px] text-neutral-600 dark:text-neutral-400">Commercial</a>
          <a href="../services/adu.html" class="py-2.5 block text-[14px] text-neutral-600 dark:text-neutral-400">ADU</a>
          <a href="../services/project-management.html" class="py-2.5 block text-[14px] text-neutral-600 dark:text-neutral-400">Project Management</a>
          <a href="../services/interior-design.html" class="py-2.5 block text-[14px] text-neutral-600 dark:text-neutral-400">Interior Design</a>
          <a href="../services/new-construction.html" class="py-2.5 block text-[14px] text-neutral-600 dark:text-neutral-400">New Construction</a>
        </div>
      </div>
      <a href="../portfolio.html" class="block py-3 text-[15px] font-medium text-cmi-gold-light dark:text-cmi-gold-dark border-b border-neutral-100 dark:border-neutral-800/60">Portfolio</a>
      <a href="../quote.html" class="flex items-center justify-center w-full py-3.5 mt-4 rounded-lg text-[14px] font-medium bg-cmi-gold-light dark:bg-cmi-gold-dark text-white hover:opacity-90 transition-opacity">Get a Free Quote</a>
    </nav>
  </div>
</div>'''

FOOTER = '''<!-- ── Footer ── -->
<footer class="bg-cmi-dark border-t border-neutral-800/60">
  <div class="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-10">
      <div>
        <img src="https://wp.constructedmatter.com/wp-content/uploads/2026/03/CMI_Logo_White.svg" alt="Constructed Matter" class="h-8 w-auto mb-4" />
        <p class="text-sm text-neutral-500 leading-relaxed">Building with intention. Delivering with precision.</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-widest text-neutral-500 mb-4 font-medium">Discover</p>
        <ul class="space-y-3">
          <li><a href="../about.html" class="text-sm text-neutral-400 hover:text-cmi-gold-dark transition-colors">About Us</a></li>
          <li><a href="../team.html" class="text-sm text-neutral-400 hover:text-cmi-gold-dark transition-colors">Our Team</a></li>
          <li><a href="../resources.html" class="text-sm text-neutral-400 hover:text-cmi-gold-dark transition-colors">Resources</a></li>
          <li><a href="../contact.html" class="text-sm text-neutral-400 hover:text-cmi-gold-dark transition-colors">Contact</a></li>
        </ul>
      </div>
      <div>
        <p class="text-xs uppercase tracking-widest text-neutral-500 mb-4 font-medium">Services</p>
        <ul class="space-y-3">
          <li><a href="../services/residential.html" class="text-sm text-neutral-400 hover:text-cmi-gold-dark transition-colors">Residential</a></li>
          <li><a href="../services/commercial.html" class="text-sm text-neutral-400 hover:text-cmi-gold-dark transition-colors">Commercial</a></li>
          <li><a href="../services/adu.html" class="text-sm text-neutral-400 hover:text-cmi-gold-dark transition-colors">ADU</a></li>
          <li><a href="../services/interior-design.html" class="text-sm text-neutral-400 hover:text-cmi-gold-dark transition-colors">Interior Design</a></li>
          <li><a href="../services/new-construction.html" class="text-sm text-neutral-400 hover:text-cmi-gold-dark transition-colors">New Construction</a></li>
        </ul>
      </div>
      <div>
        <p class="text-xs uppercase tracking-widest text-neutral-500 mb-4 font-medium">Work With Us</p>
        <ul class="space-y-3">
          <li><a href="../portfolio.html" class="text-sm text-neutral-400 hover:text-cmi-gold-dark transition-colors">Portfolio</a></li>
          <li><a href="../quote.html" class="text-sm text-neutral-400 hover:text-cmi-gold-dark transition-colors">Get a Free Quote</a></li>
        </ul>
      </div>
    </div>
    <div class="mt-14 pt-8 border-t border-neutral-800/60 flex flex-col sm:flex-row justify-between items-center gap-4">
      <p class="text-xs text-neutral-600">&copy; 2026 Constructed Matter Inc. All rights reserved.</p>
      <p class="text-xs text-neutral-600">Arizona Licensed General Contractor &middot; ROC #000000</p>
    </div>
  </div>
</footer>'''

def make_page(p):
    slug     = p['slug']
    title    = p['title']
    category = p['category']
    location = p['location']
    year     = p['year']
    scope    = p['scope']
    sqft     = p['sqft']
    desc     = p['description']
    images   = p['images']

    hero_img = images[0]

    desc_html  = '\n'.join(f'        <p class="text-[15px] text-neutral-600 dark:text-neutral-400 leading-relaxed mb-5">{d}</p>' for d in desc)
    scope_html = '\n'.join(f'          <span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">{s}</span>' for s in scope)

    # Thumbnail list for JS
    imgs_js = ',\n'.join(f'    {repr(img)}' for img in images)

    # Thumbnail HTML
    thumb_html = ''
    for i, img in enumerate(images):
        active = ' active' if i == 0 else ''
        thumb_html += f'        <button class="thumb{active} flex-shrink-0 h-[88px] w-[132px] rounded-xl overflow-hidden focus:outline-none" data-src="{img}" aria-label="View image {i+1}">\n'
        thumb_html += f'          <img src="{img}" alt="{title} photo {i+1}" class="w-full h-full object-cover" loading="lazy" />\n'
        thumb_html += f'        </button>\n'

    html = f'''<!DOCTYPE html>
<html lang="en" class="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} — Constructed Matter</title>
  <link rel="icon" type="image/png" href="https://wp.constructedmatter.com/wp-content/uploads/2026/03/cmi_favicon_black.png" id="faviconEl" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400&display=swap" rel="stylesheet" />
  <script>
    tailwind.config = {{
      darkMode: 'class',
      theme: {{ extend: {{ colors: {{ cmi: {{ dark: '#0f0f0f', 'dark-light': '#161616', light: '#F7F5F2', 'gold-dark': '#C9A46E', 'gold-light': '#9E6F2E' }} }}, fontFamily: {{ display: ['"DM Serif Display"', 'Georgia', 'serif'], body: ['Roboto', 'system-ui', 'sans-serif'] }} }} }}
    }}
  </script>
  <style>
    * {{ margin:0; padding:0; box-sizing:border-box; }}
    body {{ font-family:'Roboto',system-ui,sans-serif; }}
    html,body,header,nav,a,button,div,span,p,svg,section,footer,h1,h2,h3,h4 {{ transition:background-color .35s ease,color .35s ease,border-color .35s ease; }}
    :root {{ --cmi-bg:#F7F5F2; --cmi-surface:#fff; --cmi-gold:#9E6F2E; --cmi-text:#1a1a1a; --cmi-muted:#6E6A66; }}
    .dark {{ --cmi-bg:#0f0f0f; --cmi-surface:#161616; --cmi-gold:#C9A46E; --cmi-text:#F0EDEA; --cmi-muted:#9E9A96; }}

    /* Nav */
    .mega-trigger {{ position:relative; }}
    .mega-menu {{ position:absolute; top:100%; left:50%; transform:translateX(-50%) translateY(8px); opacity:0; visibility:hidden; pointer-events:none; transition:opacity .25s,transform .25s; z-index:100; }}
    .mega-trigger:hover .mega-menu,.mega-trigger:focus-within .mega-menu {{ opacity:1; visibility:visible; pointer-events:auto; transform:translateX(-50%) translateY(0); }}
    .mega-menu.left-aligned {{ left:0; transform:translateX(0) translateY(8px); }}
    .mega-trigger:hover .mega-menu.left-aligned,.mega-trigger:focus-within .mega-menu.left-aligned {{ transform:translateX(0) translateY(0); }}
    .mobile-overlay {{ opacity:0; visibility:hidden; transition:opacity .3s,visibility .3s; }}
    .mobile-overlay.open {{ opacity:1; visibility:visible; }}
    .mobile-panel {{ transform:translateX(100%); transition:transform .35s cubic-bezier(.4,0,.2,1); }}
    .mobile-overlay.open .mobile-panel {{ transform:translateX(0); }}
    .mobile-sub {{ max-height:0; overflow:hidden; transition:max-height .3s; }}
    .mobile-sub.expanded {{ max-height:400px; }}
    .nav-link::after {{ content:''; position:absolute; bottom:-2px; left:0; width:0; height:1px; transition:width .3s; }}
    .light .nav-link::after {{ background:#9E6F2E; }}
    .dark .nav-link::after {{ background:#C9A46E; }}
    .nav-link:hover::after {{ width:100%; }}
    header.scrolled {{ box-shadow:0 1px 12px rgba(0,0,0,.06); }}
    .dark header.scrolled {{ box-shadow:0 1px 12px rgba(0,0,0,.4); }}

    /* Hero image crossfade */
    #heroImg {{ width:100%; height:100%; object-fit:cover; transition:opacity .35s ease; }}
    #heroImg.fading {{ opacity:0; }}

    /* Thumbnail strip */
    .thumb-strip {{ display:flex; gap:10px; overflow-x:auto; padding:16px 24px; scrollbar-width:thin; -ms-overflow-style:none; }}
    .thumb-strip::-webkit-scrollbar {{ height:4px; }}
    .thumb-strip::-webkit-scrollbar-track {{ background:transparent; }}
    .light .thumb-strip::-webkit-scrollbar-thumb {{ background:rgba(0,0,0,.15); border-radius:4px; }}
    .dark .thumb-strip::-webkit-scrollbar-thumb {{ background:rgba(255,255,255,.15); border-radius:4px; }}
    .thumb {{ flex-shrink:0; border-radius:10px; overflow:hidden; cursor:pointer; border:2px solid transparent; transition:transform .25s ease, border-color .2s ease, box-shadow .2s ease; }}
    .thumb:hover {{ transform:scale(1.1); box-shadow:0 6px 20px rgba(0,0,0,.25); }}
    .light .thumb.active {{ border-color:#9E6F2E; box-shadow:0 0 0 1px #9E6F2E; }}
    .dark .thumb.active {{ border-color:#C9A46E; box-shadow:0 0 0 1px #C9A46E; }}
    .thumb img {{ width:100%; height:100%; object-fit:cover; display:block; pointer-events:none; }}

    /* Content */
    .fade-up {{ opacity:0; transform:translateY(24px); transition:opacity .6s ease,transform .6s ease; }}
    .fade-up.visible {{ opacity:1; transform:translateY(0); }}

    @media (min-width:1024px) {{
      .thumb-strip {{ padding:20px 40px; }}
    }}
  </style>
</head>
<body class="bg-cmi-light dark:bg-cmi-dark text-neutral-900 dark:text-neutral-100">

{NAV}

<!-- ── Hero ── -->
<div style="margin-top:72px" class="relative bg-neutral-900" style="height:62vh; min-height:440px;">
  <div class="w-full" style="height:62vh; min-height:440px; position:relative; overflow:hidden;">
    <img id="heroImg" src="{hero_img}" alt="{title}" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent pointer-events-none"></div>
    <div class="absolute inset-0 flex flex-col justify-end pointer-events-none">
      <div class="max-w-[1400px] mx-auto px-6 lg:px-10 pb-10 w-full">
        <p class="text-[11px] uppercase tracking-[0.25em] text-cmi-gold-dark font-medium mb-2 pointer-events-auto">
          <a href="../portfolio.html" class="hover:text-white transition-colors inline-flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 12H5m7-7l-7 7 7 7"/></svg>
            Portfolio
          </a>
          <span class="mx-2 opacity-40">/</span>{category} &middot; {location}
        </p>
        <h1 class="font-display text-4xl lg:text-6xl text-white leading-tight">{title}</h1>
        <p class="text-white/50 text-sm mt-1.5">{year}</p>
      </div>
    </div>
  </div>
</div>

<!-- ── Thumbnail Strip ── -->
<div class="bg-neutral-900 border-b border-neutral-800">
  <div class="max-w-[1400px] mx-auto">
    <div class="thumb-strip" id="thumbStrip">
{thumb_html}
    </div>
  </div>
</div>

<!-- ── Main Content ── -->
<section class="py-16 lg:py-24 bg-white dark:bg-cmi-dark-light">
  <div class="max-w-[1400px] mx-auto px-6 lg:px-10">
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] gap-12 lg:gap-20">

      <!-- Description -->
      <div class="fade-up">
        <p class="text-[11px] uppercase tracking-[0.2em] text-cmi-gold-light dark:text-cmi-gold-dark font-medium mb-3">Project Overview</p>
        <h2 class="font-display text-3xl lg:text-4xl text-neutral-900 dark:text-neutral-100 mb-8">About This Project</h2>
{desc_html}
        <div class="mt-8 pt-8 border-t border-neutral-200/60 dark:border-neutral-800/60">
          <p class="text-[11px] uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500 font-medium mb-4">Scope of Work</p>
          <div class="flex flex-wrap gap-2">
{scope_html}
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <aside class="fade-up">
        <div class="sticky top-[100px] rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 bg-cmi-light dark:bg-cmi-dark p-7 space-y-6">
          <div>
            <p class="text-[10px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500 font-medium mb-1">Category</p>
            <p class="text-sm font-medium text-neutral-800 dark:text-neutral-200">{category}</p>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500 font-medium mb-1">Location</p>
            <p class="text-sm font-medium text-neutral-800 dark:text-neutral-200">{location}</p>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500 font-medium mb-1">Year Completed</p>
            <p class="text-sm font-medium text-neutral-800 dark:text-neutral-200">{year}</p>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500 font-medium mb-1">Square Footage</p>
            <p class="text-sm font-medium text-neutral-800 dark:text-neutral-200">{sqft} sq ft</p>
          </div>
          <div class="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
            <a href="../quote.html" class="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-cmi-gold-light dark:bg-cmi-gold-dark text-white text-sm font-medium hover:opacity-90 transition-opacity">
              Start Your Project
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>
            </a>
          </div>
        </div>
      </aside>

    </div>
  </div>
</section>

<!-- ── CTA ── -->
<section class="py-20 bg-cmi-light dark:bg-cmi-dark border-t border-neutral-200/60 dark:border-neutral-800/60">
  <div class="max-w-[1400px] mx-auto px-6 lg:px-10 text-center fade-up">
    <p class="text-[12px] uppercase tracking-[0.25em] text-cmi-gold-light dark:text-cmi-gold-dark font-medium mb-4">Work With Us</p>
    <h2 class="font-display text-3xl lg:text-4xl text-neutral-900 dark:text-neutral-100 mb-5">Ready to Start Your Project?</h2>
    <p class="text-neutral-500 dark:text-neutral-400 max-w-lg mx-auto mb-8 leading-relaxed">Whether you have detailed plans or just a vision, our team is ready to help you build something lasting.</p>
    <div class="flex flex-wrap justify-center gap-4">
      <a href="../quote.html" class="inline-flex items-center gap-2 px-8 py-4 rounded-lg text-[14px] font-medium bg-cmi-gold-light dark:bg-cmi-gold-dark text-white hover:opacity-90 transition-opacity">Get a Free Quote<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14m-7-7l7 7-7 7"/></svg></a>
      <a href="../portfolio.html" class="inline-flex items-center gap-2 px-8 py-4 rounded-lg text-[14px] font-medium border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-cmi-gold-light dark:hover:border-cmi-gold-dark transition-colors">View All Projects</a>
    </div>
  </div>
</section>

{FOOTER}

<script>
  // Theme
  const html = document.documentElement;
  const faviconEl = document.getElementById('faviconEl');
  function applyTheme(isDark) {{
    html.classList.toggle('dark', isDark); html.classList.toggle('light', !isDark);
    if (faviconEl) faviconEl.href = isDark
      ? 'https://wp.constructedmatter.com/wp-content/uploads/2026/03/cmi_favicon_white.png'
      : 'https://wp.constructedmatter.com/wp-content/uploads/2026/03/cmi_favicon_black.png';
  }}
  const stored = localStorage.getItem('cmi-theme');
  applyTheme(stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches));
  function toggleTheme() {{ const nd = !html.classList.contains('dark'); applyTheme(nd); localStorage.setItem('cmi-theme', nd ? 'dark' : 'light'); }}
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('mobileThemeToggle').addEventListener('click', toggleTheme);

  // Header scroll shadow
  const header = document.getElementById('siteHeader');
  window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 10));

  // Mobile menu
  const overlay = document.getElementById('mobileOverlay');
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {{ overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }});
  document.getElementById('mobileCloseBtn').addEventListener('click', () => {{ overlay.classList.remove('open'); document.body.style.overflow = ''; }});
  document.getElementById('mobileBackdrop').addEventListener('click', () => {{ overlay.classList.remove('open'); document.body.style.overflow = ''; }});
  function acc(t,s,c){{ const tog=document.getElementById(t),sub=document.getElementById(s),chev=document.getElementById(c); if(!tog||!sub||!chev) return; tog.addEventListener('click',()=>{{ sub.classList.toggle('expanded'); chev.style.transform=sub.classList.contains('expanded')?'rotate(180deg)':''; }}); }}
  acc('mobileDiscoverToggle','mobileDiscoverSub','mobileDiscoverChevron');
  acc('mobileServicesToggle','mobileServicesSub','mobileServicesChevron');

  // Fade-up on scroll
  document.querySelectorAll('.fade-up').forEach(el => {{
    new IntersectionObserver(entries => {{ entries.forEach(e => {{ if(e.isIntersecting) e.target.classList.add('visible'); }}); }}, {{threshold:0.08}}).observe(el);
  }});

  // ── Thumbnail → Hero switcher ──
  const heroImg  = document.getElementById('heroImg');
  const thumbBtns = document.querySelectorAll('#thumbStrip .thumb');

  function setActive(btn) {{
    thumbBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Scroll active thumb into view
    btn.scrollIntoView({{ behavior:'smooth', block:'nearest', inline:'center' }});
  }}

  function switchHero(src, btn) {{
    if (heroImg.src === src) return;
    heroImg.classList.add('fading');
    setTimeout(() => {{
      heroImg.src = src;
      heroImg.onload = () => heroImg.classList.remove('fading');
      // Fallback if image already cached (onload may not fire)
      if (heroImg.complete) heroImg.classList.remove('fading');
    }}, 180);
    setActive(btn);
  }}

  thumbBtns.forEach(btn => {{
    btn.addEventListener('click', () => switchHero(btn.dataset.src, btn));
  }});
</script>
</body>
</html>'''

    path = os.path.join(BASE, slug + '.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'  {slug}.html')

for p in projects:
    make_page(p)
print('Done.')
