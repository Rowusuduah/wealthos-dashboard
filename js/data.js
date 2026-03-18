'use strict';

// ─── Core Financial Constants ──────────────────────────────────────────────
const GROSS_BW = 3346.15; // Gross biweekly ($87K ÷ 26 pay periods)
const TAX_BW   = 540.38;  // Federal income tax per paycheck (no FICA on F-1 OPT, no FL state tax)
const NET      = 2805.77; // Net biweekly take-home (GROSS_BW - TAX_BW)

// ─── Budget Categories ─────────────────────────────────────────────────────
// Each entry: { id, l (label), e (emoji), c (color), items[], sub (biweekly total) }
// Items: { n (name), bw (biweekly $), nt (note), b? (1 = flexible/estimated) }
const S = [
  {id:"giving",l:"Giving",e:"🙏",c:"#a78bfa",items:[
    {n:"Tithe (10% of net)",bw:280.58,nt:"First fruits. Auto-transfer on payday."},
    {n:"Offering",bw:20,nt:"$10 every Sunday"}
  ],sub:300.58},
  {id:"housing",l:"Housing",e:"🏠",c:"#60a5fa",items:[
    {n:"Rent",bw:400,nt:"Half of $800/mo"},
    {n:"Electricity & Water",bw:100,nt:"Tampa avg ~$218/mo",b:1},
    {n:"Internet",bw:35,nt:"Half of ~$70/mo"}
  ],sub:535},
  {id:"transport",l:"Transport",e:"🚗",c:"#34d399",items:[
    {n:"Car Insurance",bw:127.50,nt:"Half of $255/mo"},
    {n:"Fuel",bw:46,nt:"$46 every 2 weeks"},
    {n:"Car Maintenance",bw:60,nt:"$1,560/yr oil, tires, repairs",b:1},
    {n:"Car Wash",bw:12.50,nt:"Half of $25/mo"}
  ],sub:246},
  {id:"subs",l:"Subscriptions",e:"📱",c:"#f472b6",items:[
    {n:"Phone Plan",bw:15,nt:"$30/mo ÷ 2"},
    {n:"Apple Music",bw:3.50,nt:"$7/mo ÷ 2"},
    {n:"ChatGPT",bw:10,nt:"$20/mo ÷ 2"},
    {n:"Claude",bw:10,nt:"$20/mo ÷ 2"},
    {n:"Google Subscription",bw:5,nt:"$10/mo ÷ 2"}
  ],sub:43.50},
  {id:"living",l:"Daily Living",e:"🛒",c:"#fb923c",items:[
    {n:"Groceries",bw:175,nt:"Walmart, Aldi, African stores",b:1},
    {n:"Household Supplies",bw:20,nt:"Cleaning, kitchen basics",b:1},
    {n:"Personal Care & Grooming",bw:40,nt:"Haircut, cologne, skincare",b:1},
    {n:"Clothing Fund",bw:50,nt:"Ross/TJ Maxx",b:1},
    {n:"Solo Dining Out",bw:30,nt:"~2 solo meals/week",b:1},
    {n:"Medical / Pharmacy",bw:35,nt:"Copays + dental/vision reserve",b:1},
    {n:"Health Insurance",bw:0,nt:"⚠️ Fill in on Day 1",b:1},
    {n:"Term Life Insurance ($500K)",bw:12.50,nt:"Policygenius/Haven Life"},
    {n:"Renters Insurance",bw:8,nt:"Lemonade or State Farm"},
    {n:"Gym / Fitness",bw:10,nt:"Planet Fitness $10/mo",b:1},
    {n:"Mental Health / Therapy",bw:15,nt:"1 session/mo",b:1},
    {n:"Miscellaneous",bw:30,nt:"Buffer. If unused → brokerage",b:1}
  ],sub:425.50},
  {id:"relationship",l:"Relationship",e:"💑",c:"#fb7185",items:[
    {n:"Dating Fund",bw:75,nt:"~$150/mo. Bayshore, Ybor, dinner",b:1},
    {n:"Special Occasions",bw:25,nt:"Birthday, Valentine's, anniversary",b:1},
    {n:"Engagement Ring Fund",bw:50,nt:"$1,300/yr → ring ~age 32",b:1},
    {n:"Wedding Fund",bw:25,nt:"$650/yr. Tampa wedding $8-12K",b:1}
  ],sub:175},
  {id:"explore",l:"Exploration",e:"🗺️",c:"#38bdf8",items:[
    {n:"Local Tampa Exploration",bw:25,nt:"Beaches, Ybor, Riverwalk",b:1},
    {n:"Travel Fund",bw:50,nt:"Miami, Orlando, Atlanta, trips",b:1}
  ],sub:75},
  {id:"ghana",l:"Ghana Family",e:"🌍",c:"#f87171",items:[
    {n:"Monthly Remittance",bw:150,nt:"$300/mo. Lemfi fees 0-1%",b:1},
    {n:"Ghana Flight Fund",bw:75,nt:"$1,950/yr. TPA→ACC ~$900-1,400",b:1},
    {n:"Family Emergency/Gift Fund",bw:25,nt:"School fees, medical, gifts",b:1},
    {n:"Sibling Development Fund",bw:15,nt:"Firstborn of 10",b:1},
    {n:"Emergency Ghana Travel",bw:30,nt:"Save to $1,500. Last-minute flights",b:1}
  ],sub:295},
  {id:"annual",l:"Annual Irregular",e:"📅",c:"#86efac",items:[
    {n:"Tax Filing — Sprintax NR",bw:6,nt:"~$150/yr. NOT TurboTax"},
    {n:"Car Registration FL",bw:3,nt:"~$75/yr"},
    {n:"Annual App Renewals",bw:5,nt:"Amazon Prime etc."},
    {n:"Immigration Attorney",bw:10,nt:"Annual check-in",b:1},
    {n:"CPA / Tax Advisor",bw:8,nt:"International tax specialist",b:1}
  ],sub:32},
  {id:"profdev",l:"Professional Dev",e:"🎓",c:"#67e8f9",items:[ /* distinct from annual's #86efac */
    {n:"Courses, Books & Certs",bw:20,nt:"Udemy, Coursera. 10x ROI",b:1},
    {n:"Career Strategy Fund",bw:15,nt:"Job-hop readiness",b:1}
  ],sub:35},
  {id:"wealth",l:"Wealth Building",e:"📈",c:"#4ade80",items:[
    {n:"Emergency Fund → HYSA",bw:250,nt:"Target $15K ~23 months. 4-5% APY",b:1},
    {n:"H1B Legal Fund",bw:115,nt:"$3K by Month 12",b:1},
    {n:"Taxable Brokerage (fixed)",bw:150,nt:"VOO/VTI. Fidelity/Schwab",b:1},
    {n:"Additional Brokerage",bw:128.19,nt:"Every remaining dollar → index funds"}
  ],sub:643.19},
];

