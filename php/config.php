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
                "test" => [
          'options' => [
            'active' => false,
          ],
          'transport' => 'base',
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
              'short' => 'Age limit for the content',
              'type' => '`$INTEGER`',
            ],
            [
              'name' => 'attributes',
              'type' => '`$OBJECT`',
            ],
            [
              'name' => 'container_type',
              'short' => 'Type of container',
              'type' => '`$STRING`',
            ],
            [
              'name' => 'content_origin',
              'short' => 'Content origin identifier',
              'type' => '`$INTEGER`',
            ],
            [
              'name' => 'dob_required',
              'short' => 'Whether date of birth is required',
              'type' => '`$BOOLEAN`',
            ],
            [
              'name' => 'id',
              'short' => 'Container unique identifier',
              'type' => '`$STRING`',
            ],
            [
              'name' => 'images',
              'type' => '`$ARRAY`',
            ],
            [
              'name' => 'links',
              'short' => 'List of products in the container',
              'type' => '`$ARRAY`',
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
                  'args' => [
                    'params' => [
                      [
                        'example' => '999',
                        'kind' => 'param',
                        'name' => 'age_limit',
                        'orig' => 'age_limit',
                        'reqd' => true,
                        'type' => '`$STRING`',
                      ],
                      [
                        'example' => 'STORE-MSF75508-FULLGAMES',
                        'kind' => 'param',
                        'name' => 'container_id',
                        'orig' => 'container_id',
                        'reqd' => true,
                        'type' => '`$STRING`',
                      ],
                      [
                        'example' => 'ch',
                        'kind' => 'param',
                        'name' => 'country',
                        'orig' => 'country',
                        'reqd' => true,
                        'type' => '`$STRING`',
                      ],
                      [
                        'example' => 'de',
                        'kind' => 'param',
                        'name' => 'language',
                        'orig' => 'language',
                        'reqd' => true,
                        'type' => '`$STRING`',
                      ],
                    ],
                    'query' => [
                      [
                        'kind' => 'query',
                        'name' => 'game_content_type',
                        'orig' => 'game_content_type',
                        'type' => '`$STRING`',
                      ],
                      [
                        'kind' => 'query',
                        'name' => 'genre',
                        'orig' => 'genre',
                        'type' => '`$STRING`',
                      ],
                      [
                        'kind' => 'query',
                        'name' => 'platform',
                        'orig' => 'platform',
                        'type' => '`$STRING`',
                      ],
                      [
                        'kind' => 'query',
                        'name' => 'price',
                        'orig' => 'price',
                        'type' => '`$STRING`',
                      ],
                      [
                        'kind' => 'query',
                        'name' => 'release_date',
                        'orig' => 'release_date',
                        'type' => '`$STRING`',
                      ],
                      [
                        'example' => 20,
                        'kind' => 'query',
                        'name' => 'size',
                        'orig' => 'size',
                        'type' => '`$INTEGER`',
                      ],
                      [
                        'example' => 'release_date',
                        'kind' => 'query',
                        'name' => 'sort',
                        'orig' => 'sort',
                        'type' => '`$STRING`',
                      ],
                      [
                        'example' => 0,
                        'kind' => 'query',
                        'name' => 'start',
                        'orig' => 'start',
                        'type' => '`$INTEGER`',
                      ],
                    ],
                  ],
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
                  'transform' => [
                    'req' => '`reqdata`',
                    'res' => '`body`',
                  ],
                  'parts' => [
                    'container',
                    '{country}',
                    '{language}',
                    '{age_limit}',
                    '{container_id}',
                  ],
                ],
              ],
            ],
          ],
          'relations' => [
            'ancestors' => [
              [
                'container',
              ],
            ],
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
