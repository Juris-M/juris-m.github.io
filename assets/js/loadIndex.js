$(document).ready(function() {
    if (location.search) {
        var m = location.search.toString().slice(1).match(/^(?:[a-z]+=[a-z0-9]+&)*only=([^&]+)/);
        if (m) {
            var nodes = document.getElementsByClassName('contacts-row');
            for (var node of nodes) {
                if (m[1] !== node.getAttribute('id')) {
                    $(node).hide();
                } else {
                    $(node).show();
                }
            }
        }
    }
});

// Load the index from the site and set up search
$(document).ready(function () {
    'use strict';
    var top = "/en";
    if (location.href.indexOf("localhost") > -1) {
        var top = "";
    }
    $.getJSON(top + '/TIMESTAMP.json', function(TIMESTAMP) {
        // Set up search
        var index, store;
        $.getJSON(top + '/idx_' + TIMESTAMP + '.json', function (response) {
            // Create index
            index = lunr.Index.load(response.index);
            // Create store
            store = response.store;
            // Handle search
            $('input.search').on('keyup', function () {
                // Get query
                var queryStr = $(this).val();
                // Search for it
                var query = queryStr.trim().split(/\s+/);
                var result = index.query(function(q){
                    for (var term of query) {
                        q.term(term, { usePipeline: true, boost: 100 });
                        q.term(term + "*", { usePipeline: false, boost: 10 });
                        q.term(term, { usePipeline: false, editDistance: 2, boost: 1 })
                    }
                });
                // Output it
                var resultdiv = $('ul.searchresults');
                var properPage = $('div#proper-page');
                var searchPage = $('div#search-page');
                if (result.length === 0 || !queryStr) {
                    if (!queryStr) {
                        // Restore proper page if necessary
                        searchPage.hide();
                        properPage.show();
                        // Hide results
                        resultdiv.hide();
                    } else {
                        resultdiv.empty();
                        var searchitem = '<li>No items found</li>';
                        resultdiv.append(searchitem);
                    }
                } else {
                    // Hide page, show search results
                    properPage.hide();
                    searchPage.show();
                    // Show results
                    resultdiv.empty();
                    var events = [];
                    var contacts = [];
                    var references = [];
                    for (var item in result) {
                        var url, label;
                        var ref = result[item].ref;
                        if (store[ref].type === "events") {
                            url = top + "/events/" + ref + ".html";
                            label = "Event";
                        } else if (["gsl", "university", "external"].indexOf(store[ref].type) > -1) {
                            url = top + "/directory/" + store[ref].type + "/?only=" + ref;
                            label = "Contact";
                        } else {
                            // This should no longer happen. All external references should be covered
                            // by Contacts items.
                            label = "Reference";
                            url = ref;
                        }
                        var searchitem = '<li><b>' + label + ':</b> ' + store[ref].presenters + '<a href="' + url + '">' + store[ref].title + '</a></li>';
                        if (label === "Event") {
                            events.push(searchitem);
                        } else if (label === "Contact") {
                            contacts.push(searchitem);
                        } else {
                            references.push(searchitem);
                        }
                    }
                    for (var searchitem of events) {
                        resultdiv.append(searchitem);
                    }
                    for (var searchitem of contacts) {
                        resultdiv.append(searchitem);
                    }
                    for (var searchitem of references) {
                        resultdiv.append(searchitem);
                    }
                    resultdiv.show();
                }
            });
        });
    });
});

$(window).unload(function(){
    $('input.search').val('');
});
