# PlaystationStoreApi2 SDK configuration

module PlaystationStoreApi2Config
  # Return the process-wide config, built once on first use. The SDK reads
  # the config on every request and never writes to it, so one instance is
  # shared by every client rather than rebuilt per client.
  #
  # The returned hash is shared: treat it as read-only. Callers that need to
  # mutate should use make_config, which always returns a fresh copy.
  def self.shared_config
    @shared_config ||= make_config
  end


  # Build a fresh, fully materialised config hash. Every call rebuilds the
  # whole structure, so prefer shared_config unless you need a private copy
  # you intend to mutate.
  def self.make_config
    {
      "main" => {
        "name" => "PlaystationStoreApi2",
        "slug" => "playstation-store-api2",
        "version" => "0.0.1",
        "target" => "rb",
      },
      "feature" => {
        "ratelimit" => {
          "options" => {
            "active" => false,
            "burst" => 5,
            "rate" => 5,
          },
          "optspec" => {
            "now" => "`$FUNCTION`",
            "sleep" => "`$FUNCTION`",
          },
          "strict" => false,
          "transport" => "wrap",
        },
        "retry" => {
          "options" => {
            "active" => false,
            "factor" => 2,
            "maxDelay" => 2000,
            "minDelay" => 50,
            "retries" => 2,
            "statuses" => [
              408,
              425,
              429,
              500,
              502,
              503,
              504,
            ],
          },
          "optspec" => {
            "jitter" => "`$BOOLEAN`",
            "sleep" => "`$FUNCTION`",
          },
          "strict" => false,
          "transport" => "wrap",
        },
        "test" => {
          "options" => {
            "active" => false,
          },
          "optspec" => {
            "entity" => "`$MAP`",
            "net" => "`$MAP`",
          },
          "strict" => false,
          "transport" => "base",
        },
        "timeout" => {
          "options" => {
            "active" => false,
            "ms" => 30000,
          },
          "optspec" => {
            "clearTimer" => "`$FUNCTION`",
            "setTimer" => "`$FUNCTION`",
          },
          "strict" => false,
          "transport" => "wrap",
        },
      },
      "options" => {
        "base" => "https://store.playstation.com/store/api/chihiro/00_09_000",
        "headers" => {
          "content-type" => "application/json",
        },
        "entity" => {
          "container" => {},
        },
      },
      "entity" => {
        "container" => {
          "fields" => [
            {
              "name" => "age_limit",
              "short" => "Age limit for the content",
              "type" => "`$INTEGER`",
            },
            {
              "name" => "attributes",
              "type" => "`$OBJECT`",
            },
            {
              "name" => "container_type",
              "short" => "Type of container",
              "type" => "`$STRING`",
            },
            {
              "name" => "content_origin",
              "short" => "Content origin identifier",
              "type" => "`$INTEGER`",
            },
            {
              "name" => "dob_required",
              "short" => "Whether date of birth is required",
              "type" => "`$BOOLEAN`",
            },
            {
              "name" => "id",
              "short" => "Container unique identifier",
              "type" => "`$STRING`",
            },
            {
              "name" => "images",
              "type" => "`$ARRAY`",
            },
            {
              "name" => "links",
              "short" => "List of products in the container",
              "type" => "`$ARRAY`",
            },
          ],
          "id" => {
            "field" => "id",
            "from" => {
              "age_limit" => "age_limit",
            },
            "name" => "id",
            "parts" => [
              "country",
              "language",
              "age_limit",
              "container_id",
            ],
            "sep" => "/",
          },
          "name" => "container",
          "op" => {
            "load" => {
              "input" => "data",
              "name" => "load",
              "points" => [
                {
                  "args" => {
                    "params" => [
                      {
                        "example" => "999",
                        "kind" => "param",
                        "name" => "age_limit",
                        "orig" => "age_limit",
                        "reqd" => true,
                        "type" => "`$STRING`",
                      },
                      {
                        "example" => "STORE-MSF75508-FULLGAMES",
                        "kind" => "param",
                        "name" => "container_id",
                        "orig" => "container_id",
                        "reqd" => true,
                        "type" => "`$STRING`",
                      },
                      {
                        "example" => "ch",
                        "kind" => "param",
                        "name" => "country",
                        "orig" => "country",
                        "reqd" => true,
                        "type" => "`$STRING`",
                      },
                      {
                        "example" => "de",
                        "kind" => "param",
                        "name" => "language",
                        "orig" => "language",
                        "reqd" => true,
                        "type" => "`$STRING`",
                      },
                    ],
                    "query" => [
                      {
                        "kind" => "query",
                        "name" => "game_content_type",
                        "orig" => "game_content_type",
                        "type" => "`$STRING`",
                      },
                      {
                        "kind" => "query",
                        "name" => "genre",
                        "orig" => "genre",
                        "type" => "`$STRING`",
                      },
                      {
                        "kind" => "query",
                        "name" => "platform",
                        "orig" => "platform",
                        "type" => "`$STRING`",
                      },
                      {
                        "kind" => "query",
                        "name" => "price",
                        "orig" => "price",
                        "type" => "`$STRING`",
                      },
                      {
                        "kind" => "query",
                        "name" => "release_date",
                        "orig" => "release_date",
                        "type" => "`$STRING`",
                      },
                      {
                        "example" => 20,
                        "kind" => "query",
                        "name" => "size",
                        "orig" => "size",
                        "type" => "`$INTEGER`",
                      },
                      {
                        "example" => "release_date",
                        "kind" => "query",
                        "name" => "sort",
                        "orig" => "sort",
                        "type" => "`$STRING`",
                      },
                      {
                        "example" => 0,
                        "kind" => "query",
                        "name" => "start",
                        "orig" => "start",
                        "type" => "`$INTEGER`",
                      },
                    ],
                  },
                  "kind" => "http",
                  "method" => "GET",
                  "orig" => "/container/{country}/{language}/{age_limit}/{container_id}",
                  "segments" => [
                    {
                      "lit" => "container",
                    },
                    {
                      "var" => "country",
                    },
                    {
                      "var" => "language",
                    },
                    {
                      "var" => "age_limit",
                    },
                    {
                      "var" => "container_id",
                    },
                  ],
                  "select" => {
                    "exist" => [
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
                  "transform" => {
                    "req" => "`reqdata`",
                    "res" => "`body`",
                  },
                  "parts" => [
                    "container",
                    "{country}",
                    "{language}",
                    "{age_limit}",
                    "{container_id}",
                  ],
                },
              ],
            },
          },
          "relations" => {
            "ancestors" => [
              [
                "container",
              ],
            ],
          },
        },
      },
    }
  end


  def self.make_feature(name)
    require_relative 'features'
    PlaystationStoreApi2Features.make_feature(name)
  end
end
