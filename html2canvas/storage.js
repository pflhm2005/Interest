export default class CacheStorage{
  static _caches = {};
  static _link = null;
  static _origin = 'about:blank';
  static _current = null;
  static getOrigin(url) {
    const link = CacheStorage._link;
    if (!link) return 'about:blank';
    link.href = url;
    link.href = link.href;
    return link.protocol + link.hostname + link.port;
  }
  static create(name, options) {
    return (CacheStorage._caches[name] = new Cache(name, options));
  }
  static setContext(window) {
    CacheStorage._link = window.document.createElement('a');
    CacheStorage._origin = CacheStorage.getOrigin(window.location.href);
  }
  static attachInstance(cache) {
    CacheStorage._current = cache;
  }
  static detachInstance() {
    CacheStorage._current = null;
  }
}

class Cache {
  constructor(id, options) {
    this.id = id;
    this._options = options;
    this._cache = {};
  }
}