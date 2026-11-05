import type { RowDataPacket } from "mysql2/promise";

import type { Role } from "../src/lib/auth/constants";
import { closeMongoConnection, getMongoDatabase } from "../src/lib/mongodb";
import { closePool, query } from "../src/lib/db";
import {
  addSeedActivity,
  addSeedMessage,
  addSeedNotification,
} from "../src/lib/repositories/mongo-platform";

/*
 * CreatorConnect MongoDB demonstration seeder.
 *
 * Safety:
 *   - Only inserts missing demo records; it never deletes, resets, or updates
 *     existing MySQL or MongoDB data.
 *   - Every record is upserted by a stable demo dedupe key, so repeated runs
 *     are idempotent.
 *   - User, collaboration, application, campaign, deliverable, and payment
 *     references are resolved from the live MySQL demo data. Nothing is
 *     invented or hardcoded to a non-existent identifier.
 *   - New records are marked with metadata { demo: true, isDemo: true }.
 *
 * Run with:
 *   npm run mongo:seed-demo
 */

const HOUR_MS = 60 * 60 * 1000;
const DEMO_METADATA = { demo: true, isDemo: true, seedVersion: "v2" };

type UserRow = RowDataPacket & {
  user_id: number;
  username: string;
  role: Role;
};

type CollaborationRow = RowDataPacket & {
  collaboration_id: number;
  application_id: number;
  campaign_id: number;
  creator_user_id: number;
  brand_user_id: number;
  creator_username: string;
  brand_username: string;
  brand_name: string;
  campaign_name: string;
  status: string;
};

type ApplicationRow = RowDataPacket & {
  application_id: number;
  status: "Pending" | "Accepted" | "Rejected";
  creator_username: string;
  brand_username: string;
  campaign_name: string;
};

type CampaignRow = RowDataPacket & {
  campaign_id: number;
  campaign_name: string;
  brand_username: string;
  brand_name: string;
};

type DeliverableRow = RowDataPacket & {
  deliverable_id: number;
  collaboration_id: number;
};

type PaymentRow = RowDataPacket & {
  payment_id: number;
  collaboration_id: number;
};

type EntityRef =
  | {
      kind: "collaboration";
      creatorUsername: string;
      campaignName: string;
    }
  | {
      kind: "deliverable";
      creatorUsername: string;
      campaignName: string;
    }
  | {
      kind: "payment";
      creatorUsername: string;
      campaignName: string;
    }
  | {
      kind: "application";
      creatorUsername?: string;
      brandUsername?: string;
      campaignName: string;
      status: "Pending" | "Accepted" | "Rejected";
    }
  | {
      kind: "campaign";
      brandUsername: string;
      campaignName: string;
    }
  | { kind: "none" };

type ResolvedEntity = {
  relatedEntityId: string | number | null;
  relatedEntityType: string | null;
  collaboration?: CollaborationRow;
};

type DemoContext = {
  users: UserRow[];
  collaborations: CollaborationRow[];
  applications: ApplicationRow[];
  campaigns: CampaignRow[];
  deliverables: DeliverableRow[];
  payments: PaymentRow[];
  userByUsername: Map<string, UserRow>;
  collaborationByCreatorCampaign: Map<string, CollaborationRow>;
  campaignByBrandName: Map<string, CampaignRow>;
  deliverablesByCollaboration: Map<number, DeliverableRow[]>;
  paymentsByCollaboration: Map<number, PaymentRow[]>;
};

type NotificationSeed = {
  role: Role;
  username: string;
  type: string;
  title: string;
  message: string;
  entity: EntityRef;
  isRead: boolean;
  hoursAgo: number;
  slug: string;
};

type ActivitySeed = {
  actorUsername: string;
  actorRole: Role;
  action: string;
  entity: EntityRef;
  description: string;
  hoursAgo: number;
  slug: string;
};

type MessageSeed = {
  creatorUsername: string;
  campaignName: string;
  senderRole: "Creator" | "Brand";
  message: string;
  hoursAgo: number;
  slug: string;
};

