# Architecture Diagrams

Render these Mermaid diagrams at https://mermaid.live or in any Mermaid-compatible tool, then export as PNG/SVG for your PowerPoint slides.

---

## Diagram 1 — High-Level System Architecture

```mermaid
graph TB
    subgraph Clients["Client Layer (Browsers)"]
        C1["User A<br/>React SPA"]
        C2["User B<br/>React SPA"]
        C3["User C<br/>React SPA"]
    end

    subgraph LB["Load Balancer"]
        NGINX["Nginx<br/>ip_hash sticky sessions<br/>Port 3000"]
    end

    subgraph AppLayer["Application Layer"]
        S1["Server Instance 1<br/>Node.js + ws"]
        S2["Server Instance 2<br/>Node.js + ws"]
    end

    subgraph DataLayer["Data Layer"]
        PG[("PostgreSQL 16<br/>Persistent Storage")]
        RD[("Redis 7<br/>Pub/Sub + Cache")]
    end

    C1 -->|"HTTP / WebSocket"| NGINX
    C2 -->|"HTTP / WebSocket"| NGINX
    C3 -->|"HTTP / WebSocket"| NGINX

    NGINX -->|"Route by IP hash"| S1
    NGINX -->|"Route by IP hash"| S2

    S1 -->|"SQL queries"| PG
    S2 -->|"SQL queries"| PG

    S1 <-->|"Pub/Sub"| RD
    S2 <-->|"Pub/Sub"| RD

    C1 <-.->|"WebRTC P2P<br/>(direct, no server)"| C2

    style NGINX fill:#4a90d9,stroke:#2c5f8a,color:#fff
    style S1 fill:#50b86c,stroke:#2d7a42,color:#fff
    style S2 fill:#50b86c,stroke:#2d7a42,color:#fff
    style PG fill:#336791,stroke:#1a3a55,color:#fff
    style RD fill:#dc382d,stroke:#8c1a14,color:#fff
    style C1 fill:#61dafb,stroke:#21a1c9,color:#000
    style C2 fill:#61dafb,stroke:#21a1c9,color:#000
    style C3 fill:#61dafb,stroke:#21a1c9,color:#000
```

---

## Diagram 2 — Three-Layer Architecture

```mermaid
graph TB
    subgraph Presentation["Presentation Layer"]
        direction LR
        UI["React SPA<br/>(Vite Build)"]
        WS_CLIENT["Native WebSocket API"]
        RTC_CLIENT["RTCPeerConnection"]
    end

    subgraph Business["Business Layer"]
        direction LR
        HTTP["Custom HTTP Router<br/>(lib/router.js)"]
        WSS["Custom WebSocket Server<br/>(lib/ws.js)"]
        AUTH["JWT Auth Middleware"]
        SVC["Service Layer<br/>(authService, roomService,<br/>messageService, friendshipService,<br/>inviteService)"]
        PUBSUB["Redis Pub/Sub Adapter<br/>(lib/redisPubSub.js)"]
    end

    subgraph Persistence["Persistence Layer"]
        direction LR
        DB[("PostgreSQL<br/>users, rooms, messages,<br/>room_members, friendships")]
        CACHE[("Redis<br/>Pub/Sub channels,<br/>offline queues,<br/>invite tokens")]
    end

    UI --> HTTP
    WS_CLIENT --> WSS
    RTC_CLIENT -.->|"P2P"| RTC_CLIENT

    HTTP --> AUTH
    AUTH --> SVC
    WSS --> SVC
    SVC --> DB
    SVC --> PUBSUB
    PUBSUB <--> CACHE

    style Presentation fill:#e8f4fd,stroke:#4a90d9
    style Business fill:#e8f8e8,stroke:#50b86c
    style Persistence fill:#f0e8f8,stroke:#7b5ea7
```

---

## Diagram 3 — Cross-Instance Message Flow

```mermaid
sequenceDiagram
    participant A as User A (Browser)
    participant S1 as Server 1
    participant PG as PostgreSQL
    participant RD as Redis
    participant S2 as Server 2
    participant B as User B (Browser)

    A->>S1: WebSocket: send_message
    S1->>S1: Validate membership
    S1->>PG: INSERT INTO messages
    PG-->>S1: message object

    par Broadcast locally
        S1->>A: new_message (local)
    and Publish to Redis
        S1->>RD: PUBLISH room:123<br/>{event, data, instanceId}
    and Queue for offline users
        S1->>RD: RPUSH pending:userC<br/>(if User C offline)
    end

    RD->>S2: SUBSCRIBE room:123<br/>(receives published message)
    S2->>S2: Check instanceId ≠ own → deliver
    S2->>B: new_message (cross-instance)
```

