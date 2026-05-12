# DISTRIBUTED CHAT SYSTEM
## System Documentation

Web Services and Cloud Computing — Final Project

Group Name: [Your Group Name]
Members: [Names]
Date: [Presentation Date]


---


## 1. Executive Summary

This project implements a distributed real-time chat application built entirely from low-level primitives without web frameworks. The system supports real-time text messaging, peer-to-peer video/audio calling, group and private chat rooms, a friendship system, QR-code room invitations, and offline message delivery. It is designed to scale horizontally across multiple server instances using Redis Pub/Sub for cross-instance communication and Nginx for load balancing.

Key design decision: Instead of relying on high-level frameworks (Express.js, Socket.io, Prisma ORM, Simple-Peer), the system uses raw Node.js HTTP, the ws WebSocket library, raw SQL with pg, and the native browser RTCPeerConnection API. This demonstrates a deep understanding of the underlying protocols and distributed system principles.


---


## 2. System Overview

### 2.1 Problem Statement

Modern chat applications must handle millions of concurrent users exchanging messages in real time. A single server cannot sustain this load. The system must:

- Deliver messages in real time with low latency.
- Scale horizontally by adding more servers without downtime.
- Guarantee message delivery even when recipients are offline.
- Support both text-based and audio/video communication.
- Maintain consistency across multiple server instances.

### 2.2 Feature Summary

- **User authentication** — REST API + JWT tokens
- **Real-time text messaging** — WebSocket (ws library)
- **Video/audio calling** — WebRTC (native RTCPeerConnection)
- **Group chat rooms** — Room-based WebSocket broadcasting
- **Private DMs** — 1-on-1 room auto-creation between friends
- **Friendship system** — REST API + real-time notifications
- **QR code room invites** — Redis-backed invite tokens (15-min TTL)
- **Offline message delivery** — Redis queue + delivery on reconnect
- **Cross-instance sync** — Redis Pub/Sub
- **Load balancing** — Nginx with IP-hash sticky sessions
- **Containerized deployment** — Docker Compose (5 services)


---


## 3. Architecture Design

### 3.1 Three-Layer Architecture

The system follows a classic three-layer distributed architecture:

**Presentation Layer:**
React SPA (built with Vite), native browser WebSocket API, native RTCPeerConnection.

**Business Layer:**
Node.js HTTP Server (multiple instances), custom Router (lib/router.js), JWT authentication middleware, REST API endpoints (routes/), service layer (services/), custom WebSocket server (lib/ws.js), Redis Pub/Sub adapter (lib/redisPubSub.js).

**Persistence Layer:**
PostgreSQL 16 (users, rooms, room_members, messages, friendships tables). Redis 7 (Pub/Sub channels, offline message queues, invite token store).

[Insert Three-Layer Architecture Diagram]

### 3.2 Distributed System Components

- **Nginx** — Reverse proxy and load balancer. Enables horizontal scaling with sticky sessions.
- **Node.js Server x2** — Application logic and WebSocket handling. Stateless replicas.
- **Redis** — Pub/Sub messaging, caching, and offline queues. Acts as the message broker and shared state.
- **PostgreSQL** — Persistent storage. Single source of truth for all data.
- **Browser (WebRTC)** — Peer-to-peer media streaming. Decentralized communication.


### 3.3 Comparison with the Original System

Our project is a redesign of the distributed chat application described in "Chat Application with Distributed System" by Shuyang Zhu (Harrisburg University, Spring 2020, GRAD 699, supervised by Dr. Abrar Qureshi). The original system was built with Java 8, deployed on Apache Tomcat, with Angular and NgRx for the frontend, MySQL for persistent storage, and Redis as an in-memory database. The server code was organized into two modules (ms-account-management and ms-chat-application), deployed together as a single application on one Tomcat instance.

We retained the same architectural principles (3-layer architecture, REST + WebSocket + WebRTC) but redesigned the technology stack and made deliberate decisions to go lower-level where possible.

#### 3.3.1 Original System Software Specification

From the paper's Software Specification table (Section 3):

- **Operating System:** Windows 10
- **Programming Language:** Java 8 (NIO, lambda, function flow)
- **IDE:** IntelliJ
- **Frontend Technology:** Angular (TypeScript) with NgRx state management
- **Database:** MySQL + Redis
- **Application Server:** Apache Tomcat
- **Server Structure:** Multi-module (ms-account-management, ms-chat-application), single deployment
- **Deployment:** Local (planned AWS migration)