const creatorNotificationSeeds: NotificationSeed[] = [
  {
    role: "Creator",
    username: "shetty_shibi",
    type: "application_accepted",
    title: "Application accepted",
    message:
      "Lumen & Loom accepted your application for Lumen Winter Layer Edit. Review the collaboration brief and deliverables.",
    entity: {
      kind: "application",
      creatorUsername: "shetty_shibi",
      campaignName: "Lumen Winter Layer Edit",
      status: "Accepted",
    },
    isRead: false,
    hoursAgo: 5,
    slug: "application-accepted-lumen",
  },
  {
    role: "Creator",
    username: "shetty_shibi",
    type: "collaboration_message",
    title: "New collaboration message",
    message: "PulseWave Audio sent you a message about Street Sound Sessions.",
    entity: {
      kind: "collaboration",
      creatorUsername: "shetty_shibi",
      campaignName: "Street Sound Sessions",
    },
    isRead: false,
    hoursAgo: 2,
    slug: "message-street-sound",
  },
  {
    role: "Creator",
    username: "demo.tanvi.shah",
    type: "deliverable_submitted",
    title: "Deliverable submitted",
    message:
      "Your Reel for Lumen Winter Layer Edit was submitted and is now with the brand for review.",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.tanvi.shah",
      campaignName: "Lumen Winter Layer Edit",
    },
    isRead: true,
    hoursAgo: 30,
    slug: "deliverable-lumen",
  },
  {
    role: "Creator",
    username: "demo.tanvi.shah",
    type: "payment_completed",
    title: "Payment completed",
    message:
      "Lumen & Loom marked your payment for Lumen Winter Layer Edit as paid.",
    entity: {
      kind: "payment",
      creatorUsername: "demo.tanvi.shah",
      campaignName: "Lumen Winter Layer Edit",
    },
    isRead: true,
    hoursAgo: 48,
    slug: "payment-lumen",
  },
  {
    role: "Creator",
    username: "demo.nisha.verma",
    type: "deliverable_submitted",
    title: "Deliverable submitted",
    message:
      "Your second Reel for Himalayan Trail Tested was submitted successfully.",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.nisha.verma",
      campaignName: "Himalayan Trail Tested",
    },
    isRead: true,
    hoursAgo: 26,
    slug: "deliverable-northpeak",
  },
  {
    role: "Creator",
    username: "demo.nisha.verma",
    type: "payment_completed",
    title: "Payment completed",
    message:
      "NorthPeak Outdoors completed your payment for Himalayan Trail Tested.",
    entity: {
      kind: "payment",
      creatorUsername: "demo.nisha.verma",
      campaignName: "Himalayan Trail Tested",
    },
    isRead: false,
    hoursAgo: 10,
    slug: "payment-northpeak",
  },
  {
    role: "Creator",
    username: "demo.sameer.joshi",
    type: "collaboration_started",
    title: "Collaboration started",
    message:
      "Your collaboration with NorthPeak Outdoors for Himalayan Trail Tested is now active.",
    entity: {
      kind: "collaboration",
      creatorUsername: "demo.sameer.joshi",
      campaignName: "Himalayan Trail Tested",
    },
    isRead: true,
    hoursAgo: 96,
    slug: "collaboration-northpeak",
  },
  {
    role: "Creator",
    username: "demo.sameer.joshi",
    type: "deliverable_revision",
    title: "Revision requested",
    message:
      "NorthPeak Outdoors requested a small revision to your trail story deliverable.",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.sameer.joshi",
      campaignName: "Himalayan Trail Tested",
    },
    isRead: false,
    hoursAgo: 8,
    slug: "revision-northpeak",
  },
  {
    role: "Creator",
    username: "demo.diya.sethi",
    type: "application_accepted",
    title: "Application accepted",
    message:
      "NorthPeak Outdoors accepted your application for Weekend Camping Checklist.",
    entity: {
      kind: "application",
      creatorUsername: "demo.diya.sethi",
      campaignName: "Weekend Camping Checklist",
      status: "Accepted",
    },
    isRead: true,
    hoursAgo: 120,
    slug: "application-accepted-northpeak",
  },
  {
    role: "Creator",
    username: "demo.diya.sethi",
    type: "payment_completed",
    title: "Payment completed",
    message: "Payment for Weekend Camping Checklist has been marked as paid.",
    entity: {
      kind: "payment",
      creatorUsername: "demo.diya.sethi",
      campaignName: "Weekend Camping Checklist",
    },
    isRead: true,
    hoursAgo: 60,
    slug: "payment-northpeak-camping",
  },
  {
    role: "Creator",
    username: "demo.karan.bedi",
    type: "deliverable_submitted",
    title: "Deliverable submitted",
    message:
      "Your studio video for Podcast Studio Makeover is awaiting brand review.",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.karan.bedi",
      campaignName: "Podcast Studio Makeover",
    },
    isRead: true,
    hoursAgo: 50,
    slug: "deliverable-pulsewave",
  },
  {
    role: "Creator",
    username: "demo.karan.bedi",
    type: "payment_completed",
    title: "Payment completed",
    message:
      "PulseWave Audio completed your payment for Podcast Studio Makeover.",
    entity: {
      kind: "payment",
      creatorUsername: "demo.karan.bedi",
      campaignName: "Podcast Studio Makeover",
    },
    isRead: false,
    hoursAgo: 6,
    slug: "payment-pulsewave",
  },
  {
    role: "Creator",
    username: "demo.aarav.pillai",
    type: "campaign_application",
    title: "New campaign application",
    message:
      "Your application for No-Code AI Workflow Sprint was received and is under review.",
    entity: {
      kind: "application",
      creatorUsername: "demo.aarav.pillai",
      campaignName: "No-Code AI Workflow Sprint",
      status: "Pending",
    },
    isRead: true,
    hoursAgo: 100,
    slug: "application-bytebloom",
  },
  {
    role: "Creator",
    username: "demo.aarav.pillai",
    type: "campaign_update",
    title: "Campaign update",
    message:
      "ByteBloom Labs updated the No-Code AI Workflow Sprint brief with new submission guidelines.",
    entity: {
      kind: "campaign",
      brandUsername: "demo.brand.bytebloom",
      campaignName: "No-Code AI Workflow Sprint",
    },
    isRead: true,
    hoursAgo: 70,
    slug: "campaign-update-bytebloom",
  },
  {
    role: "Creator",
    username: "demo.riya.kapoor",
    type: "deliverable_submitted",
    title: "Deliverable submitted",
    message:
      "Your garden series Reel for Balcony Garden Diaries was submitted successfully.",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.riya.kapoor",
      campaignName: "Balcony Garden Diaries",
    },
    isRead: true,
    hoursAgo: 80,
    slug: "deliverable-verdant",
  },
  {
    role: "Creator",
    username: "demo.riya.kapoor",
    type: "payment_completed",
    title: "Payment completed",
    message:
      "Verdant Home completed your payment for Balcony Garden Diaries.",
    entity: {
      kind: "payment",
      creatorUsername: "demo.riya.kapoor",
      campaignName: "Balcony Garden Diaries",
    },
    isRead: true,
    hoursAgo: 70,
    slug: "payment-verdant",
  },
  {
    role: "Creator",
    username: "demo.dev.malhotra",
    type: "deliverable_submitted",
    title: "Deliverable submitted",
    message:
      "Your indie discovery video for Indie Game Discovery Week was submitted.",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.dev.malhotra",
      campaignName: "Indie Game Discovery Week",
    },
    isRead: true,
    hoursAgo: 85,
    slug: "deliverable-prism",
  },
  {
    role: "Creator",
    username: "demo.dev.malhotra",
    type: "payment_completed",
    title: "Payment completed",
    message:
      "Prism Play Studio completed your payment for Indie Game Discovery Week.",
    entity: {
      kind: "payment",
      creatorUsername: "demo.dev.malhotra",
      campaignName: "Indie Game Discovery Week",
    },
    isRead: false,
    hoursAgo: 18,
    slug: "payment-prism",
  },
  {
    role: "Creator",
    username: "demo.mohit.rana",
    type: "collaboration_message",
    title: "New collaboration message",
    message:
      "Prism Play Studio sent you a message about Indie Game Discovery Week.",
    entity: {
      kind: "collaboration",
      creatorUsername: "demo.mohit.rana",
      campaignName: "Indie Game Discovery Week",
    },
    isRead: false,
    hoursAgo: 4,
    slug: "message-prism",
  },
  {
    role: "Creator",
    username: "demo.mohit.rana",
    type: "application_rejected",
    title: "Application update",
    message:
      "Your application for Podcast Studio Makeover was not selected this time.",
    entity: {
      kind: "application",
      creatorUsername: "demo.mohit.rana",
      campaignName: "Podcast Studio Makeover",
      status: "Rejected",
    },
    isRead: false,
    hoursAgo: 1,
    slug: "application-rejected-pulsewave",
  },
];

