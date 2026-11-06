(function () {
  var base = '/hospital-slayer-game/public/assets/';
  window.Builda = window.Builda || {};
  window.Builda.assets = window.Builda.assets || {
    url: function (path) {
      var p = String(path || '').replace(/^\/+/, '');
      var prev;
      do { prev = p; p = p.replace(/^(res|assets|media)\//, ''); } while (p !== prev);
      return base + p;
    }
  };
})();
