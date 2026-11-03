import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { hashPassword } from "../src/lib/auth/password";
import { closePool, pool } from "../src/lib/db";

/*
 * CreatorConnect demo dataset seeder.
 *
 * Safety:
 *   - Refuses to run outside a local MySQL host or against a production-looking
 *     database name.
 *   - Only INSERTs new rows. It never UPDATEs, DELETEs, TRUNCATEs or resets.
 *   - Runs in one transaction and rolls back on failure.
 *   - Idempotent: every entity is looked up by a stable natural key before insert.
 *
 * Run with:
 *   npm run db:seed-demo
 */

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD?.trim() || "DemoConnect!2026";
const DEMO_EMAIL_DOMAIN = "demo.creatorconnect.local";
const SELECTED_CREATOR_USERNAME =
  process.env.DEMO_CREATOR_USERNAME?.trim() || "shetty_shibi";

const PRESERVED_TABLES = [
  ["users", "user_id"],
  ["creators", "creator_id"],
  ["creator_social_accounts", "account_id"],
  ["brands", "brand_id"],
  ["campaign_categories", "category_id"],
  ["campaigns", "campaign_id"],
  ["campaign_requirements", "requirement_id"],
  ["applications", "application_id"],
  ["collaborations", "collaboration_id"],
  ["deliverables", "deliverable_id"],
  ["content_submissions", "submission_id"],
  ["contracts", "contract_id"],
  ["payments", "payment_id"],
  ["performance_metrics", "metric_id"],
  ["reviews", "review_id"],
] as const;

type Platform =
  | "Instagram"
  | "YouTube"
  | "LinkedIn"
  | "Twitter"
  | "Facebook";
type CampaignStatus = "Open" | "Ongoing" | "Completed";
type ApplicationStatus = "Pending" | "Accepted" | "Rejected";
type CollaborationStatus = "Active" | "Completed";
type DeliverableContentType = "Reel" | "Story" | "Post" | "Video";
type DeliverableStatus = "Pending" | "Completed";
type ApprovalStatus = "Pending" | "Approved" | "Rejected";
type PaymentStatus = "Pending" | "Paid";

type SocialSeed = {
  platform: Platform;
  username: string;
  followers: number;
  engagementRate: string;
  accountUrl: string;
};

type BrandSeed = {
  key: string;
  username: string;
  email: string;
  brandName: string;
  industry: string;
  contactNumber: string;
  address: string;
  city: string;
  state: string;
};

type CreatorSeed = {
  key: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  bio: string;
  address: string;
  city: string;
  state: string;
  socials: SocialSeed[];
};

type RequirementSeed = {
  platform: Platform;
  requiredNiche: string;
  minEngagementRate: string;
};

type CampaignSeed = {
  key: string;
  brandKey: string;
  categoryName: string;
  campaignName: string;
  description: string;
  budget: string;
  minFollowers: number;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  creatorLimit: number;
  requirements: RequirementSeed[];
};

type SubmissionSeed = {
  contentUrl: string;
  submittedDate: string;
  approvalStatus: ApprovalStatus;
};

type DeliverableSeed = {
  contentType: DeliverableContentType;
  dueDate: string;
  status: DeliverableStatus;
  submissions: SubmissionSeed[];
};

type CollaborationSeed = {
  campaignKey: string;
  creatorKey: string;
  appliedDate: string;
  agreedAmount: string;
  startDate: string;
  endDate: string;
  status: CollaborationStatus;
  contract: {
    signedDate: string;
    expiryDate: string;
    document: string;
  };
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
  };
  payment: {
    paymentDate: string;
    status: PaymentStatus;
    transactionReference: string;
  };
  deliverables: DeliverableSeed[];
  review?: {
    rating: number;
    feedback: string;
    reviewDate: string;
  };
};

type ApplicationSeed = {
  campaignKey: string;
  creatorKey: string;
  appliedDate: string;
  status: "Pending" | "Rejected";
};

const categorySeeds: Array<{ categoryName: string; description: string }> = [
  {
    categoryName: "Gaming & Esports",
    description: "Video game launches, esports coverage, and creator gameplay content",
  },
  {
    categoryName: "Music & Audio",
    description: "Music releases, audio hardware, podcasts, and sound production",
  },
  {
    categoryName: "Sustainability",
    description: "Eco-friendly products, low-waste living, and responsible consumption",
  },
  {
    categoryName: "Home & Living",
    description: "Home decor, organization, gardening, and everyday living",
  },
  {
    categoryName: "Parenting & Family",
    description: "Family routines, parenting products, and child-safe experiences",
  },
  {
    categoryName: "Outdoor & Adventure",
    description: "Hiking, camping, outdoor gear, and adventure travel",
  },
];

const brandSeeds: BrandSeed[] = [
  {
    key: "lumen",
    username: "demo.brand.lumenloom",
    email: `demo.brand.lumenloom@${DEMO_EMAIL_DOMAIN}`,
    brandName: "Lumen & Loom",
    industry: "Fashion & Textiles",
    contactNumber: "8041027781",
    address: "42 Residency Road",
    city: "Bengaluru",
    state: "Karnataka",
  },
  {
    key: "northpeak",
    username: "demo.brand.northpeak",
    email: `demo.brand.northpeak@${DEMO_EMAIL_DOMAIN}`,
    brandName: "NorthPeak Outdoors",
    industry: "Outdoor Recreation",
    contactNumber: "1902245510",
    address: "18 Mall Road",
    city: "Manali",
    state: "Himachal Pradesh",
  },
  {
    key: "bytebloom",
    username: "demo.brand.bytebloom",
    email: `demo.brand.bytebloom@${DEMO_EMAIL_DOMAIN}`,
    brandName: "ByteBloom Labs",
    industry: "Software & AI",
    contactNumber: "4067128840",
    address: "91 HITEC City Phase 2",
    city: "Hyderabad",
    state: "Telangana",
  },
  {
    key: "nourishnest",
    username: "demo.brand.nourishnest",
    email: `demo.brand.nourishnest@${DEMO_EMAIL_DOMAIN}`,
    brandName: "NourishNest Foods",
    industry: "Food & Beverage",
    contactNumber: "2067451180",
    address: "7 Aundh Road",
    city: "Pune",
    state: "Maharashtra",
  },
  {
    key: "pulsewave",
    username: "demo.brand.pulsewave",
    email: `demo.brand.pulsewave@${DEMO_EMAIL_DOMAIN}`,
    brandName: "PulseWave Audio",
    industry: "Consumer Electronics",
    contactNumber: "2249056720",
    address: "63 Lower Parel",
    city: "Mumbai",
    state: "Maharashtra",
  },
  {
    key: "verdant",
    username: "demo.brand.verdanthome",
    email: `demo.brand.verdanthome@${DEMO_EMAIL_DOMAIN}`,
    brandName: "Verdant Home",
    industry: "Sustainable Living",
    contactNumber: "8212456630",
    address: "29 Chamundi Hill Road",
    city: "Mysuru",
    state: "Karnataka",
  },
  {
    key: "stridewell",
    username: "demo.brand.stridewell",
    email: `demo.brand.stridewell@${DEMO_EMAIL_DOMAIN}`,
    brandName: "StrideWell Footwear",
    industry: "Sportswear",
    contactNumber: "1147023380",
    address: "15 Vasant Kunj",
    city: "New Delhi",
    state: "Delhi",
  },
  {
    key: "prism",
    username: "demo.brand.prismplay",
    email: `demo.brand.prismplay@${DEMO_EMAIL_DOMAIN}`,
    brandName: "Prism Play Studio",
    industry: "Gaming & Entertainment",
    contactNumber: "8067014490",
    address: "8 Indiranagar 100 Feet Road",
    city: "Bengaluru",
    state: "Karnataka",
  },
];

