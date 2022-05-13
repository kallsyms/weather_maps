// if this ever switches to a higher quality (self hosted) data source, _maybe_ increase maxzoom to 12ish
var map = L.map('map', {minZoom: 3, maxZoom: 10}).setView([37.8, -96], 4);
map.createPane('labels');

// https://github.com/Leaflet/Leaflet/blob/v1.0.0/dist/leaflet.css#L84
map.getPane('labels').style.zIndex = 450;
map.getPane('labels').style.pointerEvents = 'none';

// previews: https://leaflet-extras.github.io/leaflet-providers/preview/
var basemap = L.tileLayer.colorFilter('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}{r}.png', {
	attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	subdomains: 'abcd',
});
basemap.addTo(map);

var labels = L.tileLayer.colorFilter('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}{r}.png', {
	attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	subdomains: 'abcd',
    filter: ['invert: 100%'],  // https://github.com/xtk93x/Leaflet.TileLayer.ColorFilter
    pane: 'labels',
});
labels.addTo(map);

const nexrad_sites = ["ABC","ABR","ABX","ACG","ADW","AEC","AHG","AIH","AKC","AKQ","AMA","AMX","APD","APX","ARX","ATL","ATX","BBX","BGM","BHX","BIS","BLX","BMX","BNA","BOS","BOX","BRO","BUF","BWI","BYX","CAE","CBW","CBX","CCX","CLE","CLT","CLX","CMH","CRP","CVG","CXX","CYS","DAL","DAX","DAY","DCA","DDC","DEN","DFW","DFX","DGX","DIX","DLH","DMX","DOX","DTW","DTX","DVN","DYX","EAX","EMX","ENX","EOX","EPZ","ESX","EVX","EWR","EWX","EYX","FCX","FDR","FDX","FFC","FLL","FSD","FSX","FTG","FWS","GGW","GJX","GLD","GRB","GRK","GRR","GSP","GUA","GWX","GYX","HDX","HGX","HKI","HKM","HMO","HNX","HOU","HPX","HTX","HWA","IAD","IAH","ICH","ICT","ICX","IDS","ILN","ILX","IND","INX","IWA","IWX","JAX","JFK","JGX","JKL","JUA","KJK","KSG","LAS","LBB","LCH","LGX","LIX","LNX","LOT","LRX","LSX","LTX","LVE","LVX","LWX","LZK","MAF","MAX","MBX","MCI","MCO","MDW","MEM","MHX","MIA","MKE","MKX","MLB","MOB","MPX","MQT","MRX","MSP","MSX","MSY","MTX","MUX","MVX","MXX","NKX","NQA","OAX","ODN","OHX","OKC","OKX","ORD","OTX","PAH","PBI","PBZ","PDT","PHL","PHX","PIT","POE","PUX","RAX","RDU","RGX","RIW","RLX","RTX","SDF","SFX","SGF","SHV","SJT","SJU","SLC","SOX","SRX","STL","TBW","TFX","TLH","TLX","TPA","TUL","TWX","TYX","UDX","UEX","VAX","VBX","VNX","VTX","VWX","YUX"];

const nexrad_products = {
    'Base Reflectivity': 'N0Q',
    'Base Velocity': 'N0U',
    'Storm Relative Velocity': 'N0S',
};

var options = {
    'NEXRAD Mosaic': {
        options: () => [['Reflectivity']],
        IEMServiceName: (opts) => 'nexrad-n0q-900913',
    },
    'NEXRAD Site': {
        options: () => [nexrad_sites, nexrad_products],
        IEMServiceName: (opts) => `ridge::${opts[0]}-${opts[1]}-0`,
        L3Path: (opts) => `${opts[0]}/${opts[1]}/latest`,
    },
    'GOES': {
        options: () => {
            let channels = {}
            for (let chan = 1; chan <= 16; chan++) {
                channels[`Channel ${chan}`] = chan.toString().padStart(2, "0");
            }
            return [['East', 'West'], channels];
        },
        IEMServiceName: (opts) => `goes_${opts[0].toLowerCase()}_fulldisk_ch${opts[1]}`,
    },
    //'HRRR': {'Reflectivity': {}},
}

function IEMLayer(IEMServiceName) {
    return L.tileLayer('https://mesonet{s}.agron.iastate.edu/cache/tile.py/1.0.0/{service}/{z}/{x}/{y}.png', {
        attribution: 'Iowa Environmental Mesonet',
        subdomains: '123',
        service: IEMServiceName,
        opacity: 0.8,
    });
}

function L3Layer(path) {
    return L.imageOverlay(
        `https://l3-render-kmhncqyeya-uc.a.run.app/l3/${path}/render`,
        [[25.00, -125.00], [50.00, -65.00]],
    )
}

var weatherLayer;

var typeSelect = document.getElementById('baseType');
var typeOptionsDiv = document.getElementById('typeOptionsDiv');

function optChange() {
    if (weatherLayer !== undefined) {
        map.removeLayer(weatherLayer);
    }
    let t = options[typeSelect.value];

    let selectedOptions = [];
    for (const child of typeOptionsDiv.children) {
        selectedOptions.push(child.value);
    }

    if (t.L3Path !== undefined) {
        weatherLayer = L3Layer(t.L3Path(selectedOptions));
    } else {
        weatherLayer = IEMLayer(t.IEMServiceName(selectedOptions));
    }
    weatherLayer.addTo(map);
}

typeSelect.onchange = () => {
    while (typeOptionsDiv.firstChild) {
        typeOptionsDiv.removeChild(typeOptionsDiv.firstChild);
    }
    let t = options[typeSelect.value];
    for (const opt of t.options()) {
        let select = document.createElement('select');
        select.onchange = optChange;

        if (Array.isArray(opt)) {
            for (const optValue of opt) {
                let optElem = document.createElement('option');
                optElem.text = optValue;
                optElem.value = optValue;
                select.appendChild(optElem);
            }
        } else {
            for (const [name, value] of Object.entries(opt)) {
                let optElem = document.createElement('option');
                optElem.text = name;
                optElem.value = value;
                select.appendChild(optElem);
            }
        }

        typeOptionsDiv.appendChild(select);
    }

    optChange();
}

for (const mapTypeName of Object.keys(options)) {
    let optElem = document.createElement('option');
    optElem.text = mapTypeName;
    optElem.value = mapTypeName;
    typeSelect.appendChild(optElem);
}

// selects created and auto-select the first item, so do initial map creation now
typeSelect.onchange();

// comma and period to quickly move between last-level-options
document.onkeydown = (e) => {
    let sel = typeOptionsDiv.lastChild;
    const oldIdx = sel.selectedIndex;
    switch (e.keyCode) {
        case 188: // ,
            if (sel.selectedIndex == 0) {
                sel.selectedIndex = sel.length - 1;
            } else {
                sel.selectedIndex -= 1;
            }
            break;
        case 190: // .
            if (sel.selectedIndex == sel.length - 1) {
                sel.selectedIndex = 0;
            } else {
                sel.selectedIndex += 1;
            }
            break;
    }
    if (sel.selectedIndex != oldIdx) {
        sel.onchange();
    }
}

// force reload every 3 minutes
setInterval(optChange, 1000 * 60 * 3);
