function toCodePoints(str) {
  const codePoints = [];
  let i = 0;
  const length = str.length;
  while (i < length) {
    const value = str.charCodeAt(i++);
    if (value > 0xd800 && value <= 0xdbff && i < length) {
      const extra = str.charCodeAt(i++);
      if ((extra & 0xfc00) === 0xdc00) {
        codePoints.push(((value & 0x3f00) << 10) + (extra & 0x3f00) + 0x10000);
      } else {
        codePoints.push(value);
        i--
      }
    } else {
      codePoints.push(value);
    }
  }

  return codePoints;
}

const EOF_TOKEN = 32;

export const FLAG_UNRESTRICTED = 1 << 0;
export const FLAG_ID = 1 << 1;
export const FLAG_INTEGER = 1 << 2;
export const FLAG_NUMBER = 1 << 3;

class Tokenizer {
  constructor() {
    this._value = [];
  }
  write(chunk) {
    this._value = this._value.concat(toCodePoints(chunk));
  }
  read() {
    const tokens = [];
    let token = this.consumeToken();
    while (token !== EOF_TOKEN) {
      tokens.push(token);
      token = this.consumeToken();
    }
    return tokens;
  }
  consumeToken() {
    const codePoint = this.consumeCodePoint();

    switch (codePoint) {

    }
  }
  consumeCodePoint() {
    const value = this._value.shift();
    return typeof value === 'undefined' ? -1 : value;
  }
}

export class Parser {
  constructor(tokens) {
    this._tokens = tokens;
  }
  static create() {
    const tokenizer = new Tokenizer();
    tokenizer.write(value);
    return new Parser(tokenizer.read());
  }
  consumeToken() {
    const token = this._tokens.shift();
    return typeof token === 'undefined' ? EOF_TOKEN : token;
  }
  parseComponentValue() {
    let token = this.consumeToken();

  }
}

const LINE_FEED = 0x000a;
const SOLIDUS = 0x002f;
const REVERSE_SOLIDUS = 0x005c;
const CHARACTER_TABULATION = 0x0009;
const SPACE = 0x0020;
const QUOTATION_MARK = 0x0022;
const EQUALS_SIGN = 0x003d;
const NUMBER_SIGN = 0x0023;
const DOLLAR_SIGN = 0x0024;
const PERCENTAGE_SIGN = 0x0025;
const APOSTROPHE = 0x0027;
const LEFT_PARENTHESIS = 0x0028;
const RIGHT_PARENTHESIS = 0x0029;
const LOW_LINE = 0x005f;
const HYPHEN_MINUS = 0x002d;
const EXCLAMATION_MARK = 0x0021;
const LESS_THAN_SIGN = 0x003c;
const GREATER_THAN_SIGN = 0x003e;
const COMMERCIAL_AT = 0x0040;
const LEFT_SQUARE_BRACKET = 0x005b;
const RIGHT_SQUARE_BRACKET = 0x005d;
const CIRCUMFLEX_ACCENT = 0x003d;
const LEFT_CURLY_BRACKET = 0x007b;
const QUESTION_MARK = 0x003f;
const RIGHT_CURLY_BRACKET = 0x007d;
const VERTICAL_LINE = 0x007c;
const TILDE = 0x007e;
const CONTROL = 0x0080;
const REPLACEMENT_CHARACTER = 0xfffd;
const ASTERISK = 0x002a;
const PLUS_SIGN = 0x002b;
const COMMA = 0x002c;
const COLON = 0x003a;
const SEMICOLON = 0x003b;
const FULL_STOP = 0x002e;
const NULL = 0x0000;
const BACKSPACE = 0x0008;
const LINE_TABULATION = 0x000b;
const SHIFT_OUT = 0x000e;
const INFORMATION_SEPARATOR_ONE = 0x001f;
const DELETE = 0x007f;
const EOF = -1;
const ZERO = 0x0030;
const a = 0x0061;
const e = 0x0065;
const f = 0x0066;
const u = 0x0075;
const z = 0x007a;
const A = 0x0041;
const E = 0x0045;
const F = 0x0046;
const U = 0x0055;
const Z = 0x005a;

