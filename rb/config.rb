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
      },
      "feature" => {
        "test" => {
          "options" => {
            "active" => false,
          },
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
              "type" => "`$INTEGER`",
            },
            {
              "name" => "attributes",
              "type" => "`$OBJECT`",
            },
            {
              "name" => "container_type",
              "type" => "`$STRING`",
            },
            {
              "name" => "content_origin",
              "type" => "`$INTEGER`",
            },
            {
              "name" => "dob_required",
              "type" => "`$BOOLEAN`",
            },
            {
              "name" => "id",
              "type" => "`$STRING`",
            },
            {
              "name" => "images",
              "type" => "`$ARRAY`",
            },
            {
              "name" => "links",
              "type" => "`$ARRAY`",
            },
          ],
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
                  "parts" => [
                    "container",
                    "{country}",
                    "{language}",
                    "{age_limit}",
                    "{container_id}",
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
