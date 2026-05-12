# Distributed Chat System — System Documentation

---

## 1. Executive Summary

This project implements a **distributed real-time chat application** built entirely from low-level primitives — no web frameworks. The system supports real-time text messaging, peer-to-peer video/audio calling, group and private chat rooms, a friendship system, QR-code room invitations, and offline message delivery. It is designed to scale horizontally across multiple server instances using Redis Pub/Sub for cross-instance communication and Nginx for load balancing.

**Key design decision:** Instead of relying on high-level frameworks (Express.js, Socket.io, Prisma ORM, Simple-Peer), the system uses raw Node.js HTTP, the `ws` WebSocket library, raw SQL with `pg`, and the native browser `RTCPeerConnection` API. This demonstrates a deep understanding of the underlying protocols and distributed system principles.

---

## 2. System Overview

### 2.1 Problem Statement

Modern chat applications must handle millions of concurrent users exchanging messages in real time. A single server cannot sustain this load. The system must:

- Deliver messages in real time with low latency
- Scale horizontally (add more servers without downtime)
- Guarantee message delivery even when recipients are offline
- Support both text-based and audio/video communication
- Maintain consistency across multiple server instances

### 2.2 Feature Summary

| Feature | Protocol / Mechanism |
|---|---|
| User authentication | REST API + JWT tokens |
| Real-time text messaging | WebSocket (ws library) |
| Video/audio calling | WebRTC (native RTCPeerConnection) |
| Group chat rooms | Room-based WebSocket broadcasting |
| Private DMs | 1-on-1 room auto-creation between friends |
| Friendship system | REST API + real-time notifications |
| QR code room invites | Redis-backed invite tokens (15-min TTL) |
| Offline message delivery | Redis queue + delivery on reconnect |
| Cross-instance sync | Redis Pub/Sub |
| Load balancing | Nginx with IP-hash sticky sessions |
| Containerized deployment | Docker Compose (5 services) |

---

## 3. Architecture Design

### 3.1 Three-Layer Architecture

The system follows a classic **three-layer distributed architecture**:

```
┌─────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                     │
│  React SPA (Vite) — Browser WebSocket + RTCPeerConnection│
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP / WebSocket / WebRTC
┌──────────────────────────▼──────────────────────────────┐
│                   BUSINESS LAYER                        │
│  Node.js HTTP Server × N instances                      │
│  ├── Custom Router (lib/router.js)                      │
│  ├── JWT Authentication Middleware                       │
│  ├── REST API Endpoints (routes/)                       │
│  ├── Service Layer (services/)                          │
│  ├── WebSocket Server (lib/ws.js)                       │
│  └── Redis Pub/Sub Adapter (lib/redisPubSub.js)        │
└──────────┬──────────────────────────────┬───────────────┘
           │                              │
┌──────────▼──────────┐    ┌──────────────▼───────────────┐
│  PERSISTENCE LAYER  │    │     MESSAGE BROKER LAYER     │
│  PostgreSQL 16      │    │     Redis 7                  │
│  ├── users          │    │     ├── Pub/Sub channels     │
│  ├── rooms          │    │     ├── Offline msg queues   │
│  ├── room_members   │    │     └── Invite token store   │
│  ├── messages       │    │                              │
│  └── friendships    │    │                              │
└─────────────────────┘    └──────────────────────────────┘
```

### 3.2 Distributed System Components

| Component | Role | Distributed Principle |
|---|---|---|
| **Nginx** | Reverse proxy + load balancer | Horizontal scaling, sticky sessions |
| **Node.js Server ×2** | Application logic, WebSocket handling | Stateless replicas |
| **Redis** | Pub/Sub, caching, offline queues | Message broker, shared state |
| **PostgreSQL** | Persistent storage | Single source of truth |
| **Browser (WebRTC)** | Peer-to-peer media | Decentralized communication |

### 3.3 Comparison with the Original System

