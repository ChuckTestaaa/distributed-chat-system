from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import nsdecls
from docx.oxml import parse_xml


def set_cell_shading(cell, color):
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color}"/>')
    cell._tc.get_or_add_tcPr().append(shading)


def add_table(doc, headers, rows):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.LEFT

    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = h
        for p in cell.paragraphs:
            for run in p.runs:
                run.bold = True
                run.font.size = Pt(9)
        set_cell_shading(cell, "2B579A")
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.color.rgb = RGBColor(255, 255, 255)

    for r_idx, row_data in enumerate(rows):
        for c_idx, val in enumerate(row_data):
            cell = table.rows[r_idx + 1].cells[c_idx]
            cell.text = str(val)
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9)
            if r_idx % 2 == 1:
                set_cell_shading(cell, "D9E2F3")

    return table


def style_doc(doc):
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)
    style.paragraph_format.space_after = Pt(4)

    for level in range(1, 4):
        h = doc.styles[f"Heading {level}"]
        h.font.color.rgb = RGBColor(0x2B, 0x57, 0x9A)


def add_title_page(doc, title, subtitle):
    for _ in range(6):
        doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(title)
    run.bold = True
    run.font.size = Pt(28)
    run.font.color.rgb = RGBColor(0x2B, 0x57, 0x9A)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(subtitle)
    run.font.size = Pt(14)
    run.font.color.rgb = RGBColor(0x59, 0x56, 0x59)

    for _ in range(4):
        doc.add_paragraph()
    for text in ["Group Name: [Your Group Name]", "Members: [Names]", "Date: [Presentation Date]"]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(text)
        run.font.size = Pt(12)

    doc.add_page_break()


