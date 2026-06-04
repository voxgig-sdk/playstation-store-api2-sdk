# PlaystationStoreApi2 SDK

Legacy PlayStation Store catalogue lookup for games, DLC, and bundles (chihiro endpoint, no longer supported)

> TypeScript, Python, PHP, Golang, Ruby, Lua SDKs, a CLI, an interactive REPL, and an MCP server for AI agents — all generated from one OpenAPI spec by [@voxgig/sdkgen](https://github.com/voxgig/sdkgen).

## About PlayStation Store API

The PlayStation Store API (`chihiro`) was an undocumented internal endpoint used by older PlayStation Store clients to fetch product metadata — game titles, DLC, bundles, pricing, regional availability, and media assets — from the storefront operated by [Sony Interactive Entertainment](https://store.playstation.com).

**Status: deprecated.** The path `/store/api/chihiro/00_09_000` no longer responds (HTTP 404 at the time of writing). Sony has migrated PlayStation Store data to newer backends used by the modern web store and PS4/PS5 consoles, and the chihiro tree was retired during that transition. This SDK is preserved for reference and for users working with archived responses; live calls against the documented server URL will fail.

Historically the endpoint exposed a tree of *container* resources — each container being a storefront category, region, or product grouping — which clients walked to enumerate products and reach individual SKU detail pages. Because the service was never officially documented, response shapes, query parameters, and rate limits were never published by Sony, and any prior knowledge comes from community reverse-engineering.

If you need current PlayStation Store data, look at Sony's modern web storefront URLs (`https://store.playstation.com/en-us/...`) or community projects that track the newer GraphQL-backed catalogue; do not rely on chihiro.

## Try it

**TypeScript**
```bash
npm install playstation-store-api2
```

**Python**
```bash
pip install playstation-store-api2-sdk
```

**PHP**
```bash
composer require voxgig/playstation-store-api2-sdk
```

**Golang**
```bash
go get github.com/voxgig-sdk/playstation-store-api2-sdk/go
```

**Ruby**
```bash
gem install playstation-store-api2-sdk
```

**Lua**
```bash
luarocks install playstation-store-api2-sdk
```

## 30-second quickstart

### TypeScript

```ts
import { PlaystationStoreApi2SDK } from 'playstation-store-api2'

const client = new PlaystationStoreApi2SDK({})

// List all containers
const containers = await client.Container().list()
```

See the [TypeScript README](ts/README.md) for the
full guide, or scroll down for the same example in other languages.

## What's in the box

| Surface | Use it for | Path |
| --- | --- | --- |
| **SDK** (TypeScript, Python, PHP, Golang, Ruby, Lua) | App integration | `ts/` `py/` `php/` `go/` `rb/` `lua/` |
| **CLI** | Scripts, CI, ops, one-off API calls | `go-cli/` |
| **MCP server** | AI agents (Claude, Cursor, Cline) | `go-mcp/` |

## Use it from an AI agent (MCP)

The generated MCP server exposes every operation in this SDK as an
[MCP](https://modelcontextprotocol.io) tool that Claude, Cursor or Cline
can call directly. Build and register it:

```bash
cd go-mcp && go build -o playstation-store-api2-mcp .
```

Then add it to your agent's MCP config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "playstation-store-api2": {
      "command": "/abs/path/to/playstation-store-api2-mcp"
    }
  }
}
```

## Entities

The API exposes one entity:

| Entity | Description | API path |
| --- | --- | --- |
| **Container** | A node in the PlayStation Store catalogue tree — historically a category, region, or product grouping reachable under `/store/api/chihiro/00_09_000/container/{id}`, returning child containers and product entries; endpoint is deprecated and no longer reachable. | `/container/{country}/{language}/{age_limit}/{container_id}` |

Each entity supports the following operations where available: **load**,
**list**, **create**, **update**, and **remove**.

## Quickstart in other languages

### Python

```python
from playstationstoreapi2_sdk import PlaystationStoreApi2SDK

client = PlaystationStoreApi2SDK({})

# List all containers
containers, err = client.Container(None).list(None, None)
```

### PHP

```php
<?php
require_once 'playstationstoreapi2_sdk.php';

$client = new PlaystationStoreApi2SDK([]);

// List all containers
[$containers, $err] = $client->Container(null)->list(null, null);
```

### Golang

```go
import sdk "github.com/voxgig-sdk/playstation-store-api2-sdk/go"

client := sdk.NewPlaystationStoreApi2SDK(map[string]any{})

// List all containers
containers, err := client.Container(nil).List(nil, nil)
```

### Ruby

```ruby
require_relative "PlaystationStoreApi2_sdk"

