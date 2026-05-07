// src/app/landing/features/features.metadata.ts
// UPDATED: Treasury now includes AI features showcase

export interface BenefitCard {
    icon: string;
    title: string;
    desc: string;
}

export interface WorkflowStep {
    number: number;
    title: string;
    desc: string;
}

export interface AIFeature {
    icon: string;
    title: string;
    desc: string;
    tech?: string; // e.g., "Gemini 2.0 + RAG" or "Isolation Forest"
}

export interface FeatureData {
    id: 'voice' | 'treasury' | 'elections' | 'events' | 'comms' | 'members';
    icon: string;
    title: string;
    shortDesc: string;

    // Hero section
    badge: string;
    heroHeading: string;
    heroSubheading: string;

    // Benefits section
    benefits: BenefitCard[];

    // Workflow section
    workflowTitle: string;
    workflowSteps: WorkflowStep[];

    // AI Features (optional, specific to Treasury)
    aiFeatures?: AIFeature[];

    // CTA
    ctaText: string;
}

export const FEATURES: Record<string, FeatureData> = {
    voice: {
        id: 'voice',
        icon: '🎙️',
        title: 'Voice Communication',
        shortDesc: 'Private live voice rooms for your club with automatic AI moderation that understands English, French, and Tunisian Arabic.',

        badge: 'Real-Time Voice + Smart Safety',
        heroHeading: 'Talk live with your club.\nStay safe automatically.',
        heroSubheading: 'No more chaotic WhatsApp voice notes or unsafe calls. ClubHub gives your club private voice rooms where members can talk live — with intelligent AI that protects everyone.',

        benefits: [
            {
                icon: '🎙️',
                title: 'Voice Rooms for Your Club',
                desc: 'Create dedicated voice spaces for different needs — Executive Board meetings, general discussions, event planning, or casual hangouts. Members join with one click and talk live, just like being in the same room.'
            },
            {
                icon: '🛡️',
                title: 'AI That Keeps Things Respectful',
                desc: 'Every voice message is automatically reviewed in real time. Our AI understands English, French, and Tunisian Arabic — even when people mix languages. It flags inappropriate content so your bureau can review and take action quickly, keeping your club space safe and welcoming for everyone.'
            },
            {
                icon: '📜',
                title: 'Clear History & Easy Moderation',
                desc: 'All voice messages are saved securely. Bureau members can listen back, review AI flags, issue warnings, or hide inappropriate content from regular members — while everything stays transparent for leaders.'
            }
        ],

        workflowTitle: 'How Club Members Experience It',
        workflowSteps: [
            {
                number: 1,
                title: 'Open a voice room',
                desc: 'President or bureau creates a room for the day\'s meeting or casual chat'
            },
            {
                number: 2,
                title: 'Join and talk live',
                desc: 'Members click to join and speak naturally — no complicated setup'
            },
            {
                number: 3,
                title: 'Feel safe & supported',
                desc: 'AI watches in the background. Any issue is quietly flagged for review'
            }
        ],

        ctaText: 'Start your club\'s safe voice space — free'
    },

    treasury: {
        id: 'treasury',
        icon: '💰',
        title: 'Treasury',
        shortDesc: 'Track dues, expenses, and budgets with approvals and beautiful reports. AI detects anomalies and predicts payment delays.',

        badge: 'Financial Intelligence + Compliance',
        heroHeading: 'Stop managing club money in spreadsheets.\nGain real financial control.',
        heroSubheading: 'Dues, expenses, budgets, and approvals — all transparent and audit-ready. Your treasurer gets powerful tools. Your members see exactly where the money goes. AI helps spot problems before they happen.',

        benefits: [
            {
                icon: '💵',
                title: 'Track Dues & Payments',
                desc: 'Automatic reminders, payment tracking, and beautiful member statements. Support multiple payment methods: Stripe cards, cash with digital receipts. Reduce late payments and confusion about who\'s paid what.'
            },
            {
                icon: '📊',
                title: 'Budget Planning & Forecasting',
                desc: 'Set spending limits, plan major expenses, and see your club\'s financial health at a glance. AI predicts budget trends 3 months ahead. Prevent overspending and surprise deficits.'
            },
            {
                icon: '✅',
                title: 'Approval Workflows',
                desc: 'Every expense requires 3 quotes for validation, treasurer approval, then president sign-off. Auto-categorization by AI (8 categories). Everything is logged and auditable.'
            },
            {
                icon: '🔍',
                title: 'Anomaly Detection',
                desc: 'AI continuously monitors for unusual spending patterns. Isolation Forest algorithm trained locally detects fraud and errors automatically. Get flagged before problems escalate.'
            },
            {
                icon: '⚠️',
                title: 'Predict Late Payers',
                desc: 'Machine learning model predicts which members are likely to pay late based on historical patterns. Proactive reminders reduce delinquency. 90%+ accuracy.'
            },
            {
                icon: '📈',
                title: 'Beautiful Reports & PDFs',
                desc: 'Export annual statements, budget reports, spending breakdowns, and payment receipts. Professional formatting. Impress sponsors and show institutional accountability.'
            }
        ],

        aiFeatures: [
            {
                icon: '🤖',
                title: 'Treasury Chatbot',
                desc: 'Ask questions about club finances in natural language. "What did we spend on events last month?" Powered by Gemini 2.0 with real-time data access.',
                tech: 'Gemini 2.0 + RAG'
            },
            {
                icon: '🔮',
                title: '3-Month Budget Forecast',
                desc: 'AI predicts future spending and revenue trends. Plan ahead with confidence. Linear regression + contextual analysis.',
                tech: 'Gemini + ML'
            },
            {
                icon: '🚨',
                title: 'Anomaly Detection Engine',
                desc: '7 machine learning features. 200-tree ensemble. Detects fraud and errors with 7/7 accuracy on test data. Weekly retraining.',
                tech: 'Isolation Forest'
            },
            {
                icon: '👤',
                title: 'Payment Delay Prediction',
                desc: 'Predict which members will pay late. 100 trees, 90.5% accuracy. Act before delinquency starts.',
                tech: 'Random Forest'
            },
            {
                icon: '🏷️',
                title: 'Auto-Categorization',
                desc: 'Every expense automatically categorized into 8 types (Transport, Food, Materials, etc). No manual tagging needed.',
                tech: 'Gemini Analysis'
            }
        ],

        workflowTitle: 'From Chaos to Clarity',
        workflowSteps: [
            {
                number: 1,
                title: 'Set dues & budgets',
                desc: 'Treasurer defines club dues, spending limits, and budget categories'
            },
            {
                number: 2,
                title: 'Members pay, system tracks',
                desc: 'Members pay dues through the platform. Every transaction is recorded and confirmed via PDF receipt.'
            },
            {
                number: 3,
                title: 'Leadership approves spending',
                desc: 'Officers review quotes, select vendors, approve expenses. Everything is transparent and auditable.'
            }
        ],

        ctaText: 'Manage your club\'s finances professionally — free'
    },

    elections: {
        id: 'elections',
        icon: '🗳️',
        title: 'Elections',
        shortDesc: 'Secure, anonymous voting with real-time results and automatic officer transitions.',

        badge: 'Democratic + Transparent + Auditable',
        heroHeading: 'Hold fair elections your members trust.\nAutomate officer transitions.',
        heroSubheading: 'Anonymous voting. Verifiable results. Zero disputes. ClubHub handles leadership elections so members feel heard and transitions are seamless.',

        benefits: [
            {
                icon: '🗳️',
                title: 'Anonymous, Tamper-Proof Voting',
                desc: 'Members vote anonymously. Results are cryptographically verified. No vote manipulation, no disputes about fairness.'
            },
            {
                icon: '📊',
                title: 'Real-Time Results & Transparency',
                desc: 'Members can watch votes come in live (anonymously aggregated). Elected officers are announced immediately. No secrets, no waiting.'
            },
            {
                icon: '🔄',
                title: 'Automatic Role Transitions',
                desc: 'When elections end, newly elected officers are automatically promoted. Old officers\' permissions are revoked. Your leadership structure stays fresh.'
            },
            {
                icon: '📋',
                title: 'Election Records & Audits',
                desc: 'Every election is logged. Export results, voter lists, and timelines for institutional records or future disputes.'
            }
        ],

        workflowTitle: 'Democratic Leadership Made Simple',
        workflowSteps: [
            {
                number: 1,
                title: 'Bureau sets election rules',
                desc: 'Define positions, candidate requirements, and voting dates'
            },
            {
                number: 2,
                title: 'Members nominate & vote',
                desc: 'Candidates campaign. Members vote anonymously for who they want.'
            },
            {
                number: 3,
                title: 'New officers take office',
                desc: 'Results announced. Roles automatically updated. Your club has fresh leadership.'
            }
        ],

        ctaText: 'Hold your next election fairly — free'
    },

    events: {
        id: 'events',
        icon: '📅',
        title: 'Events Management',
        shortDesc: 'Beautiful event pages, RSVPs, reminders, and attendance tracking that actually gets used.',

        badge: 'Engagement + Attendance + Community',
        heroHeading: 'Turn club events into member engagement.\nNo more ghost RSVPs.',
        heroSubheading: 'Beautiful event pages. Smart reminders. Live attendance tracking. Watch your attendance rates jump and members actually show up.',

        benefits: [
            {
                icon: '📅',
                title: 'Event Pages Members Love',
                desc: 'Rich event pages with photos, descriptions, location maps, and ticket info. Members see what they\'re signing up for and get excited.'
            },
            {
                icon: '✋',
                title: 'Smart RSVP & Reminders',
                desc: 'Members RSVP with one click. Automatic reminders before the event. Reduce no-shows and increase actual attendance.'
            },
            {
                icon: '📍',
                title: 'Real-Time Attendance Tracking',
                desc: 'Check in members at events with QR codes or manual check-in. Know exactly who showed up. Measure engagement.'
            },
            {
                icon: '📸',
                title: 'Post-Event Sharing',
                desc: 'Share photos, highlights, and attendance data with your club. Build community memories and celebrate what you did together.'
            }
        ],

        workflowTitle: 'From Planning to Memories',
        workflowSteps: [
            {
                number: 1,
                title: 'Create event',
                desc: 'President posts event with date, location, and details'
            },
            {
                number: 2,
                title: 'Members discover & RSVP',
                desc: 'Members see event, RSVP, and get reminders'
            },
            {
                number: 3,
                title: 'Check in & celebrate',
                desc: 'Check in attendees. Share photos and memories with the club.'
            }
        ],

        ctaText: 'Make your club events memorable — free'
    },

    comms: {
        id: 'comms',
        icon: '📢',
        title: 'Internal Communication',
        shortDesc: 'Targeted announcements, channels, and read receipts — no more WhatsApp noise.',

        badge: 'Organized + Signal-to-Noise Free',
        heroHeading: 'End WhatsApp group chaos.\nCommunicate like a real organization.',
        heroSubheading: 'Targeted announcements. Organized channels. Read receipts. Officers communicate clearly. Members stay informed. No more spam, no more missed messages.',

        benefits: [
            {
                icon: '📢',
                title: 'Targeted Announcements',
                desc: 'Send messages to specific groups (new members, core team, everyone). Members only see what\'s relevant to them. Less noise, more signal.'
            },
            {
                icon: '#️⃣',
                title: 'Organized Channels',
                desc: 'Separate channels for different topics: #announcements, #events, #general, #elections. Organized conversations. Easy to find later.'
            },
            {
                icon: '✅',
                title: 'Read Receipts & Engagement',
                desc: 'Know who saw your announcement. Leaders can verify important messages were read by quorum before decisions.'
            },
            {
                icon: '🔍',
                title: 'Searchable Message History',
                desc: 'Find old announcements, meeting summaries, and important decisions. Your club\'s memory is preserved and searchable.'
            }
        ],

        workflowTitle: 'Professional Communications Flow',
        workflowSteps: [
            {
                number: 1,
                title: 'Organize channels',
                desc: 'Leaders set up channels for different purposes and member groups'
            },
            {
                number: 2,
                title: 'Officers broadcast smartly',
                desc: 'Send targeted messages to specific groups instead of blasting everyone'
            },
            {
                number: 3,
                title: 'Members stay informed',
                desc: 'Members see organized, relevant updates. Read receipts show leaders what\'s been seen.'
            }
        ],

        ctaText: 'Upgrade your club communications — free'
    },

    members: {
        id: 'members',
        icon: '👥',
        title: 'Members Management',
        shortDesc: 'Profiles, roles, directories, and smart onboarding flows.',

        badge: 'Organization + Clarity + Growth',
        heroHeading: 'Know everyone in your club.\nManage roles like a real team.',
        heroSubheading: 'Member profiles. Role management. Beautiful directory. Smooth onboarding. Your club stays organized even as it grows.',

        benefits: [
            {
                icon: '👤',
                title: 'Member Profiles',
                desc: 'Everyone has a profile: name, role, contact info, join date. Beautiful directory so members know each other.'
            },
            {
                icon: '🔑',
                title: 'Role Management',
                desc: 'Assign roles: President, Treasurer, Officer, Member. Control who can do what. Permissions are clear and automatic.'
            },
            {
                icon: '🎯',
                title: 'Onboarding Flows',
                desc: 'New members go through a guided onboarding. They see the rules, meet officers, and get set up in seconds.'
            },
            {
                icon: '📊',
                title: 'Engagement Insights',
                desc: 'See which members are active, who\'s engaged, who\'s silent. Take action to keep everyone involved.'
            }
        ],

        workflowTitle: 'From Signup to Active Member',
        workflowSteps: [
            {
                number: 1,
                title: 'Member joins',
                desc: 'New member signs up and gets assigned to the club'
            },
            {
                number: 2,
                title: 'Guided onboarding',
                desc: 'They complete onboarding: rules, meet leadership, get oriented'
            },
            {
                number: 3,
                title: 'Assign roles & engage',
                desc: 'Leaders assign roles. Member can now fully participate in club life.'
            }
        ],

        ctaText: 'Organize your members professionally — free'
    }
};

export function getFeature(id: string): FeatureData | undefined {
    return FEATURES[id];
}

export function getAllFeatures(): FeatureData[] {
    return Object.values(FEATURES);
}

export function getRelatedFeatures(featureId: string, count: number = 2): FeatureData[] {
    const allFeatures = getAllFeatures();
    const currentIndex = allFeatures.findIndex(f => f.id === featureId);
    const related = [];

    // Get features after the current one
    for (let i = 1; i <= count && currentIndex + i < allFeatures.length; i++) {
        related.push(allFeatures[currentIndex + i]);
    }

    // If we don't have enough, wrap around to the beginning
    if (related.length < count) {
        for (let i = 0; i < allFeatures.length && related.length < count; i++) {
            if (i !== currentIndex) {
                related.push(allFeatures[i]);
            }
        }
    }

    return related;
}