The original server was organized into two Java modules (each with its own pom.xml), deployed together on a single Apache Tomcat instance:

- **ms-account-management** — Controller.java, MsAccountManagementApplication.java, AccountService.java, repository classes (UserRepository.java, UserDbRepository.java), models (User.java, FriendShip.java).
- **ms-chat-application** — MsChatApplicationMain.java, ChatController.java, WebSocketEventListener.java, WebSocketConfig.java, model (ChatMessage.java).

The original Angular frontend used NgRx for state management (actions, effects, reducers, selectors for both account and messages modules), with components for chatList, chatPage, friendList, landingPage, mainPage, and confirmation-dialog.

The original database had 4 tables:
- **User:** user_id, user_name, user_password (encrypted).
- **User_activity:** user_id, last_active_time.
- **Conversation:** sender, receiver, timestamp, send_timestamp.
- **Friendship:** user_1, user_2.

#### 3.3.2 Technology Stack Comparison

- **Language:** Java 8 (NIO, lambda) → JavaScript (Node.js 20). Rationale: Single language across frontend and backend; event-driven I/O fits real-time WebSocket workloads.
- **Server:** Java 8 + Apache Tomcat → Raw Node.js http.createServer + custom Router. Rationale: Eliminates framework overhead; demonstrates HTTP routing, path matching, and middleware internals.
- **Architecture:** Multi-module monolith (single Tomcat deployment) → Single Node.js server (horizontally scaled via Docker). Rationale: Horizontal scaling via multiple identical instances behind Nginx load balancer.
- **Real-time:** Java WebSocket API → ws library + custom room/presence management. Rationale: Low-level control over WebSocket upgrade handshake, frame protocol, and per-room broadcasting.
- **Video/Audio:** WebRTC → WebRTC (native RTCPeerConnection + STUN/TURN). Rationale: Both use WebRTC; we implement SDP offer/answer, ICE trickle, and STUN/TURN directly.
- **Database:** MySQL → PostgreSQL 16 with raw SQL. Rationale: Advisory locks for migration safety, native UUID generation, enum types; raw SQL for full control.
- **Data Access:** Repository pattern → Parameterized raw SQL queries. Rationale: Direct SQL control with no abstraction hiding query performance.
- **Cache/Broker:** Redis (in-memory database) → Redis 7 (Pub/Sub + offline queues + invite tokens). Rationale: Same technology; expanded to cross-instance Pub/Sub, offline message queuing, and invite tokens.
- **Frontend:** Angular + NgRx → React 19 + Context API. Rationale: Lighter-weight; Context API for auth/socket state vs. NgRx full Redux pattern.
- **Load Balancing:** Not implemented → Nginx with ip_hash sticky sessions. Rationale: Explicit load balancer for horizontal scaling and WebSocket affinity.
- **Containerization:** Not implemented (local) → Docker Compose (5 services). Rationale: Reproducible multi-service deployment with a single command.
- **Authentication:** Username/password in MySQL → JWT (stateless) + bcrypt. Rationale: Stateless tokens enable horizontal scaling without shared session storage.

#### 3.3.3 Architectural Principles Retained

Both systems share the same core distributed architecture from the original paper:

1. **Three-Layer Architecture** — The original defines Presentation Layer (Angular UI + client-side cache), Business Layer (gateway + logic), and Persistence Layer (Redis + MySQL). Our system mirrors this with React SPA, Node.js HTTP + WebSocket server + service layer, and Redis + PostgreSQL.

2. **REST API** — For account management and user operations. The original's ms-account-management module maps to our routes/auth.js and routes/users.js.

3. **WebSocket** — For real-time bidirectional text messaging. The original's ms-chat-application with WebSocketConfig.java and ChatController.java maps to our lib/ws.js and sockets/index.js.

4. **WebRTC** — For peer-to-peer video/audio communication with server-side signaling.

5. **Redis** — For in-memory data storage and caching.

6. **Friendship System** — Both systems have a friendship model. The original's FriendShip.java and Friendship table maps to our friendships table and friendshipService.js.

7. **Offline Message Delivery** — Both systems require delivering messages sent while receiver was offline. The original's functional requirement states: "deliver sender's message to receiver once the receiver is back online."

#### 3.3.4 Improvements Over the Original Design

