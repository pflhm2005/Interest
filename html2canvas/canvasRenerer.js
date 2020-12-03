import { CanvasElementContainer, DISPLAY, FLAGS, IFrameElementContainer, ImageElementContainer, InputElementContainer, LIElementContainer, OLElementContainer, SVGElementContainer } from './element';
import { isTransparent } from './color'

const SMALL_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const SAMPLE_TEXT = 'Hidden Text';

class FontMetrics {
  constructor(document) {
    this._data = {};
    this._document = document;
  }
  parseMetrics(fontFamily, fontSize) {
    const container = this._document.createElement('div');
    const img = this._document.createElement('img');
    const span = this._document.createElement('span');

    const body = this._document.body;

    container.style.visibility = 'hidden';
    container.style.fontFamily = fontFamily;
    container.style.fontSize = fontSize;
    container.style.margin = '0';
    container.style.padding = '0';

    body.appendChild(container);

    img.src = SMALL_IMAGE;
    img.width = 1;
    img.height = 1;

    img.style.margin = '0';
    img.style.padding = '0';
    img.style.verticalAlign = 'baseline';

    span.style.fontFamily = fontFamily;
    span.style.fontSize = fontSize;
    span.style.margin = '0';
    span.style.padding = '0';

    span.appendChild(this._document.createTextNode(SAMPLE_TEXT));
    container.appendChild(span);
    container.appendChild(img);
    const baseline = img.offsetTop - span.offsetTop + 2;

    container.removeChild(span);
    container.appendChild(this._document.createTextNode(SAMPLE_TEXT));

    container.style.lineHeight = 'normal';
    img.style.verticalAlign = 'super';

    const middle = img.offsetTop - container.offsetTop + 2;

    body.removeChild(container);

    return { baseline, middle };
  }
  getMetrics(fontFamily, fontSize) {
    const key = `${fontFamily} ${fontSize}`;
    if (typeof this._data[key] === 'undefined') {
      this._data[key] = this.parseMetrics(fontFamily, fontSize);
    }

    return this._data[key];
  }
}

const asString = (color) => {
  const alpha = 0xff & color;
  const blue = 0xff & (color >> 8);
  const green = 0xff & (color >> 16);
  const red = 0xff & (color >> 24);
  return alpha < 255 ? `rgba(${red},${green},${blue},${alpha / 255})` : `rgb(${red},${green},${blue})`;
}

const EffectTarget = {
  BACKGROUND_BORDERS: 1 << 1,
  CONTENT: 1 << 2
};

const MASK_OFFSET = 10000;

const BORDER_STYLE = {
  NONE: 0,
  SOLID: 1,
};

// COLOR
const CSSImageType = {
  URL: 0,
  LINEAR_GRADIENT: 1,
  RADIAL_GRADIENT: 2,
};
const isLinearGradient = background => background.type === CSSImageType.LINEAR_GRADIENT;
const isRadialGradient = background => background.type === CSSImageType.RADIAL_GRADIENT;

export class CanvasRenderer {
  constructor(options) {
    this.canvas = options.canvas ? options.canvas : document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.options = options;
    if (!options.canvas) {
      this.canvas.width = Math.floor(options.width * options.scale);
      this.canvas.height = Math.floor(options.height * options.scale);
      this.canvas.style.width = `${options.width}px`;
      this.canvas.style.height = `${options.height}px`;
    }
    this.fontMetrics = new FontMetrics(document);
    this.ctx.scale(this.options.scale, this.options.scale);
    this.ctx.translte(-options.x + options.scrollX, -options.y + options.scrollY);
    this.ctx.textBaseline = 'bottom';
    this._activeEffects = [];
  }

  path(paths) {
    this.ctx.beginPath();
    this.formatPath(paths);
    this.ctx.closePath();
  }
  formatPath(paths) {
    paths.forEach((point, index) => {
      const start = isBezierCurve(point) ? point.start : point;
      if (index === 0) {
        this.ctx.moveTo(start.x, start.y);
      } else {
        this.ctx.lineTo(start.x, start.y);
      }

      if (isBezierCurve(point)) {
        this.ctx.bezierCurveTo(
          point.startControl.x, point.startControl.y,
          point.endControl.x, point.endControl.y,
          point.end.x, point.end.y
        );
      }
    })
  }

