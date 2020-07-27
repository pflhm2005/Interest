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
class Util {
  static CODEWORDS_COUNT = [
    0, // Not used
    26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
    404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
    1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185,
    2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706
  ];
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
    let nSegs = Util.getSegments(NumericRegex, Mode.NUMERIC, str);
    let aSegs = Util.getSegments(AlphanumerRegex, Mode.ALPHANUMERIC, str);
    let bSegs = Util.getSegments(ByteRegex, Mode.BYTE, str);
    return [...nSegs, ...aSegs, ...bSegs].sort((a, b) => a.index - b.index).map((o) => ({
      data: o.data,
      mode: o.mode,
      length: o.length,
    }));
  }
  static getSymbolTotalCodewords(version) {
    return Util.CODEWORDS_COUNT[version];
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
}
// Brower环境下需要自己实现Buffer
class _Buffer {
}

// codewords的buffer
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
   * 将指定字符以指定长度加入buffer
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

    if (bit) {
      this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
    }
    this.length++
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
    super(Util.BufferFrom(data));
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
    let totalCodewords = Util.getSymbolTotalCodewords(version);
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
    this.segs = Util.splitString(data);
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

/**
 * 主类
 */
class QRcode {
  // 返回codewords
  static createData(version, errorCorrectionLevel, segments) {
    let buffer = new BitBuffer();
    segments.forEach((data) => {
      // 4bit存类型 => Numeric,Alphanumeric,Byte,Kanji
      buffer.put(data.mode.bit, 4);

      // 根据ccbit存长度
      buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));

      // 数据本身
      data.write(buffer);
    });

    // return createCodewords(buffer, version, errorCorrectionLevel);
  }
  static createSymbol(data, errorCorrectionLevel) {
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
    let bestVersion = Version.getBestVersionForData(segments, errorCorrectionLevel);
    let dataBits = QRcode.createData(bestVersion, errorCorrectionLevel, segments);
  }
}

let str = 'www.baI123du.com';
QRcode.createSymbol(str, ECLevel.M);