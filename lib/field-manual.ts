/**
 * V FOR X — The Field Manual (Scenario-Based Survival Guides)
 *
 * Printable, scenario-specific survival guides. Distinct from Protocol X
 * (which are general survival blueprints), Field Manuals are targeted
 * at specific crisis situations: blackout, arrest, natural disaster,
 * active conflict, medical emergency, etc.
 *
 * Each manual is structured for quick reference under stress:
 *   - Immediate Actions (first 5 minutes)
 *   - Short-term Actions (first hour)
   - Extended Actions (first day)
 *   - Key contacts and codes
 *   - Checklist items
 *
 * Manuals can be printed or exported as HTML for offline reference.
 */

export type ScenarioType =
  | "blackout"
  | "arrest"
  | "natural_disaster"
  | "active_conflict"
  | "medical_emergency"
  | "digital_security_breach"
  | "civil_unrest"
  | "border_crossing"
  | "communication_blackout"
  | "evacuation";

export interface FieldManual {
  id: string;
  scenario: ScenarioType;
  title: string;
  subtitle: string;
  icon: string;
  summary: string;
  difficulty: "universal" | "basic_training" | "advanced";
  /** Time-sensitive actions in priority order */
  phases: ActionPhase[];
  /** Key items to have ready */
  kitChecklist: ChecklistItem[];
  /** Critical phone numbers / codes to know */
  emergencyContacts: EmergencyContact[];
  /** What NOT to do */
  warnings: string[];
  /** Relevant Protocol X blueprints */
  relatedBlueprints: string[];
}

export interface ActionPhase {
  name: string;
  timeframe: string;
  actions: ManualAction[];
}

export interface ManualAction {
  text: string;
  critical?: boolean;
  /** Optional sub-steps */
  substeps?: string[];
}

export interface ChecklistItem {
  item: string;
  quantity?: string;
  priority: "critical" | "recommended" | "optional";
}

export interface EmergencyContact {
  label: string;
  contact: string;
  note?: string;
}

/* ═══════════════════════════════════════════════════════════
   THE 10 FIELD MANUALS
   ═══════════════════════════════════════════════════════════ */