  async render(element) {
    if (this.options.backgroundColor) {
      // 将十六进制颜色转换为rgb、rgba
      this.ctx.fillStyle = asString(this.options.backgroundColor);
      this.ctx.fillRect(
        this.options.x - this.options.scrollX,
        this.options.y - this.options.scrollY,
        this.options.width,
        this.options.height
      );
    }

    const stack = parseStackingContexts(element);

    await this.renderStack(stack);
    this.applyEffects([], EffectTarget.BACKGROUND_BORDERS);
    return this.canvas;
  }
  async renderStack(stack) {
    const styles = stack.element.container.styles;
    if (styles.isVisible()) {
      this.ctx.globalAlpha = styles.opacity;
      await this.renderStackContent(stack);
    }
  }
  /**
   * 绘制图层
   * 1. 绘制边框、阴影、背景色
   * 2. 渲染文本、图片、Canvas、Iframe、SVG、Input、LI节点
   * 3. 渲染非行内元素
   * 4. 渲染非定位浮动元素
   * 5. 渲染非浮动非定位元素
   * 6. 渲染行内元素
   * 7. 渲染ZIndex为0、透明度小于1、transform的元素
   * 8. 渲染ZIndex大于0的元素
   */
  async renderStackContent(stack) {
    await this.renderNodeBackgroundAndBorders(stack.element);
    for (const child of stack.negativeZIndex) {
      await this.renderStack(child);
    }
    await this.renderNodeContent(stack.element);
    for (const child of stack.nonInlineLevel) {
      await this.renderNode(child);
    }
    for (const child of stack.nonPositionedFloats) {
      await this.renderStack(child);
    }
    for (const child of stack.nonPositionedInlineLevel) {
      await this.renderStack(child);
    }
    for (const child of stack.inlineLevel) {
      await this.renderNode(child);
    }
    for (const child of stack.zeroOrAutoZIndexOrTransformedOrOpacity) {
      await this.renderStack(child);
    }
    for (const child of stack.positiveZIndex) {
      await this.renderStack(child);
    }
  }

  async renderNodeBackgroundAndBorders(paint) {
    this.applyEffects(paint.effects, EffectTarget.BACKGROUND_BORDERS);
    const styles = paint.container.styles;
    const hasBackground = !isTransparent(styles.backgroundColor) || styles.backgroundImage.length;

    const borders = [
      { styles: styles.borderTopStyle, color: styles.borderTopColor },
      { style: styles.borderRightStyle, color: styles.borderRightColor },
      { style: styles.borderBottomStyle, color: styles.borderBottomColor },
      { style: styles.borderLeftStyle, color: styles.borderLeftColor }
    ];

    const backgroundPaintingArea = calculateBackgroundCurvedPaintingArea(
      getBackgroundValueForIndex(styles.backgroundClip, 0),
      paint.curves
    );

    if (hasBackground || styles.boxShadow.length) {
      this.ctx.save();
      this.path(backgroundPaintingArea);
      this.ctx.clip();
      if (!isTransparent(styles.backgroundColor)) {
        this.ctx.fillStyle = asString(styles.backgroundColor);
        this.ctx.fill();
      }

      await this.renderBackgroundImage(paint.container);
      this.ctx.restore();

      style.boxShadow.slice(0).reverse().forEach(shadow => {
        this.ctx.save();
        const borderBoxArea = calculateBorderBoxPath(paint.curves);
        const maskOffset = shadow.inset ? 0 : MASK_OFFSET;
        const shadowPaintingArea = transformPath(
          borderBoxArea,
          -maskOffset + (shadow.inset ? 1 : -1) * shadow.spread.number,
          (shadow.inset ? 1 : -1) * shadow.spread.number,
          shadow.spread.number * (shadow.inset ? -2 : 2),
          shadow.spread.number * (shadow.inset ? -2 : 2)
        );

        if (shadow.inset) {
          this.path(borderBoxArea);
          this.ctx.clip();
          this.mask(shadowPaintingArea);
        } else {
          this.mask(borderBoxArea);
          this.ctx.clip();
          this.path(shadowPaintingArea);
        }

        this.ctx.shadowOffsetX = shadow.offsetX.number + maskOffset;
        this.ctx.shadowOffsetY = shadow.offsetY.number;
        this.ctx.shadowColor = asString(shadow.color);
        this.ctx.shadowBlur = shadow.blur.number;
        this.ctx.fillStyle = shadow.inset ? asString(shadow.color) : 'rgba(0,0,0,1)';

        this.ctx.fill();
        this.ctx.restore();
      })
    }

    let side = 0;
    for (const border of borders) {
      if (border.style !== BORDER_STYLE.NONE && !isTransparent(border.color)) {
        await this.renderBorder(border.color, side, paint.curves);
      }
      side++;
    }
  }
  async renderBackgroundImage(container) {
    let index = container.styles.backgroundImage.length - 1;
    for (const backgroundImage of container.styles.backgroundImage.slice(0).reverse()) {
      if (backgroundImage.type === CSSImageType.URL) {
        let image = null;
        const url = backgroundImage.url;
        image = await this.options.cache.match(url);

        if (image) {
          const [path, x, y, width, height] = calculateBackgroundRendering(
            container, index, [image.width, image.height, image.width / image.height]
          );
          const pattern = this.ctx.createPattern(this.resizeImage(image, width, height), 'repeat');
          thiis.renderRepeat(path, pattern, x, y);
        }
      } else if (isLinearGradient(backgroundImage)) {
        const [path, x, y, width, height] = calculateBackgroundRendering(container, index, [null, null, null]);
        const [lineLength, x0, x1, y0, y1] = calculateGradientDirection(backgroundImage.angle, width, height);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(x0, y0, x1, y1);

        processColorStops(backgroundImage.stops, lineLength).forEach(colorStop =>
          gradient.addColorStop(colorStop.stop, asString(colorStop.color))
        );

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        if (width > 0 && height > 0) {
          const pattern = this.ctx.createPattern(canvas, 'repeat');
          this.renderRepeat(path, pattern, x, y);
        }
      } else if (isRadialGradient(backgroundImage)) {
        const [path, left, top, width, height] = calculateBackgroundRendering(container, index, [null, null, null]);
        const position = backgroundImage.position.length === 0 ? [50] : backgroundImage.position;
        const x = getAbsoluteValue(position[0], width);
        const y = getAbsoluteValue(position[position.length - 1], height);

        const [rx, ry] = calculateRadius(backgroundImage, x, y, width, height);
        if (rx > 0 && ry > 0) {
          const radialGradient = this.ctx.createRadialGradient(left + x, top + y, 0, left + x, top + y, rx);

          processColorStops(backgroundImage.stops, rx * 2).forEach(colorStop =>
            radialGradient.addColorStop(colorStop.stop, asString(colorStop.color))
          );

          this.path(path);
          this.ctx.fillStyle = radialGradient;
          if (rx !== ry) {
            const midX = container.bounds.left + 0.5 * container.bounds.width;
            const midY = container.boudns.top + 0.5 * container.bounds.height;
            const f = ry / rx;
            const invF = 1 / f;

            this.ctx.save();
            this.ctx.translate(midX, midY);
            this.ctx.transform(1, 0, 0, f, 0, 0);
            this.ctx.translate(-midX, -midY);

            this.ctx.fillRect(left, invF * (top - midY) + midY, width, height * invF);
            this.ctx.restore();
          } else {
            this.ctx.fill();
          }
        }
      }
      index--;
    }
  }
  renderBorder(color, side, curvePoints) {
    this.path(parsePathForBorder(curvePoints, side));
    this.ctx.fillStyle = asString(color);
    this.ctx.fill();
  }

