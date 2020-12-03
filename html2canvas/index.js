import CacheStorage from './storage';
import { parseDocumentSize, parseBounds, DocumentCloner, parseTree } from './document';
import { isTransparent, parseColor, COLORS } from './color';
import CanvasRenderer from './canvasRenerer';

if (typeof window !== 'undefined') {
  CacheStorage.setContext(window);
}

function html2canvas(element, options) {
  return renderElement(element, options);
}

async function renderElement(element, opts) {
  const instanceName = (Math.round(Math.random() * 1000) + Date.now()).toString(16);
  const tagName = element.tagName;
  const { width, height, left, top } = tagName === 'BODY' || tagName === 'HTML'
    ? parseDocumentSize(document) : parseBounds(element);

  const defaultResourceOptions = {
    allowTaint: false,
    imageTimeout: 15000,
    proxy: undefined,
    useCORS: false,
  };
  const resourceOptions = { ...defaultResourceOptions, ...opts };
  const defaultOptions = {
    backgroundColor: '#fff',
    cache: opts.cache ? opts.cache : CacheStorage.create(instanceName, resourceOptions),
    logging: true,
    removeContainer: true,
    foreignObjectRendering: false,
    scale: window.devicePixelRatio || 1,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    scrollX: window.pageXOffset,
    scroolY: window.pageYOffset,
    x: left,
    y: top,
    width: Math.ceil(width),
    height: Math.ceil(height),
    id: instanceName,
  };

  const options = { ...defaultOptions, ...resourceOptions, ...opts };

  const windowBounds = new Bounds(options.scrollX, options.scroolY, options.windowWidth, options.windowHeight);

  const documentCloner = new DocumentCloner(element, {
    id: instanceName,
    onclone: options.onclone,
    ignoreElement: options.foreignObjectRendering,
    copyStyles: options.foreignObjectRendering,
  });
  const clonedElement = documentCloner.clonedReferenceElement;
  const container = await documentCloner.toIFrame(document, windowBounds);

  const documentBackgroundColor = document.documentElement ? parseColor(getComputedStyle(document.documentElement).backgroundColor) : COLORS.TRANSPARENT;
  const bodyBackgroundColor = document.body ? parseColor(getComputedStyle(document.body).backgroundColor) : COLORS.TRANSPARENT;

  const bgColor = opts.backgroundColor;
  const defaultBackgroundColor = typeof bgColor === 'string' ? parseColor(bgColor) : bgColor === null ? COLORS.TRANSPARENT : 0xffffffff;

  const backgroundColor = element === document.documentElement
    ? isTransparent(documentBackgroundColor)
      ? isTransparent(bodyBackgroundColor)
        ? defaultBackgroundColor
        : bodyBackgroundColor
      : documentBackgroundColor
    : defaultBackgroundColor;

  const renderOptions = {
    id: instanceName,
    cache: options.cache,
    canvas: options.canvas,
    backgroundColor,
    scale: options.scale,
    x: options.x,
    y: options.y,
    scrollX: options.scrollX,
    scrollY: options.scrollY,
    width: options.width,
    height: options.height,
    windowWidth: options.windowWidth,
    windowHeight: options.windowHeight,
  };

  let canvas;

  if (options.foreignObjectRendering) {
    const renderer = new ForeignObjectRenderer(renderOptions);
    canvas = await renderer.render(clonedElement);
  } else {
    CacheStorage.attachInstance(options.cache);
    const root = parseTree(clonedElement);
    CacheStorage.detachInstance();

    if (backgroundColor === root.styles.backgroundColor) {
      root.styles.backgroundColor = COLORS.TRANSPARENT;
    }

    const renderer = new CanvasRenderer(renderOptions);
    canvas = await renderer.render(root);
  }

  if (options.removeContainer) {
    DocumentCloner.destroy(container);
  }

  CacheStorage.destroy(instanceName);
  return canvas;
}

window.html2canvas = html2canvas;