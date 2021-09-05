# TODO: does pypy help here?

import sys
import os
import numpy as np
import pyart
from PIL import Image

cms = {
    'reflectivity': pyart.graph.cm.NWSRef,
    'velocity': pyart.graph.cm.NWSVel,
    'spectrum_width': pyart.graph.cm.NWS_SPW,
}

if __name__ == "__main__":
    l2fn = sys.argv[1]
    radar = pyart.io.read_nexrad_archive(l2fn)

    # mask out last 10 gates of each ray, this removes the "ring" around the radar.
    radar.fields['reflectivity']['data'][:, -10:] = np.ma.masked

    # exclude masked gates from the gridding
    gatefilter = pyart.filters.GateFilter(radar)
    gatefilter.exclude_transition()
    #gatefilter.exclude_masked('reflectivity')

    # perform Cartesian mapping, limit to the reflectivity field.
    grid = pyart.map.grid_from_radars(
        (radar, ), gatefilters=(gatefilter, ),
        grid_shape=(1, 241, 241),
        grid_limits=((2000, 2000), (-123000.0, 123000.0), (-123000.0, 123000.0)),
    )

    for field_name, field in grid.fields.items():
        if field_name not in cms:
            continue
        data = field['data'][0].astype(np.int16)
        colored = cms[field_name](data) * 255
        im = Image.fromarray(colored.astype(np.uint8))
        im.save(os.path.basename(l2fn) + "_" + field_name + ".png")