const creatorSeeds: CreatorSeed[] = [
  {
    key: "aditi",
    username: "demo.aditi.menon",
    email: `demo.aditi.menon@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Aditi",
    lastName: "Menon",
    dateOfBirth: "1994-06-18",
    phone: "9845012301",
    bio: "Fashion and lifestyle creator blending everyday styling with mindful shopping.",
    address: "12 Panampilly Nagar",
    city: "Kochi",
    state: "Kerala",
    socials: [
      {
        platform: "Instagram",
        username: "aditi.styles",
        followers: 86000,
        engagementRate: "4.60",
        accountUrl: "https://instagram.com/aditi.styles",
      },
      {
        platform: "YouTube",
        username: "AditiMenonStyle",
        followers: 24000,
        engagementRate: "2.40",
        accountUrl: "https://youtube.com/@AditiMenonStyle",
      },
    ],
  },
  {
    key: "vikram",
    username: "demo.vikram.desai",
    email: `demo.vikram.desai@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Vikram",
    lastName: "Desai",
    dateOfBirth: "1991-02-09",
    phone: "9820034512",
    bio: "Technology reviewer covering developer tools, AI workflows, and productivity hardware.",
    address: "44 Andheri East",
    city: "Mumbai",
    state: "Maharashtra",
    socials: [
      {
        platform: "YouTube",
        username: "VikramBuildsTech",
        followers: 180000,
        engagementRate: "5.20",
        accountUrl: "https://youtube.com/@VikramBuildsTech",
      },
      {
        platform: "LinkedIn",
        username: "vikram-desai-tech",
        followers: 55000,
        engagementRate: "2.80",
        accountUrl: "https://linkedin.com/in/vikram-desai-tech",
      },
      {
        platform: "Twitter",
        username: "vikrambuilds",
        followers: 26000,
        engagementRate: "3.20",
        accountUrl: "https://twitter.com/vikrambuilds",
      },
    ],
  },
  {
    key: "nisha",
    username: "demo.nisha.verma",
    email: `demo.nisha.verma@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Nisha",
    lastName: "Verma",
    dateOfBirth: "1995-11-27",
    phone: "9811046723",
    bio: "Travel filmmaker documenting mountain trails, slow travel, and local stays.",
    address: "23 Rajpur Road",
    city: "Dehradun",
    state: "Uttarakhand",
    socials: [
      {
        platform: "Instagram",
        username: "nisha.beyondtrails",
        followers: 120000,
        engagementRate: "4.10",
        accountUrl: "https://instagram.com/nisha.beyondtrails",
      },
      {
        platform: "YouTube",
        username: "NishaBeyondTrails",
        followers: 67000,
        engagementRate: "3.00",
        accountUrl: "https://youtube.com/@NishaBeyondTrails",
      },
    ],
  },
  {
    key: "rahul",
    username: "demo.rahul.bose",
    email: `demo.rahul.bose@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Rahul",
    lastName: "Bose",
    dateOfBirth: "1993-08-14",
    phone: "9830012245",
    bio: "Strength coach sharing sustainable training plans and practical nutrition habits.",
    address: "16 Salt Lake Sector 2",
    city: "Kolkata",
    state: "West Bengal",
    socials: [
      {
        platform: "Instagram",
        username: "rahul.trainstrong",
        followers: 95000,
        engagementRate: "3.80",
        accountUrl: "https://instagram.com/rahul.trainstrong",
      },
      {
        platform: "YouTube",
        username: "RahulTrainStrong",
        followers: 48000,
        engagementRate: "2.50",
        accountUrl: "https://youtube.com/@RahulTrainStrong",
      },
    ],
  },
  {
    key: "tanvi",
    username: "demo.tanvi.shah",
    email: `demo.tanvi.shah@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Tanvi",
    lastName: "Shah",
    dateOfBirth: "1996-04-03",
    phone: "9898043321",
    bio: "Beauty creator reviewing skincare ingredients, makeup textures, and salon alternatives.",
    address: "31 Satellite Road",
    city: "Ahmedabad",
    state: "Gujarat",
    socials: [
      {
        platform: "Instagram",
        username: "tanvi.skinnotes",
        followers: 150000,
        engagementRate: "5.50",
        accountUrl: "https://instagram.com/tanvi.skinnotes",
      },
      {
        platform: "YouTube",
        username: "TanviSkinNotes",
        followers: 35000,
        engagementRate: "2.20",
        accountUrl: "https://youtube.com/@TanviSkinNotes",
      },
    ],
  },
  {
    key: "dev",
    username: "demo.dev.malhotra",
    email: `demo.dev.malhotra@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Dev",
    lastName: "Malhotra",
    dateOfBirth: "1997-01-22",
    phone: "9873078812",
    bio: "Gaming creator covering indie releases, esports stories, and build guides.",
    address: "9 Sector 34",
    city: "Chandigarh",
    state: "Chandigarh",
    socials: [
      {
        platform: "YouTube",
        username: "DevPlaysIndie",
        followers: 220000,
        engagementRate: "6.10",
        accountUrl: "https://youtube.com/@DevPlaysIndie",
      },
      {
        platform: "Twitter",
        username: "devplaysindie",
        followers: 44000,
        engagementRate: "3.30",
        accountUrl: "https://twitter.com/devplaysindie",
      },
    ],
  },
  {
    key: "ishita",
    username: "demo.ishita.roy",
    email: `demo.ishita.roy@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Ishita",
    lastName: "Roy",
    dateOfBirth: "1998-09-11",
    phone: "9832079901",
    bio: "Food creator developing quick regional recipes and honest cafe reviews.",
    address: "28 Ballygunge Place",
    city: "Kolkata",
    state: "West Bengal",
    socials: [
      {
        platform: "Instagram",
        username: "ishita.homeplate",
        followers: 72000,
        engagementRate: "4.40",
        accountUrl: "https://instagram.com/ishita.homeplate",
      },
      {
        platform: "YouTube",
        username: "IshitaHomePlate",
        followers: 30000,
        engagementRate: "2.70",
        accountUrl: "https://youtube.com/@IshitaHomePlate",
      },
    ],
  },
  {
    key: "karan",
    username: "demo.karan.bedi",
    email: `demo.karan.bedi@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Karan",
    lastName: "Bedi",
    dateOfBirth: "1992-12-05",
    phone: "9811024478",
    bio: "Music producer and podcast host exploring home studios and independent artists.",
    address: "5 Hauz Khas Village",
    city: "New Delhi",
    state: "Delhi",
    socials: [
      {
        platform: "YouTube",
        username: "KaranBediSessions",
        followers: 140000,
        engagementRate: "4.00",
        accountUrl: "https://youtube.com/@KaranBediSessions",
      },
      {
        platform: "Instagram",
        username: "karan.bedi.sound",
        followers: 60000,
        engagementRate: "3.60",
        accountUrl: "https://instagram.com/karan.bedi.sound",
      },
      {
        platform: "LinkedIn",
        username: "karan-bedi-audio",
        followers: 22000,
        engagementRate: "2.10",
        accountUrl: "https://linkedin.com/in/karan-bedi-audio",
      },
    ],
  },
  {
    key: "pooja",
    username: "demo.pooja.kamath",
    email: `demo.pooja.kamath@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Pooja",
    lastName: "Kamath",
    dateOfBirth: "1990-03-19",
    phone: "9845099112",
    bio: "Personal finance educator simplifying investing, insurance, and salary planning.",
    address: "19 Jayanagar 4th Block",
    city: "Bengaluru",
    state: "Karnataka",
    socials: [
      {
        platform: "LinkedIn",
        username: "pooja-kamath-finance",
        followers: 88000,
        engagementRate: "3.10",
        accountUrl: "https://linkedin.com/in/pooja-kamath-finance",
      },
      {
        platform: "YouTube",
        username: "PoojaKamathMoney",
        followers: 42000,
        engagementRate: "2.30",
        accountUrl: "https://youtube.com/@PoojaKamathMoney",
      },
    ],
  },
  {
    key: "sameer",
    username: "demo.sameer.joshi",
    email: `demo.sameer.joshi@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Sameer",
    lastName: "Joshi",
    dateOfBirth: "1993-07-07",
    phone: "9822015567",
    bio: "Outdoor creator testing hiking gear across Western Ghats trails and campsites.",
    address: "11 Kothrud",
    city: "Pune",
    state: "Maharashtra",
    socials: [
      {
        platform: "Instagram",
        username: "sameer.outdoors",
        followers: 54000,
        engagementRate: "3.70",
        accountUrl: "https://instagram.com/sameer.outdoors",
      },
      {
        platform: "YouTube",
        username: "SameerOutdoors",
        followers: 79000,
        engagementRate: "3.40",
        accountUrl: "https://youtube.com/@SameerOutdoors",
      },
    ],
  },
  {
    key: "riya",
    username: "demo.riya.kapoor",
    email: `demo.riya.kapoor@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Riya",
    lastName: "Kapoor",
    dateOfBirth: "1996-10-30",
    phone: "9818056623",
    bio: "Sustainability creator sharing low-waste home routines and kitchen gardening.",
    address: "34 Green Park",
    city: "New Delhi",
    state: "Delhi",
    socials: [
      {
        platform: "Instagram",
        username: "riya.lowwaste",
        followers: 49000,
        engagementRate: "4.80",
        accountUrl: "https://instagram.com/riya.lowwaste",
      },
      {
        platform: "Facebook",
        username: "RiyaLowWasteLiving",
        followers: 18000,
        engagementRate: "2.00",
        accountUrl: "https://facebook.com/RiyaLowWasteLiving",
      },
    ],
  },
  {
    key: "aarav",
    username: "demo.aarav.pillai",
    email: `demo.aarav.pillai@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Aarav",
    lastName: "Pillai",
    dateOfBirth: "1994-05-16",
    phone: "9940062288",
    bio: "Developer advocate writing about platform engineering, open source, and AI tooling.",
    address: "22 Velachery Main Road",
    city: "Chennai",
    state: "Tamil Nadu",
    socials: [
      {
        platform: "LinkedIn",
        username: "aarav-pillai-dev",
        followers: 33000,
        engagementRate: "2.20",
        accountUrl: "https://linkedin.com/in/aarav-pillai-dev",
      },
      {
        platform: "Twitter",
        username: "aarav_dev",
        followers: 27000,
        engagementRate: "4.10",
        accountUrl: "https://twitter.com/aarav_dev",
      },
      {
        platform: "YouTube",
        username: "AaravPillaiDev",
        followers: 41000,
        engagementRate: "2.40",
        accountUrl: "https://youtube.com/@AaravPillaiDev",
      },
    ],
  },
  {
    key: "diya",
    username: "demo.diya.sethi",
    email: `demo.diya.sethi@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Diya",
    lastName: "Sethi",
    dateOfBirth: "1991-09-24",
    phone: "9811057744",
    bio: "Parenting creator documenting weekend family adventures and practical routines.",
    address: "8 Vasant Vihar",
    city: "New Delhi",
    state: "Delhi",
    socials: [
      {
        platform: "Instagram",
        username: "diya.familydays",
        followers: 63000,
        engagementRate: "5.00",
        accountUrl: "https://instagram.com/diya.familydays",
      },
      {
        platform: "Facebook",
        username: "DiyaFamilyDays",
        followers: 21000,
        engagementRate: "2.90",
        accountUrl: "https://facebook.com/DiyaFamilyDays",
      },
    ],
  },
  {
    key: "neel",
    username: "demo.neel.sharma",
    email: `demo.neel.sharma@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Neel",
    lastName: "Sharma",
    dateOfBirth: "1994-12-12",
    phone: "9820093311",
    bio: "Running coach sharing beginner training plans, recovery advice, and race day tips.",
    address: "27 Powai Vihar",
    city: "Mumbai",
    state: "Maharashtra",
    socials: [
      {
        platform: "Instagram",
        username: "neel.runs",
        followers: 110000,
        engagementRate: "3.50",
        accountUrl: "https://instagram.com/neel.runs",
      },
      {
        platform: "Facebook",
        username: "NeelRuns",
        followers: 32000,
        engagementRate: "2.10",
        accountUrl: "https://facebook.com/NeelRuns",
      },
      {
        platform: "YouTube",
        username: "NeelRuns",
        followers: 52000,
        engagementRate: "2.40",
        accountUrl: "https://youtube.com/@NeelRuns",
      },
    ],
  },
  {
    key: "anika",
    username: "demo.anika.ghosh",
    email: `demo.anika.ghosh@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Anika",
    lastName: "Ghosh",
    dateOfBirth: "1997-03-06",
    phone: "9830064412",
    bio: "Beauty creator focused on sensitive skin routines and ingredient-led reviews.",
    address: "14 New Town",
    city: "Kolkata",
    state: "West Bengal",
    socials: [
      {
        platform: "Instagram",
        username: "anika.skinlab",
        followers: 92000,
        engagementRate: "4.20",
        accountUrl: "https://instagram.com/anika.skinlab",
      },
      {
        platform: "YouTube",
        username: "AnikaSkinLab",
        followers: 28000,
        engagementRate: "2.00",
        accountUrl: "https://youtube.com/@AnikaSkinLab",
      },
    ],
  },
  {
    key: "yash",
    username: "demo.yash.thakur",
    email: `demo.yash.thakur@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Yash",
    lastName: "Thakur",
    dateOfBirth: "1995-08-21",
    phone: "9816027734",
    bio: "Food creator making budget-friendly meals and regional dessert recipes.",
    address: "6 Civil Lines",
    city: "Jaipur",
    state: "Rajasthan",
    socials: [
      {
        platform: "Instagram",
        username: "yash.kitchen",
        followers: 58000,
        engagementRate: "3.90",
        accountUrl: "https://instagram.com/yash.kitchen",
      },
      {
        platform: "YouTube",
        username: "YashKitchen",
        followers: 39000,
        engagementRate: "2.60",
        accountUrl: "https://youtube.com/@YashKitchen",
      },
    ],
  },
  {
    key: "sana",
    username: "demo.sana.mirza",
    email: `demo.sana.mirza@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Sana",
    lastName: "Mirza",
    dateOfBirth: "1996-01-15",
    phone: "9740038812",
    bio: "Fashion creator styling modern ethnic edits and accessible occasion wear.",
    address: "17 Banjara Hills",
    city: "Hyderabad",
    state: "Telangana",
    socials: [
      {
        platform: "Instagram",
        username: "sana.edit",
        followers: 130000,
        engagementRate: "5.30",
        accountUrl: "https://instagram.com/sana.edit",
      },
      {
        platform: "Twitter",
        username: "sanaedit",
        followers: 24000,
        engagementRate: "3.00",
        accountUrl: "https://twitter.com/sanaedit",
      },
      {
        platform: "YouTube",
        username: "SanaMirzaStyle",
        followers: 34000,
        engagementRate: "2.50",
        accountUrl: "https://youtube.com/@SanaMirzaStyle",
      },
    ],
  },
  {
    key: "mohit",
    username: "demo.mohit.rana",
    email: `demo.mohit.rana@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Mohit",
    lastName: "Rana",
    dateOfBirth: "1993-11-02",
    phone: "9953087710",
    bio: "Gaming streamer focused on strategy games, indie showcases, and community play.",
    address: "4 Rohini Sector 9",
    city: "New Delhi",
    state: "Delhi",
    socials: [
      {
        platform: "YouTube",
        username: "MohitRanaPlays",
        followers: 175000,
        engagementRate: "5.80",
        accountUrl: "https://youtube.com/@MohitRanaPlays",
      },
      {
        platform: "Twitter",
        username: "mohitranaplays",
        followers: 38000,
        engagementRate: "3.70",
        accountUrl: "https://twitter.com/mohitranaplays",
      },
    ],
  },
  {
    key: "lakshmi",
    username: "demo.lakshmi.iyer",
    email: `demo.lakshmi.iyer@${DEMO_EMAIL_DOMAIN}`,
    firstName: "Lakshmi",
    lastName: "Iyer",
    dateOfBirth: "1990-07-08",
    phone: "9841039955",
    bio: "Career educator helping students and early professionals build practical skills.",
    address: "21 Alwarpet",
    city: "Chennai",
    state: "Tamil Nadu",
    socials: [
      {
        platform: "LinkedIn",
        username: "lakshmi-iyer-careers",
        followers: 74000,
        engagementRate: "3.40",
        accountUrl: "https://linkedin.com/in/lakshmi-iyer-careers",
      },
      {
        platform: "YouTube",
        username: "LakshmiIyerCareers",
        followers: 51000,
        engagementRate: "2.90",
        accountUrl: "https://youtube.com/@LakshmiIyerCareers",
      },
    ],
  },
];

