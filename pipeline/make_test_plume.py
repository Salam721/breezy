"""TEST ONLY. Writes a plumes.json with one fake plume placed so that YOUR point is inside it,
or an empty (all-clear) file. Your coordinates are used only on this machine.

    python make_test_plume.py plume LAT LON      -> test-plume.json
    python make_test_plume.py clear              -> test-clear.json

The fake sensor is 100 m upwind of the point, wind from 180 deg (south), 3 m/s, PM2.5 = 80.
generated_at is "now", so upload within a few minutes of the walk (the app treats files older
than 10 minutes as stale).
"""
import math
import sys
from datetime import datetime, timezone

from shapely.geometry import Point, shape

from breezy_pipeline.config import Config
from breezy_pipeline.models import Reading, Wind
from breezy_pipeline.plumefile import build_plume_file, to_json

FROM_DEG, SPEED = 180.0, 3.0


def main(argv):
    cfg, now, wind = Config(), datetime.now(timezone.utc), Wind(FROM_DEG, SPEED)
    if argv[:1] == ["clear"]:
        out, doc = "test-clear.json", build_plume_file([], wind, cfg, now)
    elif argv[:1] == ["plume"] and len(argv) == 3:
        lat, lon = float(argv[1]), float(argv[2])
        b = math.radians(FROM_DEG)
        s_lat = lat + math.cos(b) * 100 / 111320
        s_lon = lon + math.sin(b) * 100 / (111320 * math.cos(math.radians(lat)))
        doc = build_plume_file([Reading(999001, 999001, s_lat, s_lon, 80.0, now)], wind, cfg, now)
        inside = shape(doc["features"][0]["geometry"]).contains(Point(lon, lat))
        print(f"your point inside the fake plume: {inside}")
        if not inside:
            sys.exit("ABORT: point not inside; do not upload")
        out = "test-plume.json"
    else:
        sys.exit(__doc__)
    with open(out, "w", encoding="utf-8") as f:
        f.write(to_json(doc))
    print(f"wrote {out} (generated_at={doc['generated_at']})")


main(sys.argv[1:])