export const FIELD_MANUALS: FieldManual[] = [
  {
    id: "fm-blackout",
    scenario: "blackout",
    title: "Grid Failure & Blackout",
    subtitle: "Power is out. Communications are down. Act fast.",
    icon: "🔌",
    summary: "When the grid fails, you have hours before water stops flowing, food spoils, and panic spreads. This manual covers the critical first 72 hours.",
    difficulty: "universal",
    phases: [
      {
        name: "IMMEDIATE",
        timeframe: "First 15 minutes",
        actions: [
          { text: "Check if the outage is local or widespread (look at neighboring buildings, streetlights)", critical: true },
          { text: "Conserve phone battery — switch to low-power mode, reduce brightness" },
          { text: "Fill all available containers with water (taps may stop working once pumps fail)", critical: true },
          { text: "Do NOT open refrigerator/freezer — food stays safe 4h (fridge) / 48h (full freezer)" },
        ],
      },
      {
        name: "SHORT-TERM",
        timeframe: "First 2 hours",
        actions: [
          { text: "Locate flashlights, headlamps, and batteries — avoid candles (fire risk)" },
          { text: "Charge essential devices from power banks, car adapters, or solar" },
          { text: "Tune to battery/crank radio for emergency broadcasts (AM/FM)" },
          { text: "Notify vulnerable neighbors (elderly, disabled, families with infants)" },
        ],
      },
      {
        name: "EXTENDED",
        timeframe: "First 72 hours",
        actions: [
          { text: "Ration water: 3L per person per day minimum (drinking + sanitation)" },
          { text: "Cook perishable food first (use camp stove outdoors ONLY — carbon monoxide kills)" },
          { text: "Create natural ventilation — close curtains on sun-facing windows during day, open at night" },
          { text: "Establish a community check-in point for information sharing" },
          { text: "If you have a generator, operate it OUTDOORS only, at least 6m from any building" },
        ],
      },
    ],
    kitChecklist: [
      { item: "Water (3L per person per day × 3 days)", priority: "critical" },
      { item: "Battery/crank radio", priority: "critical" },
      { item: "LED flashlights + extra batteries", priority: "critical" },
      { item: "Power bank (20,000mAh+)", priority: "critical" },
      { item: "Camp stove + fuel (outdoor use only)", priority: "recommended" },
      { item: "Manual can opener", priority: "recommended" },
      { item: "First aid kit", priority: "critical" },
      { item: "Cash (ATMs won't work)", priority: "recommended" },
    ],
    emergencyContacts: [
      { label: "Local emergency services", contact: "Varies by country", note: "May be overwhelmed — only call for life-threatening emergencies" },
      { label: "Utility company outage line", contact: "Save in advance", note: "Report downed power lines immediately" },
    ],
    warnings: [
      "NEVER use gas stoves, grills, or generators indoors — carbon monoxide is invisible and deadly",
      "Do not approach downed power lines (assume they are live)",
      "Do not hoard — share resources with neighbors",
      "Do not spread unverified information",
    ],
    relatedBlueprints: ["power-micro-solar", "power-bicycle-generator", "water-boiling"],
  },
  {
    id: "fm-arrest",
    scenario: "arrest",
    title: "Arrest & Detention",
    subtitle: "You or someone near you is being arrested. Know your rights.",
    icon: "⚖️",
    summary: "Whether the arrest is lawful or not, your actions in the first minutes determine your safety. Stay calm. Assert rights. Document everything.",
    difficulty: "basic_training",
    phases: [
      {
        name: "IMMEDIATE",
        timeframe: "During the arrest",
        actions: [
          { text: "STAY CALM. Do not resist, argue, or flee — this is used against you", critical: true },
          { text: "Ask: 'Am I being detained or arrested? What am I charged with?'", critical: true },
          { text: "State clearly: 'I want to remain silent. I want a lawyer.' Then say NOTHING else", critical: true },
          { text: "Do NOT consent to any search of your person, phone, or belongings" },
          { text: "Do NOT sign anything without a lawyer present" },
        ],
      },
      {
        name: "SHORT-TERM",
        timeframe: "First hours",
        actions: [
          { text: "Memorize: officer names, badge numbers, patrol car numbers, time and location", critical: true },
          { text: "If injured, request medical attention and document injuries immediately" },
          { text: "Use your phone call wisely — contact someone who can get a lawyer" },
          { text: "Do NOT discuss your case with anyone except your lawyer (cells may be bugged)" },
        ],
      },
      {
        name: "EXTENDED",
        timeframe: "During detention",
        actions: [
          { text: "Keep a mental log of everything — write it down as soon as you have paper" },
          { text: "Note names and descriptions of other detainees (potential witnesses)" },
          { text: "Refuse interrogations without a lawyer present — restate 'I want a lawyer'" },
          { text: "If you witness abuse, memorize details for later documentation" },
        ],
      },
    ],
    kitChecklist: [
      { item: "Emergency lawyer contact (memorized)", priority: "critical" },
      { item: "Emergency contact (memorized phone number)", priority: "critical" },
      { item: "ID/Passport copy (hidden separately)", priority: "critical" },
      { item: "Know your country's detention time limits", priority: "recommended" },
    ],
    emergencyContacts: [
      { label: "Your lawyer", contact: "Memorize the number", note: "Do not rely on your phone being available" },
      { label: "Trusted emergency contact", contact: "Memorize the number", note: "Should know how to reach a lawyer and document your detention" },
      { label: "Local legal aid / human rights organization", contact: "Research in advance", note: "Many countries have free legal aid hotlines" },
    ],
    warnings: [
      "NEVER resist arrest physically, even an unlawful one — fight it in court, not on the street",
      "Do NOT discuss your case with cellmates — they may be informants",
      "Do NOT accept a 'deal' without your lawyer present",
      "Do NOT trust that your phone call is private",
    ],
    relatedBlueprints: ["security-digital-opsec", "organizing-nonviolent-resistance"],
  },
  {
    id: "fm-natural-disaster",
    scenario: "natural_disaster",
    title: "Natural Disaster",
    subtitle: "Earthquake, flood, hurricane, wildfire. Nature does not negotiate.",
    icon: "🌪️",
    summary: "Natural disasters give little or no warning. The actions you take in the first minutes determine survival. This manual covers the universal principles.",
    difficulty: "universal",
    phases: [
      {
        name: "IMMEDIATE",
        timeframe: "First minutes",
        actions: [
          { text: "Earthquake: DROP, COVER, HOLD ON. Under a sturdy table, away from windows", critical: true },
          { text: "Flood: Move to higher ground IMMEDIATELY. Do not wait for official orders", critical: true },
          { text: "Hurricane/Typhoon: Shelter in an interior room on the lowest floor", critical: true },
          { text: "Wildfire: If told to evacuate, GO NOW. Do not wait to see if it gets worse", critical: true },
          { text: "Turn off gas, electricity, and water if there is damage (know where shutoffs are)" },
        ],
      },
      {
        name: "SHORT-TERM",
        timeframe: "First hours",
        actions: [
          { text: "Check yourself and others for injuries. Treat life-threatening ones first", critical: true },
          { text: "Check on neighbors, especially elderly and disabled" },
          { text: "Stay away from damaged buildings (aftershocks can collapse them)" },
          { text: "Do not walk or drive through flood water (6 inches can knock you down, 2 feet can float a car)" },
          { text: "Listen to emergency broadcasts for shelter locations and evacuation routes" },
        ],
      },
      {
        name: "EXTENDED",
        timeframe: "First 72 hours",
        actions: [
          { text: "Secure clean water (3L/person/day) — assume tap water is contaminated until cleared", critical: true },
          { text: "Do not use toilets if sewer lines are damaged — use a bucket with a plastic bag" },
          { text: "Document damage for insurance/aid claims (photos, video)" },
          { text: "Help organize community shelters and resource sharing" },
          { text: "Watch for secondary hazards: gas leaks, electrical wires, structural damage, contaminated water" },
        ],
      },
    ],
    kitChecklist: [
      { item: "Go-bag (pre-packed, near door)", priority: "critical" },
      { item: "Water: 3L per person per day × 3 days", priority: "critical" },
      { item: "Non-perishable food × 3 days", priority: "critical" },
      { item: "First aid kit + basic medical training", priority: "critical" },
      { item: "Battery/crank radio", priority: "critical" },
      { item: "Flashlight + extra batteries", priority: "critical" },
      { item: "Copies of important documents (waterproof bag)", priority: "recommended" },
      { item: "Cash (small bills)", priority: "recommended" },
      { item: "Sturdy shoes under bed", priority: "recommended" },
      { item: "Whistle (to signal for help)", priority: "recommended" },
    ],
    emergencyContacts: [
      { label: "Local emergency services", contact: "Varies by country" },
      { label: "Family meeting point", contact: "Agree in advance", note: "Primary and backup location" },
      { label: "Out-of-area emergency contact", contact: "Phone number", note: "Long-distance calls often work when local lines are down" },
    ],
    warnings: [
      "NEVER walk or drive through flood water — depth and current are deceptive",
      "Do NOT return to damaged buildings until cleared by authorities",
      "Do NOT use candles (gas leaks + fire = explosion)",
      "Do NOT drink tap water until officially cleared",
      "Do NOT spread unverified information — it can cause deadly panic",
    ],
    relatedBlueprints: ["water-solar-purification", "water-boiling", "food-drying", "medical-field-first-aid"],
  },
  {
    id: "fm-active-conflict",
    scenario: "active_conflict",
    title: "Active Conflict Zone",
    subtitle: "Shooting, bombing, or military operations in your area.",
    icon: "⚔️",
    summary: "Survival in an active conflict zone requires different instincts than peace-time emergencies. Your goals: avoid crossfire, secure essentials, and document for accountability.",
    difficulty: "advanced",
    phases: [
      {
        name: "IMMEDIATE",
        timeframe: "First minutes",
        actions: [
          { text: "GET LOW. Lie flat on the ground. Do not run unless you know where fire is coming from", critical: true },
          { text: "Move to the most interior room, away from windows and exterior walls", critical: true },
          { text: "If outside, find cover (not just concealment) — solid walls, earth berms, ditches", critical: true },
          { text: "Keep hands visible and empty if military/police are present" },
          { text: "Silence your phone — vibrate can be loud in silence" },
        ],
      },
      {
        name: "SHORT-TERM",
        timeframe: "First hours",
        actions: [
          { text: "Identify the safest room: interior, no windows, load-bearing walls, near water", critical: true },
          { text: "Fill the bathtub and all containers with water BEFORE utilities are damaged", critical: true },
          { text: "Prepare a go-bag: documents, water, first aid, cash, phone charger, medications" },
          { text: "Identify two evacuation routes in case one becomes blocked" },
          { text: "Mark your location visibly (white cloth) if sheltering in place" },
        ],
      },
      {
        name: "EXTENDED",
        timeframe: "Days to weeks",
        actions: [
          { text: "Ration food and water — assume the situation will last longer than expected", critical: true },
          { text: "Establish a community watch rotation for mutual aid and information" },
          { text: "Document violations: time, location, type of weapon, casualties (for The Registry/Tribunal)" },
          { text: "Maintate communications with outside contacts if possible (satellite, mesh)" },
          { text: "Know the location of the nearest field hospital, shelter, and safe corridor" },
          { text: "Prepare for evacuation: fuel vehicle, map alternate routes, travel in daylight if safer" },
        ],
      },
    ],
    kitChecklist: [
      { item: "Go-bag (pre-packed, always ready)", priority: "critical" },
      { item: "Water: 3L per person per day × 7 days minimum", priority: "critical" },
      { item: "First aid kit + tourniquet", priority: "critical" },
      { item: "Cash (multiple currencies if near border)", priority: "critical" },
      { item: "Copies of ALL identification documents", priority: "critical" },
      { item: "Phone + solar charger + power bank", priority: "critical" },
      { item: "Medications (2-week supply)", priority: "critical" },
      { item: "Emergency contacts memorized", priority: "critical" },
    ],
    emergencyContacts: [
      { label: "Emergency contact outside conflict zone", contact: "Phone number", note: "Someone who can coordinate information and help" },
      { label: "Nearest embassy/consulate (if foreign national)", contact: "Research in advance" },
      { label: "Red Cross / Red Crescent local office", contact: "Varies by location" },
    ],
    warnings: [
      "NEVER run during active fire — crawl or stay flat",
      "Do NOT approach military checkpoints at speed or without hands visible",
      "Do NOT carry anything that could be mistaken for a weapon",
      "Do NOT assume a 'ceasefire' means safe — confirm through multiple sources",
      "Do NOT film military operations if it puts you at risk — documentation is secondary to survival",
    ],
    relatedBlueprints: ["comms-mesh-network", "comms-dead-drop", "medical-field-first-aid", "security-digital-opsec", "organizing-nonviolent-resistance"],
  },
  {
    id: "fm-medical-emergency",
    scenario: "medical_emergency",
    title: "Medical Emergency",
    subtitle: "No doctor. No ambulance. Seconds matter.",
    icon: "⚕️",
    summary: "When medical infrastructure is unavailable or overwhelmed, basic field first aid saves lives. This is not a replacement for proper training — take a certified course.",
    difficulty: "basic_training",
    phases: [
      {
        name: "IMMEDIATE",
        timeframe: "First 60 seconds",
        actions: [
          { text: "CHECK SCENE SAFETY first — do not become a second victim", critical: true },
          { text: "Check responsiveness: tap shoulder, shout 'Are you OK?'" },
          { text: "Check breathing. If not breathing or gasping: START CPR (push hard, push fast, center of chest)", critical: true },
          { text: "Severe bleeding: apply DIRECT PRESSURE with clean cloth. Press HARD", critical: true },
          { text: "Call for help / send someone to call emergency services" },
        ],
      },
      {
        name: "SHORT-TERM",
        timeframe: "First 30 minutes",
        actions: [
          { text: "Control bleeding: direct pressure → pressure bandage → tourniquet (last resort, mark the time)", critical: true },
          { text: "For shock: lay flat, elevate legs (unless head/spine injury), keep warm" },
          { text: "For burns: cool with running water for 20 minutes. Do NOT apply ice, butter, or ointments" },
          { text: "For fractures: immobilize. Do NOT try to realign bones" },
          { text: "For choking (Heimlich): 5 back blows between shoulder blades, then 5 abdominal thrusts" },
        ],
      },
      {
        name: "EXTENDED",
        timeframe: "Until help arrives",
        actions: [
          { text: "Monitor breathing and pulse continuously. Be ready to resume CPR", critical: true },
          { text: "Do NOT give food or water to an unconscious person" },
          { text: "Record: time of injury, vitals, treatments given, medications administered" },
          { text: "Keep the person warm and comfortable. Reassure them." },
          { text: "Prepare for evacuation: arrange transport to nearest medical facility" },
        ],
      },
    ],
    kitChecklist: [
      { item: "Tourniquet (CAT or equivalent)", priority: "critical" },
      { item: "Pressure bandages / gauze", priority: "critical" },
      { item: "Antiseptic (chlorhexidine or povidone-iodine)", priority: "critical" },
      { item: "Medical tape and scissors", priority: "critical" },
      { item: "Triangular bandages (slings)", priority: "recommended" },
      { item: "Emergency blanket (Mylar)", priority: "recommended" },
      { item: "Basic medications: paracetamol, ibuprofen, antihistamine", priority: "recommended" },
      { item: "CPR face shield", priority: "recommended" },
    ],
    emergencyContacts: [
      { label: "Emergency services", contact: "Varies by country", note: "If available, call immediately for life-threatening emergencies" },
      { label: "Nearest hospital/clinic", contact: "Research in advance", note: "Know the route and estimated travel time" },
      { label: "Family physician", contact: "Phone number", note: "Can provide guidance remotely" },
    ],
    warnings: [
      "NEVER move a person with a suspected spinal injury unless they are in immediate danger",
      "Do NOT remove an impaled object — stabilize it and seek help",
      "Do NOT apply ice directly to skin (causes frostbite)",
      "Do NOT give food/water to unconscious or semi-conscious persons",
      "Do NOT use a tourniquet unless bleeding cannot be controlled by pressure — and mark the time applied",
    ],
    relatedBlueprints: ["medical-field-first-aid"],
  },
  {
    id: "fm-digital-breach",
    scenario: "digital_security_breach",
    title: "Digital Security Breach",
    subtitle: "Your device is compromised or seized. Burn everything.",
    icon: "🔐",
    summary: "If your device is about to be seized or you suspect compromise, you have minutes to protect your contacts, evidence, and identity.",
    difficulty: "advanced",
    phases: [
      {
        name: "IMMEDIATE",
        timeframe: "First minutes",
        actions: [
          { text: "TRIGGER DUESS CODE (Ctrl+Shift+Delete) to wipe the V FOR X vault and cache", critical: true },
          { text: "Enable airplane mode to cut remote access", critical: true },
          { text: "Power off the device if possible (encryption at rest is strongest when powered off)" },
          { text: "Remove and destroy SIM card if physically possible" },
        ],
      },
      {
        name: "SHORT-TERM",
        timeframe: "First hours",
        actions: [
          { text: "From a DIFFERENT device, change passwords for all critical accounts", critical: true },
          { text: "Revoke device access from account security settings (Google, Apple, etc.)" },
          { text: "Notify trusted contacts that communications may be compromised" },
          { text: "Generate new anonymous keys (new ECDSA keypair, new handles)" },
          { text: "Assume all data on the compromised device is now in adversary hands" },
        ],
      },
      {
        name: "EXTENDED",
        timeframe: "Recovery",
        actions: [
          { text: "Factory-reset the compromised device (if recovered) or consider it burned", critical: true },
          { text: "Audit what was on the device: contacts, messages, stored evidence, saved locations" },
          { text: "Warn anyone whose information was on the device" },
          { text: "Set up new dead drops, new codebooks, new communication channels" },
          { text: "Document the breach for The Registry if it was state-sponsored" },
        ],
      },
    ],
    kitChecklist: [
      { item: "Duress code memorized", priority: "critical" },
      { item: "Burner phone (pre-paid, unregistered)", priority: "recommended" },
      { item: "Backup communication plan (dead drops, signals)", priority: "critical" },
    ],
    emergencyContacts: [
      { label: "Digital security hotline (if available)", contact: "Research in advance", note: "Some organizations offer emergency digital security support" },
    ],
    warnings: [
      "NEVER assume a device is 'clean' after compromise — it is burned forever",
      "Do NOT log into accounts from a compromised device, even after reset",
      "Do NOT contact associates from a seized device — it may be monitored",
      "Do NOT keep sensitive contacts in your phone's address book — memorize instead",
    ],
    relatedBlueprints: ["security-digital-opsec", "comms-dead-drop"],
  },
  {
    id: "fm-civil-unrest",
    scenario: "civil_unrest",
    title: "Civil Unrest & Protests",
    subtitle: "The streets are filled. Know when to stay and when to leave.",
    icon: "📢",
    summary: "Protests can shift from peaceful to dangerous in minutes. This manual covers how to participate safely, when to leave, and how to protect yourself and others.",
    difficulty: "basic_training",
    phases: [
      {
        name: "BEFORE",
        timeframe: "Preparation",
        actions: [
          { text: "Wear comfortable, sturdy shoes you can run in", critical: true },
          { text: "Bring water, snacks, ID, cash, and a basic first aid kit" },
          { text: "Write emergency contact number on your arm in permanent marker", critical: true },
          { text: "Charge your phone fully. Bring a power bank." },
          { text: "Go with a buddy. Agree on a meeting point if separated." },
          { text: "Enable full-disk encryption on your phone before leaving" },
        ],
      },
      {
        name: "DURING",
        timeframe: "At the protest",
        actions: [
          { text: "Know your exits. Continuously assess escape routes", critical: true },
          { text: "Stay on the periphery if you feel unsafe — easier to leave" },
          { text: "Do NOT engage with agitators or counter-protesters" },
          { text: "Film/document ONLY if safe — livestreaming puts you at risk" },
          { text: "If tear gas is deployed: do NOT rub eyes. Blink to produce tears. Rinse with water or milk of magnesia (3:1 with water)" },
          { text: "If police announce dispersal order: LEAVE immediately through the announced route", critical: true },
        ],
      },
      {
        name: "AFTER",
        timeframe: "Post-protest",
        actions: [
          { text: "Check in with your buddy and emergency contacts", critical: true },
          { text: "Securely back up any photos/video evidence (upload to encrypted storage, then delete from device)" },
          { text: "Document any injuries (photos with timestamps) for legal/human rights records" },
          { text: "Do NOT post identifiable photos of other protesters without consent" },
        ],
      },
    ],
    kitChecklist: [
      { item: "Water (for drinking AND eye flush)", priority: "critical" },
      { item: "N95 mask (tear gas protection)", priority: "critical" },
      { item: "Permanent marker (for emergency contact)", priority: "critical" },
      { item: "Small first aid kit", priority: "recommended" },
      { item: "Power bank", priority: "recommended" },
      { item: "Cash", priority: "recommended" },
      { item: "Goggles (swim/safety)", priority: "optional" },
    ],
    emergencyContacts: [
      { label: "Legal aid / protest hotline", contact: "Research in advance", note: "Many countries have legal observation organizations" },
      { label: "Emergency buddy", contact: "Phone number (also memorized)", note: "Someone who is NOT at the protest" },
    ],
    warnings: [
      "NEVER bring a weapon — it endangers everyone and is used to justify violence",
      "Do NOT wear contact lenses (tear gas gets trapped behind them)",
      "Do NOT use face recognition unlock — police can point your phone at your face",
      "Do NOT lead a crowd into a contained space (dead-end street, bridge)",
      "Do NOT leave the group alone if being pursued",
    ],
    relatedBlueprints: ["security-digital-opsec", "organizing-nonviolent-resistance", "organizing-mutual-aid"],
  },
  {
    id: "fm-border-crossing",
    scenario: "border_crossing",
    title: "Border Crossing (Emergency)",
    subtitle: "You need to cross a border to safety. Prepare carefully.",
    icon: "🚧",
    summary: "Emergency border crossings carry extreme risk. This manual assumes you are fleeing danger, not crossing for routine travel. Prepare thoroughly.",
    difficulty: "advanced",
    phases: [
      {
        name: "BEFORE",
        timeframe: "Preparation",
        actions: [
          { text: "Secure ALL identification documents (passport, ID, birth certificate, marriage certificate)", critical: true },
          { text: "Carry proof of the threat you are fleeing (police reports, medical records, photos)", critical: true },
          { text: "Memorize key contacts in destination country (UNHCR, embassies, family)" },
          { text: "Carry cash in multiple currencies and forms (bills, not just cards)" },
          { text: "Pack a 3-day emergency bag: water, food, first aid, phone, charger, documents" },
          { text: "Delete sensitive data from devices (see Digital Security Breach manual)" },
        ],
      },
      {
        name: "DURING",
        timeframe: "The crossing",
        actions: [
          { text: "If crossing at an official checkpoint: be cooperative, do not lie, request asylum", critical: true },
          { text: "If crossing unofficially: travel in daylight (usually safer), stay with groups", critical: true },
          { text: "Keep documents in a waterproof bag ON YOUR BODY, not in a bag that can be separated" },
          { text: "Carry a paper map — do not rely solely on phone GPS" },
          { text: "If stopped by authorities: state 'I am requesting asylum / international protection'", critical: true },
        ],
      },
      {
        name: "AFTER",
        timeframe: "Arrival",
        actions: [
          { text: "Register with UNHCR or local authorities as soon as possible", critical: true },
          { text: "Contact your destination country's embassy if applicable" },
          { text: "Document your journey and the threat you fled (for asylum application)" },
          { text: "Do NOT return to your country of origin until it is safe and legally possible" },
          { text: "Connect with local refugee support organizations for legal, medical, and housing assistance" },
        ],
      },
    ],
    kitChecklist: [
      { item: "Passport + copies (separated)", priority: "critical" },
      { item: "Proof of threat/persecution", priority: "critical" },
      { item: "Cash (multiple currencies)", priority: "critical" },
      { item: "Phone + charger + SIM for destination", priority: "critical" },
      { item: "3-day emergency supplies", priority: "critical" },
      { item: "Paper map of route", priority: "recommended" },
      { item: "List of emergency contacts (memorized + written)", priority: "critical" },
    ],
    emergencyContacts: [
      { label: "UNHCR hotline", contact: "Varies by region", note: "The UN Refugee Agency can provide protection and guidance" },
      { label: "Destination country embassy", contact: "Research in advance" },
      { label: "Family/contact in destination", contact: "Memorized phone number" },
    ],
    warnings: [
      "NEVER destroy your identification documents — you will need them",
      "Do NOT cross borders with people you do not fully trust (human trafficking risk)",
      "Do NOT use smugglers without extreme caution — many are exploitative",
      "Do NOT assume border officials will be sympathetic — be prepared, be calm, be truthful",
    ],
    relatedBlueprints: ["security-digital-opsec", "medical-field-first-aid"],
  },
  {
    id: "fm-comms-blackout",
    scenario: "communication_blackout",
    title: "Communication Blackout",
    subtitle: "Internet and phone networks are cut. Establish alternative comms.",
    icon: "📡",
    summary: "When governments cut communications to suppress organizing, you need alternative channels. This manual covers mesh networking, dead drops, and signal methods.",
    difficulty: "advanced",
    phases: [
      {
        name: "IMMEDIATE",
        timeframe: "First hours",
        actions: [
          { text: "Download and share the V FOR X static export via Bluetooth/USB (works offline)", critical: true },
          { text: "Enable Bluetooth mesh networking apps (Briar, Bridgefy, Manyverse) if pre-installed", critical: true },
          { text: "Use SMS if available — short messages work even when internet is cut" },
          { text: "Establish physical dead drop locations (see Protocol X: comms-dead-drop)" },
        ],
      },
      {
        name: "SHORT-TERM",
        timeframe: "First days",
        actions: [
          { text: "Set up a message relay chain: each person carries messages to the next node", critical: true },
          { text: "Use Ham radio (if licensed) or FM/AM radio for one-way information reception", critical: true },
          { text: "Create coded messages using the field codebook (The Cipher)" },
          { text: "Print QR codes with key information for distribution (The Relay)" },
          { text: "Establish a regular check-in schedule at dead drops" },
        ],
      },
      {
        name: "EXTENDED",
        timeframe: "Extended blackout",
        actions: [
          { text: "Build a mesh network with meshtastic/LoRa devices if available", critical: true },
          { text: "Organize courier routes for physical information distribution" },
          { text: "Use satellite internet (Starlink, VSAT) if available — signals cannot be locally jammed" },
          { text: "Maintain a community bulletin board for information sharing" },
          { text: "Document the blackout: start time, what was cut, who ordered it (for The Registry)" },
        ],
      },
    ],
    kitChecklist: [
      { item: "Battery/crank radio (AM/FM/SW)", priority: "critical" },
      { item: "Pre-downloaded V FOR X static export", priority: "critical" },
      { item: "Mesh networking app installed (Briar/Bridgefy)", priority: "recommended" },
      { item: "Ham radio (if licensed)", priority: "optional" },
      { item: "LoRa/Meshtastic device", priority: "optional" },
      { item: "USB drives with offline resources", priority: "recommended" },
      { item: "Printed emergency contact list", priority: "critical" },
    ],
    emergencyContacts: [
      { label: "International news outlets", contact: "Research phone/SMS numbers", note: "Can broadcast your situation to the world" },
      { label: "International human rights organizations", contact: "Research in advance", note: "Amnesty, HRW, etc. may have emergency lines" },
    ],
    warnings: [
      "NEVER trust unverified information during a blackout — disinformation is common",
      "Do NOT assume encrypted apps are safe if the network is monitored at the ISP level",
      "Do NOT meet strangers who contact you during a blackout (may be honeypots)",
      "Do NOT photograph security forces or infrastructure if it puts you at risk",
    ],
    relatedBlueprints: ["comms-mesh-network", "comms-dead-drop"],
  },
  {
    id: "fm-evacuation",
    scenario: "evacuation",
    title: "Emergency Evacuation",
    subtitle: "You have minutes to leave. What do you take?",
    icon: "🏃",
    summary: "Whether fleeing conflict, disaster, or persecution, the ability to evacuate quickly with essential items can save your life. This manual covers the universal principles.",
    difficulty: "universal",
    phases: [
      {
        name: "PREPARE",
        timeframe: "Before it happens (now)",
        actions: [
          { text: "Pack a go-bag NOW. Keep it by the door or under the bed.", critical: true },
          { text: "Store digital copies of all important documents in encrypted cloud storage", critical: true },
          { text: "Memorize 3 emergency phone numbers (do not rely on your phone)" },
          { text: "Agree on a family meeting point (primary + backup)" },
          { text: "Know at least 2 evacuation routes from your home and neighborhood" },
          { text: "Keep vehicle fuel above half a tank at all times" },
        ],
      },
      {
        name: "EVACUATE",
        timeframe: "During evacuation",
        actions: [
          { text: "GRAB THE GO-BAG. Do not stop to pack — take what is ready", critical: true },
          { text: "Take: phone, charger, power bank, wallet, cash, ID, medications, water" },
          { text: "Leave a visible note indicating you have evacuated (if safe to do so)" },
          { text: "Shut off gas, water, electricity if there is time and risk of damage" },
          { text: "Travel light — if it slows you down, leave it behind" },
          { text: "Follow official evacuation routes if provided. Avoid shortcuts through dangerous areas." },
        ],
      },
      {
        name: "AFTER",
        timeframe: "At your destination",
        actions: [
          { text: "Register with local authorities, UNHCR, or relevant agencies", critical: true },
          { text: "Contact your emergency contacts to confirm safety" },
          { text: "Document what you evacuated from (photos, timeline, evidence)" },
          { text: "Assess what you need: shelter, food, medical, legal assistance" },
          { text: "Help organize the community at your destination for mutual aid" },
        ],
      },
    ],
    kitChecklist: [
      { item: "Go-bag (pre-packed, always ready)", priority: "critical" },
      { item: "Water (1.5L minimum)", priority: "critical" },
      { item: "Non-perishable food (energy bars)", priority: "critical" },
      { item: "First aid kit + personal medications", priority: "critical" },
      { item: "Copies of ALL documents (passport, ID, medical records)", priority: "critical" },
      { item: "Cash (small bills + some foreign currency)", priority: "critical" },
      { item: "Phone + charger + power bank", priority: "critical" },
      { item: "Change of clothes", priority: "recommended" },
      { item: "Flashlight", priority: "recommended" },
      { item: "Emergency blanket", priority: "recommended" },
    ],
    emergencyContacts: [
      { label: "Family meeting point contact", contact: "Agree in advance" },
      { label: "Out-of-area emergency contact", contact: "Memorize phone number" },
      { label: "UNHCR / Red Cross", contact: "Varies by region", note: "Can provide shelter, food, and legal assistance to evacuees" },
    ],
    warnings: [
      "NEVER delay evacuation to save possessions — your life is worth more than things",
      "Do NOT evacuate INTO danger — verify your route is safe",
      "Do NOT separate from your group during evacuation",
      "Do NOT return until authorities confirm it is safe",
    ],
    relatedBlueprints: ["medical-field-first-aid", "security-digital-opsec", "organizing-mutual-aid"],
  },
];