const campaignSeeds: CampaignSeed[] = [
  {
    key: "lumenWinter",
    brandKey: "lumen",
    categoryName: "Fashion",
    campaignName: "Lumen Winter Layer Edit",
    description:
      "Style the Lumen & Loom winter layering collection for transitional city weather, focusing on texture, comfort, and repeat wear.",
    budget: "320000.00",
    minFollowers: 1000,
    startDate: "2026-09-01",
    endDate: "2026-10-31",
    status: "Completed",
    creatorLimit: 6,
    requirements: [
      { platform: "Instagram", requiredNiche: "Fashion", minEngagementRate: "2.00" },
    ],
  },
  {
    key: "lumenFestive",
    brandKey: "lumen",
    categoryName: "Fashion",
    campaignName: "Threads of Tradition Festive Series",
    description:
      "Create festive styling stories around Lumen & Loom handloom-inspired pieces, family celebrations, and heirloom accessories.",
    budget: "450000.00",
    minFollowers: 5000,
    startDate: "2026-12-01",
    endDate: "2027-01-31",
    status: "Open",
    creatorLimit: 5,
    requirements: [
      { platform: "Instagram", requiredNiche: "Fashion", minEngagementRate: "2.50" },
    ],
  },
  {
    key: "northTrail",
    brandKey: "northpeak",
    categoryName: "Outdoor & Adventure",
    campaignName: "Himalayan Trail Tested",
    description:
      "Field-test NorthPeak jackets and daypacks on real Himalayan trails with honest notes on fit, weather protection, and packing.",
    budget: "600000.00",
    minFollowers: 12000,
    startDate: "2026-10-15",
    endDate: "2026-12-15",
    status: "Ongoing",
    creatorLimit: 4,
    requirements: [
      { platform: "YouTube", requiredNiche: "Outdoor & Adventure", minEngagementRate: "1.50" },
      { platform: "Instagram", requiredNiche: "Outdoor & Adventure", minEngagementRate: "2.00" },
    ],
  },
  {
    key: "northCamping",
    brandKey: "northpeak",
    categoryName: "Outdoor & Adventure",
    campaignName: "Weekend Camping Checklist",
    description:
      "Build practical weekend camping checklists using NorthPeak gear, with setup clips and family-friendly campsite tips.",
    budget: "180000.00",
    minFollowers: 3000,
    startDate: "2026-07-01",
    endDate: "2026-09-15",
    status: "Completed",
    creatorLimit: 4,
    requirements: [
      { platform: "Instagram", requiredNiche: "Outdoor & Adventure", minEngagementRate: "2.00" },
    ],
  },
  {
    key: "byteAi",
    brandKey: "bytebloom",
    categoryName: "Technology",
    campaignName: "No-Code AI Workflow Sprint",
    description:
      "Show how small teams automate research, support, and reporting with ByteBloom's no-code AI workflow builder.",
    budget: "750000.00",
    minFollowers: 15000,
    startDate: "2026-10-20",
    endDate: "2027-01-15",
    status: "Open",
    creatorLimit: 5,
    requirements: [
      { platform: "YouTube", requiredNiche: "Technology", minEngagementRate: "2.00" },
      { platform: "LinkedIn", requiredNiche: "Technology", minEngagementRate: "1.00" },
      { platform: "Twitter", requiredNiche: "Technology", minEngagementRate: "1.50" },
    ],
  },
  {
    key: "byteDesk",
    brandKey: "bytebloom",
    categoryName: "Technology",
    campaignName: "Developer Desk Setup 2027",
    description:
      "Create a practical developer desk setup guide featuring ByteBloom accessories, cable management, and focus-friendly lighting.",
    budget: "280000.00",
    minFollowers: 5000,
    startDate: "2026-11-20",
    endDate: "2027-02-15",
    status: "Open",
    creatorLimit: 4,
    requirements: [
      { platform: "LinkedIn", requiredNiche: "Technology", minEngagementRate: "1.00" },
      { platform: "YouTube", requiredNiche: "Technology", minEngagementRate: "1.50" },
    ],
  },
  {
    key: "nourishMillet",
    brandKey: "nourishnest",
    categoryName: "Food & Lifestyle",
    campaignName: "Weeknight Millet Meals",
    description:
      "Develop fast weeknight meals using NourishNest millet mixes, with clear prep steps and family-friendly serving ideas.",
    budget: "150000.00",
    minFollowers: 1000,
    startDate: "2026-10-01",
    endDate: "2026-12-20",
    status: "Open",
    creatorLimit: 6,
    requirements: [
      { platform: "Instagram", requiredNiche: "Food & Lifestyle", minEngagementRate: "1.50" },
      { platform: "YouTube", requiredNiche: "Food & Lifestyle", minEngagementRate: "1.00" },
    ],
  },
  {
    key: "nourishHoliday",
    brandKey: "nourishnest",
    categoryName: "Food & Lifestyle",
    campaignName: "Holiday Table with NourishNest",
    description:
      "Create host-friendly holiday recipes and tablescape ideas using NourishNest pantry staples and festive serving suggestions.",
    budget: "120000.00",
    minFollowers: 500,
    startDate: "2026-12-05",
    endDate: "2027-01-20",
    status: "Open",
    creatorLimit: 5,
    requirements: [
      { platform: "Instagram", requiredNiche: "Food & Lifestyle", minEngagementRate: "2.00" },
    ],
  },
  {
    key: "pulsePodcast",
    brandKey: "pulsewave",
    categoryName: "Music & Audio",
    campaignName: "Podcast Studio Makeover",
    description:
      "Transform a home room into a clean podcast studio using PulseWave microphones, acoustic panels, and recording accessories.",
    budget: "500000.00",
    minFollowers: 8000,
    startDate: "2026-10-01",
    endDate: "2026-12-31",
    status: "Ongoing",
    creatorLimit: 4,
    requirements: [
      { platform: "YouTube", requiredNiche: "Music & Audio", minEngagementRate: "2.00" },
      { platform: "LinkedIn", requiredNiche: "Music & Audio", minEngagementRate: "1.00" },
    ],
  },
  {
    key: "pulseStreet",
    brandKey: "pulsewave",
    categoryName: "Music & Audio",
    campaignName: "Street Sound Sessions",
    description:
      "Record short street performances and explain how PulseWave portable audio gear handles live sound in busy locations.",
    budget: "220000.00",
    minFollowers: 500,
    startDate: "2026-09-15",
    endDate: "2026-11-30",
    status: "Open",
    creatorLimit: 4,
    requirements: [
      { platform: "Instagram", requiredNiche: "Music & Audio", minEngagementRate: "2.00" },
      { platform: "YouTube", requiredNiche: "Music & Audio", minEngagementRate: "1.50" },
    ],
  },
  {
    key: "verdantKitchen",
    brandKey: "verdant",
    categoryName: "Sustainability",
    campaignName: "Zero-Waste Kitchen Reset",
    description:
      "Document a two-week zero-waste kitchen reset with Verdant Home storage, compost, and refillable cleaning products.",
    budget: "175000.00",
    minFollowers: 500,
    startDate: "2026-10-10",
    endDate: "2027-01-10",
    status: "Open",
    creatorLimit: 5,
    requirements: [
      { platform: "Instagram", requiredNiche: "Sustainability", minEngagementRate: "2.50" },
      { platform: "YouTube", requiredNiche: "Sustainability", minEngagementRate: "1.00" },
    ],
  },
  {
    key: "verdantGarden",
    brandKey: "verdant",
    categoryName: "Home & Living",
    campaignName: "Balcony Garden Diaries",
    description:
      "Create a seasonal balcony garden series using Verdant Home planters, soil mixes, and water-saving accessories.",
    budget: "95000.00",
    minFollowers: 500,
    startDate: "2026-05-01",
    endDate: "2026-08-31",
    status: "Completed",
    creatorLimit: 4,
    requirements: [
      { platform: "Instagram", requiredNiche: "Sustainability", minEngagementRate: "2.00" },
      { platform: "Facebook", requiredNiche: "Sustainability", minEngagementRate: "1.00" },
    ],
  },
  {
    key: "strideRun",
    brandKey: "stridewell",
    categoryName: "Fitness",
    campaignName: "Run Your First 10K",
    description:
      "Guide beginner runners through an eight-week 10K plan while testing StrideWell training shoes and recovery routines.",
    budget: "350000.00",
    minFollowers: 5000,
    startDate: "2026-09-01",
    endDate: "2026-12-10",
    status: "Ongoing",
    creatorLimit: 5,
    requirements: [
      { platform: "Instagram", requiredNiche: "Fitness", minEngagementRate: "2.00" },
      { platform: "YouTube", requiredNiche: "Fitness", minEngagementRate: "1.50" },
      { platform: "Facebook", requiredNiche: "Fitness", minEngagementRate: "1.00" },
    ],
  },
  {
    key: "strideSneaker",
    brandKey: "stridewell",
    categoryName: "Fashion",
    campaignName: "Everyday Sneaker Styling",
    description:
      "Style StrideWell everyday sneakers across work, weekend, and travel looks while highlighting comfort and durability.",
    budget: "240000.00",
    minFollowers: 1000,
    startDate: "2026-10-15",
    endDate: "2026-12-31",
    status: "Open",
    creatorLimit: 6,
    requirements: [
      { platform: "Instagram", requiredNiche: "Fashion", minEngagementRate: "2.00" },
    ],
  },
  {
    key: "prismIndie",
    brandKey: "prism",
    categoryName: "Gaming & Esports",
    campaignName: "Indie Game Discovery Week",
    description:
      "Spotlight overlooked indie games with first-impression videos, gameplay tips, and honest recommendations for new players.",
    budget: "400000.00",
    minFollowers: 10000,
    startDate: "2026-06-01",
    endDate: "2026-08-20",
    status: "Completed",
    creatorLimit: 4,
    requirements: [
      { platform: "YouTube", requiredNiche: "Gaming & Esports", minEngagementRate: "2.00" },
      { platform: "Twitter", requiredNiche: "Gaming & Esports", minEngagementRate: "1.50" },
    ],
  },
];

