(function () {
'use strict';

var $ = function $(selector, className, type) {
    if (className || type) {
        var dom = document.createElement(selector);
        dom.className = className;
        if (type) {
            dom.setAttribute("type", type);
            if (type === "range") {
                dom.setAttribute("max", 255);
                dom.setAttribute("disabled", "disabled");
            } else {
                dom.setAttribute("readonly", "readonly");
            }
        }
        return dom;
    }
    var results = document.querySelectorAll(selector);
    return results.length === 1 ? results[0] : results;
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();





var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};





















var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

function assert(condition, msg) {
    if (!condition) throw new Error("[jin] " + msg);
}
function checkRGB() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
    }

    args.forEach(function (each) {
        return checkRange(each, 0, 255, "rgb");
    });
}
function checkRange(target, min, max, msg) {
    assert(+target < max + 1 && +target > min - 1, "invalid " + msg + ": " + target);
}

var Color = function () {
    function Color(_ref) {
        var r = _ref.r,
            g = _ref.g,
            b = _ref.b;
        classCallCheck(this, Color);

        checkRGB(r, g, b);
        this.rgb = { r: r, g: g, b: b };
        this.hsb = this.getHSB(r, g, b);
    }

    createClass(Color, [{
        key: "getHSB",
        value: function getHSB(r, g, bl) {
            r = +r;
            g = +g;
            bl = +bl;
            var max = Math.max(r, g, bl);
            var min = Math.min(r, g, bl);
            var diff = max - min;
            var b = max / 255 * 100;
            var s = max === 0 ? 0 : (1 - min / max) * 100;
            var h = void 0;
            switch (max) {
                case min:
                    h = 0;
                    break;
                case r:
                    h = g >= bl ? 60 * (g - bl) / diff : 60 * (g - bl) / diff + 360;
                    break;
                case g:
                    h = 60 * (bl - r) / diff + 120;
                    break;
                case bl:
                    h = 60 * (r - g) / diff + 240;
                    break;
            }
            return { h: h, s: s, b: b };
        }
    }, {
        key: "getRGB",
        value: function getRGB(h, s, br) {
            h = +h;
            s = +s;
            br = +br;
            s = s / 100;
            br = br * 255 / 100;
            var hi = Math.floor(h / 60 % 6);
            var f = h / 60 - hi;
            var p = br * (1 - s);
            var q = br * (1 - f * s);
            var t = br * (1 - (1 - f) * s);
            var r = void 0,
                g = void 0,
                b = void 0;
            switch (hi) {
                case 0:
                    r = br;
                    g = t;
                    b = p;

                    break;
                case 1:
                    r = q;
                    g = br;
                    b = p;

                    break;
                case 2:
                    r = p;
                    g = br;
                    b = t;

                    break;
                case 3:
                    r = p;
                    g = q;
                    b = br;

                    break;
                case 4:
                    r = t;
                    g = p;
                    b = br;

                    break;
                case 5:
                    r = br;
                    g = p;
                    b = q;

                    break;
            }
            return { r: r, g: g, b: b };
        }
    }, {
        key: "setHSB",
        value: function setHSB() {
            var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
                _ref2$h = _ref2.h,
                h = _ref2$h === undefined ? this.hsb.h : _ref2$h,
                _ref2$s = _ref2.s,
                s = _ref2$s === undefined ? this.hsb.s : _ref2$s,
                _ref2$b = _ref2.b,
                b = _ref2$b === undefined ? this.hsb.b : _ref2$b;

            checkRange(h, 0, 359, "hue");
            checkRange(s, 0, 100, "saturation");
            checkRange(b, 0, 100, "brightness");
            this.hsb = { h: h, s: s, b: b };
            this.rgb = this.getRGB(h, s, b);
            return this;
        }
    }, {
        key: "setRGB",
        value: function setRGB() {
            var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
                _ref3$r = _ref3.r,
                r = _ref3$r === undefined ? this.rgb.r : _ref3$r,
                _ref3$g = _ref3.g,
                g = _ref3$g === undefined ? this.rgb.g : _ref3$g,
                _ref3$b = _ref3.b,
                b = _ref3$b === undefined ? this.rgb.b : _ref3$b;

            checkRGB(r, g, b);
            this.rgb = { r: r, g: g, b: b };
            this.hsb = this.getHSB(r, g, b);
            return this;
        }
    }, {
        key: "toString",
        value: function toString() {
            return "#" + padDigit(this.rgb.r.toString(16)) + padDigit(this.rgb.g.toString(16)) + padDigit(this.rgb.b.toString(16));
        }
    }, {
        key: "rgb",
        set: function set$$1(rgb) {
            this._rgb = rgb;
        },
        get: function get$$1() {
            return {
                r: Math.round(this._rgb.r),
                g: Math.round(this._rgb.g),
                b: Math.round(this._rgb.b)
            };
        }
    }, {
        key: "hsb",
        set: function set$$1(hsb) {
            this._hsb = hsb;
        },
        get: function get$$1() {
            return {
                h: Math.round(this._hsb.h),
                s: Math.round(this._hsb.s),
                b: Math.round(this._hsb.b)
            };
        }
    }]);
    return Color;
}();