- **Cross-instance messaging** — Original: single server instance. Ours: Redis Pub/Sub distributes messages across multiple instances with deduplication.
- **Horizontal scaling** — Original: planned for AWS but not implemented. Ours: Nginx load balancer + 2 Docker server instances, extendable to N.
- **Client-side caching** — Original: marked as "to be implemented." Ours: server-side Redis caching; client fetches via REST API with cursor-based pagination.
- **QR code room invites** — Original: not present. Ours: time-limited invite codes in Redis (15-min TTL), shareable via QR code.
- **Private DM rooms** — Original: not present. Ours: auto-created private rooms between friends with get-or-create pattern.
- **Multi-device presence** — Original: not present. Ours: presence tracked per-socket with Map of userId to Set of WebSocket connections.
- **Advisory-locked migrations** — Original: not present. Ours: custom migration runner uses PostgreSQL advisory locks for concurrent startup safety.
- **TURN server fallback** — Original: not present. Ours: WebRTC configured with STUN + TURN for calls across restrictive networks.
- **Group chat rooms** — Original: 1-on-1 only (sender/receiver schema). Ours: full room system with PRIVATE and GROUP types.
- **Containerized deployment** — Original: local only (AWS planned). Ours: Docker Compose orchestrates all 5 services with single command.
- **No-framework backend** — Original: Java 8 + Apache Tomcat. Ours: raw Node.js HTTP with custom 128-line router, horizontally scaled.


---


## 4. Technologies, Protocols, and Services

### 4.1 Backend Stack

- **Node.js** (v20, Alpine) — Server runtime
- **ws** (v8.18) — Raw WebSocket server
- **pg** (v8.13) — PostgreSQL driver (raw SQL)
- **redis** (v5.10) — Redis client (Pub/Sub + key-value)
- **jsonwebtoken** (v9.0) — JWT authentication
- **bcrypt** (v6.0) — Password hashing
- **uuid** (v11.1) — Unique ID generation

### 4.2 Frontend Stack

- **React** (v19.2) — UI framework
- **React Router** (v7.13) — Client-side routing
- **Vite** (v7.2) — Build tool and dev server
- **qrcode.react** (v4.2) — QR code generation
- **Native WebSocket API** — Real-time server communication
- **Native RTCPeerConnection** — Peer-to-peer video/audio

### 4.3 Infrastructure

- **Docker + Docker Compose** — Containerized deployment
- **Nginx** — Reverse proxy and load balancer
- **PostgreSQL 16** — Relational database
- **Redis 7** — In-memory data store and message broker

### 4.4 Protocols Used

- **HTTP/1.1** — REST API communication
- **WebSocket (RFC 6455)** — Real-time bidirectional messaging
- **WebRTC** — Peer-to-peer audio/video
- **SDP (Session Description Protocol)** — WebRTC offer/answer exchange
- **ICE (Interactive Connectivity Establishment)** — WebRTC NAT traversal
- **STUN** — Public IP discovery for WebRTC
- **TURN** — Relay fallback when direct P2P is blocked
- **TCP** — PostgreSQL and Redis connections
- **JWT (RFC 7519)** — Stateless authentication tokens


---


## 5. Database Design

### 5.1 Tables

**Users:**
id (PK), username (unique), email (unique), password_hash, avatar_url, created_at, updated_at.

**Rooms:**
id (PK), name, type (PRIVATE or GROUP), created_by_id (FK to users), created_at, updated_at.

**Room_members:**
id (PK), user_id (FK to users), room_id (FK to rooms), joined_at. Unique constraint on (user_id, room_id).

**Messages:**
id (PK), content, type (TEXT, IMAGE, or FILE), sender_id (FK to users), room_id (FK to rooms), created_at. Index on (room_id, created_at DESC).

**Friendships:**
id (PK), requester_id (FK to users), addressee_id (FK to users), status (PENDING, ACCEPTED, or REJECTED), created_at, updated_at. Unique constraint on (requester_id, addressee_id). Index on (addressee_id, status).

[Insert Entity-Relationship Diagram]

### 5.2 Custom Migration System

Instead of using an ORM migration tool, we built a custom migration runner (src/db/migrate.js) that:

1. Creates a _migrations tracking table.
2. Reads .sql files from src/db/migrations/ in order.
3. Executes unapplied migrations inside transactions.
4. Uses PostgreSQL advisory locks (pg_advisory_lock) to prevent race conditions when multiple server instances start simultaneously.
5. Handles idempotent re-runs gracefully.


