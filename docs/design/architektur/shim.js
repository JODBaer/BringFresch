// Architektur-Übersicht: localStorage-Ersatz, falls das Handy im iframe keinen Speicher bekommt (file://, srcdoc). Wird von tools/build_architektur.mjs eingebaut.
(() => {
  try {
    const t = window.localStorage;
    t.getItem("__test");
  } catch (e) {
    const mem = new Map();
    const store = {
      getItem: k => (mem.has(String(k)) ? mem.get(String(k)) : null),
      setItem: (k, v) => { mem.set(String(k), String(v)); },
      removeItem: k => { mem.delete(String(k)); },
      clear: () => { mem.clear(); },
      key: i => [...mem.keys()][i] ?? null,
      get length() { return mem.size; }
    };
    Object.defineProperty(window, "localStorage", { value: store, configurable: true });
  }
})();