function padDigit(origin) {
    return origin.length === 1 ? "0" + origin : origin;
}
function parseHex(r, g, b) {
    assert(arguments.length === 1 || arguments.length === 3, "incorrect color string");
    if (arguments.length === 3) {
        return { r: r, g: g, b: b };
    } else {
        r[0] === "#" && (r = r.slice(1));
        assert(/^[0-9a-f]{3}$/.test(r) || /^[0-9a-f]{6}$/.test(r), "incorrect color string");
        if (r.length === 3) {
            r = "" + r[0] + r[0] + r[1] + r[1] + r[2] + r[2];
        }
        r = ["" + r[0] + r[1], "" + r[2] + r[3], "" + r[4] + r[5]];

        var _r$map = r.map(function (hex) {
            return parseInt(hex, 16);
        }),
            _r$map2 = slicedToArray(_r$map, 3),
            red = _r$map2[0],
            _g = _r$map2[1],
            _b = _r$map2[2];

        return { r: red, g: _g, b: _b };
    }
}
var jin = function () {
    return new Color(parseHex.apply(undefined, arguments));
};

var main = $("#display");

var ColorBlock = function () {
    function ColorBlock() {
        var r = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 255;

        var _this = this;

        var g = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 255;
        var b = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 255;
        classCallCheck(this, ColorBlock);

        // dom init
        this.dom_wrapper = $("div", "wrapper");
        main.appendChild(this.dom_wrapper);
        // ---
        this.dom_color_board = $("div", "color-board");
        this.dom_wrapper.appendChild(this.dom_color_board);
        // ---
        this.dom_code = $("div", "code");
        this.dom_wrapper.appendChild(this.dom_code);
        // ---
        this.dom_r = $("div", "code-child r");
        this.dom_r.appendChild($("input", "", "range"));
        this.dom_g = $("div", "code-child g");
        this.dom_g.appendChild($("input", "", "range"));
        this.dom_b = $("div", "code-child b");
        this.dom_b.appendChild($("input", "", "range"));
        this.dom_hex = $("div", "code-child hex");
        this.dom_hex.appendChild($("input", "", "text"));
        this.dom_code.appendChild(this.dom_r);
        this.listenChange(this.dom_r, "r");
        this.dom_code.appendChild(this.dom_g);
        this.listenChange(this.dom_g, "g");
        this.dom_code.appendChild(this.dom_b);
        this.listenChange(this.dom_b, "b");
        this.dom_code.appendChild(this.dom_hex);
        this.dom_hex.addEventListener("change", function () {
            var rgb = parseHex(_this.dom_hex.firstElementChild.value);
            _this.jin.setRGB(rgb);
            _this.setColor();
        });
        // ---
        // color init
        this.jin = jin(r, g, b);
        this.setColor();
    }

    createClass(ColorBlock, [{
        key: "enableEdit",
        value: function enableEdit() {
            this.editabble = true;
            this.dom_r.firstElementChild.removeAttribute("disabled");
            this.dom_g.firstElementChild.removeAttribute("disabled");
            this.dom_b.firstElementChild.removeAttribute("disabled");
            this.dom_hex.firstElementChild.removeAttribute("readonly");
        }
    }, {
        key: "listenChange",
        value: function listenChange(dom, key) {
            var _this2 = this;

            var emit = function emit(value) {
                _this2.jin.setRGB(defineProperty({}, key, value));
                _this2.setColor();
            };
            var moveListener = function moveListener() {
                emit(this.firstElementChild.value);
            };
            dom.addEventListener("mousedown", function () {
                var _this3 = this;

                setTimeout(function () {
                    emit(_this3.firstElementChild.value);
                });
                dom.addEventListener("mousemove", moveListener);
                dom.addEventListener("mouseup", function () {
                    dom.removeEventListener("mousemove", moveListener);
                });
            });
        }
    }, {
        key: "setColor",
        value: function setColor() {
            this.dom_color_board.style.backgroundColor = this.jin.toString();
            this.setCodeStatus();
            if (this.hook) {
                this.hook();
            }
        }
    }, {
        key: "setCodeStatus",
        value: function setCodeStatus() {
            this.dom_hex.firstElementChild.value = this.jin.toString();
            this.dom_r.firstElementChild.value = this.jin.rgb.r;
            this.renderGradient(this.dom_r, "r", this.jin.rgb);
            this.dom_g.firstElementChild.value = this.jin.rgb.g;
            this.renderGradient(this.dom_g, "g", this.jin.rgb);
            this.dom_b.firstElementChild.value = this.jin.rgb.b;
            this.renderGradient(this.dom_b, "b", this.jin.rgb);
        }
    }, {
        key: "renderGradient",
        value: function renderGradient(dom, which, _ref) {
            var r = _ref.r,
                g = _ref.g,
                b = _ref.b;

            var from = { r: r, g: g, b: b };
            var to = { r: r, g: g, b: b };
            var transferToCss = function transferToCss(color) {
                return "rgb(" + color.r + ", " + color.g + ", " + color.b + ")";
            };
            from[which] = 0;
            to[which] = 255;
            dom.style.background = "linear-gradient(to right, " + transferToCss(from) + ", " + transferToCss(to) + ")";
        }
    }, {
        key: "addHue",
        value: function addHue(number) {
            var hue = this.jin.hsb.h;
            var added = hue + number;
            if (added >= 360) {
                added %= 360;
            }
            if (added < 0) {
                added += 360;
            }
            this.jin.setHSB({ h: added });
            this.setColor();
        }
    }, {
        key: "setHSB",
        value: function setHSB(_ref2) {
            var h = _ref2.h,
                s = _ref2.s,
                b = _ref2.b;

            if (s > 100) {
                s = 100;
            }
            if (s < 0) {
                s = 0;
            }
            if (b > 100) {
                b = 100;
            }
            if (b < 0) {
                b = 0;
            }
            if (h >= 360) {
                h %= 360;
            }
            if (h < 0) {
                h += 360;
            }
            this.jin.setHSB({ h: h, s: s, b: b });
            this.setColor();
        }
    }, {
        key: "addHook",
        value: function addHook(hook) {
            this.hook = hook;
        }
    }, {
        key: "destroy",
        value: function destroy() {
            main.removeChild(this.dom_wrapper);
        }
    }]);
    return ColorBlock;
}();