---

## Diagram 4 — WebRTC Signaling Flow

```mermaid
sequenceDiagram
    participant A as User A (Caller)
    participant WS as WebSocket Server
    participant B as User B (Callee)

    A->>A: Create RTCPeerConnection
    A->>A: getUserMedia (camera/mic)
    A->>A: createOffer → SDP Offer

    A->>WS: call_user {to: B, offer: SDP}
    WS->>B: incoming_call {from: A, offer: SDP}

    B->>B: Create RTCPeerConnection
    B->>B: getUserMedia (camera/mic)
    B->>B: setRemoteDescription(offer)
    B->>B: createAnswer → SDP Answer

    B->>WS: answer_call {to: A, answer: SDP}
    WS->>A: call_accepted {from: B, answer: SDP}

    A->>A: setRemoteDescription(answer)

    loop ICE Candidate Exchange
        A->>WS: ice_candidate {to: B, candidate}
        WS->>B: ice_candidate {from: A, candidate}
        B->>WS: ice_candidate {to: A, candidate}
        WS->>A: ice_candidate {from: B, candidate}
    end

    Note over A,B: Direct P2P Media Stream Established<br/>(audio/video bypasses server)
```

---

## Diagram 5 — Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client (Browser)
    participant N as Nginx
    participant S as Node.js Server
    participant DB as PostgreSQL

    Note over C,DB: Registration
    C->>N: POST /api/auth/register<br/>{username, email, password}
    N->>S: Forward request
    S->>S: bcrypt.hash(password, 10)
    S->>DB: INSERT INTO users
    DB-->>S: user record
    S->>S: jwt.sign({userId}, secret)
    S-->>C: {token, user}

    Note over C,DB: Subsequent API Request
    C->>N: GET /api/rooms<br/>Authorization: Bearer <JWT>
    N->>S: Forward request
    S->>S: jwt.verify(token, secret)
    S->>DB: SELECT rooms
    S-->>C: [rooms]

    Note over C,DB: WebSocket Connection
    C->>N: GET /ws?token=<JWT><br/>Upgrade: websocket
    N->>S: Forward upgrade
    S->>S: jwt.verify(token, secret)
    S->>DB: SELECT user by id
    S-->>C: 101 Switching Protocols
    Note over C,S: WebSocket connection established
```

---

## Diagram 6 — Docker Deployment Diagram

```mermaid
graph TB
    subgraph DockerNetwork["Docker Compose Network"]
        subgraph nginx_container["nginx (Port 3000→80)"]
            NG["Nginx<br/>Reverse Proxy<br/>ip_hash Load Balancing"]
        end

        subgraph server1_container["server1"]
            S1["Node.js 20<br/>HTTP + WebSocket<br/>Port 3000 (internal)"]
        end

        subgraph server2_container["server2"]
            S2["Node.js 20<br/>HTTP + WebSocket<br/>Port 3000 (internal)"]
        end

        subgraph postgres_container["postgres (Port 5433→5432)"]
            PG[("PostgreSQL 16<br/>chat_db<br/>Volume: postgres_data")]
        end

        subgraph redis_container["redis (internal only)"]
            RD[("Redis 7<br/>Volume: redis_data<br/>Healthcheck: ping")]
        end
    end

    HOST["Host Machine<br/>localhost:3000"] --> NG

    NG --> S1
    NG --> S2

    S1 --> PG
    S2 --> PG
    S1 <--> RD
    S2 <--> RD

    S1 -.->|"depends_on"| RD
    S1 -.->|"depends_on"| PG
    S2 -.->|"depends_on"| RD
    S2 -.->|"depends_on"| PG

    style NG fill:#4a90d9,color:#fff
    style S1 fill:#50b86c,color:#fff
    style S2 fill:#50b86c,color:#fff
    style PG fill:#336791,color:#fff
    style RD fill:#dc382d,color:#fff
