// PlaystationStoreApi2 Ts SDK: generated schemas. Do not edit.
//
// Generated from the model: `main.kit.optspec` and each feature's
// `config.options` for OPTSPEC; entity `fields[].type` for ENTITYSPEC.

const OPTSPEC = {
  "allow": {
    "method": "GET,PUT,POST,PATCH,DELETE,OPTIONS",
    "op": "create,update,load,list,remove,command,direct,graphql"
  },
  "apikey": "",
  "auth": {
    "basic": false,
    "prefix": ""
  },
  "base": "http://localhost:8000",
  "clean": {
    "keys": "key,token,id"
  },
  "entity": {
    "`$CHILD`": {
      "`$OPEN`": true,
      "active": false,
      "alias": {}
    }
  },
  "extend": "`$ANY`",
  "headers": {
    "`$CHILD`": "`$STRING`"
  },
  "prefix": "",
  "secret": "",
  "server": {
    "`$CHILD`": ""
  },
  "suffix": "",
  "system": {
    "fetch": "`$ANY`"
  },
  "test": {
    "active": false,
    "entity": {
      "`$OPEN`": true
    }
  },
  "utility": {},
  "feature": {
    "`$CHILD`": {
      "`$OPEN`": true,
      "active": false
    },
    "ratelimit": [
      "`$ONE`",
      {
        "`$OPEN`": true,
        "active": [
          "`$ONE`",
          "`$BOOLEAN`",
          "`$NIL`"
        ],
        "burst": [
          "`$ONE`",
          "`$NUMBER`",
          "`$NIL`"
        ],
        "rate": [
          "`$ONE`",
          "`$NUMBER`",
          "`$NIL`"
        ],
        "now": [
          "`$ONE`",
          "`$FUNCTION`",
          "`$NIL`"
        ],
        "sleep": [
          "`$ONE`",
          "`$FUNCTION`",
          "`$NIL`"
        ]
      },
      "`$NIL`"
    ],
    "retry": [
      "`$ONE`",
      {
        "`$OPEN`": true,
        "active": [
          "`$ONE`",
          "`$BOOLEAN`",
          "`$NIL`"
        ],
        "factor": [
          "`$ONE`",
          "`$NUMBER`",
          "`$NIL`"
        ],
        "maxDelay": [
          "`$ONE`",
          "`$NUMBER`",
          "`$NIL`"
        ],
        "minDelay": [
          "`$ONE`",
          "`$NUMBER`",
          "`$NIL`"
        ],
        "retries": [
          "`$ONE`",
          "`$NUMBER`",
          "`$NIL`"
        ],
        "statuses": [
          "`$ONE`",
          "`$LIST`",
          "`$NIL`"
        ],
        "jitter": [
          "`$ONE`",
          "`$BOOLEAN`",
          "`$NIL`"
        ],
        "sleep": [
          "`$ONE`",
          "`$FUNCTION`",
          "`$NIL`"
        ]
      },
      "`$NIL`"
    ],
    "test": [
      "`$ONE`",
      {
        "`$OPEN`": true,
        "active": [
          "`$ONE`",
          "`$BOOLEAN`",
          "`$NIL`"
        ],
        "entity": [
          "`$ONE`",
          "`$MAP`",
          "`$NIL`"
        ],
        "net": [
          "`$ONE`",
          "`$MAP`",
          "`$NIL`"
        ]
      },
      "`$NIL`"
    ],
    "timeout": [
      "`$ONE`",
      {
        "`$OPEN`": true,
        "active": [
          "`$ONE`",
          "`$BOOLEAN`",
          "`$NIL`"
        ],
        "ms": [
          "`$ONE`",
          "`$NUMBER`",
          "`$NIL`"
        ],
        "clearTimer": [
          "`$ONE`",
          "`$FUNCTION`",
          "`$NIL`"
        ],
        "setTimer": [
          "`$ONE`",
          "`$FUNCTION`",
          "`$NIL`"
        ]
      },
      "`$NIL`"
    ]
  }
}

const ENTITYSPEC = {}

export {
  OPTSPEC,
  ENTITYSPEC,
}
