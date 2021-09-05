from flask import Flask, request, jsonify, send_file
from flask_caching import Cache
from google.cloud import storage
from PIL import Image
import datetime
import io
import numpy as np
import pathlib
import subprocess
import tempfile


app = Flask(__name__)
app.config.from_mapping({
    'CACHE_TYPE': 'SimpleCache',
})
cache = Cache(app)

storage_client = storage.Client()
l3_bucket = storage_client.bucket('gcp-public-data-nexrad-l3-realtime')

LUTS = {
    'N0Q': 'upc_rad24.tbl',
}


def list_gcs_directories(bucket, prefix):
    # from https://github.com/GoogleCloudPlatform/google-cloud-python/issues/920
    # this is _incredibly_ stupid
    iterator = storage_client.list_blobs(bucket, prefix=prefix, delimiter='/')
    prefixes = []
    for page in iterator.pages:
        prefixes.extend(page.prefixes)
    return prefixes


@app.route('/l3', methods=['GET'])
@cache.cached(timeout=60*60*24)
def l3_list_sites():
    sites = list_gcs_directories(l3_bucket.name, 'NIDS/')
    return jsonify({'sites': [pathlib.Path(s).name for s in sites]})


@app.route('/l3/<site>', methods=['GET'])
@cache.cached(timeout=60*60*24)
def l3_list_products(site):
    products = list_gcs_directories(l3_bucket.name, f'NIDS/{site}/')
    return jsonify({'products': [pathlib.Path(s).name for s in products]})


@app.route('/l3/<site>/<product>', methods=['GET'])
@cache.cached(timeout=60*2)
def l3_list_files(site, product):
    blobs = storage_client.list_blobs(l3_bucket.name, prefix=f'NIDS/{site}/{product}/')
    return jsonify({'files': [pathlib.Path(blob.name).name for blob in blobs]})


@app.route('/l3/<site>/<product>/<fn>/render', methods=['GET'])
@cache.cached(timeout=60*60)
def l3_render_file(site, product, fn):
    site = site.upper()
    product = product.upper()

    date = datetime.datetime.strptime(fn.split('_', 1)[1], '%Y%m%d_%H%M')

    with tempfile.TemporaryDirectory() as rad_dir:
        prod_dir = pathlib.Path(rad_dir) / 'NIDS' / site / product
        prod_dir.mkdir(parents=True)

        blob = l3_bucket.blob(f'NIDS/{site}/{product}/{fn}')
        blob.download_to_filename(prod_dir / fn)

        out_fn = pathlib.Path(rad_dir) / 'out.gif'

        conv_process = subprocess.check_output(
            [
                './conv.sh',
                str(rad_dir),
                str(out_fn),
                product,
                date.strftime('%y%m%d/%H%M'),
            ],
        )

        img = Image.open(out_fn)
        img = np.array(img.convert('RGBA'))
        # alpha      =  255 where any RGB     != 0
        img[:, :, 3] = (255 * ((img[:, :, :3] != 0).any(axis=2))).astype(np.uint8)

        bio = io.BytesIO()
        Image.fromarray(img).save(bio, 'PNG')
        bio.seek(0)
        return send_file(bio, mimetype='image/png')


if __name__ == "__main__":
    app.run(host='0.0.0.0', debug=True)