```

---

## Diagram 7 — Database Entity Relationship

```mermaid
erDiagram
    users {
        text id PK
        text username UK
        text email UK
        text password_hash
        text avatar_url
        timestamptz created_at
        timestamptz updated_at
    }

    rooms {
        text id PK
        text name
        RoomType type
        text created_by_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    room_members {
        text id PK
        text user_id FK
        text room_id FK
        timestamptz joined_at
    }

    messages {
        text id PK
        text content
        MessageType type
        text sender_id FK
        text room_id FK
        timestamptz created_at
    }

    friendships {
        text id PK
        text requester_id FK
        text addressee_id FK
        FriendshipStatus status
        timestamptz created_at
        timestamptz updated_at
    }

    users ||--o{ rooms : "created_by"
    users ||--o{ room_members : "member"
    rooms ||--o{ room_members : "has members"
    users ||--o{ messages : "sends"
    rooms ||--o{ messages : "contains"
    users ||--o{ friendships : "requester"
    users ||--o{ friendships : "addressee"
```

---

## Diagram 8 — Offline Message Delivery

```mermaid
sequenceDiagram
    participant A as User A (Online)
    participant S as Server
    participant RD as Redis
    participant PG as PostgreSQL
    participant B as User B (Offline)

    Note over B: User B is disconnected

    A->>S: send_message {roomId, content}
    S->>PG: INSERT message → returns msg.id
    S->>S: Check: isUserOnline(B) → false
    S->>RD: RPUSH pending:B [msg.id]

    Note over B: User B comes online later

    B->>S: WebSocket connect (JWT auth)
    S->>RD: LRANGE pending:B 0 -1
    RD-->>S: [msg.id, ...]
    S->>RD: DEL pending:B
    S->>PG: SELECT messages WHERE id IN (...)
    PG-->>S: [message objects]
    S->>B: offline_message (for each)

    Note over B: User B sees all missed messages
```

---

## Diagram 9 — QR Code Invite Flow

```mermaid
sequenceDiagram
    participant A as User A (Room Member)
    participant S as Server
    participant RD as Redis
    participant B as User B (Invitee)

    A->>S: POST /api/rooms/:id/invite
    S->>S: Verify A is room member
    S->>S: Generate random 8-char code
    S->>RD: SET invite:abc123 → roomId<br/>EX 900 (15 min TTL)
    S-->>A: {code: "abc123", url: "/join/abc123"}

    A->>A: Display QR code encoding URL

    Note over B: User B scans QR code

    B->>S: POST /api/rooms/join/abc123
    S->>RD: GET invite:abc123
    RD-->>S: roomId
    S->>S: Check if B already member
    S->>S: INSERT INTO room_members
    S-->>B: {roomId}
    B->>B: Navigate to /chat/:roomId
```

---

## Diagram 10 — Pulse (Burn-After-Reading) Lifecycle

```mermaid
sequenceDiagram
    participant A as User A (Sender)
    participant S1 as Server 1
    participant PG as PostgreSQL
    participant RD as Redis
    participant S2 as Server 2
    participant B as User B (Recipient)

    Note over A,B: 1. Secret message is born
    A->>S1: send_message {type: 'SECRET', content: 'Hello'}
    S1->>PG: INSERT message (type=SECRET)
    S1->>RD: PUBLISH room:123 {new_message}
    RD->>S2: Deliver signal
    S1->>A: new_message (blurred in UI)
    S2->>B: new_message (blurred in UI)

    Note over A,B: 2. Message revelation triggered
    B->>S2: reveal_secret {messageId}
    S2->>RD: PUBLISH room:123 {secret_revealed}
    RD->>S1: Deliver signal
    S1->>A: secret_revealed (start 10s UI timer)
    S2->>B: secret_revealed (start 10s UI timer)

    Note over S2: 3. Distributed destruction (after 10s)
    S2->>PG: DELETE FROM messages WHERE id = messageId
    S2->>RD: PUBLISH room:123 {message_burned}
    RD->>S1: Deliver signal
    S1->>A: message_burned (wipe from UI)
    S2->>B: message_burned (wipe from UI)
```

---

## How to Export Diagrams

1. Go to **https://mermaid.live**
2. Paste each Mermaid code block into the editor
3. Click **Actions → Export PNG** (or SVG)
4. Save with descriptive filenames (e.g., `system_architecture.png`)
5. Insert into your PowerPoint slides
