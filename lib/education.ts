/**
 * V FOR X — Interactive Education Mode
 *
 * A self-contained course system. Each course is built around real
 * metrics from world_backbone.json so that learners leave with the
 * numbers that change the argument. Progress is persisted to
 * localStorage so the experience works fully offline.
 */

// ── Types ──────────────────────────────────────────────────

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface DataExploration {
  /** Instruction telling the learner where to look in the data */
  prompt: string;
  /** A metric key path inside a CountryData object, e.g. "hunger.prevalence_pct" */
  metricKey: string;
  /** Optional ISO3 code to pre-select in the explorer */
  iso3?: string;
}

export interface Module {
  id: string;
  title: string;
  content: string;
  dataExploration?: DataExploration;
  quiz?: QuizQuestion[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  modules: Module[];
}

// ── Course catalog ─────────────────────────────────────────

export const COURSES: Course[] = [
  // ═══ 1. Understanding Global Hunger ═══
  {
    id: "global-hunger",
    title: "Understanding Global Hunger",
    description:
      "Why 733 million people go hungry in a world that produces enough food for 10 billion. The definitions, the measurements, the geography, and what it actually costs to fix.",
    duration: "~25 min",
    difficulty: "beginner",
    modules: [
      {
        id: "what-is-hunger",
        title: "What is hunger?",
        content:
          "Hunger is not a single feeling — it is a spectrum measured across several dimensions. At its most acute it is famine: communities where starvation, death, and destitution are already underway. Below that lies crisis-level food insecurity, where families skip meals, sell productive assets, and reduce portions to survive. Then moderate insecurity, where diet quality deteriorates but quantity is mostly maintained.\n\nThe crucial insight: the world produces more than enough food for everyone. Roughly 733 million people are undernourished not because food is scarce, but because of poverty, conflict, climate shocks, and broken distribution. Hunger is a political and economic failure, not an agricultural one.",
        dataExploration: {
          prompt:
            "Open South Sudan (SSD) in the Sorrow Map. Its hunger prevalence is 64.5% — meaning nearly two thirds of the population is undernourished. Compare it to your own country.",
          metricKey: "hunger.prevalence_pct",
          iso3: "SSD",
        },
        quiz: [
          {
            question:
              "The world produces enough food for roughly how many people?",
            options: ["7 billion", "8 billion", "10 billion", "5 billion"],
            correctIndex: 2,
            explanation:
              "Global food supply could feed about 10 billion people — yet 733 million remain hungry. The problem is distribution and access, not production.",
          },
          {
            question: "What is the primary driver of modern famine?",
            options: [
              "Drought alone",
              "Conflict and political failure",
              "Global food shortage",
              "Overpopulation",
            ],
            correctIndex: 1,
            explanation:
              "Modern famine is almost always driven by conflict and political decisions that block access to food, not by absolute scarcity.",
          },
        ],
      },
      {
        id: "measuring-hunger",
        title: "Measuring hunger",
        content:
          "Hunger is measured through several complementary frameworks. The Prevalence of Undernourishment (PoU) estimates the share of a population unable to acquire enough calories. The IPC (Integrated Food Security Phase Classification) sorts areas into five phases, from minimal (1) to famine (5). The WFP classifies hunger hotspots into risk tiers. Child stunting, wasting, and under-five mortality provide the human face of chronic hunger.\n\nThese numbers matter because they translate human suffering into terms policymakers can act on — and terms we can hold them accountable to.",
        dataExploration: {
          prompt:
            "Look at Yemen (YEM) in the data: 51.8% hunger prevalence and 4.5 million displaced. Notice how hunger and conflict metrics move together.",
          metricKey: "hunger.prevalence_pct",
          iso3: "YEM",
        },
        quiz: [
          {
            question: "What does the IPC Phase 5 classification mean?",
            options: [
              "Stressed food security",
              "Crisis food security",
              "Emergency food security",
              "Famine / catastrophe",
            ],
            correctIndex: 3,
            explanation:
              "IPC Phase 5 is famine — starvation, death, destitution, and acute malnutrition are already occurring. At least 20% of households face extreme food gaps.",
          },
          {
            question: "Which metric captures chronic long-term hunger in children?",
            options: [
              "Child wasting",
              "Child stunting",
              "Famine risk score",
              "Displacement",
            ],
            correctIndex: 1,
            explanation:
              "Stunting (low height for age) reflects chronic undernutrition over years and causes irreversible cognitive and physical damage.",
          },
        ],
      },
      {
        id: "geography-of-hunger",
        title: "The geography of hunger",
        content:
          "Hunger is not distributed evenly — it is concentrated. The WFP identifies 22 hunger hotspots of highest concern, overwhelmingly in conflict-affected regions: Sudan, South Sudan, Haiti, Yemen, Somalia, the Democratic Republic of the Congo, Gaza, and others. Africa bears the largest share, but crises from Afghanistan to Haiti prove hunger is a global, not regional, phenomenon.\n\nThe geography of hunger closely tracks the geography of war, climate vulnerability, and state collapse.",
        dataExploration: {
          prompt:
            "Open the Sorrow Map and filter by hunger. Notice the cluster across the Sahel, the Horn of Africa, and the Caribbean. Click Haiti (HTI) — 42.7% prevalence in the Americas.",
          metricKey: "hunger.prevalence_pct",
          iso3: "HTI",
        },
        quiz: [
          {
            question: "Roughly how many hunger hotspots does the WFP track?",
            options: ["5", "12", "22", "50"],
            correctIndex: 2,
            explanation:
              "The WFP identifies about 22 hunger hotspots of highest concern. These countries account for a disproportionate share of acutely food-insecure people.",
          },
          {
            question: "Which region bears the largest share of acute hunger?",
            options: ["Europe", "Africa", "Oceania", "North America"],
            correctIndex: 1,
            explanation:
              "Africa carries the largest share of acute food insecurity, driven by conflict, climate shocks, and economic instability.",
          },
        ],
      },
      {
        id: "solutions-and-costs",
        title: "Solutions and costs",
        content:
          "Ending hunger is cheap — astonishingly cheap. The estimated annual cost to eradicate hunger is about $93 billion. Global military spending is roughly $2.4 trillion per year. That means the cost to end hunger is about 14 days of military spending, or under 0.9% of the world's military budget.\n\nProven interventions exist: school feeding programs, support for smallholder farmers, social protection systems, and emergency food assistance. The barrier is political will, not knowledge or money.",
        dataExploration: {
          prompt:
            "Go to The Equation. Move the slider and watch how redirecting 0.9% of military spending covers the $93B/year cost to end hunger. The math is undeniable.",
          metricKey: "global_indicators.hunger.cost_to_eradicate_billion_yr",
        },
        quiz: [
          {
            question: "How much does it cost per year to end global hunger?",
            options: ["$93 billion", "$930 billion", "$9 trillion", "$9 billion"],
            correctIndex: 0,
            explanation:
              "About $93 billion per year. That is under 1% of global military spending — roughly 14 days of it.",
          },
          {
            question: "School feeding programs have a documented ROI of roughly:",
            options: ["3:1", "10:1", "30:1 or higher", "0:1"],
            correctIndex: 2,
            explanation:
              "Evidence shows returns of roughly $30 or more per dollar invested in school feeding, through better health, education, and future earnings.",
          },
          {
            question:
              "The annual cost to end hunger equals about how many days of military spending?",
            options: ["1 day", "14 days", "90 days", "365 days"],
            correctIndex: 1,
            explanation:
              "About 14 days. The world spends more on its military in two weeks than it would cost to end hunger for a whole year.",
          },
        ],
      },
    ],
  },

  // ═══ 2. The Economics of War ═══
  {
    id: "economics-of-war",
    title: "The Economics of War",
    description:
      "The world spends $2.4 trillion a year on weapons. This course traces where that money goes, what it could buy instead, the global arms trade, and the lasting economic scars of conflict.",
    duration: "~30 min",
    difficulty: "intermediate",
    modules: [
      {
        id: "military-spending",
        title: "Military spending",
        content:
          "Global military expenditure reached roughly $2.4 trillion in a single year. The United States alone spends about $916 billion — more than the next several countries combined. China spends roughly $297 billion. Russia directs nearly 15% of its GDP toward the military.\n\nThese figures are not abstract. Every dollar spent on weapons is a dollar not spent on food, health, education, or climate adaptation. Military spending is the largest single opportunity cost in the global economy.",
        dataExploration: {
          prompt:
            "Open The Choice. The United States spends 9.1% of GDP on the military. Compare military-vs-health ratios across countries — Syria spends 3.1× more on war than health.",
          metricKey: "military.pct_gdp",
          iso3: "USA",
        },
        quiz: [
          {
            question: "Approximately how much does the world spend on the military per year?",
            options: ["$240 billion", "$2.4 trillion", "$24 trillion", "$24 billion"],
            correctIndex: 1,
            explanation:
              "Global military spending is about $2.4 trillion per year — roughly $6.5 billion every single day.",
          },
          {
            question: "Roughly what share of GDP does Russia direct to military spending?",
            options: ["1.5%", "4%", "15%", "30%"],
            correctIndex: 2,
            explanation:
              "Russia spends nearly 15% of its GDP on the military — among the highest ratios in the world.",
          },
        ],
      },
      {
        id: "opportunity-cost",
        title: "The opportunity cost",
        content:
          "Opportunity cost is the value of the next-best alternative given up when a choice is made. For every missile purchased, a school is not built, a clinic is not staffed, a water system is not installed.\n\nThe numbers are stark: ending hunger costs $93B/year. Universal access to clean water, basic education, and primary healthcare each cost a small fraction of military spending. The combined cost of meeting humanity's basic needs is far less than what the world spends preparing to destroy itself.",
        dataExploration: {
          prompt:
            "Go to The Allocator. You have the world's military budget. Drag it across the 6 SDG goals and watch how many lives are saved. The opportunity cost becomes visible.",
          metricKey: "military.expenditure_usd",
          iso3: "USA",
        },
        quiz: [
          {
            question: "What does 'opportunity cost' mean?",
            options: [
              "The financial profit of an investment",
              "The next-best alternative given up by a choice",
              "The total cost of a war",
              "Inflation caused by spending",
            ],
            correctIndex: 1,
            explanation:
              "Opportunity cost is the value of what you give up when you choose one option over another — for example, schools not built because the money bought weapons.",
          },
          {
            question: "Ending global hunger costs what fraction of annual military spending?",
            options: ["About 50%", "About 10%", "Under 1%", "About 25%"],
            correctIndex: 2,
            explanation:
              "Ending hunger costs under 1% of global military spending. The resources exist; the priority does not.",
          },
        ],
      },
      {
        id: "arms-trade",
        title: "Arms trade networks",
        content:
          "A handful of countries dominate the global arms trade, exporting weapons that fuel conflicts far from their own borders. The five largest arms exporters account for the majority of all international transfers. These weapons often end up in the hands of actors committing human rights abuses.\n\nTracing the arms trade reveals how distant decisions enable local atrocities. A weapon manufactured in one country, sold by a second, shipped through a third, can devastate a community in a fourth — making accountability extraordinarily difficult.",
        dataExploration: {
          prompt:
            "In the data, look at conflict intensity and displacement for Sudan (SDN) — 10 million displaced. Weapons from global supply chains reach these zones.",
          metricKey: "conflict.displacement_m",
          iso3: "SDN",
        },
        quiz: [
          {
            question: "How many countries dominate the majority of the global arms trade?",
            options: ["Two", "Five", "Twenty", "All UN members"],
            correctIndex: 1,
            explanation:
              "About five countries account for the majority of all international arms transfers, concentrating enormous responsibility in few hands.",
          },
          {
            question: "Why is arms-trade accountability difficult?",
            options: [
              "Weapons are too cheap",
              "Supply chains span multiple countries",
              "There are no weapons",
              "It is illegal to track",
            ],
            correctIndex: 1,
            explanation:
              "Weapons often pass through several countries before use, obscuring who is responsible for atrocities they enable.",
          },
        ],
      },
      {
        id: "economic-consequences",
        title: "Economic consequences",
        content:
          "Wars destroy economies long after the fighting stops. Infrastructure is ruined, capital flees, a generation loses years of education, and debt mounts for reconstruction. Countries emerging from conflict face depressed GDP, high unemployment, and weakened institutions for decades.\n\nThe economic case against war is not just moral — it is the worst investment a society can make. Prevention and diplomacy are orders of magnitude cheaper than the destruction they avoid.",
        dataExploration: {
          prompt:
            "Compare life expectancy in the data: the United States (78.4) vs Japan (84.0). Now find conflict-affected countries and note the gap war creates.",
          metricKey: "health.life_expectancy",
          iso3: "USA",
        },
        quiz: [
          {
            question: "How long do war's economic effects typically last?",
            options: ["A few months", "A couple of years", "Decades", "Wars end economically immediately"],
            correctIndex: 2,
            explanation:
              "Wars depress GDP, education, and institutions for decades. The economic damage vastly outlasts the fighting.",
          },
          {
            question: "Compared to war, diplomacy and prevention are:",
            options: [
              "Equally expensive",
              "Orders of magnitude cheaper",
              "More expensive",
              "Impossible to compare",
            ],
            correctIndex: 1,
            explanation:
              "Prevention and diplomacy are orders of magnitude cheaper than the destruction and reconstruction war requires.",
          },
        ],
      },
    ],
  },

  // ═══ 3. Corruption and Its Human Cost ═══
  {
    id: "corruption-human-cost",
    title: "Corruption and Its Human Cost",
    description:
      "Corruption is not a victimless crime. Stolen public funds mean unbuilt hospitals, unbought medicines, and unfed children. This course covers how corruption is defined, measured, exposed through case studies, and resisted by whistleblowers.",
    duration: "~35 min",
    difficulty: "advanced",
    modules: [
      {
        id: "defining-corruption",
        title: "Defining corruption",
        content:
          "Corruption is the abuse of entrusted power for private gain. It ranges from grand corruption — billions looted by leaders — to petty corruption, the everyday bribes that deny the poor access to basic services. Systemic corruption hollows out institutions, erodes trust, and redirects resources away from those who need them most.\n\nThe human cost is direct: every dollar stolen from a health budget is a vaccine not given, a clinic not staffed. Corruption kills.",
        dataExploration: {
          prompt:
            "In the Sorrow Map, switch to governance and look at the Corruption Perceptions Index. Somalia scores 9/100 and Venezuela 10/100 — among the lowest on Earth.",
          metricKey: "governance.corruption_perceptions_index",
          iso3: "SOM",
        },
        quiz: [
          {
            question: "How is corruption most precisely defined?",
            options: [
              "Any illegal act",
              "The abuse of entrusted power for private gain",
              "Only large-scale theft",
              "Only bribery",
            ],
            correctIndex: 1,
            explanation:
              "Transparency International defines corruption as the abuse of entrusted power for private gain — from grand theft to petty bribery.",
          },
          {
            question: "The Corruption Perceptions Index scores countries from 0 to 100. What does a low score mean?",
            options: [
              "Highly transparent",
              "Highly corrupt",
              "Average corruption",
              "No data",
            ],
            correctIndex: 1,
            explanation:
              "A score near 0 indicates a highly corrupt public sector; near 100 indicates a very clean one.",
          },
        ],
      },
      {
        id: "measuring-corruption",
        title: "Measuring the unmeasurable",
        content:
          "Corruption is hidden by nature, so we measure proxies. The Corruption Perceptions Index aggregates expert assessments. The Political Corruption Index captures institutional capture. Survey-based experience data asks citizens directly about bribery. Asset recovery rates track how much stolen money is ever returned.\n\nNo single metric is perfect, but together they reveal clear patterns: corruption correlates strongly with poverty, inequality, weak rule of law, and poor health outcomes.",
        dataExploration: {
          prompt:
            "Look at Denmark (DNK) — CPI 90, among the cleanest. Compare with the United States (CPI 65) and Liberia (LBR, CPI 27). Note how transparency tracks development.",
          metricKey: "governance.corruption_perceptions_index",
          iso3: "DNK",
        },
        quiz: [
          {
            question: "Why is corruption inherently difficult to measure directly?",
            options: [
              "It is legal everywhere",
              "Those involved hide it",
              "It happens too fast",
              "It is too rare",
            ],
            correctIndex: 1,
            explanation:
              "Corruption is hidden by its participants, so researchers rely on perceptions, expert assessments, and citizen-experience surveys as proxies.",
          },
          {
            question: "Corruption correlates strongly with which outcomes?",
            options: [
              "High economic growth",
              "Poverty, inequality, poor health",
              "Low military spending",
              "High education scores",
            ],
            correctIndex: 1,
            explanation:
              "Across countries, high corruption tracks poverty, inequality, weak rule of law, and worse public health.",
          },
        ],
      },
      {
        id: "case-studies",
        title: "Case studies",
        content:
          "Consider the pattern: a resource-rich nation with weak institutions. Public revenues vanish into offshore accounts while citizens lack clean water. Or a procurement system where contracts are inflated and the difference is pocketed — meaning fewer roads built and worse hospitals.\n\nThese are not hypothetical. The data shows it: countries with low corruption scores consistently deliver better health, education, and infrastructure outcomes at similar income levels. Corruption is a tax on the poor paid to the powerful.",
        dataExploration: {
          prompt:
            "Open North Korea (PRK) in the data — CPI 15, among the most opaque regimes. Then open a high-transparency country and contrast the health and education fields.",
          metricKey: "governance.corruption_perceptions_index",
          iso3: "PRK",
        },
        quiz: [
          {
            question: "Corruption is most accurately described as:",
            options: [
              "A victimless crime",
              "A tax on the poor paid to the powerful",
              "Only a legal issue",
              "Harmless if undetected",
            ],
            correctIndex: 1,
            explanation:
              "Corruption redirects public resources away from services the poor depend on — it is effectively a tax on the most vulnerable, paid to the powerful.",
          },
          {
            question:
              "At similar income levels, less corrupt countries tend to show:",
            options: [
              "Worse health outcomes",
              "Better health, education, and infrastructure",
              "No difference",
              "More conflict",
            ],
            correctIndex: 1,
            explanation:
              "Controlling for income, lower corruption consistently corresponds with better public-service delivery and human outcomes.",
          },
        ],
      },
      {
        id: "whistleblower-protection",
        title: "Whistleblower protection",
        content:
          "Exposing corruption requires courage, and courage requires protection. Whistleblowers face retaliation, imprisonment, and physical danger. Strong legal protections, anonymous reporting channels, and secure documentation tools are essential infrastructure for accountability.\n\nThis is why V FOR X includes The Submit — anonymous, client-side-encrypted dossier submission — and The Press Kit, which strips metadata and verifies file integrity. Technology can shield those who speak truth to power.",
        dataExploration: {
          prompt:
            "Visit The Submit and The Press Kit tools in this platform. They let whistleblowers report corruption anonymously and verify evidence — all processed on-device.",
          metricKey: "governance.political_corruption_index",
        },
        quiz: [
          {
            question: "What do effective whistleblower protections require?",
            options: [
              "Only good intentions",
              "Legal safeguards, anonymous channels, secure tools",
              "Public naming",
              "Nothing — speaking up is always safe",
            ],
            correctIndex: 1,
            explanation:
              "Whistleblowers need enforceable legal protection, anonymous reporting, and secure documentation tools to expose corruption without risking their lives.",
          },
          {
            question: "Why does V FOR X process submissions client-side (on-device)?",
            options: [
              "To run faster",
              "So no data leaves the reporter's device before encryption",
              "To save server costs",
              "It is required by law",
            ],
            correctIndex: 1,
            explanation:
              "Client-side encryption means evidence is encrypted before it ever leaves the device, protecting the whistleblower's identity even if a server is compromised.",
          },
        ],
      },
    ],
  },

  // ═══ 4. Climate Crisis and Displacement ═══
  {
    id: "climate-displacement",
    title: "Climate Crisis and Displacement",
    description:
      "Floods, droughts, and rising seas are forcing hundreds of millions from their homes. This course maps climate refugees, environmental degradation, the scale of the numbers, and the policy responses the world must choose between.",
    duration: "~30 min",
    difficulty: "intermediate",
    modules: [
      {
        id: "climate-refugees",
        title: "Climate refugees",
        content:
          "Climate displacement is already here. In a single year, countries like Bangladesh see over 1.7 million people newly displaced by disasters — floods, cyclones, and erosion. Unlike war refugees, those fleeing climate impacts lack a recognized legal status under the 1951 Refugee Convention, leaving them in a protection gap.\n\nAs warming intensifies, the numbers will grow. Low-lying coastal nations face existential threats, while drought drives rural-to-urban migration across entire regions.",
        dataExploration: {
          prompt:
            "Open Bangladesh (BGD) in the data. Look at migration: 1,791,000 new disaster-driven IDPs in one year. Then check The Exodus flow map to see displacement streams.",
          metricKey: "migration.idps_disaster_new",
          iso3: "BGD",
        },
        quiz: [
          {
            question: "Why do people fleeing climate disasters face a 'protection gap'?",
            options: [
              "They are not counted",
              "They lack recognized refugee status under international law",
              "They are always safe",
              "Climate displacement is rare",
            ],
            correctIndex: 1,
            explanation:
              "The 1951 Refugee Convention does not recognize climate as grounds for asylum, leaving climate-displaced people without formal international protection.",
          },
          {
            question: "In a single year, roughly how many people were newly displaced by disasters in Bangladesh?",
            options: ["About 17,000", "About 170,000", "Over 1.7 million", "About 17 million"],
            correctIndex: 2,
            explanation:
              "Bangladesh recorded over 1.7 million new disaster-driven IDPs in a year — illustrating the scale of climate displacement in vulnerable regions.",
          },
        ],
      },
      {
        id: "environmental-degradation",
        title: "Environmental degradation",
        content:
          "The crisis is not only displacement — it is the slow erosion of the natural systems people depend on. Deforestation strips soil and livelihoods. Air pollution shortens millions of lives. CO₂ emissions, both total and per capita, track the unequal burden: a few countries emit vastly more than the majority.\n\nPer-capita emissions reveal stark injustice. The highest emitters produce tens of tonnes per person while the countries suffering the worst climate damage emit a fraction of that.",
        dataExploration: {
          prompt:
            "Look at Qatar (QAT) in the data — 41.3 tonnes of CO₂ per capita, the highest. Compare with low-emitting countries that suffer severe climate damage. The injustice is visible.",
          metricKey: "climate.co2_per_capita_t",
          iso3: "QAT",
        },
        quiz: [
          {
            question: "Per-capita CO₂ emissions reveal what key injustice?",
            options: [
              "Everyone emits equally",
              "A few high-emitting countries cause damage borne mostly by others",
              "Poor countries emit the most",
              "Emissions don't matter",
            ],
            correctIndex: 1,
            explanation:
              "A small number of high-emitting countries generate most of the per-capita emissions, while the worst climate damage falls on countries that emit far less.",
          },
          {
            question: "Which of these is a major driver of environmental degradation tracked in the data?",
            options: ["Deforestation", "Air pollution", "Both", "Neither"],
            correctIndex: 2,
            explanation:
              "Both deforestation and air pollution (PM2.5) are tracked as key dimensions of environmental degradation harming health and livelihoods.",
          },
        ],
      },
      {
        id: "the-numbers",
        title: "The numbers",
        content:
          "Over 120 million people are forcibly displaced worldwide — a record and rising figure. The majority are displaced within their own countries (internally displaced persons), and disaster displacement now rivals conflict displacement in scale. Host countries bear enormous burdens: Türkiye alone hosts over 3.2 million refugees.\n\nBehind every number is a person. But the aggregate is essential: it proves the crisis is systemic, not exceptional, and demands systemic response.",
        dataExploration: {
          prompt:
            "Open Türkiye (TUR) in the data — over 3.2 million refugees hosted. Then visit The Exodus to see the global flow map of where refugees come from and where they go.",
          metricKey: "migration.refugees_hosted",
          iso3: "TUR",
        },
        quiz: [
          {
            question: "Roughly how many people are forcibly displaced worldwide today?",
            options: ["12 million", "Over 120 million", "1.2 million", "1.2 billion"],
            correctIndex: 1,
            explanation:
              "Over 120 million people are forcibly displaced — a record high, driven by conflict, persecution, and increasingly by climate disasters.",
          },
          {
            question: "Where do the majority of displaced people end up?",
            options: [
              "Only in wealthy countries",
              "Displaced within their own countries as IDPs",
              "In space",
              "Nowhere — they return immediately",
            ],
            correctIndex: 1,
            explanation:
              "The majority of displaced people remain internally displaced within their own countries (IDPs), often with less international support than cross-border refugees.",
          },
        ],
      },
      {
        id: "policy-responses",
        title: "Policy responses",
        content:
          "Effective response requires three things: emission reduction by the largest polluters, adaptation funding for the most vulnerable, and legal status for climate-displaced people. Wealthy nations have repeatedly under-delivered on climate finance pledges, while the cost of inaction rises every year.\n\nThe data is clear on the trade-off: a fraction of global military spending would fund the transition and adaptation the world needs. The choice is not between economy and climate — it is between a livable future and catastrophic inaction.",
        dataExploration: {
          prompt:
            "Go to The Allocator and The Ledger. See how redirecting a fraction of the $2.4T military budget toward climate and SDG goals covers the cost of a just transition.",
          metricKey: "climate.co2_mt",
        },
        quiz: [
          {
            question: "What are the three pillars of an effective climate-displacement response?",
            options: [
              "Emission cuts, adaptation funding, legal status for the displaced",
              "Only emission cuts",
              "Only border walls",
              "Waiting and hoping",
            ],
            correctIndex: 0,
            explanation:
              "Effective response needs emission reduction by top polluters, adaptation finance for vulnerable nations, and legal recognition for climate-displaced people.",
          },
          {
            question: "The cost of climate action compared to global military spending is:",
            options: [
              "Far higher",
              "A small fraction",
              "Identical",
              "Impossible to estimate",
            ],
            correctIndex: 1,
            explanation:
              "Funding the global transition and adaptation costs a small fraction of annual military spending. The resources exist; the priority does not.",
          },
          {
            question: "What have wealthy nations largely done regarding climate finance pledges?",
            options: [
              "Exceeded them",
              "Met them fully",
              "Repeatedly under-delivered",
              "Abolished them",
            ],
            correctIndex: 2,
            explanation:
              "Wealthy nations have consistently fallen short of their climate finance commitments, even as the human and economic cost of inaction grows.",
          },
        ],
      },
    ],
  },
];

// ── Progress persistence (localStorage) ────────────────────

const PROGRESS_KEY = "vfx-academy-progress";

export interface CourseProgress {
  completedModules: string[];
  quizScores: Record<string, number>;
}

export interface AllProgress {
  [courseId: string]: CourseProgress;
}

function readProgress(): AllProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as AllProgress) : {};
  } catch {
    return {};
  }
}

