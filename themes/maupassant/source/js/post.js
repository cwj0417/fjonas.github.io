$(function () {
    var titles = $('h2,h3,h4,h5');

    function escp(a) {
        return a.replace(/([\s\.\*\=\+\>\,\[\]\:\~\?\'\"\(\)])/g, '\\$1');
    }

    function getOutLine(titles, startNum) {
        var content = [];
        [].filter.call(titles, function (item) {
            return item.tagName == "H" + startNum;
        }).forEach(function (item) {
            content.push(generateOutline(item, startNum));
        });
        function generateOutline(item, tagn) {
            $(item).attr('id', escp(item.textContent));
            var result = {
                name: item.textContent,
                depth: +tagn,
                child: []
            };
            var flag = false;
            for (var index = 0; index < titles.length; index++) {
                if (titles[index] == item) {
                    flag = true;
                    continue;
                }
                if (flag) {
                    if (titles[index].tagName == "H" + tagn) {
                        break;
                    }
                    if (titles[index].tagName == "H" + (+tagn + 1)) {
                        result.child.push(generateOutline(titles[index], +tagn + 1));
                    }
                }
            }
            return result;
        };
        return content;
    }

    function appendMess(target, data) {
        var li = $('<li>');
        var a = $('<a>');
        a.attr('href', "#" + escp(data.name));
        a.html(data.name);
        li.html(a);
        li.addClass('depth' + data.depth);
        target.append(li);
        if (data.child.length > 0) {
            var ul = $('<ul>');
            ul.addClass('nav');
            ul.addClass('depth' + (+data.depth + 1));
            li.append(ul);
            data.child.forEach(function (each) {
                appendMess(ul, each);
            });
        }
    }

    var content = getOutLine(titles, 2);
    var olwrap = $('<div>').attr('id', "outline").addClass('widget');//outline wrap
    var title = $('<div>').addClass('outline-title');
    title.html('目录');
    var outline = $('<div>').addClass('outline-content');
    var nav = $('<nav>');
    outline.append(nav);
    var ul = $('<ul>').addClass('nav');
    nav.append(ul);
    $('#sidebar').append(olwrap);
    olwrap.append(title).append(outline);
    if (content[0]) {
        content.forEach(function (lev1) {
            appendMess(ul, lev1);
        })
    }
    scrollSpy.init({nodeList: $("nav a")});
});


(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
    "use strict";

    module.exports = function getOffsetRect(elem) {
        // (1)
        var box = elem.getBoundingClientRect();

        var body = document.body;
        var docElem = document.documentElement;

        // (2)
        var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
        var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;

        // (3)
        var clientTop = docElem.clientTop || body.clientTop || 0;
        var clientLeft = docElem.clientLeft || body.clientLeft || 0;

        // (4)
        var top = box.top + scrollTop - clientTop;
        var left = box.left + scrollLeft - clientLeft;

        return { top: Math.round(top), left: Math.round(left) };
    };

},{}],2:[function(require,module,exports){
    'use strict';

    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

    var scrollSpy = require('./scroll-spy');

    (function (factory) {
        if (typeof define === 'function' && define.amd) {
            define([], factory);
        } else if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object') {
            window.scrollSpy = factory();
        }
    })(function () {

        return scrollSpy;
    });

},{"./scroll-spy":3}],3:[function(require,module,exports){
    'use strict';

    var getOffsetRect = require('./getOffsetRect');
    var util = require('./util');
    var $body = document.body;

    module.exports = {
        init: function init(options) {
            var className = options.activeClassName || 'active';
            var scrollTarget = options.scrollTarget || document;
            var ary = Array.prototype.slice.call(options.nodeList);

            var items = getItems(ary);

            spy(items, className);

            var timer = null
            var last = null

            var outLineHeight = $('#outline').height()

            util.bind(scrollTarget, 'scroll', function () {
                var post = document.getElementsByClassName('post')[0]
                var react = post.getBoundingClientRect()
                var postScroll = - +react.top + 180
                if (document.documentElement.clientHeight < outLineHeight) {
                    if (postScroll / post.scrollHeight > (document.documentElement.clientHeight / outLineHeight) - 0.1) {
                        $('#outline').css("transform", "scale(" + ((document.documentElement.clientHeight / outLineHeight)) + ")")
                    } else {
                        $('#outline').css("transform", "scale(1)")
                    }
                }
                if (!timer) {
                    timer = setTimeout(function () {
                        // var body = document.getElementsByTagName('body')[0]
                        var cur = $('html').scrollTop()
                        if (cur && last) {
                            if (cur - last > 0) {
                                $('#outline').show().removeClass('content-out').addClass('content-in')
                                $('.widget').addClass('blur')
                            } else {
                                if (cur < 1000) {
                                    $('#outline').removeClass('content-in').addClass('content-out')
                                    $('.widget').removeClass('blur')
                                    setTimeout(function () {
                                        $('#outline').hide()
                                    }, 500)
                                }
                            }
                        }
                        last = cur
                        clearTimeout(timer)
                        timer = null
                    }, 200)
                }
            });
        }
    };

    function getItems(ary) {
        var items = [];
        for (var i = 0, l = ary.length; i < l; i++) {
            var id = ary[i].hash.replace(/^#/, '');
            var $target = document.getElementById(id);
            var offset = getOffsetRect($target);
            var height = window.getComputedStyle(document.getElementById(id))['height'];
            items[i] = { height: parseInt(height), top: offset.top, elem: ary[i] };
        }

        return items;
    }

    function spy(items, className) {
        var find = 0;

        for (var i = 0, l = items.length; i < l; i++) {
            if (document.body.scrollTop < items[i].top - items[i].height / 3) {
                find = i;
                break;
            }
        }

        for (var j = 0, _l = items.length; j < _l; j++) {
            util.removeClass(items[j].elem, className);
        }

        if (find > 0) {
            util.addClass(items[find - 1].elem, className);
        }
    }

},{"./getOffsetRect":1,"./util":4}],4:[function(require,module,exports){
    'use strict';

    module.exports = {
        bind: function bind(element, name, listener) {
            element.addEventListener(name, listener, false);
        },

        addClass: function addClass(element, className) {
            var classes = element.className.split(' ');
            if (classes.indexOf(className) < 0) {
                classes.push(className);
            }

            element.className = classes.join(' ');
            return element;
        },

        removeClass: function removeClass(element, className) {
            var classes = element.className.split(' ');
            var index = classes.indexOf(className);
            if (index > -1) {
                classes.splice(index, 1);
            }

            element.className = classes.join(' ');
            return element;
        }
    };

},{}]},{},[2]);