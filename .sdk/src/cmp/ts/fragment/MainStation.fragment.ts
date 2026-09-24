

let stationInstalled = true
try { require.resolve('STATIONPKG') }
catch (err: any) {
  // MODULE_NOT_FOUND is the absent case. Anything else - an invalid
  // package config, a root entry the package does not export - is a
  // real failure to load a station that IS installed, and swallowing
  // it would leave an empty factory table with no visible cause.
  if ('MODULE_NOT_FOUND' !== err?.code) { throw err }
  stationInstalled = false
}

if (stationInstalled) {
  const { provide } = require('STATIONPKG')
  // A station library predating the factory table has no provide() —
  // there is nothing to register with, which is not this SDK's error.
  if ('function' === typeof provide) {
    provide(config.main.slug, {
      construct: (options?: any) => new ProjectNameSDK(options),
      config,
    })
  }
}