const brandNotificationSeeds: NotificationSeed[] = [
  {
    role: "Brand",
    username: "demo.brand.lumenloom",
    type: "collaboration_message",
    title: "New collaboration message",
    message:
      "shetty_shibi sent you a message about Lumen Winter Layer Edit.",
    entity: {
      kind: "collaboration",
      creatorUsername: "shetty_shibi",
      campaignName: "Lumen Winter Layer Edit",
    },
    isRead: false,
    hoursAgo: 5,
    slug: "message-lumen",
  },
  {
    role: "Brand",
    username: "demo.brand.lumenloom",
    type: "payment_completed",
    title: "Payment completed",
    message:
      "The payment for shetty_shibi on Lumen Winter Layer Edit is marked as paid.",
    entity: {
      kind: "payment",
      creatorUsername: "shetty_shibi",
      campaignName: "Lumen Winter Layer Edit",
    },
    isRead: true,
    hoursAgo: 30,
    slug: "payment-lumen",
  },
  {
    role: "Brand",
    username: "demo.brand.northpeak",
    type: "deliverable_submitted",
    title: "Deliverable submitted",
    message:
      "demo.nisha.verma submitted a new deliverable for Himalayan Trail Tested.",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.nisha.verma",
      campaignName: "Himalayan Trail Tested",
    },
    isRead: false,
    hoursAgo: 3,
    slug: "deliverable-northpeak",
  },
  {
    role: "Brand",
    username: "demo.brand.northpeak",
    type: "application_rejected",
    title: "Application rejected",
    message:
      "demo.neel.sharma's application for Weekend Camping Checklist was rejected.",
    entity: {
      kind: "application",
      creatorUsername: "demo.neel.sharma",
      campaignName: "Weekend Camping Checklist",
      status: "Rejected",
    },
    isRead: true,
    hoursAgo: 26,
    slug: "application-rejected-camping",
  },
  {
    role: "Brand",
    username: "demo.brand.pulsewave",
    type: "deliverable_revision",
    title: "Revision requested",
    message:
      "A revision was requested on demo.karan.bedi's Podcast Studio Makeover deliverable.",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.karan.bedi",
      campaignName: "Podcast Studio Makeover",
    },
    isRead: false,
    hoursAgo: 7,
    slug: "revision-podcast",
  },
  {
    role: "Brand",
    username: "demo.brand.pulsewave",
    type: "payment_completed",
    title: "Payment completed",
    message:
      "Payment for demo.karan.bedi on Podcast Studio Makeover is marked as paid.",
    entity: {
      kind: "payment",
      creatorUsername: "demo.karan.bedi",
      campaignName: "Podcast Studio Makeover",
    },
    isRead: true,
    hoursAgo: 44,
    slug: "payment-podcast",
  },
  {
    role: "Brand",
    username: "demo.brand.verdanthome",
    type: "collaboration_started",
    title: "Collaboration started",
    message:
      "Your collaboration with demo.riya.kapoor for Balcony Garden Diaries is active.",
    entity: {
      kind: "collaboration",
      creatorUsername: "demo.riya.kapoor",
      campaignName: "Balcony Garden Diaries",
    },
    isRead: true,
    hoursAgo: 90,
    slug: "collaboration-verdant",
  },
  {
    role: "Brand",
    username: "demo.brand.verdanthome",
    type: "application_rejected",
    title: "Application rejected",
    message:
      "demo.anika.ghosh's application for Balcony Garden Diaries was rejected.",
    entity: {
      kind: "application",
      creatorUsername: "demo.anika.ghosh",
      campaignName: "Balcony Garden Diaries",
      status: "Rejected",
    },
    isRead: true,
    hoursAgo: 60,
    slug: "application-rejected-verdant",
  },
  {
    role: "Brand",
    username: "demo.brand.prismplay",
    type: "payment_completed",
    title: "Payment completed",
    message:
      "Payment for demo.dev.malhotra on Indie Game Discovery Week is marked as paid.",
    entity: {
      kind: "payment",
      creatorUsername: "demo.dev.malhotra",
      campaignName: "Indie Game Discovery Week",
    },
    isRead: false,
    hoursAgo: 16,
    slug: "payment-prism",
  },
  {
    role: "Brand",
    username: "demo.brand.prismplay",
    type: "campaign_update",
    title: "Campaign update",
    message:
      "Indie Game Discovery Week was updated with a new spotlight on co-op titles.",
    entity: {
      kind: "campaign",
      brandUsername: "demo.brand.prismplay",
      campaignName: "Indie Game Discovery Week",
    },
    isRead: true,
    hoursAgo: 52,
    slug: "campaign-update-prism",
  },
  {
    role: "Brand",
    username: "demo.brand.bytebloom",
    type: "campaign_application",
    title: "New campaign application",
    message:
      "A new creator application was received for No-Code AI Workflow Sprint.",
    entity: {
      kind: "application",
      brandUsername: "demo.brand.bytebloom",
      campaignName: "No-Code AI Workflow Sprint",
      status: "Pending",
    },
    isRead: false,
    hoursAgo: 9,
    slug: "application-bytebloom",
  },
  {
    role: "Brand",
    username: "demo.brand.bytebloom",
    type: "campaign_update",
    title: "Campaign update",
    message:
      "No-Code AI Workflow Sprint now includes a revised content brief.",
    entity: {
      kind: "campaign",
      brandUsername: "demo.brand.bytebloom",
      campaignName: "No-Code AI Workflow Sprint",
    },
    isRead: true,
    hoursAgo: 66,
    slug: "campaign-update-bytebloom",
  },
  {
    role: "Brand",
    username: "demo.brand.nourishnest",
    type: "campaign_application",
    title: "New campaign application",
    message:
      "A new creator application was received for Weeknight Millet Meals.",
    entity: {
      kind: "application",
      brandUsername: "demo.brand.nourishnest",
      campaignName: "Weeknight Millet Meals",
      status: "Pending",
    },
    isRead: false,
    hoursAgo: 22,
    slug: "application-nourishnest",
  },
  {
    role: "Brand",
    username: "demo.brand.nourishnest",
    type: "platform_activity",
    title: "Platform activity summary",
    message:
      "Your campaign pipeline had new applications and creator profile updates this week.",
    entity: { kind: "none" },
    isRead: true,
    hoursAgo: 100,
    slug: "platform-summary",
  },
  {
    role: "Brand",
    username: "demo.brand.stridewell",
    type: "campaign_application",
    title: "New campaign application",
    message:
      "A new creator application was received for Everyday Sneaker Styling.",
    entity: {
      kind: "application",
      brandUsername: "demo.brand.stridewell",
      campaignName: "Everyday Sneaker Styling",
      status: "Pending",
    },
    isRead: false,
    hoursAgo: 14,
    slug: "application-stridewell",
  },
];

const adminNotificationSeeds: NotificationSeed[] = [
  {
    role: "Admin",
    username: "admin_creatorconnect",
    type: "platform_activity",
    title: "Weekly platform digest",
    message:
      "New creator applications, deliverable submissions, and payments were recorded this week.",
    entity: { kind: "none" },
    isRead: false,
    hoursAgo: 1,
    slug: "platform-digest",
  },
  {
    role: "Admin",
    username: "admin_creatorconnect",
    type: "campaign_application",
    title: "New campaign application",
    message:
      "demo.karan.bedi applied to Street Sound Sessions and is awaiting a brand decision.",
    entity: {
      kind: "application",
      creatorUsername: "demo.karan.bedi",
      campaignName: "Street Sound Sessions",
      status: "Pending",
    },
    isRead: false,
    hoursAgo: 2,
    slug: "application-street-sound",
  },
  {
    role: "Admin",
    username: "admin_creatorconnect",
    type: "collaboration_started",
    title: "Collaboration started",
    message:
      "A collaboration between shetty_shibi and PulseWave Audio is active for Street Sound Sessions.",
    entity: {
      kind: "collaboration",
      creatorUsername: "shetty_shibi",
      campaignName: "Street Sound Sessions",
    },
    isRead: true,
    hoursAgo: 12,
    slug: "collaboration-street-sound",
  },
  {
    role: "Admin",
    username: "admin_creatorconnect",
    type: "payment_completed",
    title: "Payment completed",
    message:
      "PulseWave Audio completed a demo payment for Podcast Studio Makeover.",
    entity: {
      kind: "payment",
      creatorUsername: "demo.karan.bedi",
      campaignName: "Podcast Studio Makeover",
    },
    isRead: false,
    hoursAgo: 26,
    slug: "payment-podcast",
  },
  {
    role: "Admin",
    username: "admin_creatorconnect",
    type: "deliverable_submitted",
    title: "Deliverable submitted",
    message:
      "demo.nisha.verma submitted a new deliverable for Himalayan Trail Tested.",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.nisha.verma",
      campaignName: "Himalayan Trail Tested",
    },
    isRead: true,
    hoursAgo: 40,
    slug: "deliverable-northpeak",
  },
];

