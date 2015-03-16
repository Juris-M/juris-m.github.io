var cache = {};

function composeSearch() {
    dump("XXX composeSearch()\n");
    var outObj = {};
    outObj.html = '<input id="search-input" class="typeahead form-control" type="text" placeholder="Enter a country or institution">';
    outObj.type = 'SEARCH UI HTML OK';
    return outObj;
}

function composeSplitButton(key, json) {
    var data = unpackData(json);
    var outObj = {};
    // Whuuups. Need the parents of the key also. How to get that?
    var fullKey = key;
	var html = '<div id="search-input" value="' + fullKey + '" class="input-group-btn search-input-as-dropdown">'
        + '  <button id="search-input-button " type="button" class="btn btn-info">' + fullName + '</button>'
        + '  <button id="search-input-caret" type="button" class="btn btn-info dropdown-toggle" data-toggle="dropdown" aria-expanded="false">'
        + '    <span class="caret"></span></button>'
		+ '  <ul id="search-input-dropdown" class="dropdown-menu" role="menu">';

    for (var i=0,ilen=data.names.length;i<ilen;i++) {
        var name = data.names[i];
        var nameData = data.map[name];
        html += '<li><a value="' + nameData[0] + ':' + nameData[1] + '" href="#">' + name + '</a></li>'
    }
	html += '  </ul>'
        +  '</div>';
    outObj.html = html;
    outObj.type = 'BUTTON UI HTML OK';
}

function unpackData(json) {
    var data = JSON.parse(json);
    var nameMap = {}
    for (var i=0,ilen=data.length;i<ilen;i++) {
        nameMap[data[i][1]] = [data[i][0], data[i][2]];
    }
    names = Object.keys(nameMap);
    names.sort();
    return {
        map: nameMap,
        names: names
    };
}

function sendUI(key, json) {
    var data = unpackData(json)
    if (!key) {
        // Cache UI HTML for typeahead
        cache[key] = composeSearch();
        dump("XXX cached response for ["+key+"]\n");
        // If we reach this, we are initializing,
        // so send the data
        var outObj = unpackData(json);
        outObj.type = 'COUNTRY LIST INIT OK';
        postMessage(outObj);
    } else {
        cache[key] = composeSplitButton(key, json);
        postMessage(cache[key]);
    }
}

function keyToPath(key) {
    if (!key) return '';
    return (key.split(':').join('/') + '/');
}

function requestUI(key) {
    key = key ? key : '';
    if (cache[key]) {
        dump("XXX SENDING CACHED RESPONSE FOR ["+key+"] :" + JSON.stringify(cache[key]) + "\n");
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
                dump("XXX SEND UI\n");
                sendUI(key, json);
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
        dump("XXX REQUEST UI\n");
        requestUI(event.data.key);
        break;
    }
}