const collaborationSeeds: CollaborationSeed[] = [
  {
    campaignKey: "lumenWinter",
    creatorKey: "shetty",
    appliedDate: "2026-08-20",
    agreedAmount: "140000.00",
    startDate: "2026-09-10",
    endDate: "2026-10-31",
    status: "Completed",
    contract: {
      signedDate: "2026-09-10",
      expiryDate: "2026-10-31",
      document: "https://demo.creatorconnect.local/contracts/lumenWinter-shetty.pdf",
    },
    metrics: { views: 186000, likes: 14200, comments: 640, shares: 1180, clicks: 4600 },
    payment: {
      paymentDate: "2026-11-02",
      status: "Paid",
      transactionReference: "DEMO-PAY-LUMEN-001",
    },
    deliverables: [
      {
        contentType: "Reel",
        dueDate: "2026-09-25",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/lumenWinter-shetty-reel-v1.mp4",
            submittedDate: "2026-09-24",
            approvalStatus: "Approved",
          },
        ],
      },
      {
        contentType: "Story",
        dueDate: "2026-10-12",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/lumenWinter-shetty-story-v1.jpg",
            submittedDate: "2026-10-11",
            approvalStatus: "Approved",
          },
        ],
      },
    ],
    review: {
      rating: 5,
      feedback:
        "Clear styling narrative, strong repeat-wear messaging, and both deliverables landed ahead of schedule.",
      reviewDate: "2026-11-02",
    },
  },
  {
    campaignKey: "lumenWinter",
    creatorKey: "tanvi",
    appliedDate: "2026-08-22",
    agreedAmount: "120000.00",
    startDate: "2026-09-12",
    endDate: "2026-10-28",
    status: "Completed",
    contract: {
      signedDate: "2026-09-12",
      expiryDate: "2026-10-28",
      document: "https://demo.creatorconnect.local/contracts/lumenWinter-tanvi.pdf",
    },
    metrics: { views: 154000, likes: 11800, comments: 520, shares: 940, clicks: 3600 },
    payment: {
      paymentDate: "2026-10-30",
      status: "Paid",
      transactionReference: "DEMO-PAY-LUMEN-002",
    },
    deliverables: [
      {
        contentType: "Post",
        dueDate: "2026-09-28",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/lumenWinter-tanvi-post-v1.jpg",
            submittedDate: "2026-09-27",
            approvalStatus: "Approved",
          },
        ],
      },
      {
        contentType: "Reel",
        dueDate: "2026-10-18",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/lumenWinter-tanvi-reel-v1.mp4",
            submittedDate: "2026-10-17",
            approvalStatus: "Approved",
          },
        ],
      },
    ],
    review: {
      rating: 4,
      feedback:
        "Good beauty-led styling approach and a clean transition into the winter collection. One caption revision was handled quickly.",
      reviewDate: "2026-10-31",
    },
  },
  {
    campaignKey: "northTrail",
    creatorKey: "nisha",
    appliedDate: "2026-10-02",
    agreedAmount: "210000.00",
    startDate: "2026-10-20",
    endDate: "2026-10-30",
    status: "Completed",
    contract: {
      signedDate: "2026-10-19",
      expiryDate: "2026-10-30",
      document: "https://demo.creatorconnect.local/contracts/northTrail-nisha.pdf",
    },
    metrics: { views: 238000, likes: 17400, comments: 910, shares: 1560, clicks: 5200 },
    payment: {
      paymentDate: "2026-11-01",
      status: "Paid",
      transactionReference: "DEMO-PAY-NORTHPEAK-001",
    },
    deliverables: [
      {
        contentType: "Video",
        dueDate: "2026-10-24",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/northTrail-nisha-video-v1.mp4",
            submittedDate: "2026-10-23",
            approvalStatus: "Approved",
          },
        ],
      },
      {
        contentType: "Reel",
        dueDate: "2026-10-28",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/northTrail-nisha-reel-v1.mp4",
            submittedDate: "2026-10-27",
            approvalStatus: "Approved",
          },
        ],
      },
    ],
    review: {
      rating: 4,
      feedback:
        "Excellent mountain visuals and honest gear feedback. The packing section was especially useful for first-time trail users.",
      reviewDate: "2026-11-02",
    },
  },
  {
    campaignKey: "northTrail",
    creatorKey: "sameer",
    appliedDate: "2026-10-04",
    agreedAmount: "190000.00",
    startDate: "2026-10-20",
    endDate: "2026-10-29",
    status: "Completed",
    contract: {
      signedDate: "2026-10-19",
      expiryDate: "2026-10-29",
      document: "https://demo.creatorconnect.local/contracts/northTrail-sameer.pdf",
    },
    metrics: { views: 214000, likes: 15900, comments: 780, shares: 1410, clicks: 4700 },
    payment: {
      paymentDate: "2026-10-31",
      status: "Paid",
      transactionReference: "DEMO-PAY-NORTHPEAK-002",
    },
    deliverables: [
      {
        contentType: "Reel",
        dueDate: "2026-10-23",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/northTrail-sameer-reel-v1.mp4",
            submittedDate: "2026-10-22",
            approvalStatus: "Approved",
          },
        ],
      },
      {
        contentType: "Story",
        dueDate: "2026-10-27",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/northTrail-sameer-story-v1.jpg",
            submittedDate: "2026-10-26",
            approvalStatus: "Approved",
          },
        ],
      },
    ],
    review: {
      rating: 5,
      feedback:
        "Practical trail breakdown with strong technical detail and a natural brand fit. Delivered everything early.",
      reviewDate: "2026-11-01",
    },
  },
  {
    campaignKey: "northCamping",
    creatorKey: "diya",
    appliedDate: "2026-06-18",
    agreedAmount: "90000.00",
    startDate: "2026-07-10",
    endDate: "2026-09-10",
    status: "Completed",
    contract: {
      signedDate: "2026-07-10",
      expiryDate: "2026-09-10",
      document: "https://demo.creatorconnect.local/contracts/northCamping-diya.pdf",
    },
    metrics: { views: 98000, likes: 8100, comments: 390, shares: 720, clicks: 2400 },
    payment: {
      paymentDate: "2026-09-12",
      status: "Paid",
      transactionReference: "DEMO-PAY-NORTHPEAK-003",
    },
    deliverables: [
      {
        contentType: "Post",
        dueDate: "2026-07-25",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/northCamping-diya-post-v1.jpg",
            submittedDate: "2026-07-24",
            approvalStatus: "Approved",
          },
        ],
      },
      {
        contentType: "Reel",
        dueDate: "2026-08-20",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/northCamping-diya-reel-v1.mp4",
            submittedDate: "2026-08-19",
            approvalStatus: "Approved",
          },
        ],
      },
    ],
    review: {
      rating: 4,
      feedback:
        "The family camping checklist was easy to follow and matched the brief well. Audience questions were handled thoughtfully.",
      reviewDate: "2026-09-13",
    },
  },
  {
    campaignKey: "pulsePodcast",
    creatorKey: "karan",
    appliedDate: "2026-09-18",
    agreedAmount: "240000.00",
    startDate: "2026-10-05",
    endDate: "2026-10-28",
    status: "Completed",
    contract: {
      signedDate: "2026-10-04",
      expiryDate: "2026-10-28",
      document: "https://demo.creatorconnect.local/contracts/pulsePodcast-karan.pdf",
    },
    metrics: { views: 265000, likes: 19800, comments: 1040, shares: 1820, clicks: 6100 },
    payment: {
      paymentDate: "2026-10-31",
      status: "Paid",
      transactionReference: "DEMO-PAY-PULSEWAVE-001",
    },
    deliverables: [
      {
        contentType: "Video",
        dueDate: "2026-10-15",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/pulsePodcast-karan-video-v1.mp4",
            submittedDate: "2026-10-14",
            approvalStatus: "Approved",
          },
        ],
      },
      {
        contentType: "Reel",
        dueDate: "2026-10-25",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/pulsePodcast-karan-reel-v1.mp4",
            submittedDate: "2026-10-24",
            approvalStatus: "Approved",
          },
        ],
      },
    ],
    review: {
      rating: 5,
      feedback:
        "Outstanding studio transformation content with clear audio comparisons and a very natural product demonstration.",
      reviewDate: "2026-11-01",
    },
  },
  {
    campaignKey: "pulsePodcast",
    creatorKey: "aarav",
    appliedDate: "2026-09-20",
    agreedAmount: "175000.00",
    startDate: "2026-10-06",
    endDate: "2026-10-27",
    status: "Completed",
    contract: {
      signedDate: "2026-10-05",
      expiryDate: "2026-10-27",
      document: "https://demo.creatorconnect.local/contracts/pulsePodcast-aarav.pdf",
    },
    metrics: { views: 142000, likes: 10300, comments: 470, shares: 860, clicks: 3300 },
    payment: {
      paymentDate: "2026-10-30",
      status: "Paid",
      transactionReference: "DEMO-PAY-PULSEWAVE-002",
    },
    deliverables: [
      {
        contentType: "Video",
        dueDate: "2026-10-18",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/pulsePodcast-aarav-video-v1.mp4",
            submittedDate: "2026-10-17",
            approvalStatus: "Approved",
          },
        ],
      },
      {
        contentType: "Post",
        dueDate: "2026-10-24",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/pulsePodcast-aarav-post-v1.jpg",
            submittedDate: "2026-10-23",
            approvalStatus: "Approved",
          },
        ],
      },
    ],
    review: {
      rating: 4,
      feedback:
        "Strong technical explanation for a developer audience. The setup list was practical and the pacing was good.",
      reviewDate: "2026-10-31",
    },
  },
  {
    campaignKey: "pulseStreet",
    creatorKey: "shetty",
    appliedDate: "2026-09-05",
    agreedAmount: "110000.00",
    startDate: "2026-09-20",
    endDate: "2026-11-30",
    status: "Active",
    contract: {
      signedDate: "2026-09-20",
      expiryDate: "2026-11-30",
      document: "https://demo.creatorconnect.local/contracts/pulseStreet-shetty.pdf",
    },
    metrics: { views: 42000, likes: 3400, comments: 180, shares: 260, clicks: 900 },
    payment: {
      paymentDate: "2026-12-05",
      status: "Pending",
      transactionReference: "DEMO-PAY-PULSEWAVE-003",
    },
    deliverables: [
      {
        contentType: "Reel",
        dueDate: "2026-10-28",
        status: "Pending",
        submissions: [],
      },
      {
        contentType: "Story",
        dueDate: "2026-11-15",
        status: "Pending",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/pulseStreet-shetty-story-v1.jpg",
            submittedDate: "2026-11-01",
            approvalStatus: "Pending",
          },
        ],
      },
      {
        contentType: "Post",
        dueDate: "2026-10-30",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/pulseStreet-shetty-post-v1.jpg",
            submittedDate: "2026-10-29",
            approvalStatus: "Approved",
          },
        ],
      },
    ],
  },
  {
    campaignKey: "verdantKitchen",
    creatorKey: "shetty",
    appliedDate: "2026-09-28",
    agreedAmount: "90000.00",
    startDate: "2026-10-15",
    endDate: "2027-01-05",
    status: "Active",
    contract: {
      signedDate: "2026-10-15",
      expiryDate: "2027-01-05",
      document: "https://demo.creatorconnect.local/contracts/verdantKitchen-shetty.pdf",
    },
    metrics: { views: 35000, likes: 2900, comments: 140, shares: 220, clicks: 780 },
    payment: {
      paymentDate: "2027-01-15",
      status: "Pending",
      transactionReference: "DEMO-PAY-VERDANT-001",
    },
    deliverables: [
      {
        contentType: "Reel",
        dueDate: "2026-11-20",
        status: "Pending",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/verdantKitchen-shetty-reel-v1.mp4",
            submittedDate: "2026-11-01",
            approvalStatus: "Rejected",
          },
        ],
      },
      {
        contentType: "Video",
        dueDate: "2026-12-05",
        status: "Pending",
        submissions: [],
      },
    ],
  },
  {
    campaignKey: "verdantGarden",
    creatorKey: "riya",
    appliedDate: "2026-04-15",
    agreedAmount: "60000.00",
    startDate: "2026-05-10",
    endDate: "2026-08-25",
    status: "Completed",
    contract: {
      signedDate: "2026-05-10",
      expiryDate: "2026-08-25",
      document: "https://demo.creatorconnect.local/contracts/verdantGarden-riya.pdf",
    },
    metrics: { views: 72000, likes: 6300, comments: 310, shares: 580, clicks: 1900 },
    payment: {
      paymentDate: "2026-08-27",
      status: "Paid",
      transactionReference: "DEMO-PAY-VERDANT-002",
    },
    deliverables: [
      {
        contentType: "Reel",
        dueDate: "2026-06-10",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/verdantGarden-riya-reel-v1.mp4",
            submittedDate: "2026-06-09",
            approvalStatus: "Approved",
          },
        ],
      },
      {
        contentType: "Post",
        dueDate: "2026-07-15",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/verdantGarden-riya-post-v1.jpg",
            submittedDate: "2026-07-14",
            approvalStatus: "Approved",
          },
        ],
      },
    ],
    review: {
      rating: 5,
      feedback:
        "Beautiful balcony garden series with realistic progress updates and a very clear low-waste message.",
      reviewDate: "2026-08-29",
    },
  },
  {
    campaignKey: "prismIndie",
    creatorKey: "dev",
    appliedDate: "2026-05-15",
    agreedAmount: "160000.00",
    startDate: "2026-06-10",
    endDate: "2026-08-15",
    status: "Completed",
    contract: {
      signedDate: "2026-06-10",
      expiryDate: "2026-08-15",
      document: "https://demo.creatorconnect.local/contracts/prismIndie-dev.pdf",
    },
    metrics: { views: 312000, likes: 24100, comments: 1320, shares: 2240, clicks: 7300 },
    payment: {
      paymentDate: "2026-08-18",
      status: "Paid",
      transactionReference: "DEMO-PAY-PRISM-001",
    },
    deliverables: [
      {
        contentType: "Video",
        dueDate: "2026-06-30",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/prismIndie-dev-video-v1.mp4",
            submittedDate: "2026-06-29",
            approvalStatus: "Approved",
          },
        ],
      },
      {
        contentType: "Reel",
        dueDate: "2026-08-01",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/prismIndie-dev-reel-v1.mp4",
            submittedDate: "2026-07-31",
            approvalStatus: "Approved",
          },
        ],
      },
    ],
    review: {
      rating: 5,
      feedback:
        "Strong discovery format and genuine commentary. The first-impression video drove excellent engagement.",
      reviewDate: "2026-08-20",
    },
  },
  {
    campaignKey: "prismIndie",
    creatorKey: "mohit",
    appliedDate: "2026-05-17",
    agreedAmount: "130000.00",
    startDate: "2026-06-12",
    endDate: "2026-08-16",
    status: "Completed",
    contract: {
      signedDate: "2026-06-12",
      expiryDate: "2026-08-16",
      document: "https://demo.creatorconnect.local/contracts/prismIndie-mohit.pdf",
    },
    metrics: { views: 248000, likes: 18900, comments: 1180, shares: 1740, clicks: 5600 },
    payment: {
      paymentDate: "2026-08-19",
      status: "Paid",
      transactionReference: "DEMO-PAY-PRISM-002",
    },
    deliverables: [
      {
        contentType: "Video",
        dueDate: "2026-07-05",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/prismIndie-mohit-video-v1.mp4",
            submittedDate: "2026-07-04",
            approvalStatus: "Approved",
          },
        ],
      },
      {
        contentType: "Story",
        dueDate: "2026-08-10",
        status: "Completed",
        submissions: [
          {
            contentUrl:
              "https://demo.creatorconnect.local/submissions/prismIndie-mohit-story-v1.jpg",
            submittedDate: "2026-08-09",
            approvalStatus: "Approved",
          },
        ],
      },
    ],
    review: {
      rating: 4,
      feedback:
        "Good gameplay storytelling and strong on-camera delivery. One thumbnail revision was completed without delay.",
      reviewDate: "2026-08-21",
    },
  },
];

