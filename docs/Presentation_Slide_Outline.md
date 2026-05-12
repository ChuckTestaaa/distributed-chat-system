# Presentation Slide Outline

8 slides for 8-minute presentation, then 5-minute demo, then Q&A.

---

## SLIDE 1 — Title (15 sec)

**Distributed Chat System**
Web Services and Cloud Computing — Final Project

- Group Name: [Your Group Name]
- Members: [Names]
- Date: [Presentation Date]

---

## SLIDE 2 — Overview & Original System (1.5 min)

**What we built:** A real-time distributed chat app with text, video/audio, groups, DMs, friends, QR invites, and offline message delivery — all without web frameworks.

**Based on:** *"Chat Application with Distributed System"* — Shuyang Zhu, Harrisburg University, 2020

| | Original | Our Redesign |
|---|---|---|
| Language | Java 8 | Node.js 20 |
| Server | Apache Tomcat (single server) | Raw Node.js HTTP × 2 instances + Nginx |
| Real-time | Java WebSocket API | Raw `ws` library |
| Database | MySQL | PostgreSQL (raw SQL) |
| Cache | Redis | Redis (expanded: Pub/Sub + offline queues) |
| Frontend | Angular + NgRx | React + Context API |
| Video/Audio | WebRTC | WebRTC (native API + STUN/TURN) |
| Deployment | Local only | Docker Compose (5 containers) |

**Kept same principles:** 3-layer architecture, REST API, WebSocket, WebRTC, Redis, friendship system

---

## SLIDE 3 — System Architecture (1.5 min)

> *INSERT DIAGRAM: Diagram 1 (High-Level System Architecture)*

- **Nginx** load balances across 2 Node.js servers (ip_hash sticky sessions)
- **Redis** Pub/Sub syncs messages across instances
- **PostgreSQL** stores all persistent data
- **WebRTC** video/audio flows directly between browsers (P2P)
- **Shared-Nothing:** servers hold no shared state — can add/remove instances freely

---

## SLIDE 4 — No-Framework Design (1 min)

| What frameworks do | What we built instead |
|---|---|
| Express.js handles HTTP routing | Custom 128-line Router with path params + middleware |
| Socket.io manages WebSocket rooms | Raw `ws` + custom room/presence/broadcast logic |
| Prisma ORM generates SQL | Raw parameterized SQL + custom migration runner |
| Simple-Peer wraps WebRTC | Native `RTCPeerConnection` + STUN/TURN |

**Only 6 runtime dependencies:** bcrypt, jsonwebtoken, pg, redis, uuid, ws

---

## SLIDE 5 — Cross-Instance Messaging (1.5 min)

1. User A sends message → Server 1 saves to PostgreSQL
2. Server 1 broadcasts to its local clients
3. Server 1 publishes to Redis channel `room:<id>`
4. Server 2 receives via Redis subscription → broadcasts to its local clients
5. Offline users: message IDs queued in Redis, delivered on reconnect

Each instance has a unique ID — messages from same instance are ignored to prevent duplicates.

---

## SLIDE 6 — WebRTC & Key Features (1 min)

**Video/Audio (WebRTC):**
- Server handles signaling only (SDP offer/answer + ICE candidates)
- Media flows directly between browsers — near-zero server load
- STUN for NAT traversal + TURN relay as fallback

**Other features:**
- QR code room invites (Redis-backed, 15-min TTL)
- Friendship system (request → accept/reject → DM)
- 5 database tables, cursor-based message pagination

---

## SLIDE 7 — Deployment & Security (1 min)

**Deployment:** `docker compose up --build` starts all 5 services
- PostgreSQL, Redis, Server ×2, Nginx

**Security:**
- bcrypt password hashing
- JWT auth (REST + WebSocket upgrade handshake)
- Parameterized SQL queries (injection prevention)
- Room membership checks, invite auto-expiry, CORS

---

## SLIDE 8 — Summary (30 sec)

1. **Horizontal scaling** — multiple servers behind Nginx load balancer
2. **Real-time** — WebSocket for chat, WebRTC for video/audio
3. **Pub/Sub** — Redis enables cross-instance message delivery
4. **Offline delivery** — messages queued in Redis, delivered on reconnect
5. **No frameworks** — HTTP routing, WebSocket, SQL, and WebRTC built from scratch
6. **Containerized** — one command deploys the entire distributed system

---

## DEMO SCRIPT (5 min)

**Demo 1: Register & Chat (1.5 min)**
- Two browser windows — register User A and User B
- Create a group room, exchange messages in real time

**Demo 2: QR Invite (1 min)**
- User A generates QR invite → copy link to User B's browser
- User B joins room, both exchange messages

**Demo 3: Friends & DM (1 min)**
- User A adds User B as friend → User B accepts
- Click friend to open DM, exchange private messages

**Demo 4: Video Call (1 min)**
- User A starts video call → User B accepts
- Show both video feeds, then end call

**Demo 5: Distributed Proof (30 sec)**
- Show Docker with both servers running
- Point out server logs showing Redis Pub/Sub cross-instance delivery

---

## Q&A — Prepared Answers

| Question | Answer |
|---|---|
| How does it compare to the original? | Same principles (3-layer, REST, WebSocket, WebRTC, Redis) but we added horizontal scaling, cross-instance Pub/Sub, Docker deployment, and removed frameworks. |
| Why Node.js instead of Java? | Event-driven I/O fits WebSocket workloads; single language across the stack. |
| Why no frameworks? | To demonstrate protocol-level understanding. Only 6 dependencies vs. dozens in a typical project. |
| Can it scale beyond 2 servers? | Yes — add entries to nginx.conf and docker-compose.yml. Redis Pub/Sub handles N instances. |
| What if a server crashes? | Nginx routes to surviving server. Redis preserves offline queues. PostgreSQL persists all data. |
| Why ip_hash? | WebSocket connections are stateful — same client must reach same server. |