function writeProgress(data: AllProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
  } catch {
    /* storage full or unavailable — fail silently */
  }
}

/**
 * Get the saved progress for a single course.
 * Returns empty completion if nothing is stored yet.
 */
export function getCourseProgress(courseId: string): CourseProgress {
  const all = readProgress();
  return (
    all[courseId] ?? { completedModules: [], quizScores: {} }
  );
}

/**
 * Mark a module as complete and optionally store its quiz score (0–100).
 * If the module was already complete, the higher score is kept.
 */
export function saveProgress(
  courseId: string,
  moduleId: string,
  score?: number,
): void {
  const all = readProgress();
  const current: CourseProgress = all[courseId] ?? {
    completedModules: [],
    quizScores: {},
  };

  if (!current.completedModules.includes(moduleId)) {
    current.completedModules = [...current.completedModules, moduleId];
  }

  if (typeof score === "number") {
    const existing = current.quizScores[moduleId];
    if (existing === undefined || score > existing) {
      current.quizScores = { ...current.quizScores, [moduleId]: score };
    }
  }

  all[courseId] = current;
  writeProgress(all);
}

export interface Certificate {
  courseTitle: string;
  date: string;
  score: number;
}

/**
 * Returns certificate data if every module in the course is complete,
 * otherwise null. The score is the average of all module quiz scores.
 */
export function getCertificate(courseId: string): Certificate | null {
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) return null;

  const progress = getCourseProgress(courseId);
  const allModulesDone = course.modules.every((m) =>
    progress.completedModules.includes(m.id),
  );
  if (!allModulesDone) return null;

  const scores = Object.values(progress.quizScores);
  const avg =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 100;

  return {
    courseTitle: course.title,
    date: new Date().toISOString(),
    score: avg,
  };
}
