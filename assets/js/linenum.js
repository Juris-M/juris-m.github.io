(function() {
    var pre = document.getElementsByTagName('pre'),
        pl = pre.length, start = 0;
    
    for (var i = 0; i < pl; i++) {
        var className = null;
        var arg = null;
        var codeNodes = pre[i].getElementsByTagName("code");
        if (codeNodes.length > 0) {
            className = codeNodes[0].getAttribute("class");
            var m = className.match(/([^:0-9]+)(?::([^-:0-9]+))*(?:\-?([0-9]+))*/);
            if (m) {
                var classes = [m[1]];
                if (m[2]) {
                    classes.push(m[2]);
                }
                if (m[3]) {
                    arg = m[3].replace(/\-$/, "");
                    
                }
                codeNodes[0].setAttribute("class", classes.join(" "));
            }
        }
        pre[i].innerHTML = '<span class="line-number"></span>' + pre[i].innerHTML + '<span class="cl"></span>';
        var num = pre[i].innerHTML.split(/\n/).length;
        
        if (arg) {
            if (arg === "+") {
                // noop: do not reset start
            } else {
                // set start to numeric value
                start = parseInt(arg) - 1;
            }
        } else {
            console.log(`SET START 0`);
            start = 0;
        }
        for (var j = 0; j < (num - 1); j++) {
            var line_num = pre[i].getElementsByTagName('span')[0];
            line_num.innerHTML += '<span>' + (j + 1 + start) + '</span>';
        }
        start = start + j;
    }
})();