Our project is a redesign of the distributed chat application described in *"Chat Application with Distributed System"* by Shuyang Zhu (Harrisburg University, Spring 2020, GRAD 699, supervised by Dr. Abrar Qureshi). The original system was built with Java 8, deployed on Apache Tomcat, with Angular and NgRx for the frontend, MySQL for persistent storage, and Redis as an in-memory database. The server code was organized into two modules (`ms-account-management` and `ms-chat-application`), though deployed as a single application on one Tomcat instance. We retained the same architectural principles (3-layer architecture, REST + WebSocket + WebRTC) but redesigned the technology stack and made deliberate decisions to go lower-level where possible.

#### 3.3.1 Original System Software Specification

From the paper's Software Specification table (Section 3, pages 12–13):

| Component | Original System |
|---|---|
| Operating System | Windows 10 |
| Programming Language | Java 8 (NIO, lambda, function flow) |
| IDE | IntelliJ |
| Frontend Technology | Angular (TypeScript) with NgRx state management |
| Database | MySQL + Redis |
| Application Server | Apache Tomcat |
| Server Structure | Multi-module (`ms-account-management`, `ms-chat-application`), single deployment |
| Deployment | Local (planned AWS migration) |

The original server was organized into two Java modules (each with its own `pom.xml`), deployed together on a single Apache Tomcat instance:
- **ms-account-management** — `Controller.java`, `MsAccountManagementApplication.java`, `AccountService.java`, repository classes (`UserRepository.java`, `UserDbRepository.java`), models (`User.java`, `FriendShip.java`)
- **ms-chat-application** — `MsChatApplicationMain.java`, `ChatController.java`, `WebSocketEventListener.java`, `WebSocketConfig.java`, model (`ChatMessage.java`)

The original Angular frontend used NgRx for state management (actions, effects, reducers, selectors for both account and messages modules), with components for chatList, chatPage, friendList, landingPage, mainPage, and confirmation-dialog.

The original database had 4 tables:
- **User**: user_id, user_name, user_password (encrypted)
- **User_activity**: user_id, last_active_time
- **Conversation**: sender, receiver, timestamp, send_timestamp
- **Friendship**: user_1, user_2

#### 3.3.2 Technology Stack Comparison

| Layer | Original System (Zhu, 2020) | Our Redesigned System | Rationale for Change |
|---|---|---|---|
| **Language** | Java 8 (NIO, lambda) | JavaScript (Node.js 20) | Single language across frontend and backend; event-driven I/O is a natural fit for real-time WebSocket workloads |
| **Server** | Java 8 + Apache Tomcat | Raw Node.js `http.createServer` + custom Router | Eliminates framework overhead; demonstrates understanding of HTTP request/response lifecycle, path matching, and middleware pipelines |
| **Architecture** | Multi-module monolith (2 modules, single Tomcat deployment) | Single Node.js server (horizontally scaled via Docker) | Horizontal scaling achieved through multiple identical instances behind Nginx load balancer |
| **Real-time** | Java WebSocket API (`WebSocketConfig.java`, `WebSocketEventListener.java`) | `ws` library + custom room/presence management | Low-level control over the WebSocket upgrade handshake, frame protocol, and per-room broadcasting |
| **Video/Audio** | WebRTC | WebRTC (native `RTCPeerConnection` + STUN/TURN) | Both systems use WebRTC; we avoid abstraction libraries to directly implement SDP offer/answer exchange, ICE candidate trickle, and STUN/TURN negotiation |
| **Database** | MySQL | PostgreSQL 16 with raw SQL (`pg` driver) | PostgreSQL offers advisory locks (migration safety), native UUID generation, and enum types; raw SQL replaces ORM to demonstrate query-level understanding |
| **Data Access** | Repository pattern (`UserRepository.java`, `UserDbRepository.java`) | None — parameterized raw SQL queries | Direct SQL control; no abstraction hiding query performance or schema behavior |
| **Cache / Broker** | Redis (in-memory database) | Redis 7 (Pub/Sub + offline queues + invite tokens) | Same technology; expanded usage from simple caching to cross-instance Pub/Sub messaging, offline message queuing, and time-limited invite token storage |
| **Frontend** | Angular (TypeScript) + NgRx (actions/effects/reducers/selectors) | React 19 + Context API | Lighter-weight; Context API for auth/socket state vs. NgRx's full Redux pattern |
| **State Management** | NgRx (account.reducers, messages.reducers, selectors, effects) | React Context (AuthContext, SocketContext) | Simpler state model adequate for our scope |
| **Load Balancing** | Not implemented (planned for AWS) | Nginx with `ip_hash` sticky sessions | Explicit load balancer for horizontal scaling and WebSocket affinity |
| **Containerization** | Not implemented (local deployment) | Docker Compose (5 services) | Reproducible multi-service deployment with a single command |
| **Authentication** | Basic username/password (stored encrypted in MySQL) | JWT (stateless) + bcrypt password hashing | Stateless tokens enable horizontal scaling without shared session storage |