// ─── Wealth Milestones ─────────────────────────────────────────────────────
const ML = [
  {age:30,yr:1,p:"$18,521",s:"Foundation. Emergency $6.5K. H1B $3K."},
  {age:31,yr:2,p:"$58,000",s:"H1B filed. Emergency done. +$365/BW investing."},
  {age:32,yr:3,p:"$103,000",s:"Ring ready. First Ghana trip paid for."},
  {age:33,yr:4,p:"$155,000",s:"Married. Wedding funded. Net worth ~$160K."},
  {age:35,yr:6,p:"$272,000",s:"Home down payment ready."},
  {age:40,yr:11,p:"$630,000",s:"Net worth $600K+. Ghana property owned."},
  {age:50,yr:21,p:"$1,800,000",s:"Financial independence possible."},
  {age:60,yr:31,p:"$4,300,000",s:"Retirement funded. Legacy secured."},
];

// ─── Pay periods per year ───────────────────────────────────────────────────
const PERIODS_PER_YEAR = 26; // biweekly = 26 pay periods

// ─── KPI Cards (computed from NET + S so they stay in sync if NET changes) ─
const KPI_DATA = [
  {l:'Net / Paycheck', v:'$' + NET.toLocaleString('en-US',{maximumFractionDigits:0}),                                    s:'every 2 weeks',           c:'var(--green)'},
  {l:'Net / Month',    v:'$' + Math.round(NET * PERIODS_PER_YEAR / 12).toLocaleString('en-US'),                           s:'×26÷12 correct',          c:''},
  {l:'Net / Year',     v:'$' + Math.round(NET * PERIODS_PER_YEAR).toLocaleString('en-US'),                                s:'after $14,050 tax',       c:''},
  {l:'Wealth Building Rate', v:(S.find(s=>s.id==='wealth').sub / NET * 100).toFixed(1) + '%',                             s:'direct investing only',   c:'var(--purple)'},
  {l:'Year 1 Saved',   v:'$' + Math.round(S.find(s=>s.id==='wealth').sub * PERIODS_PER_YEAR).toLocaleString('en-US'),    s:'investing + reserves',    c:'var(--gold)'},
  {l:'Age 60 Projection', v:'$4.3M+',                                                                                      s:'at 7% avg return',        c:'var(--orange)'},
];

