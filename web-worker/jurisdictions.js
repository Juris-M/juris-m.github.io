var cache = {};

function composeSearch() {
    var outObj = {};
    outObj.html = '<input id="search-input" class="typeahead form-control" type="text" placeholder="Enter a country or institution">';
    outObj.type = 'SEARCH UI HTML OK';
    return outObj;
}

function composeSplitButton(key, name, json) {
    var data = unpackData(json);
    var outObj = {};
    var lst = key.split(':');
    var prefix = '';
    if (lst.length > 1) {
        var prefix = lst.slice(0,-1);
        prefix = (prefix.join(', ') + ', ').toUpperCase();
    }
	var html = '<div id="search-input" value="' + key + '" class="input-group-btn search-input-as-dropdown">'
        + '  <button id="search-input-button" type="button" class="btn btn-info">' + prefix + name + '</button>'
        + '  <button id="search-input-caret" type="button" class="btn btn-info dropdown-toggle" data-toggle="dropdown" aria-expanded="false">'
        + '    <span class="caret"></span></button>'
		+ '  <ul id="search-input-dropdown" class="dropdown-menu" role="menu">';

    for (var i=0,ilen=data.names.length;i<ilen;i++) {
        var name = data.names[i];
        var nameData = data.map[name];
        html += '<li><a value="' + nameData[0] + '::' + nameData[1] + '" href="#">' + name + '</a></li>'
    }
	html += '  </ul>'
        +  '</div>';
    outObj.html = html;
    outObj.type = 'BUTTON UI HTML OK';
    return outObj;
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

function sendUI(key, name, json) {
    var data = unpackData(json)
    if (!key) {
        // Cache UI HTML for typeahead
        cache[key] = composeSearch();
        // If we reach this, we are initializing,
        // so send the data
        var outObj = unpackData(json);
        outObj.type = 'COUNTRY LIST INIT OK';
        postMessage(outObj);
    } else {
        cache[key] = composeSplitButton(key, name, json);
        postMessage(cache[key]);
    }
}

function keyToPath(key) {
    if (!key) return '';
    return (key.split(':').join('/') + '/');
}

function requestUI(key, name) {
    key = key ? key : '';
    if (cache[key]) {
        postMessage(cache[key]);
        return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '../src/jurisdictions/' + keyToPath(key) + 'info.json', true);
    xhr.setRequestHeader("Content-type","application/json");
    xhr.onload = function(e) {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                var json = xhr.responseText;
                sendUI(key, name, json);
            } else {
                dump("XXX OOPS in jurisdictions worker requestUI(1): " + xhr.statusText + "\n");
            }
        }
    }
    xhr.onerror = function (e) {
        dump("XXX OOPS in jurisdictions worker requestUI(2): " + xhr.statusText + "\n");
    };
    xhr.send(null);
}

function requestModuleTemplate(key, name) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '../src/templates/module.csl', true);
    xhr.setRequestHeader("Content-type","text/xml");
    xhr.onload = function(e) {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                var src = xhr.responseText;
                sendTemplate(key, name, src);
            } else {
                dump("XXX OOPS in jurisdictions worker requestModuleTemplate(1): " + xhr.statusText + "\n");
            }
        }
    }
    xhr.onerror = function (e) {
        dump("XXX OOPS in jurisdictions worker requestModuleTemplate(2): " + xhr.statusText + "\n");
    };
    xhr.send(null);
}

function sendTemplate(key, name, src) {
    src = src.replace('@@KEY@@', key, 'g');
    src = src.replace('@@NAME@@', name, 'g');
    postMessage({type:'REQUEST MODULE TEMPLATE OK',src});
}

onmessage = function(event) {
    switch (event.data.type) {
    case 'REQUEST UI':
        requestUI(event.data.key, event.data.name);
        break;
    case 'REQUEST MODULE TEMPLATE':
        requestModuleTemplate(event.data.key, event.data.name);
        break;
    }
}