const activitySeeds: ActivitySeed[] = [
  {
    actorUsername: "shetty_shibi",
    actorRole: "Creator",
    action: "application_submitted",
    entity: {
      kind: "application",
      creatorUsername: "shetty_shibi",
      campaignName: "Lumen Winter Layer Edit",
      status: "Accepted",
    },
    description: "shetty_shibi applied to Lumen Winter Layer Edit.",
    hoursAgo: 168,
    slug: "shetty-application-lumen",
  },
  {
    actorUsername: "demo.brand.lumenloom",
    actorRole: "Brand",
    action: "application_accepted",
    entity: {
      kind: "application",
      creatorUsername: "shetty_shibi",
      campaignName: "Lumen Winter Layer Edit",
      status: "Accepted",
    },
    description:
      "Lumen & Loom accepted shetty_shibi's application for Lumen Winter Layer Edit.",
    hoursAgo: 160,
    slug: "lumen-accepted-shetty",
  },
  {
    actorUsername: "shetty_shibi",
    actorRole: "Creator",
    action: "collaboration_started",
    entity: {
      kind: "collaboration",
      creatorUsername: "shetty_shibi",
      campaignName: "Lumen Winter Layer Edit",
    },
    description:
      "Collaboration started between shetty_shibi and Lumen & Loom for Lumen Winter Layer Edit.",
    hoursAgo: 150,
    slug: "shetty-collaboration-lumen",
  },
  {
    actorUsername: "demo.tanvi.shah",
    actorRole: "Creator",
    action: "application_submitted",
    entity: {
      kind: "application",
      creatorUsername: "demo.tanvi.shah",
      campaignName: "Lumen Winter Layer Edit",
      status: "Accepted",
    },
    description:
      "demo.tanvi.shah applied to Lumen Winter Layer Edit.",
    hoursAgo: 140,
    slug: "tanvi-application-lumen",
  },
  {
    actorUsername: "demo.brand.lumenloom",
    actorRole: "Brand",
    action: "application_accepted",
    entity: {
      kind: "application",
      creatorUsername: "demo.tanvi.shah",
      campaignName: "Lumen Winter Layer Edit",
      status: "Accepted",
    },
    description:
      "Lumen & Loom accepted demo.tanvi.shah's application for Lumen Winter Layer Edit.",
    hoursAgo: 135,
    slug: "lumen-accepted-tanvi",
  },
  {
    actorUsername: "demo.tanvi.shah",
    actorRole: "Creator",
    action: "deliverable_submitted",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.tanvi.shah",
      campaignName: "Lumen Winter Layer Edit",
    },
    description:
      "demo.tanvi.shah submitted a Reel for Lumen Winter Layer Edit.",
    hoursAgo: 130,
    slug: "tanvi-deliverable-lumen",
  },
  {
    actorUsername: "demo.brand.lumenloom",
    actorRole: "Brand",
    action: "deliverable_approved",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.tanvi.shah",
      campaignName: "Lumen Winter Layer Edit",
    },
    description:
      "Lumen & Loom approved the Reel submitted by demo.tanvi.shah.",
    hoursAgo: 125,
    slug: "lumen-approved-tanvi",
  },
  {
    actorUsername: "demo.brand.lumenloom",
    actorRole: "Brand",
    action: "payment_completed",
    entity: {
      kind: "payment",
      creatorUsername: "demo.tanvi.shah",
      campaignName: "Lumen Winter Layer Edit",
    },
    description:
      "Lumen & Loom completed payment for demo.tanvi.shah on Lumen Winter Layer Edit.",
    hoursAgo: 120,
    slug: "lumen-payment-tanvi",
  },
  {
    actorUsername: "demo.nisha.verma",
    actorRole: "Creator",
    action: "application_submitted",
    entity: {
      kind: "application",
      creatorUsername: "demo.nisha.verma",
      campaignName: "Himalayan Trail Tested",
      status: "Accepted",
    },
    description:
      "demo.nisha.verma applied to Himalayan Trail Tested.",
    hoursAgo: 115,
    slug: "nisha-application-northpeak",
  },
  {
    actorUsername: "demo.brand.northpeak",
    actorRole: "Brand",
    action: "application_accepted",
    entity: {
      kind: "application",
      creatorUsername: "demo.nisha.verma",
      campaignName: "Himalayan Trail Tested",
      status: "Accepted",
    },
    description:
      "NorthPeak Outdoors accepted demo.nisha.verma's application for Himalayan Trail Tested.",
    hoursAgo: 110,
    slug: "northpeak-accepted-nisha",
  },
  {
    actorUsername: "demo.nisha.verma",
    actorRole: "Creator",
    action: "deliverable_submitted",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.nisha.verma",
      campaignName: "Himalayan Trail Tested",
    },
    description:
      "demo.nisha.verma submitted a trail video for Himalayan Trail Tested.",
    hoursAgo: 105,
    slug: "nisha-deliverable-northpeak",
  },
  {
    actorUsername: "demo.brand.northpeak",
    actorRole: "Brand",
    action: "deliverable_approved",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.nisha.verma",
      campaignName: "Himalayan Trail Tested",
    },
    description:
      "NorthPeak Outdoors approved demo.nisha.verma's trail video.",
    hoursAgo: 100,
    slug: "northpeak-approved-nisha",
  },
  {
    actorUsername: "demo.sameer.joshi",
    actorRole: "Creator",
    action: "collaboration_message_sent",
    entity: {
      kind: "collaboration",
      creatorUsername: "demo.sameer.joshi",
      campaignName: "Himalayan Trail Tested",
    },
    description:
      "demo.sameer.joshi sent a message about Himalayan Trail Tested.",
    hoursAgo: 95,
    slug: "sameer-message-northpeak",
  },
  {
    actorUsername: "demo.brand.northpeak",
    actorRole: "Brand",
    action: "payment_completed",
    entity: {
      kind: "payment",
      creatorUsername: "demo.sameer.joshi",
      campaignName: "Himalayan Trail Tested",
    },
    description:
      "NorthPeak Outdoors completed payment for demo.sameer.joshi.",
    hoursAgo: 90,
    slug: "northpeak-payment-sameer",
  },
  {
    actorUsername: "demo.karan.bedi",
    actorRole: "Creator",
    action: "application_submitted",
    entity: {
      kind: "application",
      creatorUsername: "demo.karan.bedi",
      campaignName: "Podcast Studio Makeover",
      status: "Accepted",
    },
    description:
      "demo.karan.bedi applied to Podcast Studio Makeover.",
    hoursAgo: 85,
    slug: "karan-application-pulsewave",
  },
  {
    actorUsername: "demo.brand.pulsewave",
    actorRole: "Brand",
    action: "application_accepted",
    entity: {
      kind: "application",
      creatorUsername: "demo.karan.bedi",
      campaignName: "Podcast Studio Makeover",
      status: "Accepted",
    },
    description:
      "PulseWave Audio accepted demo.karan.bedi's application for Podcast Studio Makeover.",
    hoursAgo: 80,
    slug: "pulsewave-accepted-karan",
  },
  {
    actorUsername: "demo.karan.bedi",
    actorRole: "Creator",
    action: "deliverable_submitted",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.karan.bedi",
      campaignName: "Podcast Studio Makeover",
    },
    description:
      "demo.karan.bedi submitted a studio video for Podcast Studio Makeover.",
    hoursAgo: 75,
    slug: "karan-deliverable-pulsewave",
  },
  {
    actorUsername: "demo.brand.pulsewave",
    actorRole: "Brand",
    action: "revision_requested",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.karan.bedi",
      campaignName: "Podcast Studio Makeover",
    },
    description:
      "PulseWave Audio requested a revision to demo.karan.bedi's studio video.",
    hoursAgo: 70,
    slug: "pulsewave-revision-karan",
  },
  {
    actorUsername: "demo.aarav.pillai",
    actorRole: "Creator",
    action: "deliverable_submitted",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.aarav.pillai",
      campaignName: "Podcast Studio Makeover",
    },
    description:
      "demo.aarav.pillai submitted a post for Podcast Studio Makeover.",
    hoursAgo: 65,
    slug: "aarav-deliverable-pulsewave",
  },
  {
    actorUsername: "demo.brand.pulsewave",
    actorRole: "Brand",
    action: "payment_completed",
    entity: {
      kind: "payment",
      creatorUsername: "demo.aarav.pillai",
      campaignName: "Podcast Studio Makeover",
    },
    description:
      "PulseWave Audio completed payment for demo.aarav.pillai.",
    hoursAgo: 60,
    slug: "pulsewave-payment-aarav",
  },
  {
    actorUsername: "demo.riya.kapoor",
    actorRole: "Creator",
    action: "deliverable_submitted",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.riya.kapoor",
      campaignName: "Balcony Garden Diaries",
    },
    description:
      "demo.riya.kapoor submitted a garden Reel for Balcony Garden Diaries.",
    hoursAgo: 55,
    slug: "riya-deliverable-verdant",
  },
  {
    actorUsername: "demo.brand.verdanthome",
    actorRole: "Brand",
    action: "payment_completed",
    entity: {
      kind: "payment",
      creatorUsername: "demo.riya.kapoor",
      campaignName: "Balcony Garden Diaries",
    },
    description:
      "Verdant Home completed payment for demo.riya.kapoor.",
    hoursAgo: 50,
    slug: "verdant-payment-riya",
  },
  {
    actorUsername: "demo.dev.malhotra",
    actorRole: "Creator",
    action: "application_submitted",
    entity: {
      kind: "application",
      creatorUsername: "demo.dev.malhotra",
      campaignName: "Indie Game Discovery Week",
      status: "Accepted",
    },
    description:
      "demo.dev.malhotra applied to Indie Game Discovery Week.",
    hoursAgo: 45,
    slug: "dev-application-prism",
  },
  {
    actorUsername: "demo.brand.prismplay",
    actorRole: "Brand",
    action: "application_accepted",
    entity: {
      kind: "application",
      creatorUsername: "demo.dev.malhotra",
      campaignName: "Indie Game Discovery Week",
      status: "Accepted",
    },
    description:
      "Prism Play Studio accepted demo.dev.malhotra's application for Indie Game Discovery Week.",
    hoursAgo: 40,
    slug: "prism-accepted-dev",
  },
  {
    actorUsername: "demo.dev.malhotra",
    actorRole: "Creator",
    action: "deliverable_submitted",
    entity: {
      kind: "deliverable",
      creatorUsername: "demo.dev.malhotra",
      campaignName: "Indie Game Discovery Week",
    },
    description:
      "demo.dev.malhotra submitted an indie discovery video for Indie Game Discovery Week.",
    hoursAgo: 35,
    slug: "dev-deliverable-prism",
  },
  {
    actorUsername: "demo.brand.prismplay",
    actorRole: "Brand",
    action: "payment_completed",
    entity: {
      kind: "payment",
      creatorUsername: "demo.dev.malhotra",
      campaignName: "Indie Game Discovery Week",
    },
    description:
      "Prism Play Studio completed payment for demo.dev.malhotra.",
    hoursAgo: 30,
    slug: "prism-payment-dev",
  },
  {
    actorUsername: "admin_creatorconnect",
    actorRole: "Admin",
    action: "platform_activity_reviewed",
    entity: {
      kind: "collaboration",
      creatorUsername: "shetty_shibi",
      campaignName: "Street Sound Sessions",
    },
    description:
      "Administrator reviewed recent demo activity for Street Sound Sessions.",
    hoursAgo: 20,
    slug: "admin-reviewed-street-sound",
  },
  {
    actorUsername: "demo.brand.northpeak",
    actorRole: "Brand",
    action: "application_rejected",
    entity: {
      kind: "application",
      creatorUsername: "demo.rahul.bose",
      campaignName: "Himalayan Trail Tested",
      status: "Rejected",
    },
    description:
      "NorthPeak Outdoors rejected demo.rahul.bose's application for Himalayan Trail Tested.",
    hoursAgo: 10,
    slug: "northpeak-rejected-rahul",
  },
];

