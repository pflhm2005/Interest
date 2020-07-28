const { off } = require("process");

/**
 * 正则常量
 */
const NumericRegex = /[0-9]+/g;
const AlphanumerRegex = /[A-Z $%*+\-./:]+/g;
const ByteRegex = /[^A-Z0-9 $%*+\-./:]+/g;

/**
 * Mode类
 */
class Mode {
  static NUMERIC = {
    id: 'Numeric',
    bit: 1 << 0,
    ccBits: [10, 12, 14],
  };
  static ALPHANUMERIC = {
    id: 'Alphanumeric',
    bit: 1 << 1,
    ccBits: [9, 11, 13]
  };
  static BYTE = {
    id: 'Byte',
    bit: 1 << 2,
    ccBits: [8, 16, 16]
  };
  static MIXED = { bit: -1 };
  static getCharCountIndicator(mode, version) {
    if (version >= 1 && version < 10) return mode.ccBits[0];
    else if (version < 27) return mode.ccBits[1];
    return mode.ccBits[2];
  }
}

/**
 * 工具类
 */
class Utils {
  static FINDER_PATTERN_SIZE = 7;
  static CODEWORDS_COUNT = [
    0, // Not used
    26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
    404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
    1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185,
    2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706
  ];
  static getSymbolTotalCodewords(version) {
    return Utils.CODEWORDS_COUNT[version];
  }
  static getSymbolSize(version) {
    return version * 4 + 17;
  }
  static getPosition(version) {
    let size = Utils.getSymbolSize(version);
    return [
      // top-left
      [0, 0],
      // top-rigth
      [size - Utils.FINDER_PATTERN_SIZE, 0],
      // bottom-left
      [0, size - Utils.FINDER_PATTERN_SIZE]
    ];
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

/**
 * Brower环境下需要自己实现Buffer
 */
class _Buffer {
}

/**
 * codewords的buffer
 * @constructor buffer 以二进制排列的元数据 数值毫无意义
 * @constructor length bit数而非数组长度
 */
class BitBuffer {
  constructor() {
    this.buffer = [];
    this.length = 0;
  }
  get(index) {
    let bufIndex = Math.floor(index / 8);
    return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) === 1;
  }
  /**
   * 将指定字符加入buffer
   * @param {Number} num 字符的值
   * @param {Number} length 位数
   */
  put(num, length) {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }
  getLengthInBits() {
    return this.length;
  }
  /**
   * 这方法真是个憨憨
   * @param {Boolean} bit
   */
  putBit(bit) {
    let bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    /**
     * @example 类型为BYTE
     * value => 1 << 2 => 4
     * length => 4
     * 在put阶段依次传入的是false,true,false,false(0100)
     * 进行位运算时 由于基数是0x80(0b10000000) 第二次进入位运算
     * buffer[0] |= (0x80 >>> 1)
     * 最终结果为64 => 0100(实际数值)0000(补位值)
     */
    if (bit) {
      this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
    }
    this.length++
  }
}

/**
 * 矩阵类
 * 也就普普通通一维数组
 */
class BitMatrix {
  constructor(size) {
    this.size = size;
    this.data = Utils.BufferAlloc(size * size);
    this.reservedBit = Utils.BufferAlloc(size * size);
  }
  set(row, col, value, reserved) {
    let index = row * this.size + col;
    this.data[index] = value;
    if (reserved) this.reservedBit[index] = true;
  }
  get(row, col) {
    return this.data[row * this.size + col];
  }
  xor(row, col, value) {
    this.data[row * this.size + col] ^= value;
  }
  isReserved(row, col) {
    return this.reservedBit[row * this.size + col];
  }
}

/**
 * error correction相关类
 */
class ECLevel {
  static L = { bit: 1 };  // low
  static M = { bit: 0 };  // medium
  static Q = { bit: 3 };  // quartile
  static H = { bit: 2 };  // high
}

class ECCode {
  static EC_BLOCKS_TABLE = [
    // L  M  Q  H
    1, 1, 1, 1,
    1, 1, 1, 1,
    1, 1, 2, 2,
    1, 2, 2, 4,
    1, 2, 4, 4,
    2, 4, 4, 4,
    2, 4, 6, 5,
    2, 4, 6, 6,
    2, 5, 8, 8,
    4, 5, 8, 8,
    4, 5, 8, 11,
    4, 8, 10, 11,
    4, 9, 12, 16,
    4, 9, 16, 16,
    6, 10, 12, 18,
    6, 10, 17, 16,
    6, 11, 16, 19,
    6, 13, 18, 21,
    7, 14, 21, 25,
    8, 16, 20, 25,
    8, 17, 23, 25,
    9, 17, 23, 34,
    9, 18, 25, 30,
    10, 20, 27, 32,
    12, 21, 29, 35,
    12, 23, 34, 37,
    12, 25, 34, 40,
    13, 26, 35, 42,
    14, 28, 38, 45,
    15, 29, 40, 48,
    16, 31, 43, 51,
    17, 33, 45, 54,
    18, 35, 48, 57,
    19, 37, 51, 60,
    19, 38, 53, 63,
    20, 40, 56, 66,
    21, 43, 59, 70,
    22, 45, 62, 74,
    24, 47, 65, 77,
    25, 49, 68, 81
  ];
  static getBlocksCount(version, errorCorrectionLevel) {
    switch (errorCorrectionLevel) {
      case ECLevel.L:
        return ECCode.EC_BLOCKS_TABLE[(version - 1) * 4 + 0]
      case ECLevel.M:
        return ECCode.EC_BLOCKS_TABLE[(version - 1) * 4 + 1]
      case ECLevel.Q:
        return ECCode.EC_BLOCKS_TABLE[(version - 1) * 4 + 2]
      case ECLevel.H:
        return ECCode.EC_BLOCKS_TABLE[(version - 1) * 4 + 3]
      default:
        return undefined
    }
  }
  static EC_CODEWORDS_TABLE = [
    // L  M  Q  H
    7, 10, 13, 17,
    10, 16, 22, 28,
    15, 26, 36, 44,
    20, 36, 52, 64,
    26, 48, 72, 88,
    36, 64, 96, 112,
    40, 72, 108, 130,
    48, 88, 132, 156,
    60, 110, 160, 192,
    72, 130, 192, 224,
    80, 150, 224, 264,
    96, 176, 260, 308,
    104, 198, 288, 352,
    120, 216, 320, 384,
    132, 240, 360, 432,
    144, 280, 408, 480,
    168, 308, 448, 532,
    180, 338, 504, 588,
    196, 364, 546, 650,
    224, 416, 600, 700,
    224, 442, 644, 750,
    252, 476, 690, 816,
    270, 504, 750, 900,
    300, 560, 810, 960,
    312, 588, 870, 1050,
    336, 644, 952, 1110,
    360, 700, 1020, 1200,
    390, 728, 1050, 1260,
    420, 784, 1140, 1350,
    450, 812, 1200, 1440,
    480, 868, 1290, 1530,
    510, 924, 1350, 1620,
    540, 980, 1440, 1710,
    570, 1036, 1530, 1800,
    570, 1064, 1590, 1890,
    600, 1120, 1680, 1980,
    630, 1204, 1770, 2100,
    660, 1260, 1860, 2220,
    720, 1316, 1950, 2310,
    750, 1372, 2040, 2430
  ];
  static getTotalCodewordsCount(version, errorCorrectionLevel) {
    switch (errorCorrectionLevel) {
      case ECLevel.L:
        return ECCode.EC_CODEWORDS_TABLE[(version - 1) * 4 + 0];
      case ECLevel.M:
        return ECCode.EC_CODEWORDS_TABLE[(version - 1) * 4 + 1];
      case ECLevel.Q:
        return ECCode.EC_CODEWORDS_TABLE[(version - 1) * 4 + 2];
      case ECLevel.H:
        return ECCode.EC_CODEWORDS_TABLE[(version - 1) * 4 + 3];
      default:
        return undefined;
    }
  }
}

/**
 * 数据类型类
 */
class Data {
  constructor(data) {
    this.data = data;
    if (new.target === Data) {
      throw new Error('invalid constructor');
    }
    this.ClsInstance = new.target;
  }
  getLength() {
    return this.data.length;
  }
  getBitsLength() {
    return this.ClsInstance.getBitsLength(this.data.length);
  }
}

class NumericData extends Data {
  constructor(data) {
    super(data.toString());
    this.mode = Mode.NUMERIC;
  }
  /**
   * 数字类型的内容每三个会被压缩成10bit的内容
   * 若出现单个或两个数字 压缩为4bit、7bit
   * @example
   * 9 => 3 * 10 = 30bit
   * 10 => 3 * 10 + 1 * 3 + 4 = 34bit
   * @return 返回指定长度数字所需要的bit位数
   */
  static getBitsLength(len) {
    return 10 * Math.floor(len / 3) + ((len % 3) ? ((len % 3) * 3 + 1) : 0);
  }
  write(bitBuffer) {
    let i = 0;
    let group = [];
    let value = 0;
    for (; i + 3 <= this.data.length; i += 3) {
      group = this.data.substr(i, 3);
      value = parseInt(group, 10);

      bitBuffer.put(value, 10);
    }

    let n = this.data.length - i;
    if (n > 0) {
      group = this.data.substr(i);
      value = parseInt(group, 10);

      bitBuffer.put(value, n * 3 + 1);
    }
  }
}

class AlphanumericData extends Data {
  static ALPHA_NUM_CHARS = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    ' ', '$', '%', '*', '+', '-', '.', '/', ':'
  ];
  constructor(data) {
    super(data);
    this.mode = Mode.ALPHANUMERIC;
  }
  /**
   * 字符类型内容每两个会被压缩为11bit的内容
   * 若出现单个字符 压缩为6bit
   * @example
   * 12 => 11 * 6 = 66bit
   * 13 => 11 * 6 + 6 = 72bit
   * @return 返回指定长度字符所需要的bit位数
   */
  static getBitsLength(len) {
    return 11 * Math.floor(len / 2) + 6 * (len % 2);
  }
  write(bitBuffer) {
    let i = 0;
    for (; i + 2 <= this.data.length; i += 2) {
      /**
       * 这里组合是第一个字符的索引乘以45拼上第二个字符索引
       * 例如AB => 10 * 45 + 11 = 461
       * 双字符11bit
       */
      let value = AlphanumericData.ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;

      value += AlphanumericData.ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);

      bitBuffer.put(value, 11);
    }

