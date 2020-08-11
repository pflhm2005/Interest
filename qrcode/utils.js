const Mode = require('./mode');

/**
 * 常量
 */
const NumericRegex = /[0-9]+/g;
const AlphanumerRegex = /[A-Z $%*+\-./:]+/g;
const ByteRegex = /[^A-Z0-9 $%*+\-./:]+/g;

const FINDER_PATTERN_SIZE = 7;
const CODEWORDS_COUNT = [
  0, // Not used
  26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
  404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
  1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185,
  2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706
];

/**
 * 工具类
 */
module.exports = class Utils {
  static getSymbolTotalCodewords(version) {
    return CODEWORDS_COUNT[version];
  }
  static getSymbolSize(version) {
    return version * 4 + 17;
  }
  static getFinderPatternPosition(version) {
    let size = Utils.getSymbolSize(version);
    return [
      // top-left
      [0, 0],
      // top-rigth
      [size - FINDER_PATTERN_SIZE, 0],
      // bottom-left
      [0, size - FINDER_PATTERN_SIZE]
    ];
  }
  static getRowColCoors(version) {
    if (version === 1) return [];

    /**
     * 映射关系如下 [version, posCount]
     * 2 ~ 6 => 2
     * 7 ~ 13 => 3
     * 14 ~ 20 => 4
     * 21 ~ 27 => 5
     * 28 ~ 34 => 6
     * 35 ~ 40 => 7
     */
    let posCount = Math.floor(version / 7) + 2;
    let size = Utils.getSymbolSize(version);
    /**
     * version32 => 32 * 4 + 17 = 145
     * 这里可以直接代入公式得出
     * intervals => Math.ceil((version * 4 + 4) / (2 * Math.floor(version / 7) + 2)) * 2
     * 映射表如下
     * [12, 16, 20, 24, 28] 2 ~ 6
     * [16, 18, 20, 22, 24, 26, 28] 7 ~ 13
     * [20, 22, 24, 24, 26, 28, 28] 14 ~ 20
     * [22, 24, 24, 26, 26, 28, 28] 21 ~ 27
     * [24, 24, 26, 26, 26(特殊情况), 28, 28] 28 ~ 34
     * [24, 26, 26, 26, 28, 28] 35 ~ 40
     */
    let intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
    let positions = [size - 7];
    // version2 ~ 6时不会进人这个循环 前面可以提前返回
    for (let i = 1; i < posCount - 1; i++) {
      positions[i] = positions[i - 1] - intervals;
    }
    // 固定的pos
    positions.push(6);
    // [6, ..., size - 7]
    return positions.reverse();
  }
  static getAlignmentPatternPosition(version) {
    let coords = [];
    let pos = Utils.getRowColCoors(version);
    let l = pos.length;

    for (let i = 0; i < l; i++) {
      for (let j = 0; j < l; j++) {
        // [6, 6], [6, size - 7], [size - 7, 6]都被FinderPattern占用了 跳过
        if ((i === 0 && j === 0) ||
          (i === 0 && j === l - 1) ||
          (i === l - 1 && j === 0)) {
          continue;
        }
        coords.push(pos[i], pos[j]);
      }
    }

    return coords;
  }
  /**
   * Encode data with Bose-Chaudhuri-Hocquenghem
   * 狗屁encode 就是返回数字的二进制位数
   * @param  {Number} data Value to encode
   * @return {Number}      Encoded value
   */
  static getBCHDigit(data) {
    let digit = 0;
    while (data !== 0) {
      digit++;
      data >>>= 1;
    }

    return digit;
  }
  /**
   * 返回15bits的内容 包含5bits数据以及10bits错误修正数据
   * @param {ECLevel} errorCorrectionLevel 
   * @param {Number} mask 格式化时为0
   */
  static getEncodedBits(errorCorrectionLevel, mask) {
    const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);
    // 11
    const G15_BCH = Utils.getBCHDigit(G15);
    // LMQH => 1032
    let data = ((errorCorrectionLevel.bit << 3) | mask);
    let d = data << 10;
    while (Utils.getBCHDigit(d) - G15_BCH >= 0) {
      d ^= (G15 << (Utils.getBCHDigit(d) - G15_BCH));
    }

    return ((data << 10) | d) ^ G15_MASK;
  }

  static getSegments(regex, mode, str) {
    let segments = [];
    let result = null;
    while ((result = regex.exec(str)) !== null) {
      segments.push({
        data: result[0],
        index: result.index,
        mode,
        length: result[0].length,
      });
    }
    return segments;
  }
  static splitString(str) {
    let nSegs = Utils.getSegments(NumericRegex, Mode.NUMERIC, str);
    let aSegs = Utils.getSegments(AlphanumerRegex, Mode.ALPHANUMERIC, str);
    let bSegs = Utils.getSegments(ByteRegex, Mode.BYTE, str);
    return [...nSegs, ...aSegs, ...bSegs].sort((a, b) => a.index - b.index).map((o) => ({
      data: o.data,
      mode: o.mode,
      length: o.length,
    }));
  }

  static BufferFrom(string, encoding = 'utf8') {
    if (typeof window === 'object') {
      return new _Buffer(string, encoding);
    }
    const isModern = (
      typeof Buffer.alloc === 'function' &&
      typeof Buffer.allocUnsafe === 'function' &&
      typeof Buffer.from === 'function'
    );
    return isModern
      ? Buffer.from(string, encoding)
      : new Buffer(string, encoding);
  }
  static BufferAlloc(size, fill, encoding) {
    if (Buffer.alloc) {
      return Buffer.alloc(size, fill, encoding);
    }
    throw new Error('待实现');
  }
}