const pendingApplicationSeeds: ApplicationSeed[] = [
  { campaignKey: "nourishMillet", creatorKey: "shetty", appliedDate: "2026-10-18", status: "Pending" },
  { campaignKey: "strideSneaker", creatorKey: "shetty", appliedDate: "2026-10-20", status: "Pending" },
  { campaignKey: "byteAi", creatorKey: "vikram", appliedDate: "2026-10-23", status: "Pending" },
  { campaignKey: "byteAi", creatorKey: "aarav", appliedDate: "2026-10-25", status: "Pending" },
  { campaignKey: "byteAi", creatorKey: "pooja", appliedDate: "2026-10-29", status: "Pending" },
  { campaignKey: "nourishMillet", creatorKey: "ishita", appliedDate: "2026-10-15", status: "Pending" },
  { campaignKey: "nourishMillet", creatorKey: "yash", appliedDate: "2026-10-19", status: "Pending" },
  { campaignKey: "pulseStreet", creatorKey: "karan", appliedDate: "2026-10-20", status: "Pending" },
  { campaignKey: "pulseStreet", creatorKey: "sana", appliedDate: "2026-11-01", status: "Pending" },
  { campaignKey: "verdantKitchen", creatorKey: "ishita", appliedDate: "2026-10-22", status: "Pending" },
  { campaignKey: "strideSneaker", creatorKey: "nisha", appliedDate: "2026-10-24", status: "Pending" },
  { campaignKey: "strideRun", creatorKey: "neel", appliedDate: "2026-10-16", status: "Pending" },
];

const rejectedApplicationSeeds: ApplicationSeed[] = [
  { campaignKey: "byteAi", creatorKey: "shetty", appliedDate: "2026-10-26", status: "Rejected" },
  { campaignKey: "strideRun", creatorKey: "shetty", appliedDate: "2026-10-18", status: "Rejected" },
  { campaignKey: "northTrail", creatorKey: "rahul", appliedDate: "2026-10-03", status: "Rejected" },
  { campaignKey: "northCamping", creatorKey: "neel", appliedDate: "2026-06-20", status: "Rejected" },
  { campaignKey: "nourishMillet", creatorKey: "lakshmi", appliedDate: "2026-10-20", status: "Rejected" },
  { campaignKey: "nourishMillet", creatorKey: "dev", appliedDate: "2026-10-21", status: "Rejected" },
  { campaignKey: "verdantKitchen", creatorKey: "aditi", appliedDate: "2026-10-25", status: "Rejected" },
  { campaignKey: "verdantGarden", creatorKey: "anika", appliedDate: "2026-04-20", status: "Rejected" },
  { campaignKey: "strideSneaker", creatorKey: "tanvi", appliedDate: "2026-10-24", status: "Rejected" },
  { campaignKey: "prismIndie", creatorKey: "neel", appliedDate: "2026-05-20", status: "Rejected" },
  { campaignKey: "pulsePodcast", creatorKey: "mohit", appliedDate: "2026-09-22", status: "Rejected" },
];

type Stats = Record<string, { inserted: number; reused: number }>;

function bump(stats: Stats, entity: string, kind: "inserted" | "reused"): void {
  const entry = stats[entity] ?? { inserted: 0, reused: 0 };
  entry[kind] += 1;
  stats[entity] = entry;
}

function requireDemoEnvironment(): void {
  const host = (process.env.DB_HOST ?? "").trim().toLowerCase();
  const database = (process.env.DB_NAME ?? "").trim().toLowerCase();

  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the demo seeder with NODE_ENV=production.");
  }

  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error(
      `Refusing to run the demo seeder against non-local DB_HOST "${host}". ` +
        "Use a local demo database and run again.",
    );
  }

  if (!database.startsWith("creatorconnect") || /prod|production|live/.test(database)) {
    throw new Error(
      `Refusing to run the demo seeder against DB_NAME "${database}". ` +
        "Use the local CreatorConnect demo database.",
    );
  }
}

type IdRow = RowDataPacket & { id: number };

async function findId(
  connection: PoolConnection,
  sql: string,
  params: Array<string | number>,
): Promise<number | null> {
  const [rows] = await connection.execute<IdRow[]>(sql, params);
  return rows[0]?.id ?? null;
}