const messageSeeds: MessageSeed[] = [
  {
    creatorUsername: "shetty_shibi",
    campaignName: "Street Sound Sessions",
    senderRole: "Brand",
    message:
      "Hi Shibi — for the street sessions, could you include one clip recorded during evening traffic?",
    hoursAgo: 28,
    slug: "street-evening-traffic",
  },
  {
    creatorUsername: "shetty_shibi",
    campaignName: "Street Sound Sessions",
    senderRole: "Creator",
    message:
      "Absolutely. I'm planning two takes: one near the market and one at the metro exit.",
    hoursAgo: 27,
    slug: "street-two-takes",
  },
  {
    creatorUsername: "shetty_shibi",
    campaignName: "Street Sound Sessions",
    senderRole: "Brand",
    message:
      "Perfect. Please keep the captions minimal so the live audio stands out.",
    hoursAgo: 26,
    slug: "street-captions",
  },
  {
    creatorUsername: "shetty_shibi",
    campaignName: "Street Sound Sessions",
    senderRole: "Creator",
    message: "Will do. I'll share the first draft tomorrow evening.",
    hoursAgo: 25,
    slug: "street-first-draft",
  },
  {
    creatorUsername: "shetty_shibi",
    campaignName: "Zero-Waste Kitchen Reset",
    senderRole: "Brand",
    message:
      "The kitchen reset brief now includes a compost segment. Does that fit your filming setup?",
    hoursAgo: 22,
    slug: "kitchen-compost-segment",
  },
  {
    creatorUsername: "shetty_shibi",
    campaignName: "Zero-Waste Kitchen Reset",
    senderRole: "Creator",
    message:
      "Yes, I can film the compost setup on the balcony. I'll send a shot list first.",
    hoursAgo: 21,
    slug: "kitchen-shot-list",
  },
  {
    creatorUsername: "shetty_shibi",
    campaignName: "Zero-Waste Kitchen Reset",
    senderRole: "Brand",
    message:
      "That works. Let's aim to approve the shot list before the weekend.",
    hoursAgo: 20,
    slug: "kitchen-approve-list",
  },
  {
    creatorUsername: "demo.karan.bedi",
    campaignName: "Podcast Studio Makeover",
    senderRole: "Creator",
    message:
      "I've finished the acoustic panel install. The room sounds much tighter already.",
    hoursAgo: 18,
    slug: "podcast-panel-install",
  },
  {
    creatorUsername: "demo.karan.bedi",
    campaignName: "Podcast Studio Makeover",
    senderRole: "Brand",
    message:
      "Great — can you record a before/after voice test for the edit?",
    hoursAgo: 17,
    slug: "podcast-voice-test",
  },
  {
    creatorUsername: "demo.karan.bedi",
    campaignName: "Podcast Studio Makeover",
    senderRole: "Creator",
    message: "Sure, I'll attach both takes in the next update.",
    hoursAgo: 16,
    slug: "podcast-both-takes",
  },
  {
    creatorUsername: "demo.nisha.verma",
    campaignName: "Himalayan Trail Tested",
    senderRole: "Brand",
    message:
      "The jacket fit notes were useful. Could you add a short section on layering for windy ridges?",
    hoursAgo: 14,
    slug: "trail-layering-section",
  },
  {
    creatorUsername: "demo.nisha.verma",
    campaignName: "Himalayan Trail Tested",
    senderRole: "Creator",
    message:
      "Definitely. I'll add a 30-second layering breakdown to the main video.",
    hoursAgo: 13,
    slug: "trail-layering-breakdown",
  },
  {
    creatorUsername: "demo.diya.sethi",
    campaignName: "Weekend Camping Checklist",
    senderRole: "Creator",
    message:
      "The family tent setup worked well. Do you want the checklist as a carousel too?",
    hoursAgo: 11,
    slug: "camping-carousel-question",
  },
  {
    creatorUsername: "demo.diya.sethi",
    campaignName: "Weekend Camping Checklist",
    senderRole: "Brand",
    message:
      "Yes, a carousel would help. Please keep the gear names consistent with the reel.",
    hoursAgo: 10,
    slug: "camping-carousel-approved",
  },
  {
    creatorUsername: "shetty_shibi",
    campaignName: "Lumen Winter Layer Edit",
    senderRole: "Brand",
    message:
      "Final cut looks good. We've approved both deliverables and initiated the payment.",
    hoursAgo: 8,
    slug: "lumen-final-approved",
  },
  {
    creatorUsername: "shetty_shibi",
    campaignName: "Lumen Winter Layer Edit",
    senderRole: "Creator",
    message:
      "Thanks! I'll share the raw files with the usage notes today.",
    hoursAgo: 7,
    slug: "lumen-raw-files",
  },
  {
    creatorUsername: "demo.dev.malhotra",
    campaignName: "Indie Game Discovery Week",
    senderRole: "Brand",
    message:
      "Could you spotlight the co-op mode in the indie feature? It's a key differentiator.",
    hoursAgo: 6,
    slug: "prism-coop-spotlight",
  },
  {
    creatorUsername: "demo.dev.malhotra",
    campaignName: "Indie Game Discovery Week",
    senderRole: "Creator",
    message:
      "I'll add a short co-op section and credit the studio in the description.",
    hoursAgo: 5,
    slug: "prism-coop-section",
  },
];

