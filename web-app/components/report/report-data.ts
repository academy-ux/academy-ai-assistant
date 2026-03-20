export interface Slide {
  id: string
  chapter: string
  chapterNumber?: number
  title: string
  subtitle?: string
  type: 'cover' | 'section-divider' | 'section-header' | 'two-column' | 'stats-grid' | 'market-stats' | 'table' | 'quote' | 'cards-grid' | 'three-tier' | 'company-profiles' | 'recommendations' | 'closing'
  titleSecondary?: string
  dark?: boolean
  content: SlideContent
}

export interface StatCard {
  label: string
  value: string
  description: string
}

export interface CompanyRow {
  company: string
  role: string
  salary: string
}

export interface CompanyProfile {
  name: string
  headline: string
  details: string[]
}

export interface Recommendation {
  title: string
  description: string
  timing: string
}

export interface TierCard {
  tier: string
  label: string
  description: string
}

export interface SlideContent {
  leftText?: string
  rightText?: string
  rightList?: string[]
  stats?: StatCard[]
  bigNumber?: string
  bigNumberLabel?: string
  secondaryNumber?: string
  secondaryLabel?: string
  bodyText?: string
  quote?: string
  attribution?: string
  attributionTitle?: string
  companies?: CompanyRow[]
  profiles?: CompanyProfile[]
  recommendations?: Recommendation[]
  tiers?: TierCard[]
  cards?: { title: string; description: string }[]
  bullets?: string[]
  jdMoves?: { title: string; description: string }[]
  patterns?: { label: string; description: string }[]
  nextSteps?: { title: string; description: string }[]
}

export const reportMeta = {
  title: 'Talent Intelligence Report: AI & UX Design',
  confidential: 'Academy UX | Confidential',
  date: 'March 2026',
  tagline: 'AI & the evolution of UX design',
  audience: 'Market insights for Google UX leadership',
}

