importScripts('../js/xmljson.js','../js/citeproc.js');
var citeproc = null;
var lastStyleName = null;
var nextStyleName = null;
var itemTypeData = null;
var enableFields = null;
var legalTypes = null;
var selectedVars = {};
var unselectedVars = {};
var currentItemType = null;

var sampleData = null;

var abbreviations = {};

CSL.getAbbreviation = function (listname, obj, jurisdiction, category, key, itemType, noHints) {
    if (!obj || !key || !category) return;
    if (!obj.default) {
        obj["default"] = new CSL.AbbreviationSegments();
    }
    if (abbreviations[category]) {
        if (abbreviations[category][key]) {
            obj["default"][category][key] = abbreviations[category][key];
        } else {
            // Well, it doesn't work, but we tried. Setting to a non-match should revert abbrev.
            delete obj["default"][category][key];
        }
    }
}


//CSL.getSuppressJurisdictions = function () {
//    return {"US":"US"}
//}

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
Sys.prototype.retrieveStyleModule = function(){};
var sys = new Sys();

function cloneObject(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function makeItems(customFields) {
    var fieldBundle = itemTypeData[currentItemType]
    var item = {
        id: 'ITEM',
        type: fieldBundle.cslType
    }
    for (var key in selectedVars) {
        if (key === 'locator') continue;
        // No special treatment of creators needed anymore.
        if (customFields[key]) {
            item[key] = customFields[key];
        } else {
            item[key] = sampleData[key];
        }
    }
    processorElements.items['ITEM'] = item;

    var item = {
        id: 'DUMMY',
        type: 'book',
        title: 'Dummy Title'
    }
    processorElements.items['DUMMY'] = item;
    
    var locator = sampleData.locator;
    if (customFields.locator) {
        locator = customFields.locator;
    }
    return locator;
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

CitationFactory.prototype.addCitation = function(itemID, locator) {
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
    if (locator) {
        citation[0].citationItems[0].locator = locator;
    }
    this.citations.push(citation);
}

CitationFactory.prototype.getCitations = function() {
    var cres = [];
    for (var i=0,ilen=this.citations.length;i<ilen;i++) {
        var res = citeproc.processCitationCluster(this.citations[i][0], this.citations[i][1], this.citations[i][2]);
        for (var j=0,jlen=res[1].length;j<jlen;j++) {
            cres[res[1][j][0]] = res[1][j][1];
        }
    }
    return cres;
}


CitationFactory.prototype.reset = function() {
    this.citations = [];
}

function generateSample(customFields) {

    // Samples
    // * plain Full
    // * Full w/locator
    // * plain Ibid
    // * Ibid w/locator
    // * plain Supra
    // * Supra w/locator
    // * plain Far-note
    // * Far-note with locator

    var citations = {};
    var locator = makeItems(customFields);

    var citationFactory = new CitationFactory();
    citationFactory.addCitation('ITEM', null);
    citationFactory.addCitation('ITEM', locator);
    citationFactory.addCitation('DUMMY', null);
    citationFactory.addCitation('DUMMY', null);
    citationFactory.addCitation('DUMMY', null);
    citationFactory.addCitation('DUMMY', null);
    citationFactory.addCitation('DUMMY', null);
    citationFactory.addCitation('ITEM', null);
    var res = citationFactory.getCitations();
    citations['full-plain'] = res[0];
    citations['ibid-locator'] = res[1];
    citations['far-plain'] = res[7];

    citationFactory.reset();
    citationFactory.addCitation('ITEM', locator);
    citationFactory.addCitation('ITEM', locator);
    citationFactory.addCitation('DUMMY', null);
    citationFactory.addCitation('ITEM', null);
    citationFactory.addCitation('DUMMY', null);
    citationFactory.addCitation('ITEM', locator);
    citationFactory.addCitation('DUMMY', null);
    citationFactory.addCitation('DUMMY', null);
    citationFactory.addCitation('DUMMY', null);
    citationFactory.addCitation('DUMMY', null);
    citationFactory.addCitation('DUMMY', null);
    citationFactory.addCitation('ITEM', locator);
    var res = citationFactory.getCitations();
    citations['full-locator'] = res[0];
    citations['ibid-plain'] = res[1];
    citations['supra-plain'] = res[3];
    citations['supra-locator'] = res[5];
    citations['far-locator'] = res[11];

    citationFactory.reset();
    citationFactory.addCitation('ITEM', null);
    var bibliographyResults = citeproc.makeBibliography();
    return {citations:citations,bibliography:bibliographyResults[1]};
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
    var cslVarname;
    if (currentItemType === null) {
        itemTypeLabel = 'Case';
        currentItemType = itemTypeLabel;
        initVars = true;
    }
    if (itemTypeLabel && itemTypeLabel !== currentItemType) {
        initVars = true;
    }

    if (!Object.keys(selectedVars).length && !Object.keys(unselectedVars)) {
        // Safety catch. Shouldn't ever be needed.
        initVars = true;
    }
    if (itemTypeLabel) {
        currentItemType = itemTypeLabel;
    }

    var unselected = '';
    var selected = '';
    if (!sampleData) {
        sampleData = {};
        var fieldBundle = itemTypeData[currentItemType];
        fieldBundle.locatorField = {};
        fieldBundle.locatorField.locator = 'Locator';
        for (var cslVarname in fieldBundle.creators) {
            var fieldLabel = fieldBundle.creators[cslVarname];
            sampleData[cslVarname] = [{
                family: fieldLabel.replace(/\s+/g, '') + 'smith',
                given: fieldLabel.slice(0,3) + 'bert'
            }]
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
            //fieldLabel = fieldBundle.numericFields[cslVarname];
            if (cslVarname === 'collection-number') {
                sampleData[cslVarname] = "2000";
            } else {
                sampleData[cslVarname] = "" + count + count + count;
                count += 1;
            }
        }
        for (var cslVarname in fieldBundle.textFields) {
            fieldLabel = fieldBundle.textFields[cslVarname];
            sampleData[cslVarname] = fieldLabel;
        }
        for (var cslVarname in fieldBundle.locatorField) {
            fieldLabel = fieldBundle.locatorField[cslVarname];
            sampleData[cslVarname] = fieldLabel;
        }
    }

    var categoryLabels = ['Creator', 'Text', 'Number', 'Date', 'Locator'];

    // Unselected variables
    var fieldBundle = itemTypeData[currentItemType];
    var segments = ['creators','textFields','numericFields','dateFields','locatorField'];
    for (var i=0,ilen=segments.length-1;i<ilen;i++) {
        var segment = segments[i];
        unselected += '<div class="bubble-wrapper"><div class="small-faint-heading">' + categoryLabels[i] + '</div>';
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
        unselected += '</div>';
    }
    // Selected variables
    var categorySchemaName = ["name", "text", "number", "date", "locator"];
    for (var i=0,ilen=segments.length;i<ilen;i++) {
        var segment = segments[i];
        selected += '<div class="bubble-wrapper" value="' + categorySchemaName[i] + '"><div class="small-faint-heading">' + categoryLabels[i] + '</div>';
        for (var cslVarname in fieldBundle[segment]) {
            var fieldLabel = fieldBundle[segment][cslVarname];
            var defaultUsed = !excludeFields[cslVarname] && !(cslVarname === 'jurisdiction' && legalTypes.indexOf(itemTypeLabel) === -1);
            var useMe = initVars ? defaultUsed : selectedVars[cslVarname];
            if (useMe) {
                fieldLabel = fieldLabel.replace(" ", "&nbsp;", "g");
                var draggable = ' draggable';
                if (segment === 'locatorField') {
                    draggable = '';
                }
                var newHTML = '<button type="button" value="' + cslVarname
                    + '" class="btn btn-primary btn-sm sampler-button' + draggable + '" data-toggle="modal" data-target="#editCslVar">'
                    + fieldLabel
                    + ' </button>'

                selected += newHTML;
                selectedVars[cslVarname] = true;
            }
        }
        selected += '</div>';
    }
    initVars = false;
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
            nextStyleName = event.data.styleName;
            processorElements.style = event.data.style;
            outObj.pageInit = event.data.pageInit;
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
        console.log("XXX LOAD STYLE LOCALES");
        workerExec(function() {
            outObj.pageInit = event.data.pageInit;
            for (var locale in event.data.locales) {
                processorElements.locales[locale] = event.data.locales[locale];
            }
        }, 'STYLE LOCALES LOAD OK');
        break;
    case 'SETUP PROCESSOR':
        workerExec(function() {
            outObj.pageInit = event.data.pageInit;
            citeproc = new CSL.Engine(sys, processorElements.style);
        }, 'PROCESSOR OK');
        break;
    case 'INIT PAGE':
        workerExec(function() {
            abbreviations = event.data.customAbbrevs;
            // These are constants, initialize just once
            if (!itemTypeData) {
                itemTypeData = reverseMapping(event.data.itemTypeData);
                excludeFields = event.data.excludeFields;
                legalTypes = event.data.legalTypes;
            }
            // Is this test ever useful for anything?
            if (nextStyleName !== lastStyleName) {
                //unselectedVars = {};
                //selectedVars = {};
                lastStyleName = nextStyleName;
            }
            outObj.bubbles = getBubbles(event);
            var customFields = event.data.customFields;
            var result = generateSample(customFields);
            outObj.citations = result.citations;
            var bibliography = '';
            if (result.bibliography) {
                for (var i=0,ilen=result.bibliography.length;i<ilen;i++) {
                    var entry = result.bibliography[i];
                    bibliography += entry;
                }
            } else {
                bibliography += '<div class="csl-entry">(this style has no bibliography)</div>'
            }
            outObj.bibliography = bibliography;

            // Return enabled legal types if module has them
            var infoNode = citeproc.cslXml.getNodesByName(processorElements.style, 'info')[0];
            var lawModuleNode = citeproc.cslXml.getNodesByName(infoNode, 'law-module');
            lawModuleNode = lawModuleNode.length ? lawModuleNode[0] : null;
            // usedTypes is a space-delimited string list of CSL type names
            outObj.usedTypes = citeproc.cslXml.getAttributeValue(lawModuleNode, 'types');
        }, 'INIT PAGE OK');
        break;
    case 'CHANGE ITEM TYPE':
        workerExec(function() {
            abbreviations = event.data.customAbbrevs;
            sampleData = null;
            unselectedVars = {};
            selectedVars = {};
            outObj.bubbles = getBubbles(event, event.data.itemType, true);
            var customFields = event.data.customFields;
            var result = generateSample(customFields);
            outObj.citations = result.citations;
            var bibliography = '';
            if (result.bibliography) {
                for (var i=0,ilen=result.bibliography.length;i<ilen;i++) {
                    var entry = result.bibliography[i];
                    bibliography += entry;
                }
            } else {
                bibliography += '<div class="csl-entry">(this style has no bibliography)</div>'
            }
            outObj.bibliography = bibliography;
        }, 'CHANGE ITEM TYPE OK');
        break;
    case 'SELECT VARIABLE':
        workerExec(function() {
            abbreviations = event.data.customAbbrevs;
            var varName = event.data.selectedVarname;
            if (varName) {
                delete unselectedVars[varName];
                selectedVars[varName] = true;
            }
            outObj.bubbles = getBubbles(event);
            var customFields = event.data.customFields;
            var result = generateSample(customFields);
            outObj.citations = result.citations;
            outObj.bibliography = result.bibliography;
        }, 'SELECT VARIABLE OK');
        break;
    case 'UNSELECT VARIABLE':
        workerExec(function() {
            abbreviations = event.data.customAbbrevs;
            var varName = event.data.unselectedVarname;
            delete selectedVars[varName];
            unselectedVars[varName] = true;
            outObj.bubbles = getBubbles(event);
            var customFields = event.data.customFields;
            var result = generateSample(customFields);
            outObj.citations = result.citations;
            outObj.bibliography = result.bibliography;
        }, 'UNSELECT VARIABLE OK');
    }
}