client = PlaystationStoreApi2SDK.new({})

# List all containers
containers, err = client.Container(nil).list(nil, nil)
```

### Lua

```lua
local sdk = require("playstation-store-api2_sdk")

local client = sdk.new({})

-- List all containers
local containers, err = client:Container(nil):list(nil, nil)
```

## Unit testing in offline mode

Every SDK ships a test mode that swaps the HTTP transport for an
in-memory mock, so unit tests run offline.

### TypeScript

```ts
const client = PlaystationStoreApi2SDK.test()
const result = await client.Container().load({ id: 'test01' })
// result.ok === true, result.data contains mock data
```

### Python

```python
client = PlaystationStoreApi2SDK.test(None, None)
result, err = client.Container(None).load(
    {"id": "test01"}, None
)
```

### PHP

```php
$client = PlaystationStoreApi2SDK::test(null, null);
[$result, $err] = $client->Container(null)->load(
    ["id" => "test01"], null
);
```

### Golang

```go
client := sdk.TestSDK(nil, nil)
result, err := client.Container(nil).Load(
    map[string]any{"id": "test01"}, nil,
)
```

### Ruby

```ruby
client = PlaystationStoreApi2SDK.test(nil, nil)
result, err = client.Container(nil).load(
  { "id" => "test01" }, nil
)
```

### Lua

```lua
local client = sdk.test(nil, nil)
local result, err = client:Container(nil):load(
  { id = "test01" }, nil
)
```

## How it works

Every SDK call runs the same five-stage pipeline:

1. **Point** — resolve the API endpoint from the operation definition.
2. **Spec** — build the HTTP specification (URL, method, headers, body).
3. **Request** — send the HTTP request.
4. **Response** — receive and parse the response.
5. **Result** — extract the result data for the caller.

A feature hook fires at each stage (e.g. `PrePoint`, `PreSpec`,
`PreRequest`), so features can inspect or modify the pipeline without
forking the SDK.

### Features

| Feature | Purpose |
| --- | --- |
| **TestFeature** | In-memory mock transport for testing without a live server |

Pass custom features via the `extend` option at construction time.

### Direct and Prepare

For endpoints the entity model doesn't cover, use the low-level methods:

- **`direct(fetchargs)`** — build and send an HTTP request in one step.
- **`prepare(fetchargs)`** — build the request without sending it.

Both accept a map with `path`, `method`, `params`, `query`,
`headers`, and `body`. See the [How-to guides](#how-to-guides) below.

## How-to guides

### Make a direct API call

When the entity interface does not cover an endpoint, use `direct`:

**TypeScript:**
```ts
const result = await client.direct({
  path: '/api/resource/{id}',
  method: 'GET',
  params: { id: 'example' },
})
console.log(result.data)
```

**Python:**
```python
result, err = client.direct({
    "path": "/api/resource/{id}",
    "method": "GET",
    "params": {"id": "example"},
})
```

**PHP:**
```php
[$result, $err] = $client->direct([
    "path" => "/api/resource/{id}",
    "method" => "GET",
    "params" => ["id" => "example"],
]);
```

**Go:**
```go
result, err := client.Direct(map[string]any{
    "path":   "/api/resource/{id}",
    "method": "GET",
    "params": map[string]any{"id": "example"},
})
```

**Ruby:**
```ruby
result, err = client.direct({
  "path" => "/api/resource/{id}",
  "method" => "GET",
  "params" => { "id" => "example" },
})
```

**Lua:**
```lua
local result, err = client:direct({
  path = "/api/resource/{id}",
  method = "GET",
  params = { id = "example" },
})
```

## Per-language documentation

- [TypeScript](ts/README.md)
- [Python](py/README.md)
- [PHP](php/README.md)
- [Golang](go/README.md)
- [Ruby](rb/README.md)
- [Lua](lua/README.md)

## Using the PlayStation Store API

- Upstream: [https://store.playstation.com](https://store.playstation.com)

- The `chihiro` endpoint was an internal/undocumented Sony Interactive Entertainment service; there is no published licence or terms permitting third-party use.
- The endpoint at `https://store.playstation.com/store/api/chihiro/00_09_000` is **deprecated** and currently returns HTTP 404; it has been superseded by newer PlayStation Store backends.
- Any data returned about games, DLC, prices, or artwork remains the property of Sony Interactive Entertainment and the respective publishers.
- This SDK is community-generated from an OpenAPI description of the historical endpoint; it is not affiliated with or endorsed by Sony.

---

Generated from the PlayStation Store API OpenAPI spec by [@voxgig/sdkgen](https://github.com/voxgig/sdkgen).
