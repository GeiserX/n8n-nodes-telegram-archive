# n8n-nodes-telegram-archive

This is an n8n community node package for [Telegram-Archive](https://github.com/GeiserX/Telegram-Archive) — query archived Telegram chats, messages, and statistics from your self-hosted instance.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Credentials

Configure the **Telegram Archive API** credential with:

- **URL** — Base URL of your Telegram-Archive instance (default: `http://localhost:8000`)
- **Username** — Login username (leave empty if authentication is disabled)
- **Password** — Login password (leave empty if authentication is disabled)

The node uses Telegram-Archive's session cookie authentication (`POST /api/login`). If the instance has authentication disabled (no `VIEWER_USERNAME`/`VIEWER_PASSWORD` env vars), leave the credential fields empty.

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

## Other n8n Community Nodes by GeiserX

- [n8n-nodes-cashpilot](https://github.com/GeiserX/n8n-nodes-cashpilot) — Passive income monitoring
- [n8n-nodes-genieacs](https://github.com/GeiserX/n8n-nodes-genieacs) — TR-069 device management
- [n8n-nodes-lynxprompt](https://github.com/GeiserX/n8n-nodes-lynxprompt) — AI configuration blueprints
- [n8n-nodes-pumperly](https://github.com/GeiserX/n8n-nodes-pumperly) — Fuel and EV charging prices
- [n8n-nodes-way-cms](https://github.com/GeiserX/n8n-nodes-way-cms) — Web archive content management


## Related Projects

| Project | Description |
|---------|-------------|
| [Telegram-Archive](https://github.com/GeiserX/Telegram-Archive) | Automated, incremental Telegram backups with a local web viewer |
| [telegram-delay-channel-cloner](https://github.com/GeiserX/telegram-delay-channel-cloner) | Telegram bot that relays messages between channels with configurable delay |
| [telegram-slskd-local-bot](https://github.com/GeiserX/telegram-slskd-local-bot) | Automated music discovery and download via Telegram bot with Soulseek |
| [paperless-telegram-bot](https://github.com/GeiserX/paperless-telegram-bot) | Manage Paperless-NGX documents entirely through Telegram |
| [telegram-archive-mcp](https://github.com/GeiserX/telegram-archive-mcp) | MCP Server for Telegram-Archive |

## License

[MIT](LICENSE)