    // 单个字符6bit
    if (this.data.length % 2) {
      bitBuffer.put(AlphanumericData.ALPHA_NUM_CHARS.indexOf(this.data[i], 6));
    }
  }
}

class ByteData extends Data {
  constructor(data) {
    super(Utils.BufferFrom(data));
    this.mode = Mode.BYTE;
  }
  /**
   * 1byte = 8bit
   * @return 返回指定字节所需要的bit位数
   */
  static getBitsLength(len) {
    return len * 8;
  }
  write(bitBuffer) {
    let l = this.data.length;
    for (let i = 0; i < l; i++) {
      bitBuffer.put(this.data[i], 8);
    }
  }
}

/**
 * Version类
 * 关于bit数、errorCorrectionLevel、version之间的对应有个图表
 */
class Version {
  // 数据保留位
  static getReservedBitsCount(mode, version) {
    // Character count indicator + mode indicator bits
    return Mode.getCharCountIndicator(mode, version) + 4;
  }
  // 计算数据所需要的的bit数 包括数据本身的bit长度与预留长度
  static getTotalBitsFromDataArray(segments, version) {
    let totalBits = 0;
    segments.forEach(data => {
      let reservedBits = Version.getReservedBitsCount(data.mode, version);
      totalBits += reservedBits + data.getBitsLength();
    });

    return totalBits;
  }
  // 获取version + errorCorrectionLevel对应的bit容量
  static getCapacity(version, errorCorrectionLevel, mode) {
    if (!mode) mode = Mode.BYTE;
    // 获取对应version的codewords总数
    let totalCodewords = Utils.getSymbolTotalCodewords(version);
    // 获取error correction codewords总数
    let ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
    // 获取data codewords的bit数
    let dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
    // 混合模式下 直接返回version与errorCorrectionLevel映射的容量大小
    if (mode === Mode.MIXED) return dataTotalCodewordsBits;

    let usableBits = dataTotalCodewordsBits - Version.getReservedBitsCount(mode, version);

    switch (mode) {
      case Mode.NUMERIC:
        return Math.floor((usableBits / 10) * 3);
      case Mode.ALPHANUMERIC:
        return Math.floor((usableBits / 11) * 2);
      case Mode.BYTE:
      default:
        return Math.floor(usableBits / 8);
    }
  }
  // 多数据的version选择 取值范围为1-40
  static getBestVersionForMixedData(segments, errorCorrectionLevel) {
    for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
      let len = Version.getTotalBitsFromDataArray(segments, currentVersion);
      if (len <= Version.getCapacity(currentVersion, errorCorrectionLevel, Mode.MIXED)) {
        return currentVersion;
      }
    }

