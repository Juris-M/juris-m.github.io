
importScripts('field-maps.js');

var jurisM = {}
for (i in fieldMaps["Juris-M"]) {
    var itemType = fieldMaps["Juris-M"][i];
    jurisM[itemType[0]] = {}
    jurisM[itemType[0]].cslType = fieldMaps.strings[itemType[1]]
    jurisM[itemType[0]].fields = {}
    jurisM[itemType[0]].creators = {}
    for (var j in itemType[2]) {
        var fieldPosPair = itemType[2][j];
        jurisM[itemType[0]].creators[fieldMaps.strings[fieldPosPair[0]]] = fieldMaps.strings[fieldPosPair[1]]
    }
    for (var j in itemType[3]) {
        var fieldPosPair = itemType[3][j];
        jurisM[itemType[0]].fields[fieldMaps.strings[fieldPosPair[0]]] = fieldMaps.strings[fieldPosPair[1]]
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
    case 'PING':
        workerExec(function() {}, 'PING OK');
        break;
    }
}
