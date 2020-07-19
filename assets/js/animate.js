
$(document).ready(function() {
    $('.animate').each(function(){
        var src = $(this).attr('src');
        $(this).hover(function(){
            $(this).attr('src', src.replace('.png', '-animate.gif'));
        }, function(){
            $(this).attr('src', src);
        });
    });
});
