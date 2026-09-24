
import { BaseFeature } from './feature/base/BaseFeature'
// #ImportFeatures


const FEATURE_CLASS: Record<string, typeof BaseFeature> = {
  // #FeatureClasses
}


const FEATURE_PLUGINS: Record<string, any[]> = {
  // #FeaturePlugins
}


const CONFIG_DATA = 'CONFIGJSON'


class Config {

  makeFeature(this: any, fn: string) {
    const fc = FEATURE_CLASS[fn]
    const fi = new fc()
    return fi
  }

  // False for a feature added at runtime via options.extend (station's
  // adopt path) - the constructor uses this to skip makeFeature for names
  // no generated class backs.
  hasFeature(this: any, fn: string) {
    return null != FEATURE_CLASS[fn]
  }

}


const config: any = Object.assign(new Config(), JSON.parse(CONFIG_DATA))

export {
  config,
  FEATURE_PLUGINS,
}