export const slides: Slide[] = [
  // ── COVER ──
  {
    id: 'cover',
    chapter: 'Intro',
    title: 'Talent Intelligence\nReport',
    titleSecondary: '2026',
    type: 'cover',
    content: {
      leftText: reportMeta.tagline,
      rightText: reportMeta.audience,
    },
  },

  // ── EXECUTIVE SUMMARY ──
  {
    id: 'executive-summary',
    chapter: 'Executive Summary',
    chapterNumber: 0,
    title: 'Executive summary',
    type: 'two-column',
    content: {
      leftText: 'The UX design profession is undergoing its most significant transformation since the shift from graphic design to digital product design.\n\nAI is not replacing designers. It is fundamentally reshaping what the role demands, how teams are structured, and where competitive advantage lies.',
      rightText: 'This report provides Google\'s UX leadership with a data-driven view of the external talent landscape, focusing on three critical areas:',
      rightList: [
        'How AI is redefining design roles',
        'What competitors are doing to attract and retain AI-capable design talent',
        'Where the market is headed over the next 12–18 months',
      ],
    },
  },

  // ── KEY FINDINGS ──
  {
    id: 'key-findings',
    chapter: 'Executive Summary',
    title: 'Key findings',
    titleSecondary: 'at a glance',
    type: 'stats-grid',
    content: {
      stats: [
        { label: 'Hiring freefall', value: '', description: 'UX job postings fell 71%, UX research postings dropped 89% from 2022 peaks' },
        { label: 'Uneven recovery', value: '', description: 'Market stabilizing in 2026 but recovery favors senior generalists over specialists' },
        { label: 'AI adoption', value: '', description: '93% of designers now use generative AI tools as part of their daily workflow' },
        { label: 'Premium pay', value: '', description: 'AI labs like Anthropic paying $385K–$460K base for Product Designers' },
        { label: 'Hybrid roles', value: '', description: 'Design engineer roles now command senior software engineer compensation levels' },
        { label: 'New specialization', value: '', description: '"AI-native designer" emerging as a genuinely new role designing interaction paradigms for AI' },
      ],
    },
  },

  // ── SECTION DIVIDER: STATE OF PLAY ──
  {
    id: 'divider-state-of-play',
    chapter: 'State of Play',
    chapterNumber: 1,
    title: 'State of play',
    type: 'section-divider',
    dark: true,
    content: {},
  },

  // ── STATE OF PLAY: MARKET ──
  {
    id: 'market-recovery',
    chapter: 'State of Play',
    title: 'Market recovery\nafter the great\ncontraction',
    subtitle: 'The UX hiring market',
    type: 'market-stats',
    content: {
      bodyText: 'Heading into 2026, supply still outpaces open roles, especially at junior level. Senior practitioners and generalists with cross-functional skills see significantly stronger demand.',
      stats: [
        { label: '-71%', value: '-71%', description: 'UX designer job postings fell from 2022 peaks, per Indeed. Design and product teams were among the first cut across Big Tech, startups, and fintech.' },
        { label: '-89%', value: '-89%', description: 'UX research postings dropped even harder, nearly disappearing from major job boards between 2022 and 2024.' },
        { label: 'Uneven', value: 'Uneven', description: 'Nielsen Norman Group\'s State of UX 2026 describes a "competitive" market. Recovery favors senior generalists over junior specialists.' },
      ],
    },
  },

  // ── WHO'S HIRING ──
  {
    id: 'whos-hiring',
    chapter: 'State of Play',
    title: 'Who\'s hiring and for what',
    subtitle: '70% plan to hire in 2025. 189 new roles.',
    type: 'cards-grid',
    content: {
      cards: [
        { title: 'AI-integrated design', description: 'Designers fluent in non-deterministic systems, conversational interfaces, and agentic workflows' },
        { title: 'Accessibility specialists', description: 'Driven by regulatory pressure and genuine user need across products' },
        { title: 'Full-stack generalists', description: 'Design craft paired with research capability, technical fluency, and product mindset' },
      ],
    },
  },

  // ── COMPENSATION ──
  {
    id: 'compensation',
    chapter: 'State of Play',
    title: 'Compensation\nbenchmarks',
    subtitle: 'Annual base salary in USD. Total comp (equity, bonuses) can be significantly higher.',
    type: 'table',
    content: {
      companies: [
        { company: 'Anthropic', role: 'Product Designer', salary: '$385K–$460K' },
        { company: 'Vercel', role: 'Design Engineer', salary: '$196K–$294K' },
        { company: 'Stripe', role: 'Design Engineer', salary: '$146K–$220K' },
        { company: 'Cursor', role: 'Design Engineer', salary: 'Not disclosed' },
        { company: 'Lovable', role: 'Design Engineer', salary: 'Not disclosed' },
        { company: 'Intercom', role: 'Sr. Product Designer', salary: 'Not disclosed' },
        { company: 'Miro', role: 'Staff Product Designer', salary: 'Not disclosed' },
      ],
    },
  },

  // ── SECTION DIVIDER: ROLE EVOLUTION ──
  {
    id: 'divider-role-evolution',
    chapter: 'Role Evolution',
    chapterNumber: 3,
    title: 'The role\nevolution',
    type: 'section-divider',
    dark: true,
    content: {},
  },

  // ── ROLE EVOLUTION ──
  {
    id: 'role-evolution',
    chapter: 'Role Evolution',
    title: 'The product designer\nin 2026.',
    titleSecondary: 'From maker\nof outputs to director\nof intent.',
    type: 'two-column',
    content: {
      leftText: 'What organizations now expect',
      bullets: [
        'Understand business strategy, operational constraints, and AI capabilities',
        'Use AI as a creative collaborator — 93% of designers now use generative AI',
        'Design for AI systems: conversational interfaces, agentic workflows, trust patterns',
      ],
      rightText: 'The rise of the "new generalist"',
      rightList: [
        'Expected expertise across visual, interaction, research, UX, and code',
        'Anthropic, Cursor, and Intercom already writing JDs for this profile',
        'Shift from hands-on executor to strategic decision-maker and curator',
      ],
    },
  },

  // ── DESIGN ENGINEERS ──
  {
    id: 'design-engineers',
    chapter: 'Role Evolution',
    title: 'Design engineers',
    type: 'quote',
    content: {
      bodyText: 'The traditional handoff between designers and engineers creates quality compromises and slows velocity. Design engineers eliminate this gap, designing and building experiences end-to-end.\n\nVercel, Linear, and Replit are early adopters. Compensation reflects the scarcity: $196K–$294K base, matching or exceeding senior software engineer pay.',
      quote: 'Design decisions are already made at the implementation stage... there\'s a term called a vibe coder, where you can prompt and build entire products.',
      attribution: 'Ryo Lu',
      attributionTitle: 'Head of Design at Cursor',
    },
  },

  // ── AI-NATIVE DESIGN ──
  {
    id: 'ai-native-design',
    chapter: 'Role Evolution',
    title: 'AI-native design is\na new specialization',
    type: 'two-column',
    content: {
      leftText: 'Not a product designer who uses Figma AI. The AI-native designer specializes in creating experiences for AI products themselves — interactions without established conventions.\n\nAnthropic seeks designers who are "AI-native in how they work," excited to question fundamental assumptions and invent patterns native to AI.',
      rightText: 'Intercom\'s VP of Design created specialist "AI designer" roles — 3 of 20 product designers who work directly with ML scientists on model prompting and output evaluation. He calls it "almost a new craft."\n\nChris Pucket (Stripe) adds that intellectual humility and willingness to question assumptions is the key marker to screen for.',
    },
  },

  // ── SECTION DIVIDER: COMPETITIVE INTEL ──
  {
    id: 'divider-competitive',
    chapter: 'Competitive Intelligence',
    chapterNumber: 4,
    title: 'Competitive\nintelligence',
    subtitle: 'What your competitors are doing',
    type: 'section-divider',
    dark: true,
    content: {},
  },

  // ── COMPETITIVE INTEL ──
  {
    id: 'competitive-intel',
    chapter: 'Competitive Intelligence',
    title: 'The AI lab talent war',
    subtitle: 'Seven companies redefining how they attract AI design talent. The war is won on narrative, not just compensation.',
    type: 'company-profiles',
    content: {
      profiles: [
        { name: 'OpenAI', headline: 'Hiring Product Designers for ChatGPT.', details: ['Windsurf acquisition signals intent to own the full AI creation stack', '"Forward Deployed Engineer" role is essentially a designer\'s job performed by engineers'] },
        { name: 'Anthropic', headline: '$385K–$460K base.', details: ['Five distinct product areas', 'Explicitly seeking "AI-native" candidates', 'Strong community momentum around Claude among designers'] },
        { name: 'Vercel', headline: 'Design engineering at $196K–$294K.', details: ['Exceptional at attracting designers who apply design engineering through v0, Next.js, and AI SDK'] },
        { name: 'Intercom', headline: 'Every designer ships code to production.', details: ['VP Connolly\'s mandate', 'Specialist AI designer roles work directly with ML scientists', 'Craft-first hiring'] },
        { name: 'Cursor', headline: 'No salary or experience listed.', details: ['Leanest listing', 'Pure mission pitch: "Building the future of coding"'] },
        { name: 'Miro', headline: '"AI Native Designer" at Staff level.', details: ['Product area framed as "your own startup within Miro"', 'Autonomy as the recruiting hook'] },
        { name: 'Stripe', headline: 'Design Engineers at $146K–$220K.', details: ['Creative portfolio requirements', '"webGL experiments, CSS art, or anything else"', 'Craft over credentials'] },
      ],
    },
  },

  // ── BIG TECH RESHUFFLING ──
  {
    id: 'big-tech',
    chapter: 'Competitive Intelligence',
    title: 'Big tech is reshuffling\ndesign leadership',
    type: 'two-column',
    content: {
      leftText: 'Meta\'s aggressive move\n\nMeta poached Alan Dye, Apple\'s Human Interface Design chief, to lead a new creative studio within Reality Labs. Packages reportedly worth tens of millions annually, signaling how high the stakes are for top design talent.',
      rightText: 'Apple in transition\n\nJohn Giannandrea (SVP of ML/AI) retiring spring 2026. Alan Dye replaced by Stephen Lemay. Multiple leadership gaps at once.\n\nFor Google, this is a window. Top talent may be open to new options, and Gemini\'s platform narrative is compelling.',
    },
  },

  // ── SECTION DIVIDER: AI IN JDs ──
  {
    id: 'divider-ai-jds',
    chapter: 'AI in Job Descriptions',
    chapterNumber: 5,
    title: 'AI in job descriptions',
    subtitle: 'The three-tier framework',
    type: 'section-divider',
    dark: true,
    content: {},
  },

  // ── THREE-TIER FRAMEWORK ──
  {
    id: 'three-tier',
    chapter: 'AI in Job Descriptions',
    title: 'The spectrum of\nAI integration',
    subtitle: 'Current UX job postings reveal three tiers of AI expectations. Google should calibrate descriptions to attract Tier 2 and Tier 3 candidates.',
    type: 'three-tier',
    content: {
      tiers: [
        { tier: 'Tier 1', label: 'AI-Aware', description: 'AI as a nice-to-have. No fundamental change to the role. Most common in current job postings.' },
        { tier: 'Tier 2', label: 'AI-Integrated', description: 'Designers build AI features and use AI tools daily. Where forward-thinking companies are landing.' },
        { tier: 'Tier 3', label: 'AI-Native', description: 'Inventing new interaction paradigms. Only a handful of companies like Anthropic and OpenAI hire at this level.' },
      ],
    },
  },

  // ── REWRITE JDs ──
  {
    id: 'rewrite-jds',
    chapter: 'AI in Job Descriptions',
    title: 'Rewrite job\ndescriptions.',
    subtitle: 'Three moves to win AI design talent.',
    type: 'cards-grid',
    content: {
      cards: [
        { title: 'Lead with AI mission', description: 'Top candidates want to define new interaction paradigms. Emphasize Gemini\'s scale and global reach. Frame the role around shaping how billions interact with AI.' },
        { title: 'Specify AI design challenges', description: 'Replace generic "design for AI products" language. Name real problems: trust calibration, agentic workflows. Call out multimodal interaction and conversational UX.' },
        { title: 'Value AI-native practice', description: 'Follow Anthropic\'s lead on this expectation. State you value candidates who use AI in their design process. Signal that the team already works this way.' },
      ],
    },
  },

  // ── CROSS-CUTTING PATTERNS ──
  {
    id: 'cross-cutting',
    chapter: 'Patterns',
    chapterNumber: 6,
    title: 'Cross-cutting patterns',
    subtitle: 'What seven job listings reveal',
    type: 'stats-grid',
    content: {
      stats: [
        { label: '"Taste" is the filter', value: '', description: 'Portfolios, shipped work, and side projects matter more than traditional process case studies' },
        { label: 'Two engineer archetypes', value: '', description: 'Web/Brand (Vercel, Stripe, Lovable) for storytelling vs. Product (Cursor) for building UI' },
        { label: 'Seniority skews high', value: '', description: 'Anthropic requires 8+ years, Miro 10+, Vercel 5+. The AI design talent pool is senior-heavy' },
        { label: 'Mission over benefits', value: '', description: 'Cursor\'s no-salary listing is highly coveted. "What you\'ll build" outperforms "what we\'ll give you"' },
        { label: 'Multi-tool fluency', value: '', description: 'No single-tool commitment expected. The design tool ecosystem is fluid and ever-changing' },
        { label: 'Show, don\'t tell', value: '', description: 'Shipped work and interactive portfolios win. Companies want to see things move, not static decks' },
      ],
    },
  },

  // ── SECTION DIVIDER: CASE STUDIES ──
  {
    id: 'divider-case-studies',
    chapter: 'Case Studies',
    chapterNumber: 6,
    title: 'Case studies',
    type: 'section-divider',
    dark: true,
    content: {},
  },

  // ── CASE STUDY: INTERCOM ──
  {
    id: 'case-intercom',
    chapter: 'Case Studies',
    title: 'Intercom',
    type: 'quote',
    content: {
      bodyText: 'When Intercom built Fin, their AI agent, VP of Design Emmet Connolly restructured the entire team. Every product designer now ships code to production. Three specialists work directly with ML scientists on model behavior.\n\nThe management UI stays conventional. The AI layer is agentic. Designers bridge both.',
      quote: 'The designer who can go from idea to shipped feature without waiting for an engineering sprint is just faster.',
      attribution: 'Emmet Connolly',
      attributionTitle: 'VP of Design',
    },
  },

  // ── CASE STUDY: CHRIS PUCKET ──
  {
    id: 'case-pucket',
    chapter: 'Case Studies',
    title: 'Chris Pucket',
    subtitle: 'Designer at Stripe. Builder of Epilog.',
    type: 'quote',
    content: {
      bodyText: 'Pucket built a full journaling app using Claude Code in three weeks, alongside his day job. He calls it "permissionless building" — going from idea to working product without recruiting engineers.\n\nHe runs dedicated AI projects for cooking, fitness, and personal development. This daily AI fluency defines the AI-native profile top companies seek.',
      quote: 'The more I learn about this tech, the less I know. The most useful thing you can do is just be like, I don\'t know.',
      attribution: 'Chris Pucket',
      attributionTitle: 'Designer at Stripe',
    },
  },

  // ── SECTION DIVIDER: WHERE UX IS HEADED ──
  {
    id: 'divider-ux-headed',
    chapter: 'Where UX Is Headed',
    chapterNumber: 7,
    title: 'Where UX is headed',
    type: 'section-divider',
    dark: true,
    content: {},
  },

  // ── NN/g STATE OF UX ──
  {
    id: 'nng-state',
    chapter: 'Where UX Is Headed',
    title: 'NN/g State of UX 2026',
    subtitle: 'Design deeper to differentiate',
    type: 'cards-grid',
    content: {
      cards: [
        { title: 'UI is commoditizing', description: 'Design systems and AI standardize production. Value shifts to strategic thinking and systems design.' },
        { title: 'Trust is the problem', description: 'AI products demand transparency, user control, consistency, and graceful failure handling.' },
        { title: 'Adaptable generalists', description: 'Practitioners who treat UX as strategic problem solving will outperform deliverable-focused specialists.' },
      ],
    },
  },

  // ── DESIGN FOUNDER ──
  {
    id: 'design-founder',
    chapter: 'Where UX Is Headed',
    title: 'The rise of the\ndesign founder',
    type: 'two-column',
    content: {
      leftText: 'Risk: talent drain\n\nAI tools let top designers build, ship, and monetize products solo. The best AI-native talent may choose entrepreneurship over employment.\n\nChris Pucket\'s side project, a polished consumer app built alone, is a pattern that will accelerate fast.',
      rightText: 'Opportunity: scale\n\nGoogle can offer what startups can\'t: designing AI experiences for billions of users across Gemini\'s product surface.\n\nThe key is making the internal environment feel as enabling and fast as the solo-founder experience.',
    },
  },

  // ── SECTION DIVIDER: RECOMMENDATIONS ──
  {
    id: 'divider-recommendations',
    chapter: 'Recommendations',
    chapterNumber: 8,
    title: 'Recommendations',
    subtitle: 'What Google should do next',
    type: 'section-divider',
    dark: true,
    content: {},
  },

  // ── RECOMMENDATIONS: IMMEDIATE ──
  {
    id: 'recommendations-immediate',
    chapter: 'Recommendations',
    title: 'Immediate\nactions',
    type: 'recommendations',
    content: {
      recommendations: [
        { title: 'Audit job descriptions', description: 'Evaluate all open roles against the three-tier AI framework. Gemini-related roles should be Tier 2 minimum, key roles at Tier 3.', timing: 'Start this week' },
        { title: 'Launch design engineer roles', description: 'Add a "design engineer" title where front-end engineering intersects with UX. This hybrid role eliminates handoff friction and taps an overlooked talent pool.', timing: 'Within 30 days' },
        { title: 'Target displaced senior talent', description: 'Apple\'s leadership transitions and Meta\'s poaching campaign have senior designers in motion. Proactive outreach to unsettled talent could yield strong hires.', timing: 'Ongoing, start now' },
      ],
    },
  },

  // ── RECOMMENDATIONS: STRATEGIC ──
  {
    id: 'recommendations-strategic',
    chapter: 'Recommendations',
    title: 'Strategic\npositioning',
    type: 'recommendations',
    content: {
      recommendations: [
        { title: 'Lead with Gemini\'s mission', description: 'Top AI design talent cares less about compensation and more about defining how AI interactions work at planet scale. Make that the core recruiting message.', timing: 'Priority: recruiting messaging' },
        { title: 'Invest in trust design', description: 'NN/g identifies trust as the central AI design challenge. Prioritize candidates with experience in transparency design, trust patterns, and graceful AI failure states.', timing: 'Priority: hiring criteria' },
        { title: 'Bridge the knowledge gap', description: 'Equip UX recruiters and hiring managers with market intelligence to have informed candidate conversations and better assess AI design capability.', timing: 'Priority: internal enablement' },
      ],
    },
  },

  // ── CLOSING ──
  {
    id: 'closing',
    chapter: 'Next Steps',
    chapterNumber: 10,
    title: 'What\'s coming next',
    subtitle: 'Next report: April 2026',
    type: 'closing',
    content: {
      nextSteps: [
        { title: 'Role profiles', description: 'In-depth analysis of emerging AI-design hybrid positions' },
        { title: 'Interview frameworks', description: 'How to assess AI design capability in candidates' },
        { title: 'Talent pool mapping', description: 'Targeted mapping of the design engineer talent market' },
      ],
      bodyText: 'Let\'s discuss these findings in our live sync.\nAcademy UX — www.academyux.com',
    },
  },
]

export const chapters = Array.from(
  new Map(slides.filter(s => s.chapterNumber !== undefined).map(s => [s.chapter, s.chapterNumber!])).entries()
).map(([name, number]) => ({ name, number }))