async function ensureUser(
  connection: PoolConnection,
  stats: Stats,
  account: {
    username: string;
    email: string;
    role: "Creator" | "Brand";
    passwordHashes: Map<string, string>;
  },
): Promise<number> {
  const [rows] = await connection.execute<
    Array<RowDataPacket & {
      user_id: number;
      username: string;
      email: string;
      role: string;
    }>
  >(
    `SELECT user_id, username, email, role
     FROM users
     WHERE username = ? OR email = ?
     LIMIT 1`,
    [account.username, account.email],
  );
  const existing = rows[0];

  if (existing) {
    if (
      existing.username.toLowerCase() !== account.username.toLowerCase() ||
      existing.email.toLowerCase() !== account.email.toLowerCase() ||
      existing.role !== account.role
    ) {
      throw new Error(
        `Account collision for ${account.username} / ${account.email}. ` +
          "The existing account does not match the demo seed definition.",
      );
    }
    bump(stats, "users", "reused");
    return existing.user_id;
  }

  const passwordHash = account.passwordHashes.get(account.username);

  if (!passwordHash) {
    throw new Error(`Missing demo password hash for ${account.username}.`);
  }

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES (?, ?, ?, ?)`,
    [account.username, account.email, passwordHash, account.role],
  );
  bump(stats, "users", "inserted");
  return Number(result.insertId);
}

async function ensureBrand(
  connection: PoolConnection,
  stats: Stats,
  brand: BrandSeed,
  userId: number,
): Promise<number> {
  const existing = await findId(
    connection,
    "SELECT brand_id AS id FROM brands WHERE user_id = ? LIMIT 1",
    [userId],
  );

  if (existing !== null) {
    bump(stats, "brands", "reused");
    return existing;
  }

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO brands
       (user_id, brand_name, industry, contact_number, address, city, state)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      brand.brandName,
      brand.industry,
      brand.contactNumber,
      brand.address,
      brand.city,
      brand.state,
    ],
  );
  bump(stats, "brands", "inserted");
  return Number(result.insertId);
}

async function ensureCreator(
  connection: PoolConnection,
  stats: Stats,
  creator: CreatorSeed,
  userId: number,
): Promise<number> {
  const existing = await findId(
    connection,
    "SELECT creator_id AS id FROM creators WHERE user_id = ? LIMIT 1",
    [userId],
  );
  if (existing !== null) {
    bump(stats, "creators", "reused");
    return existing;
  }

  const profilePictureUrl = `https://demo.creatorconnect.local/creators/${creator.username}.jpg`;
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO creators
       (user_id, first_name, last_name, date_of_birth, phone, bio, address,
        city, state, profile_picture, profile_picture_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      userId,
      creator.firstName,
      creator.lastName,
      creator.dateOfBirth,
      creator.phone,
      creator.bio,
      creator.address,
      creator.city,
      creator.state,
      profilePictureUrl,
    ],
  );
  bump(stats, "creators", "inserted");
  return Number(result.insertId);
}

async function ensureSocialAccount(
  connection: PoolConnection,
  stats: Stats,
  creatorId: number,
  social: SocialSeed,
): Promise<void> {
  const existing = await findId(
    connection,
    `SELECT account_id AS id
     FROM creator_social_accounts
     WHERE creator_id = ? AND platform = ? AND username = ?
     LIMIT 1`,
    [creatorId, social.platform, social.username],
  );
  if (existing !== null) {
    bump(stats, "creator_social_accounts", "reused");
    return;
  }

  await connection.execute(
    `INSERT INTO creator_social_accounts
       (creator_id, platform, username, followers, engagement_rate, account_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      creatorId,
      social.platform,
      social.username,
      social.followers,
      social.engagementRate,
      social.accountUrl,
    ],
  );
  bump(stats, "creator_social_accounts", "inserted");
}

async function ensureCategory(
  connection: PoolConnection,
  stats: Stats,
  categoryName: string,
  description: string | null,
): Promise<number> {
  const existing = await findId(
    connection,
    "SELECT category_id AS id FROM campaign_categories WHERE category_name = ? LIMIT 1",
    [categoryName],
  );
  if (existing !== null) {
    bump(stats, "campaign_categories", "reused");
    return existing;
  }

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO campaign_categories (category_name, description)
     VALUES (?, ?)`,
    [categoryName, description],
  );
  bump(stats, "campaign_categories", "inserted");
  return Number(result.insertId);
}

async function ensureCampaign(
  connection: PoolConnection,
  stats: Stats,
  campaign: CampaignSeed,
  brandId: number,
  categoryId: number,
): Promise<number> {
  const existing = await findId(
    connection,
    `SELECT campaign_id AS id
     FROM campaigns
     WHERE brand_id = ? AND campaign_name = ?
     LIMIT 1`,
    [brandId, campaign.campaignName],
  );
  if (existing !== null) {
    bump(stats, "campaigns", "reused");
    return existing;
  }

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO campaigns
       (brand_id, category_id, campaign_name, description, budget,
        min_followers, start_date, end_date, status, max_creators, creator_limit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      brandId,
      categoryId,
      campaign.campaignName,
      campaign.description,
      campaign.budget,
      campaign.minFollowers,
      campaign.startDate,
      campaign.endDate,
      campaign.status,
      campaign.creatorLimit,
      campaign.creatorLimit,
    ],
  );
  bump(stats, "campaigns", "inserted");
  return Number(result.insertId);
}

async function ensureRequirement(
  connection: PoolConnection,
  stats: Stats,
  campaignId: number,
  requirement: RequirementSeed,
): Promise<void> {
  const existing = await findId(
    connection,
    `SELECT requirement_id AS id
     FROM campaign_requirements
     WHERE campaign_id = ? AND platform = ? AND required_niche <=> ?
     LIMIT 1`,
    [campaignId, requirement.platform, requirement.requiredNiche],
  );
  if (existing !== null) {
    bump(stats, "campaign_requirements", "reused");
    return;
  }

  await connection.execute(
    `INSERT INTO campaign_requirements
       (campaign_id, platform, required_niche, min_engagement_rate)
     VALUES (?, ?, ?, ?)`,
    [
      campaignId,
      requirement.platform,
      requirement.requiredNiche,
      requirement.minEngagementRate,
    ],
  );
  bump(stats, "campaign_requirements", "inserted");
}

async function ensureApplication(
  connection: PoolConnection,
  stats: Stats,
  campaignId: number,
  creatorId: number,
  appliedDate: string,
  status: ApplicationStatus,
): Promise<{ applicationId: number; status: ApplicationStatus }> {
  const [rows] = await connection.execute<
    Array<RowDataPacket & { application_id: number; status: ApplicationStatus }>
  >(
    `SELECT application_id, status
     FROM applications
     WHERE campaign_id = ? AND creator_id = ?
     LIMIT 1`,
    [campaignId, creatorId],
  );
  const existing = rows[0];

  if (existing) {
    bump(stats, "applications", "reused");
    return { applicationId: existing.application_id, status: existing.status };
  }

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO applications (campaign_id, creator_id, applied_date, status)
     VALUES (?, ?, ?, ?)`,
    [campaignId, creatorId, appliedDate, status],
  );
  bump(stats, "applications", "inserted");
  return {
    applicationId: Number(result.insertId),
    status,
  };
}

async function ensureCollaboration(
  connection: PoolConnection,
  stats: Stats,
  applicationId: number,
  seed: CollaborationSeed,
): Promise<number> {
  const existing = await findId(
    connection,
    "SELECT collaboration_id AS id FROM collaborations WHERE application_id = ? LIMIT 1",
    [applicationId],
  );
  if (existing !== null) {
    bump(stats, "collaborations", "reused");
    return existing;
  }

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO collaborations
       (application_id, agreed_amount, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?)`,
    [applicationId, seed.agreedAmount, seed.startDate, seed.endDate, seed.status],
  );
  bump(stats, "collaborations", "inserted");
  return Number(result.insertId);
}

async function ensureDeliverable(
  connection: PoolConnection,
  stats: Stats,
  collaborationId: number,
  deliverable: DeliverableSeed,
): Promise<number> {
  const existing = await findId(
    connection,
    `SELECT deliverable_id AS id
     FROM deliverables
     WHERE collaboration_id = ? AND content_type = ? AND due_date = ?
     LIMIT 1`,
    [collaborationId, deliverable.contentType, deliverable.dueDate],
  );
  if (existing !== null) {
    bump(stats, "deliverables", "reused");
    return existing;
  }

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO deliverables
       (collaboration_id, content_type, due_date, status)
     VALUES (?, ?, ?, ?)`,
    [
      collaborationId,
      deliverable.contentType,
      deliverable.dueDate,
      deliverable.status,
    ],
  );
  bump(stats, "deliverables", "inserted");
  return Number(result.insertId);
}

async function ensureSubmission(
  connection: PoolConnection,
  stats: Stats,
  deliverableId: number,
  submission: SubmissionSeed,
): Promise<void> {
  const existing = await findId(
    connection,
    `SELECT submission_id AS id
     FROM content_submissions
     WHERE deliverable_id = ? AND content_url = ?
     LIMIT 1`,
    [deliverableId, submission.contentUrl],
  );
  if (existing !== null) {
    bump(stats, "content_submissions", "reused");
    return;
  }

  await connection.execute(
    `INSERT INTO content_submissions
       (deliverable_id, content_url, submitted_date, approval_status)
     VALUES (?, ?, ?, ?)`,
    [
      deliverableId,
      submission.contentUrl,
      submission.submittedDate,
      submission.approvalStatus,
    ],
  );
  bump(stats, "content_submissions", "inserted");
}

async function ensureContract(
  connection: PoolConnection,
  stats: Stats,
  collaborationId: number,
  seed: CollaborationSeed,
): Promise<void> {
  const existing = await findId(
    connection,
    "SELECT contract_id AS id FROM contracts WHERE collaboration_id = ? LIMIT 1",
    [collaborationId],
  );
  if (existing !== null) {
    bump(stats, "contracts", "reused");
    return;
  }

  await connection.execute(
    `INSERT INTO contracts
       (collaboration_id, signed_date, expiry_date, contract_document)
     VALUES (?, ?, ?, ?)`,
    [
      collaborationId,
      seed.contract.signedDate,
      seed.contract.expiryDate,
      seed.contract.document,
    ],
  );
  bump(stats, "contracts", "inserted");
}

async function ensureMetrics(
  connection: PoolConnection,
  stats: Stats,
  collaborationId: number,
  seed: CollaborationSeed,
): Promise<void> {
  const existing = await findId(
    connection,
    "SELECT metric_id AS id FROM performance_metrics WHERE collaboration_id = ? LIMIT 1",
    [collaborationId],
  );
  if (existing !== null) {
    bump(stats, "performance_metrics", "reused");
    return;
  }

  await connection.execute(
    `INSERT INTO performance_metrics
       (collaboration_id, views, likes, comments, shares, clicks)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      collaborationId,
      seed.metrics.views,
      seed.metrics.likes,
      seed.metrics.comments,
      seed.metrics.shares,
      seed.metrics.clicks,
    ],
  );
  bump(stats, "performance_metrics", "inserted");
}

async function ensurePayment(
  connection: PoolConnection,
  stats: Stats,
  collaborationId: number,
  seed: CollaborationSeed,
): Promise<void> {
  const existing = await findId(
    connection,
    "SELECT payment_id AS id FROM payments WHERE collaboration_id = ? LIMIT 1",
    [collaborationId],
  );
  if (existing !== null) {
    bump(stats, "payments", "reused");
    return;
  }

  await connection.execute(
    `INSERT INTO payments
       (collaboration_id, amount, payment_date, status, transaction_reference)
     VALUES (?, ?, ?, ?, ?)`,
    [
      collaborationId,
      seed.agreedAmount,
      seed.payment.paymentDate,
      seed.payment.status,
      seed.payment.transactionReference,
    ],
  );
  bump(stats, "payments", "inserted");
}