function key(creatorUsername: string, campaignName: string): string {
  return `${creatorUsername}::${campaignName}`;
}

function requireUser(
  context: DemoContext,
  username: string,
  role: Role,
): UserRow {
  const user = context.userByUsername.get(username);
  if (!user || user.role !== role) {
    throw new Error(
      `MongoDB demo seeding expects an existing ${role} account named "${username}". No matching MySQL user was found.`,
    );
  }
  return user;
}

function requireCollaboration(
  context: DemoContext,
  creatorUsername: string,
  campaignName: string,
): CollaborationRow {
  const collaboration = context.collaborationByCreatorCampaign.get(
    key(creatorUsername, campaignName),
  );
  if (!collaboration) {
    throw new Error(
      `MongoDB demo seeding expects an existing collaboration between "${creatorUsername}" and campaign "${campaignName}".`,
    );
  }
  return collaboration;
}

function resolveEntity(context: DemoContext, entity: EntityRef): ResolvedEntity {
  if (entity.kind === "none") {
    return { relatedEntityId: null, relatedEntityType: null };
  }

  if (entity.kind === "campaign") {
    const campaign = context.campaignByBrandName.get(
      key(entity.brandUsername, entity.campaignName),
    );
    if (!campaign) {
      throw new Error(
        `MongoDB demo seeding expects campaign "${entity.campaignName}" for brand "${entity.brandUsername}".`,
      );
    }
    return {
      relatedEntityId: campaign.campaign_id,
      relatedEntityType: "campaign",
    };
  }

  if (entity.kind === "application") {
    const application = context.applications.find(
      (candidate) =>
        candidate.campaign_name === entity.campaignName &&
        candidate.status === entity.status &&
        (entity.creatorUsername
          ? candidate.creator_username === entity.creatorUsername
          : true) &&
        (entity.brandUsername
          ? candidate.brand_username === entity.brandUsername
          : true),
    );
    if (!application) {
      throw new Error(
        `MongoDB demo seeding expects a ${entity.status} application for campaign "${entity.campaignName}".`,
      );
    }
    return {
      relatedEntityId: application.application_id,
      relatedEntityType: "application",
    };
  }

  const collaboration = requireCollaboration(
    context,
    entity.creatorUsername,
    entity.campaignName,
  );

  if (entity.kind === "collaboration") {
    return {
      relatedEntityId: collaboration.collaboration_id,
      relatedEntityType: "collaboration",
      collaboration,
    };
  }

  if (entity.kind === "deliverable") {
    const deliverable = context.deliverablesByCollaboration.get(
      collaboration.collaboration_id,
    )?.[0];
    if (!deliverable) {
      throw new Error(
        `MongoDB demo seeding expects a deliverable for collaboration #${collaboration.collaboration_id}.`,
      );
    }
    return {
      relatedEntityId: deliverable.deliverable_id,
      relatedEntityType: "deliverable",
      collaboration,
    };
  }

  const payment = context.paymentsByCollaboration.get(
    collaboration.collaboration_id,
  )?.[0];
  if (!payment) {
    throw new Error(
      `MongoDB demo seeding expects a payment for collaboration #${collaboration.collaboration_id}.`,
    );
  }
  return {
    relatedEntityId: payment.payment_id,
    relatedEntityType: "payment",
    collaboration,
  };
}

