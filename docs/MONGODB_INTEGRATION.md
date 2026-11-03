# MongoDB integration

## Database responsibilities

CreatorConnect uses both databases without moving or duplicating the authoritative business records:

- **MySQL** remains authoritative for accounts and roles, creator/brand profiles, campaigns, applications, collaborations, deliverables, submissions, contracts, payments, and reviews. Existing MySQL transactions and repositories continue to govern these records.
- **MongoDB** stores notification inbox documents, append-oriented platform activity, and collaboration message history. Documents refer to existing MySQL numeric user/profile/entity IDs; MongoDB never creates or updates the referenced business records.

Mongo writes triggered by a successful MySQL workflow happen afterward and are best-effort. If MongoDB is unavailable, the committed MySQL workflow remains successful and an explicit server log records the failed auxiliary event. MongoDB-only reads and writes return a service-unavailable error; no mock data is substituted.

## Collections

The server initializes three collections and their validators/indexes on first use:

- `notifications`: `userId`, `userRole`, `title`, `message`, `type`, `isRead`, `relatedEntityId`, `relatedEntityType`, `metadata`, `createdAt`, and an optional unique `dedupeKey`. Indexed by `(userId, createdAt)`, `(userId, isRead)`, and unique optional `dedupeKey`.
- `activity_logs`: `actorId`, `actorRole`, `action`, `entityType`, `entityId`, `description`, `metadata`, `createdAt`, and optional unique `dedupeKey`. Indexed by `(entityType, entityId, createdAt)`, `(actorId, createdAt)`, and unique optional `dedupeKey`.
- `collaboration_messages`: `collaborationId`, `senderId`, `senderRole`, `message`, `attachments`, `createdAt`, `updatedAt`, and optional `seedKey`. Indexed by `(collaborationId, createdAt)` and unique optional `seedKey`.

MongoDB JSON Schema validation is applied when collections are created and refreshed on subsequent server initialization. Message bodies are limited to 2,000 characters, attachments to five metadata objects (each at most 25 MB), and notification/activity text is bounded.

## Connection setup

1. Copy `.env.example` to `.env` and retain the existing MySQL and auth settings.
2. Set `MONGODB_URI` to a local URI such as `mongodb://127.0.0.1:27017` or a MongoDB Atlas URI. Configure Atlas network access and a least-privilege database user separately; do not commit real credentials.
3. Set `MONGODB_DB_NAME` to the database name, for example `creatorconnect_nosql`.
4. Start MongoDB locally or make the Atlas deployment reachable from the server.

The official MongoDB Node.js driver uses a reusable server-side client with a 10-connection pool. The URI is only read in server modules and is never returned to the browser. The admin System Status page checks MongoDB separately from MySQL.

## Workflow and access controls

- Creator campaign applications notify the owning brand.
- Brand application acceptance notifies the creator and records collaboration start activity.
- Deliverable submissions notify the brand; rejected submissions notify the creator that a revision was requested.
- Payments marked paid notify the creator.
- Collaboration messages notify the other participant and add an activity event.
- Notification queries and updates are always scoped to the authenticated MySQL `user_id` and role. Activity is actor-scoped for creators/brands; only Admin can list platform-wide activity.
- Messages are available only after the MySQL collaboration repository confirms the current creator or brand profile is a participant. Client-supplied user IDs are ignored.

## Demo seeding and verification

Run the existing MySQL demo seeder first if the MySQL database does not already contain demo accounts and collaborations:

```sh
npm run db:seed-demo
npm run mongo:seed-demo
```

The MongoDB seeder selects actual MySQL user IDs and collaboration IDs. It refuses to fabricate missing creator/brand/admin accounts or collaborations, only inserts idempotent MongoDB documents, and never modifies MySQL records.

Verification commands:

```sh
npm run mongo:test
npm run test:mongodb
npm run typecheck
npm run test:auth
npm run test:dashboards
npm run build
```

`mongo:test` checks server connectivity, collection initialization, and indexes. `test:mongodb` requires a reachable MySQL and MongoDB and runs temporary notification CRUD, activity isolation, message history, and collaboration ownership checks; test documents are removed afterward. Existing auth/dashboard suites continue to exercise the MySQL-backed application. Configure both databases before running integration suites.