/* ═══════════════════════════════════════════════════════════
   ACCESSORS
   ═══════════════════════════════════════════════════════════ */

export function getManuals(): FieldManual[] {
  return FIELD_MANUALS;
}

export function getManual(id: string): FieldManual | null {
  return FIELD_MANUALS.find((m) => m.id === id) ?? null;
}

export function getManualsByScenario(scenario: ScenarioType): FieldManual[] {
  return FIELD_MANUALS.filter((m) => m.scenario === scenario);
}

/* ═══════════════════════════════════════════════════════════
   PRINTABLE HTML EXPORT
   ═══════════════════════════════════════════════════════════ */

export function generatePrintableHTML(manual: FieldManual): string {
  const phasesHtml = manual.phases
    .map(
      (phase) => `
    <section class="phase">
      <h2>${phase.name} <span class="timeframe">${phase.timeframe}</span></h2>
      <ul>
        ${phase.actions
          .map(
            (a) =>
              `<li class="${a.critical ? "critical" : ""}">${a.text}${a.substeps ? `<ul>${a.substeps.map((s) => `<li>${s}</li>`).join("")}</ul>` : ""}</li>`,
          )
          .join("")}
      </ul>
    </section>`,
    )
    .join("");

  const checklistHtml = manual.kitChecklist
    .map(
      (item) =>
        `<li><span class="priority ${item.priority}">[${item.priority.toUpperCase()}]</span> ${item.item}${item.quantity ? ` (${item.quantity})` : ""}</li>`,
    )
    .join("");

  const contactsHtml = manual.emergencyContacts
    .map(
      (c) =>
        `<li><strong>${c.label}:</strong> ${c.contact}${c.note ? ` <em>(${c.note})</em>` : ""}</li>`,
    )
    .join("");

  const warningsHtml = manual.warnings.map((w) => `<li>${w}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${manual.title} — V FOR X Field Manual</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: monospace; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.5em; border-bottom: 3px solid #000; padding-bottom: 8px; }
  h2 { font-size: 1.2em; margin-top: 24px; border-bottom: 1px solid #999; }
  .icon { font-size: 2em; }
  .subtitle { font-style: italic; color: #555; margin: 4px 0 12px; }
  .summary { background: #f5f5f5; padding: 12px; margin: 12px 0; border-left: 4px solid #333; }
  .phase { margin-bottom: 20px; }
  .timeframe { font-size: 0.8em; color: #666; font-weight: normal; }
  .critical { font-weight: bold; }
  .critical::before { content: "⚠ "; }
  .priority { font-size: 0.85em; }
  .priority.critical { color: #c00; }
  .priority.recommended { color: #a60; }
  .warnings { background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 4px; }
  .warnings h2 { border: none; color: #856404; }
  @media print {
    body { font-size: 11pt; }
    .phase { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="icon">${manual.icon}</div>
  <h1>${manual.title}</h1>
  <p class="subtitle">${manual.subtitle}</p>
  <p class="summary">${manual.summary}</p>
  ${phasesHtml}
  <h2>Kit Checklist</h2>
  <ul>${checklistHtml}</ul>
  <h2>Emergency Contacts</h2>
  <ul>${contactsHtml}</ul>
  <div class="warnings">
    <h2>⚠ What NOT to Do</h2>
    <ul>${warningsHtml}</ul>
  </div>
  <p style="margin-top: 24px; font-size: 0.8em; color: #999; border-top: 1px solid #ddd; padding-top: 8px;">
    V FOR X Field Manual — CC0 Public Domain. This guide is not a substitute for professional training.
    Generated ${new Date().toISOString().slice(0, 10)}.
  </p>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════
   METADATA
   ═══════════════════════════════════════════════════════════ */

export const SCENARIO_LABELS: Record<ScenarioType, string> = {
  blackout: "Grid Failure / Blackout",
  arrest: "Arrest & Detention",
  natural_disaster: "Natural Disaster",
  active_conflict: "Active Conflict",
  medical_emergency: "Medical Emergency",
  digital_security_breach: "Digital Security Breach",
  civil_unrest: "Civil Unrest / Protest",
  border_crossing: "Border Crossing",
  communication_blackout: "Communication Blackout",
  evacuation: "Emergency Evacuation",
};

export const DIFFICULTY_LABELS: Record<FieldManual["difficulty"], string> = {
  universal: "Universal",
  basic_training: "Basic Training Recommended",
  advanced: "Advanced",
};