async function ensureReview(
  connection: PoolConnection,
  stats: Stats,
  collaborationId: number,
  seed: CollaborationSeed,
): Promise<void> {
  if (!seed.review) {
    return;
  }

  const existing = await findId(
    connection,
    "SELECT review_id AS id FROM reviews WHERE collaboration_id = ? LIMIT 1",
    [collaborationId],
  );
  if (existing !== null) {
    bump(stats, "reviews", "reused");
    return;
  }

  await connection.execute(
    `INSERT INTO reviews (collaboration_id, rating, feedback, review_date)
     VALUES (?, ?, ?, ?)`,
    [
      collaborationId,
      seed.review.rating,
      seed.review.feedback,
      seed.review.reviewDate,
    ],
  );
  bump(stats, "reviews", "inserted");
}

type SnapshotRow = { id: number; value: string };

async function snapshotTable(
  connection: PoolConnection,
  table: string,
  primaryKey: string,
): Promise<Map<number, string>> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT * FROM \`${table}\` ORDER BY \`${primaryKey}\``,
  );
  const snapshot = new Map<number, string>();

  for (const row of rows) {
    const id = Number(row[primaryKey]);
    snapshot.set(id, JSON.stringify(row));
  }

  return snapshot;
}

async function collectSnapshots(): Promise<
  Array<{
    table: string;
    primaryKey: string;
    rows: Map<number, string>;
  }>
> {
  const snapshots = [];

  for (const [table, primaryKey] of PRESERVED_TABLES) {
    snapshots.push({
      table,
      primaryKey,
      rows: await snapshotTable(pool as unknown as PoolConnection, table, primaryKey),
    });
  }

  return snapshots;
}

async function countRows(
  connection: PoolConnection,
  table: string,
): Promise<number> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM \`${table}\``,
  );
  return Number(rows[0]?.count ?? 0);
}

async function scalar(
  sql: string,
  params: Array<string | number> = [],
): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
  return Number(rows[0]?.value ?? 0);
}

async function verifySeed(
  beforeCounts: Map<string, number>,
  snapshots: Awaited<ReturnType<typeof collectSnapshots>>,
  stats: Stats,
  demoCreatorId: number,
  demoBrandId: number,
): Promise<void> {
  console.log("\nVerification");

  for (const [table] of PRESERVED_TABLES) {
    const before = beforeCounts.get(table) ?? 0;
    const inserted = stats[table]?.inserted ?? 0;
    const after = await countRows(pool as unknown as PoolConnection, table);

    if (after !== before + inserted) {
      throw new Error(
        `Row count mismatch for ${table}: before=${before}, inserted=${inserted}, after=${after}.`,
      );
    }
  }
  console.log("  - Row counts match existing + inserted for all 15 tables.");

  for (const snapshot of snapshots) {
    const current = await snapshotTable(
      pool as unknown as PoolConnection,
      snapshot.table,
      snapshot.primaryKey,
    );

    for (const [id, value] of snapshot.rows) {
      if (!current.has(id) || current.get(id) !== value) {
        throw new Error(
          `Existing row ${snapshot.table}.${snapshot.primaryKey}=${id} was modified or removed.`,
        );
      }
    }
  }
  console.log("  - Every pre-existing row is byte-for-byte unchanged.");

  const orphanChecks = [
    ["brands -> users", "SELECT COUNT(*) AS value FROM brands b LEFT JOIN users u ON u.user_id = b.user_id WHERE u.user_id IS NULL"],
    ["creators -> users", "SELECT COUNT(*) AS value FROM creators c LEFT JOIN users u ON u.user_id = c.user_id WHERE u.user_id IS NULL"],
    ["social -> creators", "SELECT COUNT(*) AS value FROM creator_social_accounts s LEFT JOIN creators c ON c.creator_id = s.creator_id WHERE c.creator_id IS NULL"],
    ["campaigns -> brands", "SELECT COUNT(*) AS value FROM campaigns c LEFT JOIN brands b ON b.brand_id = c.brand_id WHERE b.brand_id IS NULL"],
    ["campaigns -> categories", "SELECT COUNT(*) AS value FROM campaigns c LEFT JOIN campaign_categories cc ON cc.category_id = c.category_id WHERE c.category_id IS NOT NULL AND cc.category_id IS NULL"],
    ["requirements -> campaigns", "SELECT COUNT(*) AS value FROM campaign_requirements r LEFT JOIN campaigns c ON c.campaign_id = r.campaign_id WHERE c.campaign_id IS NULL"],
    ["applications -> campaigns", "SELECT COUNT(*) AS value FROM applications a LEFT JOIN campaigns c ON c.campaign_id = a.campaign_id WHERE c.campaign_id IS NULL"],
    ["applications -> creators", "SELECT COUNT(*) AS value FROM applications a LEFT JOIN creators c ON c.creator_id = a.creator_id WHERE c.creator_id IS NULL"],
    ["collaborations -> applications", "SELECT COUNT(*) AS value FROM collaborations co LEFT JOIN applications a ON a.application_id = co.application_id WHERE a.application_id IS NULL"],
    ["deliverables -> collaborations", "SELECT COUNT(*) AS value FROM deliverables d LEFT JOIN collaborations co ON co.collaboration_id = d.collaboration_id WHERE co.collaboration_id IS NULL"],
    ["submissions -> deliverables", "SELECT COUNT(*) AS value FROM content_submissions s LEFT JOIN deliverables d ON d.deliverable_id = s.deliverable_id WHERE d.deliverable_id IS NULL"],
    ["contracts -> collaborations", "SELECT COUNT(*) AS value FROM contracts ct LEFT JOIN collaborations co ON co.collaboration_id = ct.collaboration_id WHERE co.collaboration_id IS NULL"],
    ["payments -> collaborations", "SELECT COUNT(*) AS value FROM payments p LEFT JOIN collaborations co ON co.collaboration_id = p.collaboration_id WHERE co.collaboration_id IS NULL"],
    ["metrics -> collaborations", "SELECT COUNT(*) AS value FROM performance_metrics pm LEFT JOIN collaborations co ON co.collaboration_id = pm.collaboration_id WHERE co.collaboration_id IS NULL"],
    ["reviews -> collaborations", "SELECT COUNT(*) AS value FROM reviews r LEFT JOIN collaborations co ON co.collaboration_id = r.collaboration_id WHERE co.collaboration_id IS NULL"],
  ] as const;

  for (const [label, sql] of orphanChecks) {
    const orphans = await scalar(sql);
    if (orphans !== 0) {
      throw new Error(`Foreign-key integrity failed for ${label}: ${orphans} orphan row(s).`);
    }
  }
  console.log("  - All 15 foreign-key relationships are valid.");

  const duplicateChecks = [
    [
      "duplicate applications",
      "SELECT COUNT(*) AS value FROM (SELECT campaign_id, creator_id FROM applications GROUP BY campaign_id, creator_id HAVING COUNT(*) > 1) duplicated",
    ],
    [
      "duplicate collaborations",
      "SELECT COUNT(*) AS value FROM (SELECT application_id FROM collaborations GROUP BY application_id HAVING COUNT(*) > 1) duplicated",
    ],
    [
      "duplicate reviews",
      "SELECT COUNT(*) AS value FROM (SELECT collaboration_id FROM reviews GROUP BY collaboration_id HAVING COUNT(*) > 1) duplicated",
    ],
    [
      "duplicate demo campaigns",
      "SELECT COUNT(*) AS value FROM (SELECT c.brand_id, c.campaign_name FROM campaigns c INNER JOIN brands b ON b.brand_id = c.brand_id WHERE b.user_id IN (SELECT user_id FROM users WHERE email LIKE ?) GROUP BY c.brand_id, c.campaign_name HAVING COUNT(*) > 1) duplicated",
    ],
  ] as const;

  for (const [label, sql] of duplicateChecks) {
    const duplicates = await scalar(
      sql,
      label === "duplicate demo campaigns" ? [`%@${DEMO_EMAIL_DOMAIN}`] : [],
    );
    if (duplicates !== 0) {
      throw new Error(`Idempotency check failed for ${label}: ${duplicates} duplicate group(s).`);
    }
  }
  console.log("  - No duplicate demo applications, collaborations, reviews, or campaigns.");

  const selectedCreator = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS applications,
            (SELECT COUNT(*) FROM collaborations co
             INNER JOIN applications a ON a.application_id = co.application_id
             WHERE a.creator_id = ?) AS collaborations,
            (SELECT COUNT(*) FROM payments p
             INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
             INNER JOIN applications a ON a.application_id = co.application_id
             WHERE a.creator_id = ?) AS payments
     FROM applications WHERE creator_id = ?`,
    [demoCreatorId, demoCreatorId, demoCreatorId],
  );
  const selected = selectedCreator[0][0];
  console.log(
    `  - Demo creator data visible: ${Number(selected?.applications ?? 0)} applications, ` +
      `${Number(selected?.collaborations ?? 0)} collaborations, ` +
      `${Number(selected?.payments ?? 0)} payments.`,
  );

  const brandCampaigns = await scalar(
    "SELECT COUNT(*) AS value FROM campaigns WHERE brand_id = ?",
    [demoBrandId],
  );
  if (brandCampaigns === 0) {
    throw new Error("Demo brand isolation check failed: the demo brand has no campaigns.");
  }
  console.log(`  - Demo brand isolation: the sampled brand owns ${brandCampaigns} campaign(s).`);

  const summary = await pool.query<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM campaigns) AS campaigns,
       (SELECT COUNT(*) FROM campaigns WHERE status = 'Open'
          AND start_date <= CURRENT_DATE() AND end_date >= CURRENT_DATE()) AS open_now,
       (SELECT COUNT(*) FROM campaigns WHERE status = 'Ongoing') AS ongoing,
       (SELECT COUNT(*) FROM campaigns WHERE status = 'Completed') AS completed_campaigns,
       (SELECT COUNT(*) FROM creators) AS creators,
       (SELECT COUNT(*) FROM brands) AS brands,
       (SELECT COUNT(*) FROM applications) AS applications,
       (SELECT COUNT(*) FROM applications WHERE status = 'Pending') AS pending_applications,
       (SELECT COUNT(*) FROM applications WHERE status = 'Accepted') AS accepted_applications,
       (SELECT COUNT(*) FROM applications WHERE status = 'Rejected') AS rejected_applications,
       (SELECT COUNT(*) FROM collaborations) AS collaborations,
       (SELECT COUNT(*) FROM collaborations WHERE status = 'Active') AS active_collaborations,
       (SELECT COUNT(*) FROM collaborations WHERE status = 'Completed') AS completed_collaborations,
       (SELECT COUNT(*) FROM deliverables) AS deliverables,
       (SELECT COUNT(*) FROM deliverables WHERE status = 'Pending') AS pending_deliverables,
       (SELECT COUNT(*) FROM deliverables WHERE status = 'Completed') AS completed_deliverables,
       (SELECT COUNT(*) FROM deliverables
          WHERE status = 'Pending' AND due_date < CURRENT_DATE()) AS overdue_deliverables,
       (SELECT COUNT(*) FROM content_submissions WHERE approval_status = 'Pending') AS pending_submissions,
       (SELECT COUNT(*) FROM content_submissions WHERE approval_status = 'Approved') AS approved_submissions,
       (SELECT COUNT(*) FROM payments) AS payments,
       (SELECT COUNT(*) FROM payments WHERE status = 'Paid') AS paid_payments,
       (SELECT COUNT(*) FROM payments WHERE status = 'Pending') AS pending_payments,
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'Paid') AS paid_total,
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'Pending') AS pending_total,
       (SELECT COUNT(*) FROM reviews) AS reviews,
       (SELECT AVG(rating) FROM reviews) AS average_rating`,
  );
  const s = summary[0][0];
  console.log("\nDashboard-consistent aggregate snapshot");
  console.table([
    {
      campaigns: Number(s.campaigns),
      open_now: Number(s.open_now),
      ongoing: Number(s.ongoing),
      completed_campaigns: Number(s.completed_campaigns),
      creators: Number(s.creators),
      brands: Number(s.brands),
      applications: Number(s.applications),
      pending_applications: Number(s.pending_applications),
      accepted_applications: Number(s.accepted_applications),
      rejected_applications: Number(s.rejected_applications),
      collaborations: Number(s.collaborations),
      active_collaborations: Number(s.active_collaborations),
      completed_collaborations: Number(s.completed_collaborations),
      deliverables: Number(s.deliverables),
      pending_deliverables: Number(s.pending_deliverables),
      completed_deliverables: Number(s.completed_deliverables),
      overdue_deliverables: Number(s.overdue_deliverables),
      pending_submissions: Number(s.pending_submissions),
      approved_submissions: Number(s.approved_submissions),
      payments: Number(s.payments),
      paid_payments: Number(s.paid_payments),
      pending_payments: Number(s.pending_payments),
      paid_total: String(s.paid_total),
      pending_total: String(s.pending_total),
      reviews: Number(s.reviews),
      average_rating: s.average_rating === null ? "n/a" : String(s.average_rating),
    },
  ]);
}