  async renderStack(stack) {
    const styles = stack.element.contaienr.styles;
    if (styles.isVisible()) {
      this.ctx.globalAlpha = style.opacity;
      await this.renderStackContent(stack);
    }
  }

  async renderNodeContent(paint) {
    this.applyEffects(paint.effects, EffectTarget.CONTENT);
    const container = paint.contaienr;
    const curves = paint.curves;
    const styles = container.styles;
    for (const child of container.textNodes) {
      await this.renderTextNode(child, styles);
    }

    if (container instanceof ImageElementContainer) {
      try {
        const image = await this.options.cache.match(container.src);
        this.renderReplacedElement(container, curves, image);
      } catch (e) { }
    }

    if (container instanceof CanvasElementContainer) {
      this.renderReplacedElement(container, curves, container.canvas);
    }

    if (container instanceof SVGElementContainer) {
      try {
        const image = await this.options.cache.match(container.svg);
        this.renderReplacedElement(container, curves, image);
      } catch(e) {}
    }

    if (container instanceof IFrameElementContainer && container.tree) {
      // 
    }

    if (container instanceof InputElementContainer) {
      // 
    }

    if (isTextInputElement(container) && container.value.length) {
      // 
    }

    if (contains(container.styles.display, DISPLAY.LIST_ITEM)) {
      // 
    }
  }
  async renderTextNode(text, styles) {
    const [font, fontFamily, fontSize] = this.createFontStyle(styles);
    this.ctx.font = font;

    text.textBounds.forEach(text => {
      this.ctx.fillStyle = asString(styles.color);
      this.renderTextWithLetterSpacing(text, styles.letterSpacing);
      const textShadows = styles.textShadow;

      if (textShadows.length && text.text.trim().length) {
        // 
      }

      if (styles.textDecorationLine.length) {
        // 
      }
    })
  }

