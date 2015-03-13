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

onmessage = function (event) {
    outObj = {};
    switch (event.data.type) {
    case 'PING':
        outObj.type = 'PING OK';
        postMessage(outObj);
        break;
    case 'LOAD STYLE AND SUBMIT LOCALES':
        processorElements.style = event.data.style;
        outObj.locales = {};
        for (var locale in event.data.locales) {
            if (CSL.LANG_BASES[locale]) {
                locale = CSL.LANG_BASES[locale];
            }
            outObj.locales[locale] = true;
        }
        outObj.type = 'STYLE OK LOCALES REQUESTED';
        postMessage(outObj);
        break;
    case 'LOAD STYLE LOCALES':
        for (var locale in event.data.locales) {
            processorElements.locales[locale] = event.data.locales[locale];
        }
        outObj.type = 'STYLE LOCALES LOAD OK';
        postMessage(outObj);
        break;
    case 'SETUP PROCESSOR':
        citeproc = CSL.Engine(sys, processorElements.style);
        outObj.type = 'PROCESSOR OK';
        postMessage(outObj);
        break;
    case 'LOAD ITEM':
        processorElement.item = event.data.itemObj;
        // Figure out locales required for item and include in response
        outObj.type = 'ITEM OK';
        postMessage(outObj);
        break;
    case 'RUN':
        outObj.type = 'RUN OK';
        outObj.result = generateSample();
        postMessage(outObj);
        break;
    }
}
