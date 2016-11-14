var CSLValidator = (function() {

    //to access Ace
    var editor;

    //to access the GitHub API library object
    var gh;

    //to track current itemType set in Sampler
    var itemTypeName = 'legal_case';
    var itemTypeLabel = 'Case';
    var itemTypeMap = {};

    var citationForms = [
        'full-plain',
        'full-locator',
        'ibid-plain',
        'ibid-locator',
        'supra-plain',
        'supra-locator',
        'far-plain',
        'far-locator'
    ];

    //to convert item type labels to CSL variable names
    var itemTypeData;

    //to access URL parameters
    var uri;

    //required for highlighting in ace editor
    var Range;

    //keep track of source code highlighting, so we can remove prior highlighting
    //when selecting a different error
    var marker;

    var loadButton;
    var validateButton;
    var saveButton;
    var submitButton;

    //keep track of how much time validator.nu is taking
    var responseTimer;
    var responseMaxTime = 10000; //in milliseconds
    var responseStartTime;
    var responseEndTime;

    //cache for editor content and errors
    var pageCache = {};

    //Empty editor
    var emptyAceDoc;

    //Schema state labels
    var schemaLabel = {
        '1.1mlz1': 'Juris-M',
        '1.0.1': 'CSL 1.0.1',
        '1.0': 'CSL 1.0',
        '0.8.1': 'CSL 0.8.1'
    }

    function parseXML (xmlStr) {
        if (window.DOMParser) {
            var parser=new DOMParser();
            xmlDoc=parser.parseFromString(xmlStr,"text/xml");
        } else { // code for IE
            var xmlDoc=new ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async=false;
            xmlDoc.loadXML(xmlStr);
        }
        return xmlDoc;
    }
    
    var JSONWalker = function() {
        this.locales = {
            'en-US': true
        };
    }

    JSONWalker.prototype.walkStyleToObj = function(doc) {
        var elem = doc.getElementsByTagName('style')[0];
        var defaultLocale = elem.getAttribute('default-locale');
        if (defaultLocale) {
            this.locales[defaultLocale] = true;
        }
        var obj = this.walkToObject(elem, true);
        return {
            obj: obj,
            locales: this.locales
        }
    }

    JSONWalker.prototype.walkLocaleToObj = function(doc) {
        var elem = doc.getElementsByTagName('locale')[0];
        var obj = this.walkToObject(elem);
        return obj;
    }

    JSONWalker.prototype.walkToObject = function(elem, isStyle) {
        var obj = {};
        obj.name = elem.nodeName;
        obj.attrs = {};
        if (elem.attributes) {
            for (var i=0,ilen=elem.attributes.length;i<ilen;i++) {
                var attr = elem.attributes[i];
                obj.attrs[attr.name] = attr.value;
                if (isStyle && attr.name === 'locale') {
                    var locale = attr.value.split(/\s+/)[0];
                    this.locales[locale] = true;
                }
            }
        }
        obj.children = [];
        if (elem.childNodes.length === 0 && elem.tagName === 'term') {
            obj.children = [''];
        }
        for (var i=0,ilen=elem.childNodes.length;i<ilen;i++) {
            var child = elem.childNodes[i];
            if (child.nodeName === '#comment') {
                continue;
            } else if (child.nodeName === '#text') {
                if (elem.childNodes.length === 1 && ['term', 'single', 'multiple'].indexOf(elem.nodeName) > -1) {
                    obj.children.push(child.textContent)
                }
            } else {
                obj.children.push(this.walkToObject(child, isStyle));
            }
        }
        return obj;
    }
    jsonWalker = new JSONWalker();

    var menuWorker = new Worker('../web-worker/menu.js');
    menuWorker.onmessage = function(event) {
        switch (event.data.type) {
        case 'GET MENU ITEMS OK':
            $('#field-map-menu-container').html(event.data.html);
            break;
        case 'GET PAGE OK':
            $('#fields-view').html(event.data.html);
            break;
        case 'INIT SAMPLER PAGE OK':
            itemTypeData = event.data.itemTypeData;
            // Item types menu
            $('#sampler-itemtype-dropdown').empty();
            var menuItems = '';
            for (var i=0,ilen=event.data.itemTypes.length;i<ilen;i++) {
                var legalTypes = event.data.legalTypes;
                var itemTypeLabel = event.data.itemTypes[i];
                // The id is used to disable item types not covered by a module
                var id = event.data.itemTypeData[itemTypeLabel].cslType;
                // XXX Really should not need this.
                itemTypeMap[id] = itemTypeLabel;
                if (legalTypes.indexOf(itemTypeLabel) > -1) {
                    menuItems += '<li><a id="' + id + '" class="legal-type" href="#">' + itemTypeLabel + '</a></li>';
                } else {
                    menuItems += '<li><a id="' + id + '" class="non-legal-type" href="#">' + event.data.itemTypes[i] + '</a></li>';
                }
            }
            $('#sampler-itemtype-dropdown').html(menuItems);
            if (getSourceMethod() == 'search') {
                $('a.non-legal-type').hide();
            } else {
                $('a.non-legal-type').show();
            }
            citeprocWorker.postMessage({
                type: 'INIT PAGE',
                excludeFields: event.data.excludeFields,
                legalTypes: event.data.legalTypes,
                itemTypeData: event.data.itemTypeData,
                customFields: getCustomFields(),
                customAbbrevs: getCustomAbbrevs()
            });
            break;
        }
    }

    // XXX Needs getCustomAbbrevs()
    function getCustomAbbrevs() {
        var abbrevs = {};
        var itemTypeLabel = $('#sampler-itemtype-button').text().trim();
        $('#csl-abbrevs button').each(function(index){
            var segment = $(this).val();
            var key = itemTypeLabel + '::' + segment + '::abbrev';
            var abbrev = localStorage.getItem(key);
            if (abbrev) {
                try {
                    var obj = JSON.parse(abbrev);
                    abbrevs[segment] = {}
                    abbrevs[segment][obj.val] = obj.abbr;
                } catch (e) {}
            }
        });
        return abbrevs;
    }

    function getCustomFields() {
        var ret = {};
        var segments = ['creators','textFields','numericFields','dateFields','locatorField'];
        var itemTypeLabel = $('#sampler-itemtype-button').text().trim();
        for (var i=0,ilen=segments.length;i<ilen;i++) {
            var segment = segments[i];
            for (var label in itemTypeData[itemTypeLabel][segment]) {
                var cslVarname = itemTypeData[itemTypeLabel][segment][label];
                var key = itemTypeLabel + "::" + cslVarname;
                var val = localStorage.getItem(key);
                if (val) {
                    try {
                        ret[cslVarname] = JSON.parse(val);
                    } catch (e) {}
                }
                if (segment === "creators" && ret[cslVarname]) {
                    // drop unused names
                    var oldarr = ret[cslVarname];
                    var newarr = [];
                    for (var j=0,jlen=oldarr.length;j<jlen;j++) {
                        if (oldarr[j] && oldarr[j].checked) {
                            newarr.push(oldarr[j]);
                        }
                    }
                    ret[cslVarname] = newarr;
                }
            }
            var locator = localStorage.getItem(itemTypeLabel + '::locator');
            if (locator) {
                try {
                    ret.locator = JSON.parse(locator);
                } catch (e) {
                    ret.locator = null;
                }
            }
        }
        return ret;
    }
    
    var countries = null;
    var countriesMap = null;

    var jurisdictionWorker = new Worker('../web-worker/jurisdictions.js');
    jurisdictionWorker.onmessage = function(event) {
        var inObj = event.data;
        switch (inObj.type) {
        case 'COUNTRY LIST INIT OK':
            countries = inObj.names;
            countriesMap = inObj.map;
            var countriesIdx = new Bloodhound({
                datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
                queryTokenizer: Bloodhound.tokenizers.whitespace,
                limit: 10,
                // `states` is an array of state names defined in "The Basics"
                local: $.map(countries, function(country) { return { value: country }; })
            }); 
            countriesIdx.initialize();
            $('#search-input.typeahead').typeahead(null, {
                name: 'countries',
                displayKey: 'value',
                source: countriesIdx.ttAdapter()
            });
            //Set jurisdiction button if there is a lurking value
            if ($('#search-input').typeahead('val')) {
                var name = $('#search-input').typeahead('val');
                var info = countriesMap[name];
                if (info && info[1]) {
                    jurisdictionWorker.postMessage({type:'REQUEST UI',key:info[0],name:name});
                } else {
                    $('#search-input').typeahead('val', '');
                }
            }
            break;
        case 'SEARCH UI HTML OK':
            $('#search-source').html(event.data.html);
            var countriesIdx = new Bloodhound({
                datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
                queryTokenizer: Bloodhound.tokenizers.whitespace,
                limit: 10,
                // `states` is an array of state names defined in "The Basics"
                local: $.map(countries, function(country) { return { value: country }; })
            }); 
            countriesIdx.initialize();
            $('#search-input.typeahead').typeahead(null, {
                name: 'countries',
                displayKey: 'value',
                source: countriesIdx.ttAdapter()
            });
            setTypeaheadListener();
            break;
        case 'BUTTON UI HTML OK':
            $('#search-source').html(event.data.html);
            $('#search-input').on('click', function(event) {
                var target = $(event.target);
                if (target.is('A')) {
                    var info = target.attr('value').split('::');
                    var baseKey = this.getAttribute('value');
                    var fullKey = baseKey + ':' + info[0];
                    if (info[1] == 0) {
                        var prefix = baseKey.split(':').join(', ').toUpperCase();
                        setJurisdictionButton(fullKey, prefix + ', ' + target.text());
                    } else {
                        jurisdictionWorker.postMessage({type:'REQUEST UI',key:fullKey,name:target.text()});
                    }
                }
            });
            $('#search-source-remover').show();
            loadButton.enable();
            break;
        case 'REQUEST MODULE TEMPLATE OK':
            var content = event.data.src;
            validateContent(content);
            break;
        }
    }
 
    var citeprocWorker = new Worker('../web-worker/cites.js');
    citeprocWorker.onmessage = function(event){
        var inObj = event.data;
        switch (inObj.type) {
        case 'PING OK':
            break;
        case 'ERROR':
            console.log("CSL Processor error: "+event.data.error+"\n");
            break;
        case 'STYLE OK LOCALES REQUESTED':
            console.log("CSL Processor: recd STYLE OK LOCALES REQUESTED");
            outObj = {};
            outObj.locales = {};
            outObj.pageInit = event.data.pageInit;
            console.log("CSL Processor: send LOAD STYLE LOCALES");
            outObj.type = 'LOAD STYLE LOCALES';
            

            var localesToLoad = Object.keys(event.data.locales);
            var pos = 0;
            function sendLocales(pos, localesToLoad) {
                if (pos == localesToLoad.length) {
                    citeprocWorker.postMessage(outObj);
                    return;
                }
                var locale = localesToLoad[pos];
                var xhr = new XMLHttpRequest();
                locale = locale.replace("_", "-");
                console.log('../src/locales/locales-' + locale + '.xml\n');
                xhr.open('GET', '../src/locales/locales-' + locale + '.xml', true);
                xhr.setRequestHeader("Content-type","text/xml");
                xhr.onload = function(e) {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            var doc = xhr.responseXML;
                            outObj.locales[locale] = jsonWalker.walkLocaleToObj(doc);
                            pos += 1;
                            sendLocales(pos, localesToLoad);
                        } else {
                            var errorSpec = {
                                type: "Error",
                                desc: xhr.statusText,
                                disable: true
                            }
                            // gh.ghMsg(errorSpec);
                            console.log("XXX " + JSON.stringify(errorSpec) + "\n");
                        }
                    }
                }
                xhr.onerror = function (e) {
                    var errorSpec = {
                        type: "Error",
                        desc: "Failure attempting to load locales",
                        disable: true
                    }
                    //gh.ghMsg(errorSpec);
                    console.log("XXX " + JSON.stringify(errorSpec) + "\n");
                };
                xhr.send(null);
            }
            sendLocales(0, localesToLoad);
            break;
        case 'STYLE LOCALES LOAD OK':
            console.log("CSL Processor: recd STYLE LOCALES LOAD OK");
            outObj = {};
            outObj.pageInit = event.data.pageInit;
            console.log("CSL Processor: send SETUP PROCESSOR");
            outObj.type = 'SETUP PROCESSOR';
            this.postMessage(outObj);
            break;
        case 'PROCESSOR OK':
            // Processor ready, enable the Sampler tab
            $("#tabs").tabs("enable", "#sampler");
            if (event.data.pageInit) {
                menuWorker.postMessage({type:'INIT SAMPLER PAGE'});
            }
            break;
        case 'INIT PAGE OK':
            console.log("CSL Processor: recd INIT PAGE OK");
            $('#unselected-csl-variables').html(event.data.bubbles[0]);
            $('#selected-csl-variables').html(event.data.bubbles[1]);
            for (var i=0,ilen=citationForms.length;i<ilen;i++) {
                var form = citationForms[i];
                $('.sampler-citation.' + form).html(event.data.citations[form]);
            }
            $('#sampler-bibliography').html(event.data.bibliography);
            setupDraggableNodes();
            disableUnusedTypes(event.data.usedTypes);

            //setBoxHeight(['selected-csl-variables','unselected-csl-variables'], -6);
            //setBoxHeight(['sampler','sampler-preview']);
            break;
        case 'UNSELECT VARIABLE OK':
        case 'SELECT VARIABLE OK':
        case 'CHANGE ITEM TYPE OK':
            $('#unselected-csl-variables').html(event.data.bubbles[0]);
            $('#selected-csl-variables').html(event.data.bubbles[1]);
            function writeCites(pos, forms, callback) {
                if (pos === forms.length) {
                    $('.sampler-citation').animate({'opacity': 1}, 500);
                    return;
                };
                $('.sampler-citation.' + forms[pos]).html(event.data.citations[forms[pos]]);
                writeCites(pos+1, forms);
            }
            $('.sampler-citation').animate({'opacity': 0.5}, 500, function(){
                writeCites(0, citationForms);
            });
            $('#sampler-bibliography').animate({'opacity': 0.5}, 500, function(){
                $(this).html(event.data.bibliography).animate({'opacity': 1}, 500);    
            });
            setupDraggableNodes();
            //setBoxHeight(['sampler','sampler-preview']);
        }
    }

    function disableUnusedTypes(usedTypes) {
        // usedTypes is received as a space-delimited string of CSL type names
        if (usedTypes) {
            usedTypes = usedTypes.split(/\s+/);
            $('.legal-type').each(function(index){
                var id = $(this).attr('id');
                if (usedTypes.indexOf(id) > -1) {
                    $('#' + id).removeClass('disabled-link');
                } else {
                    $('#' + id).addClass('disabled-link');
                }
            });
        } else {
            $('.legal-type').removeClass('disabled-link');
        }
    }

    function disableEvent(event) {
        event.preventDefault();
    }

    function changeSamplerItemType(event) {
        // srcElement for WebKit, originalTarget for Gecko 
        event.preventDefault();
        var originalElement = event.originalTarget ? event.originalTarget : event.srcElement;
        // XXX Can do better than just giving up.
        if ($(originalElement).hasClass('disabled-link')) return;
        
	    if (originalElement.getAttribute('id') === itemTypeName) {
	        return;
	    } else {
            itemTypeLabel = originalElement.textContent;
            itemTypeName = originalElement.getAttribute('id');
	    }

        $('#sampler-itemtype-button').attr('value', itemTypeName);
        $('#sampler-itemtype-button').html(itemTypeLabel + ' <span class="caret"></span>');
        citeprocWorker.postMessage({
            type:"CHANGE ITEM TYPE",
            itemType:itemTypeLabel,
            customFields: getCustomFields(),
            customAbbrevs: getCustomAbbrevs()
        });
    }

    function setupDraggableNodes() {
        $('#selected-csl-variables .sampler-button.draggable').draggable({
            revert: 'invalid',
            scope: 'tounselect',
            cancel: false,
	        delay: 150
        });

        $('#unselected-csl-variables .sampler-bubble').draggable({
            revert: 'invalid',
            scope: 'toselect'
        });
        $('#selected-csl-variables').droppable({
            hoverClass: 'csl-drag-hover',
            scope: "toselect",
            drop: function(event, ui) {
                var node = ui.draggable;
                node.attr('style', 'position:relative;').detach().appendTo('#selected-csl-variables');
                node.draggable("option","scope", "tounselect");
                citeprocWorker.postMessage({
                    type:'SELECT VARIABLE',
                    selectedVarname:node.attr('value'),
                    customFields: getCustomFields(),
                    customAbbrevs: getCustomAbbrevs()
                });
            }
        });
        $('#unselected-csl-variables').droppable({
            drop: function(event, ui){
                var node = ui.draggable;
                node.attr('style', 'position:relative;').detach().appendTo('#unselected-csl-variables');
                node.draggable("option","scope", "toselect");
                citeprocWorker.postMessage({
                    type:'UNSELECT VARIABLE',
                    unselectedVarname:node.attr('value'),
                    customFields: getCustomFields(),
                    customAbbrevs: getCustomAbbrevs()
                });
            },
            scope: "tounselect",
            hoverClass: 'csl-drag-hover'
        });
    }

    function validateContent(content) {
        var schemaURL = getSchemaURL();
        var sourceMethod = getSourceMethod();
        var documentFile = new Blob([content], {type: 'text/xml'});
        var keys = '';
        sourceMethodFunc = function (schemaURL, documentFile, sourceMethod) {
            return function () {
                validateViaPOST(schemaURL, documentFile, sourceMethod);
            }
        }(schemaURL, documentFile, sourceMethod);
        validate(true);
    }

    var init = function() {

        //Initialize URI.js
        uri = new URI();

        //setBoxHeight(['source-editor']);
        setBoxHeight(['source-code']);

        $('#errors-tab').click(function(e){
            setBoxHeight(['error-list']);
        });
        
        $(window).on('resize',function(){
            setBoxHeight(['errors']);
            setBoxHeight(['source-code']);
        });

        //Crank up the field map menus
        menuWorker.postMessage({type:"GET MENU ITEMS"});

        //Initialize page cache
        $('.source-input').each(function(){
            var key = this.getAttribute('id');
            pageCache[key] = {
                aceDocument: null,
                load: null,
                validate: null,
                save: null,
                submit: null,
                sourceTab: null,
                errorTab:null,
                errorBanner:null,
                errors: null,
                schema: null,
                urlQuery: null
            }
        });

        //Create range for Ace editor
        Range = ace.require("ace/range").Range;

        //Create an empty session for source modes not yet loaded
        emptyAceDoc = ace.createEditSession('')

        //Disable errors and sampler at init (may be reenabled by URL load)
        $("#tabs").tabs("disable", "#errors")
        $("#tabs").tabs("disable", "#sampler");

        //Initialize Ladda buttons
        loadButton = Ladda.create(document.querySelector('#load-source'));
        loadButton.disable();
        validateButton = Ladda.create(document.querySelector('#validate'));
        validateButton.disable();
        saveButton = Ladda.create(document.querySelector('#save'));
        saveButton.disable();
        submitButton = Ladda.create(document.querySelector('#submit'));
        submitButton.disable();

        //wake up load button on change, if content present
        $('#file-input').on('change', function(event) {
            if (this.value) {
                loadButton.enable();
                validateButton.enable();
            } else {
                loadButton.disable();
                validateButton.enable();
            }
        });

        //set schema-version if specified
        if (uri.hasQuery('version')) {
            var setSchemaVersion = uri.query(true)['version'];
            $('#schema-version').attr('value', setSchemaVersion);
            if (schemaLabel[setSchemaVersion]) {
                $('#schema-name').attr('value', schemaLabel[setSchemaVersion]);
            }
        }

        //run validation if URL parameters includes URL
        if (uri.hasQuery('url')) {
            var setURL = uri.query(true)['url'];
            $("#url-input").val(setURL);
            $('#url-source-remover').show();
            setView(null,'editor');
            $('.source-input').hide();
            $('#url-source').show();
            if ($('#url-input').val()) {
                $('#url-source-remover').show();
                $('#url-source-remover button:first-child').prop('disabled', false);
            }
            $('#source-method').attr('value', 'url-source');
            loadSource();
        }
        // With this, if user selected the editor during page
        // load, the view was yanked back to main on completion.
        //else {
        //    $('#url-input').val('');
        //    setView(null,'main');
        //}

        //validate on button click
        $("#validate").click(reValidate);
        $("#load-source").click(loadSource);

        //save on button click
        $("#save").click(saveFile);

        //submit on button click
        $("#submit").click(submitFile);

        //load when pressing Enter in URL text field with content
        //reset when pressing Enter in URL text field with no content
        //reset when pressing Backspace in URL text field with no content
        $('#url-input, #search-input').keyup(urlAndSearchKeyAction);

        function urlAndSearchKeyAction(event) {
            var id = this.getAttribute('id').replace(/-.*/,'');
            if (event.keyCode == 13) {
                event.preventDefault();
                if (!this.value) {
                    loadButton.disable();
                    //validateButton.disable();
                    $('#' + id + '-source-remover').hide();
                } else {
                    $('#' + id + '-source-remover').show();
                    loadButton.enable();
                }
            }
            if (event.keyCode === 8) {
                event.preventDefault();
                if (!this.value) {
                    loadButton.disable();
                    //validateButton.disable();
                    $('#' + id + '-source-remover').hide();
                }
            }
            /*
            if (this.getAttribute('id') === 'url-input' && this.value) {
                console.log("XXX ****** (3)\n");
                $('#' + id + '-source-remover').show();
                loadButton.enable();
            }
            */
        }


        $('#url-source-remover, #search-source-remover').click(function(event) {
            var id = this.getAttribute('id').replace(/-.*/,'');
            loadButton.disable();
            var isDropdown = $('#search-input').hasClass('search-input-as-dropdown');
            var isButton = $('#search-input').hasClass('search-input-as-button');
            if (isDropdown || isButton) {
                $('#' + id + '-input').typeahead('val', '');
                jurisdictionWorker.postMessage({type:'REQUEST UI'});
            } else {
                $('#' + id + '-input').val('');
            }
            if (id === 'url') {
                history.replaceState({}, document.title, uri.search(""));
            }
            $('#' + id + '-source-remover').hide();
        });

        $("#source-method").click(function(event){
            var target = $(event.target);
            if (target.is('A')) {
                event.preventDefault();
                var oldSourceMethod = $('#source-method').attr('value');
                if (oldSourceMethod !== target.attr('value')) {
                    var sourceMethod = target.attr('value');
                    $('#source-method').attr('value',sourceMethod);
                    $('.source-input').hide();
                    $('.source-input-remover').hide();
                    if (sourceMethod === 'file-source') {
                        $('#file-source').show();
                    } else if (sourceMethod === 'search-source') {
                        $('#search-source').show();
                        if ($('#search-input').val()) {
                            $('#search-source-remover').show();
                            $('#search-source-remover button:first-child').prop('disabled', false);
                        } else {
                            $('#search-source-remover').hide();
                        }
                    } else if (sourceMethod === 'url-source') {
                        $('#url-source').show();
                        if ($('#url-input').val()) {
                            $('#url-source-remover').show();
                            $('#url-source-remover button:first-child').prop('disabled', false);
                        } else {
                            $('#url-source-remover').hide();
                        }
                    }
                    // Save state:
                    // * Editor
                    // * Buttons (load/validate/save/submit)
                    // * Errors (nodes)
                    // * Schema selection
                    // * TAB STATES
                    if (oldSourceMethod) {
                        var old = oldSourceMethod;
                        pageCache[old].load = $('#load-source').prop('disabled');
                        pageCache[old].validate = $('#validate').prop('disabled');
                        pageCache[old].save = $('#save').prop('disabled');
                        pageCache[old].submit = $('#submit').prop('disabled');
                        pageCache[old].errors = document.getElementById('error-list').cloneNode(true);
                        var errorBanner = document.getElementById('error-banner');
                        if (errorBanner) {
                            pageCache[old].errorBanner = errorBanner.cloneNode(true);
                            errorBanner.parentNode.removeChild(errorBanner);
                        } else {
                            errorBanner = null;
                        }
                        pageCache[old].schema = $('#schema-version').attr('value');
                        pageCache[old].sourceTab = $('#source-tab').parent().attr('aria-disabled');
                        pageCache[old].errorsTab = $('#errors-tab').parent().attr('aria-disabled');
                        pageCache[old].samplerTab = $('#sampler-tab').parent().attr('aria-disabled');
                        // Not sure how we can use this - resetting the document query
                        // would reload the page and blast the editor content ...
                        if (uri.hasQuery('url')) {
                            pageCache[old].urlQuery = uri.query(true)['url'];
                        } else {
                            pageCache[old].urlQuery = false;
                        }
                    }
                    if (pageCache[sourceMethod] && pageCache[sourceMethod].aceDocument) {
                        var novo = sourceMethod;
                        pageCache[novo].load ? loadButton.disable() : loadButton.enable();
                        pageCache[novo].validate ? validateButton.disable() : validateButton.enable();
                        pageCache[novo].save ? saveButton.disable() : saveButton.enable();
                        pageCache[novo].submit ? submitButton.disable() : submitButton.enable();
                        $('#tabs').tabs('enable');
                        pageCache[novo].sourceTab ? $('#tabs').tabs('disable', '#source') : null;
                        pageCache[novo].errorsTab ? $('#tabs').tabs('disable', '#errors') : null;
                        pageCache[novo].samplerTab ? $('#tabs').tabs('disable', '#sampler') : null;
                        if (pageCache[novo].errorBanner) {
                            var sourceTitle = document.getElementById('source-title');
                            if (sourceTitle) {
                                sourceTitle.parentNode.appendChild(pageCache[novo].errorBanner);
                            }
                        }
                        var errorList = document.getElementById('error-list');
                        errorList.parentNode.replaceChild(pageCache[novo].errors,errorList);
                        $('#schema-version').attr('value', pageCache[novo].schema);
                        $('#schema-name').attr('value', schemaLabel[pageCache[novo].schema]);
                        editor.setSession(pageCache[novo].aceDocument);
                        initializeStyle();
                    } else {
                        loadButton.disable();
                        validateButton.disable();
                        saveButton.disable();
                        submitButton.disable();
                        $('#tabs').tabs('enable');
                        $('#tabs').tabs('disable', '#errors');
                        $('#tabs').tabs('disable', '#sampler');
                        $('#error-list').empty();
                        if (editor) {
                            editor.setSession(emptyAceDoc);
                        }
                    }
                }
            }
        });

        $("#schema-version").click(function(event){
            var target = $(event.target);
            if (target.is('A')) {
                event.preventDefault();
                var oldSchemaVersion = $("#schema-version").attr('value');
                if (oldSchemaVersion !== target.attr('value')) {
                    $('#schema-name').attr('value', target.text());
                    $('#schema-version').attr('value',target.attr('value'));
                }
            }
        });

        $("#variant-style").click(function(event){
            var target = $(event.target);
            if (target.is('A')) {
                event.preventDefault();
                $('#variant-style-button').html($(target).text());
                $('#variant-style').attr('value',target.attr('value'));
            }
        });

        console.log("XXX PING citeproc");
        citeprocWorker.postMessage({type:'PING'});
        
        $('#sampler-tab').click(function(event){
            console.log("XXX INIT SAMPLER PAGE citeproc");
            menuWorker.postMessage({type:'INIT SAMPLER PAGE'});
        });

        jurisdictionWorker.postMessage({type:'REQUEST UI'});
        setTypeaheadListener();

        $('#source').on('click', function(event){
            submitButton.disable();
        });
        
        $('#editAbbrevSave').on('click', function(event){
            var itemType = $('#sampler-itemtype-button').text().trim();
            var abbrevName = $('#editAbbrev .modal-body').attr('value');
            var val = $('#abbrev-' + abbrevName + '-value').val();
            var abbr = $('#abbrev-' + abbrevName + '-short').val();
            var valueObj = null;
            if (val && abbr) {
                valueObj = {
                    val: val,
                    abbr: abbr
                }
            }
            
            var key = itemType+ '::' + abbrevName + '::abbrev';
            var str = valueObj ? JSON.stringify(valueObj) : null;
            if (str) {
                localStorage.setItem(key, str);
            } else {
                localStorage.removeItem(key);
            }
            //$('#editCslVarSave').prop('disabled', true);
            $('#editAbbrev').modal('hide');
            citeprocWorker.postMessage({
                type:'SELECT VARIABLE',
                selectedVarname:null,
                customFields: getCustomFields(),
                customAbbrevs: getCustomAbbrevs()
            });
        });
        
        $('#editCslVarSave').on('click', function(event){
            var itemType = $('#sampler-itemtype-button').text().trim();
            var cslVarName = $('#cslVarName').text();
            var category = $('#editCslVar .modal-body').attr('value');
            var valueObj;
            switch (category) {
            case 'name':
                valueObj = [];
		        for (var i=1,ilen=11;i<ilen;i++) {
		            var family = $('#csl-family-name-' + i).val();
		            var given = $('#csl-given-name-' + i).val();
                    var checked;
                    if (i === 1) {
                        checked = 1;
                    } else {
		                checked = $('#csl-name-checkbox-' + i).prop('checked') ? 1 : 0;
                    }
		            if (!family && !given) {
			            checked = 0;
		            }
                    var name = {
			            checked: checked,
			            family: family,
			            given: given
		            }
		            valueObj.push(name);
		        }
                break;
            case 'date':
                valueObj = {
                    raw: $('#csl-date').val()
                }
                break;
            default:
                valueObj = $('#csl-' + category).val();
                break;
            }
            var key = itemType+ '::' + cslVarName;
            var str = valueObj ? JSON.stringify(valueObj) : null;
            if (str) {
                localStorage.setItem(key, str);
            } else {
                localStorage.removeItem(key);
            }
            //$('#editCslVarSave').prop('disabled', true);
            $('#editCslVar').modal('hide');
            citeprocWorker.postMessage({
                type:'SELECT VARIABLE',
                selectedVarname:null,
                customFields: getCustomFields(),
                customAbbrevs: getCustomAbbrevs()
            });
        });

        $('#editAbbrev').on('show.bs.modal', function(event){
            var itemTypeLabel = $('#sampler-itemtype-button').text().trim();
            var abbrevName = $(event.relatedTarget).attr('value')
            $('#abbrevCategoryName').html(abbrevName);
            $('#abbrevCategoryLabel').html($(event.relatedTarget).text().trim());
	        $('.modal-body').removeClass('container-title collection-title institution-entire institution-part number title place');
	        $('.modal-body').addClass(abbrevName);
	        $('.modal-body').attr('value', abbrevName);

            // Populate field with correct content, if any (out of localStorage)
            var key = itemTypeLabel + '::' + abbrevName + '::abbrev';
            var obj = localStorage.getItem(key);
            if (obj) {
                try {
                    obj = JSON.parse(obj);
                } catch (e) {}
            } else {
                obj = {val:'', abbr:''};
            }
            editAbbrevPopulate(abbrevName, obj.val, obj.abbr);
            // Enable or disable save as appropriate.
            $('#editAbbrevSave').prop('disabled', false);
        });
        $('#editAbbrev').on('shown.bs.modal', function(event){
            var abbrevName = $(event.relatedTarget).attr('value');
            setTimeout(function(){
                $('#abbrev-' + abbrevName + '-value').focus();
                var val = $('#abbrev-' + abbrevName + '-value').val();
                $('#abbrev-' + abbrevName + '-value').val('');
                $('#abbrev-' + abbrevName + '-value').val(val);
            }, 100);
        });
        $('#editAbbrev input').on('keyup', function(event){
            if (event.keyCode == 13) {
                event.preventDefault;
                $('#editAbbrevSave').click();
            }
        });

        $('#editCslVar').on('show.bs.modal', function(event){
            var itemTypeLabel = $('#sampler-itemtype-button').text().trim();
            var category = $(event.relatedTarget).parent().attr('value');
            var cslVarName = $(event.relatedTarget).attr('value')
            $('#cslVarName').html(cslVarName);
            $('#cslFieldLabel').html($(event.relatedTarget).text().trim());
	        $('.modal-body').removeClass('name date number text locator');
	        $('.modal-body').addClass(category);
	        $('.modal-body').attr('value', category);

            // Populate field with correct content, if any (out of localStorage)
            var key = itemTypeLabel + '::' + cslVarName;
            var val = localStorage.getItem(key);
            if (val) {
                try {
                    val = JSON.parse(val);
                } catch (e) {}
            }
            editCslPopulate(category, val);
            // Enable or disable save as appropriate.
            $('#editCslVarSave').prop('disabled', false);
        });
        $('#editCslVar').on('shown.bs.modal', function(event){
            var category = $(event.relatedTarget).parent().attr('value');
            if (category === 'name') {
                category = 'family-name-1';
            }
            setTimeout(function(){
                $('#csl-' + category).focus();
                var val = $('#csl-' + category).val();
                $('#csl-' + category).val('');
                $('#csl-' + category).val(val);
            }, 100);
        });
        $('#editCslVar input').on('keyup', function(event){
            if (event.keyCode == 13) {
                event.preventDefault;
                $('#editCslVarSave').click();
            }
        })
    };
    
    function editAbbrevPopulate(category, val, abbr) {
        val ? $('#abbrev-' + category + "-value").val(val) : $('#abbrev-' + category + "-value").val('');
        abbr ? $('#abbrev-' + category + "-short").val(abbr) : $('#abbrev-' + category + "-short").val('');
    }

    function editCslPopulate(category, val) {
        // Names need extending to 10 of them, with checkboxes for inclusion. Ugh.
        switch (category) {
        case 'name':
            if (!val || "object" !== typeof val || val.length !== 10) {
                val = null;
            }
            if (!val) {
		        for (var i=1,ilen=11;i<ilen;i++) {
                    $('#csl-name-checkbox-' + i).prop('checked', false);
                    $('#csl-family-name-' + i).val('');
                    $('#csl-given-name-' + i).val('');
		        }
            } else {
		        for (var i=1,ilen=11;i<ilen;i++) {
		            $('#csl-name-checkbox-' + i).prop('checked', (val[i-1].checked ? 1 : 0));
                    $('#csl-family-name-' + i).val(val[i-1].family);
                    $('#csl-given-name-' + i).val(val[i-1].given);
		        }
	        }
            break;
        case 'date':
            (val && val.raw) ? $('#csl-date').val(val.raw) : $('#csl-date').val('');
            break;
        case 'text':
        case 'number':
        case 'locator':
            val ? $('#csl-' + category).val(val) : $('#csl-' + category).val('');
            break;
        }
    }

    function setTypeaheadListener() {
        $('#search-input.typeahead').on('typeahead:selected typeahead:autocompleted', function(event) {
            var info = countriesMap[this.value]
            if (info && info[1]) {
                jurisdictionWorker.postMessage({type:'REQUEST UI',key:info[0],name:this.value});
            } else {
                setJurisdictionButton(info[0], this.value);
            }
        });
    }

    function setJurisdictionButton(key, name) {
        //key = key + $('#variant-style').attr('value');
        var html = '<button id="search-input" class="btn btn-info form-control search-input-as-button" value="' + key + '">' + name + '</button>';
        $('#search-source').html(html);
        $('#search-source-remover').show();
        loadButton.enable();
    }

    function loadValidateButton(state, noAction) {
        if (isFromLoad) {
            loadButton[state]();
        } else {
            validateButton[state]();
        }
        if ('stop' === state && isFromLoad) {
            if (!noAction) {
                loadButton.disable();
            }
        }
    }

    function setView(event, name, section) {
        if (event) {
            event.preventDefault();
        };
        $('.action-button').removeClass('chosen');
        $('.action-view').attr('style', 'display:none;');
        $('#' + name + '-view').attr('style', 'display:block;');
        // ZZZ Yuck.
        if (!event) {
            // This will always be so. For now. Ugh.
            if (name === 'editor') {
                tutorial.toggle_guidance(true);
            }
        } else {
            $(event.target).addClass('chosen');
        }

        var titles = {
            main: 'Juris-M: Welcome',
            editor: 'Style Manager'
        }
        if (titles[name]) {
            document.title = titles[name];
        }
        if (name === 'editor') {
            //XXX setBoxHeight(['tabs']);
            if (editor) {
                //setBoxHeight(['source']);
                setTimeout(function(){
                    setBoxHeight(['source-code']);
                    editor.renderer.updateFull();
                }, 100);
            }
        } else if (name === 'fields') {
            menuWorker.postMessage({type:'GET PAGE',pageName:section});
        } else if (name === 'spec') {
            setBoxHeight(['spec-view']);
        } else if (name === 'supp') {
            setBoxHeight(['supp-view']);
        }
    }

    var sourceMethodFunc = null;
    
    function getSchemaURL () {
        var cslVersion = $('#schema-version').attr('value');
        var schemaURL = '';
        if (cslVersion.indexOf("mlz") > -1) {
            schemaURL = "https://raw.githubusercontent.com/juris-m/schema/v" + cslVersion + "/csl-mlz.rnc";
        } else {
            schemaURL = "https://raw.githubusercontent.com/citation-style-language/schema/v" + cslVersion + "/csl.rnc";
        }
        //schemaURL += " " + "https://raw.githubusercontent.com/citation-style-language/schema/master/csl.sch";
        return schemaURL;
    }

    function getSourceMethod () {
        var sourceMethod = $('#source-method').attr('value');
        sourceMethod = sourceMethod.replace(/-source$/, '');
        return sourceMethod;
    }

    function loadSource () {
        isFromLoad = true;
        loadButton.start();
        // Get schema URL
        var schemaURL = getSchemaURL();
        // Get source method
        var sourceMethod = getSourceMethod();
        lastSourceMethod = sourceMethod;

        // Set function for submitting document for validation
        switch (sourceMethod) {
        case "url":
            $('div#cheat-sheet-arrow').hide();
            var documentURL = $('#url-input').val();
            uri.setSearch("url", documentURL);
            uri.setSearch("version", $('#schema-version').attr('value'));
            //history.replaceState({}, document.title, uri.search(""));
            history.pushState({}, document.title, uri);

            //don't try validation on empty string
            sourceMethodFunc = function(schemaURL, documentURL) {
                return function () {
                    if ($.trim(documentURL).length > 0) {
                        validateViaGET(schemaURL, documentURL);
                    } else {
                        window.clearTimeout(responseTimer);
                        // true is for fail - do not disable the load button
                        loadValidateButton('stop', true);
                    }
                }
            }(schemaURL, documentURL);
            validate(true);
            break;
        case "file":
            $('div#cheat-sheet-arrow').hide();
            uri.search("");
            history.pushState({}, document.title, uri);
            
            var documentFile = $('#file-input').get(0).files[0];
            var keys = '';
            sourceMethodFunc = function (schemaURL, documentFile, sourceMethod) {
                return function () {
                    validateViaPOST(schemaURL, documentFile, sourceMethod);
                }
            }(schemaURL, documentFile, sourceMethod);
            validate(true);
            break;
        case "search":
            $('div#cheat-sheet-arrow').hide();
            var key = $('#search-input').attr('value');
            key = (key + $('#variant-style').attr('value'))
            var name = $('#search-input-button').text();
            if (!name) {
                name = $('#search-input').text();
            }
            if (!gh) {
                gh = new GitHub(access_token, jurisdictionWorker, validateContent, submitButton);
            }
            gh.githubInit(key, name);
            // Maybe reveal cheat-sheet link
            if (key === "us") {
                $('div#cheat-sheet-arrow').show();
                $('a#cheat-sheet').attr('href', '/cheat-sheets/' + key + '.pdf')
            }
            break;
        }
    }

    var isFromLoad = false;

    function reValidate() {
        isFromLoad = false;
        var schemaURL = getSchemaURL();
        var sourceMethod = getSourceMethod();
        lastSourceMethod = sourceMethod;

        var documentFile = new Blob([getEditorContent()], {type: 'text/xml'});
        sourceMethodFunc = function (schemaURL, documentFile, sourceMethod) {
            return function () {
                // true is a reValidate tag, to suppress overwrite of editor data
                validateViaPOST(schemaURL, documentFile, sourceMethod, true);
            }
        }(schemaURL, documentFile, sourceMethod);
        validate();
    }

    function validate() {
        if (!sourceMethodFunc) {
            return;
        }
        $("#tabs").tabs("enable", "#source");
        $("#tabs").tabs("disable", "#errors");
        $("#tabs").tabs("disable", "#sampler");
        loadValidateButton('start');
        $("#source-tab").click(function(e){});
        $('#source-guidance').addClass('noshow');
        $('#source-editor').show();
        setBoxHeight(['source-code']);

        responseStartTime = new Date();
        responseTimer = window.setTimeout(reportTimeOut, responseMaxTime);
        sourceMethodFunc();
        sourceMethodFunc = null;
    }

    function validateViaGET(schemaURL, documentURL) {
        $.get("https://our.law.nagoya-u.ac.jp/validate/", {
                doc: documentURL,
                schema: schemaURL,
                parser: "xml",
                laxtype: "yes",
                level: "error",
                out: "json",
                showsource: "yes"
            })
            .done(function(data) {
                parseResponse(data);
            });
    }

    function validateViaPOST(schemaURL, documentContent, sourceMethod, reValidate) {

        //if (!documentContent) {
        //    loadValidateButton('stop', true);
        //    return;
        //}

        var formData = new FormData();
        formData.append("schema", schemaURL);
        formData.append("parser", "xml");
        formData.append("laxtype", "yes");
        formData.append("level", "error");
        formData.append("out", "json");
        formData.append("showsource", "yes");
        formData.append("file", documentContent);

        $.ajax({
            type: "POST",
            url: "https://our.law.nagoya-u.ac.jp/validate/",
            data: formData,
            success: function(data) {
                parseResponse(data, reValidate);
            },
            processData: false,
            contentType: false
        });
    }

    function getEditorContent(xmlStr) {
        if (!xmlStr) {
            xmlStr = editor.getSession().getValue();
        }
        while (xmlStr.slice(0,1) === '\n') {
            xmlStr = xmlStr.slice(1);
        }
        if (xmlStr.slice(0,2) !== '<?') {
            xmlStr = '<?xml version="1.0" encoding="utf-8"?>\n' + xmlStr;
        }
        return xmlStr.trim();
    }

    function initializeStyle() {
        var doc = parseXML(getEditorContent());
        var styleName = doc.getElementsByTagName('title')[0].textContent.trim();
        $('#style-name').html(styleName);
        var styleObj = jsonWalker.walkStyleToObj(doc);
        var outObj = {
            styleName: styleName,
            type: 'LOAD STYLE AND SUBMIT LOCALES',
            pageInit: true,
            style: styleObj.obj,
            locales: styleObj.locales
        }
        citeprocWorker.postMessage(outObj);
    }

    function saveFile() {
        var xmlStr = getEditorContent();
        var fileName = "SomeFileName.txt"
        m = xmlStr.match(/.*<id>.*\/(.*)<\/id>/);
        if (m) {
            fileName = m[1].replace(/:/g, "+") + ".csl";
        }
        xmlStr = btoa(unescape(encodeURIComponent(xmlStr)));
        var a = document.createElement('a');
        var ev = document.createEvent("MouseEvents");
        a.href = "data:application/octet-stream;charset=utf-8;base64,"+xmlStr;
        a.download = fileName;
        ev.initMouseEvent("click", true, false, self, 0, 0, 0, 0, 0,
                          false, false, false, false, 0, null);
        a.dispatchEvent(ev);
    }

    function submitFile() {
        // Call for authentication if necessary
        // (fires only once in a session, otherwise we use the existing token)
        submitButton.start();
        gh.submitPullRequest(($('#search-input').attr('value') + $('#variant-style').attr('value')), getEditorContent());
    }

    function parseResponse(data, reValidate) {
        //console.log(JSON.stringify(data));

        window.clearTimeout(responseTimer);
        responseEndTime = new Date();
        console.log("Received response from https://our.law.nagoya-u.ac.jp/validate/ after " + (responseEndTime - responseStartTime) + "ms");

        removeValidationResults(reValidate);

        var messages = data.messages;
        var errorCount = 0;
        var nonDocumentError = "";
        for (var i = 0; i < messages.length; i++) {
            if (messages[i].type == "non-document-error") {
                nonDocumentError = messages[i].message;
            } else if (messages[i].type == "error") {
                errorCount += 1;

                var results = "";
                results += '<li class="inserted">';

                var range = "";
                var firstLine = "";
                var lineText = "";
                var lastLine = messages[i].lastLine;
                var firstColumn = messages[i].firstColumn;
                var lastColumn = messages[i].lastColumn;
                if (messages[i].hasOwnProperty('firstLine')) {
                    firstLine = messages[i].firstLine;
                    range = firstLine + "-" + lastLine;
                    lineText = "Lines " + range;
                } else {
                    firstLine = lastLine;
                    lineText = "Line " + lastLine;
                }
                sourceHighlightRange = firstLine + ',' + firstColumn + ',' + lastLine + ',' + lastColumn;
                results += '<a style="text-decoration:none;padding:0.25em;border-radius:0.5em;border:1px solid black;" href="#source-code" onclick="CSLValidator.moveToLine(event,' + sourceHighlightRange + ');">' + lineText + '</a>: ';

                results += messages[i].message;
                results += "</li>";
                $("#error-list").append(results);
                $("#error-" + errorCount).text(messages[i].extract);
            }
        }

        if (nonDocumentError !== "") {
            $("#tabs").tabs("disable", "#errors");
            $("#tabs").tabs("disable", "#sampler");
            $('#validate').popover({
                html: true,
                title: 'Validation failed <a class="close" href="#">&times;</a>',
                content: '<p>' + nonDocumentError + '</p>',
                trigger: 'manual',
                placement: 'bottom'
            });
            $(document).click(function (e) {
                if (($('.popover').has(e.target).length == 0) || $(e.target).is('.close')) {
                    $('#validate').popover('destroy');
                }
            });
            $('#validate').popover('show');
        } else if (errorCount === 0) {
            $("#tabs").tabs("disable", "#errors");
            $("#tabs").tabs("enable", "#sampler");
            if (isFromLoad) {
                $('#schema-version').popover({
                    html: true,
                    title: 'Success and welcome! <a class="close" href="#">&times;</a>',
                    content: '<p>Some tips:</p><p class="hanging"><span class="tabby">Juris-M Style</span> edit style code</p><p class="hanging"><span class="buttony">Validate</span> check code syntax</p><p class="hanging"><span class="tabby">Sampler</span> preview citations</p><p class="hanging"><span class="green buttony">Submit</span> submit code for review</p><p class="hanging"><span class="buttony">Download</span> save a copy</p>',
                    trigger: 'manual',
                    placement: 'bottom'
                });
                $(document).click(function (e) {
                    if (($('.popover').has(e.target).length == 0) || $(e.target).is('.close')) {
                        $('#schema-version').popover('destroy');
                    }
                });
                $('#schema-version').popover('show');
            }
        } else if (errorCount > 0) {
            if (errorCount == 1) {
                var popoverTitle = 'Oops, I found 1 error.';
            } else {
                var popoverTitle = 'Oops, I found ' + errorCount + ' errors.';
            }
            $('#validate').popover({
                html: true,
                title: popoverTitle + ' <a class="close" href="#">&times;</a>',
                content: '<p>If you have trouble understanding the error messages below, start by reading the <a href="http://citationstyles.org/downloads/specification.html">CSL specification</a> and the <a href="http://citationstylist.org/docs/citeproc-js-csl.html">Juris-M Specification Supplement</a>.</p>',
                trigger: 'manual',
                placement: 'bottom'
            });
            $(document).click(function (e) {
                if (($('.popover').has(e.target).length == 0) || $(e.target).is('.close')) {
                    $('#validate').popover('destroy');
                }
            });
            $('#validate').popover('show');
            $('#tabs').tabs('enable', '#errors');
            $('#tabs').tabs('disable', '#sampler');
            $("#errors").attr("class", "panel panel-warning");
            $("#errors").prepend('<div class="panel-heading inserted"><h4 id="source-title" class="panel-title">Errors <a href="#" rel="tooltip" class="glyphicon glyphicon-question-sign" data-toggle="tooltip" data-placement="auto left" title="Click the link next to an error description to highlight the relevant lines in the Source window below"></a></h4></div>');
            $('[data-toggle="tooltip"]').tooltip();
        }

        if (data.source.code.length > 0 && !reValidate) {
            $("#source-editor").append('<div class="panel-heading inserted-to-source"><h4 id="source-title" class="panel-title">Source</h4></div>');
            $("#source-editor").append('<div id="source-code" class="panel-body inserted-to-source"></div>');
            $("#source-editor").attr("class", "panel panel-primary");

            // Restores the XML declaration if it's missing in the return
            var sourceCode = getEditorContent(data.source.code);
            var sourceLst = sourceCode.split("\n");
            var rangeLst = [];
            var range = null;
            for (var i=0,ilen=sourceLst.length;i<ilen;i++) {
                var line = sourceLst[i];
                if (line.match(/\s*<macro/)) {
                    range = [i+1];
                    rangeLst.push(range);
                } else if (line.match(/\s*<\/macro/)) {
                    range.push(i+1);
                }
            }
            var aceDoc = ace.createEditSession(sourceCode)
            pageCache[$('#source-method').attr('value')].aceDocument = aceDoc;

            //setBoxHeight(['source-editor']);
            setBoxHeight(['source-code']);
            
            editor = ace.edit("source-code");
            editor.setSession(aceDoc);
            editor.setReadOnly(false);
            editor.getSession().setUseWrapMode(true);
            editor.getSession().setTabSize(2);
            editor.setHighlightActiveLine(true);
            editor.renderer.$cursorLayer.element.style.opacity = 1;
            editor.setTheme("ace/theme/eclipse");
            editor.getSession().setMode("ace/mode/xml");
            editor.commands.addCommand({
                name: 'saveFile',
                bindKey: {
                    win: 'Ctrl-S',
                    mac: 'Command-S',
                    sender: 'editor|cli'
                },
                exec: function(env, args, request) {
                    saveFile();
                }
            });
            setTimeout(function(){
		console.log("Juris-M: collapsing editor nodes at init");
                for (var i=0,ilen=rangeLst.length;i<ilen;i++) {
                    var start = rangeLst[i][0];
                    var end = rangeLst[i][1];
                    editor.getSession().foldAll(start, end, 0);
                }
            }, 500);
        } else {
            //setBoxHeight(['source-editor']);
            setBoxHeight(['source-code']);
        }

        if (errorCount === 0 && nonDocumentError === "") {
            initializeStyle();
            if (getSourceMethod() === "search") {
                submitButton.enable();
            }
        }

        // This gets the box - would need to resize ace also,
        // but when all alerts are moved to popupovers, resizing
        // will not be necessary. Even this can go.
        loadValidateButton('stop');
        validateButton.enable();
        saveButton.enable();
    }

    function moveToLine(event,firstLine, firstColumn, lastLine, lastColumn) {
        $("#source-tab").click();
        $("#error-banner").remove();
        var errorNode = $('<div id="error-banner" class="inserted" style="display:inline;margin-left:1em;"><span style="font-weight:bold;">ERROR @ </span><span>').get(0);
        var infoNode = event.target.parentNode.cloneNode(true);
        lineNumber = infoNode.firstChild;
        lineNumber.removeAttribute('onclick');
        lineNumber.setAttribute('style', 'color:white;font-weight:bold;text-size:smaller;');
        errorNode.appendChild(infoNode.firstChild);
        errorNode.appendChild(infoNode.lastChild);
        $("#source-editor h4.panel-title").attr('style', 'display:inline;').after(errorNode);

        editor.scrollToLine(firstLine, true, true, function() {});
        editor.gotoLine(firstLine, 0, false);
        sourceHighlightRange = new Range(firstLine - 1, firstColumn - 1, lastLine - 1, lastColumn);
        editor.selection.setRange(sourceHighlightRange);
    }

    function removeValidationResults(reValidate) {
        $(".inserted").remove();
        //$("#errors").removeAttr("class");
        if (!reValidate) {
            //$("#source").removeAttr("class");
            $(".inserted-to-source").remove();
        }
    }

    function reportTimeOut() {
        loadValidateButton('stop');
        //removeValidationResults();
        console.log("Call to https://our.law.nagoya-u.ac.jp/validate/ timed out after " + responseMaxTime + "ms.");
        $('#validate').popover({
            html: true,
            title: 'Validation timeout',
            content: '<p>This typically happens if the <a href="https://our.law.nagoya-u.ac.jp/validate/">Nagoya NU HTML Checker</a> website is down, but maybe you get lucky if you wait a little longer.</p>',
            trigger: 'manual',
            placement: 'bottom'
        });
        $(document).click(function (e) {
            if (($('.popover').has(e.target).length == 0) || $(e.target).is('.close')) {
                $('#validate').popover('destroy');
            }
        });
        $('#validate').popover('show');
    }

    return {
        init: init,
        moveToLine: moveToLine,
	    setView: setView,
        changeSamplerItemType: changeSamplerItemType
    };
}());
