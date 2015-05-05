tutorial = new function() {

    /*
     * 
     */
    
    var popovers;
    var opening_popover = false;
    var stop_rerun = false;
    var node_state;
    var spec_type;
    var spec_selector;
    var spec_previous;
    var spec_next;

    var sources = [
        {
            type: 'dropdown',
            selector: '#source-method',
            clickon: '#source-method button',
            title: 'Source dropdown',
            content: '<p>Click on <span class="grey buttony">Source</span> to change the method used to load a style into the editor.</p><div class="popover-title center">Options</div><dl><dt>Jurisdiction Module</dt><dd>Search for a jurisdiction by name, select it, and (for federal jurisdictions) optionally select a sub-jurisdiction from a pulldown menu.</dd><dt>File upload</dt><dd>Upload a CSL or Juris-M style file directly from your PC.</dd><dt>URL</dt><dd>Enter the URL of a CSL or Juris-M style from the Web (such as a style in the CSL Repository).</dd></dl><p>Each source mode is a separate session: the editor content is preserved when switching between them.</p>',
            placement: 'right'
        },
        {
            type: 'dropdown',
            selector: '#schema-version',
            clickon: '#schema-version-caret',
            title: 'Schema version setting',
            content: '<p>Citation styles are written in CSL, a highly expressive XML language tailored to this purpose. The syntax of a CSL file is defined in a <i>schema</i>. There are two schemata to choose from, which differ in small but significant ways.</p><div class="popover-title center">Options</div><dl><dt>Juris-M</dt><dd>An extended version of CSL. Use this schema for legal styles and style modules. Note that in Jurisdiction Module mode, the editor will select this schema automatically.<p>Styles that conform to this schema will run only in the Juris-M Desktop Client or (on server side) a properly configured instance of the <span style="font-family:mono">citeproc-js</span> citation processor.</p></dd><dt>CSL 1.0.1</dt><dd>The current version of mainstream CSL, used in Zotero, Mendeley and other modern reference managers. Vanilla CSL does not (yet) provide full support for legal referencing.</dd></dl><p>The <b>CSL 1.0</b> and <b>CSL 0.8.1</b> schemata are legacy versions of the CSL language. While they are offered here for validation, such old styles should be updated to conform to the <b>Juris-M</b> or the <b>CSL 1.0.1</b> schema for production use.</p>',
            placement: 'right'
        },
        {
            type: 'button',
            selector: '#load-source',
            title: 'Load button',
            content: '<p>After setting an input source, click the <span class="buttony">Load</span> button to load the code into the editor.</p>',
            placement: 'bottom'
        },
        {
            type: 'button',
            selector: '#source-tab',
            title: 'Editor tab',
            content: 'When a style is loaded, its code is made available for editing under the <span class="tabby">Editor</span> tab. CSL is an XML language, so you should expect to see XML code here.</p>',
            placement: 'bottom'
        },
        {
            type: 'button',
            selector: '#errors-tab',
            title: 'Errors tab',
            content: 'Styles are automatically validated against the selected schema after loading. If errors are found, they will be listed under the <span class="tabby">Errors</span> tab.</p><p>Entries in an error listing are linked to the line in the style that triggered the error.</p>',
            placement: 'bottom'
        },
        {
            type: 'button',
            selector: '#sampler-tab',
            title: 'Sampler tab',
            content: '<p>When validation detects no syntax errors in the style, a set of sample citations is generated under the <span class="tabby">Sampler</span> tab, using the same citation processor that runs in the Juris-M Desktop Client. Multiple scenarios can be tested by dragging field elements into and out of the processor.</p><p>It\'s all very high-tech and Silicon-Valley-like.</p>',
            placement: 'bottom'
        },
        {
            type: 'button',
            selector: '#validate',
            title: 'Validate button',
            content: '<p>After you make changes to the style code, check your work by clicking on the <span class="buttony">Validate</span> button</p>',
            placement: 'bottom'
        },
        {
            type: 'button',
            selector: '#submit',
            title: 'Submit button',
            content: '<p>For jurisdiction modules only, you can submit your code to the project by clicking the <span class="buttony green">Submit</span> button</p><p>Submissions are filed as GitHub pull requests. You may receive mail from the reviewers if there are issues to discuss.</p>',
            placement: 'bottom'
        },
        {
            type: 'button',
            selector: '#save',
            title: 'Download button',
            content: '<p>You can save a local copy of your style with the <span class="buttony">Download</span> button.<p></p>Download is available in all three <span class="tabby">Source</span> modes, and even works for code that fails validation.</p>',
            placement: 'bottom'
        },
        {
            type: 'button',
            selector: '#field-maps',
            title: 'Field Maps',
            content: '<p>Click here for mapping tables that show which CSL variables to use for each field in the Desktop Client.</p>',
            placement: 'bottom'
        },
        {
            type: 'button',
            selector: '#documentation',
            title: 'Docs',
            content: '<p>Links to documentation on the CSL language and the Juris-M extensions to it are available here.</p>',
            placement: 'bottom'
        }
    ]

    var template = '<div class="popover wider" role="tooltip"><div class="arrow"></div><a class="close" href="#">&times;</a><h3 class="popover-title"></h3><div class="popover-content"></div><div class="popover-navi"><input type="button" class="btn btn-default next" autocomplete="off" value="Next"/><input type="button" class="btn btn-default previous" autocomplete="off" value="Previous"/></div></div>';

    var factory = {
        dropdown: function(spec) {
            return function() {
                opening_popover = true;
                spec_type = spec.type;
                spec_selector = spec.selector;
                spec_previous = spec.previous;
                spec_next = spec.next;
                // We step around the initial click event with a short timeout.
                setTimeout(function(event) {
                    $(spec.selector).one('shown.bs.dropdown',function(event){
	                    $(spec.selector + ' ul').popover({
		                    html: true,
                            template: template,
                            container: 'body',
		                    title: spec.title,
		                    content: spec.content,
                            delay: 100,
		                    trigger: 'manual',
		                    placement: spec.placement
	                    });
                        $(this).find('ul').popover('show');
                    });

                    // Stuff that didn't work.
                    //$(spec.selector + " .dropdown-toggle").dropdown("toggle");
                    //$(spec.selector).toggleClass("open");

                    // Stuff that did.
                    $(spec.clickon).trigger("click");
                    $(spec.selector).addClass("open");
                    $('.popover').on('click',persistDropdown);
                }, 200);
            }
        },
        button: function(spec) {
            return function() {
                opening_popover = true;
                spec_type = spec.type;
                spec_selector = spec.selector;
                spec_previous = spec.previous;
                spec_next = spec.next;
                if (spec.type === 'button') {
                    node_state = $(spec.selector).prop('disabled');
                    $(spec.selector).prop('disabled', false);
                }
	            $(spec.selector).popover({
		            html: true,
                    template: template,
                    container: 'body',
		            title: spec.title,
		            content: spec.content,
                    delay: 100,
		            trigger: 'manual',
		            placement: spec.placement
	            });
                $(spec.selector).popover('show');
            }
        }
    }

    function persistDropdown(event) {
        setTimeout(function() {
            if (!($(event.target).is('.previous') || $(event.target).is('.next'))) {
                $(spec_selector).addClass("open");
            }
        }, 100);
    }

    function setPopoverNaviHandler() {
        $(document).on('shown.bs.popover', function(event) {
            if (!spec_previous) {
                $('.previous').prop('disabled', true);
            } else {
                $('.previous').prop('disabled', false);
            }
            if (!spec_next) {
                $('.next').prop('disabled', true);
            } else {
                $('.next').prop('disabled', false);
            }
        });
    }

    function setClickHandler() {
        $(document).on('click',function (e) {
            if (!spec_selector) return;
            if ($(e.target).is('.close')) {
                $('*').popover('destroy');
                if (spec_type === 'button') {
                    $(spec_selector).prop('disabled', node_state);
                } else {
                    $(spec_selector + ' .dropdown.open').removeClass('open');
                }
                spec_type = null;
                spec_selector = null;
                spec_previous = null;
                spec_next = null;
                stop_rerun = false;
            } else if (($('.popover').has(e.target).length == 0) || $(e.target).is('.next') || $(e.target).is('.previous')) {
                if (spec_type === 'button') {
                    $(spec_selector).popover('destroy');
                    $(spec_selector).prop('disabled', node_state);
                } else {
                    $('.popover').off('click',persistDropdown);
                    $(spec_selector + ' ul').popover('destroy');
                    $(spec_selector + ' .dropdown.open').removeClass('open');
                }
                if (!opening_popover) {
                    if ($(e.target).is('.previous')) {
                        popovers[spec_previous]();
                    } else {
                        popovers[spec_next]();
                    }
                }
            }
            opening_popover = false;
        });
    }

    function build() {
        if (!popovers) {
            popovers = {};
            setClickHandler();
            setPopoverNaviHandler();
            for (var i=0,ilen=sources.length;i<ilen;i++) {
                var source = sources[i];
                var previous = sources[i-1] ? sources[i-1].selector : sources[sources.length-1].selector;
                var next = sources[i+1] ? sources[i+1].selector : sources[0].selector;
                source.previous = previous;
                source.next = next;
                popovers[source.selector] = factory[source.type](source);
            }
        }
    }

    function setView() {
        var ret = false;
        if (!$('#editorViewButton').is('.chosen')) {
            $('#editorViewButton').click();
            ret = true;
        }
        var tabActive = null;
        if ($('#source-tab').parent().is('.ui-state-active')) {
            tabActive = true;
        }
        if (!tabActive) {
            $('#source-tab').click();
            ret = true;
        }
        return ret;
    }

    function run() {
        if (stop_rerun) return;
        stop_rerun = true;
        setView();
        popovers['#source-method']();
    }

    function toggle_guidance (forceEditor) {
        if (setView() && !forceEditor) {
            $('#source-guidance').removeClass('noshow');
            $('#source-editor').hide();
        } else if ($('#source-guidance').is('.noshow') && !forceEditor) {
            $('#source-guidance').removeClass('noshow');
            $('#source-editor').hide();
        } else {
            $('#source-guidance').addClass('noshow');
            $('#source-editor').show();
            setBoxHeight(['source-code']);
        }
    }

    this.build = build;
    this.run = run;
    this.stop_rerun = stop_rerun;
    this.toggle_guidance = toggle_guidance;
}

