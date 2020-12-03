import { 
  ElementContainer, ImageElementContainer, CanvasElementContainer, SVGElementContainer,
  LIElementContainer, OLElementContainer, InputElementContainer, SelectElementContainer,
  TextareaElementContainer, IFrameElementContainer
 } from './element';
import { CSSParsedCounterDeclaration } from './parser';
import { FLAGS } from './element';

class Bounds {
  constructor(top, left, width, height) {
    this.top = top;
    this.left = left;
    this.width = width;
    this.height = height;
  }
  add(x, y, w, h) {
    return new Bounds(this.left + x, this.top + y, this.width + w, this.height + h);
  }
  static fromClientRect(clientRect) {
    return new Bounds(clientRect.left, clientRect.top, clientRect.width, clientRect.height);
  }
}

export function parseDocumentSize() { }
export function parseBounds(node) {
  return Bounds.fromClientRect(node.getBoundingClientRect());
}

const isTextNode = (node) => node.nodeType === Node.TEXT_NODE;
const isElementNode = (node) => node.nodeType === Node.ELEMENT_NODE;
const isSVGElementNode = (element) => typeof element.classnName === 'object';
const isSVGElement = (element) => element.tagName === 'SVG';
const isLIElement = (element) => element.tagName === 'LI';
const isOLElement = (element) => element.tagName === 'OL';
const isInputElement = (element) => element.tagName === 'INPUT';
const isBodyElement = (element) => element.tagName === 'BODY';
const isCanvasElement = (element) => element.tagName === 'CANVAS';
const isStyleElement = (element) => element.tagName === 'STYLE';
const isImageElement = (element) => element.tagName === 'IMG';
const isScriptElement = (element) => element.tagName === 'SCRIPT';
const isTextareaElement = (element) => element.tagName === 'TEXTAREA';
const isSelectElement = (element) => element.tagName === 'SELECT';
const isHTMLElementNode = (node) => isElementNode(node) && typeof node.style !== 'undefined' && !isSVGElementNode(node);

const IGNORE_ATTRIBUTE = 'data-html2canvas-ignore';

class CounterState {
  constructor() {
    this.counters = {};
  }
  parse(style) {
    const counterIncrement = style.counterIncrement;
    const counterReset = style.counterReset;
    let canReset = true;
    if (counterIncrement !== null) { }
    const counterNames = [];
    if (canReset) {
      counterReset.forEach
    }
  }
}

