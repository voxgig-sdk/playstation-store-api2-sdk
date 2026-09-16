
import { BaseFeature } from './feature/base/BaseFeature'
import { RatelimitFeature } from './feature/ratelimit/RatelimitFeature'
import { RetryFeature } from './feature/retry/RetryFeature'
import { TestFeature } from './feature/test/TestFeature'
import { TimeoutFeature } from './feature/timeout/TimeoutFeature'



const FEATURE_CLASS: Record<string, typeof BaseFeature> = {
   ratelimit: RatelimitFeature,
 retry: RetryFeature,
 test: TestFeature,
 timeout: TimeoutFeature,

}


// Per-feature plugin DEFINITIONS (voxgig/plugin `Definition` values), from
// the model's active plugin groups. A feature that takes a `plugins` option
// (secrets over sekreto) reads its own entry; a feature with no plugins has
// none. Named imports above make each definition statically reachable, so
// an SDK carries exactly the plugin modules its model selects — the same
// leanness the old side-effect registry imports bought, without a registry.
const FEATURE_PLUGINS: Record<string, any[]> = {
  
}


class Config {

  makeFeature(this: any, fn: string) {
    const fc = FEATURE_CLASS[fn]
    const fi = new fc()
    // TODO: errors etc
    return fi
  }

  // False for a feature added at runtime via options.extend (station's
  // adopt path) - the constructor uses this to skip makeFeature for names
  // no generated class backs.
  hasFeature(this: any, fn: string) {
    return null != FEATURE_CLASS[fn]
  }


  main = {
    name: 'PlaystationStoreApi2',
        slug: "playstation-store-api2",
    version: "0.0.1",
    target: "ts",

  }


  feature = {
     ratelimit:     {
      "options": {
        "active": false,
        "burst": 5,
        "rate": 5
      },
      "optspec": {
        "now": "`$FUNCTION`",
        "sleep": "`$FUNCTION`"
      },
      "strict": false,
      "transport": "wrap"
    },
 retry:     {
      "options": {
        "active": false,
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
          504
        ]
      },
      "optspec": {
        "jitter": "`$BOOLEAN`",
        "sleep": "`$FUNCTION`"
      },
      "strict": false,
      "transport": "wrap"
    },
 test:     {
      "options": {
        "active": false
      },
      "optspec": {
        "entity": "`$MAP`",
        "net": "`$MAP`"
      },
      "strict": false,
      "transport": "base"
    },
 timeout:     {
      "options": {
        "active": false,
        "ms": 30000
      },
      "optspec": {
        "clearTimer": "`$FUNCTION`",
        "setTimer": "`$FUNCTION`"
      },
      "strict": false,
      "transport": "wrap"
    },

  }


  options = {
    base: "https://store.playstation.com/store/api/chihiro/00_09_000",

    headers: {
      "content-type": "application/json"
    },

    entity: {
      
      container: {
      },

    }
  }


  entity = {
    "container": {
      "fields": [
        {
          "name": "age_limit",
          "short": "Age limit for the content",
          "type": "`$INTEGER`"
        },
        {
          "name": "attributes",
          "type": "`$OBJECT`"
        },
        {
          "name": "container_type",
          "short": "Type of container",
          "type": "`$STRING`"
        },
        {
          "name": "content_origin",
          "short": "Content origin identifier",
          "type": "`$INTEGER`"
        },
        {
          "name": "dob_required",
          "short": "Whether date of birth is required",
          "type": "`$BOOLEAN`"
        },
        {
          "name": "id",
          "short": "Container unique identifier",
          "type": "`$STRING`"
        },
        {
          "name": "images",
          "type": "`$ARRAY`"
        },
        {
          "name": "links",
          "short": "List of products in the container",
          "type": "`$ARRAY`"
        }
      ],
      "id": {
        "field": "id",
        "from": {
          "age_limit": "age_limit"
        },
        "name": "id",
        "parts": [
          "country",
          "language",
          "age_limit",
          "container_id"
        ],
        "sep": "/"
      },
      "name": "container",
      "op": {
        "load": {
          "input": "data",
          "name": "load",
          "points": [
            {
              "args": {
                "params": [
                  {
                    "example": "999",
                    "kind": "param",
                    "name": "age_limit",
                    "orig": "age_limit",
                    "reqd": true,
                    "type": "`$STRING`"
                  },
                  {
                    "example": "STORE-MSF75508-FULLGAMES",
                    "kind": "param",
                    "name": "container_id",
                    "orig": "container_id",
                    "reqd": true,
                    "type": "`$STRING`"
                  },
                  {
                    "example": "ch",
                    "kind": "param",
                    "name": "country",
                    "orig": "country",
                    "reqd": true,
                    "type": "`$STRING`"
                  },
                  {
                    "example": "de",
                    "kind": "param",
                    "name": "language",
                    "orig": "language",
                    "reqd": true,
                    "type": "`$STRING`"
                  }
                ],
                "query": [
                  {
                    "kind": "query",
                    "name": "game_content_type",
                    "orig": "game_content_type",
                    "type": "`$STRING`"
                  },
                  {
                    "kind": "query",
                    "name": "genre",
                    "orig": "genre",
                    "type": "`$STRING`"
                  },
                  {
                    "kind": "query",
                    "name": "platform",
                    "orig": "platform",
                    "type": "`$STRING`"
                  },
                  {
                    "kind": "query",
                    "name": "price",
                    "orig": "price",
                    "type": "`$STRING`"
                  },
                  {
                    "kind": "query",
                    "name": "release_date",
                    "orig": "release_date",
                    "type": "`$STRING`"
                  },
                  {
                    "example": 20,
                    "kind": "query",
                    "name": "size",
                    "orig": "size",
                    "type": "`$INTEGER`"
                  },
                  {
                    "example": "release_date",
                    "kind": "query",
                    "name": "sort",
                    "orig": "sort",
                    "type": "`$STRING`"
                  },
                  {
                    "example": 0,
                    "kind": "query",
                    "name": "start",
                    "orig": "start",
                    "type": "`$INTEGER`"
                  }
                ]
              },
              "kind": "http",
              "method": "GET",
              "orig": "/container/{country}/{language}/{age_limit}/{container_id}",
              "segments": [
                {
                  "lit": "container"
                },
                {
                  "var": "country"
                },
                {
                  "var": "language"
                },
                {
                  "var": "age_limit"
                },
                {
                  "var": "container_id"
                }
              ],
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
                  "start"
                ]
              },
              "transform": {
                "req": "`reqdata`",
                "res": "`body`"
              },
              "parts": [
                "container",
                "{country}",
                "{language}",
                "{age_limit}",
                "{container_id}"
              ]
            }
          ]
        }
      },
      "relations": {
        "ancestors": [
          [
            "container"
          ]
        ]
      }
    }
  }
}


const config = new Config()

export {
  config,
  FEATURE_PLUGINS,
}