// ─── Wealth Goals ──────────────────────────────────────────────────────────
const WEALTH_GOALS = [
  {l:'Emergency Fund',bw:250,tgt:15000,c:'#4ade80',nt:'Target $15K ~23 months'},
  {l:'H1B Legal Fund',bw:115,tgt:4500,c:'#a78bfa',nt:'Target $4,500 by Month 18'},
  {l:'Engagement Ring',bw:50,tgt:5200,c:'#fbbf24',nt:'$5,200 in 4 years'},
  {l:'Wedding Fund',bw:25,tgt:10000,c:'#fb923c',nt:'Target $10K'},
  {l:'Brokerage (Yr1)',bw:278.19,tgt:7233,c:'#38bdf8',nt:'$7,233 invested Year 1'},
  {l:'Ghana Flight',bw:75,tgt:1950,c:'#f87171',nt:'Home every 18 months'},
];

// ─── Roadmap Phases ────────────────────────────────────────────────────────
const ROADMAP_PHASES = [
  {ph:"Week 1 — Before First Paycheck",c:"#f87171",d:"o",items:[
    "Open Ally HYSA + Fidelity Brokerage + Lemfi app — all free",
    "Ask HR: 401k match? Contribute minimum to capture full match",
    "Ask HR: HSA available? Triple tax advantage",
    "Apply for term life insurance — Policygenius.com (20 min)",
    "Apply for renters insurance — Lemonade.com (~$15/mo)",
    "Open secured credit card (Discover Secured) — build credit score",
    "Name beneficiaries on every account",
    "Set up Personal Capital (free net worth tracker)",
  ]},
  {ph:"Year 1 (Jun 2026 – May 2027)",c:"#fbbf24",d:"",items:[
    "Emergency fund: $250/BW → target $15K (~Month 23)",
    "H1B fund: $115/BW → $3K by Month 12",
    "Brokerage: $278/BW → $7,233 invested Year 1",
    "Book immigration attorney consultation Month 1-2",
    "File 1040-NR with Sprintax — April 2027",
    "Net worth milestone: $15,000+ by May 2027",
  ]},
  {ph:"Year 2 (Jun 2027 – May 2028)",c:"#a78bfa",d:"p",items:[
    "H1B lottery filed April 2027",
    "Emergency fund complete → redirect $250/BW to investing",
    "Start Wedding Fund increase to $50-75/BW",
    "Negotiate raise or start job search (10-20% switching premium)",
    "Net worth milestone: $40,000-50,000 by May 2028",
  ]},
  {ph:"Year 3-4 (Jun 2028 – May 2030)",c:"#4ade80",d:"t",items:[
    "Ring fund complete ~$5,200 — propose at 31-32",
    "Start home down payment fund $50/BW",
    "Start Ghana property fund $25/BW",
    "Check Roth IRA eligibility with CPA",
    "Net worth milestone: $100,000+ by May 2030",
  ]},
  {ph:"Year 5+ — Legacy",c:"#38bdf8",d:"t",items:[
    "Increase Ghana remittance to $400-500/mo",
    "Buy Tampa duplex — tenant pays your mortgage",
    "Open 529 education fund when first child born",
    "Ghana property / family home in Accra region",
    "Financial independence possible at age 50-55",
  ]},
];

