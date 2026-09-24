<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK configuration

class PlaystationStoreApi2Config
{
    /** @var array<string,mixed>|null */
    private static ?array $shared_config = null;

    /**
     * Return the process-wide config, built once on first use. The SDK reads
     * the config on every request and never writes to it, so one instance is
     * shared by every client rather than rebuilt per client.
     *
     * PHP arrays are copy-on-write, so callers that do mutate the result get
     * their own copy and cannot disturb the shared one.
     */
    public static function shared_config(): array
    {
        if (self::$shared_config === null) {
            self::$shared_config = self::make_config();
        }
        return self::$shared_config;
    }

    /**
     * Build a fresh, fully materialised config array. Every call rebuilds the
     * whole structure, so prefer shared_config unless you need a private copy.
     */
    public static function make_config(): array
    {
        return [
            "main" => [
                "name" => "PlaystationStoreApi2",
                "slug" => "playstation-store-api2",
                "version" => "0.0.1",
                "target" => "php",
            ],
            "feature" => [
                "ratelimit" => [
          'options' => [
            'active' => false,
            'burst' => 5,
            'rate' => 5,
          ],
          'optspec' => [
            'now' => '`$FUNCTION`',
            'sleep' => '`$FUNCTION`',
          ],
          'strict' => false,
          'transport' => 'wrap',
        ],
                "retry" => [
          'options' => [
            'active' => false,
            'factor' => 2,
            'maxDelay' => 2000,
            'minDelay' => 50,
            'retries' => 2,
            'statuses' => [
              408,
              425,
              429,
              500,
              502,
              503,
              504,
            ],
          ],
          'optspec' => [
            'jitter' => '`$BOOLEAN`',
            'sleep' => '`$FUNCTION`',
          ],
          'strict' => false,
          'transport' => 'wrap',
        ],
                "test" => [
          'options' => [
            'active' => false,
          ],
          'optspec' => [
            'entity' => '`$MAP`',
            'net' => '`$MAP`',
          ],
          'strict' => false,
          'transport' => 'base',
        ],
                "timeout" => [
          'options' => [
            'active' => false,
            'ms' => 30000,
          ],
          'optspec' => [
            'clearTimer' => '`$FUNCTION`',
            'setTimer' => '`$FUNCTION`',
          ],
          'strict' => false,
          'transport' => 'wrap',
        ],
            ],
            "options" => [
                "base" => "https://store.playstation.com/store/api/chihiro/00_09_000",
                "headers" => [
          'content-type' => 'application/json',
        ],
                "entity" => [
                    "container" => [],
                ],
            ],
            "entity" => [
        'container' => [
          'fields' => [
            [
              'name' => 'age_limit',
              'title' => 'Age Limit',
              'type' => '`$INTEGER`',
              'short' => 'Age limit for the content',
            ],
            [
              'name' => 'attributes',
              'title' => 'Attributes',
              'type' => '`$OBJECT`',
            ],
            [
              'name' => 'container_type',
              'title' => 'Container Type',
              'type' => '`$STRING`',
              'short' => 'Type of container',
            ],
            [
              'name' => 'content_origin',
              'title' => 'Content Origin',
              'type' => '`$INTEGER`',
              'short' => 'Content origin identifier',
            ],
            [
              'name' => 'dob_required',
              'title' => 'Dob Required',
              'type' => '`$BOOLEAN`',
              'short' => 'Whether date of birth is required',
            ],
            [
              'name' => 'id',
              'title' => 'Id',
              'type' => '`$STRING`',
              'short' => 'Container unique identifier',
            ],
            [
              'name' => 'images',
              'title' => 'Images',
              'type' => '`$ARRAY`',
            ],
            [
              'name' => 'links',
              'title' => 'Links',
              'type' => '`$ARRAY`',
              'short' => 'List of products in the container',
            ],
          ],
          'id' => [
            'field' => 'id',
            'from' => [
              'age_limit' => 'age_limit',
            ],
            'name' => 'id',
            'parts' => [
              'country',
              'language',
              'age_limit',
              'container_id',
            ],
            'sep' => '/',
          ],
          'name' => 'container',
          'op' => [
            'load' => [
              'input' => 'data',
              'name' => 'load',
              'points' => [
                [
                  'kind' => 'http',
                  'method' => 'GET',
                  'orig' => '/container/{country}/{language}/{age_limit}/{container_id}',
                  'segments' => [
                    [
                      'lit' => 'container',
                    ],
                    [
                      'var' => 'country',
                    ],
                    [
                      'var' => 'language',
                    ],
                    [
                      'var' => 'age_limit',
                    ],
                    [
                      'var' => 'container_id',
                    ],
                  ],
                  'parts' => [
                    'container',
                    '{country}',
                    '{language}',
                    '{age_limit}',
                    '{container_id}',
                  ],
                  'rename' => [],
                  'transform' => [
                    'req' => '`reqdata`',
                    'res' => '`body`',
                  ],
                  'args' => [
                    'params' => [
                      [
                        'name' => 'age_limit',
                        'orig' => 'age_limit',
                        'type' => '`$STRING`',
                        'kind' => 'param',
                        'reqd' => true,
                        'example' => '999',
                      ],
                      [
                        'name' => 'container_id',
                        'orig' => 'container_id',
                        'type' => '`$STRING`',
                        'kind' => 'param',
                        'reqd' => true,
                        'example' => 'STORE-MSF75508-FULLGAMES',
                      ],
                      [
                        'name' => 'country',
                        'orig' => 'country',
                        'type' => '`$STRING`',
                        'kind' => 'param',
                        'reqd' => true,
                        'example' => 'ch',
                      ],
                      [
                        'name' => 'language',
                        'orig' => 'language',
                        'type' => '`$STRING`',
                        'kind' => 'param',
                        'reqd' => true,
                        'example' => 'de',
                      ],
                    ],
                    'query' => [
                      [
                        'name' => 'game_content_type',
                        'orig' => 'game_content_type',
                        'type' => '`$STRING`',
                        'kind' => 'query',
                      ],
                      [
                        'name' => 'genre',
                        'orig' => 'genre',
                        'type' => '`$STRING`',
                        'kind' => 'query',
                      ],
                      [
                        'name' => 'platform',
                        'orig' => 'platform',
                        'type' => '`$STRING`',
                        'kind' => 'query',
                      ],
                      [
                        'name' => 'price',
                        'orig' => 'price',
                        'type' => '`$STRING`',
                        'kind' => 'query',
                      ],
                      [
                        'name' => 'release_date',
                        'orig' => 'release_date',
                        'type' => '`$STRING`',
                        'kind' => 'query',
                      ],
                      [
                        'name' => 'size',
                        'orig' => 'size',
                        'type' => '`$INTEGER`',
                        'kind' => 'query',
                        'example' => 20,
                      ],
                      [
                        'name' => 'sort',
                        'orig' => 'sort',
                        'type' => '`$STRING`',
                        'kind' => 'query',
                        'example' => 'release_date',
                      ],
                      [
                        'name' => 'start',
                        'orig' => 'start',
                        'type' => '`$INTEGER`',
                        'kind' => 'query',
                        'example' => 0,
                      ],
                    ],
                  ],
                  'select' => [
                    'exist' => [
                      'age_limit',
                      'container_id',
                      'country',
                      'game_content_type',
                      'genre',
                      'language',
                      'platform',
                      'price',
                      'release_date',
                      'size',
                      'sort',
                      'start',
                    ],
                  ],
                ],
              ],
            ],
          ],
          'relations' => [
            'ancestors' => [],
          ],
        ],
      ],
        ];
    }


    public static function make_feature(string $name)
    {
        require_once __DIR__ . '/features.php';
        return PlaystationStoreApi2Features::make_feature($name);
    }
}
