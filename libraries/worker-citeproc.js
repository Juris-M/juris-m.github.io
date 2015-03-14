importScripts('xmljson.js','citeproc.js');
var citeproc = null;
var itemTypeData = null;
var excludeFields = null;
var legalTypes = null;

var processorElements = {
    style: null,
    locales: {},
    item: null
}

var Sys = function(){};
Sys.prototype.retrieveItem = function(id){
    return processorElements.item;
};
Sys.prototype.retrieveLocale = function(lang){
    return processorElements.locales[lang];
};
var sys = new Sys();

function generateSample() {
    var item = processorElements.item;
    
};

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

function getBubbles(event, itemTypeLabel) {
    var unselected = '';
    var selected = '';
    // Unselected variables
    var fieldBundle = itemTypeData[itemTypeLabel];
    var segments = ['creators','dateFields','numericFields','textFields'];
    for (var i=0,ilen=segments.length;i<ilen;i++) {
        var segment = segments[i];
        for (var fieldLabel in fieldBundle[segment]) {
            var cslVarname = fieldBundle[segment][fieldLabel];
            if (excludeFields[cslVarname] || (cslVarname === 'jurisdiction' && legalTypes.indexOf(itemTypeLabel) === -1)) {
                fieldLabel = fieldLabel.replace(" ", "&nbsp;", "g");
                unselected += '<span class="sampler-bubble draggable" value="' + cslVarname + '">' + fieldLabel + ' </span> ';
            }
        }
    }
    // Selected variables
    for (var i=0,ilen=segments.length;i<ilen;i++) {
        var segment = segments[i];
        for (var fieldLabel in fieldBundle[segment]) {
            var cslVarname = fieldBundle[segment][fieldLabel];
            if (!excludeFields[cslVarname] && !(cslVarname === 'jurisdiction' && legalTypes.indexOf(itemTypeLabel) === -1)) {
                fieldLabel = fieldLabel.replace(" ", "&nbsp;", "g");
                selected += '<span class="sampler-bubble draggable" value="' + cslVarname + '">' + fieldLabel + ' </span> ';
            }
        }
    }
    return [unselected, selected];
}

onmessage = function (event) {
    switch (event.data.type) {
    case 'PING':
        workerExec(function() {}, 'PING OK');
        break;
    case 'LOAD STYLE AND SUBMIT LOCALES':
        workerExec(function() {
            processorElements.style = event.data.style;
            this.outObj.locales = {};
            for (var locale in event.data.locales) {
                if (CSL.LANG_BASES[locale]) {
                    locale = CSL.LANG_BASES[locale];
                }
                this.outObj.locales[locale] = true;
            }
        }, 'STYLE OK LOCALES REQUESTED');
        break;
    case 'LOAD STYLE LOCALES':
        workerExec(function() {
            for (var locale in event.data.locales) {
                processorElements.locales[locale] = event.data.locales[locale];
            }
        }, 'STYLE LOCALES LOAD OK');
        break;
    case 'SETUP PROCESSOR':
        workerExec(function() {
            citeproc = new CSL.Engine(sys, processorElements.style);
        }, 'PROCESSOR OK');
        break;
    case 'LOAD ITEM':
        workerExec(function() {
            processorElement.item = event.data.itemObj;
            // Figure out locales required for item and include in response
        }, 'ITEM OK');
        break;
    case 'INIT PAGE':
        workerExec(function() {
            itemTypeData = event.data.itemTypeData;
            excludeFields = event.data.excludeFields;
            legalTypes = event.data.legalTypes;
            outObj.html = '';
            outObj.html += '<div class="row">\n'
                + '  <div class="col-lg-6">\n'
                + '    <div class="btn-group">\n'
                + '      <button id="sampler-itemtype-button" type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-expanded="false">\n'
                + '        Journal Article <span class="caret"></span>\n'
                + '      </button>\n'
                + '      <ul id="sampler-itemtype-dropdown" class="dropdown-menu" role="menu" onclick="$(\'#sampler-itemtype-button\').html(event.originalTarget.textContent + \' <span class=&quot;caret&quot;></span>\');CSLValidator.changeSamplerItemType(event);">\n';
            // Item types menu
            for (var i=0,ilen=event.data.itemTypes.length;i<ilen;i++) {
                outObj.html += '        <li><a href="#">' + event.data.itemTypes[i] + '</a></li>\n';
            }
            outObj.html += '      </ul>\n'
                + '    </div>\n';
            outObj.html += '    <div class="row">'
                + '      <div id="unselected-csl-variables" class="col-lg-6 droppable">';
            var bubbles = getBubbles(event, 'Journal Article');
            outObj.html += bubbles[0];
            outObj.html += '      </div>'
                + '      <div id="selected-csl-variables" class="col-lg-6 droppable">';
            outObj.html += bubbles[1];
            outObj.html += '      </div>'
                + '    </div>';
            outObj.html += '  </div>\n'
                + '  <div class="col-lg-6">\n'
                + '  </div>\n'
                + '</div>\n';
            //this.outObj.result = generateSample();
        }, 'INIT PAGE OK');
        break;
    case 'CHANGE ITEM TYPE':
        workerExec(function() {
            outObj.bubbles = getBubbles(event, event.data.itemType);
        }, 'CHANGE ITEM TYPE OK');
        break;
    }
}