// ─── Checklist Items ───────────────────────────────────────────────────────
// tg: tu=Week 1, t1=Year 1, t2=Year 2, t3=Year 3+
const CHECKLIST_ITEMS = [
  {t:"Open Ally Bank HYSA",d:"4-5% APY. Emergency fund + ring-fence $1,500 Ghana emergency travel.",tg:"tu"},
  {t:"Open Fidelity Brokerage",d:"Zero-fee index funds. Buy VOO or VTI every payday.",tg:"tu"},
  {t:"Download Lemfi app",d:"Ghana remittance. Fees 0-1% vs Western Union 5-8%.",tg:"tu"},
  {t:"Ask HR about 401k match",d:"Free money. Contribute minimum to capture full employer match Day 1.",tg:"tu"},
  {t:"Ask HR about HSA",d:"If employer offers HDHP, open HSA. Triple tax advantage.",tg:"tu"},
  {t:"Fill in health insurance line",d:"HR tells you your deduction. Update the $0 line immediately.",tg:"tu"},
  {t:"Apply for term life insurance",d:"Policygenius.com. 20 minutes. ~$25/mo. Name Ghana family as beneficiary.",tg:"tu"},
  {t:"Apply for renters insurance",d:"Lemonade.com. ~$15/mo. Covers laptop, phone, furniture.",tg:"tu"},
  {t:"Apply for SSN",d:"Social Security Administration. Required for employment and accounts.",tg:"tu"},
  {t:"Name beneficiaries on every account",d:"HYSA, brokerage, life insurance. Without this family sees nothing.",tg:"tu"},
  {t:"Open secured credit card",d:"Discover Secured ($300 deposit). 1 sub charged, paid in full monthly. 740+ score in 2 yrs.",tg:"t1"},
  {t:"Set up Personal Capital",d:"Free net worth tracker. Connect all accounts. Check monthly.",tg:"t1"},
  {t:"Book immigration attorney consultation",d:"$150-300 one-time. Confirm STEM OPT and H1B timeline.",tg:"t1"},
  {t:"Join a gym",d:"Planet Fitness Tampa = $10/mo. Health = energy = career performance.",tg:"t1"},
  {t:"File 1040-NR with Sprintax (April 2027)",d:"NOT TurboTax. Also file Form 8843. Deadline April 15 2027.",tg:"t1"},
  {t:"Build emergency fund to $15,000",d:"$250/BW → ~23 months. Ally HYSA. Ring-fence $1,500 within it.",tg:"t1"},
  {t:"Fund H1B legal fund to $3,000",d:"$115/BW → Month 12-13. Retain attorney 3 months before OPT expires.",tg:"t1"},
  {t:"Negotiate first raise",d:"Year 1 anniversary. Aim 8-12%. If denied, start job search.",tg:"t2"},
  {t:"Start wedding fund increase",d:"Once emergency fund complete, increase to $50-75/BW.",tg:"t2"},
  {t:"Have the Ghana conversation with partner",d:"$300/mo remittance is a household obligation. Must happen before engagement.",tg:"t2"},
  {t:"Start Ghana property fund",d:"Year 3+. $25/BW. Land or family home. Your legacy.",tg:"t3"},
  {t:"Start home down payment fund",d:"Year 3+. $50/BW. Tampa ~$480K. Need ~$58K.",tg:"t3"},
  {t:"Check Roth IRA eligibility",d:"Once Green Card or pass Substantial Presence Test. Max $7K/yr tax-free.",tg:"t3"},
  {t:"Buy a Tampa duplex",d:"Live in one unit, rent the other. Tenant pays mortgage.",tg:"t3"},
];

// ─── Dating Section Data ───────────────────────────────────────────────────
const DATING_BUDGET = [
  {tag:"Monthly recurring",tit:"Regular Dates",bud:"$163/mo",note:"2-3 dates/month. Bayshore walk, Ybor City, dinner, Armature Works."},
  {tag:"Monthly recurring",tit:"Everyday Romance",bud:"$25/mo",note:"Surprise coffee, flowers, handwritten notes. The details she remembers most."},
  {tag:"Biweekly saving",tit:"Special Occasions Fund",bud:"$25/BW → $650/yr",note:"Birthday, Valentine's, anniversary, Christmas. Never scramble last-minute."},
  {tag:"Long-term saving",tit:"Engagement Ring Fund",bud:"$50/BW → $5,200 in 4 yrs",note:"Moissanite = $1,500-3,000. Lab diamond = $2,000-4,000. Age 32 = ready."},
  {tag:"Long-term saving",tit:"Wedding Fund",bud:"$25/BW → $650/yr",note:"Tampa modest wedding $8-12K. Start Day 1."},
];

