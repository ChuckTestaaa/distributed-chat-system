# Distributed System Compliance & Technical Report
**Project Title**: DistriChat: A Secure, Scalable Distributed Messaging & Pulse Communication System  
**Course/Requirement**: Web Services and Cloud Technologies  
**Date**: May 14, 2026  
**Architects**: Antigravity AI & ChuckTestaaa  

---

## Section 1: Overview of the Chosen Real-World Chat Application
DistriChat is a distributed messaging platform modeled after the **Discord Gateway Architecture** for real-time concurrency and the **Telegram Secret Chat** philosophy for ephemeral security. The system is designed to provide low-latency event streaming across a cluster of geographically dispersed server nodes.

**Justification for Redesign**: Traditional monolithic chat systems suffer from a **Single Point of Failure** and lack horizontal scalability. Our redesign implements a **Distributed Web Service** model, decoupling the connection layer from the storage layer to ensure the system can scale linearly by adding more server instances to the cluster.

---

## Section 2: Original System Architecture Analysis
The "Original System" baseline (based on research by Shuyang Zhu, 2020) follows a **Centralized Client-Server model**.
*   **Original Implementation**: A monolithic Java-based server utilizing standard TCP sockets and an in-memory Redis cache for data buffering.
*   **Limitations & Bottlenecks**: 
    *   **Vertical Scaling Constraints**: The architecture is bound by the hardware limits of a single machine (CPU/RAM), creating a hard ceiling for user concurrency.
    *   **State Isolation**: WebSocket/Socket states are stored in the server's local RAM. This prevents cross-instance communication; users on `Server A` are logically isolated from users on `Server B`.
    *   **Lack of Message Broker**: The original design lacks a distributed Pub/Sub mechanism, meaning there is no way to synchronize state or broadcast events across multiple server processes.

---

## Section 3: Deployment Requirements for Web Services
DistriChat is deployed using a production-grade **Cloud Infrastructure Strategy**:
*   **Compute (AWS EC2)**: Server nodes are containerized via **Docker** and hosted on AWS `t3.micro` instances. This environment supports the horizontal scaling of our Node.js cluster.
*   **Global Delivery (Vercel CDN)**: The React frontend is deployed on Vercel's Edge network, ensuring that static assets and the application bundle are served with sub-millisecond latency via a global CDN.
*   **Persistence (PostgreSQL)**: A centralized, high-availability PostgreSQL instance serves as the relational source of truth, ensuring **data integrity and reliability** for all user, room, and message data.
*   **Cross-Device Compatibility**: The system is fully responsive, leveraging modern CSS and React to support Desktop and Mobile (Android/iOS) environments.

---

## Section 4: Web Services, Cloud Technologies, and Protocols
Our system integrates several core cloud protocols to maintain a synchronized distributed state:
*   **WebSockets (WSS)**: The primary protocol for full-duplex, real-time event transmission between the client and the cluster.
*   **Redis Pub/Sub (Distributed Synchronization)**: Acts as the message broker for the cluster. It synchronizes events across all server instances, ensuring that a message received by one node is instantly broadcast to all other nodes.
*   **WebRTC (Peer-to-Peer Media)**: Enables direct, encrypted audio/video streams between clients. This offloads heavy media processing from the server, preserving bandwidth for real-time signaling.
*   **JWT (JSON Web Tokens)**: Provides **stateless, secure authentication**. This allows users to move between different server nodes without re-authenticating.
*   **Docker Orchestration**: We use Docker Compose to manage the container lifecycle for our Server nodes, Redis, Postgres, and Nginx, ensuring environment parity.

---

## Section 5: Redesigned and Scalable Web Architecture
The redesigned architecture is built for **Horizontal Scalability**. We utilize an **Nginx Reverse Proxy** to handle load balancing and request routing.

### Key Architectural Improvements:
*   **Sticky Sessions (ip_hash)**: Nginx ensures that clients maintain a persistent connection to a specific node, while Redis handles the data bridge to other nodes.
*   **Decoupled State**: By moving session and message data to Redis and PostgreSQL, our server nodes remain "stateless" and can be added or removed from the cluster dynamically.
*   **Fault Tolerance**: The multi-node setup ensures that the system remains online even if individual instances fail.

---

## Section 6: System Workflow and Online Communication Process
1.  **Handshake**: A client performs a secure **WSS handshake**, presenting a **JWT token** for identity verification against the Postgres database.
2.  **Event Flow**: When a message is sent:
    *   The server persists the record in **PostgreSQL**.
    *   The server publishes the event to **Redis Pub/Sub**.
    *   Subscribed server nodes receive the event and push the payload to their respective local clients.
3.  **Ephemeral Deletion (Pulse)**: For secret messages, the server executes an asynchronous **SQL DELETE** and broadcasts a "Burn" signal across the Redis backplane to purge the message from all client-side states.

---

## Section 7: Demonstration of the Web-Hosted System
The system is live at [kearl.me](https://kearl.me). 
*   **Cluster Sync**: Verified by real-time messaging between different server instances.
*   **Pulse Integrity**: Verified by the synchronized global destruction of ephemeral messages.
*   **Signaling Performance**: WebRTC P2P calls demonstrate efficient signaling bypass for media streams.

---

## Section 8: Final Project Deliverables
- [x] **PowerPoint Presentation**: (Refer to `docs/Distributed_Chat_System.pptx`)
- [x] **Compliance Documentation**: (This Document)
- [x] **Source Code**: Full repository with Docker and Cloud configurations.
- [x] **System Diagrams**: High-level and detailed Mermaid visual maps.
- [x] **Video Demonstration**: Capturing the distributed sync and security features.