async function loadContext(): Promise<DemoContext> {
  const [users, collaborations, applications, campaigns, deliverables, payments] =
    await Promise.all([
      query<UserRow[]>(
        `SELECT user_id, username, role
         FROM users
         WHERE role IN ('Creator', 'Brand', 'Admin')
         ORDER BY user_id`,
      ),
      query<CollaborationRow[]>(
        `SELECT co.collaboration_id,
                co.application_id,
                a.campaign_id,
                creator_user.user_id AS creator_user_id,
                brand_user.user_id AS brand_user_id,
                creator_user.username AS creator_username,
                brand_user.username AS brand_username,
                b.brand_name, ca.campaign_name, co.status
         FROM collaborations co
         INNER JOIN applications a ON a.application_id = co.application_id
         INNER JOIN creators cr ON cr.creator_id = a.creator_id
         INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
         INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
         INNER JOIN brands b ON b.brand_id = ca.brand_id
         INNER JOIN users brand_user ON brand_user.user_id = b.user_id
         ORDER BY co.collaboration_id
         LIMIT 100`,
      ),
      query<ApplicationRow[]>(
        `SELECT a.application_id, a.status,
                creator_user.username AS creator_username,
                brand_user.username AS brand_username,
                ca.campaign_name
         FROM applications a
         INNER JOIN creators cr ON cr.creator_id = a.creator_id
         INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
         INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
         INNER JOIN brands b ON b.brand_id = ca.brand_id
         INNER JOIN users brand_user ON brand_user.user_id = b.user_id
         ORDER BY a.application_id`,
      ),
      query<CampaignRow[]>(
        `SELECT ca.campaign_id, ca.campaign_name,
                brand_user.username AS brand_username, b.brand_name
         FROM campaigns ca
         INNER JOIN brands b ON b.brand_id = ca.brand_id
         INNER JOIN users brand_user ON brand_user.user_id = b.user_id
         ORDER BY ca.campaign_id`,
      ),
      query<DeliverableRow[]>(
        `SELECT deliverable_id, collaboration_id
         FROM deliverables
         ORDER BY deliverable_id`,
      ),
      query<PaymentRow[]>(
        `SELECT payment_id, collaboration_id
         FROM payments
         ORDER BY payment_id`,
      ),
    ]);

  const rolesPresent = new Set(users.map((user) => user.role));
  const missingRoles = (["Creator", "Brand", "Admin"] as const).filter(
    (role) => !rolesPresent.has(role),
  );
  if (missingRoles.length > 0) {
    throw new Error(
      `MongoDB demo seeding requires existing MySQL accounts for: ${missingRoles.join(", ")}.`,
    );
  }
  if (collaborations.length === 0) {
    throw new Error(
      "MongoDB demo seeding requires an existing MySQL collaboration; no collaboration records were found.",
    );
  }

  const deliverablesByCollaboration = new Map<number, DeliverableRow[]>();
  for (const deliverable of deliverables) {
    const group =
      deliverablesByCollaboration.get(deliverable.collaboration_id) ?? [];
    group.push(deliverable);
    deliverablesByCollaboration.set(deliverable.collaboration_id, group);
  }

  const paymentsByCollaboration = new Map<number, PaymentRow[]>();
  for (const payment of payments) {
    const group = paymentsByCollaboration.get(payment.collaboration_id) ?? [];
    group.push(payment);
    paymentsByCollaboration.set(payment.collaboration_id, group);
  }

  return {
    users,
    collaborations,
    applications,
    campaigns,
    deliverables,
    payments,
    userByUsername: new Map(users.map((user) => [user.username, user])),
    collaborationByCreatorCampaign: new Map(
      collaborations.map((collaboration) => [
        key(collaboration.creator_username, collaboration.campaign_name),
        collaboration,
      ]),
    ),
    campaignByBrandName: new Map(
      campaigns.map((campaign) => [
        key(campaign.brand_username, campaign.campaign_name),
        campaign,
      ]),
    ),
    deliverablesByCollaboration,
    paymentsByCollaboration,
  };
}