def build_system_doc():
    doc = Document()
    style_doc(doc)

    add_title_page(doc, "Distributed Chat System", "System Documentation\nWeb Services and Cloud Computing — Final Project")

    # 1. Executive Summary
    doc.add_heading("1. Executive Summary", level=1)
    doc.add_paragraph(
        "This project implements a distributed real-time chat application built entirely from low-level "
        "primitives without web frameworks. The system supports real-time text messaging, peer-to-peer "
        "video/audio calling, group and private chat rooms, a friendship system, QR-code room invitations, "
        "and offline message delivery. It is designed to scale horizontally across multiple server instances "
        "using Redis Pub/Sub for cross-instance communication and Nginx for load balancing."
    )
    doc.add_paragraph(
        "Key design decision: Instead of relying on high-level frameworks (Express.js, Socket.io, Prisma ORM, "
        "Simple-Peer), the system uses raw Node.js HTTP, the ws WebSocket library, raw SQL with pg, and the "
        "native browser RTCPeerConnection API. This demonstrates a deep understanding of the underlying "
        "protocols and distributed system principles."
    )

    # 2. System Overview
    doc.add_heading("2. System Overview", level=1)
    doc.add_heading("2.1 Problem Statement", level=2)
    doc.add_paragraph(
        "Modern chat applications must handle millions of concurrent users exchanging messages in real time. "
        "A single server cannot sustain this load. The system must:"
    )
    for item in [
        "Deliver messages in real time with low latency.",
        "Scale horizontally by adding more servers without downtime.",
        "Guarantee message delivery even when recipients are offline.",
        "Support both text-based and audio/video communication.",
        "Maintain consistency across multiple server instances.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("2.2 Feature Summary", level=2)
    add_table(doc, ["Feature", "Protocol / Mechanism"], [
        ["User authentication", "REST API + JWT tokens"],
        ["Real-time text messaging", "WebSocket (ws library)"],
        ["Video/audio calling", "WebRTC (native RTCPeerConnection)"],
        ["Group chat rooms", "Room-based WebSocket broadcasting"],
        ["Private DMs", "1-on-1 room auto-creation between friends"],
        ["Friendship system", "REST API + real-time notifications"],
        ["QR code room invites", "Redis-backed invite tokens (15-min TTL)"],
        ["Offline message delivery", "Redis queue + delivery on reconnect"],
        ["Cross-instance sync", "Redis Pub/Sub"],
        ["Load balancing", "Nginx with IP-hash sticky sessions"],
        ["Containerized deployment", "Docker Compose (5 services)"],
    ])

    # 3. Architecture Design
    doc.add_heading("3. Architecture Design", level=1)
    doc.add_heading("3.1 Three-Layer Architecture", level=2)
    doc.add_paragraph("The system follows a classic three-layer distributed architecture:")
    p = doc.add_paragraph()
    p.add_run("Presentation Layer: ").bold = True
    p.add_run("React SPA (built with Vite), native browser WebSocket API, native RTCPeerConnection.")
    p = doc.add_paragraph()
    p.add_run("Business Layer: ").bold = True
    p.add_run("Node.js HTTP Server (multiple instances), custom Router, JWT authentication middleware, REST API endpoints, service layer, custom WebSocket server, Redis Pub/Sub adapter.")
    p = doc.add_paragraph()
    p.add_run("Persistence Layer: ").bold = True
    p.add_run("PostgreSQL 16 (users, rooms, room_members, messages, friendships). Redis 7 (Pub/Sub channels, offline message queues, invite token store).")

    doc.add_paragraph("[Insert Three-Layer Architecture Diagram]").italic = True

    doc.add_heading("3.2 Distributed System Components", level=2)
    add_table(doc, ["Component", "Role", "Distributed Principle"], [
        ["Nginx", "Reverse proxy + load balancer", "Horizontal scaling, sticky sessions"],
        ["Node.js Server ×2", "Application logic, WebSocket handling", "Stateless replicas"],
        ["Redis", "Pub/Sub, caching, offline queues", "Message broker, shared state"],
        ["PostgreSQL", "Persistent storage", "Single source of truth"],
        ["Browser (WebRTC)", "Peer-to-peer media", "Decentralized communication"],
    ])

    doc.add_heading("3.3 Comparison with the Original System", level=2)
    doc.add_paragraph(
        'Our project is a redesign of the distributed chat application described in "Chat Application with '
        "Distributed System\" by Shuyang Zhu (Harrisburg University, Spring 2020, GRAD 699, supervised by "
        "Dr. Abrar Qureshi). The original system was built with Java 8, deployed on Apache Tomcat, with "
        "Angular and NgRx for the frontend, MySQL for persistent storage, and Redis as an in-memory database. "
        "The server code was organized into two modules (ms-account-management and ms-chat-application), "
        "deployed together as a single application on one Tomcat instance."
    )

    doc.add_heading("3.3.1 Original System Software Specification", level=3)
    add_table(doc, ["Component", "Original System"], [
        ["Operating System", "Windows 10"],
        ["Programming Language", "Java 8 (NIO, lambda, function flow)"],
        ["IDE", "IntelliJ"],
        ["Frontend Technology", "Angular (TypeScript) with NgRx state management"],
        ["Database", "MySQL + Redis"],
        ["Application Server", "Apache Tomcat"],
        ["Server Structure", "Multi-module (ms-account-management, ms-chat-application), single deployment"],
        ["Deployment", "Local (planned AWS migration)"],
    ])

    doc.add_paragraph(
        "The original server was organized into two Java modules (each with its own pom.xml), "
        "deployed together on a single Apache Tomcat instance:"
    )
    doc.add_paragraph(
        "ms-account-management — Controller.java, MsAccountManagementApplication.java, AccountService.java, "
        "repository classes (UserRepository.java, UserDbRepository.java), models (User.java, FriendShip.java).",
        style="List Bullet",
    )
    doc.add_paragraph(
        "ms-chat-application — MsChatApplicationMain.java, ChatController.java, WebSocketEventListener.java, "
        "WebSocketConfig.java, model (ChatMessage.java).",
        style="List Bullet",
    )
    doc.add_paragraph("The original database had 4 tables:")
    add_table(doc, ["Table", "Columns"], [
        ["User", "user_id, user_name, user_password (encrypted)"],
        ["User_activity", "user_id, last_active_time"],
        ["Conversation", "sender, receiver, timestamp, send_timestamp"],
        ["Friendship", "user_1, user_2"],
    ])

    doc.add_heading("3.3.2 Technology Stack Comparison", level=3)
    add_table(doc, ["Layer", "Original System", "Our Redesign", "Rationale"], [
        ["Language", "Java 8 (NIO, lambda)", "JavaScript (Node.js 20)", "Single language across stack; event-driven I/O fits WebSocket workloads"],
        ["Server", "Java 8 + Apache Tomcat", "Raw Node.js http.createServer + custom Router", "Eliminates framework overhead; demonstrates HTTP internals"],
        ["Architecture", "Multi-module monolith (single Tomcat)", "Single Node.js server (horizontally scaled via Docker)", "Horizontal scaling via identical instances behind Nginx"],
        ["Real-time", "Java WebSocket API", "ws library + custom room/presence management", "Low-level control over WebSocket upgrade, frames, broadcasting"],
        ["Video/Audio", "WebRTC", "WebRTC (native RTCPeerConnection + STUN/TURN)", "Direct SDP/ICE implementation without abstraction libraries"],
        ["Database", "MySQL", "PostgreSQL 16 with raw SQL", "Advisory locks, native UUIDs, enum types; raw SQL for full control"],
        ["Data Access", "Repository pattern", "Parameterized raw SQL queries", "Direct SQL control; no ORM abstraction"],
        ["Cache/Broker", "Redis (in-memory DB)", "Redis 7 (Pub/Sub + offline queues + invites)", "Expanded from caching to cross-instance Pub/Sub and queuing"],
        ["Frontend", "Angular + NgRx", "React 19 + Context API", "Lighter-weight; Context API vs. full Redux pattern"],
        ["Load Balancing", "Not implemented", "Nginx with ip_hash sticky sessions", "Explicit horizontal scaling and WebSocket affinity"],
        ["Containerization", "Not implemented (local)", "Docker Compose (5 services)", "Reproducible deployment with a single command"],
        ["Authentication", "Username/password in MySQL", "JWT (stateless) + bcrypt", "Stateless tokens enable scaling without shared sessions"],
    ])

    doc.add_heading("3.3.3 Architectural Principles Retained", level=3)
    principles = [
        ("Three-Layer Architecture", "Presentation (React SPA), Business (Node.js + WebSocket + services), Persistence (Redis + PostgreSQL)."),
        ("REST API", "For account management and user operations."),
        ("WebSocket", "For real-time bidirectional text messaging."),
        ("WebRTC", "For peer-to-peer video/audio communication with server-side signaling."),
        ("Redis", "For in-memory data storage and caching."),
        ("Friendship System", "Both systems have a friendship model with request/accept workflow."),
        ("Offline Message Delivery", 'Both require delivering messages to offline users upon reconnection.'),
    ]
    for title, desc in principles:
        p = doc.add_paragraph(style="List Number")
        p.add_run(f"{title}: ").bold = True
        p.add_run(desc)

    doc.add_heading("3.3.4 Improvements Over the Original Design", level=3)
    add_table(doc, ["Improvement", "Original Status", "Our Implementation"], [
        ["Cross-instance messaging", "Single server instance", "Redis Pub/Sub across multiple instances with deduplication"],
        ["Horizontal scaling", "Planned for AWS, not implemented", "Nginx + 2 Docker server instances, extendable to N"],
        ["Client-side caching", 'Marked as "to be implemented"', "Server-side Redis caching; cursor-based pagination"],
        ["QR code room invites", "Not present", "Time-limited Redis invite codes (15-min TTL), QR shareable"],
        ["Private DM rooms", "Not present", "Auto-created private rooms with get-or-create pattern"],
        ["Multi-device presence", "Not present", "Presence tracked per-socket per-user"],
        ["Advisory-locked migrations", "Not present", "PostgreSQL advisory locks for concurrent startup safety"],
        ["TURN server fallback", "Not present", "STUN + TURN for calls across restrictive networks"],
        ["Group chat rooms", "1-on-1 only", "Full room system with PRIVATE and GROUP types"],
        ["Containerized deployment", "Local only", "Docker Compose orchestrates all 5 services"],
        ["No-framework backend", "Java 8 + Apache Tomcat", "Raw Node.js HTTP with custom 128-line router"],
    ])

    # 4. Technologies
    doc.add_heading("4. Technologies, Protocols, and Services", level=1)
    doc.add_heading("4.1 Backend Stack", level=2)
    add_table(doc, ["Technology", "Version", "Purpose"], [
        ["Node.js", "20 (Alpine)", "Server runtime"],
        ["ws", "8.18", "Raw WebSocket server"],
        ["pg", "8.13", "PostgreSQL driver (raw SQL)"],
        ["redis", "5.10", "Redis client (Pub/Sub + KV)"],
        ["jsonwebtoken", "9.0", "JWT authentication"],
        ["bcrypt", "6.0", "Password hashing"],
        ["uuid", "11.1", "Unique ID generation"],
    ])

    doc.add_heading("4.2 Frontend Stack", level=2)
    add_table(doc, ["Technology", "Version", "Purpose"], [
        ["React", "19.2", "UI framework"],
        ["React Router", "7.13", "Client-side routing"],
        ["Vite", "7.2", "Build tool + dev server"],
        ["qrcode.react", "4.2", "QR code generation"],
        ["Native WebSocket API", "—", "Real-time server communication"],
        ["Native RTCPeerConnection", "—", "Peer-to-peer video/audio"],
    ])

    doc.add_heading("4.3 Infrastructure", level=2)
    add_table(doc, ["Technology", "Purpose"], [
        ["Docker + Docker Compose", "Containerized deployment"],
        ["Nginx", "Reverse proxy, load balancer"],
        ["PostgreSQL 16", "Relational database"],
        ["Redis 7", "In-memory data store, message broker"],
    ])

    doc.add_heading("4.4 Protocols Used", level=2)
    add_table(doc, ["Protocol", "Where Used"], [
        ["HTTP/1.1", "REST API communication"],
        ["WebSocket (RFC 6455)", "Real-time bidirectional messaging"],
        ["WebRTC", "Peer-to-peer audio/video"],
        ["SDP (Session Description Protocol)", "WebRTC offer/answer exchange"],
        ["ICE (Interactive Connectivity Establishment)", "WebRTC NAT traversal"],
        ["STUN", "Public IP discovery for WebRTC"],
        ["TURN", "Relay fallback when direct P2P is blocked"],
        ["TCP", "PostgreSQL and Redis connections"],
        ["JWT (RFC 7519)", "Stateless authentication tokens"],
    ])

    # 5. Database
    doc.add_heading("5. Database Design", level=1)
    doc.add_heading("5.1 Tables", level=2)

    tables_info = [
        ("users", [["id", "UUID, Primary Key"], ["username", "VARCHAR, Unique"], ["email", "VARCHAR, Unique"], ["password_hash", "VARCHAR"], ["avatar_url", "VARCHAR, Nullable"], ["created_at", "TIMESTAMP"], ["updated_at", "TIMESTAMP"]]),
        ("rooms", [["id", "UUID, Primary Key"], ["name", "VARCHAR"], ["type", "ENUM (PRIVATE, GROUP)"], ["created_by_id", "UUID, FK → users"], ["created_at", "TIMESTAMP"], ["updated_at", "TIMESTAMP"]]),
        ("room_members", [["id", "UUID, Primary Key"], ["user_id", "UUID, FK → users"], ["room_id", "UUID, FK → rooms"], ["joined_at", "TIMESTAMP"]]),
        ("messages", [["id", "UUID, Primary Key"], ["content", "TEXT"], ["type", "ENUM (TEXT, IMAGE, FILE)"], ["sender_id", "UUID, FK → users"], ["room_id", "UUID, FK → rooms"], ["created_at", "TIMESTAMP"]]),
        ("friendships", [["id", "UUID, Primary Key"], ["requester_id", "UUID, FK → users"], ["addressee_id", "UUID, FK → users"], ["status", "ENUM (PENDING, ACCEPTED, REJECTED)"], ["created_at", "TIMESTAMP"], ["updated_at", "TIMESTAMP"]]),
    ]
    for tname, cols in tables_info:
        doc.add_paragraph(f"Table: {tname}", style="List Bullet").runs[0].bold = True
        add_table(doc, ["Column", "Type / Constraint"], cols)
        doc.add_paragraph()

    doc.add_paragraph("[Insert Entity-Relationship Diagram]").italic = True

    doc.add_heading("5.2 Custom Migration System", level=2)
    doc.add_paragraph("Instead of using an ORM migration tool, we built a custom migration runner (src/db/migrate.js) that:")
    for item in [
        "Creates a _migrations tracking table.",
        "Reads .sql files from src/db/migrations/ in order.",
        "Executes unapplied migrations inside transactions.",
        "Uses PostgreSQL advisory locks (pg_advisory_lock) to prevent race conditions when multiple server instances start simultaneously.",
        "Handles idempotent re-runs gracefully.",
    ]:
        doc.add_paragraph(item, style="List Number")

    # 6. API Design
    doc.add_heading("6. API Design", level=1)
    doc.add_heading("6.1 REST API Endpoints", level=2)
    doc.add_paragraph("All protected endpoints require an Authorization: Bearer <JWT> header.")

    doc.add_paragraph("Authentication", style="List Bullet").runs[0].bold = True
    add_table(doc, ["Method", "Endpoint", "Auth", "Description"], [
        ["POST", "/api/auth/register", "No", "Create account"],
        ["POST", "/api/auth/login", "No", "Login, returns JWT"],
        ["GET", "/api/auth/me", "Yes", "Get current user profile"],
    ])

    doc.add_paragraph()
    doc.add_paragraph("Users", style="List Bullet").runs[0].bold = True
    add_table(doc, ["Method", "Endpoint", "Auth", "Description"], [
        ["GET", "/api/users?search=<term>", "Yes", "Search users (min 2 chars)"],
        ["GET", "/api/users/:id", "Yes", "Get user by ID"],
    ])

    doc.add_paragraph()
    doc.add_paragraph("Rooms", style="List Bullet").runs[0].bold = True
    add_table(doc, ["Method", "Endpoint", "Auth", "Description"], [
        ["POST", "/api/rooms", "Yes", "Create room"],
        ["GET", "/api/rooms", "Yes", "List user's rooms"],
        ["POST", "/api/rooms/dm", "Yes", "Get or create DM with a friend"],
        ["GET", "/api/rooms/:id", "Yes", "Room details with members"],
        ["POST", "/api/rooms/:id/members", "Yes", "Add member to room"],
        ["POST", "/api/rooms/:id/invite", "Yes", "Generate QR invite code"],
        ["POST", "/api/rooms/join/:code", "Yes", "Redeem invite code"],
        ["GET", "/api/rooms/:id/messages", "Yes", "Paginated messages (cursor-based)"],
    ])

    doc.add_paragraph()
    doc.add_paragraph("Friends", style="List Bullet").runs[0].bold = True
    add_table(doc, ["Method", "Endpoint", "Auth", "Description"], [
        ["POST", "/api/friends/request", "Yes", "Send friend request"],
        ["POST", "/api/friends/accept/:id", "Yes", "Accept friend request"],
        ["POST", "/api/friends/reject/:id", "Yes", "Reject friend request"],
        ["GET", "/api/friends", "Yes", "List friends"],
        ["GET", "/api/friends/pending", "Yes", "Pending incoming requests"],
    ])

    doc.add_heading("6.2 WebSocket Protocol", level=2)
    doc.add_paragraph("Connection URL: ws://<host>/ws?token=<JWT>")
    doc.add_paragraph('All messages use JSON format: { "event": "<name>", "data": { ... } }')

    doc.add_paragraph("Client → Server Events", style="List Bullet").runs[0].bold = True
    add_table(doc, ["Event", "Data", "Description"], [
        ["join_room", "{ roomId }", "Join a chat room"],
        ["leave_room", "{ roomId }", "Leave a chat room"],
        ["typing", "{ roomId, isTyping }", "Typing indicator"],
        ["send_message", "{ roomId, content, type }", "Send a message"],
        ["call_user", "{ to, offer }", "Initiate WebRTC call"],
        ["answer_call", "{ to, answer }", "Answer WebRTC call"],
        ["ice_candidate", "{ to, candidate }", "Send ICE candidate"],
        ["end_call", "{ to }", "End call"],
    ])

    doc.add_paragraph()
    doc.add_paragraph("Server → Client Events", style="List Bullet").runs[0].bold = True
    add_table(doc, ["Event", "Data", "Description"], [
        ["new_message", "{ id, content, sender }", "New message in room"],
        ["offline_message", "{ id, content, sender }", "Queued offline message"],
        ["user_online", "{ userId }", "User came online"],
        ["user_offline", "{ userId }", "User went offline"],
        ["typing", "{ userId, username }", "Someone is typing"],
        ["incoming_call", "{ from, username, offer }", "Incoming call"],
        ["call_accepted", "{ from, answer }", "Call was accepted"],
        ["ice_candidate", "{ from, candidate }", "ICE candidate received"],
        ["call_ended", "{ from }", "Call ended"],
    ])

    # 7. Real-Time Communication
    doc.add_heading("7. Real-Time Communication", level=1)
    doc.add_heading("7.1 WebSocket Architecture", level=2)
    doc.add_paragraph("The custom WebSocket server (lib/ws.js) implements:")
    for item in [
        "JWT authentication during HTTP upgrade handshake: the token is passed as a query parameter and verified before the WebSocket connection is established.",
        "Room-based broadcasting: each chat room maps to a Set of WebSocket connections for efficient message delivery.",
        "Multi-device tracking: a single user can be connected from multiple devices. A Map of userId to Set of WebSocket connections tracks all sessions.",
        "Online presence: user_online and user_offline events are broadcast when a user's first socket connects or last socket disconnects.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("7.2 Cross-Instance Message Flow", level=2)
    doc.add_paragraph("When messages must reach clients connected to different server instances:")
    for item in [
        "User A sends a message via WebSocket to Server 1.",
        "Server 1 persists the message to PostgreSQL.",
        "Server 1 broadcasts the message to all WebSocket clients in the room on Server 1.",
        'Server 1 publishes the message to the Redis channel "room:<roomId>" with its instance ID.',
        "Server 2 receives the published message via its Redis subscription.",
        "Server 2 checks the instance ID and ignores messages from itself.",
        "Server 2 broadcasts the message to all WebSocket clients in the room on Server 2.",
    ]:
        doc.add_paragraph(item, style="List Number")

    doc.add_paragraph(
        "Instance deduplication: Each server instance has a unique INSTANCE_ID generated via "
        "crypto.randomUUID(). When publishing to Redis, the instanceId is included in the payload. "
        "When receiving from Redis, messages from the same instance are ignored to prevent duplicate delivery."
    )
    doc.add_paragraph("[Insert Cross-Instance Message Flow Diagram]").italic = True

    doc.add_heading("7.3 Offline Message Delivery", level=2)
    for item in [
        "When a message is sent, the server checks which room members are offline (not present in any server's userSockets map).",
        "For each offline member, the message ID is pushed to a Redis list: pending:<userId>.",
        "When the user reconnects, the server retrieves all pending message IDs from Redis, fetches full message objects from PostgreSQL, delivers them as offline_message events, and clears the Redis queue.",
    ]:
        doc.add_paragraph(item, style="List Number")

    doc.add_heading("7.4 WebRTC Video/Audio", level=2)
    doc.add_paragraph("WebRTC enables peer-to-peer communication directly between browsers. The server only handles signaling:")
    for item in [
        "User A creates an RTCPeerConnection and generates an SDP offer.",
        "The offer is sent via WebSocket (call_user event) and relayed to User B.",
        "User B receives the incoming_call event, creates an SDP answer, and sends it back via answer_call.",
        "Both peers exchange ICE candidates via WebSocket for NAT traversal.",
        "A direct peer-to-peer media stream is established between the browsers.",
    ]:
        doc.add_paragraph(item, style="List Number")
    doc.add_paragraph(
        "STUN servers (Google and Twilio) discover each peer's public IP. "
        "TURN servers (Metered Open Relay) relay media when direct connections are blocked by restrictive NATs or firewalls."
    )

    # 8. Security
    doc.add_heading("8. Security", level=1)
    doc.add_heading("8.1 Authentication Flow", level=2)
    for item in [
        "Registration: Password hashed with bcrypt (10 salt rounds), stored in PostgreSQL.",
        "Login: Password verified with bcrypt.compare(), JWT issued containing userId with 7-day expiry.",
        "REST API: JWT validated via authMiddleware on every protected route.",
        "WebSocket: JWT validated during the HTTP-to-WebSocket upgrade handshake before connection is established.",
    ]:
        doc.add_paragraph(item, style="List Number")

    doc.add_heading("8.2 Security Measures", level=2)
    add_table(doc, ["Measure", "Implementation"], [
        ["Password hashing", "bcrypt with salt"],
        ["Stateless authentication", "JWT (no server-side sessions)"],
        ["CORS", "Custom middleware with origin whitelist"],
        ["SQL injection prevention", "Parameterized queries ($1, $2)"],
        ["Room access control", "Membership check before message send"],
        ["Invite expiry", "Redis TTL (15 minutes)"],
        ["Input validation", "Content length checks, type validation"],
    ])

    # 9. Deployment
    doc.add_heading("9. Deployment Architecture", level=1)
    doc.add_heading("9.1 Docker Compose Services", level=2)
    doc.add_paragraph("The entire application runs in 5 Docker containers orchestrated by Docker Compose:")
    add_table(doc, ["Service", "Technology", "Port Mapping", "Notes"], [
        ["Nginx", "Nginx", "Host 3000 → Container 80", "Reverse proxy, load balancer"],
        ["Server 1", "Node.js 20", "Internal 3000", "Application instance"],
        ["Server 2", "Node.js 20", "Internal 3000", "Application instance"],
        ["PostgreSQL", "PostgreSQL 16", "Host 5433 → Container 5432", "Volume: postgres_data"],
        ["Redis", "Redis 7", "Internal 6379", "Health check: redis-cli ping"],
    ])
    doc.add_paragraph("[Insert Docker Deployment Diagram]").italic = True

    doc.add_heading("9.2 Load Balancing Strategy", level=2)
    doc.add_paragraph("Nginx uses the ip_hash upstream directive:")
    for item in [
        "Client IP is hashed to determine which backend server handles the request.",
        "The same client always reaches the same server (sticky sessions).",
        "Critical for WebSocket connections which must persist on a single server.",
        "WebSocket Upgrade headers are forwarded through the proxy.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("9.3 Health Checks and Resilience", level=2)
    for item in [
        "Redis health check: redis-cli ping every 5 seconds; servers wait for Redis to be healthy.",
        "Redis retry logic: Server attempts to connect up to 10 times with 2-second delays.",
        "Migration locking: PostgreSQL advisory locks prevent race conditions when both servers run migrations simultaneously.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    # 10. Distributed Concepts
    doc.add_heading("10. Distributed System Concepts Applied", level=1)
    concepts = [
        ("Horizontal Scaling", "The application scales by adding more Node.js instances behind Nginx. Each instance is stateless — all shared state lives in Redis (transient) and PostgreSQL (persistent)."),
        ("Publish/Subscribe Pattern", 'Redis Pub/Sub decouples message producers from consumers. Server 1 publishes to channel "room:<id>". Server 2 subscribes and delivers to its local clients.'),
        ("Sticky Sessions", "WebSocket connections are stateful (long-lived TCP). Nginx ip_hash ensures the same client always reaches the same server."),
        ("Eventual Consistency", "Messages are persisted to PostgreSQL (source of truth) and broadcast via Redis (real-time). Offline messages are queued and delivered on reconnect."),
        ("Peer-to-Peer Communication", "Audio/video traffic flows directly between browsers via WebRTC, reducing server load. The server only handles signaling."),
        ("Shared-Nothing Architecture", "Each server instance maintains only its own in-memory WebSocket connections. No shared memory or filesystem. All cross-instance coordination goes through Redis."),
        ("Idempotent Operations", "The migration system, invite redemption, and DM creation (get-or-create pattern) are designed to be safe for retry."),
    ]
    for title, desc in concepts:
        p = doc.add_paragraph()
        p.add_run(f"{title}: ").bold = True
        p.add_run(desc)

    # 11. System Workflow
    doc.add_heading("11. System Workflow", level=1)
    workflows = [
        ("11.1 User Registration and Login", [
            "Client sends POST /api/auth/register with username, email, and password.",
            "Server hashes password with bcrypt and inserts into the users table.",
            "Server returns a JWT token.",
            "Client stores the token and includes it in all subsequent requests.",
        ]),
        ("11.2 Joining a Chat Room", [
            "Client navigates to /chat/:roomId.",
            "Client fetches room data via GET /api/rooms/:id.",
            "Client opens a WebSocket connection: ws://host/ws?token=<JWT>.",
            'Client sends { event: "join_room", data: { roomId } }.',
            "Server adds the socket to the room's Set and subscribes to the Redis room:<roomId> channel.",
            "Client fetches message history via GET /api/rooms/:id/messages.",
        ]),
        ("11.3 Sending a Message", [
            'Client sends { event: "send_message", data: { roomId, content } } over WebSocket.',
            "Server validates membership and persists the message to PostgreSQL.",
            "Server broadcasts new_message to all local room sockets.",
            "Server publishes to Redis room:<roomId> for other instances.",
            "Server checks which room members are offline and queues message IDs in Redis.",
        ]),
        ("11.4 QR Code Room Invite", [
            "Member clicks QR Invite → POST /api/rooms/:id/invite.",
            "Server generates a random 8-character hex code, stores in Redis with 15-minute TTL.",
            "Client displays a QR code encoding the invite URL.",
            "Recipient scans the QR code and navigates to /join/:code.",
            "Client calls POST /api/rooms/join/:code.",
            "Server verifies the code in Redis and adds the user as a room member.",
        ]),
        ("11.5 Video Call", [
            "User A clicks Video Call. Browser creates an RTCPeerConnection and generates an SDP offer.",
            "The offer is sent via WebSocket call_user event and relayed to User B.",
            "User B receives incoming_call, creates an answer SDP, and sends it via answer_call.",
            "Both peers exchange ICE candidates via WebSocket.",
            "A direct peer-to-peer media stream is established between the browsers.",
        ]),
    ]
    for heading, steps in workflows:
        doc.add_heading(heading, level=2)
        for step in steps:
            doc.add_paragraph(step, style="List Number")

    # 12. Frontend Architecture
    doc.add_heading("12. Frontend Architecture", level=1)
    doc.add_heading("12.1 Component Structure", level=2)
    add_table(doc, ["Component", "Parent", "Purpose"], [
        ["App.jsx", "—", "Router"],
        ["Login.jsx", "App", "Login page"],
        ["Register.jsx", "App", "Registration page"],
        ["RoomList.jsx", "App", "Home page / room list"],
        ["FriendsList.jsx", "RoomList", "Friends sidebar"],
        ["FriendRequests.jsx", "RoomList", "Pending requests"],
        ["ChatRoom.jsx", "App", "Chat room view"],
        ["InviteModal.jsx", "ChatRoom", "QR invite modal"],
        ["CallModal.jsx", "ChatRoom", "Video/audio call modal"],
        ["Avatar.jsx", "ChatRoom", "User avatar"],
        ["JoinRoom.jsx", "App", "Invite redemption page"],
    ])

    doc.add_heading("12.2 State Management", level=2)
    for item in [
        "AuthContext — Global authentication state (user, token, login, logout).",
        "SocketContext — WebSocket connection state, reconnection logic, event dispatching.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("12.3 Responsive Design", level=2)
    add_table(doc, ["Breakpoint", "Layout"], [
        ["Desktop (> 1024px)", "Full sidebar with friends panel"],
        ["Tablet (768–1024px)", "Condensed layout, icon-only header buttons"],
        ["Mobile (< 768px)", "Bottom drawer for friends, touch-optimized targets"],
        ["Small phone (< 480px)", "Further simplified layout"],
        ["iOS safe areas", "Viewport-fit cover with env(safe-area-inset) padding"],
    ])

    # 13. How to Run
    doc.add_heading("13. How to Run", level=1)
    doc.add_heading("Prerequisites", level=2)
    for item in ["Docker and Docker Compose installed.", "Node.js 20 or later (for local frontend development)."]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("Start Backend (Docker)", level=2)
    doc.add_paragraph("Run: docker compose up --build")
    doc.add_paragraph("This starts PostgreSQL, Redis, two Node.js servers, and Nginx. The backend is available at http://localhost:3000.")

    doc.add_heading("Start Frontend (Development)", level=2)
    doc.add_paragraph("Run: cd client → npm install → npm run dev")
    doc.add_paragraph("The Vite dev server runs at https://localhost:5173 and proxies API/WebSocket requests to http://localhost:3000.")

    # 14. File Structure
    doc.add_heading("14. File Structure Reference", level=1)
    add_table(doc, ["Path", "Description"], [
        ["client/", "Frontend (React + Vite)"],
        ["client/src/context/", "Auth and Socket contexts"],
        ["client/src/pages/", "Route-level components"],
        ["client/src/components/", "Reusable UI components"],
        ["client/src/services/api.js", "HTTP API client"],
        ["src/", "Backend (Node.js)"],
        ["src/server.js", "HTTP server entry point"],
        ["src/lib/router.js", "Custom HTTP router"],
        ["src/lib/ws.js", "Custom WebSocket server"],
        ["src/lib/redisPubSub.js", "Redis Pub/Sub layer"],
        ["src/lib/db.js", "PostgreSQL connection pool"],
        ["src/middleware/auth.js", "JWT authentication"],
        ["src/routes/", "REST API route handlers"],
        ["src/services/", "Business logic layer"],
        ["src/sockets/index.js", "WebSocket event handlers"],
        ["src/db/migrate.js", "Custom migration runner"],
        ["src/db/migrations/", "SQL migration files"],
        ["nginx/nginx.conf", "Nginx load balancer config"],
        ["docker-compose.yml", "Container orchestration"],
        ["Dockerfile", "Node.js container build"],
    ])

    doc.save("docs/System_Documentation.docx")
    print("Created: docs/System_Documentation.docx")


def build_presentation_doc():
    doc = Document()
    style_doc(doc)

    add_title_page(doc, "Distributed Chat System", "Presentation Outline\nWeb Services and Cloud Computing — Final Project")

    doc.add_heading("Presentation Outline", level=1)
    doc.add_paragraph("8 slides for 8-minute presentation, then 5-minute demo, then Q&A.")

    # Slide 1
    doc.add_heading("Slide 1 — Title (15 sec)", level=2)
    doc.add_paragraph("Distributed Chat System")
    doc.add_paragraph("Web Services and Cloud Computing — Final Project")
    doc.add_paragraph("[Group Name], [Members], [Date]")

    # Slide 2
    doc.add_heading("Slide 2 — Overview and Original System (1.5 min)", level=2)
    p = doc.add_paragraph()
    p.add_run("What we built: ").bold = True
    p.add_run("A real-time distributed chat application supporting text messaging, video/audio calling, group chats, private DMs, friend requests, QR code room invitations, and offline message delivery — built without web frameworks.")
    p = doc.add_paragraph()
    p.add_run("Based on: ").bold = True
    p.add_run('"Chat Application with Distributed System" by Shuyang Zhu, Harrisburg University, 2020.')

    add_table(doc, ["Component", "Original (Zhu, 2020)", "Our Redesign"], [
        ["Language", "Java 8", "Node.js 20"],
        ["Server", "Apache Tomcat (single server)", "Raw Node.js HTTP ×2 + Nginx"],
        ["Real-time", "Java WebSocket API", "Raw ws library"],
        ["Database", "MySQL", "PostgreSQL (raw SQL)"],
        ["Cache", "Redis", "Redis (expanded: Pub/Sub + offline queues)"],
        ["Frontend", "Angular + NgRx", "React + Context API"],
        ["Video/Audio", "WebRTC", "WebRTC (native API + STUN/TURN)"],
        ["Deployment", "Local only", "Docker Compose (5 containers)"],
    ])
    doc.add_paragraph("Principles retained: 3-layer architecture, REST API, WebSocket, WebRTC, Redis, friendship system.")

    # Slide 3
    doc.add_heading("Slide 3 — System Architecture (1.5 min)", level=2)
    doc.add_paragraph("[Insert System Architecture Diagram]").italic = True
    for item in [
        "Nginx load balances across 2 Node.js servers using ip_hash sticky sessions.",
        "Redis Pub/Sub synchronizes messages across server instances.",
        "PostgreSQL stores all persistent data.",
        "WebRTC video/audio flows directly between browsers (peer-to-peer).",
        "Shared-Nothing Architecture: servers hold no shared state.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    # Slide 4
    doc.add_heading("Slide 4 — No-Framework Design (1 min)", level=2)
    add_table(doc, ["What frameworks do", "What we built instead"], [
        ["Express.js handles HTTP routing", "Custom 128-line Router with path params + middleware"],
        ["Socket.io manages WebSocket rooms", "Raw ws + custom room/presence/broadcast logic"],
        ["Prisma ORM generates SQL", "Raw parameterized SQL + custom migration runner"],
        ["Simple-Peer wraps WebRTC", "Native RTCPeerConnection + STUN/TURN"],
    ])
    p = doc.add_paragraph()
    p.add_run("Only 6 runtime dependencies: ").bold = True
    p.add_run("bcrypt, jsonwebtoken, pg, redis, uuid, ws.")

    # Slide 5
    doc.add_heading("Slide 5 — Cross-Instance Messaging (1.5 min)", level=2)
    doc.add_paragraph("How users on different servers see each other's messages:")
    for item in [
        "User A sends a message. Server 1 saves it to PostgreSQL.",
        "Server 1 broadcasts the message to its own local WebSocket clients.",
        "Server 1 publishes the message to a Redis channel (room:<id>).",
        "Server 2 receives the message via its Redis subscription and broadcasts to its local clients.",
        "For offline users, message IDs are queued in a Redis list and delivered when they reconnect.",
    ]:
        doc.add_paragraph(item, style="List Number")
    doc.add_paragraph("Each server instance has a unique ID. Messages from the same instance are ignored on Redis receipt to prevent duplicates.")

    # Slide 6
    doc.add_heading("Slide 6 — WebRTC and Key Features (1 min)", level=2)
    p = doc.add_paragraph()
    p.add_run("Video/Audio (WebRTC):").bold = True
    for item in [
        "Server handles signaling only (SDP offer/answer and ICE candidates).",
        "Media flows directly between browsers with near-zero server load.",
        "STUN for NAT traversal + TURN relay as fallback for restrictive firewalls.",
    ]:
        doc.add_paragraph(item, style="List Bullet")
    p = doc.add_paragraph()
    p.add_run("Other features:").bold = True
    for item in [
        "QR code room invites backed by Redis with 15-minute TTL.",
        "Friendship system with request, accept, reject, and automatic DM creation.",
        "5 database tables with cursor-based message pagination.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    # Slide 7
    doc.add_heading("Slide 7 — Deployment and Security (1 min)", level=2)
    p = doc.add_paragraph()
    p.add_run("Deployment:").bold = True
    for item in [
        '"docker compose up --build" starts all 5 services: PostgreSQL, Redis, Server 1, Server 2, Nginx.',
        "Redis health checks ensure servers do not start before Redis is ready.",
    ]:
        doc.add_paragraph(item, style="List Bullet")
    p = doc.add_paragraph()
    p.add_run("Security:").bold = True
    for item in [
        "bcrypt password hashing.",
        "JWT authentication for both REST API and WebSocket upgrade handshake.",
        "Parameterized SQL queries to prevent injection.",
        "Room membership checks before every message send.",
        "Invite codes auto-expire after 15 minutes.",
        "CORS middleware with origin whitelist.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    # Slide 8
    doc.add_heading("Slide 8 — Summary (30 sec)", level=2)
    for item in [
        "Horizontal scaling — multiple servers behind an Nginx load balancer.",
        "Real-time communication — WebSocket for chat, WebRTC for video/audio.",
        "Pub/Sub pattern — Redis enables cross-instance message delivery.",
        "Offline delivery — messages queued in Redis and delivered on reconnect.",
        "No frameworks — HTTP routing, WebSocket, SQL, and WebRTC built from scratch.",
        "Containerized — one command deploys the entire distributed system.",
    ]:
        doc.add_paragraph(item, style="List Number")

    # Demo Script
    doc.add_page_break()
    doc.add_heading("Demo Script (5 minutes)", level=1)
    demos = [
        ("Demo 1 — Register and Chat (1.5 min)", "Open two browser windows. Register User A and User B. Create a group room. Exchange messages in real time."),
        ("Demo 2 — QR Invite (1 min)", "User A generates a QR invite. Copy the link to User B's browser. User B joins the room. Both exchange messages."),
        ("Demo 3 — Friends and DM (1 min)", "User A adds User B as a friend. User B accepts. Click friend to open a DM. Exchange private messages."),
        ("Demo 4 — Video Call (1 min)", "User A starts a video call. User B accepts. Show both video feeds. End the call."),
        ("Demo 5 — Distributed Proof (30 sec)", "Show Docker with both servers running. Point out server logs showing Redis Pub/Sub cross-instance delivery."),
    ]
    for heading, desc in demos:
        p = doc.add_paragraph()
        p.add_run(heading).bold = True
        doc.add_paragraph(desc)

    # Q&A
    doc.add_heading("Q&A — Prepared Answers", level=1)
    add_table(doc, ["Question", "Answer"], [
        ["How does it compare to the original?", "Same principles (3-layer, REST, WebSocket, WebRTC, Redis) but we added horizontal scaling, cross-instance Pub/Sub, Docker deployment, and removed frameworks."],
        ["Why Node.js instead of Java?", "Event-driven I/O fits WebSocket workloads. Single language across the entire stack."],
        ["Why no frameworks?", "To demonstrate protocol-level understanding. Only 6 dependencies vs. dozens in a typical project."],
        ["Can it scale beyond 2 servers?", "Yes. Add entries to nginx.conf and docker-compose.yml. Redis Pub/Sub handles N instances."],
        ["What if a server crashes?", "Nginx routes to the surviving server. Redis preserves offline queues. PostgreSQL persists all data."],
        ["Why ip_hash?", "WebSocket connections are stateful. The same client must always reach the same server."],
    ])

    doc.save("docs/Presentation_Outline.docx")
    print("Created: docs/Presentation_Outline.docx")


if __name__ == "__main__":
    build_system_doc()
    build_presentation_doc()
    print("\nDone! Both .docx files are in the docs/ folder.")
