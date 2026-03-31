# n8n-nodes-telegram-archive

This is an n8n community node package for [Telegram-Archive](https://github.com/GeiserX/Telegram-Archive) — query archived Telegram chats, messages, and statistics from your self-hosted instance.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Credentials

Configure the **Telegram Archive API** credential with:

- **URL** — Base URL of your Telegram-Archive instance (default: `http://localhost:8000`)
- **Auth Token** — Authentication token for the API

## Nodes

### Telegram Archive

Regular node with the following resources and operations:

| Resource | Operation | Description |
|----------|-----------|-------------|
| Chat | List | List all archived chats |
| Chat | Get Stats | Get statistics for a specific chat |
| Chat | Get Topics | Get topics for a specific chat |
| Chat | Export | Export a chat |
| Message | List | List messages (with limit, offset, search) |
| Message | Get by Date | Get messages for a specific date |
| Message | Get Pinned | Get pinned messages in a chat |
| Stats | Get Global | Get global archive statistics |
| Stats | Refresh | Trigger a statistics refresh |
| Folder | List | List all folders |
| Archive | Get Count | Get the total archived message count |

### Telegram Archive Trigger

Polling trigger that detects new messages by comparing total message counts via the stats endpoint. Optionally filter to a specific chat.

## License

[GPL-3.0](LICENSE)