---


## 6. API Design

### 6.1 REST API Endpoints

All protected endpoints require an Authorization: Bearer <JWT> header.

**Authentication:**
- POST /api/auth/register (public) — Create account
- POST /api/auth/login (public) — Login, returns JWT
- GET /api/auth/me (auth) — Get current user profile

**Users:**
- GET /api/users?search=term (auth) — Search users (min 2 chars)
- GET /api/users/:id (auth) — Get user by ID

**Rooms:**
- POST /api/rooms (auth) — Create room
- GET /api/rooms (auth) — List user's rooms
- POST /api/rooms/dm (auth) — Get or create DM with a friend
- GET /api/rooms/:id (auth) — Room details with members
- POST /api/rooms/:id/members (auth) — Add member to room
- POST /api/rooms/:id/invite (auth) — Generate QR invite code
- POST /api/rooms/join/:code (auth) — Redeem invite code
- GET /api/rooms/:id/messages (auth) — Paginated messages (cursor-based)

**Friends:**
- POST /api/friends/request (auth) — Send friend request
- POST /api/friends/accept/:id (auth) — Accept friend request
- POST /api/friends/reject/:id (auth) — Reject friend request
- GET /api/friends (auth) — List friends
- GET /api/friends/pending (auth) — Pending incoming requests

### 6.2 WebSocket Protocol

Connection URL: ws://<host>/ws?token=<JWT>

All messages use JSON format: { "event": "<name>", "data": { ... } }

**Client to Server Events:**
- **join_room** { roomId } — Join a chat room
- **leave_room** { roomId } — Leave a chat room
- **typing** { roomId, isTyping } — Typing indicator
- **send_message** { roomId, content, type } — Send a message
- **call_user** { to, offer } — Initiate WebRTC call
- **answer_call** { to, answer } — Answer WebRTC call
- **ice_candidate** { to, candidate } — Send ICE candidate
- **end_call** { to } — End call

**Server to Client Events:**
- **new_message** { id, content, sender } — New message in room
- **offline_message** { id, content, sender } — Queued offline message
- **user_online** { userId } — User came online
- **user_offline** { userId } — User went offline
- **typing** { userId, username } — Someone is typing
- **incoming_call** { from, username, offer } — Incoming call
- **call_accepted** { from, answer } — Call was accepted
- **ice_candidate** { from, candidate } — ICE candidate received
- **call_ended** { from } — Call ended


---


## 7. Real-Time Communication

### 7.1 WebSocket Architecture

The custom WebSocket server (lib/ws.js) implements:

- **JWT authentication during HTTP upgrade handshake:** the token is passed as a query parameter and verified before the WebSocket connection is established.
- **Room-based broadcasting:** each chat room maps to a Set of WebSocket connections for efficient message delivery.
- **Multi-device tracking:** a single user can be connected from multiple devices. A Map of userId to Set of WebSocket connections tracks all sessions.
- **Online presence:** user_online and user_offline events are broadcast when a user's first socket connects or last socket disconnects.

### 7.2 Cross-Instance Message Flow

When messages must reach clients connected to different server instances:

1. User A sends a message via WebSocket to Server 1.
2. Server 1 persists the message to PostgreSQL.
3. Server 1 broadcasts the message to all WebSocket clients in the room on Server 1.
4. Server 1 publishes the message to the Redis channel "room:<roomId>" with its instance ID.
5. Server 2 receives the published message via its Redis subscription.
6. Server 2 checks the instance ID and ignores messages from itself.
7. Server 2 broadcasts the message to all WebSocket clients in the room on Server 2.

Instance deduplication: Each server instance has a unique INSTANCE_ID generated via crypto.randomUUID(). When publishing to Redis, the instanceId is included in the payload. When receiving from Redis, messages from the same instance are ignored to prevent duplicate delivery.

[Insert Cross-Instance Message Flow Diagram]

### 7.3 Offline Message Delivery

