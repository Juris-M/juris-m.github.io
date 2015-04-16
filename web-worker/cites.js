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
    if (item["title-short"]) {
        baseShortTitle = item["title-short"];
        item["title-short"] = (baseShortTitle + '-A');
    }
    processorElements.items['ITEM-1'] = cloneObject(item);
    
    item = cloneObject(item);
    item.id = 'ITEM-2';
    if (item.title) {
        item.title = (baseTitle + '-B');
    }
    if (item["title-short"]) {
        item["title-short"] = (baseShortTitle + '-B');
    }
    processorElements.items['ITEM-2'] = item;
    
    item = cloneObject(item);
    item.id = 'ITEM-3';
    for (var key in selectedVars) {
        if (itemTypeData[currentItemType].creators[key]) {
            item[key] = sampleData[key](2);
        }
    }
    if (item.title) {
        item.title = (baseTitle + '-C');
    }
    if (item["title-short"]) {
        item["title-short"] = (baseShortTitle + '-C');
    }
    processorElements.items['ITEM-3'] = item;
    
    item = cloneObject(item);
    item.id = 'ITEM-4';
    for (var key in selectedVars) {
        if (itemTypeData[currentItemType].creators[key]) {
            item[key] = sampleData[key](10);
        }
    }
    if (item.title) {
        item.title = (baseTitle + '-D');
    }
    if (item["title-short"]) {
        item["title-short"] = (baseShortTitle + '-D');
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
    citationFactory.addCitation('ITEM-3', 'section', '33');
    citationFactory.addCitation('ITEM-4', 'chapter', '44');
    citationFactory.addCitation('ITEM-4', 'page', '11');
    citationFactory.addCitation('ITEM-4', 'section', '33');
    citationFactory.addCitation('ITEM-1', 'chapter', '44');
    citationFactory.addCitation('ITEM-3', 'paragraph', '22');
    citationFactory.addCitation('ITEM-4', 'section', '33');
    citationFactory.addCitation('ITEM-2');
    citationFactory.addCitation('ITEM-1', 'page', '11');
    citationFactory.addCitation('ITEM-1', 'paragraph', '22');
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
    }

    var categoryLabels = ['Creators', 'Dates', 'Numbers', 'Ordinary Text'];

    // Unselected variables
    var fieldBundle = itemTypeData[currentItemType];
    var segments = ['creators','dateFields','numericFields','textFields'];
    for (var i=0,ilen=segments.length;i<ilen;i++) {
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
    var categorySchemaName = ["name", "date", "number", "text"];
    for (var i=0,ilen=segments.length;i<ilen;i++) {
        var segment = segments[i];
        selected += '<div class="bubble-wrapper" value="' + categorySchemaName[i] + '"><div class="small-faint-heading">' + categoryLabels[i] + '</div>';
        for (var cslVarname in fieldBundle[segment]) {
            var fieldLabel = fieldBundle[segment][cslVarname];
            var defaultUsed = !excludeFields[cslVarname] && !(cslVarname === 'jurisdiction' && legalTypes.indexOf(itemTypeLabel) === -1);
            var useMe = initVars ? defaultUsed : selectedVars[cslVarname];
            if (useMe) {
                fieldLabel = fieldLabel.replace(" ", "&nbsp;", "g");
                // XXX Actually, tooltip isn't right - would want to show the value.
                // XXX But that's going to be cumbersome for names.
                // XXX Maybe enough to just make content editable.
                // XXX Names are a problem there too, though.
                
                // * Not sure if click will work on a draggable item ...
                // * Okay, click triggers on mouseup outside droppable. Need to control for that.
                // * The onclick event is lost when dragged out, then in. Needs to be reset
                //   on drag-in.
                // * Other than that, it looks okay.
                // * Event should save to localStorage on the window.
                // * Content delivered by the worker should be overwritten with
                //   any entries that exist in localStorage immediately after
                //   window-side listener picks up the HTML and sets it in the
                //   DOM.
                var newHTML = '<button type="button" value="' + cslVarname
                    + '" class="btn btn-primary btn-sm sampler-button draggable" data-toggle="modal" data-target="#editCslVar">'
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
            var result = generateSample();
            var citations = '';
            for (var i=0,ilen=result.citations.length;i<ilen;i++) {
                var citation = result.citations[i];
                citations += citation;
            }
            outObj.citations = citations;
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
            // Return enabled legal types of module has them
            var infoNode = sys.xml.getNodesByName(processorElements.style, 'info')[0];
            var lawModuleNode = sys.xml.getNodesByName(infoNode, 'law-module');
            lawModuleNode = lawModuleNode.length ? lawModuleNode[0] : null;
            // usedTypes is a space-delimited string list of CSL type names
            outObj.usedTypes = sys.xml.getAttributeValue(lawModuleNode, 'types');
        }, 'INIT PAGE OK');
        break;
    case 'CHANGE ITEM TYPE':
        workerExec(function() {
            sampleData = null;
            unselectedVars = {};
            selectedVars = {};
            outObj.bubbles = getBubbles(event, event.data.itemType, true);
            var result = generateSample();
            outObj.citations = result.citations;
            outObj.bibliography = result.bibliography;
        }, 'CHANGE ITEM TYPE OK');
        break;
    case 'SELECT VARIABLE':
        workerExec(function() {
            var varName = event.data.selectedVarname;
            delete unselectedVars[varName];
            selectedVars[varName] = true;
            outObj.bubbles = getBubbles(event);
            var result = generateSample();
            outObj.citations = result.citations;
            outObj.bibliography = result.bibliography;
        }, 'SELECT VARIABLE OK');
        break;
    case 'UNSELECT VARIABLE':
        workerExec(function() {
            var varName = event.data.unselectedVarname;
            delete selectedVars[varName];
            unselectedVars[varName] = true;
            outObj.bubbles = getBubbles(event);
            var result = generateSample();
            outObj.citations = result.citations;
            outObj.bibliography = result.bibliography;
        }, 'UNSELECT VARIABLE OK');
    }
}
