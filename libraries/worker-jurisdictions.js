var cache = {};

function composeSearch() {
}

function composePlainButton(key) {
}

function composeSplitButton(key) {
}

function unpackAndSend(key, json) {
    var data = JSON.parse(json);
    var outObj = {}
    for (var i=0,ilen=data.length;i<ilen;i++) {
        outObj[data[i][1]] = [data[i][0], data[i][2]];
    }
    outLst = Object.keys(outObj);
    outLst.sort();
    cache[key] = {
        type: 'REQUEST LIST OK',
        names: outLst,
        byName: outObj
    }
    postMessage(cache[key]);
}

function keyToPath(key) {
    if (!key) return '';
    return (key.split(':').join('/') + '/');
}

function requestList(key) {
    key = key ? key : '';
    if (cache[key]) {
        postMessage(cache[key]);
        return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '../jurisdictions/' + keyToPath(key) + 'info.json', true);
    xhr.setRequestHeader("Content-type","application/json");
    xhr.onload = function(e) {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                var json = xhr.responseText;
                unpackAndSend(key, json);
            } else {
                dump("XXX OOPS in worker xmlHttpRequest() " + xhr.statusText + "\n");
            }
        }
    }
    xhr.onerror = function (e) {
        dump("XXX OOPS in worker xmlHttpRequest() " + xhr.statusText + "\n");
    };
    xhr.send(null);
}

onmessage = function(event) {
    switch (event.data.type) {
    case 'REQUEST UI':
        requestList(event.data.key);
        break;
    }
}
