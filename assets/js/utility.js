'use strict'

//------------------------------------------------------------------------------
// Category selection
function categoryHandler(e) {
    let node = e.currentTarget;
    let val = node.getAttribute("value");
    $(".category-choice").each(function() {
        if (val === "all" || $(this).hasClass("category-" + val)) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });
}

function attachListener() {
    var selector = document.getElementById("category-chooser");
    if (selector) {
        for (let i=0,ilen=selector.children.length;i<ilen;i++) {
            let child = selector.children[i];
            child.addEventListener("click", categoryHandler, false);
        }
    }
}

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