    // 实际上这里直接返回40就好了
    return undefined;
  }
  // 单数据的version选择
  static getBestVersionForDataLength(mode, len, errorCorrectionLevel) {
    for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
      if (len <= Version.getCapacity(currentVersion, errorCorrectionLevel, mode)) {
        return currentVersion;
      }
    }

    return undefined;
  }
  static getBestVersionForData(data, errorCorrectionLevel) {
    let seg = null;
    let ecl = errorCorrectionLevel || 'M';
    if (Array.isArray(data)) {
      if (data.length > 1) {
        return Version.getBestVersionForMixedData(data, ecl);
      }

      if (data.length === 0) {
        return 1;
      }

      seg = data[0];
    } else {
      seg = data;
    }
    return Version.getBestVersionForDataLength(seg.mode, seg.getLength(), ecl);
  }
}

/**
 * 数据分片类
 */
class Segments {
  constructor(data) {
    this.data = data;
    this.segs = Utils.splitString(data);
  }
  // 生成单个类型的分片
  buildSingleSegment(data, mode) {
    switch (mode) {
      case Mode.NUMERIC:
        return new NumericData(data);
      case Mode.ALPHANUMERIC:
        return new AlphanumericData(data);
      case Mode.BYTE:
        return new ByteData(data);
    }
  }
  // 将数据二次处理
  fromArray(array) {
    return array.reduce((acc, seg) => {
      if (typeof seg === 'string') {
        acc.push(this.buildSingleSegment(seg, null));
      } else if (seg.data) {
        acc.push(this.buildSingleSegment(seg.data, seg.mode));
      }
      return acc;
    }, []);
  }
  // 返回未优化的数据分片
  RawSplit() {
    return this.fromArray(this.segs);
  }