async function seedMongoDemo(): Promise<void> {
  const context = await loadContext();
  const now = Date.now();

  let legacyNotificationInserts = 0;
  let legacyActivityInserts = 0;
  let legacyMessageInserts = 0;
  let creatorNotificationInserts = 0;
  let brandNotificationInserts = 0;
  let adminNotificationInserts = 0;
  let expandedActivityInserts = 0;
  let expandedMessageInserts = 0;

  /*
   * The original two-per-account notification and per-collaboration
   * activity/message seeds are kept for backward compatibility. They are
   * idempotent and are not modified or removed.
   */
  for (const user of context.users) {
    const userCollaboration = context.collaborations.find((item) =>
      user.role === "Creator"
        ? item.creator_user_id === user.user_id
        : user.role === "Brand"
          ? item.brand_user_id === user.user_id
          : true,
    );
    const relatedEntityId = userCollaboration?.collaboration_id ?? null;
    const relatedEntityType =
      relatedEntityId === null ? null : "collaboration";
    const seeded = [
      await addSeedNotification({
        userId: user.user_id,
        userRole: user.role,
        title: "Welcome to CreatorConnect",
        message: `Your ${user.role.toLowerCase()} workspace is ready.`,
        type: "demo_welcome",
        isRead: false,
        relatedEntityId,
        relatedEntityType,
        metadata: { demo: true },
        dedupeKey: `demo:notification:${user.user_id}:unread`,
        createdAt: new Date(now - 60 * 60 * 1000),
      }),
      await addSeedNotification({
        userId: user.user_id,
        userRole: user.role,
        title: "Demo activity summary",
        message: "Recent application, delivery, and payment updates appear here.",
        type: "demo_summary",
        isRead: true,
        relatedEntityId,
        relatedEntityType,
        metadata: { demo: true },
        dedupeKey: `demo:notification:${user.user_id}:read`,
        createdAt: new Date(now - 2 * 60 * 60 * 1000),
      }),
    ];
    legacyNotificationInserts += seeded.filter(Boolean).length;
  }

  for (const [index, collaboration] of context.collaborations.entries()) {
    const createdAt = new Date(now - index * 60 * 60 * 1000);
    const activityInserted = await addSeedActivity({
      actorId: collaboration.brand_user_id,
      actorRole: "Brand",
      action: "collaboration_started",
      entityType: "collaboration",
      entityId: collaboration.collaboration_id,
      description: `Started a collaboration with ${collaboration.creator_username} for ${collaboration.campaign_name}.`,
      metadata: { demo: true },
      dedupeKey: `demo:collaboration:${collaboration.collaboration_id}:activity`,
      createdAt,
    });
    if (activityInserted) legacyActivityInserts += 1;
    const brandMessageInserted = await addSeedMessage({
      collaborationId: collaboration.collaboration_id,
      senderId: collaboration.brand_user_id,
      senderRole: "Brand",
      message: `Welcome! Let's coordinate the ${collaboration.campaign_name} deliverables here.`,
      seedKey: `demo:collaboration:${collaboration.collaboration_id}:brand-message`,
      createdAt: new Date(createdAt.getTime() + 1000),
    });
    if (brandMessageInserted) legacyMessageInserts += 1;
    const creatorMessageInserted = await addSeedMessage({
      collaborationId: collaboration.collaboration_id,
      senderId: collaboration.creator_user_id,
      senderRole: "Creator",
      message: "Thanks! I will share progress updates in this conversation.",
      seedKey: `demo:collaboration:${collaboration.collaboration_id}:creator-message`,
      createdAt: new Date(createdAt.getTime() + 2000),
    });
    if (creatorMessageInserted) legacyMessageInserts += 1;
  }

  for (const seed of creatorNotificationSeeds) {
    const user = requireUser(context, seed.username, seed.role);
    const entity = resolveEntity(context, seed.entity);
    const inserted = await addSeedNotification({
      userId: user.user_id,
      userRole: seed.role,
      title: seed.title,
      message: seed.message,
      type: seed.type,
      isRead: seed.isRead,
      relatedEntityId: entity.relatedEntityId,
      relatedEntityType: entity.relatedEntityType,
      metadata: DEMO_METADATA,
      dedupeKey: `demo:v2:notification:${seed.username}:${seed.slug}`,
      createdAt: new Date(now - seed.hoursAgo * HOUR_MS),
    });
    if (inserted) creatorNotificationInserts += 1;
  }

  for (const seed of brandNotificationSeeds) {
    const user = requireUser(context, seed.username, seed.role);
    const entity = resolveEntity(context, seed.entity);
    const inserted = await addSeedNotification({
      userId: user.user_id,
      userRole: seed.role,
      title: seed.title,
      message: seed.message,
      type: seed.type,
      isRead: seed.isRead,
      relatedEntityId: entity.relatedEntityId,
      relatedEntityType: entity.relatedEntityType,
      metadata: DEMO_METADATA,
      dedupeKey: `demo:v2:notification:${seed.username}:${seed.slug}`,
      createdAt: new Date(now - seed.hoursAgo * HOUR_MS),
    });
    if (inserted) brandNotificationInserts += 1;
  }

  for (const seed of adminNotificationSeeds) {
    const user = requireUser(context, seed.username, seed.role);
    const entity = resolveEntity(context, seed.entity);
    const inserted = await addSeedNotification({
      userId: user.user_id,
      userRole: seed.role,
      title: seed.title,
      message: seed.message,
      type: seed.type,
      isRead: seed.isRead,
      relatedEntityId: entity.relatedEntityId,
      relatedEntityType: entity.relatedEntityType,
      metadata: DEMO_METADATA,
      dedupeKey: `demo:v2:notification:${seed.username}:${seed.slug}`,
      createdAt: new Date(now - seed.hoursAgo * HOUR_MS),
    });
    if (inserted) adminNotificationInserts += 1;
  }

  for (const seed of activitySeeds) {
    const actor = requireUser(context, seed.actorUsername, seed.actorRole);
    const entity = resolveEntity(context, seed.entity);
    if (entity.relatedEntityType === null || entity.relatedEntityId === null) {
      throw new Error(
        `Activity seed "${seed.slug}" must reference an existing entity.`,
      );
    }
    const inserted = await addSeedActivity({
      actorId: actor.user_id,
      actorRole: seed.actorRole,
      action: seed.action,
      entityType: entity.relatedEntityType,
      entityId: entity.relatedEntityId,
      description: seed.description,
      metadata: DEMO_METADATA,
      dedupeKey: `demo:v2:activity:${seed.slug}`,
      createdAt: new Date(now - seed.hoursAgo * HOUR_MS),
    });
    if (inserted) expandedActivityInserts += 1;
  }

  for (const seed of messageSeeds) {
    const collaboration = requireCollaboration(
      context,
      seed.creatorUsername,
      seed.campaignName,
    );
    const senderId =
      seed.senderRole === "Creator"
        ? collaboration.creator_user_id
        : collaboration.brand_user_id;
    const inserted = await addSeedMessage({
      collaborationId: collaboration.collaboration_id,
      senderId,
      senderRole: seed.senderRole,
      message: seed.message,
      seedKey: `demo:v2:message:${collaboration.collaboration_id}:${seed.slug}`,
      createdAt: new Date(now - seed.hoursAgo * HOUR_MS),
    });
    if (inserted) expandedMessageInserts += 1;
  }

  const notificationInserts = legacyNotificationInserts + creatorNotificationInserts +
    brandNotificationInserts + adminNotificationInserts;
  const activityInserts = legacyActivityInserts + expandedActivityInserts;
  const messageInserts = legacyMessageInserts + expandedMessageInserts;

  const db = await getMongoDatabase();
  const [notificationTotal, activityTotal, messageTotal] = await Promise.all([
    db.collection("notifications").countDocuments({ dedupeKey: { $regex: "^demo:" } }),
    db.collection("activity_logs").countDocuments({ dedupeKey: { $regex: "^demo:" } }),
    db
      .collection("collaboration_messages")
      .countDocuments({ seedKey: { $regex: "^demo:" } }),
  ]);

  console.info("MongoDB demo seeding complete.");
  console.info(
    `Notifications: ${notificationInserts} inserted this run ` +
      `(${legacyNotificationInserts} base, ${creatorNotificationInserts} creator, ` +
      `${brandNotificationInserts} brand, ${adminNotificationInserts} admin); ` +
      `${notificationTotal - notificationInserts} already existed; ` +
      `${notificationTotal} total demo notifications.`,
  );
  console.info(
    `Activity: ${activityInserts} inserted this run ` +
      `(${legacyActivityInserts} base, ${expandedActivityInserts} expanded); ` +
      `${activityTotal - activityInserts} already existed; ` +
      `${activityTotal} total demo activities.`,
  );
  console.info(
    `Messages: ${messageInserts} inserted this run ` +
      `(${legacyMessageInserts} base, ${expandedMessageInserts} expanded); ` +
      `${messageTotal - messageInserts} already existed; ` +
      `${messageTotal} total demo messages.`,
  );
  console.info(
    `Expanded notification records: ${creatorNotificationSeeds.length} creator, ` +
      `${brandNotificationSeeds.length} brand, ${adminNotificationSeeds.length} admin.`,
  );
  console.info(
    `Notification recipients: ` +
      `${new Set(creatorNotificationSeeds.map((seed) => seed.username)).size} creator accounts, ` +
      `${new Set(brandNotificationSeeds.map((seed) => seed.username)).size} brand accounts, ` +
      `${new Set(adminNotificationSeeds.map((seed) => seed.username)).size} admin account.`,
  );
  console.info(
    `Existing data reused: ${context.users.length} users and ` +
      `${context.collaborations.length} collaborations.`,
  );
}

async function main(): Promise<void> {
  try {
    await seedMongoDemo();
  } finally {
    await Promise.all([closePool(), closeMongoConnection()]);
  }
}

void main().catch((error: unknown) => {
  console.error(
    "MongoDB demo seeding failed:",
    error instanceof Error ? error.name : "Unknown error",
  );
  if (
    error instanceof Error &&
    error.message.startsWith("Missing required environment variable: MONGODB_")
  ) {
    console.error(error.message);
  }
  process.exitCode = 1;
});