const DATING_OCCASIONS = [
  {tag:"Annual",tit:"Valentine's Day (Feb 14)",bud:"$100",note:"Rooftop dinner downtown Tampa, sunset picnic on Bayshore."},
  {tag:"Annual",tit:"Her Birthday",bud:"$120",note:"Plan 3 weeks ahead. Dinner + experience + personal gift."},
  {tag:"Annual",tit:"Your Birthday",bud:"$60",note:"Let her celebrate you. Contribute to the occasion."},
  {tag:"Annual",tit:"Christmas Gift",bud:"$100",note:"Thoughtful beats expensive. Experience gift outlasts any object."},
  {tag:"Annual",tit:"Anniversary",bud:"$120",note:"Recreate first date or something deeply meaningful."},
  {tag:"Year-round",tit:"Random Appreciation",bud:"$80/yr (6-8 times)",note:"Surprise flowers, snack, coffee delivery. No occasion needed."},
];

const DATING_FREE = [
  ["Bayshore Blvd Sunset Walk","$0","3.5 miles of waterfront. Tampa's most romantic free date."],
  ["Clearwater Beach","Gas+$20","30 min away. One of USA's best beaches."],
  ["Ybor City Night Out","$20","Cuban food, street murals, live music."],
  ["Tampa Riverwalk","$10-15","Walk the water, watch boats, get ice cream."],
  ["Picnic at Al Lopez Park","$15-20","Cook together, pack a basket. Shows you planned."],
  ["USF Botanical Gardens","$5-10","Beautiful, peaceful. Great early relationship date."],
  ["Museum of Art free nights","$0","Free Thursday evenings."],
  ["St. Pete Pier","$10-20","Waterfront, street food, 30 min away."],
  ["Sunrise at Ballast Point","$0","Watch sunrise over the bay. Unforgettable."],
  ["Kennedy Space Center","$60-80","3 hrs away. Save for special occasions."],
  ["Weekend Trip to Miami","$150-200","South Beach + Little Havana + Wynne Walls."],
  ["Orlando Theme Parks","$100-150","1 hr away. Universal or Disney once a year."],
];

const DATING_MARRIAGE = [
  {tag:"Year 1-4",tit:"Engagement Ring",bud:"$50/BW → ready at 32",note:"Moissanite or lab diamond. The ring is symbolic — the commitment is everything."},
  {tag:"Year 1+",tit:"Wedding Fund",bud:"$25/BW from Day 1",note:"Tampa wedding $8-12K. Ghanaian traditional adds more. Start early."},
  {tag:"Non-negotiable",tit:"The Family Conversation",bud:"$0 cost",note:"Your future wife must know: $300/mo goes to Ghana. Have this before you propose."},
  {tag:"Pre-marriage",tit:"Pre-Marital Counseling",bud:"~$400 or free via church",note:"Many Tampa churches offer free sessions. Do it regardless."},
  {tag:"Year 3+",tit:"Home Down Payment",bud:"$50/BW from Year 3",note:"Tampa ~$480K median. Need ~$58K. Build equity not landlord's wealth."},
];

// ─── Ghana Long-term Plan ──────────────────────────────────────────────────
const GHANA_PLAN = [
  {e:'🏠',t:'Ghana property fund (Year 3+)',d:"$25-50/BW. Accra land $10K-50K. $25/BW = $13,000 in 10 years. Your legacy."},
  {e:'📈',t:'Increase remittance as income grows',d:"When you get a raise, increase to $400-500/mo. Your family carried you. Carry them."},
  {e:'🎓',t:'Sibling development — firstborn obligation',d:"$15/BW = $390/yr dedicated. School fees, startup capital. Structured answer when the call comes."},
  {e:'✈️',t:'Ghana visits — planned not emergency',d:"$75/BW = $1,950/yr. TPA→ACC ~$900-1,400. In-country ~$300-500. Visit every 18 months."},
];