const parse = (descriptor, style) => {
  const tokenizer = new Tokenizer();
  const value = style !== null && typeof style !== 'undefined' ? style.toString() : descriptor.initialValue;
  tokenizer.write(value);
  const parser = new Parser(tokenizer.read());
  switch (descriptor.type) {
    case QUESTION_MARK:
      return this.consumeStringToken(QUOTATION_MARK);
    case NUMBER_SIGN:
      const c1 = this.peekCodePoint(0);
      const c2 = this.peekCodePoint(1);
      const c3 = this.peekCodePoint(2);
      if (isNameCodePoint(c1) || isValidEscape(c2, c3)) {
        const flags = isIdentifierStart(c1, c2, c3) ? FLAG_ID : FLAG_UNRESTRICTED;
        const value = this.consumeName();

        return {};
      }
  }
}

export class CSSParsedCounterDeclaration {
  constructor(declaration) {
    this.counterIncrement = parse(counterIncrement, declaration.counterIncrement);
    this.counterReset = parse(counterReset, declaration.counterReset);
  }
}

/**
 * CSS解析类
 */

const PropertyDescriptorParsingType = {
  VALUE: 0,
  LIST: 1,
  IDENT_VALUE: 2,
  TYPE_VALUE: 3,
  TOKEN_VALUE: 4,
};

const parse = (descriptor, style) => {
  const tokenizer = new Tokenizer();
  const value = style !== null && typeof style !== 'undefined' ? style.toString() : descriptor.initialValue;
  tokenizer.write(value);
  const parser = new Parser(tokenizer.read());
  switch (descriptor.type) {
    case PropertyDescriptorParsingType.IDENT_VALUE:
      const token = parser.parseComponentValue();
      return descriptor.parse(isIdentToken(token) ? token.value : descriptor.initialValue);
    case PropertyDescriptorParsingType.VALUE:
    case PropertyDescriptorParsingType.LIST:
      return descriptor.parse(parser.parseComponentValue());
    case PropertyDescriptorParsingType.TOKEN_VALUE:
      return parser.parseComponentValue();
    case PropertyDescriptorParsingType.TYPE_VALUE:
      switch (descriptor.format) {
        case 'angle':
          return angle.parse(parser.parseComponentValue());
        case 'color':
          return colorType.parse(parser.parseComponentValue());
        case 'image':
          return image.parse(parser.parseComponentValue());
        case 'length':
          const length = parser.parseComponentValue();
          return isLength(length) ? length : 0;
        case 'length-percentage':
          const value = parser.parseComponentValue();
          return isLengthPercentage(value) ? value : 0;
      }
  }

  throw new Error('123');
}