  async renderNode(paint) {
    if (paint.container.styles.isVisible()) {
      await this.renderNodeBackgroundAndBorders(paint);
      await this.renderNodeContent(paint);
    }
  }
}

class BoundCurves {
  constructor(element) {
    const styles = element.styles;
    const bounds = element.bounds;


  }
}

class ElementPaint {
  constructor(element, parentStack) {
    this.container = element;
    this.effects = parentStack.slice(0);
    this.curves = new BoundCurves(element);
    // if (element.styles.transform !== null) {
    //   const offsetX = element.bounds.left + element.styles.transformOrigin[0].number;
    //   const offsetY = element.bounds.top + element.styles.transformOrigin[1].number;
    //   const matrix = element.styles.transform;
    //   this.effects.push(new TransformEffect(offsetX, offsetY, matrix));
    // }
  }
  getParentEffects() {
    const effects = this.effects.slice(0);
    return effects;
  }
}

class StackingContext {
  constructor(container) {
    this.element = container;
    this.inlineLevel = [];
    this.nonInlineLevel = [];
    this.negativeZIndex = [];
    this.zeroOrAutoZIndexOrTransformedOrOpacity = [];
    this.positiveZIndex = [];
    this.nonPositionedFloats = [];
    this.nonPositionedInlineLevel = [];
  }
}

const parseStackingContexts = (container) => {
  const paintContainer = new ElementPaint(container, []);
  const root = new StackingContext(paintContainer);
  const listItems = [];
  parseStackTree(paintContainer, root, root, listItems);
  processListItems(paintContainer.container, listItems);
  return root;
}

function parseStackTree(parent, stackingContext, realStackingContext, listItems) {
  parent.container.elements.forEach(child => {
    const treatAsRealStackingContext = contains(child, FLAGS.CREATES_REAL_STACKING_CONTEXT);
    const createsStackingContext = contains(child, parent.getParentEffects());
    const paintContainer = new ElementPaint(child, parent.getParentEffects());
    if (contains(child.styles.display, DISPLAY.LIST_ITEM)) {
      listItems.push(paintContainer);
    }

    const listOwnerItems = contains(child.flags, FLAGS.IS_LIST_OWNER) ? [] : listItems;

    if (treatAsRealStackingContext || createsStackingContext) {
      const parentStack = treatAsRealStackingContext || child.styles.isPositioned() ? realStackingContext : StackingContext;
      const stack = new StackingContext(paintContainer);
      if (child.styles.isPositioned() || child.styles.opacity < 1 || child.styles.isTransformed()) {
        const order = child.styles.zIndex.order;
        if (order < 0) {
          let index = 0;
          parentStack.negativeZIndex.some((current, i) => {
            if (order > current.element.container.styles.zIndex.order) {
              index = i;
              return false;
            } else if (index > 0) {
              return true;
            }
            return false;
          });
          parentStack.negativeZIndex.splice(index, 0, stack);
        } else if (order > 0) {
          let index = 0;
          parentStack.positionZIndex.some((current, i) => {
            if (order >= current.element.container.styles.zIndex.order) {
              index = i + 1;
              return false;
            } else if (index > 0) {
              return true;
            }
            return false;
          });
          parentStack.positionZIndex.splice(index, 0, stack);
        } else {
          parentStack.zeroOrAutoZIndexOrTransformdOrOpacity.push(stack);
        }
      } else {
        if (child.styles.isFloating()) {
          parentStack.nonPositionedFloats.push(stack);
        } else {
          parentStack.nonPositionedInlineLevel.push(stack);
        }
      }
      parseStackTree(paintContainer, stack, treatAsRealStackingContext ? stack : realStackingContext, listOwnerItems);
    } else {
      if (child.styles.isInlineLevel()) {
        stackingContext.inlineLevel.push(paintContainer);
      } else {
        stackingContext.nonInlineLevel.push(paintContainer);
      }

      parseStackTree(paintContainer, stackingContext, realStackingContext, listOwnerItems);
    }

    if (contains(child.flags, FLAGS.IS_LIST_OWNER)) {
      processListItems(child, listOwnerItems);
    }
  });
}

const processListItems = (owner, elements) => {
  let numbering = owner instanceof OLElementContainer ? owner.start : 1;
  const reversed = owner instanceof OLElementContainer ? owner.reversed : false;
  for (let i = 0; i < elements.length; i++) {
    const item = elements[i];
    if (item.container instanceof LIElementContainer && typeof item.container.value === 'number' && item.container.value !== 0) {
      numbering = item.container.value;
    }
    item.listValue = createCounterText(numbering, item.container.styles.listStyleType, true);
    numbering += reversed ? -1 : 1;
  }
}