#### 3.3.3 Architectural Principles Retained

Both systems share the same core distributed architecture from the original paper:

1. **3-Layer Architecture** — The original paper defines: Presentation Layer (Angular UI + client-side cache), Business Layer (gateway + logic on server), Persistence Layer (Redis in-memory DB + MySQL). Our system mirrors this: Presentation (React SPA), Business (Node.js HTTP + WebSocket server + service layer), Persistence (Redis + PostgreSQL)
2. **REST API** — For account management and user operations (the original's `ms-account-management` module maps to our `routes/auth.js` + `routes/users.js`)
3. **WebSocket** — For real-time bidirectional text messaging (the original's `ms-chat-application` with `WebSocketConfig.java` and `ChatController.java` maps to our `lib/ws.js` + `sockets/index.js`)
4. **WebRTC** — For peer-to-peer video/audio communication with server-side signaling
5. **Redis** — For in-memory data storage and caching
6. **Friendship System** — Both systems have a friendship model (the original's `FriendShip.java` + `Friendship` table maps to our `friendships` table + `friendshipService.js`)
7. **Offline Message Delivery** — Both systems require delivering messages sent while receiver was offline (original's functional requirement: "deliver sender's message to receiver once the receiver is back online")

#### 3.3.4 Improvements Over the Original Design

| Improvement | Original Status | Our Implementation |
|---|---|---|
| **Cross-instance messaging** | Single server instance | Redis Pub/Sub distributes messages across multiple Node.js instances with instance-ID deduplication |
| **Horizontal scaling** | Planned for AWS but not implemented | Nginx load balancer + 2 Docker server instances, easily extendable to N |
| **Client-side caching** | Marked as "to be implemented" | Server-side Redis caching for invite tokens; client fetches from REST API with cursor-based pagination |
| **QR code room invites** | Not present | Time-limited invite codes in Redis (15-min TTL), shareable via QR code |
| **Private DM rooms** | Not present (only conversations between two users) | Auto-created private rooms between friends with get-or-create pattern |
| **Multi-device presence** | Not present | A user can be online from multiple devices; presence tracked per-socket with `Map<userId, Set<WebSocket>>` |
| **Advisory-locked migrations** | Not present (no migration system described) | Custom migration runner uses PostgreSQL advisory locks to prevent race conditions when multiple instances start concurrently |
| **TURN server fallback** | Not present | WebRTC configured with STUN + TURN servers, enabling video calls across restrictive NATs and firewalls |
| **Group chat rooms** | Conversations appear to be 1-on-1 based on DB schema (sender/receiver) | Full room system supporting both PRIVATE (1-on-1) and GROUP types with multi-member management |
| **Containerized deployment** | Local only (planned AWS) | Docker Compose orchestrates all 5 services; single `docker compose up` command |
| **No-framework backend** | Java 8 + Apache Tomcat (single-server deployment) | Raw Node.js HTTP with a custom 128-line router — no web framework, horizontally scaled |

---

## 4. Technologies, Protocols, and Services

### 4.1 Backend Stack

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20 (Alpine) | Server runtime |
| `ws` | 8.18 | Raw WebSocket server |
| `pg` | 8.13 | PostgreSQL driver (raw SQL) |
| `redis` | 5.10 | Redis client (Pub/Sub + KV) |
| `jsonwebtoken` | 9.0 | JWT authentication |
| `bcrypt` | 6.0 | Password hashing |
| `uuid` | 11.1 | Unique ID generation |

### 4.2 Frontend Stack

| Technology | Version | Purpose |
|---|---|---|
| React | 19.2 | UI framework |
| React Router | 7.13 | Client-side routing |
| Vite | 7.2 | Build tool + dev server |
| `qrcode.react` | 4.2 | QR code generation |
| Native WebSocket API | — | Real-time server communication |
| Native RTCPeerConnection | — | Peer-to-peer video/audio |

### 4.3 Infrastructure

| Technology | Purpose |
|---|---|
| Docker + Docker Compose | Containerized deployment |
| Nginx | Reverse proxy, load balancer |
| PostgreSQL 16 | Relational database |
| Redis 7 | In-memory data store, message broker |

### 4.4 Protocols Used

| Protocol | Where Used |
|---|---|
| **HTTP/1.1** | REST API communication |
| **WebSocket (RFC 6455)** | Real-time bidirectional messaging |
| **WebRTC** | Peer-to-peer audio/video |
| **SDP (Session Description Protocol)** | WebRTC offer/answer exchange |
| **ICE (Interactive Connectivity Establishment)** | WebRTC NAT traversal |
| **STUN** | Public IP discovery for WebRTC |
| **TURN** | Relay fallback when direct P2P is blocked |
| **TCP** | PostgreSQL and Redis connections |
| **JWT (RFC 7519)** | Stateless authentication tokens |

---

## 5. Database Design

### 5.1 Entity-Relationship Model

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│    users     │       │   room_members   │       │    rooms     │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (PK)      │──┐    │ id (PK)          │    ┌──│ id (PK)      │
│ username (U) │  ├────│ user_id (FK)     │    │  │ name         │
│ email (U)    │  │    │ room_id (FK)     │────┘  │ type (ENUM)  │
│ password_hash│  │    │ joined_at        │       │ created_by_id│──┐
│ avatar_url   │  │    └──────────────────┘       │ created_at   │  │
│ created_at   │  │                               │ updated_at   │  │
│ updated_at   │  │    ┌──────────────────┐       └──────────────┘  │
└──────────────┘  │    │    messages      │                         │
       │          │    ├──────────────────┤                         │
       │          ├────│ sender_id (FK)   │                         │
       │          │    │ room_id (FK)     │─────────────────────────┘
       │          │    │ id (PK)          │
       │          │    │ content          │
       │          │    │ type (ENUM)      │
       │          │    │ created_at       │
       │          │    └──────────────────┘
       │          │
       │          │    ┌──────────────────┐
       │          ├────│  friendships     │
       │          │    ├──────────────────┤
       │          └────│ requester_id (FK)│
       │               │ addressee_id (FK)│
       │               │ id (PK)          │
       │               │ status (ENUM)    │
       │               │ created_at       │
       │               │ updated_at       │
       │               └──────────────────┘
       │
  FK = Foreign Key, PK = Primary Key, U = Unique
```

### 5.2 Enums

- **RoomType**: `PRIVATE` (1-on-1 DMs), `GROUP` (multi-user rooms)
- **MessageType**: `TEXT`, `IMAGE`, `FILE`
- **FriendshipStatus**: `PENDING`, `ACCEPTED`, `REJECTED`

### 5.3 Key Indexes

| Table | Index | Purpose |
|---|---|---|
| `messages` | `(room_id, created_at DESC)` | Fast paginated message retrieval |
| `room_members` | `UNIQUE (user_id, room_id)` | Prevent duplicate memberships |
| `friendships` | `(addressee_id, status)` | Fast pending request lookups |
| `users` | `UNIQUE (username)`, `UNIQUE (email)` | Enforce uniqueness |

### 5.4 Custom Migration System

Instead of using an ORM migration tool, we built a custom migration runner (`src/db/migrate.js`) that:

1. Creates a `_migrations` tracking table
2. Reads `.sql` files from `src/db/migrations/` in order
3. Executes unapplied migrations inside transactions
4. Uses **PostgreSQL advisory locks** (`pg_advisory_lock(1)`) to prevent race conditions when multiple server instances start simultaneously
5. Handles idempotent re-runs gracefully

---

## 6. API Design

### 6.1 REST API Endpoints

All protected endpoints require a `Authorization: Bearer <JWT>` header.

#### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Create account (username, email, password) |
| `POST` | `/api/auth/login` | No | Login, returns JWT |
| `GET` | `/api/auth/me` | Yes | Get current user profile |

#### Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users?search=<term>` | Yes | Search users (min 2 chars) |
| `GET` | `/api/users/:id` | Yes | Get user by ID |

#### Rooms

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/rooms` | Yes | Create room (name, type, memberIds) |
| `GET` | `/api/rooms` | Yes | List user's rooms |
| `POST` | `/api/rooms/dm` | Yes | Get or create DM with a friend |
| `GET` | `/api/rooms/:id` | Yes | Room details with members |
| `POST` | `/api/rooms/:id/members` | Yes | Add member to room |
| `POST` | `/api/rooms/:id/invite` | Yes | Generate QR invite code |
| `POST` | `/api/rooms/join/:code` | Yes | Redeem invite code |
| `GET` | `/api/rooms/:id/messages` | Yes | Paginated messages (cursor-based) |

#### Friends

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/friends/request` | Yes | Send friend request |
| `POST` | `/api/friends/accept/:id` | Yes | Accept friend request |
| `POST` | `/api/friends/reject/:id` | Yes | Reject friend request |
| `GET` | `/api/friends` | Yes | List friends |
| `GET` | `/api/friends/pending` | Yes | Pending incoming requests |

### 6.2 WebSocket Protocol

Connection URL: `ws://<host>/ws?token=<JWT>`

All messages follow JSON format: `{ "event": "<name>", "data": { ... } }`

#### Client → Server Events

| Event | Data | Description |
|---|---|---|
| `join_room` | `{ roomId }` | Join a chat room |
| `leave_room` | `{ roomId }` | Leave a chat room |
| `typing` | `{ roomId, isTyping }` | Typing indicator |
| `send_message` | `{ roomId, content, type }` | Send a message |
| `call_user` | `{ to, offer }` | Initiate WebRTC call |
| `answer_call` | `{ to, answer }` | Answer WebRTC call |
| `ice_candidate` | `{ to, candidate }` | Send ICE candidate |
| `end_call` | `{ to }` | End call |

#### Server → Client Events

| Event | Data | Description |
|---|---|---|
| `new_message` | `{ id, content, sender, ... }` | New message in room |
| `offline_message` | `{ id, content, sender, ... }` | Queued offline message |
| `user_online` | `{ userId }` | User came online |
| `user_offline` | `{ userId }` | User went offline |
| `typing` | `{ userId, username, isTyping }` | Someone is typing |
| `incoming_call` | `{ from, username, offer }` | Incoming call |
| `call_accepted` | `{ from, answer }` | Call was accepted |
| `ice_candidate` | `{ from, candidate }` | ICE candidate received |
| `call_ended` | `{ from }` | Call ended |

---

## 7. Real-Time Communication

### 7.1 WebSocket Architecture

The custom WebSocket server (`lib/ws.js`) implements:

- **JWT authentication during HTTP upgrade handshake** — the token is passed as a query parameter and verified before the WebSocket connection is established
- **Room-based broadcasting** — each chat room maps to a `Set<WebSocket>` for efficient message delivery
- **Multi-device tracking** — a single user can be connected from multiple devices; `Map<userId, Set<WebSocket>>` tracks all sessions
- **Online presence** — `user_online`/`user_offline` events are broadcast when a user's first socket connects or last socket disconnects

### 7.2 Cross-Instance Message Flow

When messages must reach clients connected to different server instances:

```
User A (Server 1)  ──send_message──►  Server 1
                                         │
                    ┌────────────────────┤
                    │                    │
                    ▼                    ▼
            PostgreSQL            Redis PUBLISH
            (persist)             channel: room:<id>
                                         │
                    ┌────────────────────┤
                    │                    │
                    ▼                    ▼
            Server 1 broadcasts   Server 2 receives
            to local sockets      via SUBSCRIBE
                    │                    │
                    ▼                    ▼
            User A sees own msg   User B sees msg
            (Server 1 clients)    (Server 2 clients)
```

**Instance deduplication**: Each server instance has a unique `INSTANCE_ID` (generated via `crypto.randomUUID()`). When publishing to Redis, the `instanceId` is included in the payload. When receiving from Redis, messages from the same instance are ignored to prevent duplicate delivery.

### 7.3 Offline Message Delivery

1. When a message is sent, the server checks which room members are **offline** (not present in any server's `userSockets` map)
2. For each offline member, the message ID is pushed to a Redis list: `pending:<userId>`
3. When the user reconnects (WebSocket `connection` event), the server:
   - Retrieves all pending message IDs from Redis
   - Fetches full message objects from PostgreSQL
   - Delivers them as `offline_message` events
   - Clears the Redis queue

### 7.4 WebRTC Video/Audio

WebRTC enables **peer-to-peer** communication directly between browsers, without media passing through the server. The server only handles **signaling**:

```
User A                    Server                    User B
  │                         │                         │
  │── call_user (offer) ──► │                         │
  │                         │── incoming_call ──────► │
  │                         │                         │
  │                         │◄── answer_call ──────── │
  │◄── call_accepted ────── │                         │
  │                         │                         │
  │── ice_candidate ──────► │── ice_candidate ──────► │
  │◄── ice_candidate ────── │◄── ice_candidate ────── │
  │                         │                         │
  │◄═══════ P2P Media Stream (direct, no server) ═══►│
```

**STUN servers** (Google's and Twilio's public servers) are used to discover each peer's public IP address for NAT traversal. **TURN servers** (Metered Open Relay) are configured as a fallback to relay media when direct peer-to-peer connections are blocked by restrictive NATs or firewalls.

---

## 8. Security

### 8.1 Authentication Flow

1. **Registration**: Password hashed with `bcrypt` (10 salt rounds), stored in PostgreSQL
2. **Login**: Password verified with `bcrypt.compare()`, JWT issued (contains `userId`, 7-day expiry)
3. **REST API**: JWT validated via `authMiddleware` on every protected route
4. **WebSocket**: JWT validated during the HTTP-to-WebSocket upgrade handshake before the connection is established

### 8.2 Security Measures

| Measure | Implementation |
|---|---|
| Password hashing | bcrypt with salt |
| Stateless auth | JWT (no server-side sessions) |
| CORS | Custom middleware with origin whitelist |
| SQL injection prevention | Parameterized queries (`$1`, `$2`) |
| Room access control | Membership check before message send |
| Invite expiry | Redis TTL (15 minutes) |
| Input validation | Content length checks, type validation |

---

## 9. Deployment Architecture

### 9.1 Docker Compose Services

The entire application runs in **5 Docker containers** orchestrated by Docker Compose:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Docker Compose Network                      │
│                                                                 │
│   ┌─────────┐                                                   │
│   │  Nginx  │ :3000 (host) → :80 (container)                   │
│   │  L.B.   │                                                   │
│   └────┬────┘                                                   │
│        │ ip_hash                                                │
│   ┌────┴────────────┐                                           │
│   │                 │                                           │
│   ▼                 ▼                                           │
│ ┌─────────┐   ┌─────────┐                                      │
│ │ Server1 │   │ Server2 │  Node.js :3000 (internal)            │
│ │ (node)  │   │ (node)  │                                      │
│ └────┬────┘   └────┬────┘                                      │
│      │             │                                            │
│   ┌──┴─────────────┴──┐                                        │
│   │                    │                                        │
│   ▼                    ▼                                        │
│ ┌──────────┐    ┌───────────┐                                   │
│ │PostgreSQL│    │   Redis   │                                   │
│ │  :5432   │    │   :6379   │                                   │
│ └──────────┘    └───────────┘                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Load Balancing Strategy

**Nginx** uses `ip_hash` upstream directive:

- Client IP is hashed to determine which backend server handles the request
- The same client always reaches the same server (sticky sessions)
- This is critical for WebSocket connections which must persist on a single server
- WebSocket `Upgrade` headers are forwarded through the proxy

### 9.3 Health Checks and Resilience

- **Redis health check**: `redis-cli ping` every 5 seconds; servers wait for Redis to be healthy before starting
- **Redis retry logic**: Server attempts to connect to Redis up to 10 times with 2-second delays
- **Migration locking**: PostgreSQL advisory locks prevent race conditions when both servers run migrations simultaneously

---

## 10. Distributed System Concepts Applied

### 10.1 Horizontal Scaling

The application can scale by adding more Node.js server instances behind Nginx. Each instance is **stateless** — all shared state lives in Redis (transient) and PostgreSQL (persistent).

### 10.2 Publish/Subscribe Pattern

Redis Pub/Sub decouples message producers from consumers. When Server 1 receives a chat message, it publishes to channel `room:<id>`. Server 2 subscribes to the same channel and delivers the message to its local clients.

### 10.3 Sticky Sessions

WebSocket connections are stateful (long-lived TCP). Nginx's `ip_hash` ensures that once a client upgrades to WebSocket on Server 1, all subsequent requests from that IP go to Server 1.

### 10.4 Eventual Consistency

Messages are persisted to PostgreSQL (source of truth) and broadcast via Redis (real-time). If Redis loses a message, the client can fetch it via the REST API. Offline messages are queued in Redis and delivered on reconnect.

### 10.5 Peer-to-Peer Communication (WebRTC)

Audio/video traffic flows directly between browsers, reducing server load. The server only handles signaling (SDP exchange and ICE candidate relay).

### 10.6 Shared-Nothing Architecture

Each server instance maintains only its own in-memory WebSocket connections. No shared memory or filesystem. All cross-instance coordination goes through Redis.

### 10.7 Idempotent Operations

The migration system, invite redemption (checking existing membership), and DM creation (get-or-create pattern) are designed to be safe for retry.

---

## 11. System Workflow

### 11.1 User Registration & Login

1. Client sends `POST /api/auth/register` with username, email, password
2. Server hashes password with bcrypt, inserts into `users` table
3. Server returns JWT token
4. Client stores token, includes it in all subsequent requests

### 11.2 Joining a Chat Room

1. Client navigates to `/chat/:roomId`
2. Client fetches room data via `GET /api/rooms/:id`
3. Client opens WebSocket: `ws://host/ws?token=<JWT>`
4. Client sends `{ event: "join_room", data: { roomId } }`
5. Server adds socket to room's Set, subscribes to Redis `room:<roomId>` channel
6. Client fetches message history via `GET /api/rooms/:id/messages`

### 11.3 Sending a Message

1. Client sends `{ event: "send_message", data: { roomId, content } }` over WebSocket
2. Server validates membership, persists message to PostgreSQL
3. Server broadcasts `new_message` to all local room sockets
4. Server publishes to Redis `room:<roomId>` for other instances
5. Server checks which room members are offline, queues message IDs in Redis

### 11.4 QR Code Room Invite

1. Member clicks "QR Invite" → `POST /api/rooms/:id/invite`
2. Server generates random 8-hex-char code, stores in Redis with 15-min TTL
3. Client displays QR code encoding the invite URL
4. Recipient scans QR → navigates to `/join/:code`
5. Client calls `POST /api/rooms/join/:code`
6. Server verifies code in Redis, adds user as room member

### 11.5 Video Call

1. User A clicks "Video Call" → browser creates `RTCPeerConnection`, generates SDP offer
2. Offer sent via WebSocket `call_user` event → relayed to User B
3. User B receives `incoming_call`, creates answer SDP → sent via `answer_call`
4. Both peers exchange ICE candidates via WebSocket
5. Direct P2P media stream established between browsers

---

## 12. Frontend Architecture

### 12.1 Component Structure

```
App.jsx (Router)
├── Login.jsx
├── Register.jsx
├── RoomList.jsx (Home)
│   ├── FriendsList.jsx
│   └── FriendRequests.jsx
├── ChatRoom.jsx
│   ├── InviteModal.jsx
│   ├── CallModal.jsx
│   └── Avatar.jsx
└── JoinRoom.jsx
```

### 12.2 State Management

- **AuthContext**: Global authentication state (user, token, login/logout)
- **SocketContext**: WebSocket connection state, reconnection logic, event dispatching

### 12.3 Responsive Design

- **Desktop** (> 1024px): Full sidebar with friends panel
- **Tablet** (768–1024px): Condensed layout, icon-only header buttons
- **Mobile** (< 768px): Bottom drawer for friends, touch-optimized targets
- **Small phone** (< 480px): Further simplified layout
- **iOS safe areas**: Viewport-fit cover with `env(safe-area-inset-*)` padding

---

## 13. How to Run

### Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ (for local frontend development)

### Start Backend (Docker)

```bash
docker compose up --build
```

This starts PostgreSQL, Redis, two Node.js servers, and Nginx. The backend is available at `http://localhost:3000`.

### Start Frontend (Development)

```bash
cd client
npm install
npm run dev
```

The Vite dev server runs at `https://localhost:5173` and proxies API/WebSocket requests to `http://localhost:3000`.

### Access the Application

1. Open `https://localhost:5173` in the browser
2. Register two accounts in separate tabs/browsers
3. Create a room, send messages, add friends, start video calls

---

## 14. File Structure Reference

```
distributed-chat-system/
├── client/                     # Frontend (React + Vite)
│   ├── src/
│   │   ├── context/            # Auth and Socket contexts
│   │   ├── pages/              # Route-level components
│   │   ├── components/         # Reusable UI components
│   │   └── services/api.js     # HTTP API client
│   └── vite.config.js
├── src/                        # Backend (Node.js)
│   ├── server.js               # HTTP server entry point
│   ├── lib/
│   │   ├── router.js           # Custom HTTP router
│   │   ├── ws.js               # Custom WebSocket server
│   │   ├── redisPubSub.js      # Redis Pub/Sub layer
│   │   ├── db.js               # PostgreSQL connection pool
│   │   ├── cors.js             # CORS middleware
│   │   ├── parseBody.js        # JSON body parser
│   │   ├── response.js         # Response helpers
│   │   └── redisClient.js      # Redis client singleton
│   ├── middleware/auth.js       # JWT authentication
│   ├── routes/                  # REST API route handlers
│   ├── services/                # Business logic layer
│   ├── sockets/index.js         # WebSocket event handlers
│   └── db/
│       ├── migrate.js           # Custom migration runner
│       └── migrations/          # SQL migration files
├── nginx/nginx.conf             # Nginx load balancer config
├── docker-compose.yml           # Container orchestration
├── Dockerfile                   # Node.js container build
└── package.json                 # Backend dependencies
```