  /**
   * 一种数据可以有多个类型处理 在这里被展开
   * 例如数字可以被处理为NUMERIC,ALPHANUMERIC,BYTE
   * 万物皆可byte
   */
  buildNodes() {
    let nodes = [];
    for (let i = 0; i < this.segs.length; i++) {
      let seg = this.segs[i];
      switch (seg.mode) {
        case Mode.NUMERIC:
          nodes.push([
            seg,
            { data: seg.data, mode: Mode.ALPHANUMERIC, length: seg.length },
            { data: seg.data, mode: Mode.BYTE, length: seg.length },
          ]);
          break;
        case Mode.ALPHANUMERIC:
          nodes.push([
            seg,
            { data: seg.data, mode: Mode.BYTE, length: seg.length },
          ]);
          break;
        case Mode.BYTE:
          nodes.push([seg]);
          break;
      }
    }

    return nodes;
  }
  /**
   * 将nodes重绘成一个图
   * 每一个node指向下一个node时会有一个weight值
   * www.baI123du.com被肢解如下
   * [
   *  [BYTE],                           // www
   *  [ALPHANUMERIC, BYTE],             // .
   *  [BYTE],                           // ba
   *  [ALPHANUMERIC, BYTE],             // I
   *  [NUMERIC, ALPHANUMERIC, BYTE],    // 123
   *  [BYTE],                           // du
   *  [ALPHANUMERIC, BYTE],             // .
   *  [BYTE]                            // com
   * ]
   * 经过计算bits位数 每一个类型都会有一个weight值
   * 1. 每一个新类型都会包含4个bit位的类型标记以及一定的保留位
   * 2. 如果是老类型 则直接累计数据本身的bit位数
   * 3. 由上往下遍历
   */
  buildGraph(nodes, version) {
    let table = {};
    let graph = { 'start': {} };
    let prevNodeIds = ['start'];
    for (let i = 0; i < nodes.length; i++) {
      let nodeGroup = nodes[i];
      let currentNodeIds = [];

      for (let j = 0; j < nodeGroup.length; j++) {
        let node = nodeGroup[j];
        // 二维数组坐标
        let key = '' + i + j;

        currentNodeIds.push(key);
        table[key] = { node, lastCount: 0 };
        graph[key] = {};
        /**
         * 核心循环
         * 第一轮由于NodeId是start而table没有 必走else逻辑
         * 即graph.start['00'] = SegmentBits + 4 + ReservedBits
         * 第一轮循环后 数据结构变成
         * table =>{ '00': node, lastCount: 0 }
         * graph => { 'start':{ '00' : 36 } }
         * prevNodeIds => ['00']
         * 第二轮循环继续遍历prevNodeIds
         * table => { '00': node, lastCount: 2, '10': node, lastCount: 0, '11': node, lastCount: 0 }
         * graph => { ..., '00': { '10': 19, '11': 8 } }
         * prevNodeIdx => ['10', '11']
         * and so on...
         */
        for (let n = 0; n < prevNodeIds.length; n++) {
          let prevNodeId = prevNodeIds[n];
          // 前后节点类型相同 例如www(BYTE) => .(BYTE)
          if (table[prevNodeId] && table[prevNodeId].node.mode === node.mode) {
            // 类型相同 只需要计算合并后的数据与单个数据的bit差值
            graph[prevNodeId][key] = this.getSegmentBitsLength(table[prevNodeId].lastCount + node.length, node.mode)
              - this.getSegmentBitsLength(table[prevNodeId].lastCount, node.mode);
            // 这个不知道有什么意义
            table[prevNodeId].lastCount += node.length;
          }
          // 新节点类型 例如www(BYTE) => .(ALPHANUMERIC)
          else {
            // 记录当前节点长度
            if (table[prevNodeId]) {
              table[prevNodeId].lastCount = node.length;
            }
            // 新类型需要额外4位做类型标识以及保留位记录长度
            graph[prevNodeId][key] = this.getSegmentBitsLength(node.length, node.mode) + 4 + Mode.getCharCountIndicator(node.mode, version);
          }
        }
      }

      prevNodeIds = currentNodeIds;
    }

    for (let i = 0; i < prevNodeIds.length; i++) {
      graph[prevNodeIds[i]]['end'] = 0;
    }

    return { map: graph, table };
  }
  /**
   * 返回不同数据类型的bit长度
   * @param {Number} len 字符长度
   * @param {Mode} mode 数据类型
   * @example input => 123
   * NUMERIC => 10 * 1 => 10
   * ALPHANUMERIC => 11 + 6 => 17
   * BYTE => 3 * 8 => 24
   * @return 指定长度的数据在不同类型下的bit位数
   */
  getSegmentBitsLength(len, mode) {
    switch (mode) {
      case Mode.NUMERIC:
        return NumericData.getBitsLength(len);
      case Mode.ALPHANUMERIC:
        return AlphanumericData.getBitsLength(len);
      case Mode.BYTE:
        return ByteData.getBitsLength(len);
    }
  }
  /**
   * 寻最短路径算法
   */
  find_path(map, dpLen) {
    let result = [];
    let dp = [];
    let iterator = map.start;
    for (let i = 0; i < dpLen; i++) {
      dp[i] = [Infinity, Infinity, Infinity];
    }
    Object.keys(iterator).forEach(pos => {
      dp[pos[0]][pos[1]] = iterator[pos];
    });
    for (let i = 0; i < dpLen; i++) {
      result.push('' + i + '0');
      for (let j = 0; j < 3; j++) {
        let key = '' + i + j;
        if (!map.hasOwnProperty(key)) break;
        iterator = map[key];
        if (iterator.hasOwnProperty('end')) break;
        Object.keys(iterator).forEach(pos => {
          let oldValue = dp[pos[0]][pos[1]];
          let newValue = dp[i][j] + iterator[pos];
          if (newValue < oldValue) {
            result[i] = key;
            dp[pos[0]][pos[1]] = newValue;
          }
        });
      }
    }
    return result;
  }
  // 合并同类型的相邻数据分片
  mergeSegments(segs) {
    return segs.reduce((acc, seg) => {
      let len = acc.length;
      let prevSeg = len ? acc[len - 1] : null;
      if (prevSeg && prevSeg.mode === seg.mode) {
        acc[len - 1].data += seg.data;
        return acc;
      }
      acc.push(seg);
      return acc;
    }, []);
  }
  // 返回优化后的数据分片
  fromString(version) {
    let nodes = this.buildNodes();
    let graph = this.buildGraph(nodes, version);
    let path = this.find_path(graph.map, nodes.length);
    let optimizedSegs = [];
    for (let i = 0; i < path.length; i++) {
      optimizedSegs.push(graph.table[path[i]].node);
    }
    return this.fromArray(this.mergeSegments(optimizedSegs));
  }
}

