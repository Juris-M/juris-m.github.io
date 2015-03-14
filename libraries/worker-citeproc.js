importScripts('xmljson.js','citeproc.js');
var citeproc = null;
var itemTypeData = null;
var excludeFields = null;
var legalTypes = null;
var selectedVars = {};
var unselectedVars = {};
var currentItemType = 'Journal Article';

var sampleData = {};

var processorElements = {
    style: null,
    locales: {},
    items: {}
}

var Sys = function(){};
Sys.prototype.retrieveItem = function(id){
    return processorElements.items[id];
};
Sys.prototype.retrieveLocale = function(lang){
    return processorElements.locales[lang];
};
var sys = new Sys();

function generateSample() {
    // Samples
    // * One author, plain title
    // * Same author, differing title, with locator
    // * id to previous with locator
    // * id to previous with same locator (and so id)
    // * backref to first (supra w/in 5)
    // * Third ref with two authors
    // * Fourth ref with ten authors
    // * id without locator (and so supra beyond 5)
    var fieldBundle = itemTypeData[currentItemType]
    var item = {
        id: 'Item-1',
        type: fieldBundle.cslType
    }
    for (var key in selectedVars) {
        item[key] = JSON.parse(JSON.stringify(sampleData[key]));
    }
    processorElement.items['Item-1'] = item;
    
    item2 = JSON.parse(JSON.stringify(item));
    item2.id = 'Item-2';
    if (item2.title) {
        item2.title += '-A';
    }
    processorElement.items['Item-2'] = item2;
    
    item3 = JSON.parse(JSON.stringify(item));
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

function getBubbles(event, itemTypeLabel, initVars) {
    var cslVarname;
    if (!itemTypeLabel) {
        itemTypeLabel = currentItemType;
    } else {
        currentItemType = itemTypeLabel;
    }
    var unselected = '';
    var selected = '';
    if (!sampleData) {
        for (var fieldLabel in fieldBundle.creators) {
            var cslVarname = fieldBundle.creators[fieldLabel];
            sampleData[cslVarname] = {
                family: fieldLabel,
                given: fieldLabel.slice(0,3) + 'bert'
            }
        }
        var year = 1950;
        var month = 1;
        var day = 2;
        for (var fieldLabel in fieldBundle.dateFields) {
            cslVarname = fieldBundle.dateFields[fieldLabel];
            sampleData[cslVarname] = {
                'date-parts':[
                    [year, month,day]
                ]
            }
            year += 3;
            month += 1;
            day += 3;
        }
        for (var fieldLabel in fieldBundle.numericFields) {
            cslVarname = fieldBundle.dateFields[fieldLabel];
            var count = 1;
            sampleData[cslVarname] = "" + count + count + count;
            count += 1;
        }
        for (var fieldLabel in fieldBundle.textFields) {
            cslVarname = fieldBundle.dateFields[fieldLabel];
            sampleData[cslVarname] = fieldLabel;
        }
    }
    // Unselected variables
    var fieldBundle = itemTypeData[itemTypeLabel];
    var segments = ['creators','dateFields','numericFields','textFields'];
    for (var i=0,ilen=segments.length;i<ilen;i++) {
        var segment = segments[i];
        for (var fieldLabel in fieldBundle[segment]) {
            var cslVarname = fieldBundle[segment][fieldLabel];
            var defaultUnused = excludeFields[cslVarname] || (cslVarname === 'jurisdiction' && legalTypes.indexOf(itemTypeLabel) === -1);
            var useMe = initVars ? defaultUnused : unselectedVars[cslVarname];
            if (useMe) {
                fieldLabel = fieldLabel.replace(" ", "&nbsp;", "g");
                unselected += '<span class="sampler-bubble draggable" value="' + cslVarname + '">' + fieldLabel + ' </span> ';
                unselectedVars[cslVarname] = true;
            }
        }
    }
    // Selected variables
    for (var i=0,ilen=segments.length;i<ilen;i++) {
        var segment = segments[i];
        for (var fieldLabel in fieldBundle[segment]) {
            var cslVarname = fieldBundle[segment][fieldLabel];
            var defaultUsed = !excludeFields[cslVarname] && !(cslVarname === 'jurisdiction' && legalTypes.indexOf(itemTypeLabel) === -1);
            var useMe = initVars ? defaultUsed : selectedVars[cslVarname];
            if (useMe) {
                fieldLabel = fieldLabel.replace(" ", "&nbsp;", "g");
                selected += '<span class="sampler-bubble draggable" value="' + cslVarname + '">' + fieldLabel + ' </span> ';
                selectedVars[cslVarname] = true;
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
            unselectedVars = {};
            selectedVars = {};
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
            var bubbles = getBubbles(event, 'Journal Article', true);
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
            unselectedVars = {};
            selectedVars = {};
            outObj.bubbles = getBubbles(event, event.data.itemType, true);
        }, 'CHANGE ITEM TYPE OK');
        break;
    case 'SELECT VARIABLE':
        workerExec(function() {
            var varName = event.data.selectedVarname;
            delete unselectedVars[varName];
            selectedVars[varName] = true;
            outObj.bubbles = getBubbles(event);
        }, 'SELECT VARIABLE OK');
        break;
    case 'UNSELECT VARIABLE':
        workerExec(function() {
            var varName = event.data.unselectedVarname;
            delete selectedVars[varName];
            unselectedVars[varName] = true;
            outObj.bubbles = getBubbles(event);
        }, 'UNSELECT VARIABLE OK');
        break;
    }
}