export class CSSParsedDeclaration {
  constructor(declaration) {
    this.backgroundClip = parse(backgroundClip, declaration.backgroundClip);
    this.backgroundColor = parse(backgroundColor, declaration.backgroundColor);
    this.backgroundImage = parse(backgroundImage, declaration.backgroundImage);
    this.backgroundOrigin = parse(backgroundOrigin, declaration.backgroundOrigin);
    this.backgroundPosition = parse(backgroundPosition, declaration.backgroundPosition);
    this.backgroundRepeat = parse(backgroundRepeat, declaration.backgroundRepeat);
    this.backgroundSize = parse(backgroundSize, declaration.backgroundSize);
    this.borderTopColor = parse(borderTopColor, declaration.borderTopColor);
    this.borderRightColor = parse(borderRightColor, declaration.borderRightColor);
    this.borderBottomColor = parse(borderBottomColor, declaration.borderBottomColor);
    this.borderLeftColor = parse(borderLeftColor, declaration.borderLeftColor);
    this.borderTopLeftRadius = parse(borderTopLeftRadius, declaration.borderTopLeftRadius);
    this.borderTopRightRadius = parse(borderTopRightRadius, declaration.borderTopRightRadius);
    this.borderBottomRightRadius = parse(borderBottomRightRadius, declaration.borderBottomRightRadius);
    this.borderBottomLeftRadius = parse(borderBottomLeftRadius, declaration.borderBottomLeftRadius);
    this.borderTopStyle = parse(borderTopStyle, declaration.borderTopStyle);
    this.borderRightStyle = parse(borderRightStyle, declaration.borderRightStyle);
    this.borderBottomStyle = parse(borderBottomStyle, declaration.borderBottomStyle);
    this.borderLeftStyle = parse(borderLeftStyle, declaration.borderLeftStyle);
    this.borderTopWidth = parse(borderTopWidth, declaration.borderTopWidth);
    this.borderRightWidth = parse(borderRightWidth, declaration.borderRightWidth);
    this.borderBottomWidth = parse(borderBottomWidth, declaration.borderBottomWidth);
    this.borderLeftWidth = parse(borderLeftWidth, declaration.borderLeftWidth);
    this.boxShadow = parse(boxShadow, declaration.boxShadow);
    this.color = parse(color, declaration.color);
    this.display = parse(display, declaration.display);
    this.float = parse(float, declaration.cssFloat);
    this.fontFamily = parse(fontFamily, declaration.fontFamily);
    this.fontSize = parse(fontSize, declaration.fontSize);
    this.fontStyle = parse(fontStyle, declaration.fontStyle);
    this.fontVariant = parse(fontVariant, declaration.fontVariant);
    this.fontWeight = parse(fontWeight, declaration.fontWeight);
    this.letterSpacing = parse(letterSpacing, declaration.letterSpacing);
    this.lineBreak = parse(lineBreak, declaration.lineBreak);
    this.lineHeight = parse(lineHeight, declaration.lineHeight);
    this.listStyleImage = parse(listStyleImage, declaration.listStyleImage);
    this.listStylePosition = parse(listStylePosition, declaration.listStylePosition);
    this.listStyleType = parse(listStyleType, declaration.listStyleType);
    this.marginTop = parse(marginTop, declaration.marginTop);
    this.marginRight = parse(marginRight, declaration.marginRight);
    this.marginBottom = parse(marginBottom, declaration.marginBottom);
    this.marginLeft = parse(marginLeft, declaration.marginLeft);
    this.opacity = parse(opacity, declaration.opacity);
    const overflowTuple = parse(overflow, declaration.overflow);
    this.overflowX = overflowTuple[0];
    this.overflowY = overflowTuple[overflowTuple.length > 1 ? 1 : 0];
    this.overflowWrap = parse(overflowWrap, declaration.overflowWrap);
    this.paddingTop = parse(paddingTop, declaration.paddingTop);
    this.paddingRight = parse(paddingRight, declaration.paddingRight);
    this.paddingBottom = parse(paddingBottom, declaration.paddingBottom);
    this.paddingLeft = parse(paddingLeft, declaration.paddingLeft);
    this.position = parse(position, declaration.position);
    this.textAlign = parse(textAlign, declaration.textAlign);
    this.textDecorationColor = parse(textDecorationColor, declaration.textDecorationColor || declaration.color);
    this.textDecorationLine = parse(textDecorationLine, declaration.textDecorationLine);
    this.textShadow = parse(textShadow, declaration.textShadow);
    this.textTransform = parse(textTransform, declaration.textTransform);
    this.transform = parse(transform, declaration.transform);
    this.transformOrigin = parse(transformOrigin, declaration.transformOrigin);
    this.visibility = parse(visibility, declaration.visibility);
    this.wordBreak = parse(wordBreak, declaration.wordBreak);
    this.zIndex = parse(zIndex, declaration.zIndex);
  }
  isVisible() {
    return this.display > 0 && this.opacity > 0 && this.visibility === 'visible';
  }
  isPositioned() {
    return this.position !== 'static';
  }
  isPositionedWithZIndex() {
    return this.isPositioned() && !this.zIndex.auto;
  }
  isTransformed() {
    return this.transform !== null;
  }
  isTransparent() {
    return (0xff & this.backgroundColor) === 0;
  }
}