class ReedSolomonEncoder {
  encode() {
    return 0;
  }
}

/**
 * 主类
 */
class QRcode {
  /**
   * 使用Reed-Solomon编码字符
   * 这个方法看不懂啊!!!
   */
  createCodewords(bitBuffer, version, errorCorrectionLevel) {
    /**
     * 计算每个group包含block的数
     * @var totalCodewords codewords总数
     * @var ecTotalBlocks 映射的block数
     * @var blocksInGroup2 除不尽的block
     * @var blocksInGroup1 主block数
     * @var totalCodewordsInGroup1 主block的codewords数量
     * @example 以version => 2,errorCorrectionLevel => M为例
     * totalCodewords => 44
     * ecTotalCodewords => 16
     * dataTotalCodewords => 44 - 16 => 28
     * ecTotalBlocks => 1
     * @result
     * blocksInGroup2 => 0
     * blocksInGroup1 => 1
     * totalCodewordsInGroup1 => 44
     * dataCodewordsInGroup1 => 28
     * dataCodewordsInGroup2 => 29
     * ecCount => 16
     */
    let totalCodewords = Utils.getSymbolTotalCodewords(version);
    let ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
    let dataTotalCodewords = totalCodewords - ecTotalCodewords;

    let ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);

    let blocksInGroup2 = totalCodewords % ecTotalBlocks;
    let blocksInGroup1 = ecTotalBlocks - blocksInGroup2;

