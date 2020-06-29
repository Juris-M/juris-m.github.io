'use strict'

//------------------------------------------------------------------------------
// Navigation menus

// Show all menus on hover
$('#desktopNavMenu').hover(function() {
  $(this).addClass('expanded');
}, function() {
  $(this).removeClass('expanded');
});

function desktopNavIsOpen() {
  return $('#desktopNavMenu').hasClass('expanded');
}

function desktopNavIsClosed() {
  return !desktopNavIsOpen();
}

function openDesktopNav() {
    $('#desktopNavMenu').addClass('expanded');
}

function closeDesktopNav() {
    $('#desktopNavMenu').removeClass('expanded');
}

function deselectAllCategories() {
    $('#desktopNavMenu .category-name.selected').removeClass('selected');
}

function selectedCategories() {
    return $('#desktopNavMenu').find('.category-name.selected')
}

function selectedMobileCategories() {
    return $('#mobileNavMenu').find('.category-name.selected')
}

function deselectAllMobileCategories() {
    $('#mobileNavMenu .category-name.selected').removeClass('selected');
}

function hideUnselectedMobileCategories(toBeSelected) {
    $('#mobileNavMenu .category-name').each(function() {
        if ($(this).is(toBeSelected)) {
            $(this).parent().slideDown("slow", function(){});
        } else {
            $(this).parent().slideUp("slow", function(){});
        }
    });
}

function showAllMobileCategories() {
    $('#mobileNavMenu .category-name').each(function() {
        $(this).parent().slideDown("slow", function(){});
    });
}

function selectCategory(c) {
    c.addClass('selected');
}

// Expand all categories when mobile menu is hidden
$('#mobileNavMenu').on('hide.bs.collapse', function() {
    deselectAllMobileCategories();
    showAllMobileCategories();
});

// Show all menus if any of the category names is clicked
$('#desktopNavMenu .category-name').click(function() {
    if (desktopNavIsClosed()) {
        openDesktopNav();
        deselectAllCategories();
        selectCategory($(this));
    } else if (desktopNavIsOpen() && $(this).hasClass('selected')) {
        closeDesktopNav();
        deselectAllCategories();
    } else if (desktopNavIsOpen() && selectedCategories().length > 0) {
        deselectAllCategories();
        selectCategory($(this));
    } else if (desktopNavIsOpen() && selectedCategories().length == 0) {
        closeDesktopNav();
    }
});

$('#mobileNavMenu .category-name').click(function() {
    if (selectedMobileCategories().length > 0) {
        deselectAllMobileCategories();
        showAllMobileCategories();
    } else {
        hideUnselectedMobileCategories($(this));
        selectCategory($(this));
    }
});

// Highlight the navigation column under the mouse cursor
$('.dropdown-nav').hover(function() {
  $(this).toggleClass('highlight');
});

// Hide the mobile navigation menu when the mobile search menu is shown
$('#mobileSearchMenu').on('show.bs.collapse', function() {
    $('#mobileNavMenu').collapse('hide');
});

// Hide the mobile search menu when the mobile navigation menu is shown
$('#mobileNavMenu').on('show.bs.collapse', function() {
    $('#mobileSearchMenu').collapse('hide');
});

// Hide the desktop navigation menu when a link is clicked
$('#desktopNavMenu .dropdown-nav .nav-item').click(function() {
    $('#desktopNavMenu').removeClass('expanded');
});

// Hide the mobile navigation menu when a link is clicked
$('#mobileNavMenu .dropdown-menu .dropdown-item').click(function() {
    $('#mobileNavMenu').collapse('hide');
});


//------------------------------------------------------------------
// Language selection support (for Programs pages)

if (!sessionStorage.lang) {
    sessionStorage.lang = "en";
}
var pageLang = sessionStorage.lang;


function langHandler(event) {
    
    if (location.search) {
        var m = location.search.toString().slice(1).match(/^(?:[a-z]+=[a-z0-9]+&)*lang=(en|ja)(?:&[a-z]+=[a-z0-9]+)*/);
        if (m) {
            sessionStorage.lang = m[1];
            pageLang = m[1];
            var uri = window.location.toString();
            var fragment_id = "";
            if (uri.indexOf("#") > 0) {
                fragment_id = uri.slice(uri.indexOf("#"));
            }
            if (uri.indexOf("?") > 0) {
                var clean_uri = uri.substring(0, uri.indexOf("?"));
                //window.history.replaceState({}, document.title, clean_uri);
                window.location = clean_uri + fragment_id;
            }
        }
    }
    
    var langMap = {
        "en": ["ja"],
        "ja": ["en"]
    }
    if (event) {
        if (event.target.id === "eselect") {
            pageLang = "en";
        } else if (event.target.id == "jselect") {
            pageLang = "ja";
        } else {
            return false;
        }
    }
    if (pageLang === "en") {
        document.getElementById("jselect").classList.remove("checked");
        document.getElementById("eselect").classList.add("checked");
        sessionStorage.lang = "en";
    } else {
        document.getElementById("eselect").classList.remove("checked");
        document.getElementById("jselect").classList.add("checked");
        sessionStorage.lang = "ja";
    }
    var langNodes = document.getElementsByClassName(pageLang);
    for (var i in langNodes) {
        var node = langNodes[i];
        if (node.hidden) {
            node.hidden = false;
            if (node.nextElementSibling) {
                node.nextElementSibling.classList.remove("first-item");
            }
            if (node.previousElementSibling) {
                node.previousElementSibling.classList.remove("last-item");
            }
        }
    }
    var firstNodeParents = [];
    var lastNodeParents = [];
    var opposites = langMap[pageLang];
    for (var i=0,ilen=opposites.length; i<ilen; i++) {
        var opposite = opposites[i];
        var oppositeNodes = document.getElementsByClassName(opposite);
        for (var j=0,jlen=oppositeNodes.length; j<jlen; j++) {
            var node = oppositeNodes[j];
            //var queryParams = new URLSearchParams(location.search.slice(1));
            if (!node.classList.contains(pageLang)) {
                node.hidden = true;
                if (node === node.parentNode.firstElementChild) {
                    // Is it a first-listed element? If so, the first non-hidden
                    // sibling will need margin-top = 0.
                    firstNodeParents.push(node.parentNode);
                }
                if (node === node.parentNode.lastElementChild) {
                    // Is it a last-listed element? If so, the first non-hidden
                    // sibling will need margin-bottom = 0.
                    lastNodeParents.push(node.parentNode);
                }
            }
        }
    }
    for (var i in firstNodeParents) {
        var node = firstNodeParents[i];
        for (var j=0,jlen=node.children.length; j<jlen; j++) {
            var child = node.children[j];
            if (!child.hidden) {
                child.classList.add("first-item");
                break;
            }
        }
    }
    for (var i in lastNodeParents) {
        var node = lastNodeParents[i];
        for (var j=node.children.length-1; j>-1; j--) {
            var child = node.children[j];
            if (!child.hidden) {
                child.classList.add("last-item");
                break;
            }
        }
    }
    return false;
}

function attachListener() {
    var langselector = document.getElementById("langselector");
    if (langselector) {
        langselector.addEventListener("click", langHandler, false);
        langHandler();
    }
}