export class DocumentCloner {
  constructor(element, options) {
    this.options = options;
    this.scrolledElements = [];
    this.referenceElement = element;
    this.counters = new CounterState();
    this.quoteDepth = 0;
    this.clonedReferenceElement = null;
    // 这里是HTML标签
    this.documentElement = this.cloneNode(element.ownerDocument.documentElement);
  }
  createCanvasClone(node) { }
  createStyleClone(node) { }
  createElementClone(node) {
    if (isCanvasElement(node)) {
      return this.createCanvasClone(node);
    }

    if (isStyleElement(node)) {
      return this.createStyleClone(node);
    }
    // Node.cloneNode拷贝一个DOM节点 false表示只拷贝节点本身 true则拷贝整个树
    const clone = node.cloneNode(false);
    if (isImageElement(clone) && clone.loading === 'lazy') {
      clone.loading = 'eager';
    }

    return clone;
  }
  cloneNode(node) {
    if (isTextNode(node)) {
      return document.createTextNode(node.data);
    }

    if (!node.ownerDocument) {
      return node.cloneNode(false);
    }

    // 当node节点是DOM节点时
    if (window && isElementNode(node) && (isHTMLElementNode(node) || isSVGElementNode(node))) {
      // 返回空的指定节点
      const clone = this.createElementClone(node);

      const style = window.getComputedStyle(node);
      const styleBefore = window.getComputedStyle(node, ':before');
      const styleAfter = window.getComputedStyle(node, ':after');

      // 当传入的DOM节点是html时
      if (this.referenceElement === node && isHTMLElementNode(clone)) {
        this.clonedReferenceElement = clone;
      }
      if (isBodyElement(clone)) {
        createPseudoHideStyles(clone);
      }

      for (let child = node.firstChild; child; child = child.nextSibling) {
        if (!isElementNode(child) || (!isScriptElement(child) && !child.hasAttribute(IGNORE_ATTRIBUTE)
          && (typeof this.options.ignoreElements !== 'function' || !this.options.ignoreElements(child)))) {
          if (!this.options.copyStyles || !isElementNode(child) || !isStyleElement(child)) {
            clone.appendChild(this.cloneNode(child));
          }
        }
      }

      // 处理伪元素
      const before = this.resolvePseudoContent(node, clone, styleBefore, PseudoElementType.BEFORE);
      if (before) {
        clone.insertBefore(before, clone.firstChild);
      }
      const after = this.resolvePseudoContent(node, clone, styleAfter, PseudoElementType.AFTER);
      if (after) {
        clone.appendChild(after);
      }

      const counters = this.counters.parse(new CSSParsedCounterDeclaration(style));
      this.counters.pop(counters);

      if (style && (this.options.copyStyles || isSVGElementNode(node)) && !isIFrameElement(node)) {
        copyCSSStyles(style, clone);
      }

      if (node.scrollTop !== 0 || node.scrollLeft !== 0) {
        this.scrolledElements.push(clone, node.scrollLeft, node.scrollTop);
      }

      if ((isTextareaElement(node) || isSelectElement(node)) &&
        (isTextareaElement(clone) || isSelectElement(clone))) {
        clone.value = node.value;
      }

      return clone;
    }

    return node.cloneNode(false);
  }
  resolvePseudoContent(node, clone, style, pseudoElt) {
    if (!style) {
      return;
    }

    const value = style.content;
    const document = clone.ownerDocument;
    if (!document || !value || value === 'none' || value === '-moz-alt-content' || style.display === 'none') {
      return;
    }

    // this.counters.parse(new CSSParsedCounterDeclaration(style));
    // const declaration = new CSSParsedPseudoDeclaration(style);
  }

  toIFrame(ownerDocument, windowSize) {
    const iframe = createIFrameContainer(ownerDocument, windowSize);

    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    // iframe的window对象
    const cloneWindow = iframe.contentWindow;
    // #document
    const documentClone = cloneWindow.document;

    const iframeLoad = iframeLoader(iframe).then(async () => {
      this.scrolledElements.forEach(restoreNodeScroll);
      if (cloneWindow) {
        cloneWindow.scrollTo(windowSize.left, windowSize.top);
        if (/(iPad|iPhone|iPod)/g.test(navigator.userAgent) &&
          (cloneWindow.scrollY !== windowSize.top || cloneWindow.scrollX !== windowSize.left)) {
          // html
          documentClone.documentElement.style.top = -windowSize.top + 'px';
          documentClone.documentElement.left = -windowSize.left + 'px';
          documentClone.documentElement.position = 'absolute';
        }
      }

      // const onclone = this.options.onclone;

      // 检测字体加载情况
      if (documentClone.fonts && documentClone.fonts.ready) {
        await documentClone.fonts.ready;
      }

      if (typeof onclone === 'function') {
        return Promise.resolve().then(() => onclone(documentClone)).then(() => iframe);
      }

      return iframe;
    });

    documentClone.open();
    documentClone.write('<!DOCTYPE ><html></html>');
    restoreOwnerScroll(this.referenceElement.ownerDocument, scrollX, scrollY);
    // 替换节点
    documentClone.replaceChild(documentClone.adoptNode(this.documentElement), documentClone.documentElement);
    documentClone.close();

    return iframeLoad;
  }
  createIFrameContainer(ownerDocument, bounds) {
    const cloneIframeContainer = ownerDocument.createElement('iframe');

    cloneIframeContainer.classnName = 'html2canvas-container';
    cloneIframeContainer.style.visibility = 'hidden';
    cloneIframeContainer.style.position = 'fixed';
    cloneIframeContainer.style.left = '-10000px';
    cloneIframeContainer.style.top = '0px';
    cloneIframeContainer.style.border = '0';
    cloneIframeContainer.width = bounds.width.toString();
    cloneIframeContainer.height = bounds.height.toString();
    cloneIframeContainer.setAttribute(IGNORE_ATTRIBUTE, 'true');
    ownerDocument.body.appendChild(cloneIframeContainer);

    return cloneIframeContainer;
  }
}

