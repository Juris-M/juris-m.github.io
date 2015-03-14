importScripts('xmljson.js','citeproc.js');
var citeproc = null;
var itemTypeData = null;
var excludeFields = null;
var legalTypes = null;
var selectedVars = {};
var unselectedVars = {};
var currentItemType = 'Journal Article';

var sampleData = null;

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

function cloneObject(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function makeItems() {
    var fieldBundle = itemTypeData[currentItemType]
    var item = {
        id: 'ITEM-1',
        type: fieldBundle.cslType
    }
    for (var key in selectedVars) {
        if (itemTypeData[currentItemType].creators[key]) {
            item[key] = sampleData[key](1);
        } else {
            item[key] = sampleData[key];
        }
    }
    var baseTitle = '';
    if (item.title) {
        baseTitle = item.title;
        item.title = (baseTitle + '-A');
    }
    processorElements.items['ITEM-1'] = cloneObject(item);
    
    item = cloneObject(item);
    item.id = 'ITEM-2';
    if (item.title) {
        item.title = (baseTitle + '-B');
    }
    processorElements.items['ITEM-2'] = item;
    
    item = cloneObject(item);
    for (var key in selectedVars) {
        if (itemTypeData[currentItemType].creators[key]) {
            item[key] = sampleData[key](2);
        }
    }
    if (item.title) {
        item.title = (baseTitle + '-C');
    }
    processorElements.items['ITEM-3'] = item;
    
    item = cloneObject(item);
    for (var key in selectedVars) {
        if (itemTypeData[currentItemType].creators[key]) {
            item[key] = sampleData[key](10);
        }
    }
    if (item.title) {
        item.title = (baseTitle + '-D');
    }
    processorElements.items['ITEM-4'] = item;
}

var CitationFactory = function(){
    this.citations = [];
}

CitationFactory.prototype.getBreadCrumbs = function () {
    var ret = [];
    for (var i=0,ilen=this.citations.length;i<ilen;i++) {
        ret.push(["CITATION-"+(i+1),(i+1)]);
    }
    return ret;
}

CitationFactory.prototype.addCitation = function(itemID, label, locator) {
    var citation = [
        {
            "citationID": "CITATION-" + (this.citations.length + 1), 
            "citationItems": [
                {
                    "id": itemID
                }
            ], 
            "properties": {
                "noteIndex": (this.citations.length + 1)
            }
        }, 
        this.getBreadCrumbs(), 
        []
    ]
    if (label) {
        citation[0].citationItems[0].label = label;
    }
    if (locator) {
        citation[0].citationItems[0].locator = locator;
    }
    this.citations.push(citation);
}


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
    makeItems();
    var citationFactory = new CitationFactory();
    citationFactory.addCitation('ITEM-1', 'page', '11');
    citationFactory.addCitation('ITEM-2', 'paragraph', '22');
    citationFactory.addCitation('ITEM-2', 'section', '33');
    citationFactory.addCitation('ITEM-2', 'section', '33');
    citationFactory.addCitation('ITEM-1', 'chapter', '44');
    citationFactory.addCitation('ITEM-3', 'paragraph', '55');
    citationFactory.addCitation('ITEM-4', 'section', '66');
    citationFactory.addCitation('ITEM-2');
    var citationResults = [];
    var citations = citationFactory.citations;
    for (var i=0,ilen=citations.length;i<ilen;i++) {
        res = citeproc.processCitationCluster(citations[i][0], citations[i][1], citations[i][2]);
        for (var j=0,jlen=res[1].length;j<jlen;j++) {
            citationResults[res[1][j][0]] = '<li>' + res[1][j][1] + '</li>';
        }
    }
    var bibliographyResults = citeproc.makeBibliography();
    return {citations:citationResults,bibliography:bibliographyResults[1]};
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
        sampleData = {};
        var fieldBundle = itemTypeData[currentItemType];
        for (var cslVarname in fieldBundle.creators) {
            var fieldLabel = fieldBundle.creators[cslVarname];
            sampleData[cslVarname] = function(fieldLabel) {
                var ext = ['ay','bee','cee','dee','ee','ef','gee','aich','aie','jay','kay'];
                return function(num) {
                    var ret = [];
                    for (var i=0,ilen=num;i<ilen;i++) {
                        ret.push({
                            family: fieldLabel + ext[i],
                            given: fieldLabel.slice(0,3) + 'bert'
                        });
                    }
                    return ret;
                }
            }(fieldLabel);
        }
        var year = 1950;
        var month = 1;
        var day = 2;
        for (var cslVarname in fieldBundle.dateFields) {
            fieldLabel = fieldBundle.dateFields[cslVarname];
            sampleData[cslVarname] = {
                'date-parts':[
                    [year, month,day]
                ]
            }
            year += 3;
            month += 1;
            day += 3;
        }
        var count = 1;
        for (var cslVarname in fieldBundle.numericFields) {
            fieldLabel = fieldBundle.numericFields[cslVarname];
            sampleData[cslVarname] = "" + count + count + count;
            count += 1;
        }
        for (var cslVarname in fieldBundle.textFields) {
            fieldLabel = fieldBundle.textFields[cslVarname];
            sampleData[cslVarname] = fieldLabel;
        }
    }
    // Unselected variables
    var fieldBundle = itemTypeData[itemTypeLabel];
    var segments = ['creators','dateFields','numericFields','textFields'];
    for (var i=0,ilen=segments.length;i<ilen;i++) {
        var segment = segments[i];
        for (var cslVarname in fieldBundle[segment]) {
            var fieldLabel = fieldBundle[segment][cslVarname];
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
        for (var cslVarname in fieldBundle[segment]) {
            var fieldLabel = fieldBundle[segment][cslVarname];
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

function reverseMapping(origObj) {
    var newObj = {};
    for (var key in origObj) {
        newObj[key] = {};
        newObj[key].cslType = origObj[key].cslType;
        var segments = ["creators", "dateFields", "numericFields", "textFields"];
        for (var i=0,ilen=segments.length;i<ilen;i++) {
            var segment = segments[i];
            newObj[key][segment] = {};
            for (var kkey in origObj[key][segment]) {
                newObj[key][segment][origObj[key][segment][kkey]] = kkey;
            }
        }
    }
    return newObj;
}

onmessage = function (event) {
    switch (event.data.type) {
    case 'PING':
        workerExec(function() {}, 'PING OK');
        break;
    case 'LOAD STYLE AND SUBMIT LOCALES':
        workerExec(function() {
            sampleData = null;
            processorElements.style = event.data.style;
            outObj.locales = {};
            for (var locale in event.data.locales) {
                if (CSL.LANG_BASES[locale]) {
                    locale = CSL.LANG_BASES[locale];
                }
                outObj.locales[locale] = true;
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
    case 'INIT PAGE':
        workerExec(function() {
            unselectedVars = {};
            selectedVars = {};
            itemTypeData = reverseMapping(event.data.itemTypeData);
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

            var result = generateSample();

            outObj.html += '  </div>\n'
                + '  <div id="sampler-preview" class="col-lg-6">\n'
                + '    <div class="row"><div class="col-lg-12"><h3>Citations</h3></div></div>'
                + '    <div class="row">'
                + '      <div class="col-lg-12">'
                + '        <ol id="sampler-citations">';
            for (var i=0,ilen=result.citations.length;i<ilen;i++) {
                var citation = result.citations[i];
                outObj.html += citation;
            }
            outObj.html += '        </ol>'
                + '      </div>'
                + '    </div>'
                + '    <div class="row"><div class="col-lg-12"><h3>Bibliography</h3></div></div>'
                + '    <div class="row">'
                + '      <div id="sampler-bibliography" class="col-lg-12">'
            for (var i=0,ilen=result.bibliography.length;i<ilen;i++) {
                var entry = result.bibliography[i];
                outObj.html += entry;
            }

            outObj.html +=  '      </div>'
                + '    </div>'
                + '  </div>\n'
                + '</div>\n';
        }, 'INIT PAGE OK');
        break;
    case 'CHANGE ITEM TYPE':
        workerExec(function() {
            sampleData = null;
            unselectedVars = {};
            selectedVars = {};
            outObj.bubbles = getBubbles(event, event.data.itemType, true);
            outObj.result = generateSample();
        }, 'CHANGE ITEM TYPE OK');
        break;
    case 'SELECT VARIABLE':
        workerExec(function() {
            var varName = event.data.selectedVarname;
            delete unselectedVars[varName];
            selectedVars[varName] = true;
            outObj.bubbles = getBubbles(event);
            outObj.result = generateSample();
        }, 'SELECT VARIABLE OK');
        break;
    case 'UNSELECT VARIABLE':
        workerExec(function() {
            var varName = event.data.unselectedVarname;
            delete selectedVars[varName];
            unselectedVars[varName] = true;
            outObj.bubbles = getBubbles(event);
            outObj.result = generateSample();
        }, 'UNSELECT VARIABLE OK');
        break;
    }
}
