# DISTRIBUTED CHAT SYSTEM
## Presentation Outline

Web Services and Cloud Computing — Final Project

Group Name: [Your Group Name]
Members: [Names]
Date: [Presentation Date]

---

### Slide 1 — Title

Distributed Chat System
Web Services and Cloud Computing — Final Project
[Group Name], [Members], [Date]


### Slide 2 — Overview and Original System

What we built: A real-time distributed chat application supporting text messaging, video/audio calling, group chats, private DMs, friend requests, QR code room invitations, and offline message delivery — built without web frameworks.

Based on: "Chat Application with Distributed System" by Shuyang Zhu, Harrisburg University, 2020.

Comparison with the original:

- Language: Java 8 → Node.js 20
- Server: Apache Tomcat (single server) → Raw Node.js HTTP x2 + Nginx
- Real-time: Java WebSocket API → Raw ws library
- Database: MySQL → PostgreSQL (raw SQL)
- Cache: Redis → Redis (expanded: Pub/Sub + offline queues)
- Frontend: Angular + NgRx → React + Context API
- Video/Audio: WebRTC → WebRTC (native API + STUN/TURN)
- Deployment: Local only → Docker Compose (5 containers)

Principles retained from the original: 3-layer architecture, REST API, WebSocket, WebRTC, Redis, friendship system.


### Slide 3 — System Architecture

[Insert System Architecture Diagram]

Key points:
- Nginx load balances across 2 Node.js servers using ip_hash sticky sessions.
- Redis Pub/Sub synchronizes messages across server instances.
- PostgreSQL stores all persistent data.
- WebRTC video/audio flows directly between browsers (peer-to-peer).
- Shared-Nothing Architecture: servers hold no shared state and can be added or removed freely.


### Slide 4 — No-Framework Design

- Instead of Express.js for HTTP routing → Custom 128-line Router with path params and middleware.
- Instead of Socket.io for WebSocket rooms → Raw ws + custom room/presence/broadcast logic.
- Instead of Prisma ORM for SQL → Raw parameterized SQL + custom migration runner.
- Instead of Simple-Peer for WebRTC → Native RTCPeerConnection + STUN/TURN.

Only 6 runtime dependencies: bcrypt, jsonwebtoken, pg, redis, uuid, ws.


### Slide 5 — Cross-Instance Messaging

How users on different servers see each other's messages:

1. User A sends a message. Server 1 saves it to PostgreSQL.
2. Server 1 broadcasts the message to its own local WebSocket clients.
3. Server 1 publishes the message to a Redis channel (room:<id>).
4. Server 2 receives the message via its Redis subscription and broadcasts to its local clients.
5. For offline users, message IDs are queued in a Redis list and delivered when they reconnect.

Each server instance has a unique ID. Messages originating from the same instance are ignored on Redis receipt to prevent duplicate delivery.


### Slide 6 — WebRTC and Key Features

Video/Audio (WebRTC):
- The server handles signaling only (SDP offer/answer and ICE candidates).
- Once connected, media flows directly between browsers with near-zero server load.
- STUN servers handle NAT traversal. TURN relay serves as a fallback for restrictive firewalls.

Other features:
- QR code room invites backed by Redis with a 15-minute time-to-live.
- Friendship system with request, accept, reject, and automatic DM creation.
- 5 database tables with cursor-based message pagination.


### Slide 7 — Deployment and Security

Deployment:
- "docker compose up --build" starts all 5 services: PostgreSQL, Redis, Server 1, Server 2, Nginx.
- Redis health checks ensure servers do not start before Redis is ready.

Security:
- bcrypt password hashing.
- JWT authentication for both REST API and WebSocket upgrade handshake.
- Parameterized SQL queries to prevent injection.
- Room membership checks before every message send.
- Invite codes auto-expire after 15 minutes.
- CORS middleware with origin whitelist.


### Slide 8 — Summary

1. Horizontal scaling — multiple servers behind an Nginx load balancer.
2. Real-time communication — WebSocket for chat, WebRTC for video/audio.
3. Pub/Sub pattern — Redis enables cross-instance message delivery.
4. Offline delivery — messages queued in Redis and delivered on reconnect.
5. No frameworks — HTTP routing, WebSocket management, SQL queries, and WebRTC signaling built from scratch.
6. Containerized — one command deploys the entire distributed system.


---

### Demo Script (5 minutes)

Demo 1 — Register and Chat (1.5 min):
Open two browser windows. Register User A and User B. Create a group room. Exchange messages in real time.

Demo 2 — QR Invite (1 min):
User A generates a QR invite. Copy the link to User B's browser. User B joins the room. Both exchange messages.

Demo 3 — Friends and DM (1 min):
User A adds User B as a friend. User B accepts. Click friend to open a DM. Exchange private messages.

Demo 4 — Video Call (1 min):
User A starts a video call. User B accepts. Show both video feeds. End the call.

Demo 5 — Distributed Proof (30 sec):
Show Docker with both servers running. Point out server logs showing Redis Pub/Sub cross-instance delivery.


---

### Q&A — Prepared Answers

Q: How does it compare to the original?
A: Same principles (3-layer, REST, WebSocket, WebRTC, Redis) but we added horizontal scaling, cross-instance Pub/Sub, Docker deployment, and removed frameworks.

Q: Why Node.js instead of Java?
A: Event-driven I/O fits WebSocket workloads. Single language across the entire stack.

Q: Why no frameworks?
A: To demonstrate protocol-level understanding. Only 6 dependencies versus dozens in a typical project.

Q: Can it scale beyond 2 servers?
A: Yes. Add entries to nginx.conf and docker-compose.yml. Redis Pub/Sub handles N instances.

Q: What if a server crashes?
A: Nginx routes to the surviving server. Redis preserves offline queues. PostgreSQL persists all data.

Q: Why ip_hash?
A: WebSocket connections are stateful. The same client must always reach the same server.
