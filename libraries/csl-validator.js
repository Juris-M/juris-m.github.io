var CSLValidator = (function() {

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
    var responseMaxTime = 6000; //in milliseconds
    var responseStartTime;
    var responseEndTime;

    //cache for editor content and errors
    pageCache = {};

    // We need an object that can be set to a key,
    // and will return values under that key.

    var init = function() {
        //Initialize URI.js
        uri = new URI();

        //Initialize page cache
        $('.source-input').each(function(){
            var key = this.getAttribute('id');
            pageCache[key] = {
                load: null,
                validate: null,
                save: null,
                submit: null,
                errors: null,
                schema: null,
                urlQuery: null
            }
        });

        //Create range for Ace editor
        Range = ace.require("ace/range").Range;

        //Initialize Ladda buttons
        loadButton = Ladda.create(document.querySelector('#load-source'));
        validateButton = Ladda.create(document.querySelector('#validate'));
        validateButton.disable();
        saveButton = Ladda.create(document.querySelector('#save'));
        saveButton.disable();
        submitButton = Ladda.create(document.querySelector('#submit'));
        submitButton.disable();

        //set schema-version if specified
        if (uri.hasQuery('version')) {
            var setSchemaVersion = uri.query(true)['version'];
            $('#schema-version').prop('value', setSchemaVersion);
            $('#schema-version-dropdown').children().each(function(){
                var labelSchemaVersion = this.firstChild.getAttribute('value');
                if (labelSchemaVersion === setSchemaVersion) {
                    $('#schema-name').prop('value', setSchemaVersion);
                    return false;
                }
            });
        }

        //run validation if URL parameters includes URL
        if (uri.hasQuery('url')) {
            var setURL = uri.query(true)['url'];
            $("#url-input").val(setURL);
            setView(null,'editor');
            loadSource();
        } else {
            $('#url-input').val('');
            setView(null,'main');
        }

        //validate on button click
        $("#validate").click(reValidate);
        $("#load-source").click(loadSource);

        //save on button click
        $("#save").click(saveFile);

        //load when pressing Enter in URL text field with content
        //reset when pressing Enter in URL text field with no content
        //reset when pressing Backspace in URL text field with no content
        $('#url-input').keyup(function(event) {
            if (event.keyCode == 13) {
                event.preventDefault();
                if (!event.target.getAttribute('value')) {
                    loadButton.enable();
                    validateButton.disable();
                } else {
                    loadSource();
                }
            }
            if (event.keyCode === 8) {
                event.preventDefault();
                if (!event.target.getAttribute('value')) {
                    loadButton.enable();
                    validateButton.disable();
                }
            }
        });

        $("#source-method").click(function(event){
            var target = $(event.target);
            if (target.is('A')) {
                event.preventDefault();
                var oldSourceMethod = $('#source-method').attr('value');
                if (oldSourceMethod !== target.attr('value')) {
                    var sourceMethod = target.attr('value');
                    $('#source-method').attr('value',sourceMethod);
                    $('.source-input').attr('style', 'display:none;');
                    if (sourceMethod === 'file-source') {
                        $('#' + sourceMethod).attr('style', 'border:none;padding:0px;margin:0px;display:inline;');
                    } else {
                        $('#' + sourceMethod).attr('style', 'display:inline;');
                    }
                    // Save state:
                    // * Editor
                    // * Buttons (load/validate/save/submit)
                    // * Errors (nodes)
                    // * Schema selection
                    // * Last-entered source value (url/filename)
                    if (oldSourceMethod) {
                        var old = oldSourceMethod;
                        pageCache[old].load = loadButton.disabled;
                        pageCache[old].validate = validateButton.disabled;
                        pageCache[old].save = saveButton.disabled;
                        pageCache[old].submit = submitButton.disabled;
                        pageCache[old].errors = $('#error-list').get(0).cloneNode(false);
                        pageCache[old].schema = $('#schema-version').prop('value');
                        // Not sure how we can use this - resetting the document query
                        // would reload the page and blast the editor content, no?
                        if (uri.hasQuery('url')) {
                            pageCache[old].urlQuery = uri.query(true)['url'];
                        } else {
                            pageCache[old].urlQuery = false;
                        }
                    }
                    if (pageCache[sourceMethod]) {
                        var novo = sourceMethod;
                        pageCache[novo].load ? loadButton.enable() : loadButton.disable();
                        pageCache[novo].validate ? validateButton.enable() : validateButton.disable();
                        pageCache[novo].save ? saveButton.enable() : saveButton.disable();
                        pageCache[novo].submit ? submitButton.enable() : submitButton.disable();
                        $('#error-list').empty();
                        $('#error-list').append(pageCache[novo].errors);
                        $('#schema-version').prop('value', pageCache[novo].schema);
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
                    $('#schema-name').prop('value', target.text());
                    $('#schema-version').prop('value',target.attr('value'));
                }
            }
        });

        $('#url-input').keyup(function(){
            loadButton.enable();
        });

        $(".hasclear").keyup(function () {
            var t = $(this);
            t.next('span').toggle(Boolean(t.val()));
        });
        
        if ($(".clearer").prev('input').val()) {
            $(".clearer").show();
        }

        //$(".clearer").hide($(this).prev('input').val());
        
        $(".clearer").click(function () {
            $(this).prev('input').val('').focus();
            $(this).hide();
        });

        $(window).bind('resize',function(){
            setBoxHeight(['source', 'errors']);
            setBoxHeight(['source-code']);
        });


    };

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
    function setBoxHeight(lst) {
        var obj = document.getElementById(lst[0]);
        if (!obj) return;
        var curtop = 0;
        var curleft = 0;
        if (obj.offsetParent) {
            do {
                curtop += obj.offsetTop;
                curleft += obj.offsetLeft;
            } while (obj = obj.offsetParent);
            var docViewHeight = document.documentElement.clientHeight;
            var boxHeight = (docViewHeight - curtop - 4);
            for (var i=0,ilen=lst.length;i<ilen;i++) {
                var elem = document.getElementById(lst[i]);
                if (elem) {
                    elem.style.height = (boxHeight + 'px');
                }
            }
        }
    }

    function setView(event,name) {
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
    }

    var sourceMethodFunc = null;

    function getSchemaURL () {
        var cslVersion = $('#schema-version').prop('value');
        var schemaURL = '';
        if (cslVersion.indexOf("mlz") > -1) {
            schemaURL = "https://raw.githubusercontent.com/fbennett/schema/v" + cslVersion + "/csl-mlz.rnc";
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
            uri.setSearch("version", $('#schema-version').prop('value'));
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
            break;
        case "file":
            uri.search("");
            history.pushState({}, document.title, uri);
            
            var documentFile = $('#file-input').get(0).files[0];
            var keys = '';
            for (var key in documentFile) {
                keys += key + '\n';
            }
            sourceMethodFunc = function (schemaURL, documentFile, sourceMethod) {
                return function () {
                    validateViaPOST(schemaURL, documentFile, sourceMethod);
                }
            }(schemaURL, documentFile, sourceMethod);
            break;
        }
        validate(true);
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
        $("#tabs").tabs("enable");
        loadValidateButton('start');
        $("#source-tab").click();
        responseStartTime = new Date();
        responseTimer = window.setTimeout(reportTimeOut, responseMaxTime);
        sourceMethodFunc();
    }

    function validateViaGET(schemaURL, documentURL) {
        $.get("http://our.law.nagoya-u.ac.jp/validate/", {
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

        if (sourceMethod == "textarea") {
            formData.append("content", documentContent);
        } else {
            formData.append("file", documentContent);
        }

        $.ajax({
            type: "POST",
            url: "http://our.law.nagoya-u.ac.jp/validate/",
            data: formData,
            success: function(data) {
                parseResponse(data, reValidate);
            },
            processData: false,
            contentType: false
        });
    }

    function getEditorContent() {
        var xmlStr = window.editor.getSession().getValue();
        while (xmlStr.slice(0,1) === '\n') {
            xmlStr = xmlStr.slice(1);
        }
        if (xmlStr.slice(0,2) !== '<?') {
            xmlStr = '<?xml version="1.0" encoding="utf-8"?>\n' + xmlStr;
        }
        return xmlStr;
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

    function parseResponse(data, reValidate) {
        //console.log(JSON.stringify(data));

        window.clearTimeout(responseTimer);
        responseEndTime = new Date();
        console.log("Received response from http://our.law.nagoya-u.ac.jp/validate/ after " + (responseEndTime - responseStartTime) + "ms");

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
            $("#alert").append('<div class="inserted alert alert-warning" role="alert">Validation failed: ' + nonDocumentError + '</div>');
            setBoxHeight(['source', 'errors']);
        } else if (errorCount === 0) {
            $("#tabs").tabs("disable", "#errors");
            $("#alert").append('<div class="inserted alert alert-success" role="alert">Good job! No errors found.</br><small>Interested in contributing your style or locale file? See our <a href="https://github.com/citation-style-language/styles/blob/master/CONTRIBUTING.md">instructions</a>.</small></div>');
            setBoxHeight(['source', 'errors']);
        } else if (errorCount > 0) {
            if (errorCount == 1) {
                $("#alert").append('<div class="inserted alert alert-danger" role="alert">Oops, I found 1 error.</div>');
            } else {
                $("#alert").append('<div class="inserted alert alert-danger" role="alert">Oops, I found ' + errorCount + ' errors.</div>');
            }
            $("#alert > div.alert-danger").append('</br><small>If you have trouble understanding the error messages below, start by reading the <a href="http://citationstyles.org/downloads/specification.html">CSL specification</a> and the <a href="http://citationstylist.org/docs/citeproc-js-csl.html">Juris-M Specification Supplement</a>.</small>');

            $("#errors").attr("class", "panel panel-warning");
            $("#errors").prepend('<div class="panel-heading inserted"><h4 class="panel-title">Errors <a href="#" rel="tooltip" class="glyphicon glyphicon-question-sign" data-toggle="tooltip" data-placement="auto left" title="Click the link next to an error description to highlight the relevant lines in the Source window below"></a></h4></div>');
            $('[data-toggle="tooltip"]').tooltip();
            setBoxHeight(['source', 'errors']);
        }

        if (data.source.code.length > 0 && !reValidate) {
            $("#source").append('<div class="panel-heading inserted-to-source"><h4 class="panel-title">Source</h4></div>');
            $("#source").append('<div id="source-code" class="panel-body inserted-to-source"></div>');
            $("#source").attr("class", "panel panel-primary");

            var aceDoc = ace.createEditSession(data.source.code)
            aceDocs[$('#source-method').attr('value')] = aceDoc;

            setBoxHeight(['source-code']);
            window.editor = ace.edit("source-code");
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
        }
        
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
        //alert(firstLine + "," + firstColumn + "," + lastLine + "," + lastColumn);
        sourceHighlightRange = new Range(firstLine - 1, firstColumn - 1, lastLine - 1, lastColumn);
        editor.session.removeMarker(marker);
        marker = editor.session.addMarker(sourceHighlightRange, "ace_selection", "text");
    }

    function removeValidationResults(reValidate) {
        $(".inserted").remove();
        $("#errors").removeAttr("class");
        if (!reValidate) {
            $("#source").removeAttr("class");
            $(".inserted-to-source").remove();
        }
    }

    function reportTimeOut() {
        loadValidateButton('stop');
        removeValidationResults();
        console.log("Call to http://our.law.nagoya-u.ac.jp/validate/ timed out after " + responseMaxTime + "ms.");
        $("#alert").append('<div class="inserted alert alert-warning" role="alert">Validation is taking longer than expected! (more than ' + responseMaxTime/1000 + ' seconds)</div>');
        $("#alert > div.alert-warning").append('</br><small>This typically happens if the <a href="http://our.law.nagoya-u.ac.jp/validate/">Nu HTML Checker</a> website is down, but maybe you get lucky if you wait a little longer.</small>');
    }

    return {
        init: init,
        moveToLine: moveToLine,
	    setView: setView
    };
}());
