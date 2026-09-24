# PlaystationStoreApi2 SDK configuration


# The sekreto plugin DEFINITIONS the model selected per feature, imported
# above by name from the modules the catalogue's active `plugin.def`
# entries declare. Handed to each feature (secrets builds its Sekreto
# with them): a provider kind not listed here is unknown to that SDK.
FEATURE_PLUGINS = {
}


_shared_config = None


def shared_config():
    """Return the process-wide config, built once on first use.

    The SDK reads the config on every request and never writes to it, so one
    instance is shared by every client rather than rebuilt per client.

    The returned dict is shared: treat it as read-only. Callers that need to
    mutate should use make_config, which always returns a fresh copy.
    """
    global _shared_config
    if _shared_config is None:
        _shared_config = make_config()
    return _shared_config


def make_config():
    """Build a fresh, fully materialised config dict.

    Every call rebuilds the whole structure, so prefer shared_config unless
    you need a private copy you intend to mutate.
    """
    return {
        "main": {
            "name": "PlaystationStoreApi2",
            "slug": "playstation-store-api2",
            "version": "0.0.1",
            "target": "py",
        },
        "feature": {
            "ratelimit": {
        "options": {
          "active": False,
          "burst": 5,
          "rate": 5,
        },
        "optspec": {
          "now": "`$FUNCTION`",
          "sleep": "`$FUNCTION`",
        },
        "strict": False,
        "transport": "wrap",
      },
            "retry": {
        "options": {
          "active": False,
          "factor": 2,
          "maxDelay": 2000,
          "minDelay": 50,
          "retries": 2,
          "statuses": [
            408,
            425,
            429,
            500,
            502,
            503,
            504,
          ],
        },
        "optspec": {
          "jitter": "`$BOOLEAN`",
          "sleep": "`$FUNCTION`",
        },
        "strict": False,
        "transport": "wrap",
      },
            "test": {
        "options": {
          "active": False,
        },
        "optspec": {
          "entity": "`$MAP`",
          "net": "`$MAP`",
        },
        "strict": False,
        "transport": "base",
      },
            "timeout": {
        "options": {
          "active": False,
          "ms": 30000,
        },
        "optspec": {
          "clearTimer": "`$FUNCTION`",
          "setTimer": "`$FUNCTION`",
        },
        "strict": False,
        "transport": "wrap",
      },
        },
        "options": {
            "base": "https://store.playstation.com/store/api/chihiro/00_09_000",
            "headers": {
        "content-type": "application/json",
      },
            "entity": {
                "container": {},
            },
        },
        "entity": {
      "container": {
        "fields": [
          {
            "name": "age_limit",
            "title": "Age Limit",
            "type": "`$INTEGER`",
            "short": "Age limit for the content",
          },
          {
            "name": "attributes",
            "title": "Attributes",
            "type": "`$OBJECT`",
          },
          {
            "name": "container_type",
            "title": "Container Type",
            "type": "`$STRING`",
            "short": "Type of container",
          },
          {
            "name": "content_origin",
            "title": "Content Origin",
            "type": "`$INTEGER`",
            "short": "Content origin identifier",
          },
          {
            "name": "dob_required",
            "title": "Dob Required",
            "type": "`$BOOLEAN`",
            "short": "Whether date of birth is required",
          },
          {
            "name": "id",
            "title": "Id",
            "type": "`$STRING`",
            "short": "Container unique identifier",
          },
          {
            "name": "images",
            "title": "Images",
            "type": "`$ARRAY`",
          },
          {
            "name": "links",
            "title": "Links",
            "type": "`$ARRAY`",
            "short": "List of products in the container",
          },
        ],
        "id": {
          "field": "id",
          "from": {
            "age_limit": "age_limit",
          },
          "name": "id",
          "parts": [
            "country",
            "language",
            "age_limit",
            "container_id",
          ],
          "sep": "/",
        },
        "name": "container",
        "op": {
          "load": {
            "input": "data",
            "name": "load",
            "points": [
              {
                "kind": "http",
                "method": "GET",
                "orig": "/container/{country}/{language}/{age_limit}/{container_id}",
                "segments": [
                  {
                    "lit": "container",
                  },
                  {
                    "var": "country",
                  },
                  {
                    "var": "language",
                  },
                  {
                    "var": "age_limit",
                  },
                  {
                    "var": "container_id",
                  },
                ],
                "parts": [
                  "container",
                  "{country}",
                  "{language}",
                  "{age_limit}",
                  "{container_id}",
                ],
                "rename": {},
                "transform": {
                  "req": "`reqdata`",
                  "res": "`body`",
                },
                "args": {
                  "params": [
                    {
                      "name": "age_limit",
                      "orig": "age_limit",
                      "type": "`$STRING`",
                      "kind": "param",
                      "reqd": True,
                      "example": "999",
                    },
                    {
                      "name": "container_id",
                      "orig": "container_id",
                      "type": "`$STRING`",
                      "kind": "param",
                      "reqd": True,
                      "example": "STORE-MSF75508-FULLGAMES",
                    },
                    {
                      "name": "country",
                      "orig": "country",
                      "type": "`$STRING`",
                      "kind": "param",
                      "reqd": True,
                      "example": "ch",
                    },
                    {
                      "name": "language",
                      "orig": "language",
                      "type": "`$STRING`",
                      "kind": "param",
                      "reqd": True,
                      "example": "de",
                    },
                  ],
                  "query": [
                    {
                      "name": "game_content_type",
                      "orig": "game_content_type",
                      "type": "`$STRING`",
                      "kind": "query",
                    },
                    {
                      "name": "genre",
                      "orig": "genre",
                      "type": "`$STRING`",
                      "kind": "query",
                    },
                    {
                      "name": "platform",
                      "orig": "platform",
                      "type": "`$STRING`",
                      "kind": "query",
                    },
                    {
                      "name": "price",
                      "orig": "price",
                      "type": "`$STRING`",
                      "kind": "query",
                    },
                    {
                      "name": "release_date",
                      "orig": "release_date",
                      "type": "`$STRING`",
                      "kind": "query",
                    },
                    {
                      "name": "size",
                      "orig": "size",
                      "type": "`$INTEGER`",
                      "kind": "query",
                      "example": 20,
                    },
                    {
                      "name": "sort",
                      "orig": "sort",
                      "type": "`$STRING`",
                      "kind": "query",
                      "example": "release_date",
                    },
                    {
                      "name": "start",
                      "orig": "start",
                      "type": "`$INTEGER`",
                      "kind": "query",
                      "example": 0,
                    },
                  ],
                },
                "select": {
                  "exist": [
                    "age_limit",
                    "container_id",
                    "country",
                    "game_content_type",
                    "genre",
                    "language",
                    "platform",
                    "price",
                    "release_date",
                    "size",
                    "sort",
                    "start",
                  ],
                },
              },
            ],
          },
        },
        "relations": {
          "ancestors": [],
        },
      },
    },
    }