var ColorBlocks = function () {
    function ColorBlocks() {
        classCallCheck(this, ColorBlocks);

        this.blocks = [];
    }

    createClass(ColorBlocks, [{
        key: "amendLength",
        value: function amendLength(count) {
            count = +count;
            if (isNaN(count) || count < 0) {
                return;
            }
            if (count < this.blocks.length) {
                for (var _count = this.blocks.length - count; _count > 0; _count--) {
                    this.blocks[this.blocks.length - 1].destroy();
                    this.blocks.pop();
                }
            }
            if (count > this.blocks.length) {
                for (var _count2 = count - this.blocks.length; _count2 > 0; _count2--) {
                    this.blocks.push(new ColorBlock());
                }
            }
        }
    }, {
        key: "setOptions",
        value: function setOptions(options) {
            this.options = options;
        }
    }, {
        key: "render",
        value: function render() {
            for (var i = 1; i < this.blocks.length; i++) {
                if (isNaN(this.blocks[i - 1].jin.hsb.h + this.options.h[i - 1])) {
                    console.log(this.blocks[i - 1].jin.hsb);
                }
                this.blocks[i].setHSB({
                    h: this.blocks[i - 1].jin.hsb.h + this.options.h[i - 1],
                    s: this.blocks[i - 1].jin.hsb.s + this.options.s[i - 1],
                    b: this.blocks[i - 1].jin.hsb.b + this.options.b[i - 1]
                });
            }
        }
    }]);
    return ColorBlocks;
}();

var blocks = new ColorBlocks();

var formatOption = function formatOption(option, length) {
    var result = Array.from({ length: length }).map(function (_) {
        return 0;
    });
    if (!isNaN(+option) || option.split(" ").reduce(function (l, f) {
        return l && !isNaN(f);
    }, true)) {
        if (!isNaN(+option)) {
            result = result.map(function (_) {
                return option;
            });
        } else {
            var padding = function padding(result, length) {
                return result.length >= length ? result : padding(result.concat(result), length);
            };
            result = padding(result, length);
        }
    }
    return result.map(function (_) {
        return +_;
    });
};

var changeOptions = function changeOptions() {
    var count = $("#count").value;
    var h = $("#hue").value;
    var s = $("#saturation").value;
    var b = $("#brightness").value;
    blocks.amendLength(count);
    blocks.setOptions({
        h: formatOption(h, count),
        s: formatOption(s, count),
        b: formatOption(b, count)
    });
    blocks.render();
    blocks.blocks[0].enableEdit();
    blocks.blocks[0].addHook(blocks.render.bind(blocks));
};

$("#count").addEventListener("change", changeOptions);
$("#hue").addEventListener("change", changeOptions);
$("#saturation").addEventListener("change", changeOptions);
$("#brightness").addEventListener("change", changeOptions);

}());
