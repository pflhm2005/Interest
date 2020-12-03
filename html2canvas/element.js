import { parseBounds, isHTMLElementNode, Bounds } from "./document";
import { CSSParsedDeclaration } from "./parser";
import { CacheStorage } from './storage';

export const FLAGS = {
  CREATES_STACKING_CONTEXT: 1 << 1,
  CREATES_REAL_STACKING_CONTEXT: 1 << 2,
  IS_LIST_OWNER: 1 << 3,
};

const BORDER_STYLE = {
  NONE: 0,
  SOLID: 1,
};

const BACKGROUND_CLIP = {
  BORDER_BOX: 0,
  PADDING_BOX: 1,
  CONTENT_BOX: 2,
};

const BACKGROUND_ORIGIN = {
  BORDER_BOX: 0,
  PADDING_BOX: 1,
  CONTENT_BOX: 2,
};

export class ElementContainer {
  constructor(element) {
    this.styles = new CSSParsedDeclaration(window.getComputedStyle(element, null));
    this.textNodes = [];
    this.elements = [];
    if (this.styles.transform !== null && isHTMLElementNode(element)) {
      element.style.transform = 'none';
    }
    this.bounds = parseBounds(element);
    this.flags = 0;
  }
}

export class ImageElementContainer extends ElementContainer {
  constructor(img) {
    super(img);
    this.src = img.currentSrc || img.src;
    this.intrinsicWidth = img.naturalWidth;
    this.intrinsicHeight = img.naturalHeight;
    CacheStorage.getInstance().addImage(this.src);
  }
}

export class CanvasElementContainer extends ElementContainer {
  constructor(canvas) {
    super(canvas);
    this.canvas = canvas;
    this.intrinsicWidth = canvas.width;
    this.intrinsicHeight = canvas.height;
  }
}

export class SVGElementContainer extends ElementContainer {
  constructor(img) {
    super(img);
    const s = new XMLSerializer();
    this.svg = `data:image/svg+xml,${encodeURIComponent(s.serializeToString(img))}`;
    this.intrinsicWidth = img.width.baseVal.value;
    this.intrinsicHeight = img.height.baseVal.value;
  }
}

export class LIElementContainer extends ElementContainer {
  constructor(element) {
    super(element);
    this.value = element.value;
  }
}

export class OLElementContainer extends ElementContainer {
  constructor(element) {
    super(element);
    this.start = element.start;
    this.reversed = typeof element.reversed === 'boolean' && element.reversed === true;
  }
}

const CHECKBOX_BORDER_RADIUS = '3px';
const RADIO_BORDER_RADIUS = 50;

const reformatInputBounds = (bounds) => {
  if (bounds.width < bounds.height) {
    return new Bounds(bounds.left + (bounds.width - bounds.height) / 2, bounds.top, bounds.height, bounds.height);
  } else if (bounds.width < bounds.height) {
    return new Bounds(bounds.left, bounds.top + (bounds.height - bounds.width) / 2, bounds.width, bounds.width);
  }
  return bounds;
}

const getInputValue = (node) => {
  // \u2022 => •
  // 如果是密码 只会返回对应位数的星号
  const value = node.type === PASSWORD ? new Array(node.value.length + 1).join('\u2022') : node.value;
  return value.length === 0 ? node.placeholder || '' : value;
}

export const CHECKBOX = 'checkbox';
export const RADIO = 'radio';
export const PASSWORD = 'password';
export const INPUT_COLOR = 0x2a2a2aff;

export class InputElementContainer extends ElementContainer {
  constructor(input) {
    super(input);
    this.type = input.type.toLowerCase();
    this.checked = input.checked;
    this.value = getInputValue(input);

    if (this.type === CHECKBOX || this.type === RADIO) {
      this.styles.backgroundColor = 0xdededeff;
      this.styles.borderTopColor = this.styles.borderRightColor = this.styles.borderBottomColor = this.styles.borderLeftColor = 0xa5a5a5ff;
      this.styles.borderTopWidth = this.styles.borderRightWidth = this.styles.borderBottomWidth = this.styles.borderLeftWidth = 1;
      this.styles.borderTopStyle = this.styles.borderRightStyle = this.styles.borderBottomStyle = this.styles.borderLeftStyle = BORDER_STYLE.SOLID;
      this.styles.backgroundClip = [BACKGROUND_CLIP.BORDER_BOX];
      this.styles.backgroundOrigin = [BACKGROUND_ORIGIN.BORDER_BOX];
      this.bounds = reformatInputBounds(this.bounds);
    }

    switch (this.type) {
      case CHECKBOX:
        this.styles.borderTopRightRadius = this.styles.borderTopLeftRadius = this.styles.borderBottomRightRadius = this.styles.borderBottomLeftRadius = CHECKBOX_BORDER_RADIUS;
        break;
      case RADIO:
        this.styles.borderTopRightRadius = this.styles.borderTopLeftRadius = this.styles.borderBottomRightRadius = this.styles.borderBottomLeftRadius = RADIO_BORDER_RADIUS;
        break;
    }
  }
}

export class SelectElementContainer extends ElementContainer {
  constructor(element) {
    super(element);
    const option = element.options[element.selectedIndex || 0];
    this.value = option ? option.text || '' : '';
  }
}

export class TextareaElementContainer extends ElementContainer {
  constructor(element) {
    super(element);
    this.value = element.value;
  }
}

export class IFrameElementContainer extends ElementContainer {
  // 
}

export class TextContainer {
  constructor(node, styles) {
    // this.text = transform(node.data, styles.textTransform);
    // this.textBounds = parseTextBounds(this.text, styles, node);
  }
}

export const DISPLAY = {
  NONE: 0,
  BLOCK: 1 << 1,
  INLINE: 1 << 2,
  RUN_IN: 1 << 3,
  FLOW: 1 << 4,
  FLOW_ROOT: 1 << 5,
  TABLE: 1 << 6,
  FLEX: 1 << 7,
  GRID: 1 << 8,
  RUBY: 1 << 9,
  SUBGRID: 1 << 10,
  LIST_ITEM: 1 << 11,
  TABLE_ROW_GROUP: 1 << 12,
  TABLE_HEADER_GROUP: 1 << 13,
  TABLE_FOOTER_GROUP: 1 << 14,
  TABLE_ROW: 1 << 15,
  TABLE_CELL: 1 << 16,
  TABLE_COLUMN_GROUP: 1 << 17,
  TABLE_COLUMN: 1 << 18,
  TABLE_CAPTION: 1 << 19,
  RUBY_BASE: 1 << 20,
  RUBY_TEXT: 1 << 21,
  RUBY_BASE_CONTAINER: 1 << 22,
  RUBY_TEXT_CONTAINER: 1 << 23,
  CONTENTS: 1 << 24,
  INLINE_BLOCK: 1 << 25,
  INLINE_LIST_ITEM: 1 << 26,
  INLINE_TABLE: 1 << 27,
  INLINE_FLEX: 1 << 28,
  INLINE_GRID: 1 << 29
};