    let totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);

    let dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
    // ???
    let dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;

    // 纠错code数量
    let ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;
    // ???
    let rs = new ReedSolomonEncoder(ecCount);

    let offset = 0;
    let dcData = new Array(ecTotalBlocks);
    let ecData = new Array(ecTotalBlocks);
    // 这玩意是个憨憨
    let maxDataSize = 0;
    // 简单讲就是转为十六进制的buffer数组
    let buffer = Utils.BufferFrom(bitBuffer.buffer);

    /**
     * ecTotalBlocks = blocksInGroup1 + blocksInGroup2 => 1
     * dataCodewordsInGroup1 = (dataTotalCodewords / ecTotalBlocks) | 0 => 28
     * 本例中根本用不到2
     */
    for (let b = 0; b < ecTotalBlocks; b++) {
      let dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
      dcData[b] = buffer.slice(offset, offset + dataSize);
      ecData[b] = rs.encode(dcData[b]);

      offset += dataSize;
      maxDataSize = Math.max(maxDataSize, dataSize);
    }

    /**
     * Create final data
     * 前面是处理了Data 这里将data与error结合
     * 前面的关键步骤看不懂 呜呜呜
     */
    let data = Utils.BufferAlloc(totalCodewords);
    let index = 0;
    // 这个循环遍历dcData并将值弄进data数组中
    for (let i = 0; i < maxDataSize; i++) {
      for (let j = 0; j < ecTotalBlocks; j++) {
        if (i < dcData[j].length) {
          data[index++] = dcData[j][i];
        }
      }
    }

    // 这个循环就是把ecData搞进data里
    for (let i = 0; i < ecCount; i++) {
      for (let j = 0; j < ecTotalBlocks; j++) {
        data[index++] = ecData[j][i];
      }
    }

    return data;
  }
  // 将数据整合到一个buffer数组中
  createData(version, errorCorrectionLevel, segments) {
    let buffer = new BitBuffer();
    segments.forEach((data) => {
      // 4bit存类型
      buffer.put(data.mode.bit, 4);

      // 根据mode和version存数据长度数值
      buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));

      // 数据本身
      data.write(buffer);
    });

    // 这里的计算跟getCapacity一样
    let totalCodewords = Utils.getSymbolTotalCodewords(version);
    let ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
    let dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;

    // 数据长度+4小于给定长度时 加一个结束标记
    if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) {
      buffer.put(0, 4);
    }

    // bit长度非8的倍数时 填充0
    while (buffer.getLengthInBits() % 8 !== 0) {
      buffer.putBit(0);
    }

    // 保证数据长度与给定的容量匹配
    let n = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
    for (let i = 0; i < n; i++) {
      buffer.put(i % 2 ? 0x11 : 0xc, 8);
    }

    return this.createCodewords(buffer, version, errorCorrectionLevel);
  }
  createSymbol(data, errorCorrectionLevel, maskPattern) {
    let segments = null;
    // 暂时不处理Array类型的data
    {
      let Seg = new Segments(data);
      // 获取未优化数据所需version
      let rawSegments = Seg.RawSplit();
      let estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
      // 生成优化数据
      segments = Seg.fromString(estimatedVersion || 40);
    }
    // 根据优化的segments再确定一次version
    let version = Version.getBestVersionForData(segments, errorCorrectionLevel);
    // 返回data与error混合的buffer数组
    let dataBits = this.createData(version, errorCorrectionLevel, segments);

    /**
     * 开始生成二维码矩阵模型
     * 矩阵大小为version * 4 + 17
     */
    let moduleCount = Utils.getSymbolSize(version);
    let modules = new BitMatrix(moduleCount);

    /**
     * 添加函数模块(?英文就这么写的 反正函数名说明一切)
     * 这部分内容与data无关
     */
    // 画左上、右上、左下的正方形
    this.setupFinderPattern(modules, version);
    this.setupTimingPattern(modules);
    this.setupAlignmentPattern(modules, version);

    this.setupFormatInfo(modules, errorCorrectionLevel, 0);
    if (version >= 7) {
      this.setupVersionInfo(modules, version);
    }

    this.setupData(modules, dataBits);

    if (isNaN(maskPattern)) {
      maskPattern = MaskPattern.getBestMask(modules, this.setupFormatInfo.bind(null, modules, errorCorrectionLevel));
    }

    MaskPattern.applyMask(maskPattern, modules);

    this.setupFormatInfo(modules, errorCorrectionLevel, maskPattern);
    return { modules, version, errorCorrectionLevel, maskPattern, segments };
  }
  setupFinderPattern(matrix, version) {
    /**
     * 花里胡哨一套套
     * @param size 矩阵尺寸
     * @param pos 偏移数组
     */
    let size = matrix.size;
    let pos = Utils.getPosition(version);

    for (let i = 0; i < pos.length; i++) {
      // 第一轮总是0
      let row = pos[i][0];
      let col = pos[i][1];

      // -1有个鸡儿用?
      for (let r = -1; r <= 7; r++) {
        let R = row + r;
        let C = col + c;
        // 越界检测
        if (R <= -1 || R >= size) continue;
        for (let c = -1; c <= 7; c++) {
          if (C <= -1 || C >= size) continue;
          /**
           * 这个地方可以枚举
           * 已知[r, c]范围是[-1, 7] 则满足条件的所有[r, c]组合如下
           * [0 ~ 6, 0], [0 ~ 6, 6]
           * [0, 0 ~ 6], [6, 0 ~ 6]
           * [2 ~ 4, 2 ~ 4]
           * 若无视pos 在7 * 7的矩阵图如下
           * 
           *       * * * * * * * 
           *       *           * 
           *       *   * * *   * 
           *       *   * * *   * 
           *       *   * * *   * 
           *       *           * 
           *       * * * * * * * 
           * 
           * 就是二维码左上右上左下那个正方形
           */
          if ((r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix.set(R, C, true, true);
          } else {
            matrix.set(R, C, false, true);
          }
        }
      }
    }
  }
  setupTimingPattern(matrix) {
    let size = matrix.size;
    /**
     * 以version2为例 size => 25
     * [8 ~ 16的偶数, 6], [6, 8 ~ 16的偶数]
     * 图形如下
     *     左上角                           右上角
     *     *           *                   *           *
     *     * * * * * * *   *   *   *   *   * * * * * * *
     *                 
     *                 *
     *                 ...
     * 
     *                 *
     * 
     *     * * * * * * *
     *     左下角
     */
    for (let r = 8; r < size - 8; r++) {
      // 偶数为true
      let value = r % 2 === 0;
      matrix.set(r, 6, value, true);
      matrix.set(6, r, value, true);
    }
  }
}

let str = 'www.baI123du.com';
new QRcode().createSymbol(str, ECLevel.M);