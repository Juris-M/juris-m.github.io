importScripts('xmljson.js','citeproc.js');
var citeproc = null;

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
    case 'RUN':
        workerExec(function() {
            this.outObj.result = generateSample();
        }, 'RUN OK');
        break;
    }
}