1. When a message is sent, the server checks which room members are offline (not present in any server's userSockets map).
2. For each offline member, the message ID is pushed to a Redis list: pending:<userId>.
3. When the user reconnects (WebSocket connection event), the server retrieves all pending message IDs from Redis, fetches full message objects from PostgreSQL, delivers them as offline_message events, and clears the Redis queue.

### 7.4 WebRTC Video/Audio

WebRTC enables peer-to-peer communication directly between browsers, without media passing through the server. The server only handles signaling:

1. User A creates an RTCPeerConnection and generates an SDP offer.
2. The offer is sent via WebSocket (call_user event) and relayed to User B.
3. User B receives the incoming_call event, creates an SDP answer, and sends it back via answer_call.
4. Both peers exchange ICE candidates via WebSocket for NAT traversal.
5. A direct peer-to-peer media stream is established between the browsers.

STUN servers (Google and Twilio) are used to discover each peer's public IP address. TURN servers (Metered Open Relay) are configured as a fallback to relay media when direct connections are blocked by restrictive NATs or firewalls.


---


## 8. Security

### 8.1 Authentication Flow

1. **Registration:** Password hashed with bcrypt (10 salt rounds), stored in PostgreSQL.
2. **Login:** Password verified with bcrypt.compare(), JWT issued containing userId with 7-day expiry.
3. **REST API:** JWT validated via authMiddleware on every protected route.
4. **WebSocket:** JWT validated during the HTTP-to-WebSocket upgrade handshake before the connection is established.

### 8.2 Security Measures

- **Password hashing** — bcrypt with salt.
- **Stateless authentication** — JWT (no server-side sessions).
- **CORS** — Custom middleware with origin whitelist.
- **SQL injection prevention** — Parameterized queries ($1, $2).
- **Room access control** — Membership check before message send.
- **Invite expiry** — Redis TTL (15 minutes).
- **Input validation** — Content length checks, type validation.


---


## 9. Deployment Architecture

### 9.1 Docker Compose Services

The entire application runs in 5 Docker containers orchestrated by Docker Compose:

- **Nginx** — Reverse proxy and load balancer. Maps host port 3000 to container port 80.
- **Server 1** — Node.js application instance. Runs on internal port 3000.
- **Server 2** — Node.js application instance. Runs on internal port 3000.
- **PostgreSQL** — Database. Maps host port 5433 to container port 5432. Volume: postgres_data.
- **Redis** — In-memory data store. Internal only. Volume: redis_data. Health check: redis-cli ping.

[Insert Docker Deployment Diagram]

### 9.2 Load Balancing Strategy

Nginx uses the ip_hash upstream directive:
- Client IP is hashed to determine which backend server handles the request.
- The same client always reaches the same server (sticky sessions).
- This is critical for WebSocket connections which must persist on a single server.
- WebSocket Upgrade headers are forwarded through the proxy.

### 9.3 Health Checks and Resilience

- **Redis health check:** redis-cli ping every 5 seconds; servers wait for Redis to be healthy before starting.
- **Redis retry logic:** Server attempts to connect to Redis up to 10 times with 2-second delays.
- **Migration locking:** PostgreSQL advisory locks prevent race conditions when both servers run migrations simultaneously.


---


## 10. Distributed System Concepts Applied

**10.1 Horizontal Scaling:** The application scales by adding more Node.js instances behind Nginx. Each instance is stateless — all shared state lives in Redis (transient) and PostgreSQL (persistent).

**10.2 Publish/Subscribe Pattern:** Redis Pub/Sub decouples message producers from consumers. Server 1 publishes to channel "room:<id>". Server 2 subscribes and delivers to its local clients.

**10.3 Sticky Sessions:** WebSocket connections are stateful (long-lived TCP). Nginx ip_hash ensures the same client always reaches the same server.

**10.4 Eventual Consistency:** Messages are persisted to PostgreSQL (source of truth) and broadcast via Redis (real-time). Offline messages are queued in Redis and delivered on reconnect.

**10.5 Peer-to-Peer Communication (WebRTC):** Audio/video traffic flows directly between browsers, reducing server load. The server only handles signaling.

**10.6 Shared-Nothing Architecture:** Each server instance maintains only its own in-memory WebSocket connections. No shared memory or filesystem. All cross-instance coordination goes through Redis.

**10.7 Idempotent Operations:** The migration system, invite redemption, and DM creation (get-or-create pattern) are designed to be safe for retry.


---


## 11. System Workflow

### 11.1 User Registration and Login

1. Client sends POST /api/auth/register with username, email, and password.
2. Server hashes password with bcrypt and inserts into the users table.
3. Server returns a JWT token.
4. Client stores the token and includes it in all subsequent requests.

### 11.2 Joining a Chat Room

1. Client navigates to /chat/:roomId.
2. Client fetches room data via GET /api/rooms/:id.
3. Client opens a WebSocket connection: ws://host/ws?token=<JWT>.
4. Client sends { event: "join_room", data: { roomId } }.
5. Server adds the socket to the room's Set and subscribes to the Redis room:<roomId> channel.
6. Client fetches message history via GET /api/rooms/:id/messages.

### 11.3 Sending a Message

1. Client sends { event: "send_message", data: { roomId, content } } over WebSocket.
2. Server validates membership and persists the message to PostgreSQL.
3. Server broadcasts new_message to all local room sockets.
4. Server publishes to Redis room:<roomId> for other instances.
5. Server checks which room members are offline and queues message IDs in Redis.

### 11.4 QR Code Room Invite

1. Member clicks "QR Invite" which calls POST /api/rooms/:id/invite.
2. Server generates a random 8-character hex code and stores it in Redis with a 15-minute TTL.
3. Client displays a QR code encoding the invite URL.
4. Recipient scans the QR code and navigates to /join/:code.
5. Client calls POST /api/rooms/join/:code.
6. Server verifies the code in Redis and adds the user as a room member.

### 11.5 Video Call

1. User A clicks "Video Call." The browser creates an RTCPeerConnection and generates an SDP offer.
2. The offer is sent via the WebSocket call_user event and relayed to User B.
3. User B receives incoming_call, creates an answer SDP, and sends it via answer_call.
4. Both peers exchange ICE candidates via WebSocket.
5. A direct peer-to-peer media stream is established between the browsers.


---


## 12. Frontend Architecture

### 12.1 Component Structure

- **App.jsx** (Router)
  - Login.jsx
  - Register.jsx
  - RoomList.jsx (Home)
    - FriendsList.jsx
    - FriendRequests.jsx
  - ChatRoom.jsx
    - InviteModal.jsx
    - CallModal.jsx
    - Avatar.jsx
  - JoinRoom.jsx

### 12.2 State Management

- **AuthContext** — Global authentication state (user, token, login, logout).
- **SocketContext** — WebSocket connection state, reconnection logic, event dispatching.

### 12.3 Responsive Design

- **Desktop** (above 1024px) — Full sidebar with friends panel.
- **Tablet** (768 to 1024px) — Condensed layout, icon-only header buttons.
- **Mobile** (below 768px) — Bottom drawer for friends, touch-optimized targets.
- **Small phone** (below 480px) — Further simplified layout.
- **iOS safe areas** — Viewport-fit cover with env(safe-area-inset) padding.


---


## 13. How to Run

### Prerequisites

- Docker and Docker Compose installed.
- Node.js 20 or later (for local frontend development).

### Start Backend (Docker)

Run: docker compose up --build

This starts PostgreSQL, Redis, two Node.js servers, and Nginx. The backend is available at http://localhost:3000.

### Start Frontend (Development)

Run: cd client, then npm install, then npm run dev

The Vite dev server runs at https://localhost:5173 and proxies API/WebSocket requests to http://localhost:3000.

### Access the Application

1. Open https://localhost:5173 in the browser.
2. Register two accounts in separate tabs or browsers.
3. Create a room, send messages, add friends, and start video calls.


---


## 14. File Structure Reference

- **distributed-chat-system/**
  - **client/** — Frontend (React + Vite)
    - **src/**
      - **context/** — Auth and Socket contexts
      - **pages/** — Route-level components
      - **components/** — Reusable UI components
      - **services/api.js** — HTTP API client
    - vite.config.js
  - **src/** — Backend (Node.js)
    - server.js — HTTP server entry point
    - **lib/**
      - router.js — Custom HTTP router
      - ws.js — Custom WebSocket server
      - redisPubSub.js — Redis Pub/Sub layer
      - db.js — PostgreSQL connection pool
      - cors.js — CORS middleware
      - parseBody.js — JSON body parser
      - response.js — Response helpers
      - redisClient.js — Redis client singleton
    - **middleware/auth.js** — JWT authentication
    - **routes/** — REST API route handlers
    - **services/** — Business logic layer
    - **sockets/index.js** — WebSocket event handlers
    - **db/**
      - migrate.js — Custom migration runner
      - **migrations/** — SQL migration files
  - nginx/nginx.conf — Nginx load balancer config
  - docker-compose.yml — Container orchestration
  - Dockerfile — Node.js container build
  - package.json — Backend dependencies