const iframeLoader = (iframe) => {
  return new Promise((resolve, reject) => {
    const cloneWindow = iframe.contentWindow;

    const documentClone = cloneWindow.document;

    // readystatechange有两段 => interactive、complete
    // 这里只监听第一个
    cloneWindow.onload = iframe.onload = documentClone.onreadystatechange = () => {
      cloneWindow.onload = iframe.onload = documentClone.onreadystatechange = null;
      const interval = setInterval(() => {
        if (documentClone.body.childNodes.length > 0 && documentClone.readyState === 'complete') {
          clearInterval(interval);
          resolve(iframe);
        }
      }, 50);
    }
  });
}

const restoreOwnerScroll = (ownerDocument, x, y) => {
  if (ownerDocument && ownerDocument.defaultView &&
    (x !== ownerDocument.defaultView.pageXOffset || y !== ownerDocument.defaultView.pageYOffset)) {
    ownerDocument.defaultView.scrollTo(x, y);
  }
}

const createContainer = (element) => {
  if (isImageElement(element)) {
    return new ImageElementContainer(element);
  }

  if (isCanvasElement(element)) {
    return new CanvasElementContainer(element);
  }

  if (isSVGElement(element)) {
    return new SVGElementContainer(element);
  }

  if (isLIElement(element)) {
    return new LIElementContainer(element);
  }

  if (isOLElement(element)) {
    return new OLElementContainer(element);
  }

  if (isInputElement(element)) {
    return new InputElementContainer(element);
  }

  if (isSelectElement(element)) {
    return new SelectElementContainer(element);
  }

  if (isTextareaElement(element)) {
    return new TextareaElementContainer(element);
  }

  if (isIFrameElement(element)) {
    return new IFrameElementContainer(element);
  }

  return new ElementContainer(element);
}

export const parseTree = (element) => {
  const container = createContainer(element);
  container.flags |= FLAGS.CREATES_REAL_STACKING_CONTEXT;
  parseNodeTree(element, container, container);
  return container;
}

const LIST_OWNERS = ['OL', 'UL', 'MENU'];

function parseNodeTree(node, parent, root) {
  for (let childNode = node.firstChild, nextNode; childNode; childNode = nextNode) {
    nextNode = childNode.nextSibling;
    if (isTextNode(childNode) && childNode.data.trim().length > 0) {
      parent.textNodes.push(new TextContainer(childNode, parent.styles));
    } else if(isElementNode(childNode)) {
      const container = createContainer(childNode);
      if (container.styles.isVisible()) {
        // 会产生新的层级上下文
        if (createsRealStackingContext(childNode, container, root)) {
          container.flags |= FLAGS.CREATES_REAL_STACKING_CONTEXT;
        }
        // 脱离文档流
        else if(createsStackingContext(container.styles)) {
          container.flags |= FLAGS.CREATES_STACKING_CONTEXT;
        }

        if (LIST_OWNERS.indexOf(childNode.tagName) !== -1) {
          container.flags |= FLAGS.IS_LIST_OWNER;
        }

        parent.elements.push(container);
        if (!isTextareaElement(childNode) && !isSVGElement(childNode) && !isSelectElement(childNode)) {
          parseNodeTree(childNode, container, root);
        }
      }
    }
  }
}

function createsRealStackingContext(node, container, root) {
  return (
    container.styles.isPositionedWidthZIndex() || 
    container.styles.opacity < 1 ||
    container.styles.isTransformed() ||
    (isBodyElement(node) && root.styles.isTransparent())
  );
}

function createsStackingContext(styles) {
  return styles.isPositioned() || styles.isFloating();
}