async function main(): Promise<void> {
  requireDemoEnvironment();

  console.log("CreatorConnect demo dataset seeder");
  console.log(`  Database: ${process.env.DB_NAME} on ${process.env.DB_HOST}`);
  console.log("  Environment verified as local/demo.");
  console.log("  This script only inserts demo rows; it never deletes or resets data.");

  const selectedCreatorRows = await pool.execute<
    Array<RowDataPacket & { creator_id: number; user_id: number; username: string }>
  >(
    `SELECT c.creator_id, c.user_id, u.username
     FROM creators c
     INNER JOIN users u ON u.user_id = c.user_id
     WHERE u.username = ?
     LIMIT 1`,
    [SELECTED_CREATOR_USERNAME],
  );
  const selectedCreator = selectedCreatorRows[0][0];

  if (!selectedCreator) {
    throw new Error(
      `The selected demo creator "${SELECTED_CREATOR_USERNAME}" was not found. ` +
        "Set DEMO_CREATOR_USERNAME to an existing creator username.",
    );
  }

  const beforeCounts = new Map<string, number>();
  for (const [table] of PRESERVED_TABLES) {
    beforeCounts.set(table, await countRows(pool as unknown as PoolConnection, table));
  }
  const snapshots = await collectSnapshots();

  const demoAccounts = [
    ...brandSeeds.map((brand) => ({
      username: brand.username,
      email: brand.email,
      role: "Brand" as const,
    })),
    ...creatorSeeds.map((creator) => ({
      username: creator.username,
      email: creator.email,
      role: "Creator" as const,
    })),
  ];

  const [existingAccountRows] = await pool.query<RowDataPacket[]>(
    `SELECT username, email FROM users
     WHERE username IN (${demoAccounts.map(() => "?").join(", ")})
        OR email IN (${demoAccounts.map(() => "?").join(", ")})`,
    [
      ...demoAccounts.map((account) => account.username),
      ...demoAccounts.map((account) => account.email),
    ],
  );
  const existingAccountKeys = new Set<string>();
  for (const row of existingAccountRows) {
    existingAccountKeys.add(String(row.username).toLowerCase());
    existingAccountKeys.add(String(row.email).toLowerCase());
  }

  const passwordHashes = new Map<string, string>();
  for (const account of demoAccounts) {
    if (
      existingAccountKeys.has(account.username.toLowerCase()) ||
      existingAccountKeys.has(account.email.toLowerCase())
    ) {
      continue;
    }
    passwordHashes.set(account.username, await hashPassword(DEMO_PASSWORD));
  }

  const stats: Stats = {};
  const brandIds = new Map<string, number>();
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();

    const categoryIds = new Map<string, number>();
    for (const category of categorySeeds) {
      categoryIds.set(
        category.categoryName,
        await ensureCategory(
          connection,
          stats,
          category.categoryName,
          category.description,
        ),
      );
    }

    const [existingCategoryRows] = await connection.query<
      Array<RowDataPacket & { category_id: number; category_name: string }>
    >("SELECT category_id, category_name FROM campaign_categories");
    for (const category of existingCategoryRows) {
      categoryIds.set(category.category_name, category.category_id);
    }

    for (const brand of brandSeeds) {
      const userId = await ensureUser(connection, stats, {
        ...brand,
        role: "Brand",
        passwordHashes,
      });
      brandIds.set(
        brand.key,
        await ensureBrand(connection, stats, brand, userId),
      );
    }

    const creatorIds = new Map<string, number>();
    creatorIds.set("shetty", selectedCreator.creator_id);

    for (const creator of creatorSeeds) {
      const userId = await ensureUser(connection, stats, {
        ...creator,
        role: "Creator",
        passwordHashes,
      });
      const creatorId = await ensureCreator(
        connection,
        stats,
        creator,
        userId,
      );
      creatorIds.set(creator.key, creatorId);

      for (const social of creator.socials) {
        await ensureSocialAccount(connection, stats, creatorId, social);
      }
    }

    const campaignIds = new Map<string, number>();
    for (const campaign of campaignSeeds) {
      const brandId = brandIds.get(campaign.brandKey);
      const categoryId = categoryIds.get(campaign.categoryName);

      if (brandId === undefined || categoryId === undefined) {
        throw new Error(`Missing brand or category for campaign ${campaign.key}.`);
      }

      const campaignId = await ensureCampaign(
        connection,
        stats,
        campaign,
        brandId,
        categoryId,
      );
      campaignIds.set(campaign.key, campaignId);

      for (const requirement of campaign.requirements) {
        await ensureRequirement(connection, stats, campaignId, requirement);
      }
    }

    for (const seed of collaborationSeeds) {
      const campaignId = campaignIds.get(seed.campaignKey);
      const creatorId = creatorIds.get(seed.creatorKey);

      if (campaignId === undefined || creatorId === undefined) {
        throw new Error(
          `Missing campaign or creator for collaboration ${seed.campaignKey}/${seed.creatorKey}.`,
        );
      }

      const application = await ensureApplication(
        connection,
        stats,
        campaignId,
        creatorId,
        seed.appliedDate,
        "Accepted",
      );

      if (application.status !== "Accepted") {
        console.warn(
          `  ! Skipping collaboration creation for ${seed.campaignKey}/${seed.creatorKey}: ` +
            `its existing application is ${application.status}.`,
        );
        continue;
      }

      const collaborationId = await ensureCollaboration(
        connection,
        stats,
        application.applicationId,
        seed,
      );

      await ensureContract(connection, stats, collaborationId, seed);
      await ensureMetrics(connection, stats, collaborationId, seed);

      for (const deliverable of seed.deliverables) {
        const deliverableId = await ensureDeliverable(
          connection,
          stats,
          collaborationId,
          deliverable,
        );
        for (const submission of deliverable.submissions) {
          await ensureSubmission(
            connection,
            stats,
            deliverableId,
            submission,
          );
        }
      }

      await ensurePayment(connection, stats, collaborationId, seed);
      await ensureReview(connection, stats, collaborationId, seed);
    }

    for (const applicationSeed of [
      ...pendingApplicationSeeds,
      ...rejectedApplicationSeeds,
    ]) {
      const campaignId = campaignIds.get(applicationSeed.campaignKey);
      const creatorId = creatorIds.get(applicationSeed.creatorKey);

      if (campaignId === undefined || creatorId === undefined) {
        throw new Error(
          `Missing campaign or creator for application ${applicationSeed.campaignKey}/${applicationSeed.creatorKey}.`,
        );
      }

      await ensureApplication(
        connection,
        stats,
        campaignId,
        creatorId,
        applicationSeed.appliedDate,
        applicationSeed.status,
      );
    }

    await connection.commit();
  } catch (error) {
    try {
      await connection.rollback();
      console.error("  Transaction rolled back. No demo rows were committed.");
    } catch (rollbackError) {
      connection.destroy();
      connectionDestroyed = true;
      console.error(
        "  Rollback failed; the database connection was discarded.",
        rollbackError instanceof Error ? rollbackError.message : rollbackError,
      );
    }
    throw error;
  } finally {
    if (!connectionDestroyed) {
      connection.release();
    }
  }

  const entities = [
    "users",
    "creators",
    "creator_social_accounts",
    "brands",
    "campaign_categories",
    "campaigns",
    "campaign_requirements",
    "applications",
    "collaborations",
    "deliverables",
    "content_submissions",
    "contracts",
    "payments",
    "performance_metrics",
    "reviews",
  ];

  console.log("\nInserted / reused demo records");
  console.table(
    entities.map((entity) => ({
      entity,
      inserted: stats[entity]?.inserted ?? 0,
      reused: stats[entity]?.reused ?? 0,
    })),
  );

  const preserved = Array.from(beforeCounts.values()).reduce(
    (sum, count) => sum + count,
    0,
  );
  console.log(`Existing records preserved untouched: ${preserved}`);

  await verifySeed(
    beforeCounts,
    snapshots,
    stats,
    selectedCreator.creator_id,
    brandIds.get("lumen") ?? 0,
  );

  const insertedAccounts = (stats.users?.inserted ?? 0) > 0;
  if (insertedAccounts) {
    console.log("\nNew demo login accounts");
    console.log(`  Password for every newly created demo account: ${DEMO_PASSWORD}`);
    console.log(`  Example creator: demo.aditi.menon@${DEMO_EMAIL_DOMAIN}`);
    console.log(`  Example brand:   ${brandSeeds[0]?.email}`);
    console.log(
      `  Existing selected creator "${SELECTED_CREATOR_USERNAME}" keeps its original password.`,
    );
  } else {
    console.log(
      "\nAll demo accounts already existed; their passwords were not changed.",
    );
  }

  console.log("\nDemo seeding completed successfully.");
}

main()
  .catch((error: unknown) => {
    console.error(
      `\nDemo seeding failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
