
importScripts('field-maps.js');

var jurisM = {}
for (i in fieldMaps["Juris-M"]) {
    var itemType = fieldMaps["Juris-M"][i];
    jurisM[itemType[0]] = {}
    jurisM[itemType[0]].cslType = fieldMaps.strings[itemType[1]]
    jurisM[itemType[0]].creators = {}
    jurisM[itemType[0]].dateFields = {}
    jurisM[itemType[0]].numericFields = {}
    jurisM[itemType[0]].textFields = {}
    for (var j in itemType[2]) {
        var fieldPosPair = itemType[2][j];
        jurisM[itemType[0]].creators[fieldMaps.strings[fieldPosPair[0]]] = fieldMaps.strings[fieldPosPair[1]]
    }
    for (var j in itemType[3]) {
        var fieldPosPair = itemType[3][j];
        jurisM[itemType[0]].dateFields[fieldMaps.strings[fieldPosPair[0]]] = fieldMaps.strings[fieldPosPair[1]]
    }
    for (var j in itemType[4]) {
        var fieldPosPair = itemType[4][j];
        jurisM[itemType[0]].numericFields[fieldMaps.strings[fieldPosPair[0]]] = fieldMaps.strings[fieldPosPair[1]]
    }
    for (var j in itemType[5]) {
        var fieldPosPair = itemType[5][j];
        jurisM[itemType[0]].textFields[fieldMaps.strings[fieldPosPair[0]]] = fieldMaps.strings[fieldPosPair[1]]
    }
}

function workerExec(func, msg) {
    var outObj = {};
    var me = this;
    return function (me) {
        me.outObj = outObj;
        try {
            func.call(me);
            outObj.type = msg;
        } catch (e) {
            outObj.type = 'ERROR';
            outObj.error = "" + e;
        }
        postMessage(outObj);
    }(me);
}

onmessage = function(event) {
    switch(event.data.type) {
    case 'GET MENU ITEMS':
        workerExec(function() {
            outObj.html = '';
            var labels = Object.keys(jurisM);
            labels.sort();
            for (var i=0,ilen=labels.length;i<ilen;i++) {
                var label = labels[i];
                outObj.html += '<li><a href="#" onclick="CSLValidator.setView(event,\'fields\',\'' + label + '\')">' + label + '</a></li>\n';
            }
        }, 'GET MENU ITEMS OK');
        break;
    case 'GET PAGE':
        workerExec(function() {
            outObj.html = '';
            var pageName = event.data.pageName;
            var pageData = jurisM[pageName];
            //Header (Juris-M name)
            outObj.html += '<div class="row">\n';
            outObj.html += '  <div class="col-lg-12"><h2>' + pageName + ' (' + jurisM[pageName].cslType + ')</h2></div>\n';
            outObj.html += '</div>\n';
            //Categories: Names, Text Fields, Numeric Fields
            //Subheadings: Label, Field Name
            outObj.html += '  <div class="col-lg-3 field-map-data">\n'
            outObj.html += '    <div class="row field-header"><div class="col-lg-12"><h3>Names</h3></div></div>\n';
            outObj.html += '    <div class="row field-header">\n';
            outObj.html += '      <div class="col-xs-6"><h4>Label</h4></div>\n';
            outObj.html += '      <div class="col-xs-6"><h4>Field Name</h4></div>\n';
            outObj.html += '    </div>';
            // Names
            var names = Object.keys(pageData.creators);
            names.sort();
            for (var i=0,ilen=names.length;i<ilen;i++) {
                var name = names[i];
                var cslVar = pageData.creators[name];
                outObj.html += '    <div class="row">';
                outObj.html += '      <div class="col-xs-6 field-label">' + name + '</div>\n';
                outObj.html += '      <div class="col-xs-6 field-csl">' + cslVar + '</div>\n';
                outObj.html += '    </div>\n';
            }
            outObj.html += '  </div>';
            outObj.html += '  <div class="col-lg-3 field-map-data">\n'
            outObj.html += '    <div class="row field-header"><div class="col-lg-12"><h3>Dates</h3></div></div>\n';
            outObj.html += '    <div class="row field-header">\n';
            outObj.html += '      <div class="col-xs-6"><h4>Label</h4></div>\n';
            outObj.html += '      <div class="col-xs-6"><h4>Field Name</h4></div>\n';
            outObj.html += '    </div>';
            // Dates
            var dates = Object.keys(pageData.dateFields);
            dates.sort();
            for (var i=0,ilen=dates.length;i<ilen;i++) {
                var date = dates[i];
                var cslVar = pageData.dateFields[date];
                outObj.html += '    <div class="row">';
                outObj.html += '      <div class="col-xs-6 field-label">' + date + '</div>\n';
                outObj.html += '      <div class="col-xs-6 field-csl">' + cslVar + '</div>\n';
                outObj.html += '    </div>\n';
            }
            outObj.html += '  </div>';
            outObj.html += '  <div class="col-lg-3 field-map-data">\n'
            outObj.html += '    <div class="row field-header"><div class="col-lg-12"><h3>Numeric</h3></div></div>\n';
            outObj.html += '    <div class="row field-header">\n';
            outObj.html += '      <div class="col-xs-6"><h4>Label</h4></div>\n';
            outObj.html += '      <div class="col-xs-6"><h4>Field Name</h4></div>\n';
            outObj.html += '    </div>';
            // Numeric
            var numbers = Object.keys(pageData.numericFields);
            numbers.sort();
            for (var i=0,ilen=numbers.length;i<ilen;i++) {
                var number = numbers[i];
                var cslVar = pageData.numericFields[number];
                outObj.html += '    <div class="row">';
                outObj.html += '      <div class="col-xs-6 field-label">' + number + '</div>\n';
                outObj.html += '      <div class="col-xs-6 field-csl">' + cslVar + '</div>\n';
                outObj.html += '    </div>\n';
            }
            outObj.html += '  </div>';
            outObj.html += '  <div class="col-lg-3 field-map-data">\n'
            outObj.html += '    <div class="row field-header"><div class="col-lg-12"><h3>Text</h3></div></div>\n';
            outObj.html += '    <div class="row field-header">\n';
            outObj.html += '      <div class="col-xs-6"><h4>Label</h4></div>\n';
            outObj.html += '      <div class="col-xs-6"><h4>Field Name</h4></div>\n';
            outObj.html += '    </div>';
            // Text
            var texts = Object.keys(pageData.textFields);
            texts.sort();
            for (var i=0,ilen=texts.length;i<ilen;i++) {
                var text = texts[i];
                var cslVar = pageData.textFields[text];
                outObj.html += '    <div class="row">';
                outObj.html += '      <div class="col-xs-6 field-label">' + text + '</div>\n';
                outObj.html += '      <div class="col-xs-6 field-csl">' + cslVar + '</div>\n';
                outObj.html += '    </div>\n';
            }
            outObj.html += '  </div>';
        }, 'GET PAGE OK');
        break;
    }
}
