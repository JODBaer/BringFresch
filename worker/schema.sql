-- BringFrisch: Datenmodell für Cloudflare D1 (SQLite). ENTWURF, noch nicht aktiv – siehe docs/plan-d1.md.
-- Einspielen (später): npx wrangler d1 execute bringfrisch --remote --file worker/schema.sql
-- Grundsatz: jede WG-Tabelle hat wg_id; jede Abfrage im Worker filtert darauf.

PRAGMA foreign_keys = ON;

-- Eine Zeile pro WG
CREATE TABLE IF NOT EXISTS wg (
  id            INTEGER PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,              -- Kurzname in der App, z.B. 'hottingen'
  name          TEXT NOT NULL,
  pin_hash      TEXT NOT NULL,                     -- PBKDF2, nie Klartext
  pin_salt      TEXT NOT NULL,
  cal_token     TEXT NOT NULL UNIQUE,              -- /cal/<token>.ics
  bring_list    TEXT,                              -- gewählte Bring!-Liste (UUID)
  dinner_time   TEXT NOT NULL DEFAULT '18:30',
  failed_pins   INTEGER NOT NULL DEFAULT 0,        -- kurze Sperre nach vielen falschen PINs
  locked_until  INTEGER,
  created       INTEGER NOT NULL,
  updated       INTEGER NOT NULL
);

-- Mitbewohner
CREATE TABLE IF NOT EXISTS member (
  wg_id   INTEGER NOT NULL REFERENCES wg(id) ON DELETE CASCADE,
  id      TEXT NOT NULL,                           -- wie heute in der App ('joshua', 'mia-lx3k…')
  name    TEXT NOT NULL,
  short   TEXT,                                    -- Kürzel (max. 3 Zeichen oder 1 Emoji), leer = automatisch
  diet    TEXT NOT NULL CHECK (diet IN ('fleisch', 'vegi', 'vegan')),
  pos     INTEGER NOT NULL DEFAULT 0,              -- Reihenfolge im Plan
  PRIMARY KEY (wg_id, id)
);

-- Rezepte: Katalog (owner_wg NULL), WG-eigen ('wg') oder für alle WGs geteilt ('shared')
CREATE TABLE IF NOT EXISTS recipe (
  id           TEXT PRIMARY KEY,                   -- Katalog: bisherige id; eigene: 'custom-…'
  owner_wg     INTEGER REFERENCES wg(id) ON DELETE SET NULL,
  visibility   TEXT NOT NULL DEFAULT 'wg' CHECK (visibility IN ('catalog', 'wg', 'shared')),
  title        TEXT NOT NULL,
  diet         TEXT NOT NULL CHECK (diet IN ('fleisch', 'vegi', 'vegan')),
  servings     INTEGER NOT NULL DEFAULT 4 CHECK (servings BETWEEN 1 AND 20),
  minutes      INTEGER,
  source_url   TEXT,                               -- nur Link, kein kopierter Text
  ingredients  TEXT NOT NULL,                      -- JSON [{name, amount, unit, bring_cat}]
  instructions TEXT,                               -- nur bei selbst geschriebenen Rezepten
  months       TEXT,                               -- JSON [1..12], Saison
  flags        TEXT,                               -- JSON {quick, vegi_swap, no_addons, is_leftovers, is_salad}
  copied_from  TEXT REFERENCES recipe(id) ON DELETE SET NULL,  -- «Anpassen» = eigene Kopie
  created      INTEGER NOT NULL,
  updated      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS recipe_owner ON recipe (owner_wg, visibility);
CREATE INDEX IF NOT EXISTS recipe_shared ON recipe (visibility) WHERE visibility = 'shared';

-- Was eine WG mit einem (fremden oder Katalog-)Rezept macht, ohne es zu kopieren
CREATE TABLE IF NOT EXISTS wg_recipe (
  wg_id      INTEGER NOT NULL REFERENCES wg(id) ON DELETE CASCADE,
  recipe_id  TEXT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  favorite   INTEGER NOT NULL DEFAULT 0,
  hidden     INTEGER NOT NULL DEFAULT 0,
  servings   INTEGER,                              -- eigene Personenzahl, NULL = wie im Rezept
  times_used INTEGER NOT NULL DEFAULT 0,           -- «Beliebt bei euch»
  PRIMARY KEY (wg_id, recipe_id)
);

-- Plan: eine Zeile pro WG, Woche, Tag (0 = Montag)
CREATE TABLE IF NOT EXISTS plan_day (
  wg_id           INTEGER NOT NULL REFERENCES wg(id) ON DELETE CASCADE,
  week            TEXT NOT NULL,                   -- '2026-W46'
  day             INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),
  recipe_id       TEXT,                            -- NULL = «noch offen» oder eigenes Menü ohne Rezept
  title           TEXT NOT NULL,
  ingredients     TEXT,                            -- JSON, Stand beim Einplanen (Rezept darf sich später ändern)
  eaters          TEXT NOT NULL DEFAULT '[]',      -- JSON [member.id]
  extra_guests    INTEGER NOT NULL DEFAULT 0,
  leftover_buffer INTEGER NOT NULL DEFAULT 2,
  empty           INTEGER NOT NULL DEFAULT 0,
  updated         INTEGER NOT NULL,
  PRIMARY KEY (wg_id, week, day)
);

-- Wochenwahl
CREATE TABLE IF NOT EXISTS vote_candidate (
  wg_id     INTEGER NOT NULL REFERENCES wg(id) ON DELETE CASCADE,
  week      TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  pos       INTEGER NOT NULL,
  PRIMARY KEY (wg_id, week, recipe_id)
);
CREATE TABLE IF NOT EXISTS vote_like (
  wg_id     INTEGER NOT NULL REFERENCES wg(id) ON DELETE CASCADE,
  week      TEXT NOT NULL,
  member_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  wish_day  INTEGER CHECK (wish_day BETWEEN 0 AND 6),
  PRIMARY KEY (wg_id, week, member_id, recipe_id)
);

-- Grundvorrat
CREATE TABLE IF NOT EXISTS staple (
  wg_id    INTEGER NOT NULL REFERENCES wg(id) ON DELETE CASCADE,
  id       TEXT NOT NULL,
  name     TEXT NOT NULL,
  aisle    TEXT,
  in_stock INTEGER NOT NULL DEFAULT 1,
  sent     INTEGER NOT NULL DEFAULT 0,             -- vom Bot auf Bring! gesetzt
  updated  INTEGER NOT NULL,
  PRIMARY KEY (wg_id, id)
);

-- Was der Bot selbst auf eine Bring!-Liste gesetzt hat (nur das darf er wegnehmen)
CREATE TABLE IF NOT EXISTS bot_item (
  wg_id     INTEGER NOT NULL REFERENCES wg(id) ON DELETE CASCADE,
  list_uuid TEXT NOT NULL,
  name_lc   TEXT NOT NULL,
  name      TEXT NOT NULL,
  spec      TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (wg_id, list_uuid, name_lc)
);

-- Rezept-Webseiten zum Stöbern
CREATE TABLE IF NOT EXISTS recipe_site (
  wg_id INTEGER NOT NULL REFERENCES wg(id) ON DELETE CASCADE,
  pos   INTEGER NOT NULL,
  name  TEXT NOT NULL,
  url   TEXT NOT NULL,
  PRIMARY KEY (wg_id, pos)
);
