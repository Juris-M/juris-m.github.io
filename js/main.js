var CSLValidator = (function() {

    //to access Ace
    var editor;

    //to access the GitHub API library object
    var gh;

    //GitHub API access token
    var access_token = null;

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
                obj.children.push(this.walkToObject(child));
            }
        }
        return obj;
    }
    jsonWalker = new JSONWalker();

    var menuWorker = new Worker('web-worker/menu.js');
    menuWorker.onmessage = function(event) {
        switch (event.data.type) {
        case 'GET MENU ITEMS OK':
            $('#field-map-menu-container').html(event.data.html);
            break;
        case 'GET PAGE OK':
            $('#fields-view').html(event.data.html);
            break;
        case 'INIT SAMPLER PAGE OK':
            // Item types menu
            $('#sampler-itemtype-dropdown').empty();
            var menuItems = '';
            for (var i=0,ilen=event.data.itemTypes.length;i<ilen;i++) {
                var itemTypeLabel = event.data.itemTypes[i];
                var legalTypes = event.data.legalTypes;
                if (legalTypes.indexOf(itemTypeLabel) > -1) {
                    menuItems += '<li><a class="legal-type" href="#">' + itemTypeLabel + '</a></li>';
                } else {
                    menuItems += '<li><a class="non-legal-type" href="#">' + event.data.itemTypes[i] + '</a></li>';
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
                itemTypeData: event.data.itemTypeData
            });
            break;
        }
    }

    var countries = null;
    var countriesMap = null;

    var jurisdictionWorker = new Worker('web-worker/jurisdictions.js');
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
 
    var citeprocWorker = new Worker('web-worker/cites.js');
    citeprocWorker.onmessage = function(event){
        var inObj = event.data;
        switch (inObj.type) {
        case 'PING OK':
            break;
        case 'ERROR':
            console.log("CSL Processor error: "+event.data.error+"\n");
            break;
        case 'STYLE OK LOCALES REQUESTED':
            outObj = {};
            outObj.locales = {};
            outObj.pageInit = event.data.pageInit;
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
                xhr.open('GET', 'src/locales/locales-' + locale + '.xml', true);
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
                                title: "Error",
                                desc: xhr.statusText,
                                disable: true
                            }
                            ghMsg(errorSpec);
                        }
                    }
                }
                xhr.onerror = function (e) {
                    var errorSpec = {
                        title: "Error",
                        desc: "Failure attempting to load locales",
                        disable: true
                    }
                    ghMsg(errorSpec);
                };
                xhr.send(null);
            }
            sendLocales(0, localesToLoad);
            break;
        case 'STYLE LOCALES LOAD OK':
            outObj = {};
            outObj.pageInit = event.data.pageInit;
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
            $('#unselected-csl-variables').html(event.data.bubbles[0]);
            $('#selected-csl-variables').html(event.data.bubbles[1]);
            $('#sampler-citations').html(event.data.citations);
            $('#sampler-bibliography').html(event.data.bibliography);
            setupDraggableNodes();

            //setBoxHeight(['selected-csl-variables','unselected-csl-variables'], -6);
            //setBoxHeight(['sampler','sampler-preview']);
            break;
        case 'UNSELECT VARIABLE OK':
        case 'SELECT VARIABLE OK':
        case 'CHANGE ITEM TYPE OK':
            $('#unselected-csl-variables').html(event.data.bubbles[0]);
            $('#selected-csl-variables').html(event.data.bubbles[1]);
            $('#sampler-citations').animate({'opacity': 0.5}, 500, function(){
                $(this).html(event.data.citations).animate({'opacity': 1}, 500);    
            });
            $('#sampler-bibliography').animate({'opacity': 0.5}, 500, function(){
                $(this).html(event.data.bibliography).animate({'opacity': 1}, 500);    
            });
            setupDraggableNodes();
            //setBoxHeight(['sampler','sampler-preview']);
        }
    }

    function changeSamplerItemType(event) {
        // srcElement for WebKit, originalTarget for Gecko 
        event.preventDefault();
        var originalElement = event.originalTarget ? event.originalTarget : event.srcElement;
        $('#sampler-itemtype-button').html(originalElement.textContent + ' <span class="caret"></span>');
        citeprocWorker.postMessage({type:"CHANGE ITEM TYPE",itemType:originalElement.textContent});
    }

    function setupDraggableNodes() {
        $('#selected-csl-variables span.sampler-bubble').draggable({
            revert: 'invalid',
            scope: 'tounselect'
        });
        $('#unselected-csl-variables span.sampler-bubble').draggable({
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
                citeprocWorker.postMessage({type:'SELECT VARIABLE',selectedVarname:node.attr('value')});
            }
        });
        $('#unselected-csl-variables').droppable({
            drop: function(event, ui){
                var node = ui.draggable;
                node.attr('style', 'position:relative;').detach().appendTo('#unselected-csl-variables');
                node.draggable("option","scope", "toselect");
                citeprocWorker.postMessage({type:'UNSELECT VARIABLE',unselectedVarname:node.attr('value')});
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
                dump("XXX ****** (3)\n");
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
                jurisdictionWorker.postMessage({type:'REQUEST UI'});
            } else {
                $('#' + id + '-input').val('');
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
                    if (pageCache[sourceMethod].aceDocument) {
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

        $('#errors-tab').click(function(){
            setBoxHeight(['error-list']);
        });
        
        $(window).bind('resize',function(){
            setBoxHeight(['source', 'errors']);
            setBoxHeight(['source-code']);
        });
        setBoxHeight(['source']);
        setBoxHeight(['source-code']);
        
        citeprocWorker.postMessage({type:'PING'});
        
        $('#sampler-tab').click(function(event){
            menuWorker.postMessage({type:'INIT SAMPLER PAGE'});
        });

        jurisdictionWorker.postMessage({type:'REQUEST UI'});
        setTypeaheadListener();

        $('#source').on('click', function(event){
            submitButton.disable();
        });

    };

    function setTypeaheadListener() {
        $('#search-input.typeahead').on('typeahead:selected typeahead:autocompleted', function(event) {
            var info = countriesMap[this.value]
            if (info[1]) {
                jurisdictionWorker.postMessage({type:'REQUEST UI',key:info[0],name:this.value});
            } else {
                setJurisdictionButton(info[0], this.value);
            }
        });
   }

    function setJurisdictionButton(key, name) {
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

    /* code originally for scrolling
     * Ahnsirk Dasarp
     * http://stackoverflow.com/questions/5007530/how-do-i-scroll-to-an-element-using-javascript
     */
    function setBoxHeight(lst, reduction, minHeight) {
        if (!reduction) {
            reduction = 0;
        }
        var docViewHeight = document.documentElement.clientHeight;
        for (var i=0,ilen=lst.length;i<ilen;i++) {
            var obj = document.getElementById(lst[i]);
            if (!obj) return;
            var origObj = obj;
            origObj.style['min-height'] = (minHeight ? minHeight : 200) + 'px';
            //if (document.documentElement.clientWidth < 992) {
            //    continue;
            //}
            var offset = 0;
            if (lst[i] === 'error-list') {
                offset = 8;
            }
            var curtop = 0;
            var curleft = 0;
            if (obj.offsetParent) {
                do {
                    curtop += obj.offsetTop;
                } while (obj = obj.offsetParent);
                var boxHeight = (docViewHeight - curtop - 5);
                origObj.style['height'] = ((boxHeight - offset + reduction) + 'px');
                origObj.style['max-height'] = ((boxHeight - offset + reduction) + 'px');
            } else {
                // for field-map-menu-container
                if (lst[i] === 'field-map-menu-container') {
                    var offsetTop = $('div.container.content').get(0).offsetTop;
                    origObj.style['height'] = ((docViewHeight - offsetTop - offset + reduction) + 'px');
                    origObj.style['max-height'] = ((docViewHeight - offsetTop - offset + reduction) + 'px');
                }
            }
        }
    }
    
    function setView(event, name, section) {
        if (event) {
            event.preventDefault();
        };
        $('.action-view').attr('style', 'display:none;');
        $('#' + name + '-view').attr('style', 'display:block;');
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
                setBoxHeight(['source']);
                setBoxHeight(['source-code']);
                editor.renderer.updateFull();
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
            var documentURL = $('#url-input').val();
            uri.setSearch("url", documentURL);
            uri.setSearch("version", $('#schema-version').attr('value'));
            history.replaceState({}, document.title, uri.search(""));

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
            var key = $('#search-input').attr('value');
            var name = $('#search-input-button').text();
            if (!name) {
                name = $('#search-input').text();
            }

            // Login to GitHub if necessary.
            // Then get the master copy of the module or set from template.
            if (!access_token) {
                function receiveMessage(event) {
                    access_token = event.data.token;
                    gh = new GitHub(access_token, jurisdictionWorker, validateContent, submitButton);
                    gh.getModuleMaster(key, name);
                }
                window.addEventListener('message', receiveMessage, false);
                window.open('https://github.com/login/oauth/authorize?client_id=dafdd5113c19e21d5fa6&scope=public_repo&status=12345');
            } else {
                gh.getModuleMaster(key, name);
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
        $("#source-tab").click();
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

    function getEditorContent() {
        var xmlStr = editor.getSession().getValue();
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
            fileName = m[1] + ".csl";
        }
        xmlStr = btoa(xmlStr);
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
        gh.submitPullRequest($('#search-input').attr('value'), getEditorContent());
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
            $("#tabs").tabs("disable", "#sampler");
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
            $("#errors").attr("class", "panel panel-warning");
            $("#errors").prepend('<div class="panel-heading inserted"><h4 id="source-title" class="panel-title">Errors <a href="#" rel="tooltip" class="glyphicon glyphicon-question-sign" data-toggle="tooltip" data-placement="auto left" title="Click the link next to an error description to highlight the relevant lines in the Source window below"></a></h4></div>');
            $('[data-toggle="tooltip"]').tooltip();
        }

        if (data.source.code.length > 0 && !reValidate) {
            $("#source").append('<div class="panel-heading inserted-to-source"><h4 id="source-title" class="panel-title">Source</h4></div>');
            $("#source").append('<div id="source-code" class="panel-body inserted-to-source"></div>');
            $("#source").attr("class", "panel panel-primary");

            var aceDoc = ace.createEditSession(data.source.code)
            pageCache[$('#source-method').attr('value')].aceDocument = aceDoc;

            setBoxHeight(['source']);
            setBoxHeight(['source-code']);

            editor = ace.edit("source-code");
            editor.setSession(aceDoc);
            editor.setReadOnly(false);
            editor.getSession().setUseWrapMode(true);
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
        } else {
            setBoxHeight(['source']);
            setBoxHeight(['source-code']);
        }

        if (errorCount === 0 && nonDocumentError !== "") {
            initializeStyle();
            submitButton.enable();
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
        $("#source h4.panel-title").attr('style', 'display:inline;').after(